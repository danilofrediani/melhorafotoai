// src/hooks/usePlayBilling.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type PlayPrice = { value: string; currency: string };
export type PlayProduct = {
  itemId: string;        // SKU do Play (ex.: credits_10)
  title: string;         // Título configurado no Play
  price: PlayPrice;      // valor+moeda (string)
};

type UsePlayBillingReturn = {
  playStoreService: any | null;
  products: PlayProduct[];
  loadProducts: (ids: string[]) => Promise<void>;
  purchase: (sku: string) => Promise<void>;
  listPurchases: () => Promise<any[]>;
  isLoading: boolean;
  isAvailable: boolean;
  error: string | null;
};

function usePlayBilling(isEnabled: boolean): UsePlayBillingReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<PlayProduct[]>([]);
  const dgRef = useRef<any | null>(null);

  // Inicializa Digital Goods Service (somente se habilitado/TWA)
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (!isEnabled) {
        setIsAvailable(false);
        dgRef.current = null;
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const svc = await (window as any).getDigitalGoodsService?.('https://play.google.com/billing');
        if (!svc) throw new Error('DigitalGoodsService indisponível');
        if (cancelled) return;
        dgRef.current = svc;
        setIsAvailable(true);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || String(e));
          setIsAvailable(false);
          dgRef.current = null;
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    init();
    return () => { cancelled = true; };
  }, [isEnabled]);

  const loadProducts = useCallback(async (ids: string[]) => {
    if (!dgRef.current) return;
    setIsLoading(true);
    setError(null);
    try {
      console.debug('TwaBilling.DG: Calling getDetails for', ids.join(', '));
      const details = await dgRef.current.getDetails({ itemIds: ids });
      console.debug('TwaBilling.DG: GetDetails returned:', 0);
      const mapped: PlayProduct[] = (details || []).map((d: any) => ({
        itemId: d.itemId,
        title: d.title ?? d.itemId,
        price: {
          value: String(d.price?.value ?? '0'),
          currency: d.price?.currency ?? 'BRL',
        },
      }));
      setProducts(mapped);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const listPurchases = useCallback(async () => {
    if (!dgRef.current) return [];
    try {
      console.debug('TwaBilling.DG: Calling listPurchases');
      const res = await dgRef.current.listPurchases();
      console.debug('TwaBilling.DG: ListPurchases returned:', 0);
      return res || [];
    } catch (e) {
      console.error('TwaBilling.DG: listPurchases error', e);
      return [];
    }
  }, []);

  const purchase = useCallback(async (sku: string) => {
    setError(null);
    try {
      // Payment Request via método do Play
      const methodData = [{
        supportedMethods: 'https://play.google.com/billing',
        data: { sku },
      }];
      // Detalhes "dummy" — o Play ignora total; o SKU decide tudo.
      const details = {
        total: { label: 'Total', amount: { currency: 'BRL', value: '0.00' } },
      };
      const pr = new (window as any).PaymentRequest(methodData, details);

      const canPay = await pr.canMakePayment?.().catch(() => true);
      if (canPay === false) {
        throw new Error('Pagamento não disponível neste dispositivo');
      }

      console.debug('TwaBilling.P: Payment flow launch');
      const resp = await pr.show(); // Abre sheet Play
      await resp?.complete?.('success'); // Sinaliza conclusão para o browser
    } catch (e: any) {
      // Exemplo de erro comum: “Play Billing returned did not find SKU.”
      if (e && e.message) {
        console.warn('PaymentRequest error:', e.message);
      }
      throw e;
    }
  }, []);

  return useMemo(() => ({
    playStoreService: dgRef.current,
    products,
    loadProducts,
    purchase,
    listPurchases,
    isLoading,
    isAvailable,
    error,
  }), [products, loadProducts, purchase, listPurchases, isLoading, isAvailable, error]);
}

export { usePlayBilling };
export default usePlayBilling;
export type { UsePlayBillingReturn };

