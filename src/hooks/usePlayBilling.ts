import { useState, useEffect, useCallback } from 'react';

// --- Tipos para a Digital Goods API (sem alteração) ---
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
  price: {
    currency: string;
    value: string;
  };
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
// --- Fim dos Tipos ---


const usePlayBilling = () => {
  const [playStoreService, setPlayStoreService] = useState<DigitalGoodsService | null>(null);
  const [products, setProducts] = useState<PaymentItemDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeService = async () => {
      // Agora, simplesmente tentamos inicializar. Sem polling.
      // Se 'getDigitalGoodsService' não existir, ele simplesmente não fará nada.
      if (window.getDigitalGoodsService) {
        try {
          const service = await window.getDigitalGoodsService("https://play.google.com/billing");
          setPlayStoreService(service);
        } catch (e) {
          console.error("Erro ao inicializar o serviço de pagamento:", e);
          setError("Falha ao conectar com o serviço de pagamento.");
        }
      }
      setIsLoading(false); // Sempre para de carregar, mesmo que o serviço não exista
    };

    initializeService();
  }, []);

  const loadProducts = useCallback(async (skus: string[]) => {
    if (!playStoreService) return; // Se não houver serviço, não faz nada
    try {
      const details = await playStoreService.getDetails(skus);
      setProducts(details);
    } catch (e) {
      console.error("Erro ao carregar detalhes dos produtos:", e);
      setError("Não foi possível carregar os pacotes de créditos.");
    }
  }, [playStoreService]);
  
  const purchase = async (sku: string) => {
    if (!playStoreService) {
      throw new Error("Serviço de pagamento não inicializado.");
    }
    try {
      const result = await playStoreService.purchase({ itemId: sku });
      return result.purchaseToken;
    } catch (e) {
      console.error("Erro durante a compra:", e);
      if ((e as Error).name !== 'AbortError') {
        setError("Ocorreu um erro durante a compra.");
      }
      return null;
    }
  };

  return {
    playStoreService,
    products,
    isLoading,
    error,
    loadProducts,
    purchase,
  };
};

export default usePlayBilling;
