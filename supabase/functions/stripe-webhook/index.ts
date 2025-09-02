import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@14.24.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stripeClient = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: '2023-10-16',
});

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { package_id } = await req.json();
    if (!package_id) throw new Error('O ID do pacote é obrigatório.');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user } } = await supabaseAdmin.auth.getUser(req.headers.get('Authorization').replace('Bearer ', ''));
    if (!user) throw new Error('Usuário não autenticado.');

    // --- LÓGICA ATUALIZADA AQUI ---
    // Agora também buscamos o 'type' do pacote
    const { data: packageData, error: packageError } = await supabaseAdmin
      .from('packages')
      .select('stripe_price_id, type') // Adicionamos o 'type'
      .eq('id', package_id)
      .single();

    if (packageError || !packageData?.stripe_price_id) {
      console.error('Erro ao buscar pacote ou pacote sem ID de preço do Stripe:', packageError);
      throw new Error('Pacote não encontrado ou não configurado para venda.');
    }

    const priceId = packageData.stripe_price_id;
    const customerEmail = user.email;

    // --- LÓGICA ATUALIZADA AQUI ---
    // Definimos o modo de pagamento com base no tipo do pacote
    const mode = packageData.type === 'avulso' ? 'payment' : 'subscription';

    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      mode: mode, // Usamos a variável 'mode' que acabamos de criar
      success_url: `${Deno.env.get('SITE_URL')}/dashboard?payment=success`,
      cancel_url: `${Deno.env.get('SITE_URL')}/pricing?payment=cancelled`,
      customer_email: customerEmail,
      metadata: {
        user_id: user.id,
        package_id: package_id,
      }
    });

    if (!session.url) {
        throw new Error("Não foi possível criar a sessão de checkout do Stripe.");
    }

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
