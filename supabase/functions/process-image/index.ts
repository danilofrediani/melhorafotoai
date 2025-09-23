// supabase/functions/process-image/index.ts
// v.LINKED-IMAGES — Recebe e salva o uploaded_image_id para ligar as tabelas.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { v4 as uuidv4 } from "https://esm.sh/uuid@8.3.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
if (!FAL_API_KEY) throw new Error("FAL_API_KEY não configurada");

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

async function falAiEdit(
  imageUrl: string,
  prompt: string
): Promise<{ bytes: Uint8Array; contentType:string | null }> {
  
  const API_URL = "https://fal.run/fal-ai/flux-pro/kontext";

  const payload = {
    prompt: prompt,
    image_url: imageUrl,
    output_format: "png",
    sync_mode: true,
    num_images: 1
  };

  console.log("[FAL.AI] Enviando para URL:", API_URL);
  console.log("[FAL.AI] Payload final:", JSON.stringify(payload, null, 2));

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Key ${FAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json();

  if (!response.ok) {
    console.error("====================== FAL.AI API ERROR RESPONSE ======================");
    console.error(json);
    console.error("=====================================================================");
    throw new Error(`Fal.ai retornou um status não-OK: ${response.status}.`);
  }
  
  console.log("[FAL.AI] Resposta recebida:", json);

  const outputUrl = json?.images?.[0]?.url;
  if (!outputUrl) throw new Error("Fal.ai não retornou uma URL válida de imagem.");

  return await fetchImageAsBytes(outputUrl);
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    console.log("--- [INÍCIO] Processamento de Imagem v.LINKED-IMAGES ---");
    // Recebemos o uploaded_image_id
    const { image_path, processing_type, project_id, uploaded_image_id } = await req.json();

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

    // Agora buscamos também o prompt de bebidas
    const { data: settings } = await supabaseAdmin
      .from("platform_settings")
      .select("falai_prompt_food, falai_prompt_products, falai_prompt_bebidas")
      .eq("id", 1)
      .single();
    if (!settings) throw new Error("Configurações da plataforma não encontradas.");
    
    // Mapa de prompts, incluindo bebidas com fallback para produtos
    const promptMap: Record<string, string | null | undefined> = {
      alimentos: settings.falai_prompt_food,
      produtos: settings.falai_prompt_products,
      bebidas: settings.falai_prompt_bebidas || settings.falai_prompt_products
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
    
    await supabaseAdmin.rpc("decrement_user_credits", { user_id: user.id, credit_amount: 1 });
    
    // Salvamos o uploaded_image_id no novo registro
    await supabaseAdmin.from("processed_images").insert({
      user_id: user.id,
      uploaded_image_id: uploaded_image_id || null,
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

