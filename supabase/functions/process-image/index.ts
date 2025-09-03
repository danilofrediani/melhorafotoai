// supabase/functions/process-image/index.ts
// vFINAL-CATEGORIAS-FUNDOS — Adicionada lógica para alteração de fundo

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { v4 as uuidv4 } from "https://esm.sh/uuid@8.3.2";

// ... (seus corsHeaders e config do Supabase e Fal.ai permanecem iguais)
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://melhorafotoai-mvp.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
const FAL_API_KEY = Deno.env.get("FAL_API_KEY");
if (!FAL_API_KEY) throw new Error("FAL_API_KEY não configurada");
const FAL_MODEL_ENDPOINT = "https://fal.run/fal-ai/flux-pro/kontext/max";

async function fetchJsonSafe(res: Response) { /* ... (função igual) ... */ }

async function callFalAI(imageUrl: string, prompt: string, settings: any, category: string): Promise<Uint8Array> {
  console.log(`[FAL.AI] A usar controlos para a categoria: ${category}`);

  const payload = {
    prompt: prompt,
    image_url: imageUrl,
    image_prompt_strength: Number(settings[`fal_strength_${category}`]) || 0.5,
    guidance_scale: Number(settings[`fal_guidance_scale_${category}`]) || 7.5,
    negative_prompt: settings[`fal_negative_prompt_${category}`] || "blurry, noisy, ugly, deformed",
    num_inference_steps: Number(settings[`fal_steps_${category}`]) || 40,
    seed: Math.floor(Math.random() * 100000),
  };

  console.log("[FAL.AI] Payload enviado:", payload);

  const response = await fetch(FAL_MODEL_ENDPOINT, { /* ... (chamada fetch igual) ... */ });
  // ... (resto da função callFalAI permanece igual)
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    console.log("--- [INÍCIO] Processamento de Imagem vFINAL-CATEGORIAS-FUNDOS ---");
    const { image_path, processing_type, project_id, background_option } = await req.json(); // <-- RECEBE A NOVA OPÇÃO

    if (!image_path || !processing_type) throw new Error("Parâmetros 'image_path' ou 'processing_type' ausentes.");

    // ... (autenticação de usuário e verificação de créditos permanecem iguais)

    const { data: signedUrlData, error: urlErr } = await supabaseAdmin.storage.from("uploaded-images").createSignedUrl(image_path, 300);
    if (urlErr || !signedUrlData?.signedUrl) throw new Error("Erro ao gerar URL assinada para a imagem.");
    const inputImageUrl = signedUrlData.signedUrl;

    const categoryMap: Record<string, string> = { /* ... (mapa de categorias igual) ... */ };
    const promptColumn = categoryMap[processing_type];
    if (!promptColumn) throw new Error(`Categoria de processamento desconhecida: '${processing_type}'`);
    
    const { data: settings } = await supabaseAdmin.from("platform_settings").select(`*`).eq("id", 1).single();

    let finalPrompt = settings?.[promptColumn];
    if (!finalPrompt) throw new Error(`Prompt para a categoria '${processing_type}' não encontrado no banco de dados.`);
    
    // --- NOVIDADE: LÓGICA PARA ALTERAR O FUNDO ---
    console.log(`[INFO] Opção de fundo selecionada: ${background_option}`);
    
    // Criamos uma cópia dos settings para poder alterá-los sem afetar a fonte original
    let finalSettings = { ...settings }; 

    if (background_option === 'neutro') {
      finalPrompt += ", on a neutral studio background, clean backdrop, minimalist";
      // Para mudar o fundo, a IA precisa de mais liberdade. Reduzimos a fidelidade à imagem original.
      finalSettings[`fal_strength_${processing_type}`] = 0.4; 
    } else if (background_option === 'parque') {
      finalPrompt += ", parked in a beautiful green park with trees, sunny day, natural lighting";
      finalSettings[`fal_strength_${processing_type}`] = 0.4;
    }
    // Se for 'manter', não fazemos nada.

    // ---------------------------------------------

    const processedImageBytes = await callFalAI(inputImageUrl, finalPrompt, finalSettings, processing_type);

    // ... (resto do código para salvar a imagem, decrementar créditos, etc., permanece igual)

    const processedFileName = `processed_${uuidv4()}.png`;
    const processedPath = `${user.id}/${processedFileName}`;
    const { error: uploadError } = await supabaseAdmin.storage.from("processed-images").upload(processedPath, processedImageBytes, { contentType: "image/png", upsert: true });
    if (uploadError) throw new Error(`Falha ao salvar a imagem processada no Storage: ${uploadError.message}`);

    await supabaseAdmin.rpc("decrement_user_credits", { user_id: user.id, credit_amount: 1 });
    await supabaseAdmin.from("processed_images").insert({ /* ... (insert igual) ... */ });

    const { data: publicUrlData } = supabaseAdmin.storage.from("processed-images").getPublicUrl(processedPath);
    
    console.log("--- [FIM] Processamento concluído com sucesso! ---");
    return new Response(JSON.stringify({ processed_file_path: processedPath, processed_url: publicUrlData?.publicUrl }), { /* ... (response igual) ... */ });

  } catch (err) {
    console.error("[ERRO GERAL] Um erro ocorreu durante o processamento:", err);
    return new Response(JSON.stringify({ error: err.message }), { /* ... (response de erro igual) ... */ });
  }
});
