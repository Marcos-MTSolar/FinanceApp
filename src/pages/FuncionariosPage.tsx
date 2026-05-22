import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { Activity, Briefcase, Building, Calculator, CheckSquare, CreditCard, FileText, LayoutDashboard, Loader2, LogOut, Menu, MessageCircle, Network, Percent, PiggyBank, Plus, Save, Scale, Shield, Tag, Target, TrendingUp, Trophy, Upload, Users, X, XCircle } from 'lucide-react';

interface Funcionario {
  id: string;
  nome: string;
  cpf: string;
  rg: string;
  endereco: string;
  cargo: string;
  salarioBruto: number;
  dataAdmissao: string;
  tipoContrato: string;
}

function calcularCustos(salario: number) {
  const inssPatronal = salario * 0.20;
  const fgtsMensal = salario * 0.08;
  const ratSat = salario * 0.02;
  const terceiros = salario * 0.058;
  const provisaoFerias = salario / 12;
  const adicionalFerias = (salario / 12) * 0.3333;
  const provisao13 = salario / 12;
  const fgtsAcumulado = salario * 0.08 * 12;
  const multaRescisoria = fgtsAcumulado * 0.40;
  const custoRealMensal = salario + inssPatronal + fgtsMensal + ratSat + terceiros + provisaoFerias + adicionalFerias + provisao13;
  return { inssPatronal, fgtsMensal, ratSat, terceiros, provisaoFerias, adicionalFerias, provisao13, multaRescisoria, custoRealMensal };
}

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const EMPTY_FORM = { nome: '', cpf: '', rg: '', endereco: '', cargo: '', salarioBruto: 0, dataAdmissao: '', tipoContrato: 'CLT' };

export function FuncionariosPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [user, setUser] = useState(auth.currentUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aba, setAba] = useState<'funcionarios' | 'custo'>('funcionarios');
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    setLoading(true);
    getDocs(collection(db, `funcionarios/${user.uid}/items`))
      .then(snap => {
        setFuncionarios(snap.docs.map(d => ({ id: d.id, ...d.data() } as Funcionario)));
        setLoading(false);
      })
      .catch(err => { console.error(err); setLoading(false); });
  }, [user?.uid, refreshTrigger]);

  useEffect(() => {
    if (!loading && profile && profile.modo !== 'empresarial') {
      toast.error('Acesso exclusivo para modo empresarial.');
      navigate('/dashboard');
    }
  }, [profile, loading, navigate]);

  const handleCpf = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
      .substring(0, 14);
    setForm(p => ({ ...p, cpf: v }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: name === 'salarioBruto' ? Number(value) : value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;
    setSaving(true);
    try {
      await addDoc(collection(db, `funcionarios/${user.uid}/items`), { ...form, criadoEm: serverTimestamp() });
      toast.success('Funcionário cadastrado com sucesso! 👤');
      setModalOpen(false);
      setForm({ ...EMPTY_FORM });
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar funcionário.');
    } finally { setSaving(false); }
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
          <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">FinanceAI</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-gray-400 hover:text-white rounded-lg bg-gray-800/60">
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-300 md:translate-x-0 ${mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="h-20 flex items-center gap-3 px-8 border-b border-gray-800/60">
          <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl flex items-center justify-center ring-1 ring-white/10">
            <Shield className="w-6 h-6 text-white" />
          </div>
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
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{userName}</p>
              <p className="text-[10px] text-indigo-400 font-medium">Conectado</p>
            </div>
          </div>
        </div>
      </aside>

      {mobileMenuOpen && <div onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden" />}

      <main className="flex-1 flex flex-col min-w-0 bg-gray-950">
        {/* Header */}
        <header className="h-20 px-6 lg:px-10 border-b border-gray-900 flex items-center justify-between bg-gray-950/80 backdrop-blur-md sticky top-0 z-20">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-400" />Gestão de Funcionários
          </h1>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold text-white">{userName}</span>
              <span className="text-[11px] text-violet-400 font-medium flex items-center gap-1 justify-end">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block animate-pulse" />Modo Empresarial
              </span>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-sm font-bold ring-2 ring-indigo-500/30">{userInitials}</div>
            <button onClick={handleLogout} className="p-2.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-full transition-all">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 p-6 lg:p-10 max-w-7xl w-full mx-auto space-y-6">
          {/* Abas */}
          <div className="flex items-center gap-1 p-1 bg-gray-900 border border-gray-800 rounded-2xl w-fit">
            <button onClick={() => setAba('funcionarios')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${aba === 'funcionarios' ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>
              <Users className="w-4 h-4" />Funcionários
            </button>
            <button onClick={() => setAba('custo')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${aba === 'custo' ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>
              <Calculator className="w-4 h-4" />Custo Real
            </button>
          </div>

          {/* ABA FUNCIONÁRIOS */}
          {aba === 'funcionarios' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-white">Equipe Cadastrada</h2>
                  <p className="text-sm text-gray-400 mt-0.5">{funcionarios.length} funcionário(s) registrado(s)</p>
                </div>
                <button onClick={() => setModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold rounded-2xl shadow-lg transition-all">
                  <Plus className="w-4 h-4" />Adicionar Funcionário
                </button>
              </div>

              {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
              ) : funcionarios.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-3xl p-16 text-center">
                  <Users className="w-14 h-14 text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-400 font-semibold">Nenhum funcionário cadastrado ainda.</p>
                  <p className="text-gray-500 text-sm mt-1">Clique em "Adicionar Funcionário" para começar.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {funcionarios.map(f => (
                    <div key={f.id} className="bg-gray-900 border border-gray-800 hover:border-indigo-500/40 rounded-3xl p-6 shadow-xl transition-all group">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-sm font-bold text-white shadow-inner">
                          {f.nome.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-white leading-tight">{f.nome}</p>
                          <p className="text-xs text-indigo-400 font-medium">{f.cargo}</p>
                        </div>
                        <span className="ml-auto text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border bg-violet-500/10 text-violet-400 border-violet-500/20">{f.tipoContrato}</span>
                      </div>
                      <div className="space-y-2 text-xs text-gray-400">
                        <div className="flex justify-between"><span>CPF</span><span className="text-gray-300 font-medium font-mono">{f.cpf}</span></div>
                        <div className="flex justify-between"><span>Admissão</span><span className="text-gray-300 font-medium">{f.dataAdmissao ? new Date(f.dataAdmissao + 'T12:00:00').toLocaleDateString('pt-BR') : '--'}</span></div>
                        <div className="flex justify-between border-t border-gray-800 pt-2 mt-2">
                          <span className="font-bold text-gray-300">Salário Bruto</span>
                          <span className="text-emerald-400 font-extrabold">{fmt(f.salarioBruto || 0)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ABA CUSTO REAL */}
          {aba === 'custo' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-extrabold text-white">Custo Real por Funcionário</h2>
                <p className="text-sm text-gray-400 mt-0.5">Encargos calculados automaticamente com base no salário bruto cadastrado.</p>
              </div>

              {loading ? (
                <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
              ) : funcionarios.length === 0 ? (
                <div className="bg-gray-900 border border-gray-800 rounded-3xl p-16 text-center">
                  <Calculator className="w-14 h-14 text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-400 font-semibold">Nenhum funcionário cadastrado para calcular custos.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {funcionarios.map(f => {
                    const c = calcularCustos(f.salarioBruto || 0);
                    const rows = [
                      { label: 'Salário Bruto', value: f.salarioBruto || 0, color: 'text-white', bold: true },
                      { label: 'INSS Patronal (20%)', value: c.inssPatronal, color: 'text-rose-400' },
                      { label: 'FGTS Mensal (8%)', value: c.fgtsMensal, color: 'text-rose-400' },
                      { label: 'RAT/SAT (2%)', value: c.ratSat, color: 'text-rose-400' },
                      { label: 'Terceiros / Sistema S (5,8%)', value: c.terceiros, color: 'text-rose-400' },
                      { label: 'Provisão de Férias (÷12)', value: c.provisaoFerias, color: 'text-amber-400' },
                      { label: 'Adicional 1/3 de Férias', value: c.adicionalFerias, color: 'text-amber-400' },
                      { label: 'Provisão de 13º (÷12)', value: c.provisao13, color: 'text-amber-400' },
                      { label: 'Multa Rescisória Estimada (FGTS×12×40%)', value: c.multaRescisoria, color: 'text-orange-400' },
                    ];
                    return (
                      <div key={f.id} className="bg-gray-900 border border-gray-800 rounded-3xl overflow-hidden shadow-xl">
                        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800 bg-gray-900/80">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-sm font-bold text-white">
                            {f.nome.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-white">{f.nome}</p>
                            <p className="text-xs text-indigo-400">{f.cargo} · {f.tipoContrato}</p>
                          </div>
                          <div className="ml-auto text-right">
                            <p className="text-xs text-gray-400 font-medium">Custo Real Mensal</p>
                            <p className="text-xl font-extrabold text-emerald-400">{fmt(c.custoRealMensal)}</p>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left min-w-[500px]">
                            <thead>
                              <tr className="border-b border-gray-800 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                <th className="px-6 py-3">Componente</th>
                                <th className="px-6 py-3 text-right">Valor Mensal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/60">
                              {rows.map((row, i) => (
                                <tr key={i} className="hover:bg-gray-800/30 transition-colors">
                                  <td className={`px-6 py-3 text-sm ${row.bold ? 'font-bold text-white' : 'text-gray-400'}`}>{row.label}</td>
                                  <td className={`px-6 py-3 text-sm font-bold text-right ${row.color}`}>{fmt(row.value)}</td>
                                </tr>
                              ))}
                              <tr className="bg-indigo-950/40 border-t-2 border-indigo-500/30">
                                <td className="px-6 py-4 text-sm font-extrabold text-white">✦ Custo Real Mensal Total</td>
                                <td className="px-6 py-4 text-base font-extrabold text-right text-emerald-400">{fmt(c.custoRealMensal)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-8 py-6 border-b border-gray-800">
              <div>
                <h3 className="text-xl font-bold text-white">Adicionar Funcionário</h3>
                <p className="text-xs text-gray-400 mt-0.5">Preencha os dados cadastrais do colaborador.</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-gray-500 hover:text-white transition">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <label className={labelCls}>Nome Completo</label>
                  <input type="text" name="nome" value={form.nome} onChange={handleChange} required placeholder="Nome completo do funcionário" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>CPF</label>
                  <input type="text" name="cpf" value={form.cpf} onChange={handleCpf} required placeholder="000.000.000-00" className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>RG</label>
                  <input type="text" name="rg" value={form.rg} onChange={handleChange} placeholder="Número do RG" className={inputCls} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Endereço</label>
                  <input type="text" name="endereco" value={form.endereco} onChange={handleChange} placeholder="Rua, número, bairro, cidade" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Cargo</label>
                  <input type="text" name="cargo" value={form.cargo} onChange={handleChange} required placeholder="Ex: Analista, Técnico..." className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Tipo de Contrato</label>
                  <select name="tipoContrato" value={form.tipoContrato} onChange={handleChange} className={inputCls}>
                    <option value="CLT">CLT</option>
                    <option value="PJ">PJ</option>
                    <option value="Estágio">Estágio</option>
                    <option value="Temporário">Temporário</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Salário Bruto (R$)</label>
                  <input type="number" name="salarioBruto" value={form.salarioBruto || ''} onChange={handleChange} required min="0" step="0.01" placeholder="Ex: 3500.00" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Data de Admissão</label>
                  <input type="date" name="dataAdmissao" value={form.dataAdmissao} onChange={handleChange} required className={`${inputCls} [color-scheme:dark]`} />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm font-bold rounded-2xl transition-all">
                  Cancelar
                </button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold rounded-2xl shadow-lg transition-all">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Salvando...' : 'Salvar Funcionário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default FuncionariosPage;
