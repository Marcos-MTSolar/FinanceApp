import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, onSnapshot, orderBy, doc, setDoc, getDoc, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import { HeaderXPBar } from '../components/HeaderXPBar';
import { calcularScoreFinanceiro } from '../lib/gamification';
import { ScoreGauge, AlertasInteligentes, CashFlowChart, MetasAtivasResumo } from '../components/Dashboard';
import { NewTransactionModal } from '../components/NewTransactionModal';
import { NotificacoesDropdown, criarNotificacao } from '../components/NotificacoesDropdown';
import { 
  LayoutDashboard, 
  CreditCard, 
  Target, 
  User, 
  LogOut, 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  Bell, 
  Search, 
  Shield,
  ArrowUpRight,
  ArrowDownLeft,
  Menu,
  X,
  Upload,
  MessageCircle,
  Plus,
  Briefcase,
  Trophy
} from 'lucide-react';

export function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [user, setUser] = useState(auth.currentUser);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [metas, setMetas] = useState<any[]>([]);
  const [rendasExtras, setRendasExtras] = useState<any[]>([]);
  const [diagnostico, setDiagnostico] = useState<any>(null);
  const [periodo, setPeriodo] = useState<30 | 60 | 90>(30);
  const [loading, setLoading] = useState(true);

  // Estado do Modo (pessoal | empresarial) com fallback padrão 'pessoal'
  const [modo, setModo] = useState<'pessoal' | 'empresarial'>('pessoal');
  const [changingModo, setChangingModo] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    const fetchUserMode = async () => {
      if (!user?.uid) return;
      try {
        const docSnap = await getDoc(doc(db, 'users', user.uid));
        if (docSnap.exists() && docSnap.data().modo) {
          setModo(docSnap.data().modo);
        } else {
          setModo('pessoal');
        }
      } catch (err) {
        console.error('Erro ao buscar modo do usuário', err);
      }
    };
    fetchUserMode();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setTransactions([]);
      setMetas([]);
      setDiagnostico(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    let unsubTrans = () => {};
    let unsubMetas = () => {};
    let unsubRenda = () => {};
    let unsubDiag = () => {};

    try {

      // Transações filtradas pelo modo
      const qTrans = query(
        collection(db, `transacoes/${user.uid}/items`),
        where('modo', '==', modo)
      );
      
      const timeout = setTimeout(() => setLoading(false), 5000);
      
      unsubTrans = onSnapshot(qTrans, (snapshot) => {
        clearTimeout(timeout);
        const list = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());
        setTransactions(list);
        setLoading(false);
      }, (error) => {
        clearTimeout(timeout);
        console.error('Erro ao buscar transações do Firestore no Dashboard:', error);
        setLoading(false);
      });

      // Metas
      const qMetas = query(collection(db, `metas/${user.uid}/items`));
      unsubMetas = onSnapshot(qMetas, (snapshot) => {
        setMetas(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (error) => {
        console.error('Erro ao buscar metas do Firestore no Dashboard:', error);
      });

      // Renda Extra
      const qRenda = query(collection(db, `rendaExtra/${user.uid}/items`));
      unsubRenda = onSnapshot(qRenda, (snapshot) => {
        setRendasExtras(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      }, (error) => {
        console.error('Erro ao buscar renda extra no Dashboard:', error);
      });

      // Diagnóstico / Score
      unsubDiag = onSnapshot(doc(db, 'diagnostico', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          setDiagnostico(docSnap.data());
        }
      }, (error) => {
        console.error('Erro ao buscar diagnóstico do Firestore no Dashboard:', error);
      });
    } catch (err) {
      console.error('Falha ao inicializar conexões com Firestore no Dashboard:', err);
      setLoading(false);
    }

    return () => {
      unsubTrans();
      unsubMetas();
      unsubRenda();
      unsubDiag();
    };
  }, [user?.uid, modo]);

  // Alertas Inteligentes
  useEffect(() => {
    const generateAlerts = async () => {
      if (!user?.uid) return;
      try {
        const res = await fetch('/api/cron/alertas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            transacoes: transactions.slice(0, 30),
            metas: metas
          })
        });
        const data = await res.json();
        if (data.alertas && data.alertas.length > 0) {
          for (const alertStr of data.alertas) {
            // Remove "Groq AI" ou qualquer variação semelhante da mensagem
            const cleanAlert = alertStr.replace(/Groq\s*AI:?/gi, '').trim();
            if (!cleanAlert) continue;

            // Evita duplicados fazendo uma busca pontual
            const qExist = query(
              collection(db, `notificacoes/${user.uid}/items`),
              where('mensagem', '==', cleanAlert),
              where('tipo', '==', 'alerta')
            );
            const snap = await getDocs(qExist);
            if (snap.empty) {
              await addDoc(collection(db, `notificacoes/${user.uid}/items`), {
                mensagem: cleanAlert,
                lida: false,
                criadoEm: serverTimestamp(),
                tipo: 'alerta'
              });
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch smart alerts:", e);
      }
    };

    if (transactions.length > 0) {
      generateAlerts();
    }
  }, [user?.uid, transactions.length, metas.length]);

  // Verifica saldo negativo e cria notificação
  useEffect(() => {
    if (!user?.uid || transactions.length === 0) return;
    const receitas = transactions.reduce((acc, t) => t.tipo === 'receita' ? acc + Number(t.valor) : acc, 0);
    const despesas = transactions.reduce((acc, t) => t.tipo === 'despesa' ? acc + Number(t.valor) : acc, 0);
    const saldo = receitas - despesas;
    if (saldo < 0) {
      criarNotificacao(user.uid, `⚠️ Atenção: seu saldo está negativo (${saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}). Revise seus gastos.`);
    }
  }, [user?.uid, transactions.length]);

  const setModoNoFirestore = async (novoModo: 'pessoal' | 'empresarial') => {
    if (!user?.uid || novoModo === modo) return;
    setChangingModo(true);
    try {
      await setDoc(doc(db, 'users', user.uid), { modo: novoModo }, { merge: true });
      setModo(novoModo);
    } catch (e) {
      console.error('Erro ao atualizar modo no Firestore:', e);
      alert('Erro ao alterar o modo. Tente novamente.');
    } finally {
      setChangingModo(false);
    }
  };

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  };

  const formatDate = (dateVal: any) => {
    if (!dateVal) return '--';
    let d: Date;
    if (typeof dateVal?.toDate === 'function') {
      d = dateVal.toDate();
    } else {
      d = new Date(dateVal);
    }
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const isCurrentMonth = (dateVal: any) => {
    if (!dateVal) return false;
    let d: Date;
    if (typeof dateVal?.toDate === 'function') {
      d = dateVal.toDate();
    } else {
      d = new Date(dateVal);
    }
    if (isNaN(d.getTime())) return false;
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  };

  let receitasMes = 0;
  let despesasMes = 0;

  transactions.forEach((t) => {
    const val = Number(t.valor) || 0;
    if (isCurrentMonth(t.data)) {
      if (t.tipo === 'receita') {
        receitasMes += val;
      } else {
        despesasMes += Math.abs(val);
      }
    }
  });

  const saldoTotal = receitasMes - despesasMes;

  // Calcular total reservado em metas (apenas mês atual para o card)
  const totalReservadoMetas = transactions
    .filter(t => isCurrentMonth(t.data) && (t.categoria === 'Meta' || t.origem === 'meta'))
    .reduce((s, t) => s + Number(t.valor), 0);

  // Buscar transações dos últimos 30/60/90 dias do Firestore
  const hoje = new Date();
  const diasAtras = new Date();
  diasAtras.setDate(hoje.getDate() - periodo); // 30, 60 ou 90

  // Agrupar transações por data e calcular saldo do dia
  const transacoesPorData = transactions
    .filter(t => new Date(t.data) >= diasAtras)
    .reduce((acc, t) => {
      const data = t.data.split('T')[0];
      if (!acc[data]) acc[data] = 0;
      acc[data] += t.tipo === 'receita' ? Number(t.valor) : -Number(t.valor);
      return acc;
    }, {} as Record<string, number>);

  // Converter para array ordenado por data com saldo acumulado
  let saldoAcumulado = 0;
  const chartData = Object.entries(transacoesPorData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, variacao]) => {
      saldoAcumulado += variacao;
      return {
        data: new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { 
          day: '2-digit', month: 'short' 
        }),
        saldo: parseFloat(saldoAcumulado.toFixed(2))
      };
    });

  // Cálculos Renda Extra
  const rendasExtrasMes = rendasExtras.filter(r => isCurrentMonth(r.data));
  const totalRendaExtra = rendasExtrasMes.reduce((acc, r) => acc + Number(r.valor), 0);
  const receitaFixa = Math.max(0, receitasMes - totalRendaExtra);
  const topFontes = [...rendasExtrasMes]
    .sort((a, b) => Number(b.valor) - Number(a.valor))
    .slice(0, 3);

  const scoreData = calcularScoreFinanceiro(
    receitaFixa,
    totalRendaExtra,
    despesasMes,
    rendasExtrasMes.length
  );

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Transações', path: '/transacoes', icon: CreditCard },
    { name: 'Importar', path: '/importar', icon: Upload },
    { name: 'Metas', path: '/metas', icon: Target },
    { name: 'Renda Extra', path: '/renda-extra', icon: TrendingUp },
    { name: 'Assistente IA', path: '/chat', icon: MessageCircle },
    { name: 'Níveis', path: '/niveis', icon: Trophy },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col md:flex-row selection:bg-indigo-500 selection:text-white font-sans">
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
            const isActive = location.pathname === item.path || (item.path === '/dashboard' && location.pathname === '/');
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

      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
        />
      )}

      <main className="flex-1 flex flex-col min-w-0 bg-gray-950">
        <header className="h-20 px-6 lg:px-10 border-b border-gray-900 flex items-center justify-between bg-gray-950/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-4 flex-1 max-w-md">
            <div className="relative w-full hidden sm:block">
              <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Pesquisar transações ou metas..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-900 border border-gray-800 rounded-full text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
            <h1 className="text-xl font-bold sm:hidden tracking-tight">Dashboard</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Toggle Segmentado de Modo Pessoal e Empresarial */}
            <div className="flex items-center p-1 bg-gray-900 border border-gray-800 rounded-2xl shadow-inner">
              <button
                onClick={() => setModoNoFirestore('pessoal')}
                disabled={changingModo || modo === 'pessoal'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  modo === 'pessoal'
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Pessoal</span>
              </button>
              <button
                onClick={() => setModoNoFirestore('empresarial')}
                disabled={changingModo || modo === 'empresarial'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  modo === 'empresarial'
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-indigo-600/20'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Empresarial</span>
              </button>
            </div>

            <div className="hidden lg:flex items-center mr-2 min-w-[160px] bg-gray-900 px-3.5 py-2 rounded-2xl border border-gray-800">
              <HeaderXPBar xp={profile?.xp || 0} showBar={true} />
            </div>

            <NotificacoesDropdown userId={user?.uid || ''} />

            <div className="h-6 w-px bg-gray-800 hidden sm:block"></div>

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

        <div className="flex-1 p-6 lg:p-10 space-y-8 max-w-7xl w-full mx-auto scroll-container">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-gray-900">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
                  Olá, {userName} 👋
                </h2>
                <span className={`px-2.5 py-0.5 text-[10px] font-extrabold uppercase rounded-full border ${
                  modo === 'empresarial' ? 'bg-violet-500/10 text-violet-400 border-violet-500/20' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                }`}>
                  {modo}
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-1">
                Aqui está o resumo financeiro da sua conta {modo === 'empresarial' ? 'corporativa' : 'pessoal'} neste mês.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate('/importar')}
                className="px-4 py-2.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 text-xs font-semibold rounded-xl transition-all shadow-sm"
              >
                Importar Extrato
              </button>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Nova Transação</span>
              </button>
            </div>
          </div>

          {/* Renderização dos Cards Baseada no Modo */}
          {modo === 'empresarial' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Faturamento */}
              <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-indigo-950/40 border border-gray-800 rounded-3xl p-6 lg:p-7 shadow-xl shadow-black/20 group hover:border-indigo-500/50 transition-all duration-300">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase">Faturamento (Mês)</span>
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-3xl font-extrabold text-white tracking-tight">
                    {loading ? 'Carregando...' : formatCurrency(receitasMes)}
                  </h3>
                  <div className="flex items-center gap-2 mt-3 text-xs text-emerald-400 font-medium">
                    <span className="flex items-center gap-0.5 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Empresarial</span>
                    </span>
                    <span className="text-gray-500">receita bruta</span>
                  </div>
                </div>
              </div>

              {/* Margem de Lucro */}
              <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950/30 border border-gray-800 rounded-3xl p-6 lg:p-7 shadow-xl shadow-black/20 group hover:border-emerald-500/50 transition-all duration-300">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase">Margem de Lucro</span>
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
                    <Wallet className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-3xl font-extrabold text-emerald-400 tracking-tight">
                    {loading ? 'Carregando...' : formatCurrency(receitasMes - despesasMes)}
                  </h3>
                  <div className="flex items-center gap-2 mt-3 text-xs text-emerald-400 font-medium">
                    <span className="flex items-center gap-0.5 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>
                        {receitasMes > 0 ? (((receitasMes - despesasMes) / receitasMes) * 100).toFixed(1) + '%' : '0%'}
                      </span>
                    </span>
                    <span className="text-gray-500">lucro líquido</span>
                  </div>
                </div>
              </div>

              {/* Capital de Giro */}
              <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-purple-950/30 border border-gray-800 rounded-3xl p-6 lg:p-7 shadow-xl shadow-black/20 group hover:border-purple-500/50 transition-all duration-300">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase">Capital de Giro</span>
                  <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl text-purple-400">
                    <Briefcase className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-3xl font-extrabold text-purple-400 tracking-tight">
                    {loading ? 'Carregando...' : formatCurrency(saldoTotal)}
                  </h3>
                  <div className="flex items-center gap-2 mt-3 text-xs text-purple-400 font-medium">
                    <span className="flex items-center gap-0.5 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Disponível</span>
                    </span>
                    <span className="text-gray-500">em caixa / bancos</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-6">
              <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-indigo-950/40 border border-gray-800 rounded-3xl p-6 lg:p-7 shadow-xl shadow-black/20 group hover:border-indigo-500/50 transition-all duration-300">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase">Saldo Disponível</span>
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
                    <Wallet className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-3xl font-extrabold text-white tracking-tight">
                    {loading ? 'Carregando...' : formatCurrency(saldoTotal)}
                  </h3>
                  <div className="flex items-center gap-2 mt-3 text-xs text-emerald-400 font-medium">
                    <span className="flex items-center gap-0.5 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Em tempo real</span>
                    </span>
                    <span className="text-gray-500">Firestore sync</span>
                  </div>
                  <div className="mt-2.5 text-[10px] text-gray-400/80 font-medium italic">
                    (inclui {formatCurrency(totalReservadoMetas)} reservados em metas)
                  </div>
                </div>
              </div>

              <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950/30 border border-gray-800 rounded-3xl p-6 lg:p-7 shadow-xl shadow-black/20 group hover:border-emerald-500/50 transition-all duration-300">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase">Receitas do Mês</span>
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-3xl font-extrabold text-emerald-400 tracking-tight">
                    {loading ? 'Carregando...' : formatCurrency(receitasMes)}
                  </h3>
                  <div className="flex flex-col gap-1.5 mt-3 text-xs font-medium border-t border-gray-800/60 pt-3">
                    <div className="flex justify-between items-center text-gray-400">
                      <span>Receita Fixa:</span>
                      <span className="text-emerald-400 font-bold">{formatCurrency(receitaFixa)}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-400">
                      <span>Renda Extra:</span>
                      <span className="text-emerald-400 font-bold">{formatCurrency(totalRendaExtra)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card - Fontes de Renda Extra */}
              <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-amber-950/30 border border-gray-800 rounded-3xl p-6 lg:p-7 shadow-xl shadow-black/20 group hover:border-amber-500/50 transition-all duration-300">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase">Fontes de Renda Extra</span>
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {topFontes.length > 0 ? (
                    topFontes.map((f, i) => (
                      <div key={i} className="flex justify-between items-center text-xs">
                        <span className="text-gray-300 truncate pr-2 font-medium">{f.descricao}</span>
                        <span className="text-amber-400 font-bold">{formatCurrency(Number(f.valor))}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-gray-500 italic py-2">Nenhuma renda extra no mês.</div>
                  )}
                </div>
              </div>

              <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-rose-950/30 border border-gray-800 rounded-3xl p-6 lg:p-7 shadow-xl shadow-black/20 group hover:border-rose-500/50 transition-all duration-300">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/20 transition-all"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase">Despesas do Mês</span>
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400">
                    <TrendingDown className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-3xl font-extrabold text-rose-400 tracking-tight">
                    {loading ? 'Carregando...' : formatCurrency(despesasMes)}
                  </h3>
                  <div className="flex items-center gap-2 mt-3 text-xs text-rose-400 font-medium">
                    <span className="flex items-center gap-0.5 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                      <ArrowDownLeft className="w-3.5 h-3.5" />
                      <span>Mês atual</span>
                    </span>
                    <span className="text-gray-500">dentro do orçamento</span>
                  </div>
                </div>
              </div>

              {/* Card - Reservado em Metas */}
              <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-sky-950/30 border border-gray-800 rounded-3xl p-6 lg:p-7 shadow-xl shadow-black/20 group hover:border-sky-500/50 transition-all duration-300">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl group-hover:bg-sky-500/20 transition-all"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase">Reservado em Metas</span>
                  <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-2xl text-sky-400">
                    <Target className="w-5 h-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-3xl font-extrabold text-sky-400 tracking-tight">
                    {loading ? 'Carregando...' : formatCurrency(totalReservadoMetas)}
                  </h3>
                  <div className="flex items-center gap-2 mt-3 text-xs text-sky-400 font-medium">
                    <span className="flex items-center gap-0.5 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>Mês atual</span>
                    </span>
                    <span className="text-gray-500">alocado em metas</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <CashFlowChart chartData={chartData} periodo={periodo} setPeriodo={setPeriodo} onImport={() => navigate('/importar')} />
            </div>
            <div className="space-y-6">
              <ScoreGauge score={scoreData.score} label={scoreData.label} />
              <MetasAtivasResumo metas={metas} />
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 lg:p-8 shadow-xl shadow-black/20 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Transações Recentes</h3>
                <p className="text-xs text-gray-400 mt-0.5">Últimas movimentações registradas na sua conta</p>
              </div>
              <Link
                to="/transacoes"
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1"
              >
                <span>Ver todas</span>
                <span>&rarr;</span>
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[560px]">
                <thead>
                  <tr className="border-b border-gray-800 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                    <th className="pb-3 pl-2">Descrição</th>
                    <th className="pb-3">Categoria</th>
                    <th className="pb-3">Tipo</th>
                    <th className="pb-3">Data</th>
                    <th className="pb-3 text-right pr-2">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 text-sm font-medium text-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500 font-medium">
                        Carregando transações do Firestore...
                      </td>
                    </tr>
                  ) : transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500 font-medium">
                        Nenhuma movimentação cadastrada ainda.
                      </td>
                    </tr>
                  ) : (
                    transactions.slice(0, 10).map((item) => (
                      <tr key={item.id} className="hover:bg-gray-800/40 transition-colors group">
                        <td className="py-4 pl-2">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl border flex-shrink-0 ${
                              item.tipo === 'receita' 
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            }`}>
                              {item.tipo === 'receita' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                            </div>
                            <span className="font-semibold text-white group-hover:text-indigo-300 transition-colors truncate max-w-[160px]">
                              {item.descricao || 'Sem descrição'}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 text-gray-400">
                          <span className="px-2.5 py-1 bg-gray-800 border border-gray-700/60 rounded-lg text-xs">
                            {item.categoria || 'Outros'}
                          </span>
                        </td>
                        <td className="py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ${
                            item.tipo === 'receita'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {item.tipo === 'receita'
                              ? <ArrowUpRight className="w-3 h-3" />
                              : <ArrowDownLeft className="w-3 h-3" />
                            }
                            {item.tipo === 'receita' ? 'Receita' : 'Despesa'}
                          </span>
                        </td>
                        <td className="py-4 text-xs text-gray-400 whitespace-nowrap">{formatDate(item.data)}</td>
                        <td className={`py-4 text-right pr-2 font-bold whitespace-nowrap ${
                          item.tipo === 'receita' ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {item.tipo === 'receita' ? '+' : '-'}{formatCurrency(Math.abs(item.valor))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {isModalOpen && (
        <NewTransactionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          userId={user?.uid || 'demo'}
          modo={modo}
        />
      )}
    </div>
  );
}

export default Dashboard;
