// src/hooks/useIsTwa.ts
import { useEffect, useState } from 'react';

/**
 * Detecção robusta de TWA:
 * - referrer android-app://... (válido para TWA verificada)
 * - display-mode: standalone (Chrome/Android)
 * - sem token de WebView (; wv)
 * - fallback para hints de bridge
 */
export default function useIsTwa(): boolean {
  const [isTwa, setIsTwa] = useState(false);

  useEffect(() => {
    try {
      const ua = navigator.userAgent || '';
      const isAndroid = /Android/i.test(ua);
      const isChrome = /Chrome\/\d+/i.test(ua);
      const isWebView = /; wv\)/i.test(ua); // WebView costuma ter ; wv
      const ref = document.referrer || '';
      const refIsAndroidApp = ref.startsWith('android-app://');
      const displayStandalone =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches;

      // Alguns fabricantes expõem bridges
      const hasBridge =
        (window as any).__TWA_BRIDGE__ ||
        (window as any).TrustedWebActivity ||
        (window as any).AndroidBridge;

      const detected =
        refIsAndroidApp ||
        (displayStandalone && isAndroid && isChrome && !isWebView) ||
        Boolean(hasBridge);

      setIsTwa(Boolean(detected));
    } catch {
      setIsTwa(false);
    }
  }, []);

  return isTwa;
}

