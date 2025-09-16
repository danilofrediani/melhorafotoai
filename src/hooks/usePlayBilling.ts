import { useState, useEffect, useCallback } from 'react';

// --- Tipos para a Digital Goods API ---
interface DigitalGoodsService {
  getDetails(skus: string[]): Promise<PaymentItemDetails[]>;
  purchase(details: PurchaseDetails): Promise<PurchaseResponse>;
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
  purchaseToken?: string;
}
interface PurchaseResponse {
  purchaseToken: string;
}
declare global {
  interface Window {
    getDigitalGoodsService?: (serviceId: string) => Promise<DigitalGoodsService | null>;
  }
}
// --- Fim dos Tipos ---

const usePlayBilling = () => {
  const [playStoreService, setPlayStoreService] = useState<DigitalGoodsService | null>(null);
  const [products, setProducts] = useState<PaymentItemDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // disponível = conseguimos inicializar o serviço do Play
  const available = !!playStoreService;

  useEffect(() => {
    const initializeService = async () => {
      try {
        if (typeof window !== 'undefined' && window.getDigitalGoodsService) {
          const service = await window.getDigitalGoodsService("https://play.google.com/billing");
          if (service) setPlayStoreService(service);
        }
      } catch (e) {
        console.error("Erro ao inicializar o serviço de pagamento:", e);
        setError("Falha ao conectar com o serviço de pagamento.");
      } finally {
        setIsLoading(false); // sempre encerra o loading
      }
    };
    initializeService();
  }, []);

  const loadProducts = useCallback(async (skus: string[]) => {
    if (!playStoreService) return;
    try {
      const details = await playStoreService.getDetails(skus);
      setProducts(details);
    } catch (e) {
      console.error("Erro ao carregar detalhes dos produtos:", e);
      setError("Não foi possível carregar os pacotes de créditos.");
    }
  }, [playStoreService]);

  const purchase = async (sku: string) => {
    if (!playStoreService) throw new Error("Serviço de pagamento não inicializado.");
    try {
      const result = await playStoreService.purchase({ itemId: sku });
      return result.purchaseToken;
    } catch (e: any) {
      console.error("Erro durante a compra:", e);
      if (e?.name !== 'AbortError') setError("Ocorreu um erro durante a compra.");
      return null;
    }
  };

  return {
    available,          // << chave para o Pricing decidir Play vs Stripe
    playStoreService,
    products,
    isLoading,
    error,
    loadProducts,
    purchase,
  };
};

export default usePlayBilling;

