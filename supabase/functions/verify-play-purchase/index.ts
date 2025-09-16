// verify-play-purchase/index.ts
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
  const jwt = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt(now)
    .setIssuer(SA_EMAIL)
    .setSubject(SA_EMAIL)
    .setAudience(GOOGLE_TOKEN_URL)
    .setExpirationTime(now + 3600)
    .sign(pk);

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

Deno.serve(async (req) => {
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

    let body: any;
    try {
      body = await req.json();
    } catch (err) {
      console.error('[verify-play-purchase] payload parse error', err);
      return new Response(JSON.stringify({ error: "Payload inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { sku, purchaseToken } = body || {};
    if (!sku || !purchaseToken) {
      console.warn('[verify-play-purchase] missing params', { sku, purchaseToken });
      return new Response(JSON.stringify({ error: "Parâmetros inválidos (sku e purchaseToken são obrigatórios)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[verify-play-purchase] Requisição recebida. sku=${sku} token=${String(purchaseToken).slice(0,40)}...`);

    let orderId = purchaseToken;
    let isSimulated = false;

    if (String(purchaseToken).startsWith('FAKE_PURCHASE_TOKEN_')) {
      isSimulated = true;
      console.log(`[verify-play-purchase] MODO SIMULAÇÃO: Compra aprovada para o SKU: ${sku}`);
    } else {
      // Validação no Google Play
      const accessToken = await getAccessToken();
      const getUrl = `${ANDROID_PUBLISHER}/applications/${PACKAGE_NAME}/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(purchaseToken)}`;
      console.log('[verify-play-purchase] consultando Google Play', getUrl);
      const getRes = await fetch(getUrl, { headers: { Authorization: `Bearer ${accessToken}` } });

      const purchase = await getRes.json().catch(()=>null);
      orderId = purchase?.orderId ?? orderId;

      if (!getRes.ok) {
        const t = JSON.stringify(purchase).slice(0,1000);
        console.error('[verify-play-purchase] Resultado Google Play NOK', getRes.status, t);
        return new Response(JSON.stringify({ error: "Falha ao validar compra com Google Play", details: purchase }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // purchaseState = 0 é comprado
      if (purchase?.purchaseState !== 0) {
        console.warn('[verify-play-purchase] purchaseState não é 0', purchase);
        return new Response(JSON.stringify({ error: "Compra inválida ou não concluída.", details: purchase }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Consumir a compra (in-app consumable)
      try {
        const consumeUrl = `${ANDROID_PUBLISHER}/applications/${PACKAGE_NAME}/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(purchaseToken)}:consume`;
        console.log('[verify-play-purchase] consumindo no Google Play', consumeUrl);
        const consumeRes = await fetch(consumeUrl, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });
        if (!consumeRes.ok) {
          const t = await consumeRes.text().catch(()=>"");
          console.error('[verify-play-purchase] Falha ao consumir', consumeRes.status, t);
          // Não falhamos aqui fatalmente — mas retornamos erro
          return new Response(JSON.stringify({ error: `Falha ao consumir a compra no Google Play: ${consumeRes.status}`, details: t }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      } catch (err) {
        console.error('[verify-play-purchase] erro ao consumir no google', err);
        return new Response(JSON.stringify({ error: "Erro ao consumir a compra no Google Play", details: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Adiciona créditos no DB via RPC
    const creditsToAdd = SKU_TO_CREDITS[sku] ?? 0;
    if (creditsToAdd > 0) {
      // Valida header Authorization e busca usuário
      const authHeader = (req.headers.get('Authorization') || '');
      if (!authHeader.startsWith('Bearer ')) {
        console.warn('[verify-play-purchase] Authorization header ausente ou inválido');
        return new Response(JSON.stringify({ error: "Authorization header ausente" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const jwt = authHeader.replace('Bearer ', '');
      const { data: { user }, error: getUserErr } = await supabaseAdmin.auth.getUser(jwt);
      if (getUserErr) {
        console.error('[verify-play-purchase] supabase.auth.getUser erro', getUserErr);
        return new Response(JSON.stringify({ error: "Token inválido" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (!user) {
        console.error('[verify-play-purchase] usuário não encontrado a partir do token');
        return new Response(JSON.stringify({ error: "Usuário não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      console.log(`[verify-play-purchase] Adicionando ${creditsToAdd} créditos para user ${user.id}`);

      const { error: rpcError } = await supabaseAdmin.rpc('add_user_credits', {
        user_id_param: user.id,
        credit_amount: creditsToAdd
      });

      if (rpcError) {
        console.error('[verify-play-purchase] Falha rpc add_user_credits', rpcError);
        // continuar: registrar transação mesmo com falha em rpc seria arriscado, mas retornamos erro
        return new Response(JSON.stringify({ error: "Falha ao adicionar créditos", details: rpcError }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // BUSCAR PACKAGE_ID (se existir) para registrar transação
      let packageData = null;
      try {
        const { data, error: pkgError } = await supabaseAdmin
          .from('packages')
          .select('id, price')
          .eq('google_play_sku', sku)
          .single();
        if (pkgError) {
          console.warn('[verify-play-purchase] package not found for sku', sku, pkgError);
        } else {
          packageData = data;
        }
      } catch (err) {
        console.error('[verify-play-purchase] erro ao buscar package', err);
      }

      // Inserir transação
      try {
        const { error: transactionError } = await supabaseAdmin.from('transactions').insert({
          user_id: user.id,
          package_id: packageData?.id || null,
          amount: packageData?.price || 0,
          currency: 'BRL',
          status: 'completed',
          payment_method: isSimulated ? 'google_play_test' : 'google_play',
          metadata: { sku, provider_order_id: orderId }
        });

        if (transactionError) {
          console.error('[verify-play-purchase] Erro ao registrar transaction', transactionError);
          // não interrompe porque créditos já foram dados
        } else {
          console.log('[verify-play-purchase] transaction registrada com sucesso', { user: user.id, sku, orderId });
        }
      } catch (err) {
        console.error('[verify-play-purchase] Erro inesperado ao registrar transaction', err);
      }
    } else {
      console.warn('[verify-play-purchase] SKU não mapeado para créditos', sku);
    }

    return new Response(JSON.stringify({
      ok: true,
      creditsAdded: creditsToAdd,
      sku,
      orderId,
      simulated: isSimulated
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (e) {
    console.error('[verify-play-purchase] EXCEPTION', e);
    return new Response(JSON.stringify({ error: e?.message || "Erro inesperado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

