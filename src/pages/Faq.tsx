import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from 'react-router-dom';

const faqs = [
  {
    question: "O que é o MelhoraFotoAI?",
    answer: "O MelhoraFotoAI é uma plataforma online que utiliza inteligência artificial para melhorar a qualidade de suas fotos de forma rápida e acessível. Atualmente, somos especializados em fotos de Alimentos e Produtos para e-commerce, transformando imagens amadoras em resultados de nível profissional."
  },
  {
    question: "Como funciona o processo?",
    answer: "É muito simples! O processo tem 3 etapas: 1) Você faz o upload da sua imagem. 2) Escolhe a categoria correta (Alimentos ou Produtos). 3) Nossa IA processa a foto em segundos e te entrega a versão melhorada, pronta para download."
  },
  {
    question: "Como funcionam os créditos?",
    answer: "Nosso sistema é baseado em créditos. Cada 1 crédito permite que você processe 1 imagem. Você pode comprar pacotes de créditos avulsos, e eles ficam na sua conta para você usar quando precisar."
  },
  {
    question: "Os créditos que eu compro expiram?",
    answer: "Não. Seus créditos não têm data de validade. Eles permanecem na sua conta enquanto ela estiver ativa, para você usar no seu ritmo."
  },
  {
    question: "É seguro enviar minhas fotos para a plataforma?",
    answer: "Sim. A segurança e a privacidade dos seus dados são nossa prioridade. Suas imagens são armazenadas de forma segura e usadas unicamente para realizar o processamento que você solicitou. Para mais detalhes, consulte nossa <a href='/privacidade' class='text-primary hover:underline'>Política de Privacidade</a>."
  },
  {
    question: "Eu continuo sendo o dono dos direitos autorais das minhas fotos?",
    answer: "Com certeza. Você retém 100% dos direitos e da propriedade sobre suas imagens originais e as versões melhoradas. Nós apenas fornecemos o serviço de processamento. Veja mais em nossos <a href='/termos' class='text-primary hover:underline'>Termos de Uso</a>."
  },
  {
    question: "Quais métodos de pagamento são aceitos?",
    answer: "Aceitamos os principais cartões de crédito. Todos os pagamentos são processados de forma segura pelo nosso parceiro, Stripe, uma das maiores e mais seguras plataformas de pagamento do mundo. Nós não armazenamos os dados do seu cartão."
  },
  {
    question: "Posso testar o serviço antes de comprar?",
    answer: "Sim! Ao criar sua conta, você ganha créditos gratuitos para testar a qualidade e o poder da nossa IA. Queremos que você veja o resultado antes de se comprometer."
  }
];

export default function Faq() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold">Perguntas Frequentes (FAQ)</h1>
            <p className="text-lg text-gray-600 mt-4">
              Tudo o que você precisa saber para começar a usar o MelhoraFotoAI.
            </p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger className="text-lg text-left">{faq.question}</AccordionTrigger>
                <AccordionContent className="prose lg:prose-lg max-w-none">
                  <p dangerouslySetInnerHTML={{ __html: faq.answer }}></p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </main>
      <Footer />
    </div>
  );
}
