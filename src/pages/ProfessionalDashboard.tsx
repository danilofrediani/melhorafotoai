import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from "@/components/ui/calendar";
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { clientService, projectService, imageService, reportService, userService } from '@/lib/database';
import type { Client, Project, ProcessedImage } from '@/lib/types';
import { ImageIcon, FolderIcon, BarChart3, Users, Download, Plus, Search, Filter, Loader2, Edit, MoreVertical, XCircle, CalendarIcon, FileDown, KeyRound, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { DateRange } from "react-day-picker";
import { addDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function ProfessionalDashboard() {
  const { user, profile, refetchProfile, isLoadingProfile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [unassignedImages, setUnassignedImages] = useState<ProcessedImage[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({ status: '', clientId: '' });
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectClient, setProjectClient] = useState<string | undefined>(undefined);
  const [projectStatus, setProjectStatus] = useState('active');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [targetProjectId, setTargetProjectId] = useState<string | undefined>();
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: addDays(new Date(), -30), to: new Date() });
  const [userName, setUserName] = useState('');
  const [userDefaultCategory, setUserDefaultCategory] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  useEffect(() => {
    if (user && !profile) {
      refetchProfile();
    }
  }, [user, profile, refetchProfile]);

  const fetchDashboardData = async (showLoadingSpinner = true) => {
    if (!profile?.id) return;
    if (showLoadingSpinner) setLoadingData(true);
    try {
      const [projectsData, clientsData, unassignedImagesData] = await Promise.all([
        projectService.getProjectsForUser(profile.id),
        clientService.getClientsForUser(profile.id),
        imageService.getUnassignedImages(profile.id)
      ]);
      setProjects(projectsData);
      setClients(clientsData);
      setUnassignedImages(unassignedImagesData);
    } catch (error) {
      toast.error("Não foi possível carregar os dados do dashboard.");
    } finally {
      if (showLoadingSpinner) setLoadingData(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchDashboardData();
      setUserName(profile.name);
      setUserDefaultCategory(profile.default_category || 'none');
    }
  }, [profile]);

  useEffect(() => {
    const fetchReport = async () => {
      if (!profile?.id || !dateRange?.from || !dateRange?.to) return;
      setReportLoading(true);
      try {
        const endDate = new Date(dateRange.to);
        endDate.setHours(23, 59, 59, 999);
        const data = await reportService.getReportData( profile.id, dateRange.from.toISOString(), endDate.toISOString() );
        setReportData(data);
      } catch (error) {
        toast.error("Falha ao carregar o relatório.");
      } finally {
        setReportLoading(false);
      }
    };
    if (profile) fetchReport();
  }, [profile, dateRange]);
  
  const handleUpdateProfile = async () => { if (!profile) return; if (!userName.trim()) return toast.error("O nome não pode ficar em branco."); setIsSubmitting(true); try { await userService.updateUser(profile.id, { name: userName, default_category: userDefaultCategory === 'none' ? null : userDefaultCategory, }); await refetchProfile(); toast.success("Perfil atualizado com sucesso!"); } catch (error) { toast.error("Não foi possível atualizar seu perfil."); } finally { setIsSubmitting(false); } };
  const handlePasswordChange = async () => { if (newPassword.length < 6) return toast.error("A nova senha deve ter pelo menos 6 caracteres."); if (newPassword !== confirmNewPassword) return toast.error("As senhas não coincidem."); setIsSubmitting(true); try { const { error } = await supabase.auth.updateUser({ password: newPassword }); if (error) throw error; toast.success("Senha alterada com sucesso!"); setNewPassword(''); setConfirmNewPassword(''); } catch (error) { toast.error("Não foi possível alterar sua senha."); } finally { setIsSubmitting(false); } };
  const handleSaveProject = async () => { if (!projectName.trim() || !profile?.id) return toast.error("O nome do projeto é obrigatório."); setIsSubmitting(true); try { if (editingProject) { await projectService.updateProject(editingProject.id, { name: projectName.trim(), client_id: projectClient, status: projectStatus }); toast.success("Projeto atualizado com sucesso!"); } else { await projectService.createProject({ user_id: profile.id, name: projectName.trim(), client_id: projectClient }); toast.success("Projeto criado com sucesso!"); } closeProjectModal(); await fetchDashboardData(false); } catch (error) { toast.error(`Falha ao salvar o projeto.`); } finally { setIsSubmitting(false); } };
  const handleSaveClient = async () => { if (!clientName.trim() || !profile?.id) return toast.error("O nome do cliente é obrigatório."); setIsSubmitting(true); try { if (editingClient) { await clientService.updateClient(editingClient.id, { name: clientName.trim(), email: clientEmail.trim(), phone: clientPhone.trim(), notes: clientNotes.trim() }); toast.success("Cliente atualizado com sucesso!"); } else { await clientService.createClient({ user_id: profile.id, name: clientName.trim(), email: clientEmail.trim(), phone: clientPhone.trim(), notes: clientNotes.trim() }); toast.success("Cliente criado com sucesso!"); } closeClientModal(); await fetchDashboardData(false); } catch (error) { toast.error(`Falha ao salvar o cliente.`); } finally { setIsSubmitting(false); } };
  const handleImageSelection = (imageId: string) => { setSelectedImageIds(prev => { const newSelection = new Set(prev); if (newSelection.has(imageId)) newSelection.delete(imageId); else newSelection.add(imageId); return newSelection; }); };
  const handleMoveImages = async () => { if (!targetProjectId) return toast.error("Por favor, selecione um projeto de destino."); setIsSubmitting(true); try { await imageService.assignImagesToProject(Array.from(selectedImageIds), targetProjectId); toast.success(`${selectedImageIds.size} imagem(ns) movida(s) com sucesso!`); setSelectedImageIds(new Set()); setIsMoveModalOpen(false); setTargetProjectId(undefined); await fetchDashboardData(false); } catch (error) { toast.error("Falha ao mover as imagens."); } finally { setIsSubmitting(false); } };
  const downloadImage = async (image: ProcessedImage) => { if (!image.processed_file_path) return toast.error('Caminho do arquivo não encontrado.'); const downloadUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-image?path=${encodeURIComponent(image.processed_file_path)}`; try { const token = (await supabase.auth.getSession()).data.session?.access_token; const response = await fetch(downloadUrl, { headers: { 'Authorization': `Bearer ${token}` } }); if (!response.ok) throw new Error(`O servidor respondeu com o status ${response.status}`); const blob = await response.blob(); const url = window.URL.createObjectURL(blob); const link = document.createElement('a'); const originalFilename = (image as any).uploaded_image?.original_filename || image.processed_file_path.split('/').pop() || 'imagem.jpg'; link.href = url; link.download = `melhorafoto_${originalFilename}`; document.body.appendChild(link); link.click(); setTimeout(() => { document.body.removeChild(link); window.URL.revokeObjectURL(url); }, 100); toast.success('Download iniciado!'); } catch (error) { console.error("DOWNLOAD ERRO:", error); toast.error('Não foi possível iniciar o download.'); } };
  const openProjectModal = (project: Project | null = null) => { if (project) { setEditingProject(project); setProjectName(project.name); setProjectClient(project.client_id); setProjectStatus(project.status); } else { setEditingProject(null); setProjectName(''); setProjectClient(undefined); setProjectStatus('active'); } setIsProjectModalOpen(true); };
  const closeProjectModal = () => setIsProjectModalOpen(false);
  const openClientModal = (client: Client | null = null) => { if (client) { setEditingClient(client); setClientName(client.name); setClientEmail(client.email || ''); setClientPhone(client.phone || ''); setClientNotes(client.notes || ''); } else { setEditingClient(null); setClientName(''); setClientEmail(''); setClientPhone(''); setClientNotes(''); } setIsClientModalOpen(true); };
  const closeClientModal = () => setIsClientModalOpen(false);
  const formatDate = (dateString?: string) => dateString ? new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'N/A';
  const getStatusBadge = (status: string) => { const variants = { 'active': 'default', 'completed': 'secondary', 'archived': 'outline' } as const; const labels = { 'active': 'Ativo', 'completed': 'Concluído', 'archived': 'Arquivado' }; return <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>{labels[status as keyof typeof labels] || status}</Badge>; };
  const handleFilterChange = (filterType: 'status' | 'clientId', value: string) => { setActiveFilters(prev => ({ ...prev, [filterType]: value === 'all' ? '' : value })); };
  const clearFilters = () => { setActiveFilters({ status: '', clientId: '' }); };
  const hasActiveFilters = !!activeFilters.status || !!activeFilters.clientId;
  const filteredProjects = projects.filter(project => { const searchMatch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) || project.client_name?.toLowerCase().includes(searchTerm.toLowerCase()); const statusMatch = activeFilters.status ? project.status === activeFilters.status : true; const clientMatch = activeFilters.clientId ? project.client_id === activeFilters.clientId : true; return searchMatch && statusMatch && clientMatch; });
  const getBarChartData = () => { if (!reportData?.detailed_images) return []; const imagesByClient = reportData.detailed_images.reduce((acc: any, image: any) => { const clientName = image.client_name || 'Sem Cliente'; acc[clientName] = (acc[clientName] || 0) + 1; return acc; }, {}); return Object.keys(imagesByClient).map(name => ({ name, Imagens: imagesByClient[name] })); };
  const getTimeseriesChartData = () => { if (!reportData?.detailed_images) return []; const imagesByDate = reportData.detailed_images.reduce((acc: any, image: any) => { const date = format(parseISO(image.created_at), 'dd/MM'); acc[date] = (acc[date] || 0) + 1; return acc; }, {}); return Object.keys(imagesByDate).map(date => ({ date, Imagens: imagesByDate[date] })).reverse(); };
  const barChartData = getBarChartData();
  const timeseriesChartData = getTimeseriesChartData();
  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;
  const totalClients = clients.length;
  const totalImagesProcessed = projects.reduce((sum, p) => sum + (p.images[0]?.count || 0), 0);
  const remainingImages = profile?.remaining_images ?? 0;

  if (isLoadingProfile || !profile) {
    return ( <div className="min-h-screen bg-gray-50"><Header /><div className="container mx-auto p-8 h-[calc(100vh-80px)] text-center flex justify-center items-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div></div> );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard Profissional - <span className="text-primary">{profile?.name}</span></h1>
          <p className="text-gray-600">Gerencie seus projetos e clientes</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Projetos Ativos</CardTitle><FolderIcon className="h-4 w-4 text-primary" /></CardHeader><CardContent><div className="text-2xl font-bold">{activeProjects}</div><p className="text-xs text-muted-foreground">{completedProjects} concluídos / {totalProjects} no total</p></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Clientes</CardTitle><Users className="h-4 w-4 text-blue-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{totalClients}</div><p className="text-xs text-muted-foreground">Clientes ativos</p></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Imagens Processadas</CardTitle><BarChart3 className="h-4 w-4 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold">{totalImagesProcessed}</div><p className="text-xs text-muted-foreground">Imagens nos projetos</p></CardContent></Card>
          <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Créditos Restantes</CardTitle><ImageIcon className="h-4 w-4 text-primary" /></CardHeader><CardContent><div className="text-2xl font-bold">{remainingImages}</div><p className="text-xs text-muted-foreground">Imagens disponíveis</p></CardContent></Card>
        </div>
        <Tabs defaultValue="projects" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="projects">Projetos</TabsTrigger>
            <TabsTrigger value="unassigned">Imagens Avulsas</TabsTrigger>
            <TabsTrigger value="clients">Clientes</TabsTrigger>
            <TabsTrigger value="reports">Relatórios</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>
          <TabsContent value="projects" className="space-y-6">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-bold">Meus Projetos</h2><Button onClick={() => openProjectModal()} className="bg-gradient-fotoperfeita hover:opacity-90"><Plus className="mr-2 h-4 w-4" /> Novo Projeto</Button></div>
            <div className="flex items-end space-x-4"><div className="flex-1"><Label htmlFor="search">Buscar projetos</Label><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><Input id="search" placeholder="Nome do projeto ou cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" /></div></div><Popover><PopoverTrigger asChild><Button variant="outline"><Filter className="mr-2 h-4 w-4" /> Filtros {hasActiveFilters && <span className="ml-2 h-2 w-2 rounded-full bg-primary animate-pulse" />}</Button></PopoverTrigger><PopoverContent className="w-64" align="end"><div className="space-y-4"><div className="space-y-2"><Label>Filtrar por Status</Label><Select value={activeFilters.status} onValueChange={(value) => handleFilterChange('status', value)}><SelectTrigger><SelectValue placeholder="Todos os status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem><SelectItem value="active">Ativo</SelectItem><SelectItem value="completed">Concluído</SelectItem><SelectItem value="archived">Arquivado</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Filtrar por Cliente</Label><Select value={activeFilters.clientId} onValueChange={(value) => handleFilterChange('clientId', value)}><SelectTrigger><SelectValue placeholder="Todos os clientes" /></SelectTrigger><SelectContent><SelectItem value="all">Todos os clientes</SelectItem>{clients.map(client => (<SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>))}</SelectContent></Select></div>{hasActiveFilters && ( <Button variant="ghost" size="sm" className="w-full" onClick={clearFilters}><XCircle className="mr-2 h-4 w-4" /> Limpar Filtros</Button> )}</div></PopoverContent></Popover></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{filteredProjects.length > 0 ? (filteredProjects.map((project) => (<Card key={project.id} className="flex flex-col"><CardHeader><div className="flex justify-between items-start"><CardTitle className="text-lg line-clamp-2">{project.name}</CardTitle><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="-mr-2 h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onClick={() => openProjectModal(project)}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem><DropdownMenuItem disabled><Download className="mr-2 h-4 w-4" />Baixar ZIP</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div><CardDescription>{project.client_name || 'Sem cliente associado'}</CardDescription></CardHeader><CardContent className="flex-grow"><div className="space-y-2"><div className="flex items-center justify-between text-sm"><span className="text-gray-500">Imagens:</span><span className="font-medium">{project.images[0]?.count || 0}</span></div><div className="flex items-center justify-between text-sm"><span className="text-gray-500">Status:</span>{getStatusBadge(project.status)}</div></div></CardContent><CardFooter><Button asChild variant="outline" className="w-full"><Link to={`/project/${project.id}`}><FolderIcon className="mr-2 h-4 w-4" /> Abrir Projeto</Link></Button></CardFooter></Card>))) : ( <div className="col-span-3 text-center py-12"><FolderIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" /><h3 className="text-xl font-semibold">Nenhum projeto encontrado</h3><p className="text-gray-500">Crie um novo projeto ou limpe os filtros para visualizar.</p></div> )}</div>
          </TabsContent>
          <TabsContent value="unassigned" className="space-y-6"><div className="flex justify-between items-center"><div><h2 className="text-2xl font-bold">Imagens Avulsas</h2><p className="text-gray-600">Imagens que não pertencem a um projeto. Organize-as aqui.</p></div><div className="flex space-x-2"><Button disabled={selectedImageIds.size === 0}><Download className="mr-2 h-4 w-4" /> Baixar Selecionadas ({selectedImageIds.size})</Button><Button onClick={() => setIsMoveModalOpen(true)} disabled={selectedImageIds.size === 0}><FolderIcon className="mr-2 h-4 w-4" /> Mover Selecionadas ({selectedImageIds.size})</Button></div></div><div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">{unassignedImages.length > 0 ? (unassignedImages.map(image => { const processedUrl = supabase.storage.from('uploaded-images').getPublicUrl(image.processed_file_path).data.publicUrl; return (<Card key={image.id} className="overflow-hidden"><div className="relative group"><img src={processedUrl} alt="Imagem processada" className="aspect-square w-full object-cover transition-transform group-hover:scale-105" /><div className="absolute top-2 left-2"><Checkbox checked={selectedImageIds.has(image.id)} onCheckedChange={() => handleImageSelection(image.id)} id={`img-${image.id}`} /></div><div className="absolute top-2 right-2"><Button size="icon" variant="secondary" className="h-8 w-8" onClick={() => downloadImage(image)}><Download className="h-4 w-4" /></Button></div></div><CardFooter className="p-2 bg-gray-50"><Label htmlFor={`img-${image.id}`} className="text-xs text-gray-700 truncate cursor-pointer">{(image as any).uploaded_image?.original_filename || 'imagem.jpg'}</Label></CardFooter></Card>)})) : ( <div className="col-span-full text-center py-12"><ImageIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" /><h3 className="text-xl font-semibold">Nenhuma imagem avulsa</h3><p className="text-gray-500">Use o botão "Upload" no menu principal para adicionar imagens aqui.</p></div> )}</div></TabsContent>
          <TabsContent value="clients" className="space-y-6"><div className="flex justify-between items-center"><div><h2 className="text-2xl font-bold">Meus Clientes</h2><p className="text-gray-600">Gerencie as informações dos seus clientes</p></div><Button onClick={() => openClientModal()} className="bg-gradient-fotoperfeita hover:opacity-90"><Plus className="mr-2 h-4 w-4" /> Novo Cliente</Button></div><Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full">
            <thead className="border-b"><tr><th className="text-left p-4 font-medium">Cliente</th><th className="text-left p-4 font-medium">Projetos</th><th className="text-left p-4 font-medium">Criado em</th><th className="text-right p-4 font-medium">Ações</th></tr></thead>
            <tbody>{clients.length > 0 ? (clients.map((client) => (<tr key={client.id} className="border-b hover:bg-gray-50"><td className="p-4"><div><p className="font-medium">{client.name}</p><p className="text-sm text-gray-500">{client.email}</p></div></td><td className="p-4">{projects.filter(p => p.client_id === client.id).length}</td><td className="p-4">{formatDate(client.created_at)}</td><td className="p-4 text-right"><Button size="sm" variant="outline" onClick={() => openClientModal(client)}><Edit className="mr-2 h-3 w-3" /> Editar</Button></td></tr>))) : ( <tr><td colSpan={4} className="text-center p-8 text-gray-500">Nenhum cliente cadastrado.</td></tr> )}</tbody>
          </table></div></CardContent></Card></TabsContent>
          <TabsContent value="reports" className="space-y-6"><div className="flex justify-between items-center"><div><h2 className="text-2xl font-bold">Relatórios</h2><p className="text-gray-600">Analise sua performance e o uso de imagens por período.</p></div><Button disabled><FileDown className="mr-2 h-4 w-4" /> Exportar CSV (em breve)</Button></div><div className="flex items-center space-x-4"><Popover><PopoverTrigger asChild><Button id="date" variant={"outline"} className="w-[300px] justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{dateRange?.from ? ( dateRange.to ? ( <>{format(dateRange.from, "dd MMM, y", { locale: ptBR })} - {format(dateRange.to, "dd MMM, y", { locale: ptBR })}</> ) : ( format(dateRange.from, "dd MMM, y", { locale: ptBR }) ) ) : ( <span>Selecione um período</span> )}</Button></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR} /></PopoverContent></Popover></div>{reportLoading ? ( <div className="flex justify-center items-center py-20"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div> ) : reportData ? ( <div className="space-y-6"><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><Card><CardHeader><CardTitle>Imagens Processadas</CardTitle><CardDescription>no período</CardDescription></CardHeader><CardContent><p className="text-3xl font-bold">{reportData.total_images_processed}</p></CardContent></Card><Card><CardHeader><CardTitle>Projetos Criados</CardTitle><CardDescription>no período</CardDescription></CardHeader><CardContent><p className="text-3xl font-bold">{reportData.total_projects_in_period}</p><p className="text-sm text-muted-foreground">{reportData.completed_projects_in_period} concluídos</p></CardContent></Card><Card><CardHeader><CardTitle>Novos Clientes</CardTitle><CardDescription>no período</CardDescription></CardHeader><CardContent><p className="text-3xl font-bold">{reportData.new_clients}</p></CardContent></Card></div><Card><CardHeader><CardTitle>Uso de Imagens por Cliente</CardTitle><CardDescription>Total de imagens processadas por cliente no período selecionado.</CardDescription></CardHeader><CardContent className="pl-0"><ResponsiveContainer width="100%" height={300}><BarChart data={barChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip cursor={{fill: 'rgba(239, 246, 255, 0.5)'}} /><Legend /><Bar dataKey="Imagens" fill="#8A69D3" name="Imagens Processadas" /></BarChart></ResponsiveContainer></CardContent></Card><Card><CardHeader><CardTitle>Produtividade por Dia</CardTitle><CardDescription>Total de imagens processadas por dia no período selecionado.</CardDescription></CardHeader><CardContent className="pl-0"><ResponsiveContainer width="100%" height={300}><LineChart data={timeseriesChartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Line type="monotone" dataKey="Imagens" stroke="#2BC2C9" strokeWidth={2} name="Imagens Processadas" /></LineChart></ResponsiveContainer></CardContent></Card><Card><CardHeader><CardTitle>Detalhes das Imagens Processadas no Período</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full"><thead className="border-b"><tr><th className="text-left p-3 font-medium">Data</th><th className="text-left p-3 font-medium">Arquivo Original</th><th className="text-left p-3 font-medium">Projeto</th><th className="text-left p-3 font-medium">Cliente</th></tr></thead><tbody>{reportData.detailed_images.length > 0 ? ( reportData.detailed_images.map((image: any) => (<tr key={image.id} className="border-b hover:bg-gray-50"><td className="p-3">{formatDate(image.created_at)}</td><td className="p-3 truncate max-w-xs">{image.original_filename}</td><td className="p-3">{image.project_name || '--'}</td><td className="p-3">{image.client_name || '--'}</td></tr>)) ) : ( <tr><td colSpan={4} className="text-center p-8 text-gray-500">Nenhuma imagem processada no período selecionado.</td></tr> )}</tbody></table></div></CardContent></Card></div> ) : ( <div className="text-center py-20"><p>Não foi possível carregar os dados do relatório.</p></div> )}
          </TabsContent>
          <TabsContent value="settings" className="space-y-6"><div><h2 className="text-2xl font-bold">Configurações da Conta</h2><p className="text-gray-600">Gerencie suas preferências e dados da conta.</p></div><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><Card><CardHeader><CardTitle className="flex items-center"><UserCog className="mr-2 h-5 w-5"/>Dados e Preferências</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-1"><Label htmlFor="profile-name">Seu Nome</Label><Input id="profile-name" value={userName} onChange={(e) => setUserName(e.target.value)} /></div><div className="space-y-1"><Label htmlFor="default-category">Categoria Padrão para Upload</Label><Select value={userDefaultCategory} onValueChange={(value) => setUserDefaultCategory(value)}><SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger><SelectContent><SelectItem value="none">Nenhuma</SelectItem><SelectItem value="alimentos">Alimentos</SelectItem><SelectItem value="veiculos">Veículos</SelectItem><SelectItem value="imoveis">Imóveis</SelectItem><SelectItem value="produtos">Produtos</SelectItem></SelectContent></Select><p className="text-xs text-muted-foreground">Esta categoria será pré-selecionada na página de upload.</p></div></CardContent><CardFooter><Button onClick={handleUpdateProfile} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Salvar Alterações</Button></CardFooter></Card><Card><CardHeader><CardTitle className="flex items-center"><KeyRound className="mr-2 h-5 w-5"/>Alterar Senha</CardTitle></CardHeader><CardContent className="space-y-4"><div className="space-y-1"><Label htmlFor="new-password">Nova Senha</Label><Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" /></div><div className="space-y-1"><Label htmlFor="confirm-password">Confirmar Nova Senha</Label><Input id="confirm-password" type="password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} /></div></CardContent><CardFooter><Button onClick={handlePasswordChange} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Alterar Senha</Button></CardFooter></Card></div></TabsContent>
        </Tabs>
      </div>
      <Dialog open={isProjectModalOpen} onOpenChange={closeProjectModal}><DialogContent className="sm:max-w-[425px]"><DialogHeader><DialogTitle>{editingProject ? 'Editar Projeto' : 'Criar Novo Projeto'}</DialogTitle><DialogDescription>{editingProject ? 'Altere as informações.' : 'Dê um nome e associe a um cliente.'}</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="project-name" className="text-right">Nome</Label><Input id="project-name" value={projectName} onChange={(e) => setProjectName(e.target.value)} className="col-span-3" /></div><div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="project-client" className="text-right">Cliente</Label><div className="col-span-3"><Select onValueChange={(value) => setProjectClient(value === 'none' ? undefined : value)} value={projectClient || 'none'}><SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger><SelectContent><SelectItem value="none">Nenhum</SelectItem>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div></div>{editingProject && ( <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="project-status" className="text-right">Status</Label><Select onValueChange={(value) => setProjectStatus(value)} value={projectStatus}><SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Ativo</SelectItem><SelectItem value="completed">Concluído</SelectItem><SelectItem value="archived">Arquivado</SelectItem></SelectContent></Select></div> )}</div><DialogFooter><Button type="submit" onClick={handleSaveProject} disabled={isSubmitting}>{isSubmitting && <Loader2 />} Salvar</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={isClientModalOpen} onOpenChange={closeClientModal}><DialogContent className="sm:max-w-[425px]"><DialogHeader><DialogTitle>{editingClient ? 'Editar Cliente' : 'Criar Cliente'}</DialogTitle><DialogDescription>{editingClient ? 'Altere as informações.' : 'Adicione um novo cliente.'}</DialogDescription></DialogHeader><div className="grid gap-4 py-4"><div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">Nome</Label><Input value={clientName} onChange={(e) => setClientName(e.target.value)} className="col-span-3" /></div><div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">Email</Label><Input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="col-span-3" /></div><div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">Telefone</Label><Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} className="col-span-3" /></div><div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">Notas</Label><Textarea value={clientNotes} onChange={(e) => setClientNotes(e.target.value)} className="col-span-3" /></div></div><DialogFooter><Button type="submit" onClick={handleSaveClient} disabled={isSubmitting}>{isSubmitting && <Loader2 />} Salvar</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={isMoveModalOpen} onOpenChange={setIsMoveModalOpen}><DialogContent><DialogHeader><DialogTitle>Mover Imagens</DialogTitle><DialogDescription>Selecione o projeto para as {selectedImageIds.size} imagem(ns).</DialogDescription></DialogHeader><div className="py-4"><Label>Projeto de Destino</Label><Select onValueChange={setTargetProjectId}><SelectTrigger><SelectValue placeholder="Selecione um projeto" /></SelectTrigger><SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select></div><DialogFooter><Button onClick={handleMoveImages} disabled={isSubmitting}>{isSubmitting ? <Loader2 /> : null} Mover Imagens</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
