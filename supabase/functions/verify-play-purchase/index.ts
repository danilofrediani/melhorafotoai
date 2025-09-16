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
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
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
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }

    const body = await req.json().catch(()=>null);
    if (!body) {
      return new Response(JSON.stringify({ error: "Payload inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }

    const { sku, purchaseToken } = body;
    if (!sku || !purchaseToken) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos: sku e purchaseToken são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }

    // idempotência / proteção contra reprocessamento
    let orderId = purchaseToken;

    // Se for token fake (modo simulação), não chamamos Google.
    if (purchaseToken.startsWith('FAKE_PURCHASE_TOKEN_')) {
      console.log(`[verify-play-purchase] MODO SIMULAÇÃO: compra aprovada para SKU ${sku}`);
      orderId = purchaseToken;
    } else {
      // Fluxo real: validar com Google e consumir o token
      const accessToken = await getAccessToken();
      const getUrl = `${ANDROID_PUBLISHER}/applications/${PACKAGE_NAME}/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(purchaseToken)}`;
      const getRes = await fetch(getUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      const purchase = await getRes.json();
      orderId = purchase.orderId ?? orderId;

      if (!getRes.ok) {
        console.error('[verify-play-purchase] Erro ao consultar Google:', getRes.status, purchase);
        return new Response(JSON.stringify({ error: "Falha ao validar compra com Google Play", details: purchase }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      }

      // purchaseState === 0 é PURCHASED (concluído)
      if (purchase.purchaseState !== 0) {
        console.error('[verify-play-purchase] Compra não concluída. purchaseState=', purchase.purchaseState, purchase);
        return new Response(JSON.stringify({ error: "Compra inválida ou não concluída.", details: purchase }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      }

      // consumir o token para evitar reutilização
      const consumeUrl = `${ANDROID_PUBLISHER}/applications/${PACKAGE_NAME}/purchases/products/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(purchaseToken)}:consume`;
      const consumeRes = await fetch(consumeUrl, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` } });

      if (!consumeRes.ok) {
        const t = await consumeRes.text().catch(()=>"");
        console.error('[verify-play-purchase] Falha ao consumir compra:', consumeRes.status, t);
        // Não bloqueamos totalmente: retornamos erro para investigar. Melhor não marcar créditos se não consumiu.
        return new Response(JSON.stringify({ error: `Falha ao consumir a compra: ${consumeRes.status} ${t}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      }
    }

    // --- ID do pacote e créditos ---
    const creditsToAdd = SKU_TO_CREDITS[sku] ?? 0;

    // Checar idempotência no DB: se já existe transação com este provider_order_id -> NÃO reprocessar.
    const { data: existingTx, error: existErr } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .maybeSingle()
      .eq('metadata->>provider_order_id', String(orderId));

    if (existErr) {
      console.warn('[verify-play-purchase] Erro ao verificar transação existente (prosseguindo):', existErr);
    } else if (existingTx) {
      console.log('[verify-play-purchase] Transação já processada, id=', existingTx.id, 'provider_order_id=', orderId);
      return new Response(JSON.stringify({ ok: true, alreadyProcessed: true, transactionId: existingTx.id, creditsAdded: 0, sku }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }

    // Recupera usuário a partir do Authorization Bearer token
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
    const jwt = authHeader.replace('Bearer ', '').trim();
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Authorization header (Bearer token) obrigatório." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }

    const { data: getUserRes, error: getUserErr } = await supabaseAdmin.auth.getUser(jwt);
    if (getUserErr || !getUserRes?.user) {
      console.error('[verify-play-purchase] Usuário não encontrado via token:', getUserErr);
      return new Response(JSON.stringify({ error: "Usuário inválido ou token expirado." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }
    const user = getUserRes.user;

    // ADICIONA CRÉDITOS via RPC seguro (transacional do Postgres ideally)
    if (creditsToAdd > 0) {
      const { error: rpcError } = await supabaseAdmin.rpc('add_user_credits', {
        user_id_param: user.id,
        credit_amount: creditsToAdd
      });

      if (rpcError) {
        console.error('[verify-play-purchase] Falha ao adicionar créditos (RPC):', rpcError);
        return new Response(JSON.stringify({ error: `Falha ao adicionar créditos: ${rpcError.message}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      }
    }

    // BUSCAR dados do package para registrar amount, package_id etc.
    const { data: packageData, error: pkgError } = await supabaseAdmin
      .from('packages')
      .select('id, price')
      .eq('google_play_sku', sku)
      .maybeSingle();

    if (pkgError) {
      console.warn('[verify-play-purchase] Não foi possível buscar package para sku', sku, pkgError);
    }

    // Registrar transação no DB (audit)
    const txInsert = {
      user_id: user.id,
      package_id: packageData?.id ?? null,
      amount: packageData?.price ?? 0,
      currency: 'BRL',
      status: 'completed',
      payment_method: purchaseToken.startsWith('FAKE_PURCHASE_TOKEN_') ? 'google_play_test' : 'google_play',
      metadata: { sku, provider_order_id: orderId, purchaseToken }
    };

    const { data: txData, error: txError } = await supabaseAdmin
      .from('transactions')
      .insert(txInsert)
      .select()
      .maybeSingle();

    if (txError) {
      console.error('[verify-play-purchase] Erro ao registrar transação:', txError);
      // Já concedemos créditos — mas logamos e retornamos aviso
      return new Response(JSON.stringify({ ok: true, creditsAdded: creditsToAdd, sku, warning: 'Crédito adicionado mas falha ao registrar transação' }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }

    // Tudo certo
    return new Response(JSON.stringify({
      ok: true,
      creditsAdded: creditsToAdd,
      sku,
      transactionId: txData?.id ?? null
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }});

  } catch (e: any) {
    console.error('[verify-play-purchase] Erro inesperado:', e);
    return new Response(JSON.stringify({ error: e?.message || "Erro inesperado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

