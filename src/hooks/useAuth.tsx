import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type AppMode = 'pessoal' | 'empresarial';
export type AppPlan = 'Free' | 'Pro' | 'Empresarial';

export interface UserProfile {
  nome: string;
  email: string;
  modo: AppMode;
  plano: AppPlan;
  xp: number;
  nivel: number;
  criadoEm: string;
}

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  switchMode: (mode: AppMode) => Promise<void>;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock user session via localStorage
    const savedUser = localStorage.getItem('mock_user');
    if (savedUser) {
      setUser({ uid: 'mock_uid_123', email: 'demo@example.com' });
      setProfile({
        nome: 'Usuário Demo',
        email: 'demo@example.com',
        modo: 'pessoal',
        plano: 'Pro', // changed from 'free' to 'Pro' to match types
        xp: 1500,
        nivel: 3,
        criadoEm: new Date().toISOString(),
      });
    }
    setLoading(false);
  }, []);

  const signIn = async () => {
    setLoading(true);
    setTimeout(() => {
      localStorage.setItem('mock_user', 'true');
      setUser({ uid: 'mock_uid_123', email: 'demo@example.com' });
      setProfile({
        nome: 'Usuário Demo',
        email: 'demo@example.com',
        modo: 'pessoal',
        plano: 'Pro',
        xp: 1500,
        nivel: 3,
        criadoEm: new Date().toISOString(),
      });
      setLoading(false);
    }, 1000);
  };

  const switchMode = async (modo: AppMode) => {
    if (!profile) return;
    setProfile({ ...profile, modo });
  };

  const signOut = async () => {
    localStorage.removeItem('mock_user');
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, switchMode, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
