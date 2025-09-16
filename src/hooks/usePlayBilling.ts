import { useState, useEffect, useCallback } from 'react';

/** Tipos da Digital Goods API (Web Play Billing) */
interface DigitalGoodsService {
  getDetails(skus: string[]): Promise<PaymentItemDetails[]>;
  purchase(details: { itemId: string }): Promise<PurchaseResponse>;
  consume(purchaseToken: string): Promise<void>;
  listPurchases(): Promise<PurchaseDetails[]>;
}
interface PaymentItemDetails {
  itemId: string;
  title: string;
  description: string;
  price: { currency: string; value: string };
}
interface PurchaseDetails {
  itemId: string;
  purchaseToken: string;
}
interface PurchaseResponse {
  purchaseToken: string;
}

declare global {
  interface Window {
    getDigitalGoodsService?: (serviceId: string) => Promise<DigitalGoodsService | null>;
  }
}

/**
 * Hook para Google Play Billing (Digital Goods API).
 * Só inicializa se `enabled === true` (ex.: quando estiver rodando em TWA).
 */
const usePlayBilling = (enabled: boolean = false) => {
  const [playStoreService, setPlayStoreService] = useState<DigitalGoodsService | null>(null);
  const [products, setProducts] = useState<PaymentItemDetails[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(!!enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!enabled) {
        setIsLoading(false);
        return;
      }

      // Precisa ser contexto seguro (https) e API presente
      const hasAPI = typeof window !== 'undefined' && !!window.getDigitalGoodsService;
      const isSecure = typeof window !== 'undefined' && (window.isSecureContext ?? location.protocol === 'https:');

      if (!hasAPI || !isSecure) {
        setIsLoading(false);
        return;
      }

      try {
        const svc = await window.getDigitalGoodsService!("https://play.google.com/billing");
        if (!cancelled && svc) setPlayStoreService(svc);
      } catch (e: any) {
        // Ex.: OperationError: unsupported context (fora do TWA)
        console.warn('Play Billing indisponível neste contexto:', e?.name || e);
        if (!cancelled) setError('Pagamento do Google Play indisponível neste dispositivo.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    init();
    return () => { cancelled = true; };
  }, [enabled]);

  const loadProducts = useCallback(async (skus: string[]) => {
    if (!playStoreService) return;
    try {
      const details = await playStoreService.getDetails(skus);
      setProducts(details);
    } catch (e) {
      console.error('Erro ao carregar produtos do Google Play:', e);
      setError('Não foi possível carregar os pacotes do Google Play.');
    }
  }, [playStoreService]);

  const purchase = useCallback(async (sku: string) => {
    if (!playStoreService) throw new Error('Serviço de pagamento não inicializado.');
    try {
      const result = await playStoreService.purchase({ itemId: sku });
      return result.purchaseToken;
    } catch (e: any) {
      console.error('Erro na compra (Google Play):', e);
      if (e?.name !== 'AbortError') setError('Ocorreu um erro durante a compra.');
      return null;
    }
  }, [playStoreService]);

  return {
    playStoreService,
    products,
    isLoading,
    error,
    isAvailable: !!playStoreService,
    loadProducts,
    purchase,
  };
};

export default usePlayBilling;

