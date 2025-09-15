// src/pages/Upload.tsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Header from '@/components/Header';
import {
  Upload as UploadIcon,
  ImageIcon,
  CheckCircle,
  AlertCircle,
  Download,
  Loader2,
  X,
  FolderKanban,
  Camera
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { projectService } from '@/lib/database';
import { v4 as uuidv4 } from 'uuid';
import { ReactCompareSlider, ReactCompareSliderImage } from 'react-compare-slider';
import CameraPicker from '@/components/CameraPicker';

interface ProcessResult {
  id: string;
  originalFile: File;
  originalUrl: string;
  width: number;
  height: number;
  category: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error' | 'converting' | 'registering';
  processedUrl?: string | null;
  error?: string;
}

const categories = [
  { value: 'alimentos', label: '🍕 Alimentos', description: 'Comidas, pratos, bebidas' },
  { value: 'produtos', label: '📦 Produtos', description: 'Itens para e-commerce' }
];

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 10;
const PRESET_MAX_SIDE = 2048;
const TARGET_MAX_BYTES = 7.5 * 1024 * 1024;

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
  const dropRef = useRef<HTMLDivElement | null>(null);

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

  const getFileDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('Falha ao carregar a imagem.'));
      img.src = URL.createObjectURL(file);
    });
  };

  const hasAlpha = async (bitmap: ImageBitmap): Promise<boolean> => {
    const sampleW = 64;
    const sampleH = Math.round((bitmap.height / bitmap.width) * sampleW) || 64;
    const c = document.createElement('canvas');
    c.width = sampleW;
    c.height = sampleH;
    const ctx = c.getContext('2d');
    if (!ctx) return false;
    ctx.drawImage(bitmap, 0, 0, sampleW, sampleH);
    const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
    return false;
  };

  const makeBitmap = async (file: File): Promise<ImageBitmap> => {
    try {
      const blob = file instanceof Blob ? file : new Blob([file], { type: file.type });
      return await createImageBitmap(blob as any, { imageOrientation: 'from-image' as any });
    } catch {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('Falha ao ler imagem.'));
        i.src = URL.createObjectURL(file);
      });
      const tmp = document.createElement('canvas');
      tmp.width = img.naturalWidth;
      tmp.height = img.naturalHeight;
      const ctx = tmp.getContext('2d');
      if (!ctx) throw new Error('Canvas não suportado.');
      ctx.drawImage(img, 0, 0);
      const b = await new Promise<Blob>((res, rej) => tmp.toBlob(bb => bb ? res(bb) : rej(new Error('Blob inválido.')), 'image/png'));
      return await createImageBitmap(b);
    }
  };

  const renderToCanvas = (bitmap: ImageBitmap, maxSide: number): HTMLCanvasElement => {
    const { width: w, height: h } = bitmap;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const outW = Math.max(1, Math.round(w * scale));
    const outH = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, outW, outH);
    return canvas;
  };

  const exportAdaptive = async (canvas: HTMLCanvasElement, wantAlpha: boolean, targetBytes: number): Promise<Blob> => {
    if (wantAlpha) {
      let current = canvas;
      let blob = await new Promise<Blob | null>(res => current.toBlob(res, 'image/png'));
      if (!blob) throw new Error('Falha ao exportar PNG.');
      while (blob.size > targetBytes && (current.width > 512 || current.height > 512)) {
        const next = document.createElement('canvas');
        next.width = Math.round(current.width * 0.9);
        next.height = Math.round(current.height * 0.9);
        const nctx = next.getContext('2d')!;
        nctx.imageSmoothingEnabled = true;
        nctx.imageSmoothingQuality = 'high';
        nctx.drawImage(current, 0, 0, next.width, next.height);
        current = next;
        blob = await new Promise<Blob | null>(res => current.toBlob(res, 'image/png'));
        if (!blob) throw new Error('Falha ao exportar PNG.');
      }
      return blob;
    } else {
      let q = 0.9;
      let current = canvas;
      let blob = await new Promise<Blob | null>(res => current.toBlob(res, 'image/jpeg', q));
      if (!blob) throw new Error('Falha ao exportar JPEG.');
      while (blob.size > targetBytes && q > 0.6) {
        q = Math.max(0.6, q - 0.1);
        blob = await new Promise<Blob | null>(res => current.toBlob(res, 'image/jpeg', q));
        if (!blob) throw new Error('Falha ao exportar JPEG.');
      }
      while (blob.size > targetBytes && (current.width > 512 || current.height > 512)) {
        const next = document.createElement('canvas');
        next.width = Math.round(current.width * 0.9);
        next.height = Math.round(current.height * 0.9);
        const nctx = next.getContext('2d')!;
        nctx.imageSmoothingEnabled = true;
        nctx.imageSmoothingQuality = 'high';
        nctx.drawImage(current, 0, 0, next.width, next.height);
        current = next;
        blob = await new Promise<Blob | null>(res => current.toBlob(res, 'image/jpeg', q));
        if (!blob) throw new Error('Falha ao exportar JPEG.');
      }
      return blob;
    }
  };

  const convertForFalAI = async (file: File): Promise<{ blob: Blob; mime: string }> => {
    const bitmap = await makeBitmap(file);
    const alpha = await hasAlpha(bitmap);
    const canvas = renderToCanvas(bitmap, PRESET_MAX_SIDE);
    const blob = await exportAdaptive(canvas, alpha, TARGET_MAX_BYTES);
    const mime = alpha ? 'image/png' : 'image/jpeg';
    return { blob, mime };
  };

  const addFiles = useCallback(async (files: File[]) => {
    if (!files || files.length === 0) return;
    const current = selectedFiles.length;
    const available = Math.max(0, MAX_FILES - current);
    const toAdd = files.slice(0, available);

    if (toAdd.length < files.length) {
      toast.warning(`Limite de ${MAX_FILES} imagens por vez. Adicionando ${toAdd.length}.`);
    }
    if (toAdd.length === 0) return;

    const valid: File[] = [];
    for (const f of toAdd) {
      if (!ACCEPTED_TYPES.includes(f.type)) {
        toast.error(`Formato não suportado: ${f.name}`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast.warning(`Arquivo grande (>10MB): ${f.name}. Vamos otimizar antes do envio.`);
      }
      valid.push(f);
    }
    if (valid.length === 0) return;

    const withDims = await Promise.all(valid.map(async (file) => {
      const { width, height } = await getFileDimensions(file);
      return {
        id: file.name + Date.now(),
        originalFile: file,
        originalUrl: URL.createObjectURL(file),
        width,
        height,
        category,
        status: 'pending' as const
      };
    }));
    setSelectedFiles(prev => [...prev, ...valid]);
    setProcessedImages(prev => [...prev, ...withDims]);
  }, [category, selectedFiles.length]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await addFiles(files);
    e.currentTarget.value = '';
  }, [addFiles]);

  const handlePickedFromCamera = useCallback(async (file: File) => {
    await addFiles([file]);
  }, [addFiles]);

  const handleRemoveFile = useCallback((fileToRemove: File) => {
    setSelectedFiles(prev => prev.filter(f => f !== fileToRemove));
    setProcessedImages(prev => prev.filter(img => img.originalFile !== fileToRemove));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    await addFiles(files);
  }, [addFiles]);

  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items);
      const files: File[] = [];
      for (const it of items) {
        if (it.kind === 'file') {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length) {
        await addFiles(files);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [addFiles]);

  const processImages = async () => {
    if (!category) return toast.error('Selecione uma categoria.');
    if (selectedFiles.length === 0) return toast.error('Selecione pelo menos uma imagem.');
    if (!user) return toast.error('Você precisa estar logado.');
    if (selectedFiles.length > remainingImages) return toast.error(`Você só tem ${remainingImages} créditos restantes.`);

    setIsProcessing(true);

    for (const imageToProcess of processedImages) {
      try {
        setProcessedImages(prev => prev.map(img => img.id === imageToProcess.id ? { ...img, status: 'converting' } : img));
        toast.info(`Otimizando "${imageToProcess.originalFile.name}" para a IA...`);

        const { blob: finalBlob, mime } = await convertForFalAI(imageToProcess.originalFile);
        const ext = mime === 'image/png' ? 'png' : 'jpg';
        const optimizedFile = new File([finalBlob], `${uuidv4()}.${ext}`, { type: mime });

        setProcessedImages(prev => prev.map(img => img.id === imageToProcess.id ? { ...img, status: 'uploading' } : img));
        toast.info(`Enviando "${imageToProcess.originalFile.name}"...`);

        const fileName = `${user.id}/${optimizedFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage.from('uploaded-images').upload(fileName, optimizedFile);
        if (uploadError) throw uploadError;

        setProcessedImages(prev => prev.map(img => img.id === imageToProcess.id ? { ...img, status: 'registering' } : img));
        toast.info(`Registrando "${imageToProcess.originalFile.name}"...`);
        
        const { data: dbRecord, error: dbError } = await supabase
          .from('uploaded_images')
          .insert({
            user_id: user.id,
            file_path: uploadData.path,
            original_filename: imageToProcess.originalFile.name,
            mime_type: optimizedFile.type,
            file_size: optimizedFile.size,
            width: imageToProcess.width,
            height: imageToProcess.height,
          })
          .select('id')
          .single();
        if (dbError) throw dbError;
        const uploadedImageId = dbRecord.id;

        setProcessedImages(prev => prev.map(img => img.id === imageToProcess.id ? { ...img, status: 'processing' } : img));
        toast.info(`Processando "${imageToProcess.originalFile.name}" com a IA...`);

        const { data, error } = await supabase.functions.invoke('process-image', {
          body: { 
            image_path: uploadData.path, 
            processing_type: category, 
            project_id: projectId,
            uploaded_image_id: uploadedImageId
          },
        });

        if (error || (data && data.error)) {
          throw new Error(error?.message || data.error || 'Erro na function');
        }
        
        const { data: publicUrlData } = supabase.storage.from('processed-images').getPublicUrl(data.processed_file_path);
        const finalProcessedUrl = publicUrlData.publicUrl;

        setProcessedImages(prev => prev.map(img => img.id === imageToProcess.id ? ({
          ...img,
          status: finalProcessedUrl ? 'completed' : 'error',
          processedUrl: finalProcessedUrl,
          error: finalProcessedUrl ? undefined : 'A IA não retornou uma URL válida.'
        }) : img));

        if (finalProcessedUrl) {
          toast.success(`"${imageToProcess.originalFile.name}" melhorada!`);
          await refetchProfile();
        } else {
          toast.error(`Falha no processamento de "${imageToProcess.originalFile.name}".`);
        }

      } catch (err: any) { // MODIFICADO PARA CAPTURAR O ERRO DETALHADO
        const errorMessage = err.message || JSON.stringify(err);
        console.error("ERRO DETALHADO NO PROCESSAMENTO:", err);
        setProcessedImages(prev => prev.map(img => img.id === imageToProcess.id ? { ...img, status: 'error', error: errorMessage } : img));
        
        // O TOAST AGORA MOSTRA O ERRO TÉCNICO COMPLETO
        toast.error(`Falha em "${imageToProcess.originalFile.name}": ${errorMessage}`, {
          duration: 10000, // Aumenta a duração para dar tempo de ler
        });

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
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Upload de Imagens</h1>
            <p className="text-gray-600">Faça upload das suas imagens e veja a magia da nossa IA acontecer</p>
            {projectId && (
              <Alert variant="default" className="mt-4 bg-blue-50 border-blue-200">
                <FolderKanban className="h-4 w-4 text-blue-700" />
                <AlertDescription className="text-blue-700 font-medium">
                  Imagens serão adicionadas ao projeto: {projectName || 'Carregando...'}
                </AlertDescription>
              </Alert>
            )}
            <div className="mt-4 flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-full border">
                <ImageIcon className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{profile?.remaining_images ?? 0} imagens restantes</span>
              </div>
              {(profile?.remaining_images ?? 0) < selectedFiles.length && (
                <Button size="sm" onClick={() => navigate('/pricing')}>Comprar mais créditos</Button>
              )}
            </div>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>1. Selecione suas imagens</CardTitle>
              <CardDescription>Arraste e solte, cole (Ctrl+V), clique para selecionar (máx. 10) ou tire uma foto agora</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex items-center gap-3">
                  <Camera className="w-5 h-5 text-zinc-600" />
                  <span className="text-sm text-zinc-600">No celular, você pode tirar a foto agora:</span>
                </div>
                <CameraPicker onPick={handlePickedFromCamera} className="mt-2" />
              </div>

              <div
                ref={dropRef}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <UploadIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">
                  {selectedFiles.length > 0 ? `${selectedFiles.length} arquivo(s) selecionado(s)` : 'Clique ou arraste imagens aqui'}
                </p>
                <p className="text-sm text-gray-500">Suporta JPG, PNG, WebP até 10MB • Dica: também aceita Ctrl+V</p>
                <input id="file-input" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={handleFileSelect} className="hidden" />
              </div>

              {selectedFiles.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-24 object-cover rounded-lg" />
                      <div className="absolute top-1 right-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 rounded-full bg-red-500/80 text-white hover:bg-red-500"
                          onClick={(e) => { e.stopPropagation(); handleRemoveFile(file); }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 rounded-b-lg truncate">
                        {file.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>2. Escolha a categoria</CardTitle>
              <CardDescription>Selecione o tipo de imagem para otimizar o processamento</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={category} onValueChange={setCategory}>
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

          <div className="mb-8">
            <Button size="lg" className="w-full" onClick={processImages} disabled={isProcessing || selectedFiles.length === 0 || !category}>
              {isProcessing ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processando...</>) : 'Processar'}
            </Button>
          </div>

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
                          {image.status === 'registering' && <><Loader2 className="h-4 w-4 animate-spin text-gray-500" /><span className="text-sm text-gray-500">Registrando...</span></>}
                          {image.status === 'processing' && <><Loader2 className="h-4 w-4 animate-spin text-blue-500" /><span className="text-sm text-blue-500">Processando...</span></>}
                          {image.status === 'completed' && <><CheckCircle className="h-4 w-4 text-green-500" /><span className="text-sm text-green-500">Concluído</span></>}
                          {image.status === 'error' && <><AlertCircle className="h-4 w-4 text-red-500" /><span className="text-sm text-red-500">Erro</span></>}
                        </div>
                      </div>

                      <div
                        className="w-full bg-gray-100 rounded-lg border overflow-hidden"
                        style={{ aspectRatio: `${image.width} / ${image.height}` }}
                      >
                        {image.status === 'completed' && image.processedUrl ? (
                          <ReactCompareSlider
                            itemOne={<ReactCompareSliderImage src={image.originalUrl} alt="Original" style={{ width: "100%", height: "100%", objectFit: "contain", backgroundColor: "#fff" }} />}
                            itemTwo={<ReactCompareSliderImage src={image.processedUrl} alt="Processado" style={{ width: "100%", height: "100%", objectFit: "contain", backgroundColor: "#fff" }} />}
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
        </div>
      </div>
    </div>
  );
}
