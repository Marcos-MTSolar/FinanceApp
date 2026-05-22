import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { 
  LayoutDashboard, 
  CreditCard, 
  Target, 
  Upload, 
  MessageCircle, 
  Trophy,
  TrendingUp,
  Shield,
  Briefcase,
  Building,
  Menu,
  X,
  LogOut,
  Save,
  Loader2
, Network, CheckSquare } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebaseConfig';

export function CadastroEmpresaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading: authLoading } = useAuth();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [saving, setSaving] = useState(false);

  // Formulário State
  const [form, setForm] = useState({
    // Dados da Empresa
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    cnae: '',
    inscricaoEstadual: '',
    inscricaoMunicipal: '',
    contadorResponsavel: '',
    regimeTributario: 'Simples Nacional',
    
    // Dados Bancários
    nomeBanco: '',
    numeroContaPj: '',
    agencia: '',
    chavePix: '',
    limiteBancario: 0,
    emprestimosAtivos: ''
  });

  // CNPJ mask helper
  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const masked = rawVal
      .replace(/\D/g, '') // remove tudo que não for dígito
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .substring(0, 18); // Limita o tamanho ao padrão CNPJ
      
    setForm(prev => ({ ...prev, cnpj: masked }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === 'limiteBancario' ? Number(value) : value
    }));
  };

  // Carrega dados existentes do Firestore
  useEffect(() => {
    const fetchCompanyData = async () => {
      if (!user?.uid) return;
      try {
        const docRef = doc(db, 'empresas', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setForm(prev => ({
            ...prev,
            ...data
          }));
        }
      } catch (err) {
        console.error('Erro ao buscar dados cadastrais da empresa:', err);
        toast.error('Não foi possível carregar os dados cadastrais.');
      } finally {
        setFetchingData(false);
      }
    };

    if (user?.uid) {
      fetchCompanyData();
    } else if (!authLoading && !user) {
      setFetchingData(false);
    }
  }, [user, authLoading]);

  // Redireciona se não for modo empresarial
  useEffect(() => {
    if (!authLoading && profile && profile.modo !== 'empresarial') {
      toast.error('Este módulo é de acesso exclusivo para o modo empresarial.');
      navigate('/dashboard');
    }
  }, [profile, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) {
      toast.error('Usuário não autenticado.');
      return;
    }

    setSaving(true);
    try {
      const docRef = doc(db, 'empresas', user.uid);
      await setDoc(docRef, {
        ...form,
        atualizadoEm: new Date().toISOString()
      });
      toast.success('Dados cadastrais da empresa salvos com sucesso! 🏢🎉');
    } catch (err) {
      console.error('Erro ao salvar dados da empresa:', err);
      toast.error('Ocorreu um erro ao salvar as informações.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Erro ao realizar logout:', error);
      navigate('/login');
    }
  };

  // Layout sidebar & topbar setup
  const userName = user?.displayName || user?.email?.split('@')[0] || profile?.nome || 'Usuário Demo';
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

  // Adiciona a rota ativa no menu se for empresarial
  if (profile?.modo === 'empresarial') {
    navItems.push({ name: 'Cadastro Empresa', path: '/empresa/cadastro', icon: Briefcase });
      if (!navItems.some(item => item.path === '/empresa/plano-contas')) {
      navItems.push({ name: 'Plano de Contas', path: '/empresa/plano-contas', icon: Network });
      navItems.push({ name: 'Conciliação', path: '/empresa/conciliacao', icon: CheckSquare });
    }
  }

  if (authLoading || fetchingData) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
        <span className="text-sm font-semibold tracking-wider text-gray-400">Carregando módulo empresarial...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col md:flex-row selection:bg-indigo-500 selection:text-white font-sans">
      {/* Sidebar Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
            FinanceAI
          </span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-gray-400 hover:text-white rounded-lg bg-gray-800/60 focus:outline-none"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="h-20 flex items-center gap-3 px-8 border-b border-gray-800/60">
          <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30 ring-1 ring-white/10">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-gray-200 to-indigo-200 bg-clip-text text-transparent">
            FinanceAI
          </span>
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
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? 'text-white' : 'text-gray-400 group-hover:text-indigo-400'
                  }`}
                />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800/80">
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

      {/* Overlay Mobile */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-gray-950">
        <header className="h-20 px-6 lg:px-10 border-b border-gray-900 flex items-center justify-between bg-gray-950/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-4 flex-1">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <Building className="w-6 h-6 text-indigo-400" />
              Cadastro da Empresa
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-semibold leading-tight text-white">{userName}</span>
                <span className="text-[11px] text-violet-400 font-medium flex items-center gap-1 justify-end">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 inline-block animate-pulse"></span>
                  Modo Empresarial
                </span>
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-sm font-bold shadow-md ring-2 ring-indigo-500/30">
                {userInitials}
              </div>
              <button
                onClick={handleLogout}
                title="Sair"
                className="p-2.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-full transition-all ml-1 group"
              >
                <LogOut className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 lg:p-10 max-w-5xl w-full mx-auto overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Seção: Dados da Empresa */}
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 lg:p-8 shadow-xl shadow-black/20 space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
                <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Dados da Empresa</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Informações cadastrais e tributárias essenciais da PJ.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Razão Social</label>
                  <input
                    type="text"
                    name="razaoSocial"
                    value={form.razaoSocial}
                    onChange={handleInputChange}
                    required
                    placeholder="Ex: MT Soluções em Energia Ltda"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nome Fantasia</label>
                  <input
                    type="text"
                    name="nomeFantasia"
                    value={form.nomeFantasia}
                    onChange={handleInputChange}
                    required
                    placeholder="Ex: MT Solar"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">CNPJ</label>
                  <input
                    type="text"
                    name="cnpj"
                    value={form.cnpj}
                    onChange={handleCnpjChange}
                    required
                    placeholder="00.000.000/0000-00"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">CNAE</label>
                  <input
                    type="text"
                    name="cnae"
                    value={form.cnae}
                    onChange={handleInputChange}
                    placeholder="Ex: 43.21-5-00"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Inscrição Estadual</label>
                  <input
                    type="text"
                    name="inscricaoEstadual"
                    value={form.inscricaoEstadual}
                    onChange={handleInputChange}
                    placeholder="Insira a IE se aplicável"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Inscrição Municipal</label>
                  <input
                    type="text"
                    name="inscricaoMunicipal"
                    value={form.inscricaoMunicipal}
                    onChange={handleInputChange}
                    placeholder="Insira a IM se aplicável"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Contador Responsável</label>
                  <input
                    type="text"
                    name="contadorResponsavel"
                    value={form.contadorResponsavel}
                    onChange={handleInputChange}
                    placeholder="Nome ou escritório de contabilidade"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Regime Tributário</label>
                  <select
                    name="regimeTributario"
                    value={form.regimeTributario}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  >
                    <option value="MEI">MEI</option>
                    <option value="Simples Nacional">Simples Nacional</option>
                    <option value="Lucro Presumido">Lucro Presumido</option>
                    <option value="Lucro Real">Lucro Real</option>
                  </select>
                </div>

              </div>
            </div>

            {/* Seção: Dados Bancários */}
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 lg:p-8 shadow-xl shadow-black/20 space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
                <div className="p-2.5 bg-violet-500/10 border border-violet-500/20 rounded-2xl text-violet-400">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Dados Bancários</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Informações financeiras, Pix e limites da conta empresarial.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nome do Banco</label>
                  <input
                    type="text"
                    name="nomeBanco"
                    value={form.nomeBanco}
                    onChange={handleInputChange}
                    placeholder="Ex: Itaú, Santander, Nubank"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Número da Conta PJ</label>
                  <input
                    type="text"
                    name="numeroContaPj"
                    value={form.numeroContaPj}
                    onChange={handleInputChange}
                    placeholder="Número da Conta com Dígito"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Agência</label>
                  <input
                    type="text"
                    name="agencia"
                    value={form.agencia}
                    onChange={handleInputChange}
                    placeholder="Código da Agência"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Chave Pix</label>
                  <input
                    type="text"
                    name="chavePix"
                    value={form.chavePix}
                    onChange={handleInputChange}
                    placeholder="CNPJ, E-mail, Celular ou Chave Aleatória"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Limite Bancário (R$)</label>
                  <input
                    type="number"
                    name="limiteBancario"
                    value={form.limiteBancario}
                    onChange={handleInputChange}
                    min="0"
                    placeholder="Ex: 50000"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Empréstimos Ativos</label>
                  <textarea
                    name="emprestimosAtivos"
                    value={form.emprestimosAtivos}
                    onChange={handleInputChange}
                    rows={4}
                    placeholder="Descreva quaisquer linhas de crédito em aberto, valores e prazos (ex: Capital de Giro BNDES - R$ 100.000,00 - 24 parcelas)"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>

              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3.5 bg-gray-900 hover:bg-gray-800 border border-gray-800 text-sm font-bold rounded-2xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-bold rounded-2xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Salvar Cadastro</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </main>
    </div>
  );
}

export default CadastroEmpresaPage;
