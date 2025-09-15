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

  // --- LÓGICA DE INICIALIZAÇÃO MODIFICADA (MAIS PACIENTE) ---
  useEffect(() => {
    // Tenta encontrar o serviço por 3 segundos antes de desistir.
    const maxRetries = 30; // 30 tentativas
    const retryDelay = 100; // a cada 100ms
    let attempt = 0;

    const intervalId = setInterval(async () => {
      attempt++;
      console.log(`Tentativa ${attempt} de encontrar o serviço de pagamento...`);

      if (window.getDigitalGoodsService) {
        clearInterval(intervalId); // Para de tentar assim que encontra
        console.log("Serviço encontrado! Inicializando...");
        try {
          const service = await window.getDigitalGoodsService("https://play.google.com/billing");
          if (service) {
            setPlayStoreService(service);
          } else {
            setError("Serviço de pagamento do Google Play não disponível.");
          }
        } catch (e) {
          console.error("Erro ao inicializar o serviço de pagamento:", e);
          setError("Falha ao conectar com o serviço de pagamento.");
        } finally {
          setIsLoading(false);
        }
        return;
      }
      
      if (attempt >= maxRetries) {
        clearInterval(intervalId); // Desiste após 3 segundos
        console.log("Serviço não encontrado após 3 segundos. Assumindo modo web.");
        setError("API de Bens Digitais não encontrada. Acesso via web?");
        setIsLoading(false);
      }
    }, retryDelay);

    // Limpa o intervalo se o componente for desmontado
    return () => clearInterval(intervalId);
  }, []);
  // --- FIM DA LÓGICA MODIFICADA ---


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
  
  const purchase = async (sku: string) => {
    if (!playStoreService) {
      throw new Error("Serviço de pagamento não inicializado.");
    }
    try {
      console.log("Iniciando compra para o SKU:", sku);
      const result = await playStoreService.purchase({ itemId: sku });
      console.log("Compra realizada, token:", result.purchaseToken);
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
