// Atualiza: public.users.remaining_images
// Mantém: CORS simples, limite diário, log em ad_rewards

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

type Body = { amount?: number; device_hint?: string };

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    // 1) Autenticação
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    const user = userData?.user ?? null;
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    // 2) Body
    const body = (await req.json().catch(() => ({}))) as Body;
    const amount = Math.max(1, Math.min(5, Number(body.amount ?? 1)));
    const deviceHint = (body.device_hint ?? "").slice(0, 100);

    // 3) Limite diário (3/dia)
    const LIMIT_PER_DAY = 3;
    const todayStart = new Date();
    todayStart.setHours(todayStart.getHours() - 24); // últimas 24h rolling window

    const { data: todayRows, error: countErr } = await admin
      .from("ad_rewards")
      .select("amount")
      .eq("user_id", user.id)
      .gte("created_at", todayStart.toISOString());

    if (countErr && (countErr as any).code === "42P01") {
      // tabela de log ainda não existe
      return new Response(JSON.stringify({ ok: false, error: "TABLE_MISSING" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS },
      });
    }

    const grantedToday =
      (todayRows ?? []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

    if (grantedToday + amount > LIMIT_PER_DAY) {
      return new Response(
        JSON.stringify({
          ok: false,
          reason: "DAILY_LIMIT",
          grantedToday,
          limit: LIMIT_PER_DAY,
        }),
        { status: 429, headers: { "Content-Type": "application/json", ...CORS } }
      );
    }

    // 4) Log
    const { error: insErr } = await admin.from("ad_rewards").insert({
      user_id: user.id,
      amount,
      device_hint: deviceHint || null,
    });
    if (insErr) {
      return new Response(
        JSON.stringify({ ok: false, error: "DB_ERROR", details: insErr }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS } }
      );
    }

    // 5) Incrementa saldo em public.users.remaining_images (RPC atômico)
    const { data: incData, error: incErr } = await admin.rpc(
      "increment_remaining_images_users",
      { p_user_id: user.id, p_delta: amount }
    );
    if (incErr) {
      if ((incErr as any).code === "42883") {
        // função não existe ainda
        return new Response(JSON.stringify({ ok: false, error: "RPC_MISSING" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }
      return new Response(
        JSON.stringify({ ok: false, error: "DB_ERROR", details: incErr }),
        { status: 500, headers: { "Content-Type": "application/json", ...CORS } }
      );
    }

    const newBalance = incData as number;
    return new Response(JSON.stringify({ ok: true, amount, newBalance }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "INTERNAL" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});

