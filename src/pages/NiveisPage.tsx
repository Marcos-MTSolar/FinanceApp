import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import { 
  LayoutDashboard, 
  CreditCard, 
  Target, 
  User, 
  LogOut, 
  Upload, 
  MessageCircle, 
  Shield, 
  Menu, 
  X,
  Trophy,
  Zap,
  Star,
  FileUp,
  CheckCircle2,
  ArrowUpCircle,
  AlertTriangle,
  TrendingUp,
  Info
} from 'lucide-react';
import { LEVEL_THRESHOLDS } from '../lib/gamification';

export function NiveisPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [user, setUser] = useState(auth.currentUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  const userName = user?.displayName || user?.email?.split('@')[0] || profile?.nome || 'Usuário Demo';
  const userInitials = userName.substring(0, 2).toUpperCase();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Erro ao realizar logout:', error);
      navigate('/login');
    }
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Transações', path: '/transacoes', icon: CreditCard },
    { name: 'Importar', path: '/importar', icon: Upload },
    { name: 'Metas', path: '/metas', icon: Target },
    { name: 'Assistente IA', path: '/chat', icon: MessageCircle },
    { name: 'Níveis', path: '/niveis', icon: Trophy },
  ];

  const currentXp = profile?.xp || 0;
  
  let currentLevel = LEVEL_THRESHOLDS[0];
  let nextLevel = LEVEL_THRESHOLDS[1];

  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (currentXp >= LEVEL_THRESHOLDS[i].minXp) {
      currentLevel = LEVEL_THRESHOLDS[i];
      nextLevel = LEVEL_THRESHOLDS[i + 1] || null;
    }
  }

  const progress = nextLevel 
    ? ((currentXp - currentLevel.minXp) / (nextLevel.minXp - currentLevel.minXp)) * 100 
    : 100;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col md:flex-row selection:bg-indigo-500 selection:text-white font-sans">
      {/* Sidebar Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            FinanceAI
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-gray-400 hover:text-white rounded-lg bg-gray-800/60 focus:outline-none"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="h-20 flex items-center gap-3 px-8 border-b border-gray-800/60">
          <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 ring-1 ring-white/10">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-gray-200 to-indigo-200 bg-clip-text text-transparent">
            FinanceAI
          </span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/25'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/70'
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? 'text-white' : 'text-gray-400 group-hover:text-indigo-400'
                  }`}
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800/80">
          <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-gray-950/50 border border-gray-800/60">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-inner">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{userName}</p>
              <p className="text-[10px] text-indigo-400 font-medium truncate">Conectado</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay Mobile */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-gray-950">
        <header className="h-20 px-6 lg:px-10 border-b border-gray-900 flex items-center justify-between bg-gray-950/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-4 flex-1 max-w-md">
            <h1 className="text-xl font-bold tracking-tight text-white">Níveis e Recompensas</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-semibold leading-tight text-white">{userName}</span>
                <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 justify-end">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  Conectado
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-sm font-bold shadow-md ring-2 ring-indigo-500/30">
                {userInitials}
              </div>
              <button
                onClick={handleLogout}
                title="Sair"
                className="p-2.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-full transition-all ml-1 group"
              >
                <LogOut className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 lg:p-10 max-w-5xl w-full mx-auto overflow-y-auto">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 lg:p-8 shadow-xl shadow-black/20 mb-8">
            <div className="flex flex-col md:flex-row gap-8 items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">Seu Progresso</h2>
                <p className="text-gray-400">Complete transações, metas e interações para ganhar XP e subir de nível.</p>
              </div>
              <div className="flex items-center gap-6 bg-gray-950 p-6 rounded-2xl border border-gray-800">
                <div className="w-20 h-20 rounded-full bg-gray-900 border-4 border-indigo-500 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                  <span className="text-3xl font-black text-white">{currentLevel.level}</span>
                </div>
                <div>
                  <div className="text-sm text-indigo-400 font-bold tracking-wider uppercase mb-1">Nível Atual</div>
                  <div className={`text-2xl font-bold ${currentLevel.color}`}>{currentLevel.name}</div>
                  <div className="text-sm font-medium text-gray-400 mt-1">{currentXp} XP Totais</div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex justify-between text-sm font-medium mb-3">
                <span className="text-gray-400">Progresso para Nível {nextLevel ? nextLevel.level : currentLevel.level}</span>
                <span className="text-white">
                  {currentXp} / {nextLevel ? nextLevel.minXp : currentLevel.minXp} XP
                </span>
              </div>
              <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000 relative"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Seção: Como Ganhar XP */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-xl shadow-black/20 mb-6">
            <div className="p-6 lg:p-8 border-b border-gray-800 flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                <Zap className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Como Ganhar XP</h3>
                <p className="text-xs text-gray-400 mt-0.5">Complete essas ações para acelerar sua evolução financeira</p>
              </div>
            </div>

            <div className="p-6 lg:p-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* +10 XP - Nova Transação */}
              <div className="group flex items-start gap-4 p-5 bg-gray-950 border border-gray-800 rounded-2xl hover:border-blue-500/40 hover:bg-blue-500/5 transition-all duration-200">
                <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex-shrink-0 group-hover:bg-blue-500/20 transition-colors">
                  <CreditCard className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-bold text-white">Registrar Transação</span>
                    <span className="text-xs font-extrabold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-xl whitespace-nowrap">+10 XP</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">Cada vez que você adicionar uma receita ou despesa manualmente. É o hábito mais importante!</p>
                </div>
              </div>

              {/* +50 XP - Importar Extrato */}
              <div className="group flex items-start gap-4 p-5 bg-gray-950 border border-gray-800 rounded-2xl hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all duration-200">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex-shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                  <FileUp className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-bold text-white">Importar Extrato</span>
                    <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl whitespace-nowrap">+50 XP</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">Faça upload de um PDF, CSV ou imagem na tela de Importar. A IA classifica automaticamente!</p>
                </div>
              </div>

              {/* +100 XP - Diagnóstico */}
              <div className="group flex items-start gap-4 p-5 bg-gray-950 border border-gray-800 rounded-2xl hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all duration-200">
                <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex-shrink-0 group-hover:bg-indigo-500/20 transition-colors">
                  <TrendingUp className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-bold text-white">Completar Diagnóstico</span>
                    <span className="text-xs font-extrabold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-xl whitespace-nowrap">+100 XP</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">Responda o questionário de diagnóstico financeiro completo e receba seu score personalizado.</p>
                </div>
              </div>

              {/* +500 XP - Completar Meta */}
              <div className="group flex items-start gap-4 p-5 bg-gray-950 border border-gray-800 rounded-2xl hover:border-yellow-500/40 hover:bg-yellow-500/5 transition-all duration-200">
                <div className="p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex-shrink-0 group-hover:bg-yellow-500/20 transition-colors">
                  <CheckCircle2 className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-bold text-white">Concluir uma Meta</span>
                    <span className="text-xs font-extrabold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2.5 py-1 rounded-xl whitespace-nowrap">+500 XP</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">A maior recompensa! Marque uma meta como concluída quando atingir o valor alvo definido.</p>
                </div>
              </div>
            </div>

            {/* Dica sobre não perder ritmo */}
            <div className="mx-6 mb-6 lg:mx-8 lg:mb-8 p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl flex items-start gap-3">
              <div className="p-1.5 bg-amber-500/10 rounded-lg flex-shrink-0 mt-0.5">
                <Info className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-300 mb-1">Como o XP funciona?</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  O XP é acumulativo e nunca é perdido — você só cresce de nível, nunca regride. Manter o hábito diário de registrar transações é a forma mais rápida de subir. Uma meta concluída vale o mesmo que 50 transações registradas!
                </p>
              </div>
            </div>
          </div>

          {/* Tabela de Níveis */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-xl shadow-black/20">
            <div className="p-6 lg:p-8 border-b border-gray-800">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Trophy className="w-6 h-6 text-yellow-500" />
                Tabela de Níveis
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-950 text-gray-400 border-b border-gray-800">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Nível</th>
                    <th className="px-6 py-4 font-semibold">Título</th>
                    <th className="px-6 py-4 font-semibold">XP Necessário</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {LEVEL_THRESHOLDS.map((level) => {
                    const isCurrent = level.level === currentLevel.level;
                    return (
                      <tr key={level.level} className={`${isCurrent ? 'bg-indigo-900/20' : 'hover:bg-gray-800/50'} transition-colors`}>
                        <td className="px-6 py-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${isCurrent ? 'bg-indigo-600 text-white shadow-[0_0_10px_rgba(79,70,229,0.6)]' : 'bg-gray-800 text-gray-400'}`}>
                            {level.level}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`font-bold ${level.color}`}>{level.name}</span>
                          {isCurrent && <span className="ml-3 text-[10px] uppercase font-bold text-indigo-400 bg-indigo-900/40 px-2 py-1 rounded-md">Atual</span>}
                        </td>
                        <td className="px-6 py-4 font-medium text-gray-300">
                          {level.minXp.toLocaleString()} XP
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default NiveisPage;
