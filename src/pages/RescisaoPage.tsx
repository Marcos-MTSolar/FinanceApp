import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { Activity, Briefcase, Calculator, CheckCircle2, CheckSquare, CreditCard, Download, FileText, LayoutDashboard, LogOut, Menu, MessageCircle, Network, Percent, PiggyBank, Scale, Shield, Tag, Target, TrendingUp, Trophy, Upload, Users, X, XCircle as XIcon } from 'lucide-react';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function calcINSS(base: number): number {
  if (base <= 1412) return base * 0.075;
  if (base <= 2666.68) return base * 0.09;
  if (base <= 4000.03) return base * 0.12;
  return base * 0.14;
}

function diffMonths(d1: Date, d2: Date) {
  return (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
}

type TipoRescisao = 'Pedido de Demissão' | 'Demissão Sem Justa Causa' | 'Demissão Com Justa Causa' | 'Acordo Trabalhista';

interface Verba { nome: string; valor: number; devida: boolean; tributavel?: boolean; }
interface Resultado { verbas: Verba[]; inss: number; totalBruto: number; totalLiquido: number; }

function calcular(salario: number, admissao: Date, demissao: Date, tipo: TipoRescisao): Resultado {
  const diasTrabalhados = demissao.getDate();
  const mesesTotais = diffMonths(admissao, demissao);
  const mesesNoAno = demissao.getMonth() + (demissao.getDate() >= 15 ? 1 : 0) || 1;
  const mesesPeriodo = mesesTotais % 12;
  const temPeriodoAquisitivo = mesesTotais >= 12;

  const devAviso = tipo === 'Demissão Sem Justa Causa' || tipo === 'Acordo Trabalhista';
  const devFeriasProp = tipo !== 'Demissão Com Justa Causa';
  const devUmTercoProp = tipo !== 'Demissão Com Justa Causa';
  const dev13 = tipo !== 'Pedido de Demissão' && tipo !== 'Demissão Com Justa Causa';

  const saldoSalario = (salario / 30) * diasTrabalhados;
  const avisoPrevio = tipo === 'Demissão Sem Justa Causa' ? salario : (tipo === 'Acordo Trabalhista' ? salario * 0.5 : 0);
  const feriasVencidas = temPeriodoAquisitivo ? salario : 0;
  const feriasProp = devFeriasProp ? (salario / 12) * mesesPeriodo : 0;
  const umTerco = devUmTercoProp ? (feriasVencidas + feriasProp) * 0.3333 : 0;
  const trezeAvos = dev13 ? (salario / 12) * mesesNoAno : 0;
  const fgtsAcumulado = salario * 0.08 * mesesTotais;
  const multaFGTS = tipo === 'Demissão Sem Justa Causa' ? fgtsAcumulado * 0.40 : (tipo === 'Acordo Trabalhista' ? fgtsAcumulado * 0.20 : 0);
  const devMulta = tipo === 'Demissão Sem Justa Causa' || tipo === 'Acordo Trabalhista';

  const verbas: Verba[] = [
    { nome: 'Saldo de Salário', valor: saldoSalario, devida: true, tributavel: true },
    { nome: 'Aviso Prévio', valor: avisoPrevio, devida: devAviso, tributavel: true },
    { nome: 'Férias Vencidas', valor: feriasVencidas, devida: temPeriodoAquisitivo, tributavel: false },
    { nome: 'Férias Proporcionais', valor: feriasProp, devida: devFeriasProp, tributavel: false },
    { nome: '1/3 de Férias', valor: umTerco, devida: devUmTercoProp, tributavel: false },
    { nome: '13º Proporcional', valor: trezeAvos, devida: dev13, tributavel: true },
    { nome: 'Multa do FGTS', valor: multaFGTS, devida: devMulta, tributavel: false },
  ];

  const totalTributavel = verbas
    .filter(v => v.devida && v.tributavel)
    .reduce((s, v) => s + v.valor, 0);
  const inss = totalTributavel * 0.075;
  const totalBruto = verbas.filter(v => v.devida).reduce((s, v) => s + v.valor, 0);
  const totalLiquido = totalBruto - inss;

  return { verbas, inss, totalBruto, totalLiquido };
}

export function RescisaoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [user, setUser] = useState(auth.currentUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [dataDemissao, setDataDemissao] = useState('');
  const [tipoRescisao, setTipoRescisao] = useState<TipoRescisao>('Demissão Sem Justa Causa');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { const u = onAuthStateChanged(auth, s => setUser(s)); return u; }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const u = onSnapshot(collection(db, `funcionarios/${user.uid}/items`), snap => {
      setFuncionarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return u;
  }, [user?.uid]);

  useEffect(() => {
    if (!profile?.modo || profile.modo !== 'empresarial') { navigate('/dashboard'); }
  }, [profile, navigate]);

  const funcionario = funcionarios.find(f => f.id === selectedId);
  const admissaoStr = funcionario?.dataAdmissao || '';
  const salario = funcionario?.salarioBruto || 0;

  const handleCalcular = (e: React.FormEvent) => {
    e.preventDefault();
    if (!funcionario || !dataDemissao || !admissaoStr) { toast.error('Selecione um funcionário e preencha as datas.'); return; }
    const admissao = new Date(admissaoStr + 'T12:00:00');
    const demissao = new Date(dataDemissao + 'T12:00:00');
    if (demissao <= admissao) { toast.error('Data de demissão deve ser posterior à admissão.'); return; }
    setResultado(calcular(salario, admissao, demissao, tipoRescisao));
  };

  const handleExportPDF = async () => {
    if (!resultado || !funcionario) return;
    setExporting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const resultadoDaRescisao = {
        funcionario: {
          nome: funcionario.nome,
          cargo: funcionario.cargo,
          dataAdmissao: admissaoStr,
          salarioBruto: salario
        },
        dataDemissao,
        tipoRescisao,
        verbas: resultado.verbas,
        inss: resultado.inss,
        totalBruto: resultado.totalBruto,
        totalLiquido: resultado.totalLiquido
      };
      const res = await fetch('/api/relatorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ tipo: 'rescisao', dados: resultadoDaRescisao })
      });
      if (!res.ok) throw new Error('Falha ao gerar PDF.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rescisao.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('PDF exportado com sucesso!');
    } catch (err) { console.error(err); toast.error('Erro ao gerar PDF.'); }
    finally { setExporting(false); }
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

  const inputCls = "w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all";
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
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2"><FileText className="w-6 h-6 text-indigo-400" />Calculadora de Rescisão</h1>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold text-white">{userName}</span>
              <span className="text-[11px] text-violet-400 font-medium flex items-center gap-1 justify-end"><span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block animate-pulse" />Modo Empresarial</span>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-sm font-bold ring-2 ring-indigo-500/30">{userInitials}</div>
            <button onClick={handleLogout} className="p-2.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-full transition-all"><LogOut className="w-4 h-4" /></button>
          </div>
        </header>

        <div className="flex-1 p-6 lg:p-10 max-w-5xl w-full mx-auto space-y-8">

          {/* Formulário */}
          <form onSubmit={handleCalcular} className="bg-gray-900 border border-gray-800 rounded-3xl p-6 lg:p-8 shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
              <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400"><Calculator className="w-5 h-5" /></div>
              <div><h2 className="text-lg font-bold text-white">Dados da Rescisão</h2><p className="text-xs text-gray-400 mt-0.5">Selecione o funcionário e preencha as informações para calcular.</p></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className={labelCls}>Funcionário</label>
                <select value={selectedId} onChange={e => setSelectedId(e.target.value)} required className={inputCls}>
                  <option value="">Selecione um funcionário...</option>
                  {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome} — {f.cargo}</option>)}
                </select>
                {funcionarios.length === 0 && <p className="text-xs text-amber-400 mt-1.5">⚠ Nenhum funcionário cadastrado. Acesse o módulo Funcionários primeiro.</p>}
              </div>

              <div>
                <label className={labelCls}>Data de Admissão</label>
                <input type="date" value={admissaoStr} readOnly className={`${inputCls} opacity-60 cursor-not-allowed [color-scheme:dark]`} placeholder="Preenchido automaticamente" />
              </div>

              <div>
                <label className={labelCls}>Data de Demissão</label>
                <input type="date" value={dataDemissao} onChange={e => setDataDemissao(e.target.value)} required className={`${inputCls} [color-scheme:dark]`} />
              </div>

              <div>
                <label className={labelCls}>Salário Bruto</label>
                <input type="text" value={salario ? fmt(salario) : ''} readOnly className={`${inputCls} opacity-60 cursor-not-allowed`} placeholder="Preenchido automaticamente" />
              </div>

              <div>
                <label className={labelCls}>Tipo de Rescisão</label>
                <select value={tipoRescisao} onChange={e => setTipoRescisao(e.target.value as TipoRescisao)} className={inputCls}>
                  <option>Pedido de Demissão</option>
                  <option>Demissão Sem Justa Causa</option>
                  <option>Demissão Com Justa Causa</option>
                  <option>Acordo Trabalhista</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" className="flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold rounded-2xl shadow-lg transition-all">
                <Calculator className="w-4 h-4" />Calcular Rescisão
              </button>
            </div>
          </form>

          {/* Resultado */}
          {resultado && (
            <div className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="flex items-center justify-between px-6 lg:px-8 py-5 border-b border-gray-800">
                <div>
                  <h2 className="text-lg font-bold text-white">Resultado da Rescisão</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{funcionario?.nome} · {tipoRescisao}</p>
                </div>
                <button onClick={handleExportPDF} disabled={exporting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-bold rounded-2xl shadow-lg transition-all disabled:opacity-60">
                  <Download className="w-4 h-4" />{exporting ? 'Gerando...' : 'Exportar PDF'}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[540px]">
                  <thead>
                    <tr className="border-b border-gray-800 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                      <th className="px-6 lg:px-8 py-3">Verba Rescisória</th>
                      <th className="px-4 py-3 text-center">Situação</th>
                      <th className="px-6 lg:px-8 py-3 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {resultado.verbas.map(v => (
                      <tr key={v.nome} className="hover:bg-gray-800/30 transition-colors">
                        <td className={`px-6 lg:px-8 py-3.5 text-sm font-medium ${v.devida ? 'text-gray-200' : 'text-gray-600'}`}>{v.nome}</td>
                        <td className="px-4 py-3.5 text-center">
                           <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                             v.devida
                               ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                               : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                           }`}>
                             {v.devida ? 'Devido' : 'Não Devido'}
                           </span>
                         </td>
                        <td className={`px-6 lg:px-8 py-3.5 text-sm font-bold text-right ${v.devida ? (v.valor > 0 ? 'text-emerald-400' : 'text-gray-500') : 'text-gray-600'}`}>
                          {v.devida ? fmt(v.valor) : '—'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-rose-950/20 border-t border-rose-500/20">
                      <td className="px-6 lg:px-8 py-3.5 text-sm font-medium text-rose-400" colSpan={2}>(-) INSS sobre Verbas Tributáveis</td>
                      <td className="px-6 lg:px-8 py-3.5 text-sm font-bold text-right text-rose-400">-{fmt(resultado.inss)}</td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="bg-indigo-950/50 border-t-2 border-indigo-500/30">
                      <td className="px-6 lg:px-8 py-4 text-base font-extrabold text-white" colSpan={2}>✦ Total Líquido a Pagar</td>
                      <td className="px-6 lg:px-8 py-4 text-xl font-extrabold text-right text-emerald-400">{fmt(resultado.totalLiquido)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="px-6 lg:px-8 py-4 bg-gray-950/50 border-t border-gray-800">
                <p className="text-[11px] text-gray-500">⚠ Valores estimados para fins de planejamento. Consulte um contador para confirmação oficial dos direitos trabalhistas.</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default RescisaoPage;
