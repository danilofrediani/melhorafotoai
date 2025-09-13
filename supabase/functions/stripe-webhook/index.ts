// supabase/functions/stripe-webhook/index.ts
// v.2.0 - ADAPTED & PRODUCTION-READY: Valida a assinatura, processa pagamentos e adiciona créditos.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.24.0?target=deno'

// NOTA: Usando versões mais recentes das libs para consistência com as outras functions.

const stripeClient = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
  httpClient: Stripe.createFetchHttpClient(),
  apiVersion: '2023-10-16',
})

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature')
  const body = await req.text()

  let receivedEvent: Stripe.Event
  try {
    // 1. VERIFICAÇÃO DE SEGURANÇA (Estrutura mantida do seu código)
    // Garante que a requisição veio REALMENTE do Stripe.
    receivedEvent = await stripeClient.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET')! // Usaremos este nome para o secret.
    )
  } catch (err) {
    console.error('Webhook signature verification failed.', err.message)
    return new Response(err.message, { status: 400 })
  }

  console.log(`Stripe event received: ${receivedEvent.type}`)

  // 2. PROCESSAMENTO DO EVENTO (Foco em 'checkout.session.completed')
  if (receivedEvent.type === 'checkout.session.completed') {
    const session = receivedEvent.data.object as Stripe.Checkout.Session

    // 3. EXTRAÇÃO DOS METADADOS
    const { user_id, package_id } = session.metadata!

    if (!user_id || !package_id) {
      console.error('Metadata (user_id, package_id) ausente no evento do Stripe.', session)
      return new Response('Metadata (user_id, package_id) ausente.', { status: 400 })
    }

    try {
      // 4. BUSCAR A QUANTIDADE DE IMAGENS NO PACOTE
      const { data: packageData, error: packageError } = await supabaseAdmin
        .from('packages')
        .select('images')
        .eq('id', package_id)
        .single()

      if (packageError || !packageData) {
        throw new Error(`Pacote com ID ${package_id} não encontrado.`)
      }

      const imagesToAdd = packageData.images

      // 5. ADICIONAR CRÉDITOS AO USUÁRIO (A LÓGICA CENTRAL)
      // Usaremos uma função RPC para garantir que a atualização é segura.
      const { error: rpcError } = await supabaseAdmin.rpc('add_user_credits', {
        user_id_param: user_id,
        credit_amount: imagesToAdd,
      })

      if (rpcError) {
        throw new Error(`Erro ao adicionar créditos para o usuário ${user_id}: ${rpcError.message}`)
      }
      
      // 6. REGISTRAR A TRANSAÇÃO NA NOSSA TABELA `transactions`
      await supabaseAdmin.from('transactions').insert({
        user_id: user_id,
        package_id: package_id,
        amount: (session.amount_total || 0) / 100, // Stripe envia em centavos
        currency: session.currency?.toUpperCase() || 'BRL',
        status: 'completed',
        stripe_session_id: session.id,
      })
      
      console.log(`Sucesso: ${imagesToAdd} créditos adicionados ao usuário ${user_id}.`)

    } catch (error) {
      console.error('Erro ao processar o webhook:', error.message)
      return new Response(`Webhook Error: ${error.message}`, { status: 500 })
    }
  }

  // 7. SUCESSO
  // Retorna uma resposta 200 para o Stripe saber que recebemos o evento.
  return new Response(JSON.stringify({ received: true }), { status: 200 })
})
