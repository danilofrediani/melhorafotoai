import { useCallback, useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    // API do TWA
    getDigitalGoodsService?: (method: "https://play.google.com/billing") => Promise<{
      getDetails: (skus: string[]) => Promise<PlayProduct[]>;
      listPurchases: () => Promise<any>;
    }>;
  }
}

export type PlayMoney = { value: string; currency: string };
export type PlayProduct = {
  itemId: string; // SKU/PRODUCT ID no Play Console
  title?: string;
  price?: PlayMoney;
};

type UsePlayBillingOpts = {
  /** lista de SKUs reais do Play Console. */
  productIds?: string[];
  /** força usar SKUs estáticos de teste (android.test.*) */
  forceStatic?: boolean;
  /** moeda pra montar o PaymentRequest quando estático */
  currency?: string;
};

export function usePlayBilling(opts: UsePlayBillingOpts = {}) {
  const {
    productIds = [],
    forceStatic = false,
    currency = "BRL",
  } = opts;

  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<PlayProduct[]>([]);
  const [error, setError] = useState<string | null>(null);

  const forceStaticRef = useRef(forceStatic);
  forceStaticRef.current = forceStatic;

  const debug = useMemo(
    () => ({
      FORCE_PLAY_STATIC: forceStaticRef.current,
    }),
    [forceStatic]
  );

  // Descobre se temos PaymentRequest e/ou DigitalGoods.
  useEffect(() => {
    const w = window as any;
    const hasPR = typeof w.PaymentRequest === "function";
    const hasDG = typeof w.getDigitalGoodsService === "function";
    setAvailable(Boolean(hasPR || hasDG));
  }, []);

  // Carrega detalhes dos produtos quando NÃO está forçando estático
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      try {
        if (forceStaticRef.current) {
          // modo estático -> não chama getDetails
          setProducts([
            { itemId: "android.test.purchased", title: "Teste - Purchased", price: { value: "0", currency } },
            { itemId: "android.test.canceled", title: "Teste - Canceled", price: { value: "0", currency } },
            { itemId: "android.test.item_unavailable", title: "Teste - Unavailable", price: { value: "0", currency } },
          ]);
          return;
        }

        const w = window as any;
        if (typeof w.getDigitalGoodsService !== "function") {
          throw new Error("DigitalGoodsService indisponível");
        }

        const dg = await w.getDigitalGoodsService("https://play.google.com/billing");

        // >>> AQUI estava o erro: getDetails espera **array** iterável de strings
        const ids: string[] = Array.isArray(productIds) ? productIds : [];
        const details: PlayProduct[] = await dg.getDetails(ids);

        if (!cancelled) setProducts(details ?? []);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [productIds, currency]);

  /**
   * Inicia a compra.
   * - Em modo estático, ignora o sku recebido e usa 'android.test.purchased' (ou o override).
   * - Em modo normal, usa o sku real que veio do Play Console.
   */
  const buy = useCallback(
    async (sku: string, opts?: { staticSku?: "android.test.purchased" | "android.test.canceled" | "android.test.item_unavailable" }) => {
      setError(null);

      try {
        const w = window as any;
        if (typeof w.PaymentRequest !== "function") {
          throw new Error("PaymentRequest indisponível");
        }

        const staticSku = opts?.staticSku ?? "android.test.purchased";
        const effectiveSku = forceStaticRef.current ? staticSku : sku;

        const methodData = [
          {
            supportedMethods: "https://play.google.com/billing",
            data: {
              // Esses campos são aceitos pela ponte do TWA
              sku: effectiveSku,
              productId: effectiveSku,
              type: "inapp", // managed in-app
            },
          },
        ];

        // Valor aqui é ignorado pelo app store (mas PR exige um total)
        const details: PaymentDetailsInit = {
          total: {
            label: "Total",
            amount: { currency, value: "0" },
          },
        };

        const request = new (w.PaymentRequest as any)(methodData, details);

        // isso ajuda a falhar rápido quando não dá pra pagar
        try {
          await request.canMakePayment?.();
        } catch {
          // canMakePayment pode lançar; não é fatal
        }

        const response = await request.show();
        try {
          await response.complete?.("success");
        } catch {
          /* noop */
        }

        // A resposta do Play Billing via TWA nem sempre traz token.
        // Aqui retornamos true se não explodiu.
        return true;
      } catch (e: any) {
        // Tratamento bonito pra AbortError/RESULT_CANCELED
        const msg = e?.message || e?.toString?.() || String(e);
        if (e?.name === "AbortError") {
          setError("Payment app returned RESULT_CANCELED code. This is how payment apps can close their activity programmatically.");
        } else {
          setError(msg);
        }
        return false;
      }
    },
    [currency]
  );

  return {
    available,
    loading,
    products,
    error,
    buy,
    debug,
  };
}

export default usePlayBilling;

