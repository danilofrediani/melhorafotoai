// supabase/functions/process-image/index.ts
// v.CLAID-FINAL — validação separada + tmp_url + sem resizing (preview alinha no front)

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

async function callClaid(imageUrl: string, adjustments: any): Promise<Uint8Array> {
  const payload = {
    input: imageUrl,
    operations: {
      restorations: {
        upscale: "smart_enhance",
        polish: true,
        decompress: "auto",
      },
      // sem resizing -> saída pode vir maior; preview alinha via CSS
      adjustments,
    },
    output: { format: { type: "jpeg", quality: 95 } },
  };

  console.log("[CLAID] Payload enviado:", payload);

  const response = await fetch("https://api.claid.ai/v1-beta1/image/edit", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${CLAID_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json();
  console.log("[CLAID] Resposta recebida:", json);

  if (!response.ok) {
    throw new Error(`Claid.ai retornou um erro: ${JSON.stringify(json)}`);
  }

  const outputUrl =
    json?.result?.images?.[0]?.url ||
    json?.data?.output?.tmp_url;

  if (!outputUrl) {
    throw new Error("Claid.ai não retornou uma URL válida de imagem.");
  }

  const imgResp = await fetch(outputUrl);
  if (!imgResp.ok) throw new Error("Falha ao baixar imagem final da Claid.");

  return new Uint8Array(await imgResp.arrayBuffer());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    console.log("--- [INÍCIO] Processamento de Imagem v.CLAID-FINAL ---");
    const { image_path, processing_type, project_id } = await req.json();

    if (!image_path) throw new Error("Parâmetro 'image_path' ausente.");
    if (!processing_type) throw new Error("Parâmetro 'processing_type' ausente.");

    // Autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Cabeçalho de autorização ausente.");
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("Usuário não autenticado.");

    // Checagem de créditos
    const { data: profile } = await supabaseAdmin
      .from("users")
      .select("remaining_images")
      .eq("id", user.id)
      .single();
    if (!profile || profile.remaining_images <= 0) throw new Error("Créditos insuficientes.");

    // URL assinada da imagem de entrada
    const { data: signedUrlData, error: urlErr } = await supabaseAdmin.storage
      .from("uploaded-images")
      .createSignedUrl(image_path, 300);
    if (urlErr || !signedUrlData?.signedUrl) throw new Error("Erro ao gerar URL assinada para a imagem.");
    const inputImageUrl = signedUrlData.signedUrl;

    // Configurações (ajustes por categoria)
    const { data: settings } = await supabaseAdmin
      .from("platform_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (!settings) throw new Error("Configurações da plataforma não encontradas.");

    const categoryMap: Record<string, any> = {
      alimentos: settings.claid_adjustments_food,
      veiculos: settings.claid_adjustments_vehicles,
      imoveis: settings.claid_adjustments_real_estate,
      produtos: settings.claid_adjustments_products,
    };

    const adjustments = categoryMap[processing_type];
    if (!adjustments) throw new Error(`Categoria inválida ou ajustes não configurados: ${processing_type}`);

    // Chamada à Claid
    const processedBytes = await callClaid(inputImageUrl, adjustments);

    // Salvar no Storage
    const processedFileName = `processed_${uuidv4()}.jpg`;
    const processedPath = `${user.id}/${processedFileName}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("processed-images")
      .upload(processedPath, processedBytes, { contentType: "image/jpeg", upsert: true });
    if (uploadError) throw new Error(`Falha ao salvar a imagem processada: ${uploadError.message}`);

    // Decrementar créditos + log
    await supabaseAdmin.rpc("decrement_user_credits", { user_id: user.id, credit_amount: 1 });
    await supabaseAdmin.from("processed_images").insert({
      user_id: user.id,
      processed_file_path: processedPath,
      processing_type,
      project_id: project_id || null,
      ai_model_used: "claid.ai/image/edit",
      source_image_path: image_path
    });

    const { data: publicUrlData } = supabaseAdmin.storage.from("processed-images").getPublicUrl(processedPath);

    console.log("--- [FIM] Processamento concluído com sucesso ---");
    return new Response(JSON.stringify({ processed_file_path: processedPath, processed_url: publicUrlData?.publicUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (err) {
    console.error("[ERRO GERAL]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});

