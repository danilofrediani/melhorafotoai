// src/pages/Upload.tsx
// v.PRO — Upload com slider alinhado (object-contain no preview)

import { useState, useCallback, useEffect } from 'react';
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
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error' | 'converting';
  processedUrl?: string | null;
  error?: string;
}

const categories = [
  { value: 'alimentos', label: '🍕 Alimentos', description: 'Comidas, pratos, bebidas' },
  { value: 'veiculos', label: '🚗 Veículos', description: 'Carros, motos, caminhões' },
  { value: 'imoveis', label: '🏠 Imóveis', description: 'Casas, apartamentos, escritórios' },
  { value: 'produtos', label: '📦 Produtos', description: 'Itens para e-commerce' }
];

export default function Upload() {
  const { user, profile, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processedImages, setProcessedImages] = useState<ProcessResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [backgroundOption, setBackgroundOption] = useState('manter');

  useEffect(() => {
    if (user && !profile) { refetchProfile(); }
    if (profile && profile.default_category) { setCategory(profile.default_category); }
  }, [user, profile, refetchProfile]);

  useEffect(() => {
    const fetchProjectName = async () => {
      if (projectId && profile?.id) {
        const project = await projectService.getProjectById(projectId, profile.id);
        if (project) setProjectName(project.name);
      }
    };
    if (profile) fetchProjectName();
  }, [projectId, profile]);

  const remainingImages = profile?.remaining_images ?? 0;

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 10);
    setSelectedFiles(files);
    setProcessedImages([]);
  }, []);

  const handleRemoveFile = useCallback((fileToRemove: File) => {
    setSelectedFiles(prevFiles => prevFiles.filter(file => file !== fileToRemove));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).slice(0, 10);
    setSelectedFiles(files);
    setProcessedImages([]);
  }, []);

  const convertToPngAndResize = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const targetSize = 1024;
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, targetSize, targetSize);
          const aspectRatio = img.width / img.height;
          let newWidth, newHeight, x, y;
          if (aspectRatio > 1) {
            newWidth = targetSize;
            newHeight = targetSize / aspectRatio;
            x = 0;
            y = (targetSize - newHeight) / 2;
          } else {
            newHeight = targetSize;
            newWidth = targetSize * aspectRatio;
            y = 0;
            x = (targetSize - newWidth) / 2;
          }
          ctx.drawImage(img, x, y, newWidth, newHeight);
          canvas.toBlob((blob) => {
            if (blob) { resolve(blob); } 
            else { reject(new Error('Falha ao criar o Blob da imagem.')); }
          }, 'image/png');
        } else {
           reject(new Error('Não foi possível obter o contexto 2D do canvas.'));
        }
      };
      img.onerror = () => { reject(new Error('Falha ao carregar a imagem.')); }
      img.src = URL.createObjectURL(file);
    });
  };

  const processImages = async () => {
    if (!category) return toast.error('Selecione uma categoria.');
    if (selectedFiles.length === 0) return toast.error('Selecione pelo menos uma imagem.');
    if (!user) return toast.error('Você precisa estar logado.');
    if (selectedFiles.length > remainingImages) return toast.error(`Você só tem ${remainingImages} créditos restantes.`);

    setIsProcessing(true);
    const initialImages = selectedFiles.map(file => ({
      id: file.name + Date.now(),
      originalFile: file,
      originalUrl: URL.createObjectURL(file),
      category,
      status: 'pending'
    }));
    setProcessedImages(initialImages);
    setSelectedFiles([]);

    for (const imageToProcess of initialImages) {
      try {
        setProcessedImages(prev => prev.map(img => img.id === imageToProcess.id ? { ...img, status: 'converting' } : img));
        toast.info(`Convertendo "${imageToProcess.originalFile.name}" para PNG...`);
        const pngBlob = await convertToPngAndResize(imageToProcess.originalFile);
        const pngFile = new File([pngBlob], `${uuidv4()}.png`, { type: 'image/png' });

        setProcessedImages(prev => prev.map(img => img.id === imageToProcess.id ? { ...img, status: 'uploading' } : img));
        toast.info(`Enviando "${imageToProcess.originalFile.name}"...`);
        const fileName = `${user.id}/${pngFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('uploaded-images').upload(fileName, pngFile);
        if (uploadError) throw uploadError;

        setProcessedImages(prev => prev.map(img => img.id === imageToProcess.id ? { ...img, status: 'processing' } : img));
        toast.info(`Processando "${imageToProcess.originalFile.name}" com a IA...`);

        const { data, error } = await supabase.functions.invoke('process-image', {
          body: { image_path: uploadData.path, processing_type: imageToProcess.category, project_id: projectId, background_option: backgroundOption },
        });
        
        console.log('[DEBUG] process-image response:', data);
        const processedImageRecord = data?.data || data;

        if (error || (processedImageRecord && processedImageRecord.error)) {
          throw new Error(error?.message || processedImageRecord.error || 'Erro na function');
        }

        const finalProcessedUrl = processedImageRecord?.processed_url || null;

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
        setProcessedImages(prev => prev.map(img => img.id === imageToProcess.id ? { ...img, status: 'error', error: (error as Error).message } : img));
        toast.error(`Falha no processamento de "${imageToProcess.originalFile.name}"`);
        setIsProcessing(false);
        return;
      }
    }
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* ... cabeçalho e seleção de arquivos (igual ao seu código) ... */}

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
                          {image.status === 'processing' && <><Loader2 className="h-4 w-4 animate-spin text-blue-500" /><span className="text-sm text-blue-500">Processando...</span></>}
                          {image.status === 'completed' && <><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-sm text-green-500">Concluído</span></>}
                          {image.status === 'error' && <><AlertCircle className="h-4 w-4 text-red-500" /><span className="text-sm text-red-500">Erro</span></>}
                        </div>
                      </div>

                      <div className="w-full aspect-square bg-gray-100 rounded-lg border flex items-center justify-center overflow-hidden">
                        {image.status === 'completed' && image.processedUrl ? (
                          <ReactCompareSlider
                            itemOne={
                              <ReactCompareSliderImage
                                src={image.originalUrl}
                                alt="Original"
                                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                              />
                            }
                            itemTwo={
                              <ReactCompareSliderImage
                                src={image.processedUrl}
                                alt="Processado"
                                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                              />
                            }
                            className="w-full h-full"
                          />
                        ) : image.status === 'error' ? (
                          <div className="text-red-500 text-center p-4">
                            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                            <p className="text-sm">{image.error || 'Ocorreu um erro desconhecido.'}</p>
                          </div>
                        ) : (
                          <div className="relative w-full h-full">
                            <img src={image.originalUrl} alt="Processando" className="w-full h-full object-contain" />
                            <div className="absolute inset-0 bg-black bg-opacity-25 flex items-center justify-center">
                              <Loader2 className="h-10 w-10 animate-spin text-white" />
                            </div>
                          </div>
                        )}
                      </div>

                      {image.status === 'completed' && image.processedUrl && (
                        <a href={image.processedUrl} download={`melhorafoto_${image.originalFile.name}`} className="mt-4 w-full inline-block">
                          <Button className="w-full"><Download className="mr-2 h-4 w-4" /> Download</Button>
                        </a>
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

