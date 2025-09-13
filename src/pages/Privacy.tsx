import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto prose lg:prose-lg">
          <h1>Política de Privacidade – MelhoraFotoAI</h1>
          <p className="lead">
            <strong>Última atualização: 13 de setembro de 2025</strong>
          </p>
          <p>
            A sua privacidade é de extrema importância para o MelhoraFotoAI ("nós", "nosso"). Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e compartilhamos suas informações pessoais e as imagens que você nos fornece ao usar nossa plataforma ("Serviço"). Esta política está em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018) do Brasil.
          </p>

          <h2>1. Informações que Coletamos</h2>
          <p>Coletamos diferentes tipos de informações para fornecer e melhorar nosso Serviço:</p>
          <ul>
            <li>
              <strong>Informações de Cadastro:</strong> Ao criar uma conta, coletamos seu nome e endereço de e-mail.
            </li>
            <li>
              <strong>Conteúdo do Usuário:</strong> Coletamos e armazenamos as imagens que você envia ("upload") para nossa plataforma para processamento.
            </li>
            <li>
              <strong>Informações de Pagamento:</strong> Não coletamos nem armazenamos dados do seu cartão de crédito. Todo o processamento de pagamentos é realizado de forma segura pelo nosso parceiro, Stripe. Apenas armazenamos um registro da transação, como o pacote adquirido, o valor e a data.
            </li>
            <li>
              <strong>Informações de Uso e Técnicas:</strong> Podemos coletar informações sobre como você interage com nosso Serviço, como endereço IP, tipo de navegador, e páginas visitadas, para fins de análise e melhoria da plataforma.
            </li>
          </ul>

          <h2>2. Como Usamos Suas Informações</h2>
          <p>Utilizamos as informações coletadas para as seguintes finalidades:</p>
          <ul>
            <li><strong>Para Fornecer e Manter o Serviço:</strong> Usamos suas informações de conta e imagens para operar a plataforma, processar suas fotos e fornecer os resultados.</li>
            <li><strong>Para Processar Transações:</strong> Usamos seu e-mail e os dados da compra para gerenciar seus pacotes de créditos e histórico de pagamentos via Stripe.</li>
            <li><strong>Para Comunicação:</strong> Podemos usar seu e-mail para enviar notificações importantes sobre sua conta, compras e atualizações do Serviço.</li>
            <li><strong>Para Segurança e Melhoria:</strong> Para monitorar e analisar o uso, proteger a segurança da plataforma e melhorar a experiência do usuário.</li>
          </ul>

          <h2>3. Compartilhamento e Divulgação de Informações</h2>
          <p>Não vendemos suas informações pessoais. Compartilhamos seus dados apenas com provedores de serviço terceirizados estritamente necessários para operar a plataforma:</p>
          <ul>
            <li>
              <strong>Supabase:</strong> Nosso provedor de infraestrutura de back-end, usado para autenticação de usuários, armazenamento de banco de dados e armazenamento seguro de seus arquivos de imagem.
            </li>
            <li>
              <strong>Stripe:</strong> Nosso provedor de pagamentos. Apenas as informações necessárias para processar a transação são compartilhadas diretamente com eles.
            </li>
            <li>
              <strong>Fal.ai:</strong> Nosso provedor de tecnologia de inteligência artificial. A URL segura e temporária da imagem que você envia é compartilhada com a API da Fal.ai para que o processamento possa ser realizado. As imagens não são usadas pela Fal.ai para outros fins que não a execução do nosso pedido.
            </li>
          </ul>
          <p>
            Também podemos divulgar suas informações se formos obrigados por lei ou em resposta a solicitações válidas de autoridades públicas.
          </p>

          <h2>4. Seus Direitos sob a LGPD</h2>
          <p>Como titular dos dados, você tem o direito de:</p>
          <ul>
            <li><strong>Confirmar</strong> a existência de tratamento de seus dados.</li>
            <li><strong>Acessar</strong> seus dados.</li>
            <li><strong>Corrigir</strong> dados incompletos, inexatos ou desatualizados.</li>
            <li><strong>Anonimização, bloqueio ou eliminação</strong> de dados desnecessários ou excessivos.</li>
            <li><strong>Portabilidade</strong> dos seus dados a outro fornecedor de serviço.</li>
            <li><strong>Eliminação</strong> dos dados pessoais tratados com o seu consentimento.</li>
            <li><strong>Obter informação</strong> sobre as entidades com as quais compartilhamos seus dados.</li>
          </ul>
          <p>Para exercer seus direitos, entre em contato conosco através do e-mail listado abaixo.</p>

          <h2>5. Segurança e Retenção de Dados</h2>
          <p>
            Empregamos medidas de segurança padrão do setor, fornecidas por nossa infraestrutura (Supabase), para proteger suas informações. Suas imagens e dados pessoais são mantidos enquanto sua conta estiver ativa. Você pode solicitar a exclusão de sua conta e dados associados a qualquer momento.
          </p>

          <h2>6. Alterações a esta Política</h2>
          <p>
            Podemos atualizar nossa Política de Privacidade periodicamente. Notificaremos você sobre quaisquer alterações publicando a nova política nesta página e atualizando a data da "Última atualização".
          </p>

          <h2>7. Contato</h2>
          <p>
            Se você tiver alguma dúvida sobre esta Política de Privacidade ou sobre como tratamos seus dados, entre em contato conosco:
            <br />
            <strong>E-mail:</strong> <a href="mailto:contato@melhorafotoai.com.br">contato@melhorafotoai.com.br</a>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
