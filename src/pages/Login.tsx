import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// --- Dialog (recuperação de senha)
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"

// --- NOVO: utilitários de mensagens/validação
import { isValidEmail, mapAuthCodeToMessage, friendlyFromUnknown } from '@/utils/authErros';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, isLoading, resetPassword } = useAuth();
  const navigate = useNavigate();

  // Estados para o formulário de recuperação
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const redirectByRole = (role?: 'basic' | 'professional' | 'admin') => {
    if (role === 'admin') navigate('/admin');
    else if (role === 'professional') navigate('/professional');
    else navigate('/dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('E-mail inválido. Verifique o formato (ex.: nome@dominio.com).');
      return;
    }

    try {
      const result = await login(email.trim().toLowerCase(), password);

      if (result.success) {
        toast.success('Login realizado com sucesso!');
        redirectByRole(result.role);
      } else {
        setError(mapAuthCodeToMessage(result.error));
      }
    } catch (err) {
      console.error('Unexpected error in handleSubmit:', err);
      setError(friendlyFromUnknown(err));
    }
  };

  const handlePasswordReset = async () => {
    if (!recoveryEmail) {
      toast.error("Por favor, insira seu e-mail.");
      return;
    }
    setIsResetting(true);
    const success = await resetPassword(recoveryEmail.trim().toLowerCase());
    setIsResetting(false);
    
    if (success) {
      toast.info("Se uma conta com este e-mail existir, um link de recuperação foi enviado.");
      setDialogOpen(false);
      setRecoveryEmail('');
    } else {
      toast.error("Ocorreu um erro ao tentar enviar o e-mail. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-2">
            <img
              src="/assets/MelhoraFotoAI_cropped.png"
              alt="MelhoraFotoAI"
              className="w-12 h-12 object-contain"
            />
            <span className="text-3xl font-bold fotoperfeita-primary">MelhoraFotoAI</span>
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Entrar na sua conta</CardTitle>
            <CardDescription>
              Digite seu email e senha para acessar sua conta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                      <button type="button" className="text-sm font-medium text-primary hover:underline">
                        Esqueci minha senha
                      </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Recuperar Senha</DialogTitle>
                        <DialogDescription>
                          Digite seu e-mail abaixo. Enviaremos um link para você criar uma nova senha.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <Label htmlFor="recovery-email" className="text-right">
                            Email
                          </Label>
                          <Input
                            id="recovery-email"
                            type="email"
                            value={recoveryEmail}
                            onChange={(e) => setRecoveryEmail(e.target.value)}
                            className="col-span-3"
                            placeholder="seu@email.com"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button type="button" variant="outline">Cancelar</Button>
                        </DialogClose>
                        <Button type="button" onClick={handlePasswordReset} disabled={isResetting}>
                          {isResetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enviar Link"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  disabled={isLoading}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-fotoperfeita hover:opacity-90"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <p className="text-gray-600">
                Não tem uma conta?{' '}
                <Link to="/register" className="text-primary hover:underline font-medium">
                  Cadastre-se gratuitamente
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

