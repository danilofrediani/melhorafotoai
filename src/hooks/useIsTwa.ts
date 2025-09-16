// src/hooks/useIsTwa.ts
import { useEffect, useState } from "react";

/**
 * Detecta com mais segurança se estamos rodando como TWA / ambiente compatível com
 * Google Play Billing (DigitalGoods / PaymentRequest flow).
 *
 * Regras principais (estritas, para evitar triggers indesejadas no desktop):
 *  - Plataforma deve ser Android (userAgent)  AND
 *  - Deve haver suporte explícito ao Digital Goods (window.getDigitalGoodsService) OR
 *    estamos executando em um contexto de Trusted Web Activity identificado pelo userAgent/standalone + Android.
 *
 * Observação: mantemos logs de debug para validar o que está ocorrendo em runtime.
 */

function isAndroidUA(ua: string) {
  return /\bAndroid\b/i.test(ua);
}

function isMobileUA(ua: string) {
  return /\bMobile\b/i.test(ua);
}

export function useIsTwa() {
  const [isTwa, setIsTwa] = useState(false);

  useEffect(() => {
    try {
      const w = window as any;
      const ua = navigator.userAgent || "";
      const standaloneMatch = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
      const hasDG = typeof w.getDigitalGoodsService === "function";
      const hasPaymentRequest = typeof w.PaymentRequest === "function";

      // Heurística estrita:
      // - Requer Android user agent (evita desktop)
      // - Requer suporte a Digital Goods OU (standalone + mobile UA que pareça TWA)
      const android = isAndroidUA(ua);
      const mobile = isMobileUA(ua);

      const twaCandidate =
        android &&
        (hasDG ||
          // se estamos em standalone, só considera TWA se parece mobile/android
          (standaloneMatch && mobile) ||
          // alguns WebAPK/TWA user agents trazem "TWA" ou "Android" + "wv" / "WebView"
          /\bTWA\b/i.test(ua) ||
          /\bwv\b/i.test(ua) ||
          /\bAndroid.*(WebView|wv)\b/i.test(ua));

      const result = Boolean(twaCandidate);

      // Debug info (console only) - seguro para produção (apenas logs)
      console.debug("[useIsTwa] detection:", {
        ua: (ua || "").replace(/\s+/g, " ").slice(0, 200),
        android,
        mobile,
        displayModeStandalone: standaloneMatch,
        hasDigitalGoods: !!hasDG,
        hasPaymentRequest: !!hasPaymentRequest,
        twaCandidate: result,
      });

      setIsTwa(result);
    } catch (e) {
      console.debug("[useIsTwa] detection error", e);
      setIsTwa(false);
    }
  }, []);

  return isTwa;
}

export default useIsTwa;

