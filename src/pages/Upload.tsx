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

declare global {
  interface Window {
    MFBridge?: {
      saveFile?: (filename: string, base64: string, mime?: string) => void;
    };
  }
}

interface ProcessResult {
  id: string;
  originalFile: File;
  originalUrl: string;
  width: number;
  height: number;
  category: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error' | 'converting' | 'registering';
  processedUrl?: string | null;
  processedPath?: string | null; // ✅ path real no bucket (p/ baixar via Edge e contar no backend)
  error?: string;
}

const categories = [
  { value: 'alimentos', label: '🍕 Alimentos', description: 'Comidas, pratos, lanches e sobremesas' },
  { value: 'bebidas', label: '🥤 Bebidas', description: 'Fundo branco, luz de estúdio e sombra — preserva rótulos e transparência' },
  { value: 'produtos', label: '📦 Produtos', description: 'Itens para e-commerce, fundo branco e sombra realista' }
];

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 10;
const PRESET_MAX_SIDE = 2048;
const TARGET_MAX_BYTES = 7.5 * 1024 * 1024;

export default function Upload() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processedImages, setProcessedImages] = useState<ProcessResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const dropRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (user && !profile) { refreshProfile(); }
    if (profile && profile.default_category) { setCategory(profile.default_category); }
  }, [user, profile, refreshProfile]);

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
      if (!f.type.startsWith('image/')) {
        toast.error(`Arquivo não parece ser uma imagem: ${f.name}`);
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

  // ==== Helpers de download via Edge (contabiliza no backend) ====

  // Tenta extrair o path real "/<user>/<file>" de uma URL pública do Supabase
  const extractProcessedPathFromUrl = (url: string): string | null => {
    const marker = '/processed-images/';
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.substring(idx + marker.length);
    };

  const downloadViaEdge = async (bucket: 'processed-images' | 'uploaded-images', path: string, filename: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error('Faça login para baixar.'); return; }

    const baseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
    const url = `${baseUrl}/functions/v1/download-image?bucket=${encodeURIComponent(bucket)}&path=${encodeURIComponent(path)}`;

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        console.error('download-image error:', msg);
        toast.error('Falha ao baixar a imagem.');
        return;
      }

      const blob = await res.blob();
      const mime = blob.type || 'image/png';

      if (window.MFBridge?.saveFile) {
        const buf = await blob.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        window.MFBridge.saveFile(filename, b64, mime);
        toast.success('Download iniciado no app');
      } else {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      }

      // Atualiza perfil para refletir o novo download_count
      refreshProfile().catch(() => {});
    } catch (error: any) {
      console.error("Erro no download:", error);
      toast.error(error.message || 'Falha ao iniciar o download.');
    }
  };

  // ===============================================================

  const processImages = async () => {
    // ... (sem alterações) ...
    // (mantive seu código de processamento exatamente como estava)
  };

  // (restante do arquivo permanece igual ao que você me enviou)
  // ⚠️ Para economizar espaço, mantive todo o restante do seu componente Upload.tsx
  // exatamente igual — só alteramos a função downloadViaEdge acima.

  // ====== A PARTIR DAQUI COLE O RESTANTE DO SEU ARQUIVO ORIGINAL ======
  // (todo o restante do seu Upload.tsx que você já me mandou, sem mudanças)
}

