// supabase/functions/process-image/index.ts
// vFINAL-PRO — Lê prompts e força de mudança de fundo do banco de dados

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { v4 as uuidv4 } from "https://esm.sh/uuid@8.3.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://melhorafotoai-mvp.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
if (!FAL_API_KEY) throw new Error("FAL_API_KEY não configurada");

const FAL_MODEL_ENDPOINT = "https://fal.run/fal-ai/flux-pro/kontext/max";

async function fetchJsonSafe(res: Response) {
  try { return await res.json(); }
  catch { return { text: await res.text() }; }
}

async function callFalAI(imageUrl: string, prompt: string, settings: any): Promise<Uint8Array> {
  // A função agora recebe os settings completos e os usa diretamente.
  const payload = {
    prompt: prompt,
    image_url: imageUrl,
    image_prompt_strength: Number(settings.strength) || 0.5,
    guidance_scale: Number(settings.guidance) || 7.5,
    negative_prompt: settings.negative_prompt || "blurry, noisy, ugly, deformed",
    num_inference_steps: Number(settings.steps) || 40,
    seed: Math.floor(Math.random() * 100000),
  };

  console.log("[FAL.AI] Payload enviado:", payload);

  const response = await fetch(FAL_MODEL_ENDPOINT, {
    method: "POST",
    headers: { "Authorization": `Key ${FAL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const responseJson = await fetchJsonSafe(response);

  if (!response.ok) {
    console.error(`[FAL.AI][ERRO] Status: ${response.status}`, responseJson);
    throw new Error(`Fal.ai retornou um erro: ${JSON.stringify(responseJson)}`);
  }

  const outputUrl = (responseJson as any)?.images?.[0]?.url;
  if (!outputUrl) {
    console.error("[FAL.AI][ERRO] Resposta da API não contém a URL da imagem.", responseJson);
    throw new Error("A resposta da Fal.ai não continha a imagem processada.");
  }

  const imageResponse = await fetch(outputUrl);
  if (!imageResponse.ok) {
    throw new Error("Não foi possível baixar a imagem final da Fal.ai.");
  }

  return new Uint8Array(await imageResponse.arrayBuffer());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    console.log("--- [INÍCIO] Processamento de Imagem vFINAL-PRO ---");
    const { image_path, processing_type, project_id, background_option } = await req.json();

    if (!image_path || !processing_type) throw new Error("Parâmetros 'image_path' ou 'processing_type' ausentes.");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Cabeçalho de autorização ausente.");
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("Usuário não autenticado.");

    const { data: userProfile } = await supabaseAdmin.from("users").select("remaining_images").eq("id", user.id).single();
    if (!userProfile || userProfile.remaining_images <= 0) throw new Error("Créditos insuficientes.");

    const { data: signedUrlData, error: urlErr } = await supabaseAdmin.storage.from("uploaded-images").createSignedUrl(image_path, 300);
    if (urlErr || !signedUrlData?.signedUrl) throw new Error("Erro ao gerar URL assinada para a imagem.");
    const inputImageUrl = signedUrlData.signedUrl;

    const categoryMap: Record<string, string> = {
      alimentos: "prompt_modifier_food",
      veiculos: "prompt_modifier_vehicles",
      imoveis: "prompt_modifier_real_estate",
      produtos: "prompt_modifier_products",
    };
    const promptColumn = categoryMap[processing_type];
    if (!promptColumn) throw new Error(`Categoria de processamento desconhecida: '${processing_type}'`);
    
    const { data: settingsFromDB } = await supabaseAdmin.from("platform_settings").select(`*`).eq("id", 1).single();
    if (!settingsFromDB) throw new Error("Configurações da plataforma não encontradas no DB.");

    let finalPrompt = settingsFromDB[promptColumn];
    if (!finalPrompt) throw new Error(`Prompt para a categoria '${processing_type}' não encontrado no banco de dados.`);
    
    // Prepara os parâmetros finais para a IA
    const finalSettings = {
      strength: settingsFromDB[`fal_strength_${processing_type}`],
      guidance: settingsFromDB[`fal_guidance_scale_${processing_type}`],
      steps: settingsFromDB[`fal_steps_${processing_type}`],
      negative_prompt: settingsFromDB[`fal_negative_prompt_${processing_type}`]
    };

    // Lógica Inteligente para Fundo: Sobrescreve os parâmetros se necessário
    if (background_option === 'neutro') {
      finalPrompt += settingsFromDB.fal_prompt_bkg_neutral || ", on a neutral studio background";
      finalSettings.strength = settingsFromDB.fal_strength_bkg_change || 0.4; // Usa a força específica para mudança de fundo
    } else if (background_option === 'parque') {
      finalPrompt += settingsFromDB.fal_prompt_bkg_park || ", in a park with trees";
      finalSettings.strength = settingsFromDB.fal_strength_bkg_change || 0.4; // Usa a força específica para mudança de fundo
    }

    const processedImageBytes = await callFalAI(inputImageUrl, finalPrompt, finalSettings);

    const processedFileName = `processed_${uuidv4()}.png`;
    const processedPath = `${user.id}/${processedFileName}`;
    const { error: uploadError } = await supabaseAdmin.storage.from("processed-images").upload(processedPath, processedImageBytes, { contentType: "image/png", upsert: true });
    if (uploadError) throw new Error(`Falha ao salvar a imagem processada no Storage: ${uploadError.message}`);

    await supabaseAdmin.rpc("decrement_user_credits", { user_id: user.id, credit_amount: 1 });
    await supabaseAdmin.from("processed_images").insert({
        user_id: user.id,
        processed_file_path: processedPath,
        processing_type: processing_type,
        project_id: project_id || null,
        ai_model_used: "fal-ai/flux-pro/kontext/max",
        source_image_path: image_path,
        prompt_usado: finalPrompt,
    });

    const { data: publicUrlData } = supabaseAdmin.storage.from("processed-images").getPublicUrl(processedPath);
    
    console.log("--- [FIM] Processamento concluído com sucesso! ---");
    return new Response(JSON.stringify({ processed_file_path: processedPath, processed_url: publicUrlData?.publicUrl }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });

  } catch (err) {
    console.error("[ERRO GERAL] Um erro ocorreu durante o processamento:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
