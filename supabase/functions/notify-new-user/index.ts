// supabase/functions/notify-new-user/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')
const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID')

serve(async (req) => {
  try {
    const { record: user } = await req.json()

    if (!user) {
      throw new Error("Dados do usuário não recebidos.");
    }

    // Formata a mensagem que será enviada
    const message = `
🚀 **Novo Cadastro no MelhoraFotoAI!** 🚀

Um novo usuário acaba de se registrar na plataforma.

👤 **Nome:** ${user.name || 'Não informado'}
📧 **Email:** ${user.email}

Continue assim! 🎉
    `
    // URL da API do Telegram para enviar mensagens
    const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`

    // Envia a mensagem formatada para o seu chat
    await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown', // Permite usar negrito, etc.
      }),
    })

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('Erro na função de notificação:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
