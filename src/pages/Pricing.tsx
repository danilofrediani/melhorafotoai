// src/pages/Pricing.tsx
import { useEffect, useMemo, useState } from 'react';
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

import { useIsTwa } from '@/hooks/useIsTwa';

// ======================================================
// CONFIG
// ======================================================
const PLAY_SKUS = ['credits_10', 'credits_20', 'credits_50'] as const;

const googlePlayProductMap: Record<string, Partial<PackageType>> = {
  credits_10: { images: 10, description: '10 créditos para edição\nQualidade Profissional\nSuporte via E-mail', is_most_popular: false },
  credits_20: { images: 20, description: '20 créditos para edição\nQualidade Profissional\nSuporte via E-mail', is_most_popular: true },
  credits_50: { images: 50, description: '50 créditos para edição\nQualidade Profissional\nSuporte Prioritário', is_most_popular: false },
};

const getIcon = (type: string) => {
  if (type === 'mensal') return <Star className="w-8 h-8 text-[#2BC2C9]" />;
  if (type === 'profissional') return <Crown className="w-8 h-8 text-[#2BC2C9]" />;
  return <Bolt className="w-8 h-8 text-[#2BC2C9]" />;
};

export default function Pricing() {
  const [displayPackages, setDisplayPackages] = useState<PackageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPurchasingId, setIsPurchasingId] = useState<string | null>(null);

  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const isTwaMode = useIsTwa();

  // Carrega pacotes (Stripe no web / estáticos no app)
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      if (isTwaMode) {
        const transformed = PLAY_SKUS.map((sku) => {
          const meta = googlePlayProductMap[sku] || {};
          return {
            id: sku,
            name: `${meta.images ?? ''} Imagens`,
            price: 0,
            images: meta.images || 0,
            type: 'avulso',
            description: meta.description || '',
            is_most_popular: !!meta.is_most_popular,
            created_at: new Date().toISOString(),
            is_active: true,
            google_play_sku: sku,
          } as PackageType;
        });
        setDisplayPackages(transformed);
        setLoading(false);
      } else {
        try {
          const stripeData = await packageService.getActivePackages();
          setDisplayPackages(stripeData || []);
        } catch {
          toast.error('Não foi possível carregar os planos.');
        } finally {
          setLoading(false);
        }
      }
    };
    loadData();
  }, [isTwaMode]);

  // ==========================
  // Handlers
  // ==========================
  const handleStripePurchase = async (pkg: PackageType) => {
    if (!profile) {
      localStorage.setItem('pendingPurchasePackageId', pkg.id);
      navigate('/login');
      return;
    }
    setIsPurchasingId(pkg.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { package_id: pkg.id },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error || 'Não foi possível iniciar o pagamento.');
      if (data?.checkout_url) window.location.href = data.checkout_url;
      else throw new Error('URL de checkout não recebida.');
    } catch (err: any) {
      toast.error(`Falha: ${err.message}`);
    } finally {
      setIsPurchasingId(null);
    }
  };

  const handleGooglePlayPurchase = async (pkg: PackageType) => {
    if (!profile) {
      toast.info('Você precisa estar logado para comprar.');
      navigate('/login');
      return;
    }
    const skuToSend = pkg.google_play_sku || pkg.id;
    if (!skuToSend || !PLAY_SKUS.includes(skuToSend as any)) {
      toast.error("Este pacote não está configurado para compra no app.");
      return;
    }

    setIsPurchasingId(pkg.id);

    try {
      (window as any).MFBridge?.buyCredits(skuToSend);
      toast.info("Abrindo compra no Google Play...");

      const listener = async (e: any) => {
        const { sku, purchaseToken } = e.detail || {};
        if (sku && purchaseToken) {
          toast.success("Compra aprovada. Validando...");
          const { data: sessionData } = await supabase.auth.getSession();
          const { data, error } = await supabase.functions.invoke('verify-play-purchase', {
            body: { sku, purchaseToken },
            headers: { Authorization: `Bearer ${sessionData?.session?.access_token}` },
          });
          if (error || data?.error) {
            toast.error("Falha na validação com Google Play.");
          } else {
            toast.success("Créditos adicionados com sucesso!");
            await refreshProfile?.();
            navigate('/dashboard');
          }
        }
        window.removeEventListener("PURCHASE_COMPLETED", listener);
      };
      window.addEventListener("PURCHASE_COMPLETED", listener);
    } catch (err: any) {
      toast.error(`Erro inesperado: ${err.message}`);
    } finally {
      setIsPurchasingId(null);
    }
  };

  // ==========================
  // Renderização
  // ==========================
  const avulsoPackages = useMemo(() => displayPackages.filter((p) => p.type === 'avulso').sort((a, b) => a.images - b.images), [displayPackages]);
  const mensalPackages = useMemo(() => displayPackages.filter((p) => p.type === 'mensal').sort((a, b) => a.price - b.price), [displayPackages]);
  const profissionalPackages = useMemo(() => displayPackages.filter((p) => p.type === 'profissional').sort((a, b) => a.price - b.price), [displayPackages]);

  const getFirstAvailableTab = () => {
    if (avulsoPackages.length > 0) return 'avulso';
    if (!isTwaMode && mensalPackages.length > 0) return 'mensal';
    if (!isTwaMode && profissionalPackages.length > 0) return 'profissional';
    return isTwaMode ? 'avulso' : '';
  };
  const firstAvailableTab = getFirstAvailableTab();

  if (loading) {
    return (<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>);
  }

  const renderPackageCard = (pkg: PackageType) => {
    const purchaseHandler = isTwaMode ? handleGooglePlayPurchase : handleStripePurchase;
    const finalPrice = isTwaMode ? "Google Play" : `R$ ${pkg.price.toFixed(2).replace('.', ',')}`;
    const pricePerImage = pkg.images > 0 ? (pkg.price / pkg.images).toFixed(2).replace('.', ',') : '0,00';
    return (
      <Card key={pkg.id} className={`relative text-left p-8 flex flex-col items-center text-center ${pkg.is_most_popular ? 'border-2 border-primary shadow-lg' : ''}`}>
        {pkg.is_most_popular && (<div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2"><Badge className="bg-primary text-white py-1 px-3">Mais Popular</Badge></div>)}
        <div className="mb-4">{getIcon(pkg.type)}</div>
        <h3 className="text-xl font-bold mb-1">{pkg.name}</h3>
        <p className="text-sm text-gray-600 mb-4">{pkg.images} imagens {pkg.type !== 'avulso' ? 'por mês' : ''}</p>
        <p className="text-4xl font-bold text-primary mb-1">{finalPrice}</p>
        <p className="text-sm text-gray-600 mb-6">(R$ {pricePerImage} por imagem)</p>
        <ul className="space-y-3 text-sm text-gray-800 text-left w-full mb-8 flex-grow">
          {pkg.description?.split('\n').map((item, index) => (
            <li key={index} className="flex items-center space-x-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /><span>{item}</span></li>
          ))}
        </ul>
        <Button onClick={() => purchaseHandler(pkg)} className="w-full bg-gradient-pricing text-white" disabled={isPurchasingId === pkg.id}>
          {isTwaMode ? 'COMPRAR NO GOOGLE PLAY' : 'Comprar Agora'}
          {isPurchasingId === pkg.id && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
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
              {!isTwaMode && mensalPackages.length > 0 && <TabsTrigger value="mensal">Planos Mensais</TabsTrigger>}
              {!isTwaMode && profissionalPackages.length > 0 && <TabsTrigger value="profissional">Planos Profissionais</TabsTrigger>}
            </TabsList>
            <TabsContent value="avulso"><div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">{avulsoPackages.map(renderPackageCard)}</div></TabsContent>
            {!isTwaMode && (
              <>
                <TabsContent value="mensal"><div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">{mensalPackages.map(renderPackageCard)}</div></TabsContent>
                <TabsContent value="profissional"><div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">{profissionalPackages.map(renderPackageCard)}</div></TabsContent>
              </>
            )}
          </Tabs>
        ) : (
          !loading && <p className="text-gray-600 col-span-3 text-center py-10">Nenhum pacote disponível no momento.</p>
        )}
      </div>
      <Footer />
    </div>
  );
}

