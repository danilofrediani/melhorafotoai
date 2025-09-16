// src/hooks/usePlayBilling.ts
import { useCallback, useEffect, useRef, useState } from 'react';

type DGPrice = { value: string; currency: string };
type DGDetail = {
  itemId: string;
  title: string;
  price?: DGPrice;
  description?: string;
};

export type PlayProduct = {
  itemId: string;
  title: string;
  price: DGPrice;
  description?: string;
};

type PurchaseFn = (sku: string) => Promise<string | null>;

type HookReturn = {
  playStoreService: any | null;
  products: PlayProduct[];
  loadProducts: (skus: string[]) => Promise<void>;
  purchase: PurchaseFn;
  isLoading: boolean;
  isAvailable: boolean;
  error: string | null;
};

const PLAY_METHOD = 'https://play.google.com/billing';

export default function usePlayBilling(isTwa: boolean): HookReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<PlayProduct[]>([]);
  const serviceRef = useRef<any | null>(null);

  // Descobre se o DigitalGoods + Payments estão mesmo prontos
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        if (!isTwa) {
          setIsAvailable(false);
          return;
        }
        const hasDG = typeof (window as any).getDigitalGoodsService === 'function';
        const hasPayments = typeof (window as any).PaymentRequest === 'function';
        if (!hasDG || !hasPayments) {
          setIsAvailable(false);
          return;
        }

        // Tenta inicializar cedo (lazy de qualquer forma)
        if (!serviceRef.current) {
          try {
            const svc = await (window as any).getDigitalGoodsService(PLAY_METHOD);
            if (!cancelled) serviceRef.current = svc ?? null;
          } catch {
            // ok, pode falhar aqui e funcionar no loadProducts
          }
        }
        if (!cancelled) setIsAvailable(true);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? 'Falha ao inicializar Play Billing');
          setIsAvailable(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isTwa]);

  const ensureService = useCallback(async () => {
    if (serviceRef.current) return serviceRef.current;
    const svc = await (window as any).getDigitalGoodsService(PLAY_METHOD);
    serviceRef.current = svc ?? null;
    return serviceRef.current;
  }, []);

  const loadProducts = useCallback(async (skus: string[]) => {
    if (!isTwa) return;
    setIsLoading(true);
    setError(null);
    try {
      const svc = await ensureService();
      if (!svc) throw new Error('Serviço do Google Play indisponível.');

      const details: DGDetail[] = await svc.getDetails(skus);
      const normalized: PlayProduct[] = (details || []).map((d) => ({
        itemId: d.itemId,
        // remove qualquer sufixo “(algo)” como “(unreviewed)” ou nome do app
        title: (d.title || d.itemId).replace(/\s*\(.*?\)\s*$/, ''),
        price: d.price ?? { value: '0', currency: 'BRL' },
        description: d.description,
      }));
      setProducts(normalized);
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível carregar os produtos.');
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [ensureService, isTwa]);

  const purchase: PurchaseFn = useCallback(async (sku: string) => {
    setError(null);
    try {
      if (!isTwa) throw new Error('Compra disponível apenas dentro do app da Play.');
      if (!isAvailable) throw new Error('Play Billing indisponível neste dispositivo.');

      const svc = await ensureService();
      if (!svc) throw new Error('Serviço do Google Play indisponível.');

      // Recupera detalhes para montar o "total" (alguns devices exigem)
      let price: DGPrice = { value: '0', currency: 'BRL' };
      let title = sku;
      try {
        const [detail] = await svc.getDetails([sku]);
        if (detail?.price?.value) price = detail.price!;
        if (detail?.title) title = detail.title.replace(/\s*\(.*?\)\s*$/, '');
      } catch {
        // segue com defaults
      }

      const method: PaymentMethodData = {
        supportedMethods: PLAY_METHOD,
        data: { sku },
      } as any;

      // Mesmo com Play Billing, alguns navegadores exigem "total"
      const details: PaymentDetailsInit = {
        total: {
          label: title,
          amount: { currency: price.currency || 'BRL', value: String(price.value || '0') },
        },
      };

      const request = new (window as any).PaymentRequest([method], details);
      // Sugestão: não usar canMakePayment() aqui — em TWA costuma ser true de qualquer forma

      let response: PaymentResponse | null = null;
      try {
        response = await request.show();
      } catch (err: any) {
        // Usuário pode ter cancelado o sheet
        if (err?.name === 'AbortError' || err?.name === 'NotAllowedError') {
          setError('Compra cancelada pelo usuário.');
          return null;
        }
        setError(err?.message ?? 'Falha ao abrir o pagamento.');
        return null;
      }

      try {
        // Alguns devices devolvem token em 'purchaseToken', outros podem usar 'token'
        const token = (response as any)?.details?.purchaseToken || (response as any)?.details?.token || null;
        await response.complete('success');
        if (!token) {
          setError('Token de compra não retornado.');
          return null;
        }
        return String(token);
      } catch (err: any) {
        setError(err?.message ?? 'Falha ao finalizar a compra.');
        return null;
      }
    } catch (err: any) {
      setError(err?.message ?? 'Ocorreu um erro durante a compra.');
      return null;
    }
  }, [ensureService, isAvailable, isTwa]);

  return {
    playStoreService: serviceRef.current,
    products,
    loadProducts,
    purchase,
    isLoading,
    isAvailable,
    error,
  };
}

