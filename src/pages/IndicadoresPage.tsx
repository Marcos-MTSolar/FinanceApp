import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { Activity, ArrowUpRight, Briefcase, CheckSquare, CreditCard, DollarSign, FileText, LayoutDashboard, LogOut, Menu, MessageCircle, Network, Percent, PiggyBank, Scale, Shield, Tag, Target, TrendingDown, TrendingUp, Trophy, Upload, Users, X } from 'lucide-react';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function IndicadoresPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [user, setUser] = useState(auth.currentUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Firestore collections states
  const [transacoes, setTransacoes] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);

  // Manual inputs states
  const [ticketMedio, setTicketMedio] = useState(() => localStorage.getItem('ind_ticket_medio') || '150');
  const [passivoTotal, setPassivoTotal] = useState(() => localStorage.getItem('ind_passivo_total') || '50000');
  const [patrimonioLiquido, setPatrimonioLiquido] = useState(() => localStorage.getItem('ind_patrimonio_liq') || '100000');
  const [custosDiretosInput, setCustosDiretosInput] = useState(() => localStorage.getItem('ind_custos_diretos') || '');
  const [custosFixosInput, setCustosFixosInput] = useState(() => localStorage.getItem('ind_custos_fixos') || '');

  useEffect(() => { const u = onAuthStateChanged(auth, s => setUser(s)); return u; }, []);

  useEffect(() => {
    if (!profile?.modo || profile.modo !== 'empresarial') { navigate('/dashboard'); }
  }, [profile, navigate]);

  // Carrega transações
  useEffect(() => {
    if (!user?.uid) return;
    const q = collection(db, `transacoes/${user.uid}/items`);
    const u = onSnapshot(q, snap => {
      setTransacoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return u;
  }, [user?.uid]);

  // Carrega funcionários
  useEffect(() => {
    if (!user?.uid) return;
    const q = collection(db, `funcionarios/${user.uid}/items`);
    const u = onSnapshot(q, snap => {
      setFuncionarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return u;
  }, [user?.uid]);

  // Save overrides in LocalStorage for persistence/resilience
  useEffect(() => {
    localStorage.setItem('ind_ticket_medio', ticketMedio);
    localStorage.setItem('ind_passivo_total', passivoTotal);
    localStorage.setItem('ind_patrimonio_liq', patrimonioLiquido);
    localStorage.setItem('ind_custos_diretos', custosDiretosInput);
    localStorage.setItem('ind_custos_fixos', custosFixosInput);
  }, [ticketMedio, passivoTotal, patrimonioLiquido, custosDiretosInput, custosFixosInput]);

  // CALCULO DE DADOS REAIS DO MÊS
  const despesasMes = transacoes.filter(t => {
    if (t.tipo !== 'despesa') return false;
    if (!t.data) return false;
    const transDate = new Date(t.data);
    const today = new Date();
    return transDate.getMonth() === today.getMonth() && transDate.getFullYear() === today.getFullYear();
  });

  const receitasMes = transacoes.filter(t => {
    if (t.tipo !== 'receita') return false;
    if (!t.data) return false;
    const transDate = new Date(t.data);
    const today = new Date();
    return transDate.getMonth() === today.getMonth() && transDate.getFullYear() === today.getFullYear();
  });

  const receitaBruta = receitasMes.reduce((s, t) => s + (t.valor || 0), 0);
  const despesasTotais = despesasMes.reduce((s, t) => s + (t.valor || 0), 0);
  const lucroLiquido = receitaBruta - despesasTotais;

  // Custos Diretos (Insumos, Estoque, Vendas)
  const custosDiretosCalculados = despesasMes
    .filter(t => ['estoque', 'custo', 'compra', 'fornecedor', 'direto'].some(k => t.descricao?.toLowerCase().includes(k) || t.categoria?.toLowerCase().includes(k)))
    .reduce((s, t) => s + (t.valor || 0), 0) || (despesasTotais * 0.35); // fallback de 35% se não identificar
  const custosDiretos = custosDiretosInput !== '' ? Number(custosDiretosInput) : custosDiretosCalculados;

  // Custos Fixos (Aluguel, Folha, Admin)
  const custosFixosCalculados = despesasMes
    .filter(t => ['aluguel', 'energia', 'agua', 'internet', 'fixo', 'administrativo', 'rh'].some(k => t.descricao?.toLowerCase().includes(k) || t.categoria?.toLowerCase().includes(k)))
    .reduce((s, t) => s + (t.valor || 0), 0) || (despesasTotais * 0.65); // fallback de 65%
  const custosFixos = custosFixosInput !== '' ? Number(custosFixosInput) : custosFixosCalculados;

  // Total da Folha de Funcionários
  const totalFolha = funcionarios.reduce((s, f) => s + (f.salarioBruto || 0), 0);

  // 1. Margem Bruta
  const margemBruta = receitaBruta > 0 ? ((receitaBruta - custosDiretos) / receitaBruta) * 100 : 0;

  // 2. Margem Líquida
  const margemLiquida = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;

  // 3. Lucratividade
  const lucratividade = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0;

  // 4. Margem de Contribuição e Ponto de Equilíbrio
  const margemContrPercent = receitaBruta > 0 ? ((receitaBruta - custosDiretos) / receitaBruta) : 0.60; // fallback 60% se sem receita
  const pontoEquilibrioR = margemContrPercent > 0 ? custosFixos / margemContrPercent : 0;
  const ticketMedioNum = Number(ticketMedio) || 150;
  const pontoEquilibrioU = ticketMedioNum > 0 ? pontoEquilibrioR / ticketMedioNum : 0;

  // 5. Endividamento
  const passivoNum = Number(passivoTotal) || 0;
  const patriNum = Number(patrimonioLiquido) || 100000;
  const endividamento = patriNum > 0 ? (passivoNum / patriNum) * 100 : 0;

  // 6. Comprometimento da Folha
  const comprometimentoFolha = receitaBruta > 0 ? (totalFolha / receitaBruta) * 100 : 0;

  // RENDER HELPERS PARA BADGES VISUAIS
  const getStatusClass = (valor: number, limites: { green: (v: number) => boolean, yellow: (v: number) => boolean }) => {
    if (limites.green(valor)) return { label: 'Saudável', bg: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
    if (limites.yellow(valor)) return { label: 'Atenção', bg: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' };
    return { label: 'Crítico', bg: 'bg-rose-500/10 text-rose-400 border border-rose-500/20' };
  };

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

  const inputCls = "w-full px-3 py-2 bg-gray-950 border border-gray-850 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 transition-all";
  const labelCls = "block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1";

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
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2"><Activity className="w-6 h-6 text-indigo-400" />Indicadores Financeiros</h1>
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
          
          {/* Ajuste Paramétrico / Formulário Rápido */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider border-l-2 border-indigo-500 pl-3">Ajustar Parâmetros de Simulação</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <label className={labelCls}>Ticket Médio (R$)</label>
                <input type="number" value={ticketMedio} onChange={e => setTicketMedio(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Passivo Total (R$)</label>
                <input type="number" value={passivoTotal} onChange={e => setPassivoTotal(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Patrimônio Líquido (R$)</label>
                <input type="number" value={patrimonioLiquido} onChange={e => setPatrimonioLiquido(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Ajuste Custos Diretos (R$)</label>
                <input type="number" placeholder={`Calculado: ${fmt(custosDiretosCalculados)}`} value={custosDiretosInput} onChange={e => setCustosDiretosInput(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Ajuste Custos Fixos (R$)</label>
                <input type="number" placeholder={`Calculado: ${fmt(custosFixosCalculados)}`} value={custosFixosInput} onChange={e => setCustosFixosInput(e.target.value)} className={inputCls} />
              </div>
            </div>
          </div>

          {/* DADOS BASE DO MÊS */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-gray-900 border border-gray-850 rounded-2xl p-5 flex items-center justify-between shadow-md">
              <div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Faturamento Período</p><p className="text-xl font-black text-emerald-400 mt-1">{fmt(receitaBruta)}</p></div>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl"><ArrowUpRight className="w-5 h-5" /></div>
            </div>
            <div className="bg-gray-900 border border-gray-850 rounded-2xl p-5 flex items-center justify-between shadow-md">
              <div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Saídas Totais</p><p className="text-xl font-black text-rose-400 mt-1">{fmt(despesasTotais)}</p></div>
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl"><TrendingDown className="w-5 h-5" /></div>
            </div>
            <div className="bg-gray-900 border border-gray-850 rounded-2xl p-5 flex items-center justify-between shadow-md">
              <div><p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Resultado Operacional</p><p className={`text-xl font-black mt-1 ${lucroLiquido >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(lucroLiquido)}</p></div>
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-2xl"><DollarSign className="w-5 h-5" /></div>
            </div>
          </div>

          {/* GRID DE INDICADORES TRABALHADOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Margem Bruta */}
            {(() => {
              const status = getStatusClass(margemBruta, { green: v => v >= 40, yellow: v => v >= 20 });
              return (
                <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between h-52">
                  <div className="flex justify-between items-start">
                    <div><h3 className="font-bold text-white text-base">Margem Bruta</h3><p className="text-[10px] text-gray-500 mt-0.5">Rentabilidade operacional básica da empresa.</p></div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${status.bg}`}>{status.label}</span>
                  </div>
                  <div className="my-3"><span className="text-3xl font-black text-white">{margemBruta.toFixed(1)}%</span></div>
                  <p className="text-[10px] text-indigo-300">Receita Bruta: {fmt(receitaBruta)} · Custos Diretos: {fmt(custosDiretos)}</p>
                </div>
              );
            })()}

            {/* Margem Líquida */}
            {(() => {
              const status = getStatusClass(margemLiquida, { green: v => v >= 15, yellow: v => v >= 5 });
              return (
                <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between h-52">
                  <div className="flex justify-between items-start">
                    <div><h3 className="font-bold text-white text-base">Margem Líquida</h3><p className="text-[10px] text-gray-500 mt-0.5">Sobras reais após dedução de todas as saídas.</p></div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${status.bg}`}>{status.label}</span>
                  </div>
                  <div className="my-3"><span className="text-3xl font-black text-white">{margemLiquida.toFixed(1)}%</span></div>
                  <p className="text-[10px] text-indigo-300">Lucro Líquido: {fmt(lucroLiquido)}</p>
                </div>
              );
            })()}

            {/* Lucratividade */}
            {(() => {
              const status = getStatusClass(lucratividade, { green: v => v >= 15, yellow: v => v >= 5 });
              return (
                <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between h-52">
                  <div className="flex justify-between items-start">
                    <div><h3 className="font-bold text-white text-base">Lucratividade</h3><p className="text-[10px] text-gray-500 mt-0.5">Retorno obtido sobre as vendas acumuladas.</p></div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${status.bg}`}>{status.label}</span>
                  </div>
                  <div className="my-3"><span className="text-3xl font-black text-white">{lucratividade.toFixed(1)}%</span></div>
                  <p className="text-[10px] text-indigo-300">Faturamento: {fmt(receitaBruta)}</p>
                </div>
              );
            })()}

            {/* Ponto de Equilíbrio */}
            {(() => {
              const status = getStatusClass(pontoEquilibrioR, { green: v => v <= receitaBruta && v > 0, yellow: v => v <= receitaBruta * 1.2 && v > 0 });
              return (
                <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between h-56">
                  <div className="flex justify-between items-start">
                    <div><h3 className="font-bold text-white text-base">Ponto de Equilíbrio</h3><p className="text-[10px] text-gray-500 mt-0.5">Faturamento necessário para zerar custos.</p></div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${status.bg}`}>{status.label}</span>
                  </div>
                  <div className="my-2">
                    <p className="text-2xl font-black text-white">{fmt(pontoEquilibrioR)}</p>
                    <p className="text-xs text-gray-400 font-semibold mt-1">Ou {pontoEquilibrioU.toFixed(0)} unidades/mês</p>
                  </div>
                  <p className="text-[10px] text-indigo-300">Margem Contribuição: {(margemContrPercent * 100).toFixed(0)}% · Custos Fixos: {fmt(custosFixos)}</p>
                </div>
              );
            })()}

            {/* Endividamento */}
            {(() => {
              const status = getStatusClass(endividamento, { green: v => v <= 50, yellow: v => v <= 100 });
              return (
                <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between h-56">
                  <div className="flex justify-between items-start">
                    <div><h3 className="font-bold text-white text-base">Endividamento</h3><p className="text-[10px] text-gray-500 mt-0.5">Relação passivo sobre o patrimônio líquido.</p></div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${status.bg}`}>{status.label}</span>
                  </div>
                  <div className="my-2"><span className="text-3xl font-black text-white">{endividamento.toFixed(1)}%</span></div>
                  <p className="text-[10px] text-indigo-300">Passivo Total: {fmt(passivoNum)} · PL: {fmt(patriNum)}</p>
                </div>
              );
            })()}

            {/* Comprometimento da Folha */}
            {(() => {
              const status = getStatusClass(comprometimentoFolha, { green: v => v <= 35 && v > 0, yellow: v => v <= 50 && v > 0 });
              return (
                <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between h-56">
                  <div className="flex justify-between items-start">
                    <div><h3 className="font-bold text-white text-base">Comprometimento da Folha</h3><p className="text-[10px] text-gray-500 mt-0.5">Fração do faturamento direcionada a salários.</p></div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${status.bg}`}>{status.label}</span>
                  </div>
                  <div className="my-2"><span className="text-3xl font-black text-white">{comprometimentoFolha.toFixed(1)}%</span></div>
                  <p className="text-[10px] text-indigo-300">Total Folha: {fmt(totalFolha)} · {funcionarios.length} funcionário(s)</p>
                </div>
              );
            })()}

          </div>

        </div>
      </main>
    </div>
  );
}

export default IndicadoresPage;
