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
// --- NOVIDADE: Imports para o novo seletor ---
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";


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
  
  // --- NOVIDADE: Estado para a nova opção de fundo ---
  const [backgroundOption, setBackgroundOption] = useState('manter'); // 'manter', 'neutro', 'parque'

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
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, 1024, 1024);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            }
          }, 'image/png');
        }
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const processImages = async () => {
    if (!category) return toast.error('Selecione uma categoria.');
    if (selectedFiles.length === 0) return toast.error('Selecione pelo menos uma imagem.');
    if (!user) return toast.error('Você precisa estar logado.');
    if (selectedFiles.length > remainingImages) return toast.error(`Você só tem ${remainingImages} créditos restantes.`);

    setIsProcessing(true);

    const initialImages: ProcessResult[] = selectedFiles.map(file => ({
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
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('uploaded-images')
          .upload(fileName, pngFile);
        if (uploadError) throw uploadError;

        setProcessedImages(prev => prev.map(img => img.id === imageToProcess.id ? { ...img, status: 'processing' } : img));
        toast.info(`Processando "${imageToProcess.originalFile.name}" com a IA...`);

        // --- NOVIDADE: Envia a opção de fundo para a Edge Function ---
        const { data: processedImageRecord, error } = await supabase.functions.invoke('process-image', {
          body: {
            image_path: uploadData.path,
            processing_type: imageToProcess.category,
            project_id: projectId,
            background_option: backgroundOption,
          },
        });
        if (error || (processedImageRecord && (processedImageRecord as any).error)) {
          throw new Error(error?.message || (processedImageRecord as any).error || 'Erro na function');
        }

        console.log('[DEBUG] process-image response:', processedImageRecord);
        let finalProcessedUrl: string | null = null;
        if ((processedImageRecord as any)?.processed_url) {
          finalProcessedUrl = (processedImageRecord as any).processed_url;
        }
        if (!finalProcessedUrl && (processedImageRecord as any)?.processed_file_path) {
          const path = (processedImageRecord as any).processed_file_path;
          const { data: publicData } = supabase.storage.from('processed-images').getPublicUrl(path);
          finalProcessedUrl = publicData?.publicUrl ?? null;
        }

        setProcessedImages(prev => prev.map(img => img.id === imageToProcess.id ? {
          ...img,
          status: finalProcessedUrl ? 'completed' : 'error',
          processedUrl: finalProcessedUrl,
          error: finalProcessedUrl ? undefined : 'Preview indisponível (processed_url ausente)'
        } : img));

        if (!finalProcessedUrl) {
          toast.error(`Falha ao obter preview para "${imageToProcess.originalFile.name}". Ver logs.`);
        } else {
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
console.log("Categoria selecionada atualmente é:", category); 
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Upload de Imagens</h1>
            <p className="text-gray-600">Faça upload das suas imagens e veja a magia da nossa IA acontecer</p>
            {projectId && (
              <Alert variant="default" className="mt-4 bg-blue-50 border-blue-200">
                <FolderKanban className="h-4 w-4 text-blue-700" />
                <AlertDescription className="text-blue-700 font-medium">Imagens serão adicionadas ao projeto: {projectName || 'Carregando...'}</AlertDescription>
              </Alert>
            )}
            <div className="mt-4 flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-full border">
                <ImageIcon className="w-4 w-4 text-primary" />
                <span className="text-sm font-medium">{remainingImages} imagens restantes</span>
              </div>
              {remainingImages < selectedFiles.length && (
                <Button size="sm" onClick={() => navigate('/pricing')}>Comprar mais créditos</Button>
              )}
            </div>
          </div>

          <Card className="mb-8">
            <CardHeader><CardTitle>1. Selecione suas imagens</CardTitle><CardDescription>Arraste e solte ou clique para selecionar (máximo 10 imagens)</CardDescription></CardHeader>
            <CardContent>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <UploadIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">{selectedFiles.length > 0 ? `${selectedFiles.length} arquivo(s) selecionado(s)` : 'Clique ou arraste imagens aqui'}</p>
                <p className="text-sm text-gray-500">Suporta JPG, PNG, WebP até 10MB</p>
                <input id="file-input" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} className="hidden" />
              </div>
              {selectedFiles.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-24 object-cover rounded-lg" />
                      <div className="absolute top-1 right-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full bg-red-500/80 text-white hover:bg-red-500" onClick={(e) => { e.stopPropagation(); handleRemoveFile(file); }}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-lg truncate">{file.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader><CardTitle>2. Escolha a categoria</CardTitle><CardDescription>Selecione o tipo de imagem para otimizar o processamento</CardDescription></CardHeader>
            <CardContent>
              {/* --- NOVIDADE: Reset da opção de fundo ao mudar a categoria --- */}
              <Select value={category} onValueChange={(value) => {
                setCategory(value);
                setBackgroundOption('manter');
              }}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      <div>
                        <div className="font-medium">{cat.label}</div>
                        <div className="text-sm text-gray-500">{cat.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* --- NOVIDADE: Card de fundo aparece apenas se a categoria for 'veiculos' --- */}
          {category === 'veiculos' && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>3. Opções de Fundo (Opcional)</CardTitle>
                <CardDescription>Escolha se deseja alterar o cenário da imagem.</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup value={backgroundOption} onValueChange={setBackgroundOption} className="gap-4">
                  <div>
                    <RadioGroupItem value="manter" id="manter" className="peer sr-only" />
                    <Label htmlFor="manter" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                      Manter Fundo Original
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="neutro" id="neutro" className="peer sr-only" />
                    <Label htmlFor="neutro" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                      Fundo Neutro (Estúdio)
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="parque" id="parque" className="peer sr-only" />
                    <Label htmlFor="parque" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                      Fundo de Parque/Natureza
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          )}

          <div className="mb-8">
            <Button size="lg" className="w-full bg-gradient-fotoperfeita hover:opacity-90" onClick={processImages} disabled={isProcessing || selectedFiles.length === 0 || !category}>
              {isProcessing ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processando...</>) : (<><ImageIcon className="mr-2 h-5 w-5" /> Processar {selectedFiles.length} imagem(s)</>)}
            </Button>
          </div>

          {processedImages.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Resultados</CardTitle><CardDescription>Suas imagens processadas com nossa IA</CardDescription></CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {processedImages.map((image) => (
                    <div key={image.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-medium truncate pr-4">{image.originalFile.name}</h3>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          {image.status === 'uploading' && <><Loader2 className="h-4 w-4 animate-spin text-gray-500" /><span className="text-sm text-gray-500">Enviando...</span></>}
                          {image.status === 'converting' && <><Loader2 className="h-4 w-4 animate-spin text-gray-500" /><span className="text-sm text-gray-500">Convertendo...</span></>}
                          {image.status === 'processing' && <><Loader2 className="h-4 w-4 animate-spin text-blue-500" /><span className="text-sm text-blue-500">Processando...</span></>}
                          {image.status === 'completed' && <><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-sm text-green-500">Concluído</span></>}
                          {image.status === 'error' && <><AlertCircle className="h-4 w-4 text-red-500" /><span className="text-sm text-red-500">Erro</span></>}
                          {image.status === 'pending' && <><span className="text-sm text-gray-500">Na fila...</span></>}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium mb-2">Original</p>
                          <img src={image.originalUrl} alt="Original" className="w-full aspect-square object-cover rounded-lg border" />
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">Processado com MelhoraFotoAI</p>
                          {image.status !== 'completed' ? (
                            <div className="w-full aspect-square bg-gray-100 rounded-lg border flex items-center justify-center">
                              <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                          ) : null}
                          {image.status === 'completed' && image.processedUrl && (
                            <>
                              <img src={image.processedUrl} alt="Processado" className="w-full aspect-square object-cover rounded-lg border border-primary" />
                              <a href={image.processedUrl} download={`melhorafoto_${image.originalFile.name}`} className="mt-2 w-full inline-block">
                                <Button className="w-full"><Download className="mr-2 h-4 w-4" /> Download</Button>
                              </a>
                            </>
                          )}
                          {image.status === 'error' && (
                            <div className="w-full aspect-square bg-red-50 rounded-lg border border-red-200 flex items-center justify-center text-center p-4">
                              <div className="text-red-500">
                                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                                <p className="text-sm">{image.error}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
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
