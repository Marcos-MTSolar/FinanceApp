import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { Activity, Briefcase, CheckSquare, ChevronDown, ChevronUp, CreditCard, FileText, LayoutDashboard, Loader2, LogOut, Menu, MessageCircle, Network, Percent, PiggyBank, Save, Scale, Shield, Tag, Target, TrendingUp, Trophy, Upload, Users, X } from 'lucide-react';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function calcReserva(salario: number) {
  const ferias = salario / 12;
  const umTercoFerias = (salario / 12) * 0.3333;
  const trezeAvos = salario / 12;
  const fgtsMensal = salario * 0.08;
  const multaFutura = (fgtsMensal * 12) * 0.40;
  const totalMensal = ferias + umTercoFerias + trezeAvos + fgtsMensal + multaFutura;
  return { ferias, umTercoFerias, trezeAvos, fgtsMensal, multaFutura, totalMensal };
}

interface Cofrinho {
  nome: string;
  icone: string;
  cor: string;
  borderCor: string;
  bgCor: string;
  textCor: string;
  alvo: number;
  guardado: number;
  manual: boolean;
  key: string;
}

export function ReservaTrabalhistaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [user, setUser] = useState(auth.currentUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedFuncs, setExpandedFuncs] = useState<Record<string, boolean>>({});

  // Cofrinhos: guardado e valores manuais
  const [guardado13, setGuardado13] = useState(0);
  const [guardadoFerias, setGuardadoFerias] = useState(0);
  const [guardadoRescisoes, setGuardadoRescisoes] = useState(0);
  const [guardadoImpostos, setGuardadoImpostos] = useState(0);
  const [guardadoEmergencia, setGuardadoEmergencia] = useState(0);
  const [alvoImpostos, setAlvoImpostos] = useState(0);
  const [alvoEmergencia, setAlvoEmergencia] = useState(0);

  useEffect(() => { const u = onAuthStateChanged(auth, s => setUser(s)); return u; }, []);

  useEffect(() => {
    if (!profile?.modo || profile.modo !== 'empresarial') { navigate('/dashboard'); }
  }, [profile, navigate]);

  useEffect(() => {
    if (!user?.uid) return;
    const u = onSnapshot(collection(db, `funcionarios/${user.uid}/items`), snap => {
      setFuncionarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return u;
  }, [user?.uid]);

  useEffect(() => {
    const fetchReservas = async () => {
      if (!user?.uid) return;
      try {
        const snap = await getDoc(doc(db, 'reservas', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          setGuardado13(d.guardado13 || 0);
          setGuardadoFerias(d.guardadoFerias || 0);
          setGuardadoRescisoes(d.guardadoRescisoes || 0);
          setGuardadoImpostos(d.guardadoImpostos || 0);
          setGuardadoEmergencia(d.guardadoEmergencia || 0);
          setAlvoImpostos(d.alvoImpostos || 0);
          setAlvoEmergencia(d.alvoEmergencia || 0);
        }
      } catch (err) { console.error(err); }
    };
    fetchReservas();
  }, [user?.uid]);

  // Totais consolidados de todos os funcionários
  const totais = funcionarios.reduce((acc, f) => {
    const c = calcReserva(f.salarioBruto || 0);
    return {
      ferias: acc.ferias + c.ferias,
      umTercoFerias: acc.umTercoFerias + c.umTercoFerias,
      trezeAvos: acc.trezeAvos + c.trezeAvos,
      fgtsMensal: acc.fgtsMensal + c.fgtsMensal,
      multaFutura: acc.multaFutura + c.multaFutura,
      totalMensal: acc.totalMensal + c.totalMensal,
    };
  }, { ferias: 0, umTercoFerias: 0, trezeAvos: 0, fgtsMensal: 0, multaFutura: 0, totalMensal: 0 });

  const alvo13 = totais.trezeAvos;
  const alvoFeriasTotal = totais.ferias + totais.umTercoFerias;
  const alvoRescisoes = totais.multaFutura;

  const handleSalvar = async () => {
    if (!user?.uid) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'reservas', user.uid), {
        guardado13, guardadoFerias, guardadoRescisoes,
        guardadoImpostos, guardadoEmergencia,
        alvoImpostos, alvoEmergencia,
        atualizadoEm: new Date().toISOString()
      });
      toast.success('Reservas salvas com sucesso! 🐷');
    } catch (err) { console.error(err); toast.error('Erro ao salvar reservas.'); }
    finally { setSaving(false); }
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

  const cofrinhos = [
    {
      key: '13', nome: '13º Salário', icone: '🎄', cor: 'from-emerald-600 to-teal-600',
      borderCor: 'border-emerald-500/30', bgCor: 'bg-emerald-500/10', textCor: 'text-emerald-400',
      alvo: alvo13, guardado: guardado13,
      setter: setGuardado13, manual: false,
    },
    {
      key: 'ferias', nome: 'Férias', icone: '🏖️', cor: 'from-sky-600 to-blue-600',
      borderCor: 'border-sky-500/30', bgCor: 'bg-sky-500/10', textCor: 'text-sky-400',
      alvo: alvoFeriasTotal, guardado: guardadoFerias,
      setter: setGuardadoFerias, manual: false,
    },
    {
      key: 'rescisoes', nome: 'Rescisões', icone: '⚖️', cor: 'from-orange-600 to-amber-600',
      borderCor: 'border-orange-500/30', bgCor: 'bg-orange-500/10', textCor: 'text-orange-400',
      alvo: alvoRescisoes, guardado: guardadoRescisoes,
      setter: setGuardadoRescisoes, manual: false,
    },
    {
      key: 'impostos', nome: 'Impostos', icone: '🏛️', cor: 'from-rose-600 to-pink-600',
      borderCor: 'border-rose-500/30', bgCor: 'bg-rose-500/10', textCor: 'text-rose-400',
      alvo: alvoImpostos, guardado: guardadoImpostos,
      setter: setGuardadoImpostos, manual: true, alvoSetter: setAlvoImpostos,
    },
    {
      key: 'emergencia', nome: 'Emergência', icone: '🚨', cor: 'from-violet-600 to-purple-600',
      borderCor: 'border-violet-500/30', bgCor: 'bg-violet-500/10', textCor: 'text-violet-400',
      alvo: alvoEmergencia, guardado: guardadoEmergencia,
      setter: setGuardadoEmergencia, manual: true, alvoSetter: setAlvoEmergencia,
    },
  ] as any[];

  const inputCls = "w-full px-3 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all";

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
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2"><PiggyBank className="w-6 h-6 text-indigo-400" />Reserva Trabalhista</h1>
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

          {/* Card Resumo Total */}
          <div className="bg-gradient-to-br from-gray-900 via-gray-900 to-indigo-950/40 border border-indigo-500/20 rounded-3xl p-6 lg:p-8 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-1">Total Consolidado — {funcionarios.length} funcionário(s)</p>
                <h2 className="text-3xl lg:text-4xl font-extrabold text-white">{fmt(totais.totalMensal)}<span className="text-base font-normal text-gray-400">/mês</span></h2>
                <p className="text-sm text-gray-400 mt-1">Total que a empresa deve reservar mensalmente para obrigações trabalhistas.</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-center">
                {[
                  { label: 'Férias', valor: totais.ferias },
                  { label: '1/3 Férias', valor: totais.umTercoFerias },
                  { label: '13º Salário', valor: totais.trezeAvos },
                  { label: 'FGTS Mensal', valor: totais.fgtsMensal },
                  { label: 'Multa FGTS', valor: totais.multaFutura },
                ].map(item => (
                  <div key={item.label} className="bg-gray-950/60 border border-gray-800 rounded-2xl px-4 py-3">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm font-extrabold text-indigo-300 mt-1">{fmt(item.valor)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detalhamento por Funcionário */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="px-6 lg:px-8 py-5 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white">Detalhamento por Funcionário</h3>
              <p className="text-xs text-gray-400 mt-0.5">Clique em um funcionário para ver o detalhamento individual.</p>
            </div>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 text-indigo-500 animate-spin" /></div>
            ) : funcionarios.length === 0 ? (
              <div className="py-14 text-center"><Users className="w-12 h-12 text-gray-700 mx-auto mb-3" /><p className="text-gray-500 font-medium">Nenhum funcionário cadastrado.</p></div>
            ) : (
              <div className="divide-y divide-gray-800/60">
                {funcionarios.map(f => {
                  const c = calcReserva(f.salarioBruto || 0);
                  const expanded = expandedFuncs[f.id];
                  return (
                    <div key={f.id}>
                      <button onClick={() => setExpandedFuncs(p => ({ ...p, [f.id]: !p[f.id] }))}
                        className="w-full flex items-center justify-between px-6 lg:px-8 py-4 hover:bg-gray-800/30 transition-colors text-left">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-xs font-bold text-white">{f.nome?.substring(0, 2).toUpperCase()}</div>
                          <div>
                            <p className="font-semibold text-white text-sm">{f.nome}</p>
                            <p className="text-xs text-gray-500">{f.cargo} · {fmt(f.salarioBruto || 0)}/mês</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Reserva Mensal</p>
                            <p className="text-sm font-extrabold text-emerald-400">{fmt(c.totalMensal)}</p>
                          </div>
                          {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                        </div>
                      </button>
                      {expanded && (
                        <div className="px-6 lg:px-8 pb-5 bg-gray-950/40">
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-2">
                            {[
                              { label: 'Férias', valor: c.ferias, cor: 'text-sky-400' },
                              { label: '1/3 Férias', valor: c.umTercoFerias, cor: 'text-sky-400' },
                              { label: '13º Salário', valor: c.trezeAvos, cor: 'text-emerald-400' },
                              { label: 'FGTS Mensal', valor: c.fgtsMensal, cor: 'text-amber-400' },
                              { label: 'Multa FGTS', valor: c.multaFutura, cor: 'text-orange-400' },
                            ].map(item => (
                              <div key={item.label} className="bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-center">
                                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{item.label}</p>
                                <p className={`text-sm font-extrabold mt-1 ${item.cor}`}>{fmt(item.valor)}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cofrinhos */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">🐷 Cofrinhos da Empresa</h3>
                <p className="text-xs text-gray-400 mt-0.5">Registre quanto já foi separado em cada categoria de reserva.</p>
              </div>
              <button onClick={handleSalvar} disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold rounded-2xl shadow-lg transition-all disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Salvando...' : 'Salvar Reservas'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {cofrinhos.map((c: any) => {
                const pct = c.alvo > 0 ? Math.min(100, (c.guardado / c.alvo) * 100) : 0;
                const falta = Math.max(0, c.alvo - c.guardado);
                return (
                  <div key={c.key} className={`bg-gray-900 border ${c.borderCor} rounded-3xl p-6 shadow-xl hover:shadow-2xl transition-all`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{c.icone}</span>
                        <h4 className="font-bold text-white">{c.nome}</h4>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${c.bgCor} ${c.textCor} border ${c.borderCor}`}>
                        {pct.toFixed(0)}%
                      </span>
                    </div>

                    {/* Barra de progresso */}
                    <div className="w-full h-2 bg-gray-800 rounded-full mb-4 overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${c.cor} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>

                    <div className="space-y-3">
                      {/* Alvo */}
                      {c.manual ? (
                        <div>
                          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Meta Mensal (R$)</label>
                          <input type="number" min="0" step="0.01"
                            value={c.alvo || ''}
                            onChange={e => c.alvoSetter(Number(e.target.value))}
                            placeholder="0,00"
                            className={inputCls} />
                        </div>
                      ) : (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Meta Mensal</span>
                          <span className={`font-bold ${c.textCor}`}>{fmt(c.alvo)}</span>
                        </div>
                      )}

                      {/* Guardado */}
                      <div>
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">Já Guardado (R$)</label>
                        <input type="number" min="0" step="0.01"
                          value={c.guardado || ''}
                          onChange={e => c.setter(Number(e.target.value))}
                          placeholder="0,00"
                          className={inputCls} />
                      </div>

                      {/* Falta */}
                      <div className={`flex justify-between text-xs pt-1 border-t border-gray-800`}>
                        <span className="text-gray-500">Falta guardar</span>
                        <span className={`font-bold ${falta > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {falta > 0 ? fmt(falta) : '✓ Meta atingida!'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default ReservaTrabalhistaPage;
