import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Header from '@/components/Header';
import { toast } from 'sonner';
import { Settings, Package, Users, Plus, Edit, Trash2, DollarSign, ImageIcon, Calendar, Loader2, Crown, Utensils, Car, Home, Zap, Star } from 'lucide-react';
import { adminService, packageService, transactionService, userService } from '@/lib/database';
import type { User as DbUser, Package as PackageType, Transaction as TransactionType, AnalyticsData, PlatformSettings } from '@/lib/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from '@/lib/supabase';
import { Progress } from '@/components/ui/progress';
import { Switch } from "@/components/ui/switch";
import { useAuth } from '@/contexts/AuthContext';

interface AdminStats {
  totalUsers: number;
  totalRevenue: number;
  imagesProcessed: number;
  activeSubscriptions: number;
}

export default function AdminDashboard() {
  const { user, profile, refetchProfile } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<DbUser[]>([]);
  const [packages, setPackages] = useState<PackageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<DbUser | null>(null);
  const [userTransactions, setUserTransactions] = useState<(TransactionType & { packages: { name: string } | null })[]>([]);
  const [isUserDetailsModalOpen, setIsUserDetailsModalOpen] = useState(false);
  const [isUserEditModalOpen, setIsUserEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<DbUser> | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [isUserTransactionsLoading, setIsUserTransactionsLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [settings, setSettings] = useState<Partial<PlatformSettings>>({});
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [packageFormData, setPackageFormData] = useState({ name: '', type: 'avulso' as 'avulso' | 'mensal' | 'profissional', images: 0, price: 0, description: '', sort_order: 1, is_most_popular: false });

  useEffect(() => {
    if (user && !profile) {
      refetchProfile();
    }
  }, [user, profile, refetchProfile]);

  const fetchData = async () => {
    setLoading(true);
    setSettingsLoading(true);
    try {
      const [statsData, usersData, packagesData, settingsData] = await Promise.all([
        adminService.getAppStats(),
        adminService.getAllUsers(),
        packageService.getActivePackages(),
        adminService.getPlatformSettings()
      ]);
      setStats(statsData);
      setUsers(usersData);
      setPackages(packagesData);
      setSettings(settingsData);
    } catch (err) {
      toast.error('Erro ao carregar os dados do painel.');
      console.error(err);
    } finally {
      setLoading(false);
      setSettingsLoading(false);
    }
  };
  
  const fetchAnalyticsData = async (year: number, month: number) => {
    setAnalyticsLoading(true);
    try {
      const data = await adminService.getAnalyticsData(year, month);
      setAnalyticsData(data);
    } catch (err) {
      toast.error('Erro ao carregar os dados de analytics.');
      console.error(err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => { 
    if(profile?.user_type === 'admin') {
      fetchData(); 
    }
  }, [profile]);

  useEffect(() => { 
    if(profile?.user_type === 'admin') {
      fetchAnalyticsData(selectedYear, selectedMonth); 
    }
  }, [profile, selectedYear, selectedMonth]);

  const resetPackageForm = () => { setPackageFormData({ name: '', type: 'avulso', images: 0, price: 0, description: '', sort_order: packages.length + 1, is_most_popular: false }); setEditingPackageId(null); };
  const handleCreateOrUpdatePackage = async () => { if (!packageFormData.name || packageFormData.images <= 0 || packageFormData.price <= 0) { toast.error('Preencha campos obrigatórios.'); return; } setLoading(true); try { if (editingPackageId) { await packageService.updatePackage(editingPackageId, packageFormData); toast.success('Pacote atualizado!'); } else { await packageService.createPackage({ ...packageFormData, is_active: true }); toast.success('Pacote criado!'); } resetPackageForm(); fetchData(); } catch (err) { toast.error('Erro ao salvar o pacote.'); console.error(err); } finally { setLoading(false); } };
  const handleEditPackageClick = (pkg: PackageType) => { setPackageFormData({ name: pkg.name || '', type: pkg.type || 'avulso', images: pkg.images || 0, price: pkg.price || 0, description: pkg.description || '', sort_order: pkg.sort_order || packages.length + 1, is_most_popular: pkg.is_most_popular || false }); setEditingPackageId(pkg.id); };
  const handleDeletePackageClick = async (pkgId: string) => { if (window.confirm('Tem certeza?')) { setLoading(true); try { await packageService.deletePackage(pkgId); toast.success('Pacote excluído!'); fetchData(); } catch (err) { toast.error('Erro ao excluir o pacote.'); console.error(err); } finally { setLoading(false); } } };
  const handleEditUserClick = (user: DbUser) => { setSelectedUser(user); setEditingUser({ name: user.name, user_type: user.user_type }); setIsUserEditModalOpen(true); };
  const handleUpdateUser = async () => { if (!selectedUser || !editingUser) return; setUserLoading(true); try { await userService.updateUser(selectedUser.id, editingUser); toast.success('Usuário atualizado!'); setIsUserEditModalOpen(false); fetchData(); } catch (err) { toast.error('Erro ao atualizar usuário.'); console.error(err); } finally { setUserLoading(false); } };
  const handleResetPassword = async () => { if (!selectedUser || !selectedUser.email) return; const { error } = await supabase.auth.admin.generateLink({ type: 'recovery', email: selectedUser.email }); if (error) { toast.error('Erro ao enviar link.'); } else { toast.success('Link de reset enviado!'); } };
  const handleViewUserClick = async (user: DbUser) => { setSelectedUser(user); setIsUserTransactionsLoading(true); setIsUserDetailsModalOpen(true); try { const transactions = await transactionService.getTransactionsForUser(user.id); setUserTransactions(transactions); } catch (err) { toast.error('Erro ao carregar transações.'); console.error(err); } finally { setIsUserTransactionsLoading(false); } };
  const handleSaveSettings = async () => { try { setSettingsLoading(true); await adminService.updatePlatformSettings(settings); toast.success('Configurações salvas!'); } catch (error) { toast.error('Erro ao salvar.'); console.error(error); } finally { setSettingsLoading(false); } };
  const pricePerImage = packageFormData.images > 0 ? (packageFormData.price / packageFormData.images) : 0;

  if (loading || !profile) { return (<div className="min-h-screen flex items-center justify-center bg-gray-50"><Header /><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>); }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4"><div className="bg-gradient-fotoperfeita p-3 rounded-lg"><Settings className="w-6 h-6 text-white" /></div><div><h1 className="text-3xl font-bold">Painel Administrativo</h1><p className="text-gray-600">Gerencie sua plataforma MelhoraFotoAI</p></div></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Total de Usuários</p><p className="text-2xl font-bold">{stats?.totalUsers.toLocaleString() || '0'}</p></div><Users className="w-8 h-8 text-blue-500" /></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Receita Total</p><p className="text-2xl font-bold">R$ {stats?.totalRevenue.toFixed(2).replace('.', ',') || '0,00'}</p></div><DollarSign className="w-8 h-8 text-green-500" /></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-600">Imagens Processadas</p><p className="text-2xl font-bold">{stats?.imagesProcessed.toLocaleString() || '0'}</p></div><ImageIcon className="w-8 h-8 text-purple-500" /></div></CardContent></Card>
        </div>
        <Tabs defaultValue="packages" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="packages">Pacotes</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings">Configurações</TabsTrigger>
          </TabsList>
          
          <TabsContent value="packages" className="space-y-6"><div className="grid grid-cols-1 lg:grid-cols-2 gap-6"><Card><CardHeader><CardTitle className="flex items-center space-x-2">{editingPackageId ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}<span>{editingPackageId ? 'Editar Pacote' : 'Criar Novo Pacote'}</span></CardTitle><CardDescription>{editingPackageId ? 'Altere os detalhes do pacote existente.' : 'Adicione um novo pacote ou plano à plataforma'}</CardDescription></CardHeader><CardContent className="space-y-4"><div><Label htmlFor="package-name">Nome do Pacote</Label><Input id="package-name" value={packageFormData.name} onChange={(e) => setPackageFormData({ ...packageFormData, name: e.target.value })} placeholder="Ex: Pacote Premium" /></div><div><Label htmlFor="package-type">Tipo</Label><Select value={packageFormData.type} onValueChange={(value: 'avulso' | 'mensal' | 'profissional') => setPackageFormData({ ...packageFormData, type: value })}><SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger><SelectContent><SelectItem value="avulso">Avulso</SelectItem><SelectItem value="mensal">Mensal</SelectItem><SelectItem value="profissional">Profissional</SelectItem></SelectContent></Select></div><div className="grid grid-cols-3 gap-4"><div><Label htmlFor="package-images">Imagens</Label><Input id="package-images" type="number" value={packageFormData.images || ''} onChange={(e) => setPackageFormData({ ...packageFormData, images: Number(e.target.value) })} placeholder="0" /></div><div><Label htmlFor="package-price">Preço (R$)</Label><Input id="package-price" type="number" step="0.01" value={packageFormData.price || ''} onChange={(e) => setPackageFormData({ ...packageFormData, price: Number(e.target.value) })} placeholder="0,00" /></div><div><Label htmlFor="sort-order">Ordem</Label><Input id="sort-order" type="number" value={packageFormData.sort_order} onChange={(e) => setPackageFormData({ ...packageFormData, sort_order: Number(e.target.value) })} placeholder="1" /></div></div>{packageFormData.images > 0 && pricePerImage > 0 && (<p className="text-sm text-gray-600">**Preço por imagem:** R$ {pricePerImage.toFixed(2)}</p>)}<div><Label htmlFor="package-description">Descrição (uma por linha)</Label><Textarea id="package-description" value={packageFormData.description} onChange={(e) => setPackageFormData({ ...packageFormData, description: e.target.value })} placeholder={`Ex:\n5 imagens\nQualidade profissional`} rows={4} /></div><div className="flex items-center space-x-2 mt-4"><Switch id="most-popular" checked={packageFormData.is_most_popular} onCheckedChange={(checked) => setPackageFormData({ ...packageFormData, is_most_popular: checked })} /><Label htmlFor="most-popular">Pacote mais popular?</Label></div><Button onClick={handleCreateOrUpdatePackage} className="w-full">{editingPackageId ? 'Salvar Alterações' : 'Criar Pacote'}</Button>{editingPackageId && (<Button onClick={resetPackageForm} variant="outline" className="w-full mt-2">Cancelar Edição</Button>)}</CardContent></Card><Card><CardHeader><CardTitle className="flex items-center space-x-2"><Package className="w-5 h-5" /><span>Pacotes Existentes</span></CardTitle><CardDescription>Gerencie os pacotes ativos da plataforma</CardDescription></CardHeader><CardContent><div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">{packages?.length === 0 ? (<p className="text-gray-600 text-center py-4">Nenhum pacote cadastrado.</p>) : (packages?.map((pkg) => (<div key={pkg.id} className="flex items-start justify-between p-4 border rounded-lg"><div className="flex-1 pr-4"><div className="flex items-center space-x-2 flex-wrap"><h4 className="font-medium">{pkg.name}</h4><Badge variant={pkg.type === 'profissional' ? 'default' : 'secondary'}>{pkg.type}</Badge>{pkg.is_most_popular && <Badge variant="outline" className="border-orange-500 text-orange-500">Popular</Badge>}</div><p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{pkg.description}</p><div className="flex items-center space-x-4 mt-2 text-xs text-gray-500"><span>{pkg.images} imgs</span><span>R$ {pkg.price.toFixed(2)}</span>{pkg.images > 0 && <span>R$ {(pkg.price / pkg.images).toFixed(2)}/img</span>}<span>Ordem: {pkg.sort_order}</span></div></div><div className="flex flex-col sm:flex-row items-center gap-2"><Button size="sm" variant="outline" onClick={() => handleEditPackageClick(pkg)}><Edit className="w-4 h-4" /></Button><Button size="sm" variant="destructive" onClick={() => handleDeletePackageClick(pkg.id)}><Trash2 className="w-4 h-4" /></Button></div></div>)))}</div></CardContent></Card></div></TabsContent>
          <TabsContent value="users" className="space-y-6"><Card><CardHeader><CardTitle className="flex items-center space-x-2"><Users className="w-5 h-5" /><span>Gerenciar Usuários</span></CardTitle><CardDescription>Visualize e gerencie todos os usuários da plataforma</CardDescription></CardHeader><CardContent><div className="space-y-4">{users?.map((user) => (<div key={user.id} className="flex items-center justify-between p-4 border rounded-lg"><div className="flex-1 pr-4"><div className="flex items-center space-x-2"><h4 className="font-medium">{user.name}</h4><Badge variant={user.user_type === 'admin' ? 'destructive' : user.user_type === 'professional' ? 'default' : 'secondary'}>{user.user_type}</Badge></div><p className="text-sm text-gray-600">{user.email}</p><div className="flex items-center space-x-4 mt-2 text-xs text-gray-500 flex-wrap"><span className="flex items-center space-x-1"><Calendar className="w-3 h-3" /><span>Desde {new Date(user.created_at).toLocaleDateString('pt-BR')}</span></span><span>{user.total_images_processed || 0} imagens</span><span>{(user.total_gasto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div></div><div className="flex flex-col sm:flex-row items-center gap-2"><Button size="sm" variant="outline" onClick={() => handleViewUserClick(user)}>Detalhes</Button><Button size="sm" variant="outline" onClick={() => handleEditUserClick(user)}><Edit className="w-4 h-4" /></Button></div></div>))}</div></CardContent></Card></TabsContent>
          <TabsContent value="analytics" className="space-y-6"><div className="flex items-center space-x-4"><div className="w-48"><Label>Ano</Label><Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2024">2024</SelectItem></SelectContent></Select></div><div className="w-48"><Label>Mês</Label><Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(Number(value))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[...Array(12).keys()].map(i => (<SelectItem key={i + 1} value={(i + 1).toString()}>{new Date(0, i).toLocaleString('pt-BR', { month: 'long' })}</SelectItem>))}</SelectContent></Select></div></div>{analyticsLoading ? (<div className="flex justify-center items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>) : (<div className="space-y-6"><div className="grid grid-cols-1 md:grid-cols-3 gap-6"><Card><CardHeader><CardTitle>Novos Usuários</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{analyticsData?.new_users || 0}</p></CardContent></Card><Card><CardHeader><CardTitle>Receita no Período</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{(analyticsData?.total_revenue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></CardContent></Card><Card><CardHeader><CardTitle>Imagens Processadas</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{analyticsData?.images_processed || 0}</p></CardContent></Card></div><Card><CardHeader><CardTitle>Vendas por Tipo de Pacote</CardTitle></CardHeader><CardContent><div className="space-y-6">{(() => { const salesIcons = { avulso: <Zap className="w-5 h-5 text-yellow-500"/>, mensal: <Star className="w-5 h-5 text-blue-500"/>, profissional: <Crown className="w-5 h-5 text-purple-500"/> }; const salesData = analyticsData?.sales_by_package_type || {}; const totalRevenue = Object.values(salesData).reduce((sum, value: any) => sum + value.total, 0); if (Object.keys(salesData).length === 0) { return <p className="text-sm text-gray-500 text-center py-4">Nenhuma venda no período.</p>; } return Object.entries(salesData).map(([type, data]: [string, any]) => { const percentage = totalRevenue > 0 ? (data.total / totalRevenue) * 100 : 0; return (<div key={type}><div className="flex items-center space-x-4"><div className="p-2 bg-gray-100 rounded-lg">{salesIcons[type as keyof typeof salesIcons] || <Package className="w-5 h-5 text-gray-500" />}</div><div className="flex-1"><p className="font-semibold capitalize">{type}</p><p className="text-sm text-gray-500">{data.count} vendidos</p></div><div className="text-right"><p className="font-bold">{data.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div></div><div className="flex items-center space-x-2 mt-2"><Progress value={percentage} /><span className="text-sm font-medium text-gray-600">{percentage.toFixed(1)}%</span></div></div>); }); })()}</div></CardContent></Card><Card><CardHeader><CardTitle>Processamento por Categoria</CardTitle></CardHeader><CardContent><div className="space-y-6">{(() => { const categoryIcons = { alimentos: <Utensils className="w-5 h-5 text-orange-500"/>, veiculos: <Car className="w-5 h-5 text-red-500"/>, imoveis: <Home className="w-5 h-5 text-green-500"/>, produtos: <Package className="w-5 h-5 text-indigo-500"/> }; const categoryData = analyticsData?.processing_by_category || {}; const totalImages = Object.values(categoryData).reduce((sum, count) => sum + count, 0); if (Object.keys(categoryData).length === 0) { return <p className="text-sm text-gray-500 text-center py-4">Nenhuma imagem processada no período.</p>; } return Object.entries(categoryData).map(([category, count]) => { const percentage = totalImages > 0 ? (count / totalImages) * 100 : 0; return (<div key={category}><div className="flex items-center space-x-4"><div className="p-2 bg-gray-100 rounded-lg">{categoryIcons[category.toLowerCase() as keyof typeof categoryIcons] || <ImageIcon className="w-5 h-5 text-gray-500" />}</div><div className="flex-1"><p className="font-semibold capitalize">{category}</p><div className="flex items-center space-x-2"><Progress value={percentage} /><span className="text-sm font-medium text-gray-600">{percentage.toFixed(1)}%</span></div></div><div className="text-right"><p className="font-bold">{count} imagens</p></div></div></div>); }); })()}</div></CardContent></Card></div>)}</TabsContent>
          <TabsContent value="settings" className="space-y-6">{settingsLoading ? (<div className="flex justify-center items-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>) : (<Card><CardHeader><CardTitle>Configurações da Plataforma</CardTitle><CardDescription>Ajuste as regras e parâmetros globais do MelhoraFotoAI.</CardDescription></CardHeader><CardContent className="space-y-8"><div><h3 className="text-lg font-medium mb-4">Geral e Upload</h3><div className="space-y-4"><div className="flex items-center justify-between p-4 border rounded-lg"><Label htmlFor="free-images">Imagens Grátis para Novos Usuários</Label><Input id="free-images" type="number" className="w-24" value={settings.free_images_for_new_users || ''} onChange={(e) => setSettings({...settings, free_images_for_new_users: Number(e.target.value)})} /></div><div className="flex items-center justify-between p-4 border rounded-lg"><Label htmlFor="max-file-size">Tamanho Máximo do Arquivo (MB)</Label><Input id="max-file-size" type="number" className="w-24" value={settings.max_file_size_mb || ''} onChange={(e) => setSettings({...settings, max_file_size_mb: Number(e.target.value)})} /></div><div className="flex items-center justify-between p-4 border rounded-lg"><Label htmlFor="allowed-file-types">Tipos de Arquivo Permitidos</Label><Input id="allowed-file-types" className="w-1/2" placeholder="image/jpeg, image/png" value={settings.allowed_file_types || ''} onChange={(e) => setSettings({...settings, allowed_file_types: e.target.value})} /></div></div></div><div><h3 className="text-lg font-medium mb-4">Modo de Manutenção</h3><div className="space-y-4"><div className="flex items-center justify-between p-4 border rounded-lg"><div><Label htmlFor="maintenance-mode">Ativar Modo de Manutenção</Label><p className="text-sm text-gray-500">Quando ativo, apenas admins poderão acessar o site.</p></div><Switch id="maintenance-mode" checked={settings.maintenance_mode} onCheckedChange={(checked) => setSettings({...settings, maintenance_mode: checked})} /></div><div className="p-4 border rounded-lg"><Label htmlFor="maintenance-message">Mensagem de Manutenção</Label><Textarea id="maintenance-message" placeholder="Estamos em manutenção para trazer melhorias. Voltamos em breve!" value={settings.maintenance_message || ''} onChange={(e) => setSettings({...settings, maintenance_message: e.target.value})} /></div></div></div><div><h3 className="text-lg font-medium mb-4">Configurações da IA</h3><div className="p-4 border rounded-lg"><Label htmlFor="openai-model">Modelo da OpenAI</Label><Input id="openai-model" placeholder="gpt-4-vision-preview" value={settings.openai_model || ''} onChange={(e) => setSettings({...settings, openai_model: e.target.value})} /></div></div><div className="flex justify-end"><Button onClick={handleSaveSettings}>{settingsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar Configurações</Button></div></CardContent></Card>)}</TabsContent>
        </Tabs>

        <Dialog open={isUserDetailsModalOpen} onOpenChange={setIsUserDetailsModalOpen}><DialogContent><DialogHeader><DialogTitle>Detalhes do Usuário</DialogTitle><DialogDescription>Informações detalhadas sobre {selectedUser?.name || 'usuário'}.</DialogDescription></DialogHeader><div className="space-y-4 py-4"><p><strong>Nome:</strong> {selectedUser?.name || 'N/A'}</p><p><strong>Email:</strong> {selectedUser?.email || 'N/A'}</p><p><strong>Tipo de Usuário:</strong>{selectedUser?.user_type && (<Badge variant={selectedUser.user_type === 'professional' ? 'default' : 'secondary'} className="ml-2">{selectedUser.user_type}</Badge>)}{selectedUser?.user_type === 'admin' && <Badge className="bg-orange-500 ml-2">Admin</Badge>}</p><p><strong>Membro desde:</strong> {selectedUser?.created_at ? new Date(selectedUser.created_at).toLocaleDateString('pt-BR') : 'N/A'}</p><Separator /><p><strong>Imagens Processadas:</strong> {selectedUser?.total_images_processed || '0'}</p>{isUserTransactionsLoading ? (<div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>) : (<div className="space-y-2"><p className="font-semibold">Histórico de Compras:</p>{userTransactions.length > 0 ? (<ul className="list-disc list-inside space-y-1 text-sm">{userTransactions.map((tx) => (<li key={tx.id}><span>{tx.packages?.name || 'Compra Avulsa'} em {new Date(tx.created_at).toLocaleDateString('pt-BR')}</span> - <span className="font-medium">{(tx.amount || 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span></li>))}</ul>) : (<p className="text-sm text-gray-500">Nenhuma compra encontrada.</p>)}</div>)}</div></DialogContent></Dialog>
        <Dialog open={isUserEditModalOpen} onOpenChange={setIsUserEditModalOpen}><DialogContent><DialogHeader><DialogTitle>Editar Usuário</DialogTitle><DialogDescription>Altere as informações de {selectedUser?.name || 'usuário'}.</DialogDescription></DialogHeader><div className="space-y-4 py-4"><div><Label htmlFor="edit-name">Nome</Label><Input id="edit-name" value={editingUser?.name || ''} onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })} /></div><div><Label htmlFor="edit-user-type">Tipo de Usuário</Label><Select value={editingUser?.user_type || 'basic'} onValueChange={(value: DbUser['user_type']) => setEditingUser({ ...editingUser, user_type: value })}><SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger><SelectContent><SelectItem value="basic">Básico</SelectItem><SelectItem value="professional">Profissional</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div><Button onClick={handleUpdateUser} disabled={userLoading} className="w-full">{userLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : 'Salvar Alterações'}</Button><Separator /><Button onClick={handleResetPassword} variant="outline" className="w-full">Enviar Link de Reset de Senha</Button></div></DialogContent></Dialog>
      </div>
    </div>
  );
}
