import { Link } from 'react-router-dom';
import { ImageIcon } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-gray-50 border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <img 
                src="/assets/MelhoraFotoAI_cropped.png" 
                alt="MelhoraFotoAI"
                className="w-8 h-8 object-contain"
              />
              <span className="text-xl font-bold fotoperfeita-primary">MelhoraFotoAI</span>
            </div>
            <p className="text-gray-600 text-sm">
              Melhore suas imagens com IA mantendo 100% a realidade. 
              Profissional, rápido e confiável.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Produto</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/pricing" className="text-gray-600 hover:text-primary">Preços</Link></li>
              <li><Link to="/upload" className="text-gray-600 hover:text-primary">Upload</Link></li>
              <li><a href="#categorias" className="text-gray-600 hover:text-primary">Categorias</a></li>
              <li><a href="#como-funciona" className="text-gray-600 hover:text-primary">Como funciona</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Suporte</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="mailto:suporte@melhorafotoai.com" className="text-gray-600 hover:text-primary">Contato</a></li>
              <li><a href="/faq" className="text-gray-600 hover:text-primary">FAQ</a></li>
              <li><a href="/termos" className="text-gray-600 hover:text-primary">Termos de uso</a></li>
              <li><a href="/privacidade" className="text-gray-600 hover:text-primary">Privacidade</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Categorias</h3>
            <ul className="space-y-2 text-sm">
              <li><span className="text-gray-600">🍕 Alimentos</span></li>
              <li><span className="text-gray-600">🚗 Veículos</span></li>
              <li><span className="text-gray-600">🏠 Imóveis</span></li>
              <li><span className="text-gray-600">📦 Produtos</span></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-600 text-sm">
            © 2024 MelhoraFotoAI. Todos os direitos reservados.
          </p>
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <span className="text-sm text-gray-500">Tecnologia IA Própria MelhoraFoto</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;