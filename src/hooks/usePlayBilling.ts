import { useState, useEffect, useCallback } from 'react';

// --- Tipos para a Digital Goods API ---
// Estes tipos nos ajudam a ter autocomplete e segurança no código
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

// Declaração para o TypeScript saber que "getDigitalGoodsService" existe no window
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

  // Efeito para inicializar o serviço quando o hook é usado
  useEffect(() => {
    const initializeService = async () => {
      try {
        if (window.getDigitalGoodsService) {
          const service = await window.getDigitalGoodsService("https://play.google.com/billing");
          if (service) {
            setPlayStoreService(service);
          } else {
            // Isso acontece se o usuário não estiver no TWA (app Android)
            setError("Serviço de pagamento do Google Play não disponível.");
          }
        } else {
          setError("API de Bens Digitais não encontrada. Acesso via web?");
        }
      } catch (e) {
        console.error("Erro ao inicializar o serviço de pagamento:", e);
        setError("Falha ao conectar com o serviço de pagamento.");
      } finally {
        setIsLoading(false);
      }
    };

    initializeService();
  }, []);

  // Função para carregar os detalhes dos produtos que criamos no Play Console
  const loadProducts = useCallback(async (skus: string[]) => {
    if (!playStoreService) {
      console.log("Serviço não está pronto para carregar produtos.");
      return;
    }
    try {
      console.log("Buscando detalhes dos produtos:", skus);
      const details = await playStoreService.getDetails(skus);
      console.log("Produtos recebidos:", details);
      setProducts(details);
    } catch (e) {
      console.error("Erro ao carregar detalhes dos produtos:", e);
      setError("Não foi possível carregar os pacotes de créditos.");
    }
  }, [playStoreService]);
  
  // Função para iniciar o fluxo de compra
  const purchase = async (sku: string) => {
    if (!playStoreService) {
      throw new Error("Serviço de pagamento não inicializado.");
    }
    try {
      console.log("Iniciando compra para o SKU:", sku);
      // Aqui, a Digital Goods API chama a tela de pagamento do Google
      const result = await playStoreService.purchase({ itemId: sku });
      console.log("Compra realizada, token:", result.purchaseToken);
      
      // IMPORTANTE: Após a compra, precisamos validar este token no nosso back-end
      // e então "consumir" o produto para que ele possa ser comprado novamente.
      
      // Por enquanto, vamos apenas retornar o token
      return result.purchaseToken;

    } catch (e) {
      console.error("Erro durante a compra:", e);
      // O erro pode ser 'AbortError' se o usuário cancelar, o que é normal.
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
