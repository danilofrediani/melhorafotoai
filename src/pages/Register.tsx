import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

// --- NOVO: utilitários de mensagens/validação
import { isValidEmail, validatePasswordPolicy, mapAuthCodeToMessage } from '@/utils/authErros';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const { register, loading } = useAuth();
  const navigate = useNavigate();
  const [freeImagesCount, setFreeImagesCount] = useState<number>(3);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('platform_settings')
          .select('free_images_for_new_users')
          .eq('id', 1)
          .single();
        if (error) throw error;
        if (data && data.free_images_for_new_users) {
          setFreeImagesCount(data.free_images_for_new_users);
        }
      } catch (error) {
        console.error("Erro ao buscar configurações de imagens grátis:", error);
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // --- Validações amigáveis antes de enviar ao Supabase ---
    if (!name || !email || !password || !confirmPassword) {
      setError('Por favor, preencha todos os campos');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }
    if (!isValidEmail(email)) {
      setError('E-mail inválido. Verifique o formato (ex.: nome@dominio.com).');
      return;
    }
    const pwIssues = validatePasswordPolicy(password); // mínimo 6 + letra + número
    if (pwIssues.length) {
      setError('Ajuste sua senha:\n• ' + pwIssues.join('\n• '));
      return;
    }

    const result = await register(email, password, name, 'basic');
    
    if (result.success) {
      toast.success('Conta criada com sucesso!');
      navigate('/login');
    } else {
      if (result.error === 'EMAIL_ALREADY_IN_USE') {
        setError(mapAuthCodeToMessage('EMAIL_ALREADY_IN_USE'));
      } else if (result.error === 'REGISTRATION_FAILED') {
        setError(mapAuthCodeToMessage('REGISTRATION_FAILED'));
      } else {
        setError(mapAuthCodeToMessage('UNKNOWN_ERROR'));
      }
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
            <CardTitle className="text-2xl">Criar sua conta</CardTitle>
            <CardDescription>Cadastre-se gratuitamente e ganhe {freeImagesCount} imagens para testar</CardDescription>
            <div className="flex items-center justify-center mt-2 text-sm text-green-600 font-medium">
              <Gift className="w-4 h-4 mr-1" />
              {freeImagesCount} imagens grátis para novos usuários
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (<Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>)}

              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" disabled={loading} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" disabled={loading} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres (letras e números)" disabled={loading} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Digite a senha novamente" disabled={loading} />
              </div>

              <Button type="submit" className="w-full bg-gradient-fotoperfeita hover:opacity-90" disabled={loading}>
                {loading ? ( <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando conta...</> ) : ( 'Criar conta gratuitamente' )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <p className="text-gray-600">
                Já tem uma conta?{' '}
                <Link to="/login" className="text-primary hover:underline font-medium">Faça login</Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

