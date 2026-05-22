import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  LayoutDashboard, CreditCard, Target, Upload, MessageCircle, Trophy,
  TrendingUp, Shield, Briefcase, Menu, X, LogOut, Users, FileText,
  PiggyBank, Percent, Tag, Plus, Trash2, Loader2, PieChart
, Network, CheckSquare } from 'lucide-react';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface CentroCusto {
  id: string;
  nome: string;
  criadoEm?: any;
}

export function CentroCustosPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [user, setUser] = useState(auth.currentUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [centros, setCentros] = useState<CentroCusto[]>([]);
  const [transacoes, setTransacoes] = useState<any[]>([]);
  const [novoCentro, setNovoCentro] = useState('');
  const [loadingCentros, setLoadingCentros] = useState(true);
  const [loadingTrans, setLoadingTrans] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { const u = onAuthStateChanged(auth, s => setUser(s)); return u; }, []);

  useEffect(() => {
    if (!profile?.modo || profile.modo !== 'empresarial') { navigate('/dashboard'); }
  }, [profile, navigate]);

  // Carrega centros de custo
  useEffect(() => {
    if (!user?.uid) return;
    const q = collection(db, `centrosCusto/${user.uid}/items`);
    const u = onSnapshot(q, snap => {
      setCentros(snap.docs.map(d => ({ id: d.id, ...d.data() } as CentroCusto)));
      setLoadingCentros(false);
    }, () => setLoadingCentros(false));
    return u;
  }, [user?.uid]);

  // Carrega transações
  useEffect(() => {
    if (!user?.uid) return;
    const q = collection(db, `transacoes/${user.uid}/items`);
    const u = onSnapshot(q, snap => {
      setTransacoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingTrans(false);
    }, () => setLoadingTrans(false));
    return u;
  }, [user?.uid]);

  const handleCriarCentro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoCentro.trim()) return;
    if (centros.some(c => c.nome.toLowerCase() === novoCentro.trim().toLowerCase())) {
      toast.error('Este centro de custo já existe.');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, `centrosCusto/${user?.uid}/items`), {
        nome: novoCentro.trim(),
        criadoEm: serverTimestamp()
      });
      setNovoCentro('');
      toast.success('Centro de custo criado! 🏷️');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar centro de custo.');
    } finally {
      setSaving(false);
    }
  };

  const handleExcluirCentro = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja remover este centro de custo?')) return;
    try {
      await deleteDoc(doc(db, `centrosCusto/${user?.uid}/items`, id));
      toast.success('Centro de custo removido.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao remover.');
    }
  };

  // AG RUPAMENTO DE TRANSAÇÕES
  const despesasMesAtual = transacoes.filter(t => {
    if (t.tipo !== 'despesa') return false;
    if (!t.data) return false;
    const transDate = new Date(t.data);
    const today = new Date();
    return transDate.getMonth() === today.getMonth() && transDate.getFullYear() === today.getFullYear();
  });

  const chartData = centros.map(c => {
    const total = despesasMesAtual
      .filter(t => t.centroCusto === c.nome)
      .reduce((s, t) => s + (t.valor || 0), 0);
    return { name: c.nome, total };
  }).filter(item => item.total > 0 || centros.length <= 6); // exibe todos se houver poucos

  const totalGeralDespesas = despesasMesAtual.reduce((s, t) => s + (t.valor || 0), 0);
  const totalAgrupadoCentros = chartData.reduce((s, t) => s + t.total, 0);
  const totalSemCentro = Math.max(0, totalGeralDespesas - totalAgrupadoCentros);

  if (totalSemCentro > 0) {
    chartData.push({ name: 'Sem Centro de Custo', total: totalSemCentro });
  }

  const handleLogout = async () => { try { await signOut(auth); navigate('/login'); } catch { navigate('/login'); } };
  const userName = user?.displayName || user?.email?.split('@')[0] || profile?.nome || 'Usuário';
  const userInitials = userName.substring(0, 2).toUpperCase();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Transações', path: '/transacoes', icon: CreditCard },
    { name: 'Importar', path: '/importar', icon: Upload },
    { name: 'Metas', path: '/metas', icon: Target },
    { name: 'Renda Extra', path: '/renda-extra', icon: TrendingUp },
    { name: 'Assistente IA', path: '/chat', icon: MessageCircle },
    { name: 'Níveis', path: '/niveis', icon: Trophy },
  ];
  if (profile?.modo === 'empresarial') {
    navItems.push({ name: 'Cadastro Empresa', path: '/empresa/cadastro', icon: Briefcase });
    navItems.push({ name: 'Funcionários', path: '/empresa/funcionarios', icon: Users });
    navItems.push({ name: 'Rescisão', path: '/empresa/rescisao', icon: FileText });
    navItems.push({ name: 'Reservas', path: '/empresa/reservas', icon: PiggyBank });
    navItems.push({ name: 'Impostos', path: '/empresa/impostos', icon: Percent });
    navItems.push({ name: 'Centro de Custos', path: '/empresa/centro-custos', icon: Tag });
      if (!navItems.some(item => item.path === '/empresa/plano-contas')) {
      navItems.push({ name: 'Plano de Contas', path: '/empresa/plano-contas', icon: Network });
      navItems.push({ name: 'Conciliação', path: '/empresa/conciliacao', icon: CheckSquare });
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col md:flex-row font-sans">
      {/* Mobile header */}
      <div className="md:hidden flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl flex items-center justify-center"><Shield className="w-5 h-5 text-white" /></div>
          <span className="font-bold text-lg bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">FinanceAI</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-gray-400 hover:text-white rounded-lg bg-gray-800/60">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-300 md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="h-20 flex items-center gap-3 px-8 border-b border-gray-800/60">
          <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl flex items-center justify-center ring-1 ring-white/10"><Shield className="w-6 h-6 text-white" /></div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-gray-200 to-indigo-200 bg-clip-text text-transparent">FinanceAI</span>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.name} to={item.path} onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all duration-200 group ${isActive ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/25' : 'text-gray-400 hover:text-white hover:bg-gray-800/70'}`}>
                <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-indigo-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-gray-800/80">
          <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-gray-950/50 border border-gray-800/60">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white">{userInitials}</div>
            <div className="flex-1 min-w-0"><p className="text-xs font-semibold text-white truncate">{userName}</p><p className="text-[10px] text-indigo-400 font-medium">Conectado</p></div>
          </div>
        </div>
      </aside>
      {mobileMenuOpen && <div onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden" />}

      <main className="flex-1 flex flex-col min-w-0 bg-gray-950">
        <header className="h-20 px-6 lg:px-10 border-b border-gray-900 flex items-center justify-between bg-gray-950/80 backdrop-blur-md sticky top-0 z-20">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2"><Tag className="w-6 h-6 text-indigo-400" />Centro de Custos</h1>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold text-white">{userName}</span>
              <span className="text-[11px] text-violet-400 font-medium flex items-center gap-1 justify-end"><span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block animate-pulse" />Modo Empresarial</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-sm font-bold ring-2 ring-indigo-500/30">{userInitials}</div>
            <button onClick={handleLogout} className="p-2.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-full transition-all"><LogOut className="w-4 h-4" /></button>
          </div>
        </header>

        <div className="flex-1 p-6 lg:p-10 max-w-6xl w-full mx-auto space-y-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Adicionar & Listar */}
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl space-y-6 lg:col-span-1">
              <div>
                <h2 className="text-base font-bold text-white">Criar Centro de Custo</h2>
                <p className="text-xs text-gray-400 mt-0.5">Defina novas divisões operacionais.</p>
              </div>

              <form onSubmit={handleCriarCentro} className="space-y-3">
                <input
                  type="text"
                  placeholder="Ex: Marketing, RH, Filial 1"
                  value={novoCentro}
                  onChange={e => setNovoCentro(e.target.value)}
                  maxLength={30}
                  className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-bold rounded-2xl shadow-lg transition-all"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Criar Centro
                </button>
              </form>

              <div className="border-t border-gray-800/80 pt-5 space-y-3">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Centros Ativos</h3>
                {loadingCentros ? (
                  <div className="text-center py-4"><Loader2 className="w-5 h-5 text-indigo-500 animate-spin mx-auto" /></div>
                ) : centros.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Nenhum centro cadastrado.</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {centros.map(c => (
                      <div key={c.id} className="flex items-center justify-between px-3 py-2.5 bg-gray-950 border border-gray-850 rounded-xl group">
                        <span className="text-sm font-semibold text-white">{c.nome}</span>
                        <button
                          onClick={() => handleExcluirCentro(c.id)}
                          className="p-1.5 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all md:opacity-0 md:group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Painel Gráfico */}
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl lg:col-span-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-6">
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2"><PieChart className="w-5 h-5 text-indigo-400" />Distribuição de Custos</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Demonstrativo de saídas por centro de custo no mês atual.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Total Despesas do Mês</p>
                    <p className="text-lg font-extrabold text-rose-400">{fmt(totalGeralDespesas)}</p>
                  </div>
                </div>

                {loadingTrans ? (
                  <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
                ) : chartData.length === 0 ? (
                  <div className="text-center py-20 bg-gray-950/20 rounded-2xl border border-dashed border-gray-850">
                    <Tag className="w-12 h-12 text-gray-800 mx-auto mb-3" />
                    <p className="text-gray-500 font-semibold text-sm">Nenhuma despesa registrada para o mês atual.</p>
                  </div>
                ) : (
                  <div className="h-72 w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                        <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} />
                        <YAxis stroke="#6b7280" fontSize={10} tickLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px', color: '#fff' }}
                          formatter={(value: any) => [fmt(Number(value)), 'Total Gasto']}
                        />
                        <Bar dataKey="total" fill="url(#colorTotal)" radius={[8, 8, 0, 0]} />
                        <defs>
                          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.85}/>
                            <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.2}/>
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {chartData.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-gray-800 pt-5 mt-5">
                  {chartData.map((item, idx) => (
                    <div key={item.name} className="bg-gray-950/50 border border-gray-850 rounded-2xl px-4 py-3">
                      <p className="text-[10px] font-bold text-gray-500 truncate uppercase">{item.name}</p>
                      <p className="text-sm font-extrabold text-white mt-0.5">{fmt(item.total)}</p>
                      <p className="text-[10px] text-indigo-400 font-medium">
                        {totalGeralDespesas > 0 ? ((item.total / totalGeralDespesas) * 100).toFixed(1) : 0}% do total
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}

export default CentroCustosPage;
