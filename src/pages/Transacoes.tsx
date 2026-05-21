import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, onSnapshot, orderBy, doc, deleteDoc, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { auth, db } from '../lib/firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import { NewTransactionModal } from '../components/NewTransactionModal';
import { 
  LayoutDashboard, 
  CreditCard, 
  Target, 
  User, 
  LogOut, 
  Search, 
  Shield, 
  Filter, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Plus, 
  Menu, 
  X,
  Calendar,
  Tag,
  Upload,
  MessageCircle,
  Trophy,
  TrendingUp
} from 'lucide-react';

const CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Moradia',
  'Saúde',
  'Lazer',
  'Assinatura',
  'Salário',
  'Outros'
];

export function Transacoes() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [user, setUser] = useState(auth.currentUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de Filtro
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTipo, setFilterTipo] = useState<'todos' | 'receita' | 'despesa'>('todos');
  const [filterCategoria, setFilterCategoria] = useState('todos');
  const [filterPeriodo, setFilterPeriodo] = useState<'este_mes' | 'ultimo_mes' | 'tres_meses' | 'todos'>('este_mes');
  const [filterOrigem, setFilterOrigem] = useState('todas');

  // Modo do perfil do usuário (pessoal ou empresarial)
  const modo = (profile?.modo as 'pessoal' | 'empresarial') || 'pessoal';

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const timer = setTimeout(() => {
      console.warn("Firestore timeout de 5 segundos em Transacoes. Apresentando fallback.");
      setLoading(false);
    }, 5000);

    let unsubscribe = () => {};

    try {
      const q = query(
        collection(db, `transacoes/${user.uid}/items`),
        where('modo', '==', modo)
      );

      unsubscribe = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a: any, b: any) => new Date(b.data).getTime() - new Date(a.data).getTime());
        setTransactions(list);
        setLoading(false);
        clearTimeout(timer);
      }, (error) => {
        console.error('Erro ao buscar transações do Firestore em Transacoes:', error);
        setLoading(false);
        clearTimeout(timer);
      });
    } catch (err) {
      console.error('Falha ao conectar transações:', err);
      setLoading(false);
      clearTimeout(timer);
    }

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [user?.uid]);

  const handleDelete = async (t: any) => {
    if (!user?.uid) return;
    if (window.confirm('Tem certeza que deseja excluir esta transação?')) {
      try {
        await deleteDoc(doc(db, `transacoes/${user.uid}/items`, t.id));
        
        if (t.origem === 'renda_extra' && t.rendaExtraId) {
          if (window.confirm('Deseja remover também a renda extra vinculada?')) {
            await deleteDoc(doc(db, `rendaExtra/${user.uid}/items`, t.rendaExtraId));
          }
        }
        toast.success('Transação excluída com sucesso!');
      } catch (err) {
        console.error('Erro ao excluir transação:', err);
        toast.error('Erro ao excluir transação. Tente novamente.');
      }
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
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const getDateObj = (dateVal: any): Date | null => {
    if (!dateVal) return null;
    let d: Date;
    if (typeof dateVal?.toDate === 'function') {
      d = dateVal.toDate();
    } else {
      d = new Date(dateVal);
    }
    return isNaN(d.getTime()) ? null : d;
  };

  const filteredTransactions = transactions.filter((t) => {
    const matchSearch = searchQuery.trim() === '' || 
      t.descricao?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.categoria?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchTipo = filterTipo === 'todos' || t.tipo === filterTipo;
    const matchCategoria = filterCategoria === 'todos' || t.categoria === filterCategoria;

    let matchPeriodo = true;
    const d = getDateObj(t.data);
    if (d && filterPeriodo !== 'todos') {
      if (filterPeriodo === 'este_mes') {
        matchPeriodo = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      } else if (filterPeriodo === 'ultimo_mes') {
        let lastMonth = currentMonth - 1;
        let year = currentYear;
        if (lastMonth < 0) {
          lastMonth = 11;
          year -= 1;
        }
        matchPeriodo = d.getMonth() === lastMonth && d.getFullYear() === year;
      } else if (filterPeriodo === 'tres_meses') {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(now.getMonth() - 3);
        matchPeriodo = d >= threeMonthsAgo;
      }
    }

    let matchOrigem = true;
    if (filterOrigem !== 'todas') {
      const isMeta = t.origem === 'meta' || t.categoria === 'Meta';
      if (filterOrigem === 'manual') matchOrigem = !t.origem || t.origem === 'manual';
      else if (filterOrigem === 'meta') matchOrigem = isMeta;
      else matchOrigem = t.origem === filterOrigem;
    }

    return matchSearch && matchTipo && matchCategoria && matchPeriodo && matchOrigem;
  });

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

      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
        />
      )}

      <main className="flex-1 flex flex-col min-w-0 bg-gray-950">
        <header className="h-20 px-6 lg:px-10 border-b border-gray-900 flex items-center justify-between bg-gray-950/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-4 flex-1 max-w-md">
            <h1 className="text-xl font-bold tracking-tight text-white">Transações</h1>
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

        <div className="flex-1 p-6 lg:p-10 space-y-8 max-w-7xl w-full mx-auto scroll-container">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-900">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-white">
                Histórico de Transações
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Acompanhe e gerencie todas as entradas e saídas da sua conta.
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold rounded-2xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Nova Transação</span>
            </button>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl shadow-black/20 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800/80">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <Filter className="w-4 h-4 text-indigo-400" />
                <span>Filtros de Pesquisa</span>
              </div>
              <span className="text-xs font-semibold px-3 py-1 bg-gray-950 border border-gray-800 rounded-xl text-indigo-400">
                {filteredTransactions.length} registros encontrados
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Pesquisar descrição..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-950 border border-gray-800 rounded-2xl text-xs font-medium text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div className="flex bg-gray-950 border border-gray-800 rounded-2xl p-1">
                {(['todos', 'receita', 'despesa'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterTipo(t)}
                    className={`flex-1 text-xs py-1.5 px-3 rounded-xl font-bold capitalize transition-all ${
                      filterTipo === t
                        ? t === 'receita' 
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                          : t === 'despesa'
                          ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                          : 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Tag className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={filterCategoria}
                  onChange={(e) => setFilterCategoria(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-950 border border-gray-800 rounded-2xl text-xs font-medium text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none"
                >
                  <option value="todos">Todas Categorias</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <Calendar className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={filterPeriodo}
                  onChange={(e: any) => setFilterPeriodo(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-950 border border-gray-800 rounded-2xl text-xs font-medium text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none"
                >
                  <option value="este_mes">Este Mês</option>
                  <option value="ultimo_mes">Último Mês</option>
                  <option value="tres_meses">Últimos 3 Meses</option>
                  <option value="todos">Todo o Histórico</option>
                </select>
              </div>

              <div className="relative">
                <Tag className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={filterOrigem}
                  onChange={(e) => setFilterOrigem(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-950 border border-gray-800 rounded-2xl text-xs font-medium text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all appearance-none"
                >
                  <option value="todas">Todas Origens</option>
                  <option value="manual">Manual</option>
                  <option value="importacao">Importado</option>
                  <option value="renda_extra">Renda Extra</option>
                  <option value="meta">Meta</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 lg:p-8 shadow-xl shadow-black/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-800 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                    <th className="pb-4 pl-2">Data</th>
                    <th className="pb-4">Descrição</th>
                    <th className="pb-4">Categoria</th>
                    <th className="pb-4">Tipo</th>
                    <th className="pb-4 text-right pr-4">Valor</th>
                    <th className="pb-4 w-12 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 text-sm font-medium text-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500 font-medium">
                        Carregando transações do Firestore...
                      </td>
                    </tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500 font-medium bg-gray-950/30 rounded-2xl">
                        Nenhuma transação encontrada com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-800/40 transition-colors group">
                        <td className="py-4 pl-2 text-xs text-gray-400 font-semibold whitespace-nowrap">
                          {formatDate(item.data)}
                        </td>
                        <td className="py-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl border flex-shrink-0 ${
                              item.tipo === 'receita' 
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                            }`}>
                              {item.tipo === 'receita' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                            </div>
                            <span className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
                              {item.descricao || 'Sem descrição'}
                            </span>
                          </div>
                        </td>
                        <td className="py-4">
                          <div className="flex flex-col gap-1.5 items-start">
                            <span className="px-3 py-1 bg-gray-950 border border-gray-800/80 rounded-xl text-xs text-gray-300 font-semibold shadow-sm">
                              {item.categoria || 'Outros'}
                            </span>
                            {(() => {
                              const isMeta = item.origem === 'meta' || item.categoria === 'Meta';
                              if (item.origem === 'renda_extra') return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">Renda Extra</span>;
                              if (isMeta) return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase tracking-wider">Meta</span>;
                              if (item.origem === 'importacao') return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase tracking-wider">Importado</span>;
                              return <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-500/10 text-gray-400 border border-gray-500/20 uppercase tracking-wider">Manual</span>;
                            })()}
                          </div>
                        </td>
                        <td className="py-4">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider ${
                            item.tipo === 'receita' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {item.tipo || 'despesa'}
                          </span>
                        </td>
                        <td className={`py-4 text-right pr-4 font-extrabold text-base whitespace-nowrap ${
                          item.tipo === 'receita' ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {item.tipo === 'receita' ? '+' : '-'}{formatCurrency(Math.abs(item.valor))}
                        </td>
                        <td className="py-4 text-center">
                          <button
                            onClick={() => handleDelete(item)}
                            title="Excluir Transação"
                            className="p-2 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all opacity-70 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

export default Transacoes;
