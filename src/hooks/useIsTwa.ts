// src/hooks/useIsTwa.ts
import { useEffect, useState } from 'react';

/**
 * Detecta se estamos rodando dentro de um TWA (Android)
 * de forma conservadora, verificando a presença do
 * Digital Goods Service do Google Play.
 */
function useIsTwa() {
  const [isTwa, setIsTwa] = useState(false);

  useEffect(() => {
    try {
      const hasDG =
        typeof window !== 'undefined' &&
        typeof (window as any).getDigitalGoodsService === 'function';
      setIsTwa(!!hasDG);
    } catch {
      setIsTwa(false);
    }
  }, []);

  return isTwa;
}

// Exporta das duas formas para não quebrar nenhum import
export { useIsTwa };
export default useIsTwa;

