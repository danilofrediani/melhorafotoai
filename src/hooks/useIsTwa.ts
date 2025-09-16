import { useEffect, useState } from "react";

/**
 * Detecta TWA / suporte ao Google Play Billing (via Payment Request).
 * Export nomeado (conserta o build).
 */
export function useIsTwa() {
  const [isTwa, setIsTwa] = useState(false);

  useEffect(() => {
    try {
      const w = window as any;
      // heurísticas simples: display-mode standalone OU presença das APIs do TWA
      const standalone =
        window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;

      const hasDG = typeof w.getDigitalGoodsService === "function";
      const hasPlayPR = typeof (window as any).PaymentRequest === "function";

      setIsTwa(Boolean(standalone || hasDG || hasPlayPR));
    } catch {
      setIsTwa(false);
    }
  }, []);

  return isTwa;
}

export default useIsTwa;

