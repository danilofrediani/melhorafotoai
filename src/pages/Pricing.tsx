import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, Bolt, Star, Crown, Loader2 } from 'lucide-react';
import { packageService } from '@/lib/database';
import type { Package as PackageType } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

// --- INÍCIO DAS NOVAS IMPORTAÇÕES E LÓGICAS ---
import usePlayBilling from '@/hooks/usePlayBilling';

// Mapeamento dos IDs do Google Play para os dados que só temos no nosso DB
const googlePlayProductMap: Record<string, Partial<PackageType>> = {
  'credits_10': { images: 10, description: '10 créditos para edição\nQualidade Profissional\nSuporte via E-mail', is_most_popular: false },
  'credits_20': { images: 20, description: '20 créditos para edição\nQualidade Profissional\nSuporte via E-mail', is_most_popular: true },
  'credits_50': { images: 50, description: '50 créditos para edição\nQualidade Profissional\nSuporte Prioritário', is_most_popular: false },
};
// --- FIM DAS NOVAS IMPORTAÇÕES E LÓGICAS ---


const getIcon = (type: string) => {
  if (type === 'mensal') return <Star className="w-8 h-8 text-[#2BC2C9]" />;
  if (type === 'profissional') return <Crown className="w-8 h-8 text-[#2BC2C9]" />;
  return <Bolt className="w-8 h-8 text-[#2BC2C9]" />;
};

export default function Pricing() {
  const [stripePackages, setStripePackages] = useState<PackageType[]>([]);
  const [displayPackages, setDisplayPackages] = useState<PackageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPurchasingId, setIsPurchasingId] = useState<string | null>(null);
  const { profile } = useAuth();
  const navigate = useNavigate();

  // --- INÍCIO DA INTEGRAÇÃO DO GOOGLE PLAY BILLING ---
  const { playStoreService, products: googlePlayProducts, loadProducts, purchase: googlePlayPurchase } = usePlayBilling();
  const isAppMode = !!playStoreService; // Nosso detector de ambiente (Web vs App)

  // Carrega os produtos do Google Play se estivermos no App
  useEffect(() => {
    if (isAppMode) {
      const productIds = ['credits_10', 'credits_20', 'credits_50'];
      loadProducts(productIds);
    }
  }, [isAppMode, loadProducts]);
  // --- FIM DA INTEGRAÇÃO DO GOOGLE PLAY BILLING ---


  // Carrega os pacotes do Stripe (fluxo original da web)
  useEffect(() => {
    const fetchStripePackages = async () => {
      try {
        setLoading(true);
        const data = await packageService.getActivePackages();
        setStripePackages(data || []);
      } catch (err) {
        toast.error("Não foi possível carregar os planos.");
      } finally {
        setLoading(false);
      }
    };
    
    // Só carrega os pacotes do Stripe se não estivermos no modo App
    if (!isAppMode) {
      fetchStripePackages();
    }
  }, [isAppMode]);

  // Define quais pacotes mostrar na tela (Stripe ou Google Play)
  useEffect(() => {
    if (isAppMode) {
        // Se estiver no app, transforma os produtos do Google em pacotes que nosso UI entende
        if (googlePlayProducts.length > 0) {
            const transformedPackages = googlePlayProducts.map(p => ({
                id: p.itemId,
                name: p.title.replace(' (MelhoraFotoAI)', ''), // Limpa o nome que o Google adiciona
                price: parseFloat(p.price.value),
                images: googlePlayProductMap[p.itemId]?.images || 0,
                type: 'avulso', // Todos os produtos do Google são avulsos por enquanto
                description: googlePlayProductMap[p.itemId]?.description || '',
                is_most_popular: googlePlayProductMap[p.itemId]?.is_most_popular || false,
                created_at: new Date().toISOString(),
                is_active: true,
            }));
            setDisplayPackages(transformedPackages);
            setLoading(false);
        }
    } else {
        // Se estiver na web, usa os pacotes do Stripe
        setDisplayPackages(stripePackages);
    }
  }, [isAppMode, googlePlayProducts, stripePackages]);


  // Handler para compras via Stripe
  const handleStripePurchase = async (pkg: PackageType) => {
    // ... (código original do Stripe, sem alterações)
    if (!profile) {
      localStorage.setItem('pendingPurchasePackageId', pkg.id);
      toast.info('Você precisa criar uma conta para continuar.');
      navigate('/login');
      return;
    }
    setIsPurchasingId(pkg.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { package_id: pkg.id },
      });
      if (error || (data && data.error)) {
        throw new Error(error?.message || data?.error || 'Não foi possível iniciar o pagamento.');
      }
      const checkoutUrl = data?.checkout_url;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error('URL de checkout não recebida.');
      }
    } catch (error: any) {
      toast.error(`Falha: ${error.message}`);
      setIsPurchasingId(null);
    }
  };

  // --- NOVO HANDLER PARA COMPRAS VIA GOOGLE PLAY ---
  const handleGooglePlayPurchase = async (pkg: PackageType) => {
    if (!profile) {
      toast.info('Você precisa estar logado para comprar.');
      navigate('/login');
      return;
    }
    setIsPurchasingId(pkg.id);
    try {
        const purchaseToken = await googlePlayPurchase(pkg.id);
        
        if (purchaseToken) {
            // FASE 3: ONDE O BACK-END ENTRA
            // TODO: Chamar uma nova Supabase Function 'verify-google-purchase' 
            // passando o purchaseToken e o profile.id.
            // A função do back-end validará o token com o Google e liberará os créditos.
            toast.success("Compra realizada com sucesso! Validando e adicionando créditos...");
            
            // Simulação da chamada de back-end por enquanto
            console.log("Token da Compra para validar no back-end:", purchaseToken);
        }
    } catch (error: any) {
        toast.error(`Falha na compra: ${error.message}`);
    } finally {
        setIsPurchasingId(null);
    }
  };


  // Lógica de filtragem agora usa 'displayPackages'
  const avulsoPackages = displayPackages.filter(p => p.type === 'avulso').sort((a, b) => a.price - b.price);
  const mensalPackages = displayPackages.filter(p => p.type === 'mensal').sort((a, b) => a.price - b.price);
  const profissionalPackages = displayPackages.filter(p => p.type === 'profissional').sort((a, b) => a.price - b.price);

  const getFirstAvailableTab = () => {
    if (avulsoPackages.length > 0) return 'avulso';
    if (mensalPackages.length > 0) return 'mensal';
    if (profissionalPackages.length > 0) return 'profissional';
    return isAppMode ? 'avulso' : '';
  };
  const firstAvailableTab = getFirstAvailableTab();

  if (loading && displayPackages.length === 0) {
    return ( <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> );
  }

  const renderPackageCard = (pkg: PackageType) => {
    const isMostPopular = pkg.is_most_popular;
    const pricePerImage = pkg.images > 0 ? (pkg.price / pkg.images).toFixed(2) : '0.00';
    const finalPrice = pkg.price.toFixed(2);
    
    // A função de compra agora é decidida com base no modo (App ou Web)
    const purchaseHandler = isAppMode ? handleGooglePlayPurchase : handleStripePurchase;

    return (
      <Card key={pkg.id} className={`relative text-left p-8 flex flex-col items-center text-center ${isMostPopular ? 'border-2 border-primary shadow-lg' : ''}`}>
        {isMostPopular && (<div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2"><Badge className="bg-primary text-white py-1 px-3">Mais Popular</Badge></div>)}
        <div className="mb-4">{getIcon(pkg.type)}</div>
        <h3 className="text-xl font-bold mb-1">{pkg.name}</h3>
        <p className="text-sm text-gray-600 mb-4">{pkg.images} imagens {pkg.type !== 'avulso' ? 'por mês' : ''}</p>
        <p className="text-4xl font-bold text-primary mb-1">R$ {finalPrice.replace('.', ',')}</p>
        
        <p className="text-sm text-gray-600 mb-6">
          (R$ {pricePerImage.replace('.', ',')} por imagem)
        </p>
        
        <ul className="space-y-3 text-sm text-gray-800 text-left w-full mb-8 flex-grow">
            {pkg.description?.split('\n').map((item, index) => (
              <li key={index} className="flex items-center space-x-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /><span>{item}</span></li>
            ))}
        </ul>
        <Button onClick={() => purchaseHandler(pkg)} className="w-full bg-gradient-pricing text-white" disabled={isPurchasingId === pkg.id}>
            {isPurchasingId === pkg.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Comprar Agora'}
        </Button>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold mb-4">Escolha o pacote ideal para você</h1>
        <p className="text-lg text-gray-600 mb-12">Preços justos para qualquer necessidade.</p>
        
        {firstAvailableTab ? (
          <Tabs defaultValue={firstAvailableTab} className="w-full">
            <TabsList className="mx-auto mb-8">
              {avulsoPackages.length > 0 && <TabsTrigger value="avulso">Pacotes Avulsos</TabsTrigger>}
              {mensalPackages.length > 0 && <TabsTrigger value="mensal">Planos Mensais</TabsTrigger>}
              {profissionalPackages.length > 0 && <TabsTrigger value="profissional">Planos Profissionais</TabsTrigger>}
            </TabsList>

            <TabsContent value="avulso"><div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">{avulsoPackages.map(renderPackageCard)}</div></TabsContent>
            <TabsContent value="mensal"><div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">{mensalPackages.map(renderPackageCard)}</div></TabsContent>
            <TabsContent value="profissional"><div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">{profissionalPackages.map(renderPackageCard)}</div></TabsContent>
          </Tabs>
        ) : (
          <p className="text-gray-600 col-span-3 text-center py-10">Nenhum pacote disponível no momento.</p>
        )}
      </div>
      <Footer />
    </div>
  );
}
