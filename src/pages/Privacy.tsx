import Header from '@/components/Header';
import Footer from '@/components/Footer';

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
            A sua privacidade é de extrema importância para o MelhoraFotoAI ("nós", "nosso"). Esta Política de Privacidade descreve como
            coletamos, usamos, armazenamos e compartilhamos suas informações pessoais e as imagens que você nos fornece ao usar nosso
            serviço ("Serviço"). Esta política está em conformidade com a Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018).
          </p>

          <h2>1. Informações que Coletamos</h2>
          <p>Coletamos diferentes tipos de informações para fornecer e melhorar nosso Serviço:</p>
          <ul>
            <li>
              <strong>Informações de Cadastro:</strong> Ao criar uma conta, coletamos seu nome e endereço de e-mail.
            </li>
            <li>
              <strong>Conteúdo do Usuário:</strong> As imagens que você envia para processamento.
            </li>
            <li>
              <strong>Informações de Pagamento:</strong> Para compras na <strong>web</strong>, o processamento é realizado de forma
              segura pelo <strong>Stripe</strong> (não armazenamos dados de cartão). Para compras no <strong>app Android</strong>,
              utilizamos o <strong>Google Play Billing</strong>. Em ambos os casos, armazenamos apenas identificadores da transação
              (ex.: pacote, valor, data/ID, e <em>purchase token</em> quando aplicável), para conciliação, antifraude e suporte.
            </li>
            <li>
              <strong>Informações de Uso e Técnicas:</strong> dados de interação com o Serviço (IP, tipo de navegador/dispositivo,
              páginas/telas acessadas) para análise e melhoria.
            </li>
            <li>
              <strong>Métricas e Diagnósticos:</strong> eventos anônimos no <strong>Google Analytics 4</strong> e erros no
              <strong> Sentry</strong> para aprimorar estabilidade e desempenho.
            </li>
            <li>
              <strong>Publicidade:</strong> o <strong>Google AdMob</strong> pode coletar identificadores do dispositivo e dados de uso
              para personalização, medição de anúncios e prevenção a fraude, conforme políticas do Google.
            </li>
          </ul>

          <h2>2. Como Usamos Suas Informações</h2>
          <ul>
            <li>
              <strong>Fornecer e Manter o Serviço:</strong> autenticar usuários, processar imagens e gerenciar créditos.
            </li>
            <li>
              <strong>Processar Transações:</strong> conciliar compras, liberar créditos e registrar histórico (Stripe na web; Google
              Play Billing no app Android).
            </li>
            <li>
              <strong>Comunicação:</strong> enviar notificações importantes sobre conta, compras e atualizações do Serviço.
            </li>
            <li>
              <strong>Segurança e Melhoria:</strong> analisar uso, detectar abusos/fraudes, corrigir falhas e melhorar a experiência.
            </li>
            <li>
              <strong>Publicidade:</strong> exibir anúncios por meio do AdMob, quando aplicável.
            </li>
          </ul>

          <h2>3. Compartilhamento e Divulgação de Informações</h2>
          <p>Não vendemos seus dados pessoais. Compartilhamos estritamente com provedores necessários para operar o Serviço:</p>
          <ul>
            <li>
              <strong>Supabase:</strong> autenticação, banco de dados e armazenamento seguro das imagens.
            </li>
            <li>
              <strong>Fal.ai:</strong> processamento de imagens por IA (recebe apenas a URL temporária/assinada necessária à execução).
            </li>
            <li>
              <strong>Stripe:</strong> processamento de pagamentos da <strong>web</strong>.
            </li>
            <li>
              <strong>Google Play Billing:</strong> processamento de compras no <strong>app Android</strong>.
            </li>
            <li>
              <strong>Google AdMob</strong> e <strong>Google Analytics</strong>: exibição de anúncios e métricas/relatórios.
            </li>
          </ul>
          <p>Também podemos divulgar informações quando exigido por lei ou por solicitações válidas de autoridades públicas.</p>

          <h2>4. Seus Direitos sob a LGPD</h2>
          <ul>
            <li>
              <strong>Confirmar</strong> a existência de tratamento.
            </li>
            <li>
              <strong>Acessar</strong> seus dados.
            </li>
            <li>
              <strong>Corrigir</strong> dados incompletos, inexatos ou desatualizados.
            </li>
            <li>
              <strong>Anonimização, bloqueio ou eliminação</strong> de dados desnecessários ou excessivos.
            </li>
            <li>
              <strong>Portabilidade</strong> a outro fornecedor de serviço.
            </li>
            <li>
              <strong>Eliminação</strong> de dados tratados com consentimento.
            </li>
            <li>
              <strong>Informações</strong> sobre compartilhamento com terceiros.
            </li>
          </ul>
          <p>Para exercer seus direitos, entre em contato pelo e-mail abaixo.</p>

          <h2>5. Segurança e Retenção de Dados</h2>
          <p>
            Empregamos medidas técnicas e administrativas para proteger suas informações. Dados e imagens são mantidos enquanto a conta
            estiver ativa e pelo período necessário para obrigações legais/auditoria. Você pode solicitar a exclusão da conta e dados
            associados a qualquer momento.
          </p>

          <h2>6. Alterações a esta Política</h2>
          <p>
            Podemos atualizar esta política periodicamente. Publicaremos a versão vigente nesta página e atualizaremos a data da “Última
            atualização”.
          </p>

          <h2>7. Contato</h2>
          <p>
            Dúvidas sobre esta política ou tratamento de dados:
            <br />
            <strong>E-mail:</strong>{' '}
            <a href="mailto:contato@melhorafotoai.com.br">contato@melhorafotoai.com.br</a>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

