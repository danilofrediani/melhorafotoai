// supabase/functions/process-image/index.ts
// vFAL-final — integração Fal.ai (flux-pro/kontext/max) + Supabase
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { v4 as uuidv4 } from "https://esm.sh/uuid@8.3.2";

// ===== CORS =====
const CORS_ORIGIN = Deno.env.get("CORS_ORIGIN") ?? "https://melhorafotoai-mvp.vercel.app";
const corsHeaders = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "600",
  "Vary": "Origin",
  "X-Function-Version": "process-image-vFal-final",
};

// ===== Supabase Admin client =====
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados");

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ===== Fal config =====
const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
const FAL_API_URL = Deno.env.get("FAL_API_URL") ?? "https://fal.run/fal-ai/flux-pro/kontext/max"; // endpoint "run" que você já usou
if (!FAL_API_KEY) throw new Error("FAL_API_KEY não configurada");

// ===== Utils =====
async function fetchJson(res: Response) {
  try { return await res.json(); } catch { return null; }
}

// ===== chamar Fal (generate/edit) =====
async function callFalKontextMax(imageUrl: string, prompt: string) {
  console.log("[FAL] invocando modelo com imageUrl:", imageUrl);
  console.log("[FAL] prompt enviado:", prompt);

  const body = {
    prompt,
    image_url: imageUrl,
    // parâmetros adicionais se quiser: {size: "1024", quality: "high"} dependendo do endpoint Fal
  };

  const res = await fetch(FAL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await fetchJson(res);
  if (!res.ok) {
    console.error("[FAL][ERRO] status:", res.status, "body:", JSON.stringify(json));
    throw new Error(`Erro Fal.ai: ${res.status} ${JSON.stringify(json)}`);
  }

  // Fal pode retornar em `images[0].url` ou `output[0].url` — tentamos ambos
  const outputUrl = json?.images?.[0]?.url ?? json?.output?.[0]?.url ?? json?.result?.images?.[0]?.url;
  if (!outputUrl) {
    console.error("[FAL][ERRO] resposta sem url:", JSON.stringify(json));
    throw new Error("Fal.ai não retornou imagem (nenhuma url encontrada)");
  }

  console.log("[FAL] outputUrl encontrada:", outputUrl);
  return { outputUrl, rawResponse: json };
}

// ===== Handler =====
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    console.log("--- [START] process-image vFal-final ---");
    const body = await req.json();
    const { image_path, processing_type, project_id } = body ?? {};
    console.log("[BODY]", body);

    if (!image_path || !processing_type) throw new Error("image_path ou processing_type ausente");

    // ===== Auth =====
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Cabeçalho de autorização ausente");
    const token = authHeader.replace("Bearer ", "");
    const { data: userRes } = await supabaseAdmin.auth.getUser(token);
    const user = userRes?.user;
    if (!user) throw new Error("Usuário não autenticado");

    // ===== Verificar créditos =====
    const { data: userProfile, error: userErr } = await supabaseAdmin
      .from("users")
      .select("remaining_images")
      .eq("id", user.id)
      .single();
    if (userErr) throw userErr;
    if (!userProfile || userProfile.remaining_images <= 0) throw new Error("Créditos insuficientes");

    // ===== Signed URL da original =====
    const { data: signedUrlData, error: urlErr } = await supabaseAdmin.storage
      .from("uploaded-images")
      .createSignedUrl(image_path, 300);
    if (urlErr || !signedUrlData?.signedUrl) throw new Error("Erro ao gerar signed URL da imagem original");
    const signedUrl = signedUrlData.signedUrl;
    console.log("[STORAGE] signedUrl gerada");

    // ===== Prompt base (da tabela platform_settings) =====
    const { data: settings } = await supabaseAdmin
      .from("platform_settings")
      .select("*")
      .eq("id", 1)
      .single();

    const categoryKey = `prompt_modifier_${processing_type}`;
    let basePrompt = settings?.[categoryKey] || "Executar apenas ajustes fotográficos sutis. Não criar ou alterar elementos.";
    // log do prompt final
    console.log("[PROMPT FINAL]", basePrompt);

    // ===== Chamar Fal =====
    let fal_output_url: string | null = null;
    let fal_raw_response: any = null;
    let outBytes: Uint8Array | null = null;

    try {
      const falRes = await callFalKontextMax(signedUrl, basePrompt);
      fal_output_url = falRes.outputUrl;
      fal_raw_response = falRes.rawResponse;

      // baixar bytes da outputUrl
      const fileResp = await fetch(fal_output_url);
      if (!fileResp.ok) throw new Error(`Falha ao baixar imagem do Fal.ai: ${fileResp.status}`);
      const arrayBuf = await fileResp.arrayBuffer();
      outBytes = new Uint8Array(arrayBuf);
      console.log("[FAL] bytes baixados:", outBytes.length);
    } catch (falErr) {
      console.error("[FAL][ERRO]", falErr);
      // fallback: baixar a imagem original e usar como resultado
      console.log("[FALLBACK] usando original (falhou Fal)");
      const { data: originalBlob, error: dlErr } = await supabaseAdmin.storage.from("uploaded-images").download(image_path);
      if (dlErr || !originalBlob) throw new Error("Falha ao baixar imagem original para fallback");
      outBytes = new Uint8Array(await originalBlob.arrayBuffer());
      fal_output_url = null;
      fal_raw_response = { error: String(falErr) };
    }

    // ===== Upload do resultado para bucket processed-images =====
    const processedFileName = `processed_${uuidv4()}.png`;
    const processedPath = `${user.id}/${processedFileName}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("processed-images")
      .upload(processedPath, outBytes!, { contentType: "image/png", upsert: true });
    if (upErr) throw new Error("Falha ao salvar imagem processada no storage: " + upErr.message);
    console.log("[STORAGE] processado salvo em:", processedPath);

    // pegar publicUrl
    const { data: publicUrlData } = supabaseAdmin.storage.from("processed-images").getPublicUrl(processedPath);
    const processedPublicUrl = publicUrlData?.publicUrl ?? null;
    console.log("[STORAGE] publicUrl:", processedPublicUrl);

    // ===== Decrementar créditos (RPC) =====
    try {
      await supabaseAdmin.rpc("decrement_user_credits", { user_id: user.id, credit_amount: 1 });
    } catch (decErr) {
      console.warn("[WARN] decrement_user_credits:", decErr);
    }

    // ===== Registrar no DB processed_images (incluir parâmetros com fal_output_url e prompt) =====
    try {
      const processing_parameters = {
        fal_output_url,
        fal_raw_response,
      };
      await supabaseAdmin.from("processed_images").insert({
        user_id: user.id,
        processed_file_path: processedPath,
        processing_type,
        file_size: outBytes?.length ?? null,
        project_id: project_id || null,
        ai_model_used: "fal-ai/flux-pro/kontext/max",
        processing_parameters,
        prompt_usado: basePrompt,
        source_image_path: image_path,
      });
    } catch (insErr) {
      console.warn("[WARN] insert processed_images:", insErr);
    }

    console.log("--- [END] process-image vFal-final SUCCESS ---");

    return new Response(
      JSON.stringify({
        success: true,
        processed_file_path: processedPath,
        processed_url: processedPublicUrl,
        fal_output_url,
        prompt_sent: basePrompt,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[ERRO CAPTURADO]", err);
    return new Response(
      JSON.stringify({ success: false, message: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

