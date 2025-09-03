// supabase/functions/process-image/index.ts
// NOVA ARQUITETURA - Backend como Orquestrador, retorna 3 URLs

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { v4 as uuidv4 } from "https://esm.sh/uuid@8.3.2";
// jimp foi removido daqui

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

const FAL_FLUX_ENDPOINT = "https://fal.run/fal-ai/flux-pro/kontext/max";
const FAL_REMBG_ENDPOINT = "https://fal.run/fal-ai/rembg";

async function fetchJsonSafe(res: Response) {
  const bodyText = await res.text();
  try { return JSON.parse(bodyText); }
  catch (_e) { return { error: "A resposta não era um JSON válido", body: bodyText }; }
}

async function callFalAI(payload: any): Promise<any> {
  console.log("[FAL.AI] Payload enviado:", payload);
  const response = await fetch(FAL_FLUX_ENDPOINT, {
    method: "POST",
    headers: { "Authorization": `Key ${FAL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const responseJson = await fetchJsonSafe(response);

  if (!response.ok || responseJson.error) {
    console.error(`[FAL.AI][ERRO] Status: ${response.status}`, responseJson);
    const errorMessage = responseJson.error ? `${responseJson.error}: ${responseJson.body}` : JSON.stringify(responseJson);
    throw new Error(`Fal.ai retornou um erro: ${errorMessage}`);
  }
  return responseJson;
}

async function removeBackground(imageUrl: string): Promise<string> {
  console.log("[REMBG] Removendo fundo da imagem...");
  const response = await fetch(FAL_REMBG_ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': `Key ${FAL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl })
  });

  const responseJson = await fetchJsonSafe(response);
  if (!response.ok || responseJson.error) {
    console.error(`[REMBG][ERRO] Falha ao remover fundo:`, responseJson);
    throw new Error('A IA de recorte (rembg) falhou.');
  }

  const foregroundUrl = responseJson?.images?.[0]?.url;
  if (!foregroundUrl) {
    console.error("[REMBG][ERRO] Resposta da IA de recorte não continha a URL.", responseJson);
    throw new Error("A IA de recorte não retornou uma imagem válida.");
  }
  
  console.log("[REMBG] Fundo removido com sucesso.");
  return foregroundUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    console.log("--- [INÍCIO] Processamento de Imagem - Nova Arquitetura ---");
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

    const { data: settingsFromDB } = await supabaseAdmin.from("platform_settings").select(`*`).eq("id", 1).single();
    if (!settingsFromDB) throw new Error("Configurações da plataforma não encontradas no DB.");

    const categoryMap: Record<string, string> = {
      alimentos: "prompt_modifier_food",
      veiculos: "prompt_modifier_vehicles",
      imoveis: "prompt_modifier_real_estate",
      produtos: "prompt_modifier_products",
    };
    const promptColumn = categoryMap[processing_type];
    if (!promptColumn) throw new Error(`Categoria de processamento desconhecida: '${processing_type}'`);
    
    const finalPrompt = settingsFromDB[promptColumn];
    if (!finalPrompt) throw new Error(`Prompt para a categoria '${processing_type}' não encontrado.`);

    console.log("[PASSO 1] A aplicar melhoria fotográfica na imagem completa...");
    const enhancementPayload = {
      prompt: finalPrompt,
      image_url: inputImageUrl,
      image_prompt_strength: Number(settingsFromDB[`fal_strength_${processing_type}`]),
      guidance_scale: Number(settingsFromDB[`fal_guidance_scale_${processing_type}`]),
      negative_prompt: settingsFromDB[`fal_negative_prompt_${processing_type}`]),
      num_inference_steps: Number(settingsFromDB[`fal_steps_${processing_type}`]),
    };
    const enhancedImageResponse = await callFalAI(enhancementPayload);
    const enhancedImageUrl = enhancedImageResponse?.images?.[0]?.url;
    if (!enhancedImageUrl) throw new Error("Falha ao obter a imagem melhorada inicial.");
    console.log("[PASSO 1] Melhoria fotográfica concluída.");

    let responsePayload: any = {
      processed_url: enhancedImageUrl, // URL da imagem final (com ou sem fundo novo)
      // Para o slider, vamos devolver as 3 partes quando o fundo é trocado
      enhanced_url: enhancedImageUrl,
      foreground_url: null,
      background_url: null,
    };

    if (background_option && background_option !== 'manter') {
      console.log("[INFO] Modo de mudança de fundo ativado...");
      
      const [foregroundUrl, backgroundResponse] = await Promise.all([
        // PASSO 2: Isolar o carro JÁ MELHORADO
        removeBackground(enhancedImageUrl),
        // PASSO 3: Gerar o novo fundo
        (() => {
          let backgroundPrompt = "";
          if (background_option === 'neutro') {
            backgroundPrompt = settingsFromDB.fal_prompt_bkg_neutral;
          } else if (background_option === 'parque') {
            backgroundPrompt = settingsFromDB.fal_prompt_bkg_park;
          }
          return callFalAI({ prompt: backgroundPrompt });
        })()
      ]);
      
      const backgroundUrl = backgroundResponse?.images?.[0]?.url;
      if (!backgroundUrl) throw new Error("Falha ao gerar a imagem de fundo.");

      responsePayload.foreground_url = foregroundUrl;
      responsePayload.background_url = backgroundUrl;
    }

    // O backend agora NÃO salva a imagem composta, apenas retorna os links.
    // Opcional: Ainda podemos salvar a imagem melhorada (antes da composição) se quisermos.
    // E decrementar os créditos.
    
    await supabaseAdmin.rpc("decrement_user_credits", { user_id: user.id, credit_amount: 1 });
    // A inserção no DB precisaria ser repensada, ou feita pelo frontend após a composição.
    // Por agora, vamos focar em retornar os dados para o frontend montar a imagem.

    console.log("--- [FIM] Orquestração concluída com sucesso! ---");
    return new Response(JSON.stringify(responsePayload), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });

  } catch (err) {
    console.error("[ERRO GERAL] Um erro ocorreu durante o processamento:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
