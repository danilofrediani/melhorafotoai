import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { ImageIcon, Upload, CreditCard, Download, Star, TrendingUp, History, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { ProcessedImage, Transaction } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import { imageService, subscriptionService, transactionService } from '@/lib/database';
import { toast } from 'sonner';

const categoryEmoji = { 'alimentos': '🍕', 'veiculos': '🚗', 'imoveis': '🏠', 'produtos': '📦' };

export default function Dashboard() {
  const { user, profile, refetchProfile, isLoadingProfile } = useAuth();

  const [imageHistory, setImageHistory] = useState<ProcessedImage[]>([]);
  const [transactions, setTransactions] = useState<(Transaction & { packages: { name: string } | null })[]>([]);
  const [activeSubscription, setActiveSubscription] = useState<{ packageName: string } | null>(null);
  const [isLoadingPageData, setIsLoadingPageData] = useState(true);

  useEffect(() => {
    // Se o AuthContext nos informa que tem um usuário logado, mas o perfil detalhado
    // ainda não foi carregado para o contexto, nós pedimos para ele carregar.
    if (user && !profile) {
      refetchProfile();
    }
  }, [user, profile, refetchProfile]);

  useEffect(() => {
    const loadPageData = async () => {
      // Só buscamos os dados da página (imagens, transações, etc.)
      // se o perfil do usuário já estiver disponível no AuthContext.
      if (profile) {
        setIsLoadingPageData(true);
        try {
          const imagesPromise = imageService.getProcessedImagesForUser(profile.id);
          const subscriptionPromise = subscriptionService.getActiveSubscription(profile.id);
          const transactionsPromise = transactionService.getTransactionsForUser(profile.id);

          const [images, subscription, userTransactions] = await Promise.all([
            imagesPromise, subscriptionPromise, transactionsPromise
          ]);
          
          setImageHistory(images);
          setTransactions(userTransactions);
          if (subscription && subscription.packages) {
            setActiveSubscription({ packageName: subscription.packages.name });
          }
        } catch (error) {
          toast.error("Erro ao carregar os dados do painel.");
          console.error(error);
        } finally {
          setIsLoadingPageData(false);
        }
      }
    };
    loadPageData();
  }, [profile]);

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  // Condição de carregamento: mostra se o perfil ou os dados da página estiverem carregando.
  if (isLoadingProfile || (user && !profile)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto p-8 text-center flex justify-center items-center h-[calc(100vh-80px)]">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
        </div>
      </div>
    );
  }
  
  if (!profile) {
     return (
        <div className="min-h-screen bg-gray-50">
           <Header />
           <div className="container mx-auto p-8 text-center">
             <p>Não foi possível carregar seu perfil. Por favor, faça o login.</p>
             <Button asChild className="mt-4"><Link to="/login">Ir para Login</Link></Button>
           </div>
        </div>
    )
  }

  const totalImagesProcessed = imageHistory.length;
  const totalDownloads = profile.download_count ?? 0;
  const categoryStats = imageHistory.reduce((acc, img) => {
    if (img.processing_type) { acc[img.processing_type] = (acc[img.processing_type] || 0) + 1; }
    return acc;
  }, {} as Record<string, number>);
  const mostUsedCategory = Object.entries(categoryStats).sort(([, a], [, b]) => b - a)[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Bem-vindo, {profile.name}!</h1>
          <p className="text-gray-600">Gerencie suas imagens e acompanhe seu uso</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Imagens Restantes</CardTitle><ImageIcon className="h-4 w-4 text-primary" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{profile.remaining_images ?? 0}</div><p className="text-xs text-muted-foreground mt-2">Créditos disponíveis para uso</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Imagens Processadas</CardTitle><TrendingUp className="h-4 w-4 text-green-500" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{totalImagesProcessed}</div><p className="text-xs text-muted-foreground">Total de imagens melhoradas</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Downloads</CardTitle><Download className="h-4 w-4 text-blue-500" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{totalDownloads}</div><p className="text-xs text-muted-foreground">Total de downloads realizados</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Categoria Favorita</CardTitle><Star className="h-4 w-4 text-yellow-500" /></CardHeader>
            <CardContent><div className="text-2xl font-bold">{mostUsedCategory ? categoryEmoji[mostUsedCategory[0] as keyof typeof categoryEmoji] : '📷'}</div><p className="text-xs text-muted-foreground">{mostUsedCategory ? `${mostUsedCategory[0]} (${mostUsedCategory[1]})` : 'Nenhuma'}</p></CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader><CardTitle>Ações Rápidas</CardTitle><CardDescription>Comece a usar o MelhoraFotoAI agora</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <Button className="w-full bg-gradient-fotoperfeita hover:opacity-90" asChild><Link to="/upload"><Upload className="mr-2 h-4 w-4" />Fazer Upload</Link></Button>
                <Button variant="outline" className="w-full" asChild><Link to="/pricing"><CreditCard className="mr-2 h-4 w-4" />Comprar Planos ou Créditos</Link></Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Meu Plano</CardTitle><CardDescription>Status do seu plano atual</CardDescription></CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-4">
                  <div>
                    <p className="font-medium">{activeSubscription ? activeSubscription.packageName : 'Pacotes Avulsos'}</p>
                    <p className="text-sm text-gray-500">{profile.remaining_images ?? 0} imagens restantes</p>
                  </div>
                  <Badge variant={activeSubscription ? "default" : "secondary"}>{activeSubscription ? 'Assinatura Ativa' : 'Créditos'}</Badge>
                </div>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full"><History className="mr-2 h-4 w-4" /> Ver Histórico de Compras</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Histórico de Compras</DialogTitle></DialogHeader>
                    <div className="space-y-3 max-h-80 overflow-y-auto p-2">
                      {transactions.length > 0 ? transactions.map(t => (
                        <div key={t.id} className="flex justify-between items-center text-sm border-b pb-2">
                          <div>
                            <p className="font-medium">{t.packages?.name || 'Compra Avulsa'}</p>
                            <p className="text-gray-500">{formatDate(t.created_at)}</p>
                          </div>
                          <p className="font-semibold">R$ {t.amount?.toFixed(2)}</p>
                        </div>
                      )) : <p className="text-sm text-center text-gray-500 py-4">Nenhuma transação encontrada.</p>}
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Imagens</CardTitle>
            <CardDescription>Suas imagens processadas recentemente</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPageData ? <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto"/></div> :
             imageHistory.length > 0 ? (
              <div className="space-y-4">
                {imageHistory.slice(0, 5).map((image) => (
                  <div key={image.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      <div className="text-2xl">{categoryEmoji[image.processing_type as keyof typeof categoryEmoji] || '📷'}</div>
                      <div>
                        <p className="font-medium text-sm truncate max-w-xs">{image.processed_file_path?.split('/').pop()}</p>
                        <p className="text-xs text-gray-500">{formatDate(image.created_at)}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline"><Download className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <ImageIcon className="h-10 w-10 mx-auto mb-3" />
                <p>Nenhuma imagem processada ainda.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
