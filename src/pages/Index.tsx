import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ArrowRight, Star, Upload, Zap, Shield, CheckCircle } from 'lucide-react';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';

const categories = [
  {
    icon: '🍕',
    title: 'Alimentos',
    description: 'Realce crocância, suculência e frescor mantendo textura natural',
    features: ['Cores naturais', 'Textura realista', 'Pronto para cardápio']
  },
  {
    icon: '📦',
    title: 'Produtos',
    description: 'Transforme fotos caseiras em imagens de estúdio para seu e-commerce',
    features: ['Fundo branco profissional', 'Sombras realistas', 'Pronto para vender']
  }
];

const steps = [
  {
    step: '1',
    title: 'Upload da Imagem',
    description: 'Faça upload da sua imagem em alta qualidade'
  },
  {
    step: '2',
    title: 'Selecione a Categoria',
    description: 'Escolha entre alimentos ou produtos'
  },
  {
    step: '3',
    title: 'IA Processa',
    description: 'Nossa IA melhora a imagem mantendo 100% a realidade'
  },
  {
    step: '4',
    title: 'Download',
    description: 'Baixe sua imagem profissional em alta resolução'
  }
];

export default function Index() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-50 py-20">
        <div className="container mx-auto px-4 text-center">
          <Badge className="mb-6 bg-gradient-fotoperfeita text-white hover:opacity-90">
            🤖 Transforme suas Fotos com IA
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="fotoperfeita-primary">Fotos de Estúdio,</span>
            <br />
            <span className="text-gray-900">com um Clique</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Melhore suas imagens de alimentos e produtos com IA, 
            mantendo <strong>100% a realidade</strong>. Qualidade profissional em segundos.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-gradient-fotoperfeita hover:opacity-90" asChild>
              <Link to="/register">
                Começar Grátis
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/pricing">Ver Preços</Link>
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            ✨ 2 imagens grátis para novos usuários
          </p>
        </div>
      </section>

      {/* Before/After Section - COM ESTILOS DE 'CONTAIN' */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Resultados que Falam por Si</h2>
            <p className="text-xl text-gray-600">Arraste para ver a mágica da nossa IA em ação</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* SLIDER DE ALIMENTOS */}
            <div className="text-center">
              <h3 className="text-2xl font-semibold mb-4">Alimentos</h3>
              <div className="rounded-xl overflow-hidden shadow-xl border aspect-w-4 aspect-h-3">
                <ReactCompareSlider
                  itemOne={<ReactCompareSliderImage 
                            src="/assets/examples/alimento-antes.jpg" 
                            alt="Alimento Antes" 
                            style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'white' }} 
                          />}
                  itemTwo={<ReactCompareSliderImage 
                            src="/assets/examples/alimento-depois.jpg" 
                            alt="Alimento Depois" 
                            style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'white' }}
                          />}
                />
              </div>
            </div>

            {/* SLIDER DE PRODUTOS */}
            <div className="text-center">
              <h3 className="text-2xl font-semibold mb-4">Produtos</h3>
              <div className="rounded-xl overflow-hidden shadow-xl border aspect-w-4 aspect-h-3">
                <ReactCompareSlider
                  itemOne={<ReactCompareSliderImage 
                            src="/assets/examples/produto-antes.jpg" 
                            alt="Produto Antes" 
                            style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'white' }}
                          />}
                  itemTwo={<ReactCompareSliderImage 
                            src="/assets/examples/produto-depois.jpg" 
                            alt="Produto Depois" 
                            style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'white' }}
                          />}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section id="categorias" className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Categorias Especializadas</h2>
            <p className="text-xl text-gray-600">IA treinada para cada tipo de imagem</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {categories.map((category, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader className="text-center">
                  <div className="text-4xl mb-2">{category.icon}</div>
                  <CardTitle className="text-xl">{category.title}</CardTitle>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {category.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="como-funciona" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Como Funciona</h2>
            <p className="text-xl text-gray-600">Simples, rápido e profissional</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-gradient-fotoperfeita rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
                  {step.step}
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Por que MelhoraFotoAI?</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <Shield className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">100% Realidade</h3>
              <p className="text-gray-600">Não criamos nem removemos elementos. Apenas melhoramos o que já existe.</p>
            </div>
            <div className="text-center">
              <Zap className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Processamento Rápido</h3>
              <p className="text-gray-600">Resultados em segundos com nossa IA avançada.</p>
            </div>
            <div className="text-center">
              <Star className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Qualidade Profissional</h3>
              <p className="text-gray-600">Imagens prontas para marketing, e-commerce e redes sociais.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-fotoperfeita text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">Pronto para transformar suas fotos?</h2>
          <p className="text-xl mb-8 opacity-90">
            Teste gratuitamente com 2 imagens
          </p>
          <Button size="lg" className="bg-white text-primary hover:bg-gray-100" asChild>
            <Link to="/register">
              <Upload className="mr-2 w-5 h-5" />
              Começar Agora
            </Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
