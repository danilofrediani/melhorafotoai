// src/hooks/usePlayBilling.ts
import { useCallback, useEffect, useRef, useState } from 'react';

type DGPrice = { value: string; currency: string };
type DGDetail = { itemId: string; title?: string; price?: DGPrice; description?: string };
type DGPurchase = { itemId: string; purchaseToken: string; state?: string };

export type PlayProduct = {
  itemId: string;
  title: string;
  price: DGPrice;
  description?: string;
};

type HookReturn = {
  playStoreService: any | null;
  products: PlayProduct[];
  loadProducts: (skus: string[]) => Promise<void>;
  purchase: (sku: string) => Promise<string | null>;
  isLoading: boolean;
  isAvailable: boolean;
  error: string | null;
};

const PLAY_METHOD = 'https://play.google.com/billing';

// Atalho de console com prefixo
const log = (...args: any[]) => console.log('[DG]', ...args);
const logPR = (...args: any[]) => console.log('[PR]', ...args);

// ⚠️ Durante os testes, podemos consumir automaticamente uma compra antiga do mesmo SKU
// para evitar o erro “item already owned”. Em produção, isso deve ser feito só
// após validação/entrega no backend.
const DEBUG_AUTOCONSUME = true;

export default function usePlayBilling(isTwa: boolean): HookReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<PlayProduct[]>([]);
  const serviceRef = useRef<any | null>(null);

  // Init básico
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setError(null);
        if (!isTwa) { setIsAvailable(false); return; }

        const hasDG = typeof (window as any).getDigitalGoodsService === 'function';
        const hasPR = typeof (window as any).PaymentRequest === 'function';
        log('env', { isTwa, hasDG, hasPR });

        if (!hasDG || !hasPR) { setIsAvailable(false); return; }

        if (!serviceRef.current) {
          try {
            const svc = await (window as any).getDigitalGoodsService(PLAY_METHOD);
            log('getDigitalGoodsService =>', !!svc);
            if (!cancelled) serviceRef.current = svc ?? null;
          } catch (e: any) {
            log('getDigitalGoodsService error', e?.name, e?.message);
          }
        }
        if (!cancelled) setIsAvailable(true);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? 'Falha ao inicializar Play Billing');
          setIsAvailable(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [isTwa]);

  const ensureService = useCallback(async () => {
    if (serviceRef.current) return serviceRef.current;
    const svc = await (window as any).getDigitalGoodsService(PLAY_METHOD);
    serviceRef.current = svc ?? null;
    return serviceRef.current;
  }, []);

  const loadProducts = useCallback(async (skus: string[]) => {
    if (!isTwa) return;
    setIsLoading(true);
    setError(null);
    try {
      const svc = await ensureService();
      if (!svc) throw new Error('Serviço do Google Play indisponível.');

      const details: DGDetail[] = await svc.getDetails(skus);
      log('getDetails', details);

      const normalized: PlayProduct[] = (details || []).map((d) => ({
        itemId: d.itemId,
        title: (d.title || d.itemId).replace(/\s*\(.*?\)\s*$/, ''),
        price: d.price ?? { value: '0', currency: 'BRL' },
        description: d.description,
      }));
      setProducts(normalized);
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível carregar os produtos.');
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [ensureService, isTwa]);

  // Pré-voo: checa capacidade, instrumento e compras existentes
  const preflight = useCallback(async (request: any, sku: string, svc: any) => {
    try {
      if (typeof request.canMakePayment === 'function') {
        const can = await request.canMakePayment();
        logPR('canMakePayment =>', can);
        if (!can) throw new Error('clientAppUnavailable');
      }
      if (typeof request.hasEnrolledInstrument === 'function') {
        try {
          const has = await request.hasEnrolledInstrument();
          logPR('hasEnrolledInstrument =>', has);
          // Se false, normalmente o Play fecha o fluxo ou mostra método de teste só se a conta for testadora
        } catch (e: any) {
          logPR('hasEnrolledInstrument error =>', e?.name, e?.message);
        }
      }
    } catch (e: any) {
      throw e; // propaga para exibirmos no playError
    }

    // Lista compras existentes (pode estar “PURCHASED” não consumida)
    try {
      const purchases: DGPurchase[] = await svc.listPurchases();
      log('listPurchases (before)', purchases);

      const sameSku = purchases?.filter(p => p.itemId === sku) || [];
      if (sameSku.length) {
        log('existing purchases for sku', sku, sameSku);
        // Para testes, consome automaticamente para liberar nova compra
        if (DEBUG_AUTOCONSUME) {
          for (const p of sameSku) {
            if (p.purchaseToken) {
              try {
                log('consume start', p.purchaseToken);
                await svc.consume(p.purchaseToken);
                log('consume ok', p.purchaseToken);
              } catch (e: any) {
                log('consume error', e?.name, e?.message);
              }
            }
          }
        }
      }
    } catch (e: any) {
      log('listPurchases error', e?.name, e?.message);
    }
  }, []);

  const purchase = useCallback(async (sku: string) => {
    setError(null);
    try {
      if (!isTwa) throw new Error('Compra disponível apenas dentro do app da Play.');
      if (!isAvailable) throw new Error('Play Billing indisponível neste dispositivo.');

      const svc = await ensureService();
      if (!svc) throw new Error('Serviço do Google Play indisponível.');

      // Busca detail para preencher total (alguns aparelhos exigem fields válidos)
      let price: DGPrice = { value: '0', currency: 'BRL' };
      let title = sku;
      try {
        const [detail] = await svc.getDetails([sku]);
        if (detail?.price?.value) price = detail.price!;
        if (detail?.title) title = (detail.title as string).replace(/\s*\(.*?\)\s*$/, '');
      } catch {/* segue */}

      const method: PaymentMethodData = {
        supportedMethods: PLAY_METHOD,
        data: { sku },
      } as any;

      const details: PaymentDetailsInit = {
        total: { label: title, amount: { currency: price.currency || 'BRL', value: String(price.value || '0') } },
      };

      const request = new (window as any).PaymentRequest([method], details);

      // Pré-voo (capacidade, instrumento e compras existentes)
      await preflight(request, sku, svc);

      // Abre o sheet
      let response: PaymentResponse | null = null;
      try {
        response = await request.show();
      } catch (err: any) {
        // Aqui pegamos a causa real do fechamento
        const name = err?.name || 'AbortError';
        const msg = err?.message || String(err);
        setError(`${name}: ${msg}`);
        logPR('show() error =>', name, msg, err);
        return null;
      }

      // Extrai token
      try {
        try {
          logPR('details =', JSON.stringify((response as any)?.details || {}));
        } catch {
          logPR('details (raw) =', (response as any)?.details);
        }
        const d: any = (response as any)?.details || {};
        const token =
          d.purchaseToken ||
          d.token ||
          d.purchase_token ||
          d.purchase?.purchaseToken ||
          null;

        await response.complete('success');
        if (!token) {
          setError('Token de compra não retornado.');
          return null;
        }
        return String(token);
      } catch (err: any) {
        setError(err?.message ?? 'Falha ao finalizar a compra.');
        return null;
      }
    } catch (err: any) {
      setError(err?.message ?? 'Ocorreu um erro durante a compra.');
      return null;
    }
  }, [ensureService, isAvailable, isTwa, preflight]);

  return {
    playStoreService: serviceRef.current,
    products,
    loadProducts,
    purchase,
    isLoading,
    isAvailable,
    error,
  };
}

