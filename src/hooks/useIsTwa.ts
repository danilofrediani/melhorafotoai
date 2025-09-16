import { useState, useEffect } from 'react';

/**
 * Hook que verifica de forma síncrona e imediata se a aplicação 
 * está rodando dentro de um Trusted Web Activity (TWA), ou seja, o app Android.
 */
export const useIsTwa = () => {
  const [isTwaMode, setIsTwaMode] = useState(false);

  useEffect(() => {
    // A verificação é feita lendo o "user agent" do navegador.
    // O TWA adiciona a string 'twa' para se identificar.
    const userAgent = navigator.userAgent.toLowerCase();
    setIsTwaMode(userAgent.includes('twa'));
  }, []); // Roda apenas uma vez, no carregamento inicial.

  return isTwaMode;
};
