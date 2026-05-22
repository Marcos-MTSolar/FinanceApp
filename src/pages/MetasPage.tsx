import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import { Metas } from '../components/Metas';
import { Activity, Briefcase, Calculator, CalendarClock, CheckCircle2, CheckSquare, ChevronDown, CreditCard, FileText, HelpCircle, LayoutDashboard, Lightbulb, LogOut, Menu, MessageCircle, Network, Percent, PiggyBank, Scale, Shield, Tag, Target, TrendingUp, Trophy, Upload, User, Users, X } from 'lucide-react';

export function MetasPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [user, setUser] = useState(auth.currentUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

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
    { name: 'Renda Extra', path: '/renda-extra', icon: TrendingUp },
    { name: 'Assistente IA', path: '/chat', icon: MessageCircle },
    { name: 'Níveis', path: '/niveis', icon: Trophy },
  ];

  const userProfile = profile;
  if (userProfile?.modo === 'empresarial') {
    navItems.push({ name: 'Cadastro Empresa', path: '/empresa/cadastro', icon: Briefcase });
    navItems.push({ name: 'Funcionários', path: '/empresa/funcionarios', icon: Users });
    navItems.push({ name: 'Rescisão', path: '/empresa/rescisao', icon: FileText });
    navItems.push({ name: 'Reservas', path: '/empresa/reservas', icon: PiggyBank });
    navItems.push({ name: 'Impostos', path: '/empresa/impostos', icon: Percent });
    navItems.push({ name: 'Centro de Custos', path: '/empresa/centro-custos', icon: Tag });
    navItems.push({ name: 'Indicadores', path: '/empresa/indicadores', icon: Activity });
    navItems.push({ name: 'Demonstrativos', path: '/empresa/demonstrativos', icon: Scale });
    navItems.push({ name: 'Plano de Contas', path: '/empresa/plano-contas', icon: Network });
    navItems.push({ name: 'Conciliação', path: '/empresa/conciliacao', icon: CheckSquare });
  }

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
            <h1 className="text-xl font-bold tracking-tight text-white">Gestão de Metas</h1>
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
        <div className="flex-1 p-6 lg:p-10 max-w-7xl w-full mx-auto overflow-y-auto space-y-5">

          {/* ── Painel Informativo Retrátil ───────────────────────────── */}
          <div className="bg-gray-900 border border-indigo-500/20 rounded-3xl shadow-xl shadow-black/20 overflow-hidden">
            {/* Cabeçalho do painel — sempre visível */}
            <button
              onClick={() => setHelpOpen(!helpOpen)}
              className="w-full flex items-center justify-between p-5 lg:p-6 text-left group hover:bg-indigo-500/5 transition-colors duration-200"
              aria-expanded={helpOpen}
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex-shrink-0">
                  <HelpCircle className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-bold text-white block">Como funcionam as metas?</span>
                  <span className="text-xs text-gray-400">{helpOpen ? 'Clique para recolher' : 'Clique para expandir e entender o sistema'}</span>
                </div>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-indigo-400 flex-shrink-0 transition-transform duration-300 ${
                  helpOpen ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </button>

            {/* Conteúdo expansível */}
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                helpOpen ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="px-5 pb-6 lg:px-6 lg:pb-7 border-t border-gray-800 pt-5 space-y-4">

                {/* O que é uma meta */}
                <div className="flex items-start gap-3 p-4 bg-gray-950 border border-gray-800 rounded-2xl">
                  <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex-shrink-0 mt-0.5">
                    <Target className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white mb-1">O que é uma meta?</p>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Uma meta é um <span className="text-indigo-300 font-semibold">objetivo financeiro com valor alvo e prazo</span>. Você define quanto quer guardar ou conquistar e até quando. O FinanceAI acompanha seu progresso automaticamente com base nas suas transações.
                    </p>
                  </div>
                </div>

                {/* Como é cumprida */}
                <div className="flex items-start gap-3 p-4 bg-gray-950 border border-gray-800 rounded-2xl">
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white mb-1">Como uma meta é cumprida?</p>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Você pode <span className="text-emerald-300 font-semibold">registrar aportes manualmente</span> informando o valor separado. Quando o total aportado atingir o valor alvo, a meta aparece como concluída — e você ganha <span className="text-yellow-300 font-semibold">+50 XP</span> de recompensa!
                    </p>
                  </div>
                </div>

                {/* Cálculo mensal */}
                <div className="flex items-start gap-3 p-4 bg-gray-950 border border-gray-800 rounded-2xl">
                  <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl flex-shrink-0 mt-0.5">
                    <Calculator className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white mb-1">Quanto separar por mês?</p>
                    <p className="text-xs text-gray-400 leading-relaxed">
                      Fórmula simples: <span className="text-amber-300 font-semibold">Valor da meta ÷ Número de meses até o prazo</span>. Divida o valor total pelo tempo disponível e você sabe exatamente quanto guardar a cada mês para chegar lá no prazo.
                    </p>
                  </div>
                </div>

                {/* Exemplo prático */}
                <div className="flex items-start gap-3 p-4 bg-indigo-950/40 border border-indigo-500/25 rounded-2xl">
                  <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex-shrink-0 mt-0.5">
                    <Lightbulb className="w-4 h-4 text-indigo-300" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-indigo-200 mb-2">Exemplo prático</p>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <CalendarClock className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                        <span className="text-gray-300">Meta: <span className="font-semibold text-white">Comprar tênus — R$&nbsp;200,00</span> em <span className="font-semibold text-white">2 meses</span></span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Calculator className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <span className="text-gray-300">Cálculo: <span className="font-semibold text-white">R$&nbsp;200 ÷ 2 meses</span> = separe <span className="text-emerald-300 font-bold">R$&nbsp;100,00 por mês</span></span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                        <span className="text-gray-300">Ao concluir: ganhe <span className="text-yellow-300 font-bold">+50 XP</span> de recompensa!</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* ── Card de Metas ──────────────────────────────────── */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 lg:p-8 shadow-xl shadow-black/20">
            <Metas />
          </div>
        </div>
      </main>
    </div>
  );
}

export default MetasPage;
