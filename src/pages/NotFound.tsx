import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ImageIcon, Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="mb-8">
          <img 
            src="/assets/MelhoraFotoAI_cropped.png" 
            alt="MelhoraFotoAI"
            className="w-14 h-14 object-contain mx-auto mb-4"
          />
          <span className="text-4xl font-bold fotoperfeita-primary">MelhoraFotoAI</span>
        </div>

        <div className="mb-8">
          <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Página não encontrada</h2>
          <p className="text-gray-600 mb-6">
            A página que você está procurando não existe ou foi removida.
          </p>
        </div>

        <div className="space-y-4">
          <Button className="w-full bg-gradient-fotoperfeita hover:opacity-90" asChild>
            <Link to="/">
              <Home className="mr-2 w-4 h-4" />
              Voltar ao início
            </Link>
          </Button>
          
          <Button variant="outline" className="w-full" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 w-4 h-4" />
            Voltar à página anterior
          </Button>
        </div>

        <div className="mt-8 text-sm text-gray-500">
          <p>Se você acredita que isso é um erro, entre em contato conosco:</p>
          <a href="mailto:suporte@melhorafotoai.com" className="text-primary hover:underline">
            suporte@melhorafotoai.com
          </a>
        </div>
      </div>
    </div>
  );
}