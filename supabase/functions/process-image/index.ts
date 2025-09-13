// supabase/functions/process-image/index.ts
// v.FALAI-DB-PROMPT — Versão final que lê prompts do banco de dados e inclui todas as correções.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { v4 as uuidv4 } from "https://esm.sh/uuid@8.3.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Lembre-se de ajustar para seu domínio de produção
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
if (!FAL_API_KEY) throw new Error("FAL_API_KEY não configurada");

// ---------- Helpers ----------
async function fetchImageAsBytes(url: string): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("Falha ao baixar imagem final da IA.");
  const buf = new Uint8Array(await resp.arrayBuffer());
  const ct = resp.headers.get("content-type");
  return { bytes: buf, contentType: ct };
}

function pickExtAndContentType(contentType: string | null, fallback: { ext: string; ct: string }) {
  if (!contentType) return fallback;
  if (contentType.includes("png")) return { ext: "png", ct: "image/png" };
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return { ext: "jpg", ct: "image/jpeg" };
  return fallback;
}

// ---------- Fal.ai call ----------
async function falAiEdit(
  imageUrl: string,
  prompt: string
): Promise<{ bytes: Uint8Array; contentType:string | null }> {
  const payload = {
    model_name: 'fal-ai/flux-pro/kontext',
    prompt: prompt,
    image_url: imageUrl,
    output_format: "png" // Garante consistência
  };

  console.log("[FAL.AI] Payload enviado:", payload);

  const response = await fetch("https://fal.ai/api/v1", {
    method: "POST",
    headers: {
      "Authorization": `Key ${FAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json();
  console.log("[FAL.AI] Resposta recebida:", json);

  if (!response.ok) {
    throw new Error(`Fal.ai retornou um erro: ${JSON.stringify(json)}`);
  }

  // CORREÇÃO: A resposta vem em um array 'images'
  const outputUrl = json?.images?.[0]?.url;
  if (!outputUrl) throw new Error("Fal.ai não retornou uma URL válida de imagem.");

  return await fetchImageAsBytes(outputUrl);
}


// ---------- HTTP handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    console.log("--- [INÍCIO] Processamento de Imagem v.FALAI-DB-PROMPT ---");
    const { image_path, processing_type, project_id } = await req.json();

    if (!image_path || !processing_type) throw new Error("Parâmetro 'image_path' ou 'processing_type' ausente.");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Cabeçalho de autorização ausente.");
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("Usuário não autenticado.");

    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("remaining_images")
      .eq("id", user.id)
      .single();
    if (!profile || profile.remaining_images <= 0) throw new Error("Créditos insuficientes.");

    const { data: signedUrlData, error: urlErr } = await supabaseAdmin.storage
      .from("uploaded-images")
      .createSignedUrl(image_path, 300);
    if (urlErr || !signedUrlData?.signedUrl) throw new Error("Erro ao gerar URL assinada.");
    const inputImageUrl = signedUrlData.signedUrl;

    // Lógica para buscar prompts do banco de dados
    const { data: settings } = await supabaseAdmin.from("platform_settings").select("falai_prompt_food, falai_prompt_products").eq("id", 1).single();
    if (!settings) throw new Error("Configurações da plataforma não encontradas.");
    
    const promptMap: Record<string, string | null> = {
      alimentos: settings.falai_prompt_food,
      produtos: settings.falai_prompt_products,
    };
    
    const prompt = promptMap[processing_type];
    if (!prompt) {
      throw new Error(`Categoria inválida ou prompt não configurado no banco: ${processing_type}`);
    }

    const { bytes, contentType } = await falAiEdit(
      inputImageUrl,
      prompt
    );

    const extAndCt = pickExtAndContentType(contentType, { ext: "png", ct: "image/png" });
    const processedFileName = `processed_${uuidv4()}.${extAndCt.ext}`;
    const processedPath = `${user.id}/${processedFileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from("processed-images")
      .upload(processedPath, bytes, { contentType: extAndCt.ct, upsert: false });
    if (uploadError) throw new Error(`Falha ao salvar imagem processada: ${uploadError.message}`);
    
    // CORREÇÃO: O nome do parâmetro é 'user_id'
    await supabaseAdmin.rpc("decrement_user_credits", { user_id: user.id, credit_amount: 1 });
    
    await supabaseAdmin.from("processed_images").insert({
      user_id: user.id,
      processed_file_path: processedPath,
      processing_type,
      project_id: project_id || null,
      ai_model_used: "fal-ai/flux-pro/kontext",
    });

    const { data: publicUrlData } = supabaseAdmin.storage.from("processed-images").getPublicUrl(processedPath);

    console.log("--- [FIM] Processamento concluído com sucesso ---");
    return new Response(
      JSON.stringify({
        processed_file_path: processedPath,
        processed_url: publicUrlData?.publicUrl,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (err) {
    console.error("[ERRO GERAL]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
