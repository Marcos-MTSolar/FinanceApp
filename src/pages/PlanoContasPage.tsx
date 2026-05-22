import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { Activity, Briefcase, CheckSquare, ChevronDown, ChevronRight, CreditCard, Edit2, FileText, FolderTree, LayoutDashboard, Loader2, LogOut, Menu, MessageCircle, Network, Percent, PiggyBank, Plus, Save, Scale, Shield, Tag, Target, Trash2, TrendingUp, Trophy, Upload, Users, X } from 'lucide-react';

interface Account {
  id: string;
  code: string;
  name: string;
  isDefault: boolean;
  isDeleted?: boolean;
  group: string;
}

const GRUPOS_PADRAO = [
  'Ativo Circulante',
  'Ativo Não Circulante',
  'Passivo Circulante',
  'Passivo Não Circulante',
  'Patrimônio Líquido',
  'Receitas',
  'Despesas'
];

const CONTAS_PADRAO: Account[] = [
  // Ativo Circulante
  { id: 'ac_caixa', code: '1.1.01', name: 'Caixa Geral', isDefault: true, group: 'Ativo Circulante' },
  { id: 'ac_bancos', code: '1.1.02', name: 'Bancos Conta Movimento', isDefault: true, group: 'Ativo Circulante' },
  { id: 'ac_clientes', code: '1.1.03', name: 'Clientes', isDefault: true, group: 'Ativo Circulante' },
  { id: 'ac_estoques', code: '1.1.04', name: 'Estoques', isDefault: true, group: 'Ativo Circulante' },
  { id: 'ac_tributos', code: '1.1.05', name: 'Tributos a Recuperar', isDefault: true, group: 'Ativo Circulante' },
  
  // Ativo Não Circulante
  { id: 'anc_imobilizado', code: '1.2.01', name: 'Imobilizado (Máquinas, Veículos, Imóveis)', isDefault: true, group: 'Ativo Não Circulante' },
  { id: 'anc_depreciacao', code: '1.2.02', name: 'Depreciação Acumulada', isDefault: true, group: 'Ativo Não Circulante' },
  { id: 'anc_investimentos', code: '1.2.03', name: 'Investimentos', isDefault: true, group: 'Ativo Não Circulante' },
  
  // Passivo Circulante
  { id: 'pc_fornecedores', code: '2.1.01', name: 'Fornecedores', isDefault: true, group: 'Passivo Circulante' },
  { id: 'pc_salarios', code: '2.1.02', name: 'Salários a Pagar', isDefault: true, group: 'Passivo Circulante' },
  { id: 'pc_tributos', code: '2.1.03', name: 'Tributos a Recolher', isDefault: true, group: 'Passivo Circulante' },
  { id: 'pc_emprestimos', code: '2.1.04', name: 'Empréstimos Bancários (Curto Prazo)', isDefault: true, group: 'Passivo Circulante' },
  
  // Passivo Não Circulante
  { id: 'pnc_emprestimos', code: '2.2.01', name: 'Empréstimos e Financiamentos (Longo Prazo)', isDefault: true, group: 'Passivo Não Circulante' },
  { id: 'pnc_provisoes', code: '2.2.02', name: 'Provisões Judiciais', isDefault: true, group: 'Passivo Não Circulante' },
  
  // Patrimônio Líquido
  { id: 'pl_capital', code: '2.3.01', name: 'Capital Social', isDefault: true, group: 'Patrimônio Líquido' },
  { id: 'pl_reservas', code: '2.3.02', name: 'Reservas de Lucros', isDefault: true, group: 'Patrimônio Líquido' },
  { id: 'pl_prejuizos', code: '2.3.03', name: 'Prejuízos Acumulados', isDefault: true, group: 'Patrimônio Líquido' },
  
  // Receitas
  { id: 'rec_vendas', code: '3.1.01', name: 'Receita de Vendas', isDefault: true, group: 'Receitas' },
  { id: 'rec_servicos', code: '3.1.02', name: 'Receita de Serviços', isDefault: true, group: 'Receitas' },
  { id: 'rec_financeiras', code: '3.1.03', name: 'Receitas Financeiras', isDefault: true, group: 'Receitas' },
  
  // Despesas
  { id: 'desp_cmv', code: '4.1.01', name: 'Custos de Mercadorias Vendidas (CMV)', isDefault: true, group: 'Despesas' },
  { id: 'desp_pessoal', code: '4.1.02', name: 'Despesas com Pessoal', isDefault: true, group: 'Despesas' },
  { id: 'desp_adm', code: '4.1.03', name: 'Despesas Administrativas', isDefault: true, group: 'Despesas' },
  { id: 'desp_tributarias', code: '4.1.04', name: 'Despesas Tributárias', isDefault: true, group: 'Despesas' },
  { id: 'desp_financeiras', code: '4.1.05', name: 'Despesas Financeiras', isDefault: true, group: 'Despesas' }
];

export function PlanoContasPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [user, setUser] = useState(auth.currentUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [customAccounts, setCustomAccounts] = useState<Record<string, Account>>({});
  const [loading, setLoading] = useState(true);

  // Accordion open/close state
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Ativo Circulante': true,
    'Receitas': true,
    'Despesas': true
  });

  // Modal / Add account form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [accountName, setAccountName] = useState('');
  const [accountCode, setAccountCode] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    if (profile && profile.modo !== 'empresarial') {
      navigate('/dashboard');
    }
  }, [profile, navigate]);

  // Load customizations
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    const q = collection(db, `planoContas/${user.uid}/items`);
    const unsub = onSnapshot(q, (snap) => {
      const accountsMap: Record<string, Account> = {};
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        accountsMap[docSnap.id] = {
          id: docSnap.id,
          code: data.code || '',
          name: data.name || '',
          isDefault: !!data.isDefault,
          isDeleted: !!data.isDeleted,
          group: data.group || ''
        };
      });
      setCustomAccounts(accountsMap);
      setLoading(false);
    }, () => setLoading(false));

    return unsub;
  }, [user?.uid]);

  // Merge default accounts with Firestore changes
  const getGroupAccounts = (group: string): Account[] => {
    // 1. Process default accounts for this group
    const defaultsMerged = CONTAS_PADRAO.filter(a => a.group === group).map(defAcc => {
      const customOverride = customAccounts[defAcc.id];
      if (customOverride) {
        return {
          ...defAcc,
          name: customOverride.name,
          code: customOverride.code,
          isDeleted: customOverride.isDeleted
        };
      }
      return defAcc;
    }).filter(a => !a.isDeleted);

    // 2. Add custom accounts for this group
    const customs = Object.values(customAccounts).filter(a => !a.isDefault && a.group === group);

    // Merge and sort by code
    return [...defaultsMerged, ...customs].sort((a, b) => a.code.localeCompare(b.code));
  };

  const handleOpenAdd = (group: string) => {
    setEditingAccount(null);
    setSelectedGroup(group);
    setAccountName('');
    setAccountCode('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (acc: Account) => {
    setEditingAccount(acc);
    setSelectedGroup(acc.group);
    setAccountName(acc.name);
    setAccountCode(acc.code);
    setIsFormOpen(true);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim()) {
      toast.error('O nome da conta é obrigatório.');
      return;
    }
    if (!user?.uid) return;

    setSaving(true);
    try {
      const id = editingAccount ? editingAccount.id : `custom_${Date.now()}`;
      const isDefault = editingAccount ? editingAccount.isDefault : false;

      await setDoc(doc(db, `planoContas/${user.uid}/items`, id), {
        name: accountName.trim(),
        code: accountCode.trim(),
        isDefault,
        isDeleted: false,
        group: selectedGroup
      });

      toast.success(editingAccount ? 'Conta atualizada! 📝' : 'Nova conta adicionada! ➕');
      setIsFormOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar conta contábil.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (acc: Account) => {
    if (!user?.uid) return;
    if (!window.confirm(`Tem certeza de que deseja remover a conta "${acc.name}"?`)) return;

    try {
      if (acc.isDefault) {
        // Mark as deleted in Firestore
        await setDoc(doc(db, `planoContas/${user.uid}/items`, acc.id), {
          name: acc.name,
          code: acc.code,
          isDefault: true,
          isDeleted: true,
          group: acc.group
        });
      } else {
        // Delete completely if custom
        await deleteDoc(doc(db, `planoContas/${user.uid}/items`, acc.id));
      }
      toast.success('Conta contábil removida.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao remover conta.');
    }
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch {
      navigate('/login');
    }
  };

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

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-gray-950">
        <header className="h-20 px-6 lg:px-10 border-b border-gray-900 flex items-center justify-between bg-gray-950/80 backdrop-blur-md sticky top-0 z-20">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Network className="w-6 h-6 text-indigo-400" />
            Plano de Contas
          </h1>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold text-white">{userName}</span>
              <span className="text-[11px] text-violet-400 font-medium flex items-center gap-1 justify-end">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block animate-pulse" />
                Modo Empresarial
              </span>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-sm font-bold ring-2 ring-indigo-500/30">{userInitials}</div>
            <button onClick={handleLogout} className="p-2.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-full transition-all">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 p-6 lg:p-10 max-w-4xl w-full mx-auto space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 lg:p-8 shadow-xl space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-indigo-400" />
                Estrutura Contábil
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Visualize, edite ou crie contas personalizadas para a contabilidade da sua empresa. As subcontas organizam os demonstrativos (DRE, Balanço Patrimonial e Fluxo de Caixa).
              </p>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-sm text-gray-500">Carregando plano de contas...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {GRUPOS_PADRAO.map(group => {
                  const isExpanded = !!expandedGroups[group];
                  const accounts = getGroupAccounts(group);

                  return (
                    <div key={group} className="border border-gray-800/80 rounded-2xl bg-gray-950/40 overflow-hidden">
                      <div
                        onClick={() => toggleGroup(group)}
                        className="flex items-center justify-between px-5 py-4 bg-gray-900/60 hover:bg-gray-900 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                          <span className="font-bold text-sm text-white tracking-wide">{group}</span>
                          <span className="text-[10px] px-2 py-0.5 bg-gray-800 border border-gray-700/60 text-gray-400 rounded-full font-bold">
                            {accounts.length} contas
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenAdd(group);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white text-xs font-bold rounded-xl border border-indigo-500/20 transition-all"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Adicionar</span>
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="divide-y divide-gray-800/40 bg-gray-950/20 px-4 py-2">
                          {accounts.length === 0 ? (
                            <p className="text-xs text-gray-500 italic px-4 py-3">Nenhuma conta cadastrada neste grupo.</p>
                          ) : (
                            accounts.map(acc => (
                              <div key={acc.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-900/20 rounded-xl transition group">
                                <div className="flex items-center gap-4">
                                  {acc.code && (
                                    <span className="text-xs font-mono font-bold text-indigo-400/80 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-500/10">
                                      {acc.code}
                                    </span>
                                  )}
                                  <span className="text-sm font-semibold text-gray-200">{acc.name}</span>
                                  {acc.isDefault && (
                                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 bg-gray-900 border border-gray-850 text-gray-500 rounded">
                                      Padrão
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => handleOpenEdit(acc)}
                                    title="Editar"
                                    className="p-1.5 text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAccount(acc)}
                                    title="Remover"
                                    className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Create/Edit Modal */}
        {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-md p-6 lg:p-7 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
              <button
                onClick={() => setIsFormOpen(false)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-xl bg-gray-800/40 hover:bg-gray-800 transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="mb-6">
                <h3 className="text-base font-bold text-white">
                  {editingAccount ? 'Editar Conta Contábil' : 'Nova Conta Contábil'}
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Adicionando ao grupo: <span className="font-bold text-indigo-400">{selectedGroup}</span>
                </p>
              </div>

              <form onSubmit={handleSaveAccount} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Código de Classificação (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 1.1.06"
                    value={accountCode}
                    onChange={e => setAccountCode(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Nome da Conta
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Banco Itaú Corp, Clientes Externos"
                    value={accountName}
                    onChange={e => setAccountName(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="flex-1 px-4 py-3 text-sm font-semibold text-gray-400 hover:text-white bg-gray-800/40 hover:bg-gray-800 rounded-2xl transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold rounded-2xl shadow-lg transition-all"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>Salvar</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default PlanoContasPage;
