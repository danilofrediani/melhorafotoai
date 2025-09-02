import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ImageIcon, LogOut, User, Upload, CreditCard, Settings, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const getDashboardRoute = (userType: string | undefined) => {
  if (userType === 'admin') return '/admin';
  if (userType === 'professional') return '/professional';
  return '/dashboard';
};

const Header = () => {
  const { user, profile, logout, isLoadingProfile } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const dashboardRoute = getDashboardRoute(profile?.user_type);

  return (
    <header className="bg-white border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3">
          <img src="/assets/MelhoraFotoAI_cropped.png" alt="MelhoraFotoAI" className="w-16 h-16 object-contain" />
          <span className="text-2xl font-bold fotoperfeita-primary">MelhoraFotoAI</span>
        </Link>

        <nav className="hidden md:flex items-center space-x-6">
          <Link to="/pricing" className="text-gray-600 hover:text-primary transition-colors">Preços</Link>
          {profile && (
            <>
              <Link to="/upload" className="text-gray-600 hover:text-primary transition-colors">Upload</Link>
              <Link to={dashboardRoute} className="text-gray-600 hover:text-primary transition-colors">Dashboard</Link>
            </>
          )}
        </nav>

        <div className="flex items-center space-x-4">
          {(isLoadingProfile && user) ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : profile ? (
            <>
              <div className="hidden md:flex items-center space-x-2 bg-gray-50 px-3 py-2 rounded-full">
                <ImageIcon className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{profile?.remaining_images ?? 0} imagens</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full"><User className="h-5 w-5" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{profile.name}</p>
                      <p className="text-xs leading-none text-muted-foreground">{profile.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/upload')}><Upload className="mr-2 h-4 w-4" /><span>Upload</span></DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/pricing')}><CreditCard className="mr-2 h-4 w-4" /><span>Comprar créditos</span></DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(dashboardRoute)}><User className="mr-2 h-4 w-4" /><span>Dashboard</span></DropdownMenuItem>
                  {profile?.user_type === 'admin' && (
                    <DropdownMenuItem onClick={() => navigate('/admin')}><Settings className="mr-2 h-4 w-4" /><span>Admin</span></DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}><LogOut className="mr-2 h-4 w-4" /><span>Sair</span></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="flex items-center space-x-2">
              <Button variant="ghost" asChild><Link to="/login">Entrar</Link></Button>
              <Button asChild className="bg-gradient-fotoperfeita hover:opacity-90"><Link to="/register">Cadastrar</Link></Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
