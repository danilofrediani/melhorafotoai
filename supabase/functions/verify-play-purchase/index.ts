import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v4.14.4/index.ts";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const ANDROID_PUBLISHER = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

const SA_EMAIL = Deno.env.get("GOOGLE_SA_EMAIL");
const SA_PK = (Deno.env.get("GOOGLE_SA_PRIVATE_KEY") || "").replace(/\\n/g, "\n");
const PACKAGE_NAME = Deno.env.get("GP_PACKAGE_NAME");
const SKU_TO_CREDITS: Record<string, number> = {
  credits_10: 10,
  credits_20: 20,
  credits_50: 50
};
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const pk = await importPKCS8(SA_PK, "RS256");
  const jwt = await new SignJWT({ scope: SCOPE }).setProtectedHeader({ alg: "RS256", typ: "JWT" }).setIssuedAt(now).setIssuer(SA_EMAIL).setSubject(SA_EMAIL).setAudience(GOOGLE_TOKEN_URL).setExpirationTime(now + 3600).sign(pk);
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt })
  });
  if (!res.ok) {
    const t = await res.text().catch(()=>"");
    throw new Error(`Falha ao obter access_token: ${res.status} ${t}`);
  }
  const data = await res.json();
  return data.access_token;
}


Deno.serve(async (req)=>{
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    
    const { sku, purchaseToken } = await req.json();
    if (!sku || !purchaseToken) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let orderId = purchaseToken;

    if (purchaseToken.startsWith('FAKE_PURCHASE_TOKEN_')) {
      console.log(`MODO SIMULAÇÃO: Compra aprovada para o SKU: ${sku}`);
    } else {
      const accessToken = await getAccessToken();
      const getUrl = `${ANDROID_PUBLISHER}/applications/${PACKAGE_NAME}/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(purchaseToken)}`;
      const getRes = await fetch(getUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      const purchase = await getRes.json();
      orderId = purchase.orderId;
      
      if (!getRes.ok || purchase.purchaseState !== 0) {
        return new Response(JSON.stringify({ error: "Compra inválida ou não concluída.", details: purchase }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const consumeUrl = `${ANDROID_PUBLISHER}/applications/${PACKAGE_NAME}/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(purchaseToken)}:consume`;
      const consumeRes = await fetch(consumeUrl, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });

      if (!consumeRes.ok) {
        const t = await consumeRes.text().catch(()=>"");
        return new Response(JSON.stringify({ error: `Falha ao consumir a compra: ${consumeRes.status} ${t}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const creditsToAdd = SKU_TO_CREDITS[sku] ?? 0;
    if (creditsToAdd > 0) {
      const authHeader = req.headers.get('Authorization')!;
      const jwt = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(jwt);

      if (!user) throw new Error("Usuário não encontrado a partir do token.");
      
      const { error: rpcError } = await supabaseAdmin.rpc('add_user_credits', {
        user_id_param: user.id,
        credit_amount: creditsToAdd
      });

      if (rpcError) {
        throw new Error(`Falha ao adicionar créditos: ${rpcError.message}`);
      }

      // ✅ --- AJUSTE FINAL AQUI --- ✅
      // 1. Buscamos o ID do pacote no banco de dados usando o SKU do Google
      const { data: packageData, error: pkgError } = await supabaseAdmin
        .from('packages')
        .select('id, price')
        .eq('google_play_sku', sku)
        .single();
      
      if(pkgError) {
        console.error("Erro ao buscar o pacote correspondente ao SKU para registrar a transação:", pkgError);
        // Não paramos o processo, pois o crédito já foi dado. Apenas logamos.
      }

      // 2. Registramos a transação com o package_id correto
      const { error: transactionError } = await supabaseAdmin.from('transactions').insert({
        user_id: user.id,
        package_id: packageData?.id || null, // Usamos o ID que encontramos
        amount: packageData?.price || 0, // Usamos o preço do nosso banco
        currency: 'BRL',
        status: 'completed',
        payment_method: purchaseToken.startsWith('FAKE_PURCHASE_TOKEN_') ? 'google_play_test' : 'google_play',
        metadata: { sku, provider_order_id: orderId }
      });

      if (transactionError) {
        console.error("Erro ao registrar a transação, mas os créditos foram concedidos:", transactionError);
      }
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      creditsAdded: creditsToAdd, 
      sku 
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Erro inesperado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
