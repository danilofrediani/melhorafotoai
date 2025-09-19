// src/pages/Dashboard.tsx
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { ImageIcon, Upload, CreditCard, Download, Star, TrendingUp, History, Loader2, PlayCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import type { ProcessedImage, Transaction } from '@/lib/types';
import { useEffect, useState } from 'react';
import { imageService, transactionService } from '@/lib/database';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const forceDownload = async (url: string, filename: string) => {
  try {
    toast.info('Preparando download...');
    const response = await fetch(url);
    if (!response.ok) throw new Error('Não foi possível buscar a imagem para download.');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
    toast.success('Download iniciado!');
  } catch (error: any) {
    console.error("Erro no download forçado:", error);
    toast.error(error.message || 'Falha ao iniciar o download.');
  }
};

const categoryEmoji = { 'alimentos': '🍕', 'produtos': '📦' };

type ProcessedImageWithOriginal = ProcessedImage & {
  uploaded_images: { original_filename: string } | null;
};

declare global {
  interface Window {
    MFBridge?: {
      requestReward?: (amount: number) => void;
      setAdsEnabled?: (enabled: boolean) => void;
    };
  }
}

export default function Dashboard() {
  const { user, profile, refreshProfile, isLoading: isLoadingProfile } = useAuth();

  const [imageHistory, setImageHistory] = useState<ProcessedImageWithOriginal[]>([]);
  const [transactions, setTransactions] = useState<(Transaction & { packages: { name: string } | null })[]>([]);
  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

  // cooldown de 5s para botão de vídeo
  const [isRewardCooldown, setIsRewardCooldown] = useState(false);

  // ===== Listener de recompensa (chama Edge Function e atualiza saldo) =====
  useEffect(() => {
    const onRewardGranted = async (evt: any) => {
      const amount = Number(evt?.detail?.amount ?? 1);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error('Faça login para receber créditos.');
          return;
        }
        const { data, error } = await supabase.functions.invoke('ad-reward', {
          body: { amount, device_hint: 'rewarded-listener' }
        });
        if (error) {
          const msg = (error as any)?.message || '';
          if (msg.includes('DAILY_LIMIT')) {
            toast.info('Você já ganhou todos os créditos gratuitos hoje. Volte amanhã!');
          } else {
            toast.error('Erro ao creditar recompensa.');
          }
          console.error('[REWARD] erro:', error);
          return;
        }
        toast.success(`+${amount} crédito(s) adicionados!`);
        await refreshProfile();
        console.log('[REWARD] ok:', data);
      } catch (e) {
        console.error('[REWARD] exceção:', e);
        toast.error('Não foi possível registrar o crédito.');
      }
    };

    window.addEventListener('REWARD_GRANTED', onRewardGranted as EventListener);
    console.log('Listener REWARD_GRANTED instalado.');
    return () => window.removeEventListener('REWARD_GRANTED', onRewardGranted as EventListener);
  }, [refreshProfile]);
  // =======================================================================

  useEffect(() => {
    if (user && !profile) {
      refreshProfile();
    }
  }, [user, profile, refreshProfile]);

  useEffect(() => {
    const loadPageData = async () => {
      if (profile) {
        setIsLoadingPageData(true);
        try {
          const imagesPromise = imageService.getProcessedImagesForUser(profile.id);
          const transactionsPromise = transactionService.getTransactionsForUser(profile.id);
          const [images, userTransactions] = await Promise.all([imagesPromise, transactionsPromise]);
          setImageHistory(images as ProcessedImageWithOriginal[]);
          setTransactions(userTransactions);
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

  // ===== Regra: esconder anúncios se já comprou e tem saldo > 0 =====
  const hasAnyPurchase = transactions.length > 0;
  const hasBalance = (profile?.remaining_images ?? 0) > 0;
  const showAds = !(hasAnyPurchase && hasBalance);

  useEffect(() => {
    try {
      window.MFBridge?.setAdsEnabled?.(showAds);
    } catch {}
  }, [showAds]);
  // ===================================================================

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const friendlyTitle = (img: ProcessedImageWithOriginal): string => {
    const raw = img.uploaded_images?.original_filename || '';
    const created = new Date(img.created_at ?? Date.now());
    const when = created.toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    if (!raw) return `Foto ${when}`;
    const base = raw.replace(/\.[^/.]+$/, '');
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(base);
    const isLongHash = /^[A-Za-z0-9_-]{20,}$/.test(base);
    const isDigits = /^\d{12,}$/.test(base);
    const isCameraPattern =
      /^PXL_\d{8}_\d{6}/.test(base) || /^IMG_\d{8}_\d{6}/.test(base) || /^image-\d+/.test(base);
    if (isUUID || isLongHash || isDigits || isCameraPattern) return `Foto ${when}`;
    if (base.length > 40) return base.slice(0, 37) + '...';
    return base;
  };

  const friendlyDownloadName = (img: ProcessedImageWithOriginal): string => {
    const title = friendlyTitle(img).replace(/[^\p{L}\p{N}\s._-]/gu, '');
    return `${title}_melhorada.png`;
  };

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

  const handleDownloadClick = async (url: string, filename: string) => {
    setIsDownloading(true);
    await forceDownload(url, filename);
    setIsDownloading(false);
  };

  const totalImagesProcessed = imageHistory.length;
  // @ts-ignore
  const totalDownloads = profile.download_count ?? 0;
  const categoryStats = imageHistory.reduce((acc, img) => {
    if (img.processing_type) { acc[img.processing_type] = (acc[img.processing_type] || 0) + 1; }
    return acc;
  }, {} as Record<string, number>);
  const mostUsedCategory = Object.entries(categoryStats).sort(([, a], [, b]) => b - a)[0];
  const lastTransaction = transactions?.[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Bem-vindo, {profile.name}!</h1>
          <p className="text-gray-600">Gerencie suas imagens e acompanhe seu uso</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
              <CardDescription>Comece a usar o MelhoraFotoAI agora</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full bg-gradient-fotoperfeita hover:opacity-90" asChild>
                <Link to="/upload"><Upload className="mr-2 h-4 w-4" />Fazer Upload</Link>
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/pricing"><CreditCard className="mr-2 h-4 w-4" />Comprar Planos ou Créditos</Link>
              </Button>

              {/* Botão de vídeo com cooldown */}
              {showAds && (
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={isRewardCooldown}
                  onClick={() => {
                    if (!window.MFBridge?.requestReward) {
                      toast.info('Esse recurso está disponível no app Android.');
                      return;
                    }
                    try {
                      window.MFBridge.requestReward(1);
                      setIsRewardCooldown(true);
                      setTimeout(() => setIsRewardCooldown(false), 5000);
                    } catch (err) {
                      console.error(err);
                      toast.error('Não foi possível iniciar o anúncio.');
                    }
                  }}
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  {isRewardCooldown ? "Aguarde..." : "Ganhar 1 crédito assistindo vídeo"}
                </Button>
              )}

              {!showAds && (
                <p className="text-xs text-green-600 text-center">
                  Você está sem anúncios enquanto tiver créditos.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Seus Créditos</CardTitle>
              <CardDescription>Status dos seus créditos e compras</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-4">
                <div>
                  <p className="font-medium">{lastTransaction ? 'Última compra:' : 'Créditos Iniciais'}</p>
                  <p className="text-sm text-gray-500">{lastTransaction?.packages?.name || 'Pacote de boas-vindas'}</p>
                </div>
                <Badge variant="secondary">{profile.remaining_images ?? 0} restantes</Badge>
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <History className="mr-2 h-4 w-4" /> Ver Histórico de Compras
                  </Button>
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

        {/* Métricas rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Imagens Restantes</CardTitle>
              <ImageIcon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profile.remaining_images ?? 0}</div>
              <p className="text-xs text-muted-foreground mt-2">Créditos disponíveis para uso</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Imagens Processadas</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalImagesProcessed}</div>
              <p className="text-xs text-muted-foreground">Total de imagens melhoradas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Downloads</CardTitle>
              <Download className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalDownloads}</div>
              <p className="text-xs text-muted-foreground">Total de downloads realizados</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categoria Favorita</CardTitle>
              <Star className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {mostUsedCategory ? categoryEmoji[mostUsedCategory[0] as keyof typeof categoryEmoji] : '📷'}
              </div>
              <p className="text-xs text-muted-foreground">
                {mostUsedCategory ? `${mostUsedCategory[0]} (${mostUsedCategory[1]})` : 'Nenhuma'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Histórico de imagens */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Imagens</CardTitle>
            <CardDescription>Suas imagens processadas recentemente</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPageData ? (
              <div className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              </div>
            ) : imageHistory.length > 0 ? (
              <div className="space-y-4">
                {imageHistory.slice(0, 10).map((image) => {
                  const publicURL = image.processed_file_path
                    ? supabase.storage.from('processed-images').getPublicUrl(image.processed_file_path).data.publicUrl
                    : '';
                  const title = friendlyTitle(image);
                  const downloadName = friendlyDownloadName(image);
                  return (
                    <div key={image.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-4">
                        <div className="text-2xl">
                          {categoryEmoji[image.processing_type as keyof typeof categoryEmoji] || '📷'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate max-w-xs" title={title}>{title}</p>
                          <p className="text-xs text-gray-500">{formatDate(image.created_at)}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadClick(publicURL, downloadName)}
                        disabled={isDownloading}
                      >
                        {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      </Button>
                    </div>
                  );
                })}
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

