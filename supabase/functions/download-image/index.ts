// download-image/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';
import { serve } from 'https://deno.land/std@0.223.0/http/server.ts';

serve(async (req) => {
  // ---- CORS ----
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
  };
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: corsHeaders,
      });
    }

    // ---- Supabase client (service role para Storage/Tables) ----
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    // ---- Autenticação via Bearer token ----
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    const token = authHeader.replace('Bearer ', '').trim();
    const { data: userRes, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userRes?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    const user = userRes.user;

    // ---- Parâmetros: bucket + path ----
    const url = new URL(req.url);
    const bucket = url.searchParams.get('bucket') || 'processed-images'; // padrão correto p/ downloads finais
    const filePath = url.searchParams.get('path');
    if (!filePath) {
      return new Response(JSON.stringify({ error: 'File path is required' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // (higiene simples) evita path traversal
    if (filePath.includes('..')) {
      return new Response(JSON.stringify({ error: 'Invalid path' }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // ---- Incrementa contador no backend (users.download_count) ----
    // leitura atual
    const { data: udata, error: uerr } = await supabase
      .from('users')
      .select('download_count')
      .eq('id', user.id)
      .single();

    if (uerr || !udata) {
      console.error('[download-image] fetch user error:', uerr);
      return new Response(JSON.stringify({ error: 'Failed to fetch user data for download' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const newCount = (udata.download_count ?? 0) + 1;

    const { error: upErr } = await supabase
      .from('users')
      .update({ download_count: newCount })
      .eq('id', user.id);

    if (upErr) {
      console.error('[download-image] update user error:', upErr);
      return new Response(JSON.stringify({ error: 'Failed to update download count' }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // ---- Baixa o arquivo do bucket informado ----
    // IMPORTANTE: não passar { token } aqui. Com service role já temos permissão.
    const { data: fileData, error: storageError } = await supabase
      .storage
      .from(bucket)
      .download(filePath);

    if (storageError || !fileData) {
      console.error('[download-image] storage error:', storageError);
      return new Response(JSON.stringify({ error: 'File not found or access denied' }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // ---- Retorna o binário para o navegador iniciar o download ----
    const filename = filePath.split('/').pop() || 'file.bin';

    // Content-Type genérico (pode-se melhorar por extensão, mas não é necessário)
    return new Response(fileData, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (err: any) {
    console.error('[download-image] fatal error:', err);
    return new Response(JSON.stringify({ error: err?.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

