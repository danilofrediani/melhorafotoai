// supabase/functions/process-image/index.ts
// v.CLAID-ADAPTADO — Integração com Claid.ai Image Editing API

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

const CLAID_API_KEY = Deno.env.get("CLAID_API_KEY");
if (!CLAID_API_KEY) throw new Error("CLAID_API_KEY não configurada");

async function callClaid(imageUrl: string, prompt: string, adjustments: any): Promise<Uint8Array> {
  const payload = {
    input: imageUrl,
    operations: {
      restorations: { upscale: "smart_enhance" },
      adjustments
    },
    output: { format: { type: "jpeg", quality: 95 } }
  };

  console.log("[CLAID] Payload:", payload);

  const response = await fetch("https://api.claid.ai/v1-beta1/image/edit", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CLAID_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claid.ai erro: ${errorText}`);
  }

  const json = await response.json();
  const outputUrl = json?.output?.url;
  if (!outputUrl) throw new Error("Claid.ai não retornou URL da imagem.");

  const imgResp = await fetch(outputUrl);
  if (!imgResp.ok) throw new Error("Falha ao baixar imagem final da Claid.");

  return new Uint8Array(await imgResp.arrayBuffer());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { image_path, processing_type, project_id } = await req.json();
    if (!image_path || !processing_type) throw new Error("Parâmetros faltando.");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Cabeçalho de autorização ausente.");
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("Usuário não autenticado.");

    const { data: profile } = await supabaseAdmin.from("users").select("remaining_images").eq("id", user.id).single();
    if (!profile || profile.remaining_images <= 0) throw new Error("Créditos insuficientes.");

    const { data: signedUrlData } = await supabaseAdmin.storage.from("uploaded-images").createSignedUrl(image_path, 300);
    if (!signedUrlData?.signedUrl) throw new Error("Erro ao gerar URL assinada.");
    const inputImageUrl = signedUrlData.signedUrl;

    const { data: settings } = await supabaseAdmin.from("platform_settings").select("*").eq("id", 1).single();
    if (!settings) throw new Error("Configurações da plataforma não encontradas.");

    const categoryMap: Record<string, { prompt: string, adjustments: any }> = {
      alimentos: { prompt: settings.prompt_modifier_food, adjustments: settings.claid_adjustments_food },
      veiculos: { prompt: settings.prompt_modifier_vehicles, adjustments: settings.claid_adjustments_vehicles },
      imoveis: { prompt: settings.prompt_modifier_real_estate, adjustments: settings.claid_adjustments_real_estate },
      produtos: { prompt: settings.prompt_modifier_products, adjustments: settings.claid_adjustments_products },
    };

    const config = categoryMap[processing_type];
    if (!config) throw new Error(`Categoria inválida: ${processing_type}`);

    const processedBytes = await callClaid(inputImageUrl, config.prompt, config.adjustments);

    const processedFileName = `processed_${uuidv4()}.jpg`;
    const processedPath = `${user.id}/${processedFileName}`;
    const { error: uploadError } = await supabaseAdmin.storage.from("processed-images").upload(processedPath, processedBytes, { contentType: "image/jpeg", upsert: true });
    if (uploadError) throw new Error(`Erro ao salvar imagem: ${uploadError.message}`);

    await supabaseAdmin.rpc("decrement_user_credits", { user_id: user.id, credit_amount: 1 });
    await supabaseAdmin.from("processed_images").insert({
      user_id: user.id,
      processed_file_path: processedPath,
      processing_type,
      project_id: project_id || null,
      ai_model_used: "claid.ai/image/edit",
      source_image_path: image_path,
      prompt_usado: config.prompt
    });

    const { data: publicUrlData } = supabaseAdmin.storage.from("processed-images").getPublicUrl(processedPath);

    return new Response(JSON.stringify({ processed_file_path: processedPath, processed_url: publicUrlData?.publicUrl }), { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });

  } catch (err) {
    console.error("[ERRO]", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});

