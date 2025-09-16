// src/pages/Pricing.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
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

import useIsTwa from '@/hooks/useIsTwa';            // <- default import (corrigido)
import usePlayBilling from '@/hooks/usePlayBilling'; // <- default import

// --- DEBUG SEMPRE VISÍVEL (temporário)
const SHOW_DEBUG = true;

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

function formatCurrency(value: number, currency?: string) {
  const curr = currency || 'BRL';
  try {
    return new Intl.NumberFormat(navigator.language || 'pt-BR', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${curr}`;
  }
}

export default function Pricing() {
  const [displayPackages, setDisplayPackages] = useState<PackageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPurchasingId, setIsPurchasingId] = useState<string | null>(null);
  const { profile } = useAuth();
  const navigate = useNavigate();

  const isTwaMode = useIsTwa();

  const {
    playStoreService, // pode ser null; não bloqueia compra
    products: googlePlayProducts,
    loadProducts,
    purchase: googlePlayPurchase,
    isLoading: isPlayBillingLoading,
    isAvailable: isPlayAvailable,
    error: playError,
  } = usePlayBilling(isTwaMode);

  const playMetaRef = useRef<Record<string, { currency?: string; title?: string }>>({});

  // WEB -> Stripe
  useEffect(() => {
    const loadWebPackages = async () => {
      if (isTwaMode) { setLoading(false); return; }
      setLoading(true);
      try {
        const stripeData = await packageService.getActivePackages();
        setDisplayPackages(stripeData || []);
      } catch {
        toast.error('Não foi possível carregar os planos.');
      } finally {
        setLoading(false);
      }
    };
    loadWebPackages();
  }, [isTwaMode]);

  // APP/TWA -> Play Billing (se disponível)
  useEffect(() => {
    const loadPlayProductsEffect = async () => {
      if (!isTwaMode) return;
      if (!isPlayAvailable) { setDisplayPackages([]); return; }
      setLoading(true);
      try {
        await loadProducts(['credits_10', 'credits_20', 'credits_50']);
      } finally {
        setLoading(false);
      }
    };
    loadPlayProductsEffect();
  }, [isTwaMode, isPlayAvailable, loadProducts]);

  // Converte produtos GP em packages
useEffect(() => {
  if (!isTwaMode) return;
  if (googlePlayProducts.length === 0) return;

  const meta: Record<string, { currency?: string; title?: string }> = {};

  const transformed = googlePlayProducts.map(p => {
    // Preenche o "meta" para usar na formatação de preço lá no render
    meta[p.itemId] = { currency: p.price?.currency, title: p.title };

    return {
      id: p.itemId,
      name: (p.title || p.itemId).replace(/\s*\(.*?\)\s*$/, ''), // remove "(unreviewed)", etc.
      price: parseFloat(String(p.price?.value ?? '0')),
      images: googlePlayProductMap[p.itemId]?.images || 0,
      type: 'avulso',
      description: googlePlayProductMap[p.itemId]?.description || '',
      is_most_popular: googlePlayProductMap[p.itemId]?.is_most_popular || false,
      created_at: new Date().toISOString(),
      is_active: true,
    } as PackageType;
  });

  playMetaRef.current = meta;
  setDisplayPackages(transformed);
}, [isTwaMode, googlePlayProducts]);


  // Stripe (web)
  const handleStripePurchase = async (pkg: PackageType) => {
    if (!profile) { localStorage.setItem('pendingPurchasePackageId', pkg.id); navigate('/login'); return; }
    setIsPurchasingId(pkg.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', { body: { package_id: pkg.id } });
      if (error || data?.error) throw new Error(error?.message || data?.error || 'Não foi possível iniciar o pagamento.');
      if (data?.checkout_url) window.location.href = data.checkout_url;
      else throw new Error('URL de checkout não recebida.');
    } catch (err: any) {
      toast.error(`Falha: ${err.message}`);
    } finally {
      setIsPurchasingId(null);
    }
  };

  // Google Play (TWA)
const handleGooglePlayPurchase = async (pkg: PackageType) => {
  if (!profile) { toast.info('Você precisa estar logado para comprar.'); navigate('/login'); return; }
  if (!isTwaMode) { toast.error('Este fluxo só funciona dentro do app da Play.'); return; }

  setIsPurchasingId(pkg.id);
  try {
    const purchaseToken = await googlePlayPurchase(pkg.id);

    // Se cancelou, o hook define playError. Evita "token não retornado".
    if (!purchaseToken) {
      if (playError && playError.toLowerCase().includes('cancelada')) {
        toast.info('Compra cancelada — sem problemas.');
        return;
      }
      throw new Error('Token de compra não retornado.');
    }

    toast.success('Compra aprovada no Google Play. Validando e adicionando créditos...');
    const { data, error } = await supabase.functions.invoke('verify-play-purchase', {
      body: { sku: pkg.id, purchaseToken },
    });
    if (error || data?.error) throw new Error(error?.message || data?.error || 'Falha na validação do token.');
    toast.success('Créditos adicionados com sucesso!');
  } catch (err: any) {
    toast.error(`Falha na compra: ${err.message}`);
  } finally {
    setIsPurchasingId(null);
  }
};


  const avulsoPackages = useMemo(() => displayPackages.filter(p => p.type === 'avulso').sort((a, b) => a.price - b.price), [displayPackages]);
  const mensalPackages = useMemo(() => displayPackages.filter(p => p.type === 'mensal').sort((a, b) => a.price - b.price), [displayPackages]);
  const profissionalPackages = useMemo(() => displayPackages.filter(p => p.type === 'profissional').sort((a, b) => a.price - b.price), [displayPackages]);

  const getFirstAvailableTab = () => {
    if (avulsoPackages.length > 0) return 'avulso';
    if (!isTwaMode && mensalPackages.length > 0) return 'mensal';
    if (!isTwaMode && profissionalPackages.length > 0) return 'profissional';
    return isTwaMode ? 'avulso' : '';
  };
  const firstAvailableTab = getFirstAvailableTab();

  const finalLoading = loading || (isTwaMode && isPlayBillingLoading && displayPackages.length === 0);
  if (finalLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const showPlayBillingFallback =
    isTwaMode && !isPlayBillingLoading && !isPlayAvailable && displayPackages.length === 0;

  const renderPackageCard = (pkg: PackageType) => {
    const purchaseHandler = isTwaMode ? handleGooglePlayPurchase : handleStripePurchase;
    const currency = isTwaMode ? playMetaRef.current[pkg.id]?.currency : 'BRL';
    const finalPriceLabel = formatCurrency(pkg.price, currency);
    const pricePerImage = pkg.images > 0 ? (pkg.price / pkg.images) : 0;
    const pricePerImageLabel = formatCurrency(pricePerImage, currency);

    return (
      <Card key={pkg.id} className={`relative text-left p-8 flex flex-col items-center text-center ${pkg.is_most_popular ? 'border-2 border-primary shadow-lg' : ''}`}>
        {pkg.is_most_popular && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <Badge className="bg-primary text-white py-1 px-3">Mais Popular</Badge>
          </div>
        )}
        <div className="mb-4">{getIcon(pkg.type)}</div>
        <h3 className="text-xl font-bold mb-1">{pkg.name}</h3>
        <p className="text-sm text-gray-600 mb-4">{pkg.images} imagens {pkg.type !== 'avulso' ? 'por mês' : ''}</p>
        <p className="text-4xl font-bold text-primary mb-1">{finalPriceLabel}</p>
        <p className="text-sm text-gray-600 mb-6">({pricePerImageLabel} por imagem)</p>
        <ul className="space-y-3 text-sm text-gray-800 text-left w-full mb-8 flex-grow">
          {pkg.description?.split('\n').map((item, index) => (
            <li key={index} className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <Button onClick={() => purchaseHandler(pkg)} className="w-full bg-gradient-pricing text-white" disabled={isPurchasingId === pkg.id}>
          {isTwaMode ? (isPurchasingId === pkg.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'COMPRAR NO GOOGLE PLAY')
                    : (isPurchasingId === pkg.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'COMPRAR (STRIPE)')}
        </Button>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl font-bold mb-4">Escolha o pacote ideal para você</h1>
        <p className="text-lg text-gray-600 mb-6">Preços justos para qualquer necessidade.</p>

        {/* DEBUG TEMPORÁRIO — sempre visível */}
        {SHOW_DEBUG && (
          <div className="max-w-3xl mx-auto mb-8 p-3 text-left text-xs rounded border bg-slate-50">
            <div><b>isTwaMode:</b> {String(isTwaMode)}</div>
            <div><b>isPlayBillingLoading:</b> {String(isPlayBillingLoading)}</div>
            <div><b>isPlayAvailable:</b> {String(isPlayAvailable)}</div>
            <div><b>hasDG:</b> {String(typeof (window as any).getDigitalGoodsService === 'function')}</div>
            <div><b>UserAgent:</b> {navigator.userAgent}</div>
            {playError && <div className="text-red-600 mt-1"><b>playError:</b> {playError}</div>}
            {playStoreService === null && <div className="mt-1 opacity-70">(service: null — lazy init)</div>}
          </div>
        )}

        {showPlayBillingFallback && (
          <div className="max-w-xl mx-auto mb-10 p-4 rounded-lg border bg-amber-50 text-amber-900">
            <p className="text-sm">Pagamentos do Google Play não estão disponíveis neste dispositivo/ambiente.</p>
            {playError && <p className="text-xs mt-2 opacity-80">Detalhe técnico: {playError}</p>}
          </div>
        )}

        {firstAvailableTab ? (
          <Tabs defaultValue={firstAvailableTab} className="w-full">
            <TabsList className="mx-auto mb-8">
              {avulsoPackages.length > 0 && <TabsTrigger value="avulso">Pacotes Avulsos</TabsTrigger>}
              {!isTwaMode && mensalPackages.length > 0 && <TabsTrigger value="mensal">Planos Mensais</TabsTrigger>}
              {!isTwaMode && profissionalPackages.length > 0 && <TabsTrigger value="profissional">Planos Profissionais</TabsTrigger>}
            </TabsList>

            <TabsContent value="avulso">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {avulsoPackages.map(renderPackageCard)}
              </div>
            </TabsContent>

            {!isTwaMode && (
              <>
                <TabsContent value="mensal">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    {mensalPackages.map(renderPackageCard)}
                  </div>
                </TabsContent>

                <TabsContent value="profissional">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
                    {profissionalPackages.map(renderPackageCard)}
                  </div>
                </TabsContent>
              </>
            )}
          </Tabs>
        ) : (
          <p className="text-gray-600 col-span-3 text-center py-10">Nenhum pacote disponível no momento.</p>
        )}
      </div>
      <Footer />
    </div>
  );
}

