import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

// Estados para controlar o fluxo da página
type PageState = 'loading' | 'ready_to_update' | 'error';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [pageState, setPageState] = useState<PageState>('loading');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Esta função agora lê o token diretamente da URL
    // e dispara o evento PASSWORD_RECOVERY manualmente.
    const handlePasswordRecovery = async () => {
      const hash = window.location.hash;
      if (!hash) {
        setError("Token de recuperação não encontrado. Por favor, use o link do seu e-mail.");
        setPageState('error');
        return;
      }
      
      // O Supabase coloca o token no hash. Aqui nós o detectamos.
      const { data: { session }, error: sessionError } = await supabase.auth.getSessionFromUrl({
        storeSession: false
      });

      if (sessionError || !session) {
        console.error("Erro ao processar o link:", sessionError);
        setError("O link de recuperação de senha é inválido ou expirou. Por favor, solicite um novo.");
        setPageState('error');
        return;
      }
      
      // Se o token é válido, estamos prontos para atualizar a senha.
      setPageState('ready_to_update');
    };
    
    handlePasswordRecovery();
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });

      if (updateError) {
        throw updateError;
      }

      toast.success('Senha redefinida com sucesso! Por favor, faça o login com sua nova senha.');
      navigate('/login');

    } catch (err: any) {
      console.error('Erro ao redefinir a senha:', err);
      setError('Não foi possível redefinir sua senha. O link pode ter expirado.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
         <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-2">
            <img src="/assets/MelhoraFotoAI_cropped.png" alt="MelhoraFotoAI" className="w-12 h-12 object-contain" />
            <span className="text-3xl font-bold fotoperfeita-primary">MelhoraFotoAI</span>
          </Link>
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Crie sua nova senha</CardTitle>
            <CardDescription>
              {pageState === 'error' ? 'Ocorreu um problema' : 'Digite e confirme sua nova senha abaixo.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pageState === 'ready_to_update' ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>)}
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova Senha</Label>
                  <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres" disabled={isSubmitting}/>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                  <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha" disabled={isSubmitting}/>
                </div>
                <Button type="submit" className="w-full bg-gradient-fotoperfeita hover:opacity-90" disabled={isSubmitting}>
                  {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>) : ('Salvar Nova Senha')}
                </Button>
              </form>
            ) : (
               <Alert variant="destructive">
                  <AlertDescription>{error || "Link inválido ou expirado. Por favor, retorne à página de login e solicite um novo link."}</AlertDescription>
                   <Button asChild className="mt-4 w-full"><Link to="/login">Voltar para o Login</Link></Button>
               </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
