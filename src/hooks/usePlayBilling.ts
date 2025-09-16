// src/hooks/usePlayBilling.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    getDigitalGoodsService?: (method: "https://play.google.com/billing") => Promise<any>;
    PaymentRequest?: any;
  }
}

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

export function usePlayBilling(opts: UsePlayBillingOpts = {}) {
  const { productIds = [], forceStatic = false, currency = "BRL" } = opts;

  const [products, setProducts] = useState<PlayProduct[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const forceStaticRef = useRef<boolean>(forceStatic);
  forceStaticRef.current = forceStatic;

  const playStoreServiceRef = useRef<any | null>(null);

  const debug = useMemo(() => ({ FORCE_PLAY_STATIC: forceStaticRef.current }), [forceStatic]);

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
            if (!cancelled) {
              playStoreServiceRef.current = dg;
              console.debug("[usePlayBilling] DigitalGoodsService conectado");
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

    return () => { cancelled = true; };
  }, []);

  const loadProducts = useCallback(async (ids: string[] = []) => {
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

      // tenta reconectar defensivamente
      const w = window as any;
      if (!playStoreServiceRef.current && typeof w.getDigitalGoodsService === "function") {
        try {
          playStoreServiceRef.current = await w.getDigitalGoodsService("https://play.google.com/billing");
        } catch (err) {
          console.debug("[usePlayBilling] Reconexão DigitalGoods falhou", err);
        }
      }

      const service = playStoreServiceRef.current;
      if (!service || typeof service.getDetails !== "function") {
        throw new Error("DigitalGoodsService indisponível ou sem getDetails()");
      }

      const skuIds = Array.isArray(ids) && ids.length > 0 ? ids : productIds;
      const details: PlayProduct[] = await service.getDetails(skuIds);
      setProducts(details ?? []);
      return details ?? [];
    } catch (e: any) {
      console.error("[usePlayBilling] loadProducts error:", e);
      setError(String(e?.message ?? e));
      setProducts([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [currency, productIds]);

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

  // purchase agora retorna { ok, purchaseToken?, message? }
  const purchase = useCallback(async (sku: string, opts?: { staticSku?: string }) => {
    setError(null);
    setIsLoading(true);
    try {
      const w = window as any;
      const effectiveSku = forceStaticRef.current ? (opts?.staticSku ?? "android.test.purchased") : sku;

      if (forceStaticRef.current) {
        // Simula token para testes locais
        const fakeToken = `FAKE_PURCHASE_TOKEN_${Date.now()}`;
        console.debug("[usePlayBilling] Simulando compra (forceStatic)", effectiveSku, fakeToken);
        return { ok: true, purchaseToken: fakeToken };
      }

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

      const details: PaymentDetailsInit = { total: { label: "Total", amount: { currency, value: "0" } } };
      const request = new (w.PaymentRequest as any)(methodData, details);

      try { await request.canMakePayment?.(); } catch { /* não fatal */ }

      const response = await request.show();

      // Tente extrair token se existir na resposta
      let purchaseToken: string | undefined = undefined;
      try {
        // Alguns hosts podem devolver dados úteis em response.details
        if (response?.details) {
          // heurística: verificar campos comuns
          purchaseToken = response.details?.purchaseToken || response.details?.token || response.details?.purchase_token;
        }
      } catch { /* noop */ }

      try { await response.complete?.("success"); } catch { /* noop */ }

      console.debug("[usePlayBilling] PaymentRequest finalizado", { purchaseToken });
      return { ok: true, purchaseToken };
    } catch (e: any) {
      console.error("[usePlayBilling] purchase error:", e);
      if (e?.name === "AbortError") {
        setError("Payment app returned RESULT_CANCELED / AbortError");
        return { ok: false, message: "cancelada" };
      } else {
        setError(String(e?.message ?? e));
        return { ok: false, message: String(e?.message ?? e) };
      }
    } finally {
      setIsLoading(false);
    }
  }, [currency]);

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

