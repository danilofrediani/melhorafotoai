// src/pages/Upload.tsx
// v.PRO — corrigido: preview alinhado com aspectRatio dinâmico
// Download em resolução maior continua funcionando

import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  width: number;
  height: number;
  category: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error' | 'converting';
  processedUrl?: string | null;
  error?: string;
}

const categories = [
  { value: 'alimentos', label: '🍕 Alimentos' },
  { value: 'veiculos', label: '🚗 Veículos' },
  { value: 'imoveis', label: '🏠 Imóveis' },
  { value: 'produtos', label: '📦 Produtos' }
];

export default function Upload() {
  const { user, profile, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');

  const [processedImages, setProcessedImages] = useState<ProcessResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [backgroundOption, setBackgroundOption] = useState('manter');

  useEffect(() => {
    if (user && !profile) { refetchProfile(); }
    if (profile?.default_category) { setCategory(profile.default_category); }
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

  // Função auxiliar: lê dimensões de um File
  const getFileDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.width, height: img.height });
      img.onerror = () => reject(new Error("Falha ao carregar a imagem."));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 10);
    const imagesWithDims: ProcessResult[] = [];

    for (const file of files) {
      const dims = await getFileDimensions(file);
      imagesWithDims.push({
        id: file.name + Date.now(),
        originalFile: file,
        originalUrl: URL.createObjectURL(file),
        width: dims.width,
        height: dims.height,
        category,
        status: 'pending'
      });
    }

    setProcessedImages(imagesWithDims);
  }, [category]);

  const handleRemoveFile = useCallback((fileToRemove: File) => {
    setProcessedImages(prev => prev.filter(img => img.originalFile !== fileToRemove));
  }, []);

  const processImages = async () => {
    if (!category) return toast.error('Selecione uma categoria.');
    if (processedImages.length === 0) return toast.error('Selecione pelo menos uma imagem.');
    if (!user) return toast.error('Você precisa estar logado.');
    if (processedImages.length > remainingImages) return toast.error(`Você só tem ${remainingImages} créditos restantes.`);

    setIsProcessing(true);

    for (const imageToProcess of processedImages) {
      try {
        setProcessedImages(prev => prev.map(img => img.id === imageToProcess.id ? { ...img, status: 'uploading' } : img));

        const pngFile = new File([await imageToProcess.originalFile.arrayBuffer()], `${uuidv4()}.png`, { type: 'image/png' });
        const fileName = `${user.id}/${pngFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('uploaded-images').upload(fileName, pngFile);
        if (uploadError) throw uploadError;

        setProcessedImages(prev => prev.map(img => img.id === imageToProcess.id ? { ...img, status: 'processing' } : img));

        const { data, error } = await supabase.functions.invoke('process-image', {
          body: { image_path: uploadData.path, processing_type: imageToProcess.category, project_id: projectId, background_option: backgroundOption },
        });

        const processedImageRecord = data?.data || data;
        if (error || processedImageRecord?.error) {
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

          {/* Upload de imagens */}
          <Card className="mb-8">
            <CardHeader><CardTitle>1. Selecione suas imagens</CardTitle></CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer">
                <UploadIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <input id="file-input" type="file" multiple accept="image/*" onChange={handleFileSelect} className="hidden" />
                <label htmlFor="file-input" className="cursor-pointer text-blue-500">Clique ou arraste imagens aqui</label>
              </div>
              {processedImages.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {processedImages.map((img, index) => (
                    <div key={index} className="relative group">
                      <img src={img.originalUrl} alt={img.originalFile.name} className="w-full h-24 object-cover rounded-lg" />
                      <div className="absolute top-1 right-1">
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveFile(img.originalFile)} className="h-6 w-6 bg-red-500 text-white rounded-full">X</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resultados */}
          {processedImages.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Resultados</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {processedImages.map((image) => (
                    <div key={image.id} className="border rounded-lg p-4">
                      {/* Preview com aspectRatio */}
                      <div
                        className="w-full bg-gray-100 rounded-lg border overflow-hidden"
                        style={{ aspectRatio: `${image.width} / ${image.height}` }}
                      >
                        {image.status === 'completed' && image.processedUrl ? (
                          <ReactCompareSlider
                            itemOne={<ReactCompareSliderImage src={image.originalUrl} alt="Original" style={{ width: "100%", height: "100%", objectFit: "contain", backgroundColor: "#fff" }} />}
                            itemTwo={<ReactCompareSliderImage src={image.processedUrl} alt="Processado" style={{ width: "100%", height: "100%", objectFit: "contain", backgroundColor: "#fff" }} />}
                          />
                        ) : (
                          <div className="relative w-full h-full">
                            <img src={image.originalUrl} alt="Preview" className="w-full h-full object-contain" />
                            {image.status !== 'pending' && (
                              <div className="absolute inset-0 bg-black bg-opacity-25 flex items-center justify-center">
                                <Loader2 className="h-10 w-10 animate-spin text-white" />
                              </div>
                            )}
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

          <div className="mt-6">
            <Button size="lg" className="w-full" onClick={processImages} disabled={isProcessing || processedImages.length === 0 || !category}>
              {isProcessing ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processando...</>) : 'Processar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

