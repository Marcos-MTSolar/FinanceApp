import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { collection, addDoc, onSnapshot, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../lib/firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import { addXp } from '../lib/gamification';
import { HeaderXPBar } from '../components/HeaderXPBar';
import { NotificacoesDropdown } from '../components/NotificacoesDropdown';
import toast from 'react-hot-toast';
import {
  Activity, BarChart2, Briefcase, CheckSquare, CreditCard,
  FileText, LayoutDashboard, LogOut, Menu, MessageCircle,
  Network, Percent, PiggyBank, Plus, Scale, Shield, Tag,
  Target, Trash2, TrendingUp, Trophy, Upload, Users, X,
} from 'lucide-react';

const TIPOS_ATIVO = ['Ações', 'FII', 'Tesouro IPCA+', 'Tesouro Selic', 'CDB', 'LCI/LCA', 'Cripto', 'Outro'];

interface Ativo {
  id: string;
  tipo: string;
  ticker: string;
  quantidade: number;
  precoMedio: number;
  dataCompra: string;
  criadoEm: string;
}

export function InvestimentosPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [ativos, setAtivos] = useState<Ativo[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Campos do formulário
  const [tipo, setTipo] = useState('Ações');
  const [ticker, setTicker] = useState('');
  const [quantidade, setQuantidade] = useState('');
  const [precoMedio, setPrecoMedio] = useState('');
  const [dataCompra, setDataCompra] = useState(() => new Date().toISOString().split('T')[0]);

  const userId = user?.uid || '';
  const userName = user?.displayName || user?.email?.split('@')[0] || 'Usuário';
  const userInitials = userName.substring(0, 2).toUpperCase();

  // Carrega ativos do Firestore em tempo real
  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(
      collection(db, `investimentos/${userId}/items`),
      (snap) => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Ativo))
          .sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
        setAtivos(list);
        setLoading(false);
      },
      (err) => {
        console.error('[InvestimentosPage] Erro ao carregar ativos:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [userId]);

  // Itens de navegação — mesmo padrão do Dashboard
  const navItems: { name: string; path: string; icon: any }[] = [
    { name: 'Dashboard',     path: '/dashboard',     icon: LayoutDashboard },
    { name: 'Transações',    path: '/transacoes',    icon: CreditCard },
    { name: 'Importar',      path: '/importar',      icon: Upload },
    { name: 'Metas',         path: '/metas',         icon: Target },
    { name: 'Renda Extra',   path: '/renda-extra',   icon: TrendingUp },
    { name: 'Investimentos', path: '/investimentos', icon: BarChart2 },
    { name: 'Assistente IA', path: '/chat',          icon: MessageCircle },
    { name: 'Níveis',        path: '/niveis',        icon: Trophy },
  ];

  if (profile?.modo === 'empresarial') {
    navItems.push({ name: 'Cadastro Empresa',   path: '/empresa/cadastro',       icon: Briefcase });
    navItems.push({ name: 'Funcionários',       path: '/empresa/funcionarios',   icon: Users });
    navItems.push({ name: 'Rescisão',           path: '/empresa/rescisao',       icon: FileText });
    navItems.push({ name: 'Reservas',           path: '/empresa/reservas',       icon: PiggyBank });
    navItems.push({ name: 'Impostos',           path: '/empresa/impostos',       icon: Percent });
    navItems.push({ name: 'Centro de Custos',   path: '/empresa/centro-custos',  icon: Tag });
    navItems.push({ name: 'Indicadores',        path: '/empresa/indicadores',    icon: Activity });
    navItems.push({ name: 'Demonstrativos',     path: '/empresa/demonstrativos', icon: Scale });
    navItems.push({ name: 'Plano de Contas',    path: '/empresa/plano-contas',   icon: Network });
    navItems.push({ name: 'Conciliação',        path: '/empresa/conciliacao',    icon: CheckSquare });
  }

  const handleLogout = async () => {
    try { await signOut(auth); navigate('/login'); }
    catch { navigate('/login'); }
  };

  const handleAdicionarAtivo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticker.trim()) { toast.error('Informe o ticker do ativo.'); return; }
    if (!quantidade || Number(quantidade) <= 0) { toast.error('Informe uma quantidade válida.'); return; }
    if (!precoMedio || Number(precoMedio) <= 0) { toast.error('Informe o preço médio de compra.'); return; }
    if (!userId) return;

    setSubmitting(true);
    try {
      // Verifica se é o primeiro ativo para conceder XP
      const snap = await getDocs(collection(db, `investimentos/${userId}/items`));
      const primeiroAtivo = snap.empty;

      await addDoc(collection(db, `investimentos/${userId}/items`), {
        tipo,
        ticker: ticker.trim().toUpperCase(),
        quantidade: Number(quantidade),
        precoMedio: Number(precoMedio),
        dataCompra,
        criadoEm: new Date().toISOString(),
      });

      if (primeiroAtivo) {
        // +20 XP ao cadastrar o primeiro ativo
        await addXp(userId, 20);
        toast.success('+20 XP! Primeiro investimento cadastrado! 🚀');
      } else {
        toast.success('Ativo adicionado com sucesso! 📈');
      }

      // Resetar formulário
      setTicker('');
      setQuantidade('');
      setPrecoMedio('');
      setTipo('Ações');
      setDataCompra(new Date().toISOString().split('T')[0]);
    } catch (err) {
      console.error('[InvestimentosPage] Erro ao adicionar ativo:', err);
      toast.error('Erro ao adicionar ativo. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExcluir = async (id: string) => {
    if (!userId) return;
    try {
      await deleteDoc(doc(db, `investimentos/${userId}/items`, id));
      toast.success('Ativo removido.');
    } catch (err) {
      console.error('[InvestimentosPage] Erro ao excluir ativo:', err);
      toast.error('Erro ao remover ativo.');
    }
  };

  // Cálculos de resumo
  const totalInvestido = ativos.reduce((acc, a) => acc + a.quantidade * a.precoMedio, 0);
  const tiposDistintos = [...new Set(ativos.map(a => a.tipo))];
  const distribuicaoPorTipo = tiposDistintos.map(t => ({
    tipo: t,
    total: ativos.filter(a => a.tipo === t).reduce((acc, a) => acc + a.quantidade * a.precoMedio, 0),
  }));

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  const formatDate = (d: string) => {
    if (!d) return '--';
    const dt = new Date(d.length === 10 ? d + 'T12:00:00' : d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('pt-BR');
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-950 text-white flex flex-col md:flex-row selection:bg-indigo-500 selection:text-white font-sans">

      {/* Cabeçalho mobile */}
      <div className="md:hidden flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">FinanceAI</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-gray-400 hover:text-white rounded-lg bg-gray-800/60 focus:outline-none">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-gray-900 border-r border-gray-800 flex flex-col overflow-y-auto h-full transition-transform duration-300 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="h-20 flex items-center gap-3 px-8 border-b border-gray-800/60 flex-shrink-0">
          <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 ring-1 ring-white/10">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-gray-200 to-indigo-200 bg-clip-text text-transparent">FinanceAI</span>
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
                <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-indigo-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800/80 flex-shrink-0">
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
        <div onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden" />
      )}

      {/* Conteúdo principal */}
      <main className="flex-1 flex flex-col min-w-0 bg-gray-950 h-full overflow-y-auto">
        {/* Header */}
        <header className="h-20 px-6 lg:px-10 border-b border-gray-900 flex items-center justify-between bg-gray-950/80 backdrop-blur-md sticky top-0 z-20">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-indigo-400" />
              Investimentos
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">Gerencie sua carteira de ativos financeiros</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center mr-2 min-w-[160px] bg-gray-900 px-3.5 py-2 rounded-2xl border border-gray-800">
              <HeaderXPBar xp={profile?.xp || 0} showBar={true} />
            </div>
            <NotificacoesDropdown userId={userId} />
            <button onClick={handleLogout} title="Sair" className="p-2.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-full transition-all">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 p-6 lg:p-10 space-y-8 max-w-7xl w-full mx-auto">

          {/* Card de Resumo */}
          <div className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-900 to-indigo-950/40 border border-gray-800 rounded-3xl p-6 lg:p-8 shadow-xl shadow-black/20">
            <div className="absolute top-0 right-0 -mt-6 -mr-6 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              {/* Total Investido */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Investido</p>
                <h2 className="text-4xl font-extrabold text-white tracking-tight mt-1">
                  {loading ? 'Carregando...' : formatCurrency(totalInvestido)}
                </h2>
                <p className="text-xs text-indigo-400 font-medium mt-1">
                  {tiposDistintos.length} {tiposDistintos.length === 1 ? 'tipo de ativo' : 'tipos de ativos distintos'}
                  {ativos.length > 0 && ` · ${ativos.length} ${ativos.length === 1 ? 'ativo' : 'ativos'}`}
                </p>
              </div>
              {/* Distribuição por tipo */}
              {distribuicaoPorTipo.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {distribuicaoPorTipo.map(d => (
                    <div key={d.tipo} className="px-3 py-2 bg-gray-800/70 border border-gray-700/60 rounded-2xl text-xs font-semibold text-white whitespace-nowrap">
                      <span className="text-gray-400">{d.tipo}:</span>{' '}
                      <span className="text-indigo-300">{formatCurrency(d.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Formulário de cadastro */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 lg:p-8 shadow-xl shadow-black/20">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-400" />
              Adicionar Ativo
            </h3>
            <form onSubmit={handleAdicionarAtivo}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">

                {/* Tipo */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tipo de Ativo</label>
                  <select
                    id="inv-tipo"
                    value={tipo}
                    onChange={e => setTipo(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm font-medium text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  >
                    {TIPOS_ATIVO.map(t => (
                      <option key={t} value={t} className="bg-gray-900">{t}</option>
                    ))}
                  </select>
                </div>

                {/* Ticker */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Ticker / Nome</label>
                  <input
                    id="inv-ticker"
                    type="text"
                    placeholder="Ex: PETR4, MXRF11, BTC"
                    value={ticker}
                    onChange={e => setTicker(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm font-medium text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                {/* Quantidade */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Quantidade</label>
                  <input
                    id="inv-quantidade"
                    type="number"
                    min="0.000001"
                    step="any"
                    placeholder="Ex: 100"
                    value={quantidade}
                    onChange={e => setQuantidade(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm font-medium text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                {/* Preço Médio */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Preço Médio (R$)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-gray-500">R$</span>
                    <input
                      id="inv-preco-medio"
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0,00"
                      value={precoMedio}
                      onChange={e => setPrecoMedio(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm font-medium text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {/* Data de Compra */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Data de Compra</label>
                  <input
                    id="inv-data-compra"
                    type="date"
                    value={dataCompra}
                    onChange={e => setDataCompra(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm font-medium text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                {/* Valor Total Estimado (calculado) */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Valor Total Estimado</label>
                  <div className="w-full px-4 py-3 bg-gray-950/60 border border-gray-800/60 rounded-2xl text-sm font-bold text-indigo-300 select-none">
                    {quantidade && precoMedio && Number(quantidade) > 0 && Number(precoMedio) > 0
                      ? formatCurrency(Number(quantidade) * Number(precoMedio))
                      : <span className="text-gray-600 font-normal">Preencha quantidade e preço</span>
                    }
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  id="inv-btn-adicionar"
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-600/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  {submitting ? 'Adicionando...' : 'Adicionar Ativo'}
                </button>
              </div>
            </form>
          </div>

          {/* Tabela de ativos */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 lg:p-8 shadow-xl shadow-black/20">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-indigo-400" />
              Carteira de Ativos
              {ativos.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-xs text-indigo-400 font-bold">
                  {ativos.length}
                </span>
              )}
            </h3>

            {loading ? (
              <div className="py-12 text-center text-gray-500 font-medium">Carregando ativos...</div>
            ) : ativos.length === 0 ? (
              <div className="py-12 text-center">
                <BarChart2 className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Nenhum ativo cadastrado ainda.</p>
                <p className="text-xs text-gray-600 mt-1">Use o formulário acima para adicionar seu primeiro investimento.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[640px]">
                  <thead>
                    <tr className="border-b border-gray-800 text-xs font-semibold tracking-wider text-gray-500 uppercase">
                      <th className="pb-3 pl-2">Tipo</th>
                      <th className="pb-3">Ticker</th>
                      <th className="pb-3 text-right">Quantidade</th>
                      <th className="pb-3 text-right">Preço Médio</th>
                      <th className="pb-3 text-right">Valor Total</th>
                      <th className="pb-3">Data Compra</th>
                      <th className="pb-3 text-center">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 text-sm font-medium text-gray-200">
                    {ativos.map(ativo => (
                      <tr key={ativo.id} className="hover:bg-gray-800/40 transition-colors group">
                        <td className="py-4 pl-2">
                          <span className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-xs text-indigo-300 font-semibold whitespace-nowrap">
                            {ativo.tipo}
                          </span>
                        </td>
                        <td className="py-4">
                          <span className="font-bold text-white tracking-wider">{ativo.ticker}</span>
                        </td>
                        <td className="py-4 text-right text-gray-300">
                          {Number(ativo.quantidade).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-4 text-right text-gray-300">
                          {formatCurrency(ativo.precoMedio)}
                        </td>
                        <td className="py-4 text-right font-bold text-emerald-400">
                          {formatCurrency(ativo.quantidade * ativo.precoMedio)}
                        </td>
                        <td className="py-4 text-gray-400 text-xs">
                          {formatDate(ativo.dataCompra)}
                        </td>
                        <td className="py-4 text-center">
                          <button
                            onClick={() => handleExcluir(ativo.id)}
                            title="Remover ativo"
                            className="p-2 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {ativos.length > 1 && (
                    <tfoot>
                      <tr className="border-t border-gray-700">
                        <td colSpan={4} className="py-4 pl-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Total da Carteira</td>
                        <td className="py-4 text-right font-extrabold text-white text-base">{formatCurrency(totalInvestido)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
