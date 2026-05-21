import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebaseConfig';
import { verificarInatividade, verificarSaldoMensal } from '../lib/gamification';

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
  ultimoAcesso: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  switchMode: (mode: AppMode) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const docRef = doc(db, 'users', firebaseUser.uid);
        
        try {
          const docSnap = await getDoc(docRef);
          if (!docSnap.exists()) {
            const newProfile: UserProfile = {
              nome: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Usuário',
              email: firebaseUser.email || '',
              modo: 'pessoal',
              plano: 'Free',
              xp: 0,
              nivel: 1,
              criadoEm: new Date().toISOString(),
              ultimoAcesso: new Date().toISOString(),
            };
            await setDoc(docRef, newProfile);
          } else {
            // Usuário existente: atualiza acesso e dispara verificações de gamificação
            await setDoc(docRef, { ultimoAcesso: new Date().toISOString() }, { merge: true });
            // Executa em background — não bloqueia o carregamento do perfil
            Promise.all([
              verificarInatividade(firebaseUser.uid),
              verificarSaldoMensal(firebaseUser.uid),
            ]).catch(err =>
              console.error('[useAuth] Erro nas verificações de gamificação:', err)
            );
          }
        } catch (err) {
          console.error('Erro ao buscar/criar perfil inicial do usuário:', err);
        }

        // Configura o listener em tempo real
        unsubProfile = onSnapshot(docRef, (snap) => {
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          }
          setLoading(false);
        }, (err) => {
          console.error('Erro no listener de perfil em tempo real:', err);
          setLoading(false);
        });
      } else {
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = null;
        }
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) {
        unsubProfile();
      }
    };
  }, []);

  const switchMode = async (modo: AppMode) => {
    if (!user || !profile) return;
    const updated = { ...profile, modo };
    await setDoc(doc(db, 'users', user.uid), { modo }, { merge: true });
    setProfile(updated);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, switchMode, signOut }}>
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
