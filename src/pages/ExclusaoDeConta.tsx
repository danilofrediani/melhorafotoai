import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function ExclusaoDeConta() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-gray-800">
            Solicitação de Exclusão de Conta e Dados
          </h1>
          <div className="space-y-4 text-gray-700 leading-relaxed">
            <p>
              Você tem o direito de solicitar a exclusão da sua conta do MelhoraFotoAI e de todos os seus dados associados a ela a qualquer momento, em conformidade com a Lei Geral de Proteção de Dados (LGPD).
            </p>
            <h2 className="text-xl font-semibold pt-4">
              Como solicitar
            </h2>
            <p>
              Para iniciar o processo de exclusão, por favor, envie um e-mail para{' '}
              <a href="mailto:suporte@melhorafotoai.com" className="text-primary font-medium hover:underline">
                suporte@melhorafotoai.com
              </a>{' '}
              a partir do endereço de e-mail que você usou para se cadastrar no MelhoraFotoAI.
            </p>
            <p>
              No assunto do e-mail, por favor, coloque: <strong className="font-semibold">"Solicitação de Exclusão de Conta"</strong>.
            </p>
            <p>
              Nossa equipe irá confirmar o recebimento e processar sua solicitação em até 7 dias úteis. Após a conclusão, todos os seus dados pessoais, imagens enviadas e imagens processadas serão permanentemente removidos de nossos sistemas.
            </p>
            <p>
              Se tiver qualquer dúvida, entre em contato pelo mesmo e-mail.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
