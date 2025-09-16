// src/hooks/usePlayBilling.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Hook compatível com a API usada em Pricing.tsx:
 *  - exporta: playStoreService, products, loadProducts, purchase, listPurchases, isLoading, isAvailable, error, debug
 *
 * Suporta ser chamado de duas formas (compatibilidade):
 *  1) usePlayBilling(isTwaMode: boolean, opts: UsePlayBillingOpts)
 *  2) usePlayBilling(opts: UsePlayBillingOpts)  <-- esta é a forma usada em Pricing.tsx no seu projeto
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
  // outros métodos podem existir dependendo do ambiente
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

type PurchaseResult = { ok: boolean; purchaseToken?: string | undefined };

/**
 * função compatível com as duas chamadas:
 * - (isTwaMode: boolean, opts)
 * - (opts)
 */
export function usePlayBilling(arg?: boolean | UsePlayBillingOpts, maybeOpts: UsePlayBillingOpts = {}) {
  // detectar qual forma foi usada
  let isTwaMode = false;
  let opts: UsePlayBillingOpts = {};

  if (typeof arg === "boolean") {
    isTwaMode = arg;
    opts = maybeOpts;
  } else {
    opts = arg ?? {};
    // se o chamador não informou isTwaMode, tentamos inferir mais tarde no componente
    isTwaMode = false;
  }

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
      isTwaMode,
    }),
    [isTwaMode]
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

        // reconectar defensivamente se necessário
        const w = window as any;
        if (!playStoreServiceRef.current && typeof w.getDigitalGoodsService === "function") {
          try {
            const newDg = await w.getDigitalGoodsService("https://play.google.com/billing");
            playStoreServiceRef.current = newDg;
          } catch (err) {
            console.debug("[usePlayBilling] Reconexão DigitalGoods falhou", err);
          }
        }

        const service = playStoreServiceRef.current;
        if (!service || typeof service.getDetails !== "function") {
          throw new Error("DigitalGoodsService indisponível ou sem getDetails()");
        }

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
  // Retorna: { ok: boolean, purchaseToken?: string }
  const purchase = useCallback(
    async (sku: string, opts?: { staticSku?: string }): Promise<PurchaseResult> => {
      setError(null);
      setIsLoading(true);

      try {
        const w = window as any;

        // Se for modo estático força sku estático
        const effectiveSku = forceStaticRef.current ? (opts?.staticSku ?? "android.test.purchased") : sku;

        // Se PaymentRequest indisponível, falhar claramente
        if (typeof w.PaymentRequest !== "function") {
          throw new Error("PaymentRequest indisponível");
        }

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
          // canMakePayment pode lançar em alguns ambientes; é aceitável continuar
          await request.canMakePayment?.();
        } catch {
          console.debug("[usePlayBilling] canMakePayment falhou/lançou (não fatal)");
        }

        // mostra UI de pagamento
        const response = await request.show();

        // tentar extrair token/purchaseToken de várias formas possíveis
        // (os ambientes Play/TWA podem retornar formatos diferentes)
        const detailsObj = response?.details ?? {};
        // tenta vários caminhos conhecidos
        const possibleToken =
          detailsObj.purchaseToken ||
          detailsObj.purchase_token ||
          detailsObj.paymentMethodData?.token ||
          detailsObj.paymentMethodData?.token?.paymentMethodToken ||
          detailsObj.token ||
          detailsObj.paymentToken ||
          // alguns ambientes colocam o token em requestId / purchaseData
          detailsObj.requestId ||
          detailsObj.purchaseData?.purchaseToken ||
          undefined;

        // se estamos em modo estático e nenhum token veio, geramos um token fake para testes locais
        if (forceStaticRef.current && !possibleToken) {
          const fake = `ANDROID_STATIC_TOKEN_${Date.now()}`;
          try { await response.complete?.("success").catch(()=>{}); } catch {}
          console.debug("[usePlayBilling] Modo estático -> gerando token fake", fake);
          return { ok: true, purchaseToken: fake };
        }

        // finalize a UI do payment
        try {
          await response.complete?.("success").catch(()=>{});
        } catch {
          // não fatal
        }

        // retorno normal
        console.debug("[usePlayBilling] PaymentRequest finalizado, possibleToken:", possibleToken ? String(possibleToken).slice(0,40) + "..." : "undefined");
        return { ok: true, purchaseToken: possibleToken };

      } catch (e: any) {
        console.error("[usePlayBilling] purchase error:", e);

        // lidar com AbortError (usuário cancelou)
        if (e?.name === "AbortError") {
          setError("Payment app returned RESULT_CANCELED / AbortError");
          return { ok: false };
        }

        setError(String(e?.message ?? e));
        return { ok: false };
      } finally {
        setIsLoading(false);
      }
    },
    [currency]
  );

  // expor a referência do serviço (compatibilidade com Pricing.tsx)
  const playStoreService = playStoreServiceRef.current;

  // não carrega automaticamente produtos aqui — quem chama decide
  useEffect(() => {}, []);

  return {
    playStoreService,
    products,
    loadProducts,
    purchase,
    listPurchases,
    isLoading,
    isAvailable,
    error,
    debug,
  };
}

export default usePlayBilling;

