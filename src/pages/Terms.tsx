import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function Terms() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto prose lg:prose-lg">
          <h1>Termos e Condições de Uso - MelhoraFotoAI</h1>
          <p className="lead">
            <strong>Última atualização: 13 de setembro de 2025</strong>
          </p>
          <p>
            Bem-vindo ao MelhoraFotoAI! Estes Termos de Uso ("Termos") governam seu acesso e uso da nossa plataforma online de melhoria de fotos por inteligência artificial ("Serviço"), acessível através do site melhorafotoai.com.br. Ao se cadastrar ou utilizar nosso Serviço, você concorda em cumprir e estar legalmente vinculado a estes Termos.
          </p>

          <h2>1. Descrição dos Serviços</h2>
          <p>
            O MelhoraFotoAI é uma plataforma que permite aos usuários enviar imagens digitais ("Conteúdo") para serem processadas por algoritmos de inteligência artificial. O objetivo do Serviço é realizar melhorias fotográficas, como ajustes de cor, nitidez, iluminação e, em casos específicos (como a categoria "Produtos"), a remoção do fundo original e sua substituição por um fundo neutro com sombreamento realista.
          </p>

          <h2>2. Cadastro e Conta do Usuário</h2>
          <ul>
            <li>Para acessar a maioria dos recursos, você deve se registrar e criar uma conta. Você concorda em fornecer informações precisas, atuais e completas durante o processo de registro.</li>
            <li>Você é responsável por proteger sua senha e por todas as atividades que ocorrem em sua conta. Notifique-nos imediatamente sobre qualquer uso não autorizado.</li>
          </ul>

          <h2>3. Créditos e Pagamentos</h2>
          <ul>
            <li>O uso do Serviço é baseado em um sistema de créditos. Cada imagem processada consome um ou mais créditos, conforme especificado nos pacotes.</li>
            <li>Os créditos podem ser adquiridos através de pacotes avulsos. O pagamento é processado por nosso parceiro de pagamentos, Stripe. Nós não armazenamos as informações do seu cartão de crédito.</li>
            <li>Ao comprar um pacote de créditos, você concorda com os preços e condições de pagamento apresentados no momento da compra.</li>
            <li>Os créditos adquiridos não são reembolsáveis, exceto quando exigido por lei. Os créditos não possuem data de validade enquanto sua conta estiver ativa.</li>
          </ul>

          <h2>4. Conteúdo do Usuário e Propriedade Intelectual</h2>
          <ul>
            <li><strong>Você retém todos os direitos e a propriedade sobre o seu Conteúdo original.</strong> O MelhoraFotoAI não reivindica nenhuma propriedade sobre as imagens que você envia.</li>
            <li>Ao enviar seu Conteúdo para o Serviço, você nos concede uma licença mundial, não exclusiva, isenta de royalties e revogável para usar, modificar, reproduzir e processar seu Conteúdo com o único propósito de operar e fornecer o Serviço a você.</li>
            <li>Você é o único responsável por todo o Conteúdo que envia e garante que possui todos os direitos necessários para nos conceder tal licença. Você concorda em não enviar conteúdo ilegal, pornográfico, odioso, ou que infrinja os direitos de propriedade intelectual de terceiros.</li>
            <li>Reservamo-nos o direito de remover qualquer Conteúdo ou suspender contas que violem estes Termos.</li>
          </ul>

          <h2>5. Propriedade Intelectual do MelhoraFotoAI</h2>
          <p>
            A plataforma MelhoraFotoAI, incluindo seu design, software, logotipos, textos e gráficos, é de propriedade exclusiva do MelhoraFotoAI e de seus licenciadores, protegida por direitos autorais e outras leis de propriedade intelectual.
          </p>

          <h2>6. Limitação de Responsabilidade</h2>
          <p>
            O Serviço é fornecido "como está", sem garantias de qualquer tipo. Embora nos esforcemos para fornecer resultados de alta qualidade, não garantimos que o Serviço atenderá a todas as suas expectativas ou que será ininterrupto e livre de erros. Em nenhuma circunstância o MelhoraFotoAI será responsável por quaisquer danos indiretos, incidentais ou consequenciais resultantes do uso do Serviço.
          </p>

          <h2>7. Privacidade de Dados</h2>
          <p>
            Sua privacidade é importante para nós. A coleta e o uso de suas informações pessoais e do seu Conteúdo são regidos por nossa <a href="/privacidade">Política de Privacidade</a>, que é parte integrante destes Termos.
          </p>
          
          <h2>8. Alterações nos Termos</h2>
          <p>
            Reservamo-nos o direito de modificar estes Termos a qualquer momento. Se fizermos alterações, publicaremos os Termos revisados no site e atualizaremos a data da "Última atualização". O uso continuado do Serviço após tais alterações constituirá sua aceitação dos novos Termos.
          </p>

          <h2>9. Lei Aplicável e Foro</h2>
          <p>
            Estes Termos serão regidos e interpretados de acordo com as leis da República Federativa do Brasil. Fica eleito o foro da Comarca de São Paulo, Estado de São Paulo, para dirimir quaisquer controvérsias oriundas destes Termos.
          </p>

          <h2>10. Contato</h2>
          <p>
            Se você tiver alguma dúvida sobre estes Termos, entre em contato conosco pelo e-mail: <a href="mailto:contato@melhorafotoai.com.br">contato@melhorafotoai.com.br</a>.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
