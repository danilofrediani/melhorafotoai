import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface Package {
  id: string;
  name: string;
  type: 'avulso' | 'mensal' | 'profissional';
  images: number;
  price: number;
  description: string;
}

interface UserPackage {
  packageId: string;
  remainingImages: number;
  purchaseDate: string;
  expiryDate?: string;
}

interface PackageContextType {
  packages: Package[];
  userPackages: UserPackage[];
  remainingImages: number;
  purchasePackage: (packageId: string) => Promise<boolean>;
  consumeImage: () => boolean;
  getPackageById: (id: string) => Package | undefined;
}

const PackageContext = createContext<PackageContextType | undefined>(undefined);

export const usePackages = () => {
  const context = useContext(PackageContext);
  if (context === undefined) {
    throw new Error('usePackages must be used within a PackageProvider');
  }
  return context;
};

const defaultPackages: Package[] = [
  // Pacotes Avulsos
  { id: 'avulso_pequeno', name: 'Pequeno', type: 'avulso', images: 5, price: 50, description: '5 imagens por R$ 50' },
  { id: 'avulso_medio', name: 'Médio', type: 'avulso', images: 10, price: 95, description: '10 imagens por R$ 95' },
  { id: 'avulso_grande', name: 'Grande', type: 'avulso', images: 20, price: 180, description: '20 imagens por R$ 180' },
  
  // Planos Mensais
  { id: 'mensal_basico', name: 'Básico Mensal', type: 'mensal', images: 30, price: 250, description: '30 imagens mensais por R$ 250' },
  { id: 'mensal_intermediario', name: 'Intermediário Mensal', type: 'mensal', images: 60, price: 450, description: '60 imagens mensais por R$ 450' },
  { id: 'mensal_premium', name: 'Premium Mensal', type: 'mensal', images: 100, price: 700, description: '100 imagens mensais por R$ 700' },
  
  // Planos Profissionais
  { id: 'prof_basico', name: 'Profissional Básico', type: 'profissional', images: 200, price: 900, description: '200 imagens mensais por R$ 900' },
  { id: 'prof_completo', name: 'Profissional Completo', type: 'profissional', images: 500, price: 1800, description: '500+ imagens mensais por R$ 1.800' },
];

export const PackageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [packages] = useState<Package[]>(defaultPackages);
  const [userPackages, setUserPackages] = useState<UserPackage[]>([]);
  const [remainingImages, setRemainingImages] = useState(0);

  useEffect(() => {
    if (user) {
      const storedPackages = localStorage.getItem(`fotoperfeita_packages_${user.id}`);
      if (storedPackages) {
        const parsed = JSON.parse(storedPackages);
        setUserPackages(parsed);
        updateRemainingImages(parsed);
      } else {
        // Give 3 free images for new users
        const freePackage: UserPackage = {
          packageId: 'free',
          remainingImages: 3,
          purchaseDate: new Date().toISOString(),
        };
        setUserPackages([freePackage]);
        setRemainingImages(3);
      }
    }
  }, [user]);

  const updateRemainingImages = (packages: UserPackage[]) => {
    const total = packages.reduce((sum, pkg) => {
      // Check if package is still valid (not expired)
      if (pkg.expiryDate && new Date(pkg.expiryDate) < new Date()) {
        return sum;
      }
      return sum + pkg.remainingImages;
    }, 0);
    setRemainingImages(total);
  };

  const purchasePackage = async (packageId: string): Promise<boolean> => {
    if (!user) return false;

    const selectedPackage = packages.find(p => p.id === packageId);
    if (!selectedPackage) return false;

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const newUserPackage: UserPackage = {
        packageId,
        remainingImages: selectedPackage.images,
        purchaseDate: new Date().toISOString(),
        expiryDate: selectedPackage.type === 'mensal' || selectedPackage.type === 'profissional' 
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() 
          : undefined
      };

      const updatedPackages = [...userPackages, newUserPackage];
      setUserPackages(updatedPackages);
      localStorage.setItem(`fotoperfeita_packages_${user.id}`, JSON.stringify(updatedPackages));
      updateRemainingImages(updatedPackages);

      return true;
    } catch (error) {
      return false;
    }
  };

  const consumeImage = (): boolean => {
    if (remainingImages <= 0) return false;

    const updatedPackages = [...userPackages];
    for (let i = 0; i < updatedPackages.length; i++) {
      if (updatedPackages[i].remainingImages > 0) {
        // Check if package is still valid
        if (updatedPackages[i].expiryDate && new Date(updatedPackages[i].expiryDate!) < new Date()) {
          continue;
        }
        updatedPackages[i].remainingImages--;
        break;
      }
    }

    setUserPackages(updatedPackages);
    if (user) {
      localStorage.setItem(`fotoperfeita_packages_${user.id}`, JSON.stringify(updatedPackages));
    }
    updateRemainingImages(updatedPackages);
    return true;
  };

  const getPackageById = (id: string): Package | undefined => {
    return packages.find(p => p.id === id);
  };

  return (
    <PackageContext.Provider value={{
      packages,
      userPackages,
      remainingImages,
      purchasePackage,
      consumeImage,
      getPackageById
    }}>
      {children}
    </PackageContext.Provider>
  );
};