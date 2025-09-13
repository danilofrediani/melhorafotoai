// supabase/functions/create-checkout-session/index.ts
// v.1.1 - ROBUST: Adicionada verificação de cabeçalho de autenticação.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.24.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Lembre-se de restringir ao seu domínio em produção
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Inicializa o cliente do Stripe uma vez.
const stripeClient = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: '2023-10-16', // Trava a versão da API para evitar breaking changes
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Validar e autenticar o usuário
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Cabeçalho de autorização ausente.');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      throw new Error('Usuário não autenticado.');
    }

    // 2. Obter o ID do pacote do corpo da requisição
    const { package_id } = await req.json();
    if (!package_id) {
      throw new Error('O ID do pacote é obrigatório.');
    }

    // 3. Buscar os detalhes do pacote no banco de dados
    const { data: packageData, error: packageError } = await supabaseAdmin
      .from('packages')
      .select('stripe_price_id, type')
      .eq('id', package_id)
      .single();

    if (packageError || !packageData?.stripe_price_id) {
      console.error('Erro ao buscar pacote ou pacote sem ID de preço do Stripe:', packageError);
      throw new Error('Pacote não encontrado ou não configurado para venda.');
    }

    // 4. Criar a sessão de checkout do Stripe
    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: packageData.stripe_price_id,
        quantity: 1,
      }],
      mode: packageData.type === 'avulso' ? 'payment' : 'subscription',
      success_url: `${Deno.env.get('SITE_URL')}/dashboard?payment=success`,
      cancel_url: `${Deno.env.get('SITE_URL')}/pricing?payment=cancelled`,
      customer_email: user.email,
      metadata: { // Essencial para o webhook saber quem pagou e o que comprou
        user_id: user.id,
        package_id: package_id,
      }
    });

    if (!session.url) {
        throw new Error("Não foi possível criar a sessão de checkout do Stripe.");
    }

    // 5. Retornar a URL de checkout para o front-end
    return new Response(JSON.stringify({ checkout_url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Erro na função create-checkout-session:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
