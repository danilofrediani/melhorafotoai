// src/hooks/usePlayBilling.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    getDigitalGoodsService?: (method: "https://play.google.com/billing") => Promise<DigitalGoodsService>;
    PaymentRequest?: any;
  }
}

type DigitalGoodsService = {
  getDetails: (skus: string[]) => Promise<PlayProduct[]>;
  listPurchases?: () => Promise<any>;
};

export type PlayMoney = { value: string; currency: string };
export type PlayProduct = { itemId: string; title?: string; price?: PlayMoney };

export type UsePlayBillingOpts = {
  productIds?: string[];
  forceStatic?: boolean;
  currency?: string;
};

export type PurchaseResult = { ok: boolean; purchaseToken?: string };

export function usePlayBilling(opts: UsePlayBillingOpts = {}) {
  const { productIds = [], forceStatic = false, currency = "BRL" } = opts;

  const [products, setProducts] = useState<PlayProduct[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const forceStaticRef = useRef<boolean>(forceStatic);
  forceStaticRef.current = forceStatic;

  const playStoreServiceRef = useRef<DigitalGoodsService | null>(null);

  const debug = useMemo(() => ({ FORCE_PLAY_STATIC: forceStaticRef.current }), [forceStatic]);

  // Detecta PaymentRequest / DigitalGoods e conecta o serviço (se houver)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError(null);
      try {
        const w = window as any;
        const hasPR = typeof w.PaymentRequest === "function";
        const hasDG = typeof w.getDigitalGoodsService === "function";
        setIsAvailable(Boolean(hasPR || hasDG));

        if (hasDG && !forceStaticRef.current) {
          try {
            const dg = await w.getDigitalGoodsService("https://play.google.com/billing");
            if (!cancelled) playStoreServiceRef.current = dg;
          } catch {
            if (!cancelled) playStoreServiceRef.current = null;
          }
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadProducts = useCallback(async (ids: string[]) => {
    setError(null);
    setIsLoading(true);
    try {
      if (forceStaticRef.current) {
        const staticProducts: PlayProduct[] = [
          { itemId: "android.test.purchased", title: "Teste - Purchased", price: { value: "0", currency } },
          { itemId: "android.test.canceled", title: "Teste - Canceled", price: { value: "0", currency } },
          { itemId: "android.test.item_unavailable", title: "Teste - Unavailable", price: { value: "0", currency } },
        ];
        setProducts(staticProducts);
        return staticProducts;
      }

      const w = window as any;
      if (!playStoreServiceRef.current && typeof w.getDigitalGoodsService === "function") {
        try {
          playStoreServiceRef.current = await w.getDigitalGoodsService("https://play.google.com/billing");
        } catch {/* noop */}
      }

      const service = playStoreServiceRef.current;
      if (!service || typeof service.getDetails !== "function") {
        throw new Error("DigitalGoodsService indisponível ou sem getDetails()");
      }

      const skuIds = Array.isArray(ids) ? ids : [];
      const details: PlayProduct[] = await service.getDetails(skuIds);
      setProducts(details ?? []);
      return details ?? [];
    } catch (e: any) {
      setError(String(e?.message ?? e));
      setProducts([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [currency]);

  const listPurchases = useCallback(async () => {
    try {
      const service = playStoreServiceRef.current;
      if (!service || typeof service.listPurchases !== "function") return null;
      const res = await service.listPurchases();
      return res;
    } catch {
      return null;
    }
  }, []);

  const purchase = useCallback(
    async (sku: string): Promise<PurchaseResult> => {
      setError(null);
      setIsLoading(true);
      try {
        const w = window as any;
        if (typeof w.PaymentRequest !== "function") throw new Error("PaymentRequest indisponível");

        const effectiveSku = forceStaticRef.current ? "android.test.purchased" : sku;

        const methodData = [
          { supportedMethods: "https://play.google.com/billing", data: { sku: effectiveSku, productId: effectiveSku, type: "inapp" } },
        ];
        const details: any = { total: { label: "Total", amount: { currency, value: "0" } } };

        const request = new (w.PaymentRequest as any)(methodData, details);
        try { await request.canMakePayment?.(); } catch {/* não fatal */}
        const response = await request.show();
        try { await response.complete?.("success"); } catch {/* noop */}

        // Tentar obter o purchaseToken pela DigitalGoods API
        let purchaseToken: string | undefined;
        const service = playStoreServiceRef.current;

        if (service && typeof (service as any).listPurchases === "function") {
          // tentar algumas vezes, pois o token pode demorar a aparecer
          for (let i = 0; i < 6 && !purchaseToken; i++) {
            try {
              const lp = await (service as any).listPurchases();
              const list = Array.isArray(lp) ? lp : (lp?.purchases ?? []);
              const found = list?.find?.((it: any) => it.itemId === sku || it.productId === sku);
              purchaseToken = found?.purchaseToken ?? found?.token;
            } catch {/* noop */}
            if (!purchaseToken) await new Promise(r => setTimeout(r, 400));
          }
        }

        if (!purchaseToken && !forceStaticRef.current) {
          // sem token não dá pra validar no backend
          return { ok: false };
        }

        // em modo estático, devolvemos um token fake só pra testes locais
        if (!purchaseToken && forceStaticRef.current) {
          purchaseToken = `FAKE_PR_${Date.now()}`;
        }

        return { ok: true, purchaseToken };
      } catch (e: any) {
        if (e?.name === "AbortError") setError("Payment app returned RESULT_CANCELED / AbortError");
        else setError(String(e?.message ?? e));
        return { ok: false };
      } finally {
        setIsLoading(false);
      }
    },
    [currency]
  );

  const playStoreService = playStoreServiceRef.current;

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

