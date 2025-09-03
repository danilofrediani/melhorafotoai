// src/pages/Upload.tsx
// NOVA ARQUITETURA - Frontend como Oficina de Montagem via Canvas

import { useState, useCallback, useEffect, useRef } from 'react'; // Adicionado useRef
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Header from '@/components/Header';
import { Upload as UploadIcon, ImageIcon, CheckCircle, AlertCircle, Download, Loader2, X, FolderKanban } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { projectService } from '@/lib/database';
import { v4 as uuidv4 } from 'uuid';
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';


interface ProcessResult {
  id: string;
  originalFile: File;
  originalUrl: string;
  category: string;
  status: 'pending' | 'uploading' | 'processing' | 'composing' | 'completed' | 'error'; // Adicionado 'composing'
  processedUrl?: string | null;
  error?: string;
}

// ... (const categories permanece igual)

export default function Upload() {
  // ... (seus hooks useState, useEffect, etc., permanecem iguais)
  const canvasRef = useRef<HTMLCanvasElement>(null); // Ref para o canvas de composição

  // --- NOVA FUNÇÃO DE COMPOSIÇÃO ---
  const composeImages = (backgroundUrl: string, foregroundUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) return reject("Canvas não encontrado");
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject("Contexto do canvas não encontrado");

      const backgroundImg = new Image();
      backgroundImg.crossOrigin = "Anonymous";
      backgroundImg.onload = () => {
        canvas.width = backgroundImg.width;
        canvas.height = backgroundImg.height;
        ctx.drawImage(backgroundImg, 0, 0);

        const foregroundImg = new Image();
        foregroundImg.crossOrigin = "Anonymous";
        foregroundImg.onload = () => {
          ctx.drawImage(foregroundImg, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        foregroundImg.onerror = reject;
        foregroundImg.src = foregroundUrl;
      };
      backgroundImg.onerror = reject;
      backgroundImg.src = backgroundUrl;
    });
  };

  const processImages = async () => {
    // ... (lógica inicial de processImages permanece a mesma)

    for (const imageToProcess of initialImages) {
      try {
        // ... (upload do ficheiro original permanece o mesmo)

        const { data, error } = await supabase.functions.invoke('process-image', {
          body: { /* ... corpo da requisição ... */ },
        });
        
        console.log('[DEBUG] process-image response:', data);
        const responsePayload = data?.data || data;

        if (error || (responsePayload && responsePayload.error)) {
          throw new Error(error?.message || responsePayload.error || 'Erro na function');
        }

        let finalProcessedUrl = responsePayload?.processed_url || null;

        // --- LÓGICA DE MONTAGEM NO FRONTEND ---
        if (responsePayload.foreground_url && responsePayload.background_url) {
          toast.info("Montando imagem final...");
          setProcessedImages(prev => prev.map(img => img.id === imageToProcess.id ? { ...img, status: 'composing' } : img));
          
          finalProcessedUrl = await composeImages(responsePayload.background_url, responsePayload.foreground_url);
        }

        setProcessedImages(prev => prev.map(img => img.id === imageToProcess.id ? {
          ...img,
          status: finalProcessedUrl ? 'completed' : 'error',
          processedUrl: finalProcessedUrl,
          error: finalProcessedUrl ? undefined : 'A IA não retornou uma URL válida.'
        } : img));
        
        if (finalProcessedUrl) {
          toast.success(`"${imageToProcess.originalFile.name}" melhorada!`);
          await refetchProfile();
        } else {
           toast.error(`Falha no processamento de "${imageToProcess.originalFile.name}".`);
        }

      } catch (error) {
        // ... (catch block permanece o mesmo)
      }
    }
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Canvas oculto para fazer a composição */}
      <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
      
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* ... (todo o seu JSX até a parte de resultados permanece igual) ... */}

          {processedImages.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Resultados</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {processedImages.map((image) => (
                    <div key={image.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium truncate pr-4">{image.originalFile.name}</h3>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          {(image.status === 'processing' || image.status === 'composing') && <><Loader2 className="h-4 w-4 animate-spin text-blue-500" /><span className="text-sm text-blue-500">{image.status === 'composing' ? 'Montando...' : 'Processando...'}</span></>}
                          {image.status === 'completed' && <><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-sm text-green-500">Concluído</span></>}
                          {image.status === 'error' && <><AlertCircle className="h-4 w-4 text-red-500" /><span className="text-sm text-red-500">Erro</span></>}
                        </div>
                      </div>
                      
                      <div className="w-full aspect-square bg-gray-100 rounded-lg border flex items-center justify-center overflow-hidden">
                        {/* A lógica de exibição aqui permanece a mesma, pois o 'processedUrl' final será a imagem composta do canvas */}
                        {image.status === 'completed' && image.processedUrl ? (
                          <ReactCompareSlider
                            itemOne={<ReactCompareSliderImage src={image.originalUrl} alt="Original" style={{ objectFit: 'contain' }} />}
                            itemTwo={<ReactCompareSliderImage src={image.processedUrl} alt="Processado" style={{ objectFit: 'contain' }}/>}
                            className="w-full h-full"
                          />
                        ) 
                        : image.status === 'error' ? (
                          <div className="text-red-500 text-center p-4">{/* ... (error display) ... */}</div>
                        ) 
                        : (
                          <div className="relative w-full h-full">
                            <img src={image.originalUrl} alt="Processando" className="w-full h-full object-contain" />
                            <div className="absolute inset-0 bg-black bg-opacity-25 flex items-center justify-center">
                              <Loader2 className="h-10 w-10 animate-spin text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {image.status === 'completed' && image.processedUrl && (
                        <Button
                          className="mt-4 w-full"
                          onClick={() => handleDownload(image.processedUrl!, `melhorafoto_${image.originalFile.name}`)}
                        >
                          <Download className="mr-2 h-4 w-4" /> Download
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
