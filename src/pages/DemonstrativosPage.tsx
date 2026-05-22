import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, addDoc, getDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { auth, db } from '../lib/firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  LayoutDashboard, CreditCard, Target, Upload, MessageCircle, Trophy,
  TrendingUp, Shield, Briefcase, Menu, X, LogOut, Users, FileText,
  PiggyBank, Percent, Tag, Calculator, Scale, Compass, Calendar, Download, Save, CheckCircle, AlertTriangle
} from 'lucide-react';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface BalancoData {
  caixa: number;
  bancos: number;
  contasReceber: number;
  estoque: number;
  veiculos: number;
  maquinas: number;
  equipamentos: number;
  imoveis: number;
  fornecedores: number;
  salariosPagar: number;
  impostosPagar: number;
  emprestimos: number;
  financiamentosLongos: number;
  parcelamentosFiscais: number;
  capitalSocial: number;
  lucrosAcumulados: number;
  reservas: number;
}

const emptyBalanco = (): BalancoData => ({
  caixa: 0, bancos: 0, contasReceber: 0, estoque: 0,
  veiculos: 0, maquinas: 0, equipamentos: 0, imoveis: 0,
  fornecedores: 0, salariosPagar: 0, impostosPagar: 0, emprestimos: 0,
  financiamentosLongos: 0, parcelamentosFiscais: 0,
  capitalSocial: 0, lucrosAcumulados: 0, reservas: 0
});

export function DemonstrativosPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [user, setUser] = useState(auth.currentUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dre' | 'balanco' | 'caixa'>('dre');

  // Competency filter (YYYY-MM)
  const [competencia, setCompetencia] = useState(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });

  // DB States
  const [transacoes, setTransacoes] = useState<any[]>([]);
  const [impostos, setImpostos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Balanço States
  const [balanco, setBalanco] = useState<BalancoData>(emptyBalanco());
  const [savingBalanco, setSavingBalanco] = useState(false);

  useEffect(() => { const u = onAuthStateChanged(auth, s => setUser(s)); return u; }, []);

  useEffect(() => {
    if (!profile?.modo || profile.modo !== 'empresarial') { navigate('/dashboard'); }
  }, [profile, navigate]);

  // Carrega transações
  useEffect(() => {
    if (!user?.uid) return;
    const u = onSnapshot(collection(db, `transacoes/${user.uid}/items`), snap => {
      setTransacoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return u;
  }, [user?.uid]);

  // Carrega histórico de impostos
  useEffect(() => {
    if (!user?.uid) return;
    const u = onSnapshot(collection(db, `impostos/${user.uid}/items`), snap => {
      setImpostos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return u;
  }, [user?.uid]);

  // Carrega balanço patrimonial para a competência selecionada
  useEffect(() => {
    if (!user?.uid || activeTab !== 'balanco') return;
    const fetchBalanco = async () => {
      try {
        const snap = await getDoc(doc(db, `balancos/${user.uid}/items`, competencia));
        if (snap.exists()) {
          setBalanco(snap.data() as BalancoData);
        } else {
          setBalanco(emptyBalanco());
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchBalanco();
  }, [user?.uid, competencia, activeTab]);

  // ==========================================
  // ABA 1 — CÁLCULOS DRE
  // ==========================================
  const getDREMetricsForMonth = (compStr: string) => {
    const [year, month] = compStr.split('-').map(Number);
    
    const transFiltered = transacoes.filter(t => {
      if (!t.data) return false;
      const d = new Date(t.data);
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });

    const receitaBruta = transFiltered
      .filter(t => t.tipo === 'receita')
      .reduce((s, t) => s + (t.valor || 0), 0);

    const impostosPeriodo = impostos
      .filter(i => i.competencia === compStr)
      .reduce((s, i) => s + (i.valorTotal || 0), 0);

    const receitaLiquida = receitaBruta - impostosPeriodo;

    const custos = transFiltered
      .filter(t => t.tipo === 'despesa' && ['fornecedor', 'fornecedores', 'estoque', 'produção', 'compra', 'materia prima'].some(k => t.descricao?.toLowerCase().includes(k) || t.categoria?.toLowerCase().includes(k)))
      .reduce((s, t) => s + (t.valor || 0), 0);

    const despesasFin = transFiltered
      .filter(t => t.tipo === 'despesa' && ['juros', 'empréstimo', 'emprestimo', 'financiamento', 'banco', 'tarifa'].some(k => t.descricao?.toLowerCase().includes(k) || t.categoria?.toLowerCase().includes(k)))
      .reduce((s, t) => s + (t.valor || 0), 0);

    const totalDespesasGeral = transFiltered
      .filter(t => t.tipo === 'despesa')
      .reduce((s, t) => s + (t.valor || 0), 0);

    const despesasOp = Math.max(0, totalDespesasGeral - custos - despesasFin);

    const lucroOperacional = receitaLiquida - custos - despesasOp;
    const lucroLiquido = lucroOperacional - despesasFin;

    return { receitaBruta, impostosPeriodo, receitaLiquida, custos, despesasOp, lucroOperacional, despesasFin, lucroLiquido };
  };

  const getPreviousMonthCompetencia = (compStr: string) => {
    const [year, month] = compStr.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    const mm = String(prevDate.getMonth() + 1).padStart(2, '0');
    return `${prevDate.getFullYear()}-${mm}`;
  };

  const currentDRE = getDREMetricsForMonth(competencia);
  const prevCompetencia = getPreviousMonthCompetencia(competencia);
  const prevDRE = getDREMetricsForMonth(prevCompetencia);

  const getVarPercent = (cur: number, prev: number) => {
    if (prev === 0) return cur > 0 ? 100 : 0;
    return ((cur - prev) / prev) * 100;
  };

  // EXPORTAR DRE PDF VIA SERVER REPORT GENERATOR
  const handleExportarPDF = async () => {
    if (!user) return;
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) return;

      const payload = {
        receitas: currentDRE.receitaBruta.toFixed(2),
        despesas: (currentDRE.custos + currentDRE.despesasOp + currentDRE.despesasFin).toFixed(2),
        balanco: currentDRE.lucroLiquido.toFixed(2),
        metas: [
          { titulo: `Demonstração do Resultado (DRE) - ${competencia}` },
          { titulo: `Receita Líquida: ${fmt(currentDRE.receitaLiquida)}` },
          { titulo: `Lucro Operacional: ${fmt(currentDRE.lucroOperacional)}` }
        ],
        alertas: [
          `Faturamento Bruto: ${fmt(currentDRE.receitaBruta)}`,
          `(-) Impostos: ${fmt(currentDRE.impostosPeriodo)}`,
          `(-) Custos Diretos: ${fmt(currentDRE.custos)}`,
          `(-) Despesas Operacionais: ${fmt(currentDRE.despesasOp)}`,
          `(-) Despesas Financeiras: ${fmt(currentDRE.despesasFin)}`,
          `Margem Líquida DRE: ${(currentDRE.receitaBruta > 0 ? (currentDRE.lucroLiquido / currentDRE.receitaBruta) * 100 : 0).toFixed(1)}%`
        ]
      };

      toast.loading('Compilando relatório contábil DRE...', { id: 'pdf' });
      
      const response = await fetch('/api/relatorio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Erro gerando PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DRE_${competencia}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Relatório DRE baixado! 📄', { id: 'pdf' });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar PDF da DRE.', { id: 'pdf' });
    }
  };

  // ==========================================
  // ABA 2 — CÁLCULOS BALANÇO PATRIMONIAL
  // ==========================================
  const totalAtivoCirculante = balanco.caixa + balanco.bancos + balanco.contasReceber + balanco.estoque;
  const totalAtivoNaoCirculante = balanco.veiculos + balanco.maquinas + balanco.equipamentos + balanco.imoveis;
  const totalAtivo = totalAtivoCirculante + totalAtivoNaoCirculante;

  const totalPassivoCirculante = balanco.fornecedores + balanco.salariosPagar + balanco.impostosPagar + balanco.emprestimos;
  const totalPassivoNaoCirculante = balanco.financiamentosLongos + balanco.parcelamentosFiscais;
  const totalPassivo = totalPassivoCirculante + totalPassivoNaoCirculante;

  const totalPL = balanco.capitalSocial + balanco.lucrosAcumulados + balanco.reservas;
  const totalPassivoEPL = totalPassivo + totalPL;

  const isBalanced = Math.abs(totalAtivo - totalPassivoEPL) < 0.01;

  const handleSalvarBalanco = async () => {
    if (!user?.uid) return;
    setSavingBalanco(true);
    try {
      await setDoc(doc(db, `balancos/${user.uid}/items`, competencia), {
        ...balanco,
        totalAtivo,
        totalPassivo,
        totalPL,
        competencia,
        atualizadoEm: serverTimestamp()
      });
      toast.success('Balanço Patrimonial salvo com sucesso! ⚖️');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar Balanço.');
    } finally {
      setSavingBalanco(false);
    }
  };

  // ==========================================
  // ABA 3 — CÁLCULOS FLUXO DE CAIXA
  // ==========================================
  const getFluxoCaixaForMonth = (compStr: string) => {
    const [year, month] = compStr.split('-').map(Number);
    const startOfPeriod = new Date(year, month - 1, 1);
    
    // Saldo Inicial (receitas - despesas anteriores ao mês)
    const transAnteriores = transacoes.filter(t => {
      if (!t.data) return false;
      const d = new Date(t.data);
      return d < startOfPeriod;
    });

    const saldoInicial = transAnteriores.reduce((s, t) => {
      const v = t.valor || 0;
      return t.tipo === 'receita' ? s + v : s - v;
    }, 0);

    const transFiltered = transacoes.filter(t => {
      if (!t.data) return false;
      const d = new Date(t.data);
      return d.getFullYear() === year && (d.getMonth() + 1) === month;
    });

    // Grupos
    let opEntradas = 0, opSaidas = 0;
    let invEntradas = 0, invSaidas = 0;
    let finEntradas = 0, finSaidas = 0;

    transFiltered.forEach(t => {
      const v = t.valor || 0;
      const cat = (t.categoria || '').toLowerCase();
      const desc = (t.descricao || '').toLowerCase();

      const isInvestimento = ['lazer', 'investimentos', 'investimento', 'poupança'].some(k => cat.includes(k) || desc.includes(k));
      const isFinanciamento = ['juros', 'empréstimos', 'financiamentos', 'emprestimo', 'empréstimo', 'financiamento'].some(k => cat.includes(k) || desc.includes(k));

      if (isInvestimento) {
        if (t.tipo === 'receita') invEntradas += v;
        else invSaidas += v;
      } else if (isFinanciamento) {
        if (t.tipo === 'receita') finEntradas += v;
        else finSaidas += v;
      } else {
        // Operacional por padrão
        if (t.tipo === 'receita') opEntradas += v;
        else opSaidas += v;
      }
    });

    const totalEntradas = opEntradas + invEntradas + finEntradas;
    const totalSaidas = opSaidas + invSaidas + finSaidas;
    const saldoFinal = saldoInicial + totalEntradas - totalSaidas;

    return { saldoInicial, opEntradas, opSaidas, invEntradas, invSaidas, finEntradas, finSaidas, saldoFinal };
  };

  const cashFlow = getFluxoCaixaForMonth(competencia);

  const fluxChartData = [
    { name: 'Operacional', Entradas: cashFlow.opEntradas, Saídas: -cashFlow.opSaidas },
    { name: 'Investimentos', Entradas: cashFlow.invEntradas, Saídas: -cashFlow.invSaidas },
    { name: 'Financiamentos', Entradas: cashFlow.finEntradas, Saídas: -cashFlow.finSaidas },
  ];

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
    navItems.push({ name: 'Indicadores', path: '/empresa/indicadores', icon: Calculator });
    navItems.push({ name: 'Demonstrativos', path: '/empresa/demonstrativos', icon: Scale });
  }

  const tableHeaderCls = "px-6 py-3.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider";
  const tableCellCls = "px-6 py-4 text-sm font-semibold text-white";

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
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2"><Scale className="w-6 h-6 text-indigo-400" />Demonstrativos Contábeis</h1>
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
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center gap-1.5 p-1.5 bg-gray-950 border border-gray-800/80 rounded-2xl">
              <button onClick={() => setActiveTab('dre')} className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${activeTab === 'dre' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>DRE</button>
              <button onClick={() => setActiveTab('balanco')} className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${activeTab === 'balanco' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>Balanço Patrimonial</button>
              <button onClick={() => setActiveTab('caixa')} className={`px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${activeTab === 'caixa' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>Fluxo de Caixa</button>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="w-4.5 h-4.5 text-indigo-400" />
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Período de Apuração:</span>
              <input type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white outline-none [color-scheme:dark]" />
            </div>
          </div>

          {/* TAB 1 — DRE */}
          {activeTab === 'dre' && (
            <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="px-6 lg:px-8 py-5 border-b border-gray-800 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Demonstração de Resultado (DRE)</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Visão vertical e analítica de receitas, custos e resultados.</p>
                </div>
                <button onClick={handleExportarPDF} className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-xl border border-gray-700 transition-all">
                  <Download className="w-4 h-4" /> Exportar PDF
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[500px]">
                  <thead>
                    <tr className="border-b border-gray-800 bg-gray-950/40">
                      <th className={tableHeaderCls}>Conta / Estrutura DRE</th>
                      <th className={`${tableHeaderCls} text-right`}>Valor (R$)</th>
                      <th className={`${tableHeaderCls} text-right`}>vs Mês Anterior (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    <tr className="hover:bg-gray-800/10">
                      <td className={tableCellCls}>Faturamento / Receita Bruta</td>
                      <td className={`${tableCellCls} text-right text-emerald-400`}>{fmt(currentDRE.receitaBruta)}</td>
                      <td className={`px-6 py-4 text-xs font-bold text-right ${getVarPercent(currentDRE.receitaBruta, prevDRE.receitaBruta) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {getVarPercent(currentDRE.receitaBruta, prevDRE.receitaBruta).toFixed(1)}%
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-800/10">
                      <td className={`${tableCellCls} text-rose-300 pl-10 font-normal`}>(-) Impostos e Deduções</td>
                      <td className={`${tableCellCls} text-right text-rose-300`}>-{fmt(currentDRE.impostosPeriodo)}</td>
                      <td className={`px-6 py-4 text-xs font-bold text-right ${getVarPercent(currentDRE.impostosPeriodo, prevDRE.impostosPeriodo) >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {getVarPercent(currentDRE.impostosPeriodo, prevDRE.impostosPeriodo).toFixed(1)}%
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-800/15 bg-gray-950/20 font-bold border-y border-gray-800/80">
                      <td className={`${tableCellCls} font-extrabold`}>(=) Receita Líquida</td>
                      <td className={`${tableCellCls} text-right font-extrabold text-white`}>{fmt(currentDRE.receitaLiquida)}</td>
                      <td className={`px-6 py-4 text-xs font-bold text-right ${getVarPercent(currentDRE.receitaLiquida, prevDRE.receitaLiquida) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {getVarPercent(currentDRE.receitaLiquida, prevDRE.receitaLiquida).toFixed(1)}%
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-800/10">
                      <td className={`${tableCellCls} text-rose-300 pl-10 font-normal`}>(-) Custos de Venda / Insumos / Estoque</td>
                      <td className={`${tableCellCls} text-right text-rose-300`}>-{fmt(currentDRE.custos)}</td>
                      <td className={`px-6 py-4 text-xs font-bold text-right ${getVarPercent(currentDRE.custos, prevDRE.custos) >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {getVarPercent(currentDRE.custos, prevDRE.custos).toFixed(1)}%
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-800/10">
                      <td className={`${tableCellCls} text-rose-300 pl-10 font-normal`}>(-) Despesas Administrativas & Operacionais</td>
                      <td className={`${tableCellCls} text-right text-rose-300`}>-{fmt(currentDRE.despesasOp)}</td>
                      <td className={`px-6 py-4 text-xs font-bold text-right ${getVarPercent(currentDRE.despesasOp, prevDRE.despesasOp) >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {getVarPercent(currentDRE.despesasOp, prevDRE.despesasOp).toFixed(1)}%
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-800/15 bg-gray-950/20 font-bold border-y border-gray-800/80">
                      <td className={`${tableCellCls} font-extrabold`}>(=) Lucro Operacional</td>
                      <td className={`${tableCellCls} text-right font-extrabold text-white`}>{fmt(currentDRE.lucroOperacional)}</td>
                      <td className={`px-6 py-4 text-xs font-bold text-right ${getVarPercent(currentDRE.lucroOperacional, prevDRE.lucroOperacional) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {getVarPercent(currentDRE.lucroOperacional, prevDRE.lucroOperacional).toFixed(1)}%
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-800/10">
                      <td className={`${tableCellCls} text-rose-300 pl-10 font-normal`}>(-) Despesas Financeiras / Juros / Empréstimos</td>
                      <td className={`${tableCellCls} text-right text-rose-300`}>-{fmt(currentDRE.despesasFin)}</td>
                      <td className={`px-6 py-4 text-xs font-bold text-right ${getVarPercent(currentDRE.despesasFin, prevDRE.despesasFin) >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {getVarPercent(currentDRE.despesasFin, prevDRE.despesasFin).toFixed(1)}%
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-800/20 bg-indigo-950/20 font-extrabold border-y border-indigo-900/50">
                      <td className={`${tableCellCls} text-indigo-200 font-extrabold text-base`}>(=) Resultado / Lucro Líquido</td>
                      <td className={`${tableCellCls} text-right text-emerald-400 font-extrabold text-base`}>{fmt(currentDRE.lucroLiquido)}</td>
                      <td className={`px-6 py-4 text-xs font-extrabold text-right ${getVarPercent(currentDRE.lucroLiquido, prevDRE.lucroLiquido) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {getVarPercent(currentDRE.lucroLiquido, prevDRE.lucroLiquido).toFixed(1)}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2 — BALANÇO PATRIMONIAL */}
          {activeTab === 'balanco' && (
            <div className="space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl space-y-6">
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-800 pb-5 gap-4">
                  <div>
                    <h3 className="text-base font-bold text-white">Balanço Patrimonial</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Insira os saldos das contas contábeis ativas, passivas e patrimônio líquido.</p>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wider ${
                      isBalanced 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {isBalanced ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                          <span>Balanço Equilibrado</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                          <span>Erro: BP Desequilibrado (Diferença: {fmt(Math.abs(totalAtivo - totalPassivoEPL))})</span>
                        </>
                      )}
                    </div>
                    
                    <button onClick={handleSalvarBalanco} disabled={savingBalanco} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all">
                      <Save className="w-4 h-4" /> Salvar Balanço
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* ATIVO */}
                  <div className="space-y-5 bg-gray-950/40 p-5 rounded-2xl border border-gray-850">
                    <h4 className="text-sm font-bold text-white border-l-2 border-indigo-500 pl-3">ATIVO</h4>
                    
                    <div className="space-y-4">
                      <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Circulante</h5>
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400">Caixa (R$)</label>
                          <input type="number" value={balanco.caixa} onChange={e => setBalanco({ ...balanco, caixa: Number(e.target.value) })} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400">Bancos (R$)</label>
                          <input type="number" value={balanco.bancos} onChange={e => setBalanco({ ...balanco, bancos: Number(e.target.value) })} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400">Contas a Receber (R$)</label>
                          <input type="number" value={balanco.contasReceber} onChange={e => setBalanco({ ...balanco, contasReceber: Number(e.target.value) })} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400">Estoque (R$)</label>
                          <input type="number" value={balanco.estoque} onChange={e => setBalanco({ ...balanco, estoque: Number(e.target.value) })} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white" />
                        </div>
                        <div className="flex justify-between text-xs text-indigo-400 font-bold border-t border-gray-800/80 pt-2">
                          <span>Total Ativo Circulante:</span>
                          <span>{fmt(totalAtivoCirculante)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-3">
                      <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Não Circulante</h5>
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400">Veículos (R$)</label>
                          <input type="number" value={balanco.veiculos} onChange={e => setBalanco({ ...balanco, veiculos: Number(e.target.value) })} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400">Máquinas (R$)</label>
                          <input type="number" value={balanco.maquinas} onChange={e => setBalanco({ ...balanco, maquinas: Number(e.target.value) })} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400">Equipamentos (R$)</label>
                          <input type="number" value={balanco.equipamentos} onChange={e => setBalanco({ ...balanco, equipamentos: Number(e.target.value) })} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400">Imóveis (R$)</label>
                          <input type="number" value={balanco.imoveis} onChange={e => setBalanco({ ...balanco, imoveis: Number(e.target.value) })} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white" />
                        </div>
                        <div className="flex justify-between text-xs text-indigo-400 font-bold border-t border-gray-800/80 pt-2">
                          <span>Total Ativo Não Circulante:</span>
                          <span>{fmt(totalAtivoNaoCirculante)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between text-sm text-white font-extrabold border-t-2 border-gray-800 pt-3">
                      <span>TOTAL DO ATIVO:</span>
                      <span className="text-emerald-400">{fmt(totalAtivo)}</span>
                    </div>

                  </div>

                  {/* PASSIVO */}
                  <div className="space-y-5 bg-gray-950/40 p-5 rounded-2xl border border-gray-850">
                    <h4 className="text-sm font-bold text-white border-l-2 border-indigo-500 pl-3">PASSIVO</h4>
                    
                    <div className="space-y-4">
                      <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Circulante</h5>
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400">Fornecedores (R$)</label>
                          <input type="number" value={balanco.fornecedores} onChange={e => setBalanco({ ...balanco, fornecedores: Number(e.target.value) })} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400">Salários a Pagar (R$)</label>
                          <input type="number" value={balanco.salariosPagar} onChange={e => setBalanco({ ...balanco, salariosPagar: Number(e.target.value) })} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400">Impostos a Pagar (R$)</label>
                          <input type="number" value={balanco.impostosPagar} onChange={e => setBalanco({ ...balanco, impostosPagar: Number(e.target.value) })} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400">Empréstimos (R$)</label>
                          <input type="number" value={balanco.emprestimos} onChange={e => setBalanco({ ...balanco, emprestimos: Number(e.target.value) })} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white" />
                        </div>
                        <div className="flex justify-between text-xs text-indigo-400 font-bold border-t border-gray-800/80 pt-2">
                          <span>Total Passivo Circulante:</span>
                          <span>{fmt(totalPassivoCirculante)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 pt-3">
                      <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Não Circulante</h5>
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400">Financiamentos Longo Prazo (R$)</label>
                          <input type="number" value={balanco.financiamentosLongos} onChange={e => setBalanco({ ...balanco, financiamentosLongos: Number(e.target.value) })} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400">Parcelamentos Fiscais (R$)</label>
                          <input type="number" value={balanco.parcelamentosFiscais} onChange={e => setBalanco({ ...balanco, parcelamentosFiscais: Number(e.target.value) })} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white" />
                        </div>
                        <div className="flex justify-between text-xs text-indigo-400 font-bold border-t border-gray-800/80 pt-2">
                          <span>Total Passivo Não Circulante:</span>
                          <span>{fmt(totalPassivoNaoCirculante)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between text-sm text-white font-extrabold border-t-2 border-gray-800 pt-3">
                      <span>TOTAL DO PASSIVO:</span>
                      <span className="text-emerald-400">{fmt(totalPassivo)}</span>
                    </div>

                  </div>

                  {/* PATRIMÔNIO LÍQUIDO */}
                  <div className="space-y-5 bg-gray-950/40 p-5 rounded-2xl border border-gray-850">
                    <h4 className="text-sm font-bold text-white border-l-2 border-indigo-500 pl-3">PATRIMÔNIO LÍQUIDO</h4>
                    
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400">Capital Social (R$)</label>
                          <input type="number" value={balanco.capitalSocial} onChange={e => setBalanco({ ...balanco, capitalSocial: Number(e.target.value) })} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400">Lucros ou Prejuízos Acumulados (R$)</label>
                          <input type="number" value={balanco.lucrosAcumulados} onChange={e => setBalanco({ ...balanco, lucrosAcumulados: Number(e.target.value) })} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white" />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-400">Reservas de Lucros (R$)</label>
                          <input type="number" value={balanco.reservas} onChange={e => setBalanco({ ...balanco, reservas: Number(e.target.value) })} className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm text-white" />
                        </div>
                        <div className="flex justify-between text-xs text-indigo-400 font-bold border-t border-gray-800/80 pt-2">
                          <span>Total Patrimônio Líquido:</span>
                          <span>{fmt(totalPL)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between text-sm text-white font-extrabold border-t-2 border-gray-800 pt-3">
                      <span>TOTAL PASSIVO + PL:</span>
                      <span className="text-emerald-400">{fmt(totalPassivoEPL)}</span>
                    </div>

                  </div>

                </div>

              </div>
            </div>
          )}

          {/* TAB 3 — FLUXO DE CAIXA */}
          {activeTab === 'caixa' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Gráfico de Barras Empilhadas */}
              <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl lg:col-span-2 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-white mb-6">Demonstrativo de Fluxo de Caixa</h3>
                  <div className="h-72 w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={fluxChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                        <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} />
                        <YAxis stroke="#6b7280" fontSize={10} tickLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', borderRadius: '12px', color: '#fff' }}
                          formatter={(value: any) => [fmt(Math.abs(Number(value))), 'Movimentado']}
                        />
                        <Legend />
                        <Bar dataKey="Entradas" fill="#10b981" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="Saídas" fill="#ef4444" radius={[0, 0, 6, 6]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 mt-6 flex items-start gap-2.5">
                  <p className="text-[10px] text-indigo-300 leading-relaxed">
                    O fluxo de caixa operacional agrupa transações financeiras recorrentes da empresa. Investimentos rastreia aquisições e reservas de lazer/poupança. Financiamentos mapeia amortizações e amortecimento de passivos bancários.
                  </p>
                </div>
              </div>

              {/* Demonstrativo Numérico */}
              <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl lg:col-span-1 space-y-6">
                <h3 className="text-base font-bold text-white">Saldos & Movimentações</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between text-sm text-gray-400 border-b border-gray-800 pb-2">
                    <span>Saldo Inicial Acumulado</span>
                    <span className="font-bold text-white">{fmt(cashFlow.saldoInicial)}</span>
                  </div>

                  <div className="space-y-2 border-b border-gray-800 pb-3">
                    <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Grupo Operacional</h5>
                    <div className="flex justify-between text-xs text-emerald-400"><span>(+) Entradas</span><span>{fmt(cashFlow.opEntradas)}</span></div>
                    <div className="flex justify-between text-xs text-rose-400"><span>(-) Saídas</span><span>-{fmt(cashFlow.opSaidas)}</span></div>
                  </div>

                  <div className="space-y-2 border-b border-gray-800 pb-3">
                    <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Grupo Investimentos</h5>
                    <div className="flex justify-between text-xs text-emerald-400"><span>(+) Entradas</span><span>{fmt(cashFlow.invEntradas)}</span></div>
                    <div className="flex justify-between text-xs text-rose-400"><span>(-) Saídas</span><span>-{fmt(cashFlow.invSaidas)}</span></div>
                  </div>

                  <div className="space-y-2 border-b border-gray-800 pb-3">
                    <h5 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Grupo Financiamentos</h5>
                    <div className="flex justify-between text-xs text-emerald-400"><span>(+) Entradas</span><span>{fmt(cashFlow.finEntradas)}</span></div>
                    <div className="flex justify-between text-xs text-rose-400"><span>(-) Saídas</span><span>-{fmt(cashFlow.finSaidas)}</span></div>
                  </div>

                  <div className="flex justify-between text-base font-extrabold text-white border-t border-gray-850 pt-3">
                    <span>Saldo Final Período</span>
                    <span className="text-indigo-400">{fmt(cashFlow.saldoFinal)}</span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default DemonstrativosPage;
