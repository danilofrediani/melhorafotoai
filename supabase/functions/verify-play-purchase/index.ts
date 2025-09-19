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
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
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
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Payload inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sku, purchaseToken } = body || {};
    if (!sku || !purchaseToken) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[verify-play-purchase] sku=${sku}, token=${String(purchaseToken).slice(0, 40)}...`);

    let orderId = purchaseToken;
    let isSimulated = false;

    if (String(purchaseToken).startsWith("FAKE_PURCHASE_TOKEN_")) {
      isSimulated = true;
      console.log(`[verify-play-purchase] MODO SIMULAÇÃO para ${sku}`);
    } else {
      // Validação no Google Play (sem consumir)
      const accessToken = await getAccessToken();
      const getUrl = `${ANDROID_PUBLISHER}/applications/${PACKAGE_NAME}/purchases/products/${encodeURIComponent(
        sku
      )}/tokens/${encodeURIComponent(purchaseToken)}`;
      console.log("[verify-play-purchase] consultando Google Play", getUrl);

      const getRes = await fetch(getUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const purchase = await getRes.json().catch(() => null);
      orderId = purchase?.orderId ?? orderId;

      if (!getRes.ok) {
        console.error("[verify-play-purchase] Erro Google Play", getRes.status, purchase);
        return new Response(JSON.stringify({ error: "Falha ao validar compra com Google Play" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (purchase?.purchaseState !== 0) {
        console.warn("[verify-play-purchase] purchaseState inválido", purchase);
        return new Response(JSON.stringify({ error: "Compra não concluída", details: purchase }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Créditos
    const creditsToAdd = SKU_TO_CREDITS[sku] ?? 0;
    if (creditsToAdd > 0) {
      const authHeader = req.headers.get("Authorization") || "";
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Authorization header ausente" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const jwt = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
      if (userErr || !user) {
        return new Response(JSON.stringify({ error: "Usuário inválido" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`[verify-play-purchase] Créditos +${creditsToAdd} para ${user.id}`);
      const { error: rpcError } = await supabaseAdmin.rpc("add_user_credits", {
        user_id_param: user.id,
        credit_amount: creditsToAdd,
      });
      if (rpcError) {
        console.error("[verify-play-purchase] Erro RPC add_user_credits", rpcError);
        return new Response(JSON.stringify({ error: "Falha ao adicionar créditos" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Registrar transação
      try {
        const { data: pkg } = await supabaseAdmin
          .from("packages")
          .select("id, price")
          .eq("google_play_sku", sku)
          .single();

        await supabaseAdmin.from("transactions").insert({
          user_id: user.id,
          package_id: pkg?.id || null,
          amount: pkg?.price || 0,
          currency: "BRL",
          status: "completed",
          payment_method: isSimulated ? "google_play_test" : "google_play",
          metadata: { sku, provider_order_id: orderId },
        });
      } catch (err) {
        console.error("[verify-play-purchase] Erro ao registrar transação", err);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, creditsAdded: creditsToAdd, sku, orderId, simulated: isSimulated }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    console.error("[verify-play-purchase] EXCEPTION", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro inesperado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

