import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, doc, getDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import {
  LayoutDashboard, CreditCard, Target, Upload, MessageCircle, Trophy,
  TrendingUp, Shield, Briefcase, Menu, X, LogOut, Users, FileText,
  PiggyBank, Percent, Calculator, Save, CheckCircle2, AlertCircle, Calendar, Plus
} from 'lucide-react';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface ImpostoRegistro {
  id: string;
  competencia: string;
  regime: string;
  valorTotal: number;
  status: 'Pago' | 'Em aberto';
}

export function ImpostosPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [user, setUser] = useState(auth.currentUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [regime, setRegime] = useState<string>('Simples Nacional');
  const [historico, setHistorico] = useState<ImpostoRegistro[]>([]);
  const [loadingHist, setLoadingHist] = useState(true);

  // Modal / Calculos States
  const [competencia, setCompetencia] = useState(() => {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}`;
  });

  // MEI States
  const [meiAtividade, setMeiAtividade] = useState<'comercio' | 'servico' | 'ambos'>('servico');

  // Simples Nacional States
  const [simplesFaturamento, setSimplesFaturamento] = useState('');
  const [simplesAcumulado, setSimplesAcumulado] = useState('');

  // Lucro Presumido States
  const [presumidoReceita, setPresumidoReceita] = useState('');
  const [presumidoAtividade, setPresumidoAtividade] = useState<'comercio' | 'servico'>('servico');
  const [presumidoIssAliq, setPresumidoIssAliq] = useState('2');

  // Lucro Real States
  const [realReceita, setRealReceita] = useState('');
  const [realCustos, setRealCustos] = useState('');
  const [realDespesas, setRealDespesas] = useState('');
  const [realCreditos, setRealCreditos] = useState('');

  useEffect(() => { const u = onAuthStateChanged(auth, s => setUser(s)); return u; }, []);

  useEffect(() => {
    if (!profile?.modo || profile.modo !== 'empresarial') { navigate('/dashboard'); }
  }, [profile, navigate]);

  // Carregar regime tributário da empresa
  useEffect(() => {
    if (!user?.uid) return;
    const fetchRegime = async () => {
      try {
        const snap = await getDoc(doc(db, 'empresas', user.uid));
        if (snap.exists() && snap.data().regimeTributario) {
          setRegime(snap.data().regimeTributario);
        }
      } catch (err) { console.error('Erro regime:', err); }
    };
    fetchRegime();
  }, [user?.uid]);

  // Carregar histórico
  useEffect(() => {
    if (!user?.uid) return;
    const q = collection(db, `impostos/${user.uid}/items`);
    const u = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as ImpostoRegistro));
      list.sort((a, b) => b.competencia.localeCompare(a.competencia));
      setHistorico(list);
      setLoadingHist(false);
    }, () => setLoadingHist(false));
    return u;
  }, [user?.uid]);

  // CÁLCULOS ------------------------------

  // MEI
  const meiINSS = 76.90;
  const meiISS = meiAtividade === 'servico' || meiAtividade === 'ambos' ? 5.00 : 0;
  const meiICMS = meiAtividade === 'comercio' || meiAtividade === 'ambos' ? 1.00 : 0;
  const meiTotal = meiINSS + meiISS + meiICMS;

  // Simples Nacional
  const fatMensalNum = Number(simplesFaturamento) || 0;
  const fatAcumuladoNum = Number(simplesAcumulado) || 0;
  let simplesAliquota = 0.04;
  if (fatAcumuladoNum > 3600000) simplesAliquota = 0.19;
  else if (fatAcumuladoNum > 1800000) simplesAliquota = 0.143;
  else if (fatAcumuladoNum > 720000) simplesAliquota = 0.107;
  else if (fatAcumuladoNum > 360000) simplesAliquota = 0.095;
  else if (fatAcumuladoNum > 180000) simplesAliquota = 0.073;
  const simplesTotal = fatMensalNum * simplesAliquota;

  // Lucro Presumido
  const presReceitaNum = Number(presumidoReceita) || 0;
  const presPis = presReceitaNum * 0.0065;
  const presCofins = presReceitaNum * 0.03;
  const presIrpj = presReceitaNum * (presumidoAtividade === 'servico' ? 0.32 : 0.08) * 0.15;
  const presCsll = presReceitaNum * (presumidoAtividade === 'servico' ? 0.32 : 0.12) * 0.09;
  const presIssAliqNum = (Number(presumidoIssAliq) || 2) / 100;
  const presIss = presReceitaNum * presIssAliqNum;
  const presTotal = presPis + presCofins + presIrpj + presCsll + presIss;
  const presEfRate = presReceitaNum > 0 ? (presTotal / presReceitaNum) * 100 : 0;

  // Lucro Real
  const realReceitaNum = Number(realReceita) || 0;
  const realCustosNum = Number(realCustos) || 0;
  const realDespesasNum = Number(realDespesas) || 0;
  const realCreditosNum = Number(realCreditos) || 0;
  const realLucro = realReceitaNum - realCustosNum - realDespesasNum;
  const realLucroBase = Math.max(0, realLucro);

  const realPis = realReceitaNum * 0.0165;
  const realCofins = realReceitaNum * 0.076;
  const realIrpjBase = realLucroBase * 0.15;
  const realIrpjAdd = realLucroBase > 20000 ? (realLucroBase - 20000) * 0.10 : 0;
  const realCsll = realLucroBase * 0.09;
  const realTotalAntesCred = realPis + realCofins + realIrpjBase + realIrpjAdd + realCsll;
  const realTotal = Math.max(0, realTotalAntesCred - realCreditosNum);

  // Ação de Salvar Imposto calculado
  const handleRegistrar = async () => {
    if (!user?.uid) return;
    let valorTotal = 0;
    if (regime === 'MEI') valorTotal = meiTotal;
    else if (regime === 'Simples Nacional') valorTotal = simplesTotal;
    else if (regime === 'Lucro Presumido') valorTotal = presTotal;
    else if (regime === 'Lucro Real') valorTotal = realTotal;

    if (valorTotal <= 0 && regime !== 'MEI') {
      toast.error('Informe valores válidos para o faturamento.');
      return;
    }

    try {
      await addDoc(collection(db, `impostos/${user.uid}/items`), {
        competencia,
        regime,
        valorTotal,
        status: 'Em aberto',
        criadoEm: serverTimestamp()
      });
      toast.success('Competência fiscal registrada com sucesso! 📄');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar competência.');
    }
  };

  // Alterar Status Pago
  const togglePago = async (id: string, currentStatus: string) => {
    if (!user?.uid) return;
    try {
      await updateDoc(doc(db, `impostos/${user.uid}/items`, id), {
        status: currentStatus === 'Pago' ? 'Em aberto' : 'Pago'
      });
      toast.success('Status do imposto atualizado com sucesso! 💰');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar status.');
    }
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
  if (profile?.modo === 'empresarial') {
    navItems.push({ name: 'Cadastro Empresa', path: '/empresa/cadastro', icon: Briefcase });
    navItems.push({ name: 'Funcionários', path: '/empresa/funcionarios', icon: Users });
    navItems.push({ name: 'Rescisão', path: '/empresa/rescisao', icon: FileText });
    navItems.push({ name: 'Reservas', path: '/empresa/reservas', icon: PiggyBank });
    navItems.push({ name: 'Impostos', path: '/empresa/impostos', icon: Percent });
  }

  const inputCls = "w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all";
  const labelCls = "block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2";

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
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2"><Percent className="w-6 h-6 text-indigo-400" />Impostos Empresariais</h1>
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
          
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 lg:p-8 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-5 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400"><Calculator className="w-5 h-5" /></div>
                <div>
                  <h2 className="text-lg font-bold text-white">Calculadora Tributária</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Regime Ativo: <span className="text-indigo-400 font-semibold">{regime}</span></p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="text-xs font-medium text-gray-400">Alterar Simulação:</div>
                <select value={regime} onChange={e => setRegime(e.target.value)} className="bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-xs text-white outline-none">
                  <option>MEI</option>
                  <option>Simples Nacional</option>
                  <option>Lucro Presumido</option>
                  <option>Lucro Real</option>
                </select>
              </div>
            </div>

            {/* FORMULÁRIOS DINÂMICOS POR REGIME */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Entradas */}
              <div className="space-y-5">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider border-l-2 border-indigo-500 pl-3">Simulação Competência</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className={labelCls}>Mês de Apuração</label>
                    <input type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} className={`${inputCls} [color-scheme:dark]`} />
                  </div>
                </div>

                {/* MEI */}
                {regime === 'MEI' && (
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls}>Atividade de Atuação</label>
                      <select value={meiAtividade} onChange={e => setMeiAtividade(e.target.value as any)} className={inputCls}>
                        <option value="servico">Serviços Geral (ISS)</option>
                        <option value="comercio">Comércio / Indústria (ICMS)</option>
                        <option value="ambos">Ambos (Comércio e Serviços)</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Simples Nacional */}
                {regime === 'Simples Nacional' && (
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls}>Faturamento Bruto Mensal (R$)</label>
                      <input type="number" placeholder="Ex: 15000.00" value={simplesFaturamento} onChange={e => setSimplesFaturamento(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Faturamento Acumulado no Ano (R$)</label>
                      <input type="number" placeholder="Ex: 120000.00" value={simplesAcumulado} onChange={e => setSimplesAcumulado(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                )}

                {/* Lucro Presumido */}
                {regime === 'Lucro Presumido' && (
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls}>Receita Bruta Mensal (R$)</label>
                      <input type="number" placeholder="Ex: 50000.00" value={presumidoReceita} onChange={e => setPresumidoReceita(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Tipo de Atividade</label>
                      <select value={presumidoAtividade} onChange={e => setPresumidoAtividade(e.target.value as any)} className={inputCls}>
                        <option value="servico">Prestação de Serviços</option>
                        <option value="comercio">Comércio e Vendas / Indústria</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Alíquota de ISS (%)</label>
                      <input type="number" min="2" max="5" step="0.1" value={presumidoIssAliq} onChange={e => setPresumidoIssAliq(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                )}

                {/* Lucro Real */}
                {regime === 'Lucro Real' && (
                  <div className="space-y-4">
                    <div>
                      <label className={labelCls}>Receita Bruta Mensal (R$)</label>
                      <input type="number" placeholder="Ex: 150000.00" value={realReceita} onChange={e => setRealReceita(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Custos Totais (R$)</label>
                      <input type="number" placeholder="Custos de mercadoria, insumos..." value={realCustos} onChange={e => setRealCustos(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Despesas Operacionais Dedutíveis (R$)</label>
                      <input type="number" placeholder="Aluguel, folha, marketing..." value={realDespesas} onChange={e => setRealDespesas(e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Créditos Tributários (R$)</label>
                      <input type="number" placeholder="Deduções ou créditos a compensar" value={realCreditos} onChange={e => setRealCreditos(e.target.value)} className={inputCls} />
                    </div>
                  </div>
                )}

                <div className="pt-4">
                  <button onClick={handleRegistrar} className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-2xl shadow-lg transition-all">
                    <Save className="w-4.5 h-4.5" />Salvar Competência Fiscal
                  </button>
                </div>
              </div>

              {/* Demonstrativo Detalhado */}
              <div className="bg-gray-950/60 border border-gray-800 rounded-3xl p-6 flex flex-col justify-between">
                <div className="space-y-5">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider border-l-2 border-indigo-500 pl-3">Demonstrativo de Impostos</h3>
                  
                  {regime === 'MEI' && (
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between text-gray-400"><span>INSS Previdência</span><span className="font-semibold text-white">{fmt(meiINSS)}</span></div>
                      <div className="flex justify-between text-gray-400"><span>ISS (Serviços)</span><span className="font-semibold text-white">{fmt(meiISS)}</span></div>
                      <div className="flex justify-between text-gray-400"><span>ICMS (Comércio)</span><span className="font-semibold text-white">{fmt(meiICMS)}</span></div>
                      <div className="border-t border-gray-800 pt-3 flex justify-between text-base font-extrabold text-white">
                        <span>Guia DAS MEI</span>
                        <span className="text-emerald-400">{fmt(meiTotal)}</span>
                      </div>
                    </div>
                  )}

                  {regime === 'Simples Nacional' && (
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between text-gray-400"><span>Receita Período</span><span className="font-semibold text-white">{fmt(fatMensalNum)}</span></div>
                      <div className="flex justify-between text-gray-400"><span>Acumulado 12 meses</span><span className="font-semibold text-white">{fmt(fatAcumuladoNum)}</span></div>
                      <div className="flex justify-between text-gray-400"><span>Alíquota Efetiva</span><span className="font-semibold text-indigo-400">{(simplesAliquota * 100).toFixed(1)}%</span></div>
                      <div className="border-t border-gray-800 pt-3 flex justify-between text-base font-extrabold text-white">
                        <span>Total DAS</span>
                        <span className="text-emerald-400">{fmt(simplesTotal)}</span>
                      </div>
                    </div>
                  )}

                  {regime === 'Lucro Presumido' && (
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between text-gray-400"><span>PIS (0,65%)</span><span className="font-semibold text-white">{fmt(presPis)}</span></div>
                      <div className="flex justify-between text-gray-400"><span>COFINS (3%)</span><span className="font-semibold text-white">{fmt(presCofins)}</span></div>
                      <div className="flex justify-between text-gray-400"><span>IRPJ Presumido</span><span className="font-semibold text-white">{fmt(presIrpj)}</span></div>
                      <div className="flex justify-between text-gray-400"><span>CSLL Presumida</span><span className="font-semibold text-white">{fmt(presCsll)}</span></div>
                      <div className="flex justify-between text-gray-400"><span>ISS ({presIssAliq}%)</span><span className="font-semibold text-white">{fmt(presIss)}</span></div>
                      <div className="border-t border-gray-800 pt-3 space-y-2">
                        <div className="flex justify-between text-xs text-gray-400"><span>Alíquota Efetiva Estimada</span><span className="font-bold text-indigo-400">{presEfRate.toFixed(2)}%</span></div>
                        <div className="flex justify-between text-base font-extrabold text-white"><span>Total de Impostos</span><span className="text-emerald-400">{fmt(presTotal)}</span></div>
                      </div>
                    </div>
                  )}

                  {regime === 'Lucro Real' && (
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between text-gray-400"><span>Faturamento Bruto</span><span className="font-semibold text-white">{fmt(realReceitaNum)}</span></div>
                      <div className="flex justify-between text-gray-400"><span>Margem Lucro Real</span><span className={`font-semibold ${realLucro >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(realLucro)}</span></div>
                      <div className="flex justify-between text-gray-400"><span>PIS (1,65%)</span><span className="font-semibold text-white">{fmt(realPis)}</span></div>
                      <div className="flex justify-between text-gray-400"><span>COFINS (7,6%)</span><span className="font-semibold text-white">{fmt(realCofins)}</span></div>
                      <div className="flex justify-between text-gray-400"><span>IRPJ (15% + Adic. 10%)</span><span className="font-semibold text-white">{fmt(realIrpjBase + realIrpjAdd)}</span></div>
                      <div className="flex justify-between text-gray-400"><span>CSLL (9%)</span><span className="font-semibold text-white">{fmt(realCsll)}</span></div>
                      <div className="flex justify-between text-rose-400"><span>(-) Créditos Tributários</span><span className="font-semibold">-{fmt(realCreditosNum)}</span></div>
                      <div className="border-t border-gray-800 pt-3 flex justify-between text-base font-extrabold text-white">
                        <span>Imposto Consolidado</span>
                        <span className="text-emerald-400">{fmt(realTotal)}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 mt-6 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-indigo-300 leading-relaxed">
                    Este demonstrativo é uma estimativa com fins de simulação financeira. Para declarações e obrigações fiscais oficiais, consulte a contabilidade da empresa.
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* HISTÓRICO DE IMPOSTOS */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="px-6 lg:px-8 py-5 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white">Competências e Impostos Lançados</h3>
              <p className="text-xs text-gray-400 mt-0.5">Histórico completo de guias apuradas e lançadas na plataforma.</p>
            </div>

            {loadingHist ? (
              <div className="py-14 text-center"><p className="text-gray-500">Buscando histórico...</p></div>
            ) : historico.length === 0 ? (
              <div className="py-14 text-center bg-gray-950/20">
                <Calendar className="w-12 h-12 text-gray-800 mx-auto mb-3" />
                <p className="text-gray-500 font-semibold text-sm">Nenhuma competência fiscal lançada no histórico.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[500px]">
                  <thead>
                    <tr className="border-b border-gray-800 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="px-6 lg:px-8 py-3">Competência</th>
                      <th className="px-4 py-3">Regime</th>
                      <th className="px-4 py-3">Valor Total</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-6 lg:px-8 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {historico.map(h => (
                      <tr key={h.id} className="hover:bg-gray-800/20 transition-colors">
                        <td className="px-6 lg:px-8 py-4 font-bold text-white">{h.competencia}</td>
                        <td className="px-4 py-4 text-xs text-gray-400 font-medium">{h.regime}</td>
                        <td className="px-4 py-4 font-extrabold text-emerald-400">{fmt(h.valorTotal)}</td>
                        <td className="px-4 py-4">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                            h.status === 'Pago' 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {h.status}
                          </span>
                        </td>
                        <td className="px-6 lg:px-8 py-4 text-right">
                          <button onClick={() => togglePago(h.id, h.status)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                            h.status === 'Pago'
                              ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-600/10'
                          }`}>
                            {h.status === 'Pago' ? 'Definir Em aberto' : 'Marcar como Pago'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

export default ImpostosPage;
