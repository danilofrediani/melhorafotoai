import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from '@/components/ui/label';
import { Card, CardFooter } from '@/components/ui/card';
import Header from '@/components/Header';
import { projectService, imageService } from '@/lib/database';
import { useAuth } from '@/contexts/AuthContext';
import type { Project, ProcessedImage } from '@/lib/types';
import { ChevronRight, FolderIcon, Loader2, Upload, Download } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export default function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  
  const [project, setProject] = useState<Project | null>(null);
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchProjectData = async () => {
      if (!projectId || !profile?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [projectData, imagesData] = await Promise.all([
          projectService.getProjectById(projectId, profile.id),
          imageService.getImagesForProject(projectId, profile.id)
        ]);

        if (projectData) {
          setProject(projectData);
          setImages(imagesData);
        } else {
          toast.error("Projeto não encontrado ou você não tem permissão.");
          navigate('/professional');
        }
      } catch (error) {
        toast.error("Ocorreu um erro ao buscar os dados do projeto.");
      } finally {
        setLoading(false);
      }
    };
    if (profile) fetchProjectData();
  }, [projectId, profile, navigate]);

  const handleImageSelection = (imageId: string) => {
    setSelectedImageIds(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(imageId)) newSelection.delete(imageId);
      else newSelection.add(imageId);
      return newSelection;
    });
  };

  const downloadImage = async (image: ProcessedImage) => {
    if (!image.processed_file_path) {
      return toast.error('Caminho do arquivo não encontrado.');
    }

    const downloadUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-image?path=${encodeURIComponent(image.processed_file_path)}`;

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const response = await fetch(downloadUrl, { headers: { 'Authorization': `Bearer ${token}` } });

      if (!response.ok) {
        throw new Error(`O servidor respondeu com o status ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // @ts-ignore
      const originalFilename = image.uploaded_image?.original_filename || image.processed_file_path.split('/').pop() || 'imagem.jpg';
      link.download = `melhorafoto_${originalFilename}`;
      
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

      toast.success('Download iniciado!');
      
    } catch (error) {
      console.error("DOWNLOAD ERRO:", error);
      toast.error('Não foi possível iniciar o download.');
    }
  };

  if (loading) {
    return ( <div className="min-h-screen bg-gray-50"><Header /><div className="container mx-auto p-8 text-center flex justify-center items-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div></div> );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto p-8 text-center">
            <h1 className="text-2xl font-bold">Projeto não encontrado</h1>
            <Button asChild className="mt-4"><Link to="/professional">Voltar ao Dashboard</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center space-x-2 text-sm text-gray-500 mb-6">
          <Link to="/professional" className="hover:underline">Dashboard Profissional</Link>
          <ChevronRight className="h-4 w-4" />
          <span>{project.name}</span>
        </div>
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <p className="text-gray-600">Cliente: {project.client_name || 'Nenhum cliente associado'}</p>
          </div>
          <div className="flex items-center space-x-2">
            {selectedImageIds.size > 0 && (
              <Button disabled>
                <Download className="mr-2 h-4 w-4" /> Baixar Selecionadas ({selectedImageIds.size})
              </Button>
            )}
            <Button asChild className="bg-gradient-fotoperfeita hover:opacity-90">
              <Link to={`/upload?project=${projectId}`}><Upload className="mr-2 h-4 w-4" /> Adicionar Imagens</Link>
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {images.length > 0 ? (
            images.map(image => {
              // @ts-ignore
              const originalFilePath = image.uploaded_image?.file_path;
              const originalUrl = originalFilePath ? supabase.storage.from('uploaded-images').getPublicUrl(originalFilePath).data.publicUrl : '';
              const processedUrl = supabase.storage.from('uploaded-images').getPublicUrl(image.processed_file_path).data.publicUrl;

              return (
                <Card key={image.id} className="overflow-hidden bg-white shadow-sm">
                  <div className="grid grid-cols-2 relative">
                    <img src={originalUrl} alt="Original" className="w-full h-48 object-cover" />
                    <img src={processedUrl} alt="Processado" className="w-full h-48 object-cover" />
                    <div className="absolute top-2 left-2"><Checkbox checked={selectedImageIds.has(image.id)} onCheckedChange={() => handleImageSelection(image.id)} id={`img-proj-${image.id}`} /></div>
                  </div>
                  <CardFooter className="p-2 bg-gray-50 flex-col items-start gap-2">
                    <Label htmlFor={`img-proj-${image.id}`} className="text-sm font-medium truncate text-gray-700 cursor-pointer">
                      {/* @ts-ignore */}
                      {image.uploaded_image?.original_filename || 'imagem.jpg'}
                    </Label>
                    <Button className="w-full" size="sm" onClick={() => downloadImage(image)}><Download className="mr-2 h-4 w-4" /> Download Individual</Button>
                  </CardFooter>
                </Card>
              )
            })
          ) : (
            <div className="col-span-full bg-white p-8 rounded-lg border shadow-sm text-center">
              <FolderIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold">Nenhuma imagem neste projeto</h3>
              <p className="text-gray-500">Clique em 'Adicionar Imagens' para começar.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
