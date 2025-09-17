import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function ExclusaoDeConta() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-gray-800">
            Gerenciamento de Dados e Conta
          </h1>
          <div className="space-y-6 text-gray-700 leading-relaxed">
            <p>
              No MelhoraFotoAI, respeitamos sua privacidade e seu controle sobre seus dados. Em conformidade com a Lei Geral de Proteção de Dados (LGPD), oferecemos as seguintes opções para você gerenciar suas informações.
            </p>
            
            <div className="border-t pt-6">
              <h2 className="text-xl font-semibold mb-3">
                1. Exclusão de Dados Específicos
              </h2>
              <p>
                Você pode solicitar a exclusão de dados específicos, como imagens individuais do seu histórico de processamento, sem precisar apagar sua conta inteira.
              </p>
              <p className="mt-2">
                <strong>Como solicitar:</strong> Envie um e-mail para{' '}
                <a href="mailto:suporte@melhorafotoai.com" className="text-primary font-medium hover:underline">
                  suporte@melhorafotoai.com
                </a>{' '}
                com o assunto <strong className="font-semibold">"Solicitação de Exclusão de Dados"</strong>. No corpo do e-mail, por favor, seja o mais específico possível sobre os dados que deseja excluir (ex: "excluir a imagem 'nome_do_arquivo.jpg' processada em 16/09/2025").
              </p>
            </div>

            <div className="border-t pt-6">
              <h2 className="text-xl font-semibold mb-3">
                2. Exclusão Completa da Conta
              </h2>
              <p>
                Você pode solicitar a exclusão permanente da sua conta e de todos os dados associados a ela. Esta é uma ação irreversível.
              </p>
              <p className="mt-2">
                <strong>O que será excluído:</strong> Seu perfil de usuário (nome, e-mail), seu saldo de créditos, seu histórico de compras e todas as imagens que você enviou e que foram processadas pela nossa plataforma.
              </p>
              <p className="mt-2">
                <strong>Como solicitar:</strong> Envie um e-mail para{' '}
                <a href="mailto:suporte@melhorafotoai.com" className="text-primary font-medium hover:underline">
                  suporte@melhorafotoai.com
                </a>{' '}
                a partir do endereço de e-mail associado à sua conta, com o assunto <strong className="font-semibold">"Solicitação de Exclusão de Conta Completa"</strong>.
              </p>
            </div>

            <div className="border-t pt-6">
               <h2 className="text-xl font-semibold mb-3">
                Processamento da Solicitação
              </h2>
              <p>
                Para sua segurança, nossa equipe poderá entrar em contato para confirmar sua identidade antes de processar qualquer solicitação de exclusão. Todas as solicitações serão atendidas em um prazo máximo de 7 dias úteis.
              </p>
            </div>

          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
