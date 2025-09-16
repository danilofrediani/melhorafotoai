// src/hooks/usePlayBilling.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Hook compatível com a API usada em Pricing.tsx:
 *  - exporta: playStoreService, products, loadProducts, purchase, listPurchases, isLoading, isAvailable, error, debug
 *
 * Mantém o modo estático (android.test.*) e o uso de PaymentRequest/DigitalGoods.
 */

declare global {
  interface Window {
    getDigitalGoodsService?: (method: "https://play.google.com/billing") => Promise<DigitalGoodsService>;
    PaymentRequest?: any;
  }
}

type DigitalGoodsService = {
  getDetails: (skus: string[]) => Promise<PlayProduct[]>;
  listPurchases?: () => Promise<any>;
  // pode ter outros métodos dependendo do ambiente
};

export type PlayMoney = { value: string; currency: string };
export type PlayProduct = {
  itemId: string;
  title?: string;
  price?: PlayMoney;
};

type UsePlayBillingOpts = {
  productIds?: string[];
  forceStatic?: boolean;
  currency?: string;
};

export function usePlayBilling(isTwaMode: boolean, opts: UsePlayBillingOpts = {}) {
  const { productIds = [], forceStatic = false, currency = "BRL" } = opts;

  // Estado público (nomes que Pricing espera)
  const [products, setProducts] = useState<PlayProduct[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Internos
  const forceStaticRef = useRef<boolean>(forceStatic);
  forceStaticRef.current = forceStatic;

  const playStoreServiceRef = useRef<DigitalGoodsService | null>(null);

  // debug object exposto
  const debug = useMemo(
    () => ({
      FORCE_PLAY_STATIC: forceStaticRef.current,
    }),
    [forceStatic]
  );

  // Detecta PaymentRequest / DigitalGoods (e inicializa a referência do serviço)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const w = window as any;
        const hasPR = typeof w.PaymentRequest === "function";
        const hasDG = typeof w.getDigitalGoodsService === "function";

        // sinaliza disponibilidade básica
        setIsAvailable(Boolean(hasPR || hasDG));

        // tenta obter a instância do serviço Digital Goods (se houver)
        if (hasDG && !forceStaticRef.current) {
          try {
            const dg = await w.getDigitalGoodsService("https://play.google.com/billing");
            if (!cancelled) {
              playStoreServiceRef.current = dg;
              console.debug("[usePlayBilling] DigitalGoodsService conectado", !!dg);
            }
          } catch (dgErr) {
            console.debug("[usePlayBilling] Falha ao conectar DigitalGoodsService", dgErr);
            if (!cancelled) playStoreServiceRef.current = null;
          }
        }
      } catch (e) {
        console.debug("[usePlayBilling] detection error", e);
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []); // rodar só uma vez

  // Função loadProducts (Pricing chama isso)
  const loadProducts = useCallback(
    async (ids: string[]) => {
      setError(null);
      setIsLoading(true);
      try {
        if (forceStaticRef.current) {
          // modo estático -> devolver itens de teste
          const staticProducts: PlayProduct[] = [
            { itemId: "android.test.purchased", title: "Teste - Purchased", price: { value: "0", currency } },
            { itemId: "android.test.canceled", title: "Teste - Canceled", price: { value: "0", currency } },
            { itemId: "android.test.item_unavailable", title: "Teste - Unavailable", price: { value: "0", currency } },
          ];
          setProducts(staticProducts);
          console.debug("[usePlayBilling] loadProducts -> modo estático, produtos locais montados");
          return staticProducts;
        }

        const dg = playStoreServiceRef.current;
        if (!dg) {
          const w = window as any;
          if (typeof w.getDigitalGoodsService === "function") {
            // tenta reconectar de forma defensiva
            try {
              const newDg = await w.getDigitalGoodsService("https://play.google.com/billing");
              playStoreServiceRef.current = newDg;
            } catch (err) {
              console.debug("[usePlayBilling] Reconexão DigitalGoods falhou", err);
            }
          }
        }

        const service = playStoreServiceRef.current;
        if (!service || typeof service.getDetails !== "function") {
          throw new Error("DigitalGoodsService indisponível ou sem getDetails()");
        }

        // garante array de ids
        const skuIds = Array.isArray(ids) ? ids : [];
        console.debug("[usePlayBilling] loadProducts -> solicitando getDetails", skuIds);
        const details: PlayProduct[] = await service.getDetails(skuIds);
        setProducts(details ?? []);
        console.debug("[usePlayBilling] getDetails retornou", details);
        return details ?? [];
      } catch (e: any) {
        console.error("[usePlayBilling] loadProducts error:", e);
        setError(String(e?.message ?? e));
        setProducts([]);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [currency]
  );

  // Função listPurchases (diagnóstico)
  const listPurchases = useCallback(async () => {
    try {
      const service = playStoreServiceRef.current;
      if (!service || typeof service.listPurchases !== "function") {
        console.debug("[usePlayBilling] listPurchases: não disponível no serviço");
        return null;
      }
      const res = await service.listPurchases();
      console.debug("[usePlayBilling] listPurchases:", res);
      return res;
    } catch (e) {
      console.error("[usePlayBilling] listPurchases error", e);
      return null;
    }
  }, []);

  // Função purchase (Pricing chama purchase(sku))
  const purchase = useCallback(
    async (sku: string, opts?: { staticSku?: string }) => {
      setError(null);
      setIsLoading(true);

      try {
        const w = window as any;
        if (typeof w.PaymentRequest !== "function") {
          throw new Error("PaymentRequest indisponível");
        }

        const effectiveSku = forceStaticRef.current ? opts?.staticSku ?? "android.test.purchased" : sku;

        const methodData = [
          {
            supportedMethods: "https://play.google.com/billing",
            data: {
              sku: effectiveSku,
              productId: effectiveSku,
              type: "inapp",
            },
          },
        ];

        const details: PaymentDetailsInit = {
          total: { label: "Total", amount: { currency, value: "0" } },
        };

        console.debug("[usePlayBilling] opening PaymentRequest for sku", effectiveSku);
        const request = new (w.PaymentRequest as any)(methodData, details);

        try {
          await request.canMakePayment?.();
        } catch {
          // canMakePayment pode falhar em alguns ambientes; não é fatal
          console.debug("[usePlayBilling] canMakePayment falhou/lançou (não fatal)");
        }

        const response = await request.show();
        try {
          await response.complete?.("success");
        } catch {
          // noop
        }

        // Observação: a resposta via TWA/DigitalGoods pode não retornar token aqui.
        // Retornamos true se não houve exceção (mantemos compatibilidade com o fluxo atual).
        console.debug("[usePlayBilling] PaymentRequest finalizado sem erro");
        return true;
      } catch (e: any) {
        console.error("[usePlayBilling] purchase error:", e);
        if (e?.name === "AbortError") {
          setError("Payment app returned RESULT_CANCELED / AbortError");
        } else {
          setError(String(e?.message ?? e));
        }
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [currency]
  );

  // Expor a referência do serviço (compatibilidade com Pricing.tsx)
  const playStoreService = playStoreServiceRef.current;

  // Quando o hook é inicializado, se productIds vierem por opts e o modo não for estático,
  // podemos carregar automaticamente (opcional). Aqui deixamos a decisão a quem chama (Pricing).
  useEffect(() => {
    // não carregamos automaticamente para não causar chamadas inesperadas em SSR/dev
  }, []);

  return {
    // nomes que Pricing.tsx espera
    playStoreService,
    products,
    loadProducts,
    purchase,
    listPurchases,
    isLoading,
    isAvailable,
    error,
    // extras
    debug,
  };
}

export default usePlayBilling;

