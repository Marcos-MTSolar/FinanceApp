import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { auth, db } from '../lib/firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { Activity, AlertTriangle, Briefcase, Building, Calculator, CheckSquare, CreditCard, FileText, LayoutDashboard, Loader2, LogOut, Menu, MessageCircle, Network, Percent, PiggyBank, Plus, Save, Scale, Shield, Tag, Target, Trash2, TrendingUp, Trophy, Upload, Users, X, XCircle } from 'lucide-react';

interface Funcionario {
  id: string;
  nome: string;
  cpf: string;
  rg: string;
  endereco: string;
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { auth, db } from '../lib/firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { Activity, AlertTriangle, Briefcase, Building, Calculator, CheckSquare, CreditCard, FileText, LayoutDashboard, Loader2, LogOut, Menu, MessageCircle, Network, Percent, PiggyBank, Plus, Save, Scale, Shield, Tag, Target, Trash2, TrendingUp, Trophy, Upload, Users, X, XCircle } from 'lucide-react';

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

function calcularCustos(salario: number, tipoContrato: string = 'CLT') {
  if (tipoContrato === 'PJ') {
    const aliquotaSimples = 0.06; // 6% na primeira faixa
    const aliquotaISS = 0.05; // 5% valor máximo/conservador
    const aliquotaTotal = aliquotaSimples + aliquotaISS;
    const valorBrutoContrato = salario / (1 - aliquotaTotal);
    const impostoRetido = valorBrutoContrato - salario;
    
    return {
      isPJ: true,
      valorLiquido: salario,
      aliquotaSimples: valorBrutoContrato * aliquotaSimples,
      iss: valorBrutoContrato * aliquotaISS,
      impostoRetido,
      custoRealMensal: valorBrutoContrato
    };
  }

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
  return { 
    isPJ: false,
    inssPatronal, fgtsMensal, ratSat, terceiros, provisaoFerias, adicionalFerias, provisao13, multaRescisoria, custoRealMensal 
  };
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const handleDeleteFuncionario = async (id: string) => {
    if (!user?.uid) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, `funcionarios/${user.uid}/items`, id));
      setFuncionarios(prev => prev.filter(f => f.id !== id));
      toast.success('Funcionário excluído com sucesso.');
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('[FuncionariosPage] Erro ao excluir funcionário:', err);
      toast.error('Erro ao excluir funcionário. Tente novamente.');
    } finally {
      setDeleting(false);
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
