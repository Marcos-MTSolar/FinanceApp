import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { Activity, AlertCircle, AlertTriangle, Briefcase, Check, CheckCircle, CheckSquare, CreditCard, FileCheck, FileText, Info, LayoutDashboard, Loader2, LogOut, Menu, MessageCircle, Network, Percent, PiggyBank, Plus, RefreshCw, Scale, Shield, Tag, Target, Trash2, TrendingUp, Trophy, Upload, Users, X } from 'lucide-react';

interface BankTransaction {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  tipo: 'receita' | 'despesa';
  categoria?: string;
  reconciledId?: string; // matched internal transaction ID
}

interface InternalTransaction {
  id: string;
  descricao: string;
  valor: number;
  data: string;
  tipo: 'receita' | 'despesa';
  categoria?: string;
  conciliado?: boolean;
}

export function ConciliacaoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [user, setUser] = useState(auth.currentUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // File loading state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStep, setUploadStep] = useState<'upload' | 'processing' | 'reconciling'>('upload');
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Transactions lists
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [internalTransactions, setInternalTransactions] = useState<InternalTransaction[]>([]);
  const [loadingInternal, setLoadingInternal] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => setUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    if (profile && profile.modo !== 'empresarial') {
      navigate('/dashboard');
    }
  }, [profile, navigate]);

  // Load internal transactions of the business
  useEffect(() => {
    if (!user?.uid || uploadStep !== 'reconciling') return;
    setLoadingInternal(true);
    const q = collection(db, `transacoes/${user.uid}/items`);
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(t => t.modo === 'empresarial')
        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      
      setInternalTransactions(list);
      setLoadingInternal(false);
    }, () => setLoadingInternal(false));

    return unsub;
  }, [user?.uid, uploadStep]);

  // File change handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('O arquivo não pode exceder 10MB.');
      return;
    }

    setErrorMsg('');
    setUploadStep('processing');
    setProgressMsg(`Analisando extrato: ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append('file', file);

      setProgressMsg('Extraindo transações com Inteligência Artificial...');
      const token = await user?.getIdToken();
      const res = await fetch('/api/ia/classificar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        throw new Error(`Erro de processamento no servidor (HTTP ${res.status}).`);
      }

      if (!res.ok) throw new Error(data.error || `Erro HTTP ${res.status}`);

      if (!data.transacoes || data.transacoes.length === 0) {
        throw new Error('Nenhuma transação identificada no extrato.');
      }

      const parsed: BankTransaction[] = data.transacoes.map((t: any, i: number) => ({
        id: `bank_${i}_${Date.now()}`,
        descricao: t.descricao,
        valor: Number(t.valor) || 0,
        data: t.data,
        tipo: t.tipo || 'despesa',
        categoria: t.categoria
      }));

      setBankTransactions(parsed);
      setUploadStep('reconciling');
      toast.success('Extrato importado com sucesso!');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Ocorreu um erro ao processar o extrato.');
      setUploadStep('upload');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Compare bank and internal transactions (Tolerance: +/- 1 day, same absolute amount & type)
  const getComparisonResults = () => {
    const matchedBankIds = new Set<string>();
    const matchedInternalIds = new Set<string>();

    const matches: { bank: BankTransaction; internal: InternalTransaction }[] = [];
    const statementOnly: BankTransaction[] = [];
    const internalOnly: InternalTransaction[] = [];

    // Helper to calculate days diff
    const getDaysDifference = (d1: string, d2: string) => {
      const date1 = new Date(d1);
      const date2 = new Date(d2);
      const diffTime = Math.abs(date2.getTime() - date1.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // Find automatic matches
    bankTransactions.forEach(bt => {
      // Find a matching internal transaction
      const matchedIt = internalTransactions.find(it => {
        if (matchedInternalIds.has(it.id)) return false;
        
        const isSameAmount = Math.abs(bt.valor) === Math.abs(it.valor);
        const isSameType = bt.tipo === it.tipo;
        const isCloseDate = getDaysDifference(bt.data, it.data) <= 1;

        return isSameAmount && isSameType && isCloseDate;
      });

      if (matchedIt) {
        matchedBankIds.add(bt.id);
        matchedInternalIds.add(matchedIt.id);
        matches.push({ bank: bt, internal: matchedIt });
      }
    });

    // Separates unmatched
    bankTransactions.forEach(bt => {
      if (!matchedBankIds.has(bt.id)) {
        statementOnly.push(bt);
      }
    });

    internalTransactions.forEach(it => {
      if (!matchedInternalIds.has(it.id)) {
        internalOnly.push(it);
      }
    });

    return { matches, statementOnly, internalOnly };
  };

  const { matches, statementOnly, internalOnly } = getComparisonResults();

  // Manual reconciliation handler
  const handleToggleReconciliation = async (transactionId: string, currentStatus: boolean) => {
    if (!user?.uid) return;
    try {
      await updateDoc(doc(db, `transacoes/${user.uid}/items`, transactionId), {
        conciliado: !currentStatus
      });
      toast.success(currentStatus ? 'Lançamento desmarcado como conciliado.' : 'Lançamento marcado como conciliado! ✔️');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao conciliar transação.');
    }
  };

  // Launch a statement transaction directly into Firestore
  const handleQuickLaunch = async (bt: BankTransaction) => {
    if (!user?.uid) return;
    try {
      await addDoc(collection(db, `transacoes/${user.uid}/items`), {
        descricao: bt.descricao,
        valor: Math.abs(bt.valor),
        data: bt.data,
        categoria: bt.categoria || 'Outros',
        tipo: bt.tipo,
        modo: 'empresarial',
        origem: 'conciliacao',
        conciliado: true,
        userId: user.uid,
        criadoEm: serverTimestamp()
      });
      toast.success('Lançamento inserido e conciliado! 🚀');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao lançar transação.');
    }
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

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-950 text-white flex flex-col md:flex-row font-sans">
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
      <main className="flex-1 flex flex-col min-w-0 bg-gray-950 h-full overflow-y-auto">
        <header className="h-20 px-6 lg:px-10 border-b border-gray-900 flex items-center justify-between bg-gray-950/80 backdrop-blur-md sticky top-0 z-20">
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-indigo-400" />
            Conciliação Bancária
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

        <div className="flex-1 p-6 lg:p-10 max-w-7xl w-full mx-auto space-y-6">
          {uploadStep === 'upload' && (
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-8 lg:p-12 text-center max-w-2xl mx-auto space-y-6 shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white">Carregar Extrato Bancário</h2>
                <p className="text-xs text-gray-400 mt-1.5">
                  Faça o upload do extrato bancário oficial da sua empresa nos formatos PDF ou CSV.
                </p>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-800 hover:border-indigo-500 hover:bg-indigo-500/[0.02] rounded-2xl p-10 cursor-pointer transition-all flex flex-col items-center justify-center min-h-[220px]"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.csv"
                />
                <div className="bg-indigo-500/10 w-14 h-14 rounded-full flex items-center justify-center mb-4 text-indigo-400">
                  <Upload className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">Selecione o arquivo do extrato</h3>
                <p className="text-gray-500 text-xs max-w-xs">
                  Formatos aceitos: PDF ou CSV (tamanho máximo de 10MB)
                </p>

                {errorMsg && (
                  <div className="mt-4 flex items-center text-rose-400 bg-rose-500/10 px-4 py-2 border border-rose-500/20 rounded-xl text-xs font-semibold">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {uploadStep === 'processing' && (
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-12 text-center max-w-xl mx-auto shadow-xl flex flex-col items-center justify-center min-h-[300px]">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-6" />
              <h3 className="text-lg font-bold text-white mb-1">Lendo seu extrato...</h3>
              <p className="text-xs text-gray-400">{progressMsg}</p>
            </div>
          )}

          {uploadStep === 'reconciling' && (
            <div className="space-y-6">
              {/* Back to upload and stats summary */}
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                  <button
                    onClick={() => {
                      setUploadStep('upload');
                      setBankTransactions([]);
                    }}
                    className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-xs font-bold rounded-xl transition border border-gray-700/60"
                  >
                    Carregar Outro Extrato
                  </button>
                  <div className="text-xs text-gray-400 flex items-center gap-2">
                    <Info className="w-4 h-4 text-indigo-400" />
                    <span>Período comparado: Tolerância automática de até 1 dia entre lançamentos.</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-2xl text-center">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Correspondidos</p>
                    <p className="text-lg font-bold text-emerald-400">{matches.length}</p>
                  </div>
                  <div className="bg-rose-500/10 border border-rose-500/20 px-3.5 py-2 rounded-2xl text-center">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Divergências</p>
                    <p className="text-lg font-bold text-rose-400">{statementOnly.length}</p>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 rounded-2xl text-center">
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Pendentes</p>
                    <p className="text-lg font-bold text-amber-400">{internalOnly.length}</p>
                  </div>
                </div>
              </div>

              {/* Grid with tables side by side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Column 1: Extrato Bancário */}
                <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl flex flex-col min-h-[500px]">
                  <div className="border-b border-gray-800 pb-4 mb-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <FileCheck className="w-5 h-5 text-indigo-400" />
                      Extrato Bancário (IA Extract)
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Transações identificadas no arquivo enviado.</p>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[600px]">
                    {bankTransactions.length === 0 ? (
                      <p className="text-xs text-gray-500 italic py-10 text-center">Nenhum lançamento no extrato.</p>
                    ) : (
                      bankTransactions.map(bt => {
                        const isMatched = matches.some(m => m.bank.id === bt.id);
                        return (
                          <div
                            key={bt.id}
                            className={`p-4 border rounded-2xl flex items-center justify-between transition-all ${
                              isMatched
                                ? 'bg-emerald-950/15 border-emerald-500/20 text-emerald-100'
                                : 'bg-rose-950/15 border-rose-500/20 text-rose-100'
                            }`}
                          >
                            <div className="min-w-0 pr-3">
                              <span className="text-[10px] font-mono font-bold bg-gray-950/50 border border-gray-800/80 px-2 py-0.5 rounded text-gray-400">
                                {formatDate(bt.data)}
                              </span>
                              <h4 className="font-bold text-sm text-white truncate mt-1.5">{bt.descricao}</h4>
                              <span className="text-[10px] text-gray-400">Tipo: {bt.tipo === 'receita' ? 'Crédito' : 'Débito'}</span>
                            </div>

                            <div className="flex items-center gap-3.5 flex-shrink-0">
                              <div className="text-right">
                                <p className={`font-bold text-sm ${bt.tipo === 'receita' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {bt.tipo === 'receita' ? '+' : '-'}{formatCurrency(bt.valor)}
                                </p>
                                <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border mt-1 inline-block ${
                                  isMatched
                                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                    : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                }`}>
                                  {isMatched ? 'Conciliado' : 'Divergente'}
                                </span>
                              </div>

                              {!isMatched && (
                                <button
                                  onClick={() => handleQuickLaunch(bt)}
                                  title="Lançar automaticamente no sistema"
                                  className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition text-xs font-bold flex items-center gap-1 shadow-md shadow-indigo-600/10"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Lançar</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Column 2: Lançamentos Internos */}
                <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl flex flex-col min-h-[500px]">
                  <div className="border-b border-gray-800 pb-4 mb-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-indigo-400" />
                      Lançamentos Internos (Firestore)
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">Movimentações cadastradas no sistema.</p>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[600px]">
                    {loadingInternal ? (
                      <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-indigo-500 animate-spin" /></div>
                    ) : internalTransactions.length === 0 ? (
                      <p className="text-xs text-gray-500 italic py-10 text-center">Nenhum lançamento no sistema.</p>
                    ) : (
                      internalTransactions.map(it => {
                        const isMatched = matches.some(m => m.internal.id === it.id);
                        const isManuallyConciliated = !!it.conciliado;

                        let styleClass = '';
                        let badgeText = '';
                        let badgeStyle = '';

                        if (isMatched) {
                          styleClass = 'bg-emerald-950/15 border-emerald-500/20 text-emerald-100';
                          badgeText = 'Conciliado';
                          badgeStyle = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
                        } else if (isManuallyConciliated) {
                          styleClass = 'bg-indigo-950/15 border-indigo-500/20 text-indigo-100';
                          badgeText = 'Conciliado (Man)';
                          badgeStyle = 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400';
                        } else {
                          styleClass = 'bg-amber-950/15 border-amber-500/20 text-amber-100';
                          badgeText = 'Pendente';
                          badgeStyle = 'bg-amber-500/10 border-amber-500/20 text-amber-400';
                        }

                        return (
                          <div
                            key={it.id}
                            className={`p-4 border rounded-2xl flex items-center justify-between transition-all ${styleClass}`}
                          >
                            <div className="min-w-0 pr-3">
                              <span className="text-[10px] font-mono font-bold bg-gray-950/50 border border-gray-800/80 px-2 py-0.5 rounded text-gray-400">
                                {formatDate(it.data)}
                              </span>
                              <h4 className="font-bold text-sm text-white truncate mt-1.5">{it.descricao}</h4>
                              <span className="text-[10px] text-gray-400">Categoria: {it.categoria || 'Outros'}</span>
                            </div>

                            <div className="flex items-center gap-3.5 flex-shrink-0">
                              <div className="text-right">
                                <p className={`font-bold text-sm ${it.tipo === 'receita' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {it.tipo === 'receita' ? '+' : '-'}{formatCurrency(it.valor)}
                                </p>
                                <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border mt-1 inline-block ${badgeStyle}`}>
                                  {badgeText}
                                </span>
                              </div>

                              {!isMatched && (
                                <button
                                  onClick={() => handleToggleReconciliation(it.id, isManuallyConciliated)}
                                  title={isManuallyConciliated ? 'Marcar como Pendente' : 'Marcar como Conciliado'}
                                  className={`p-2 rounded-xl transition ${
                                    isManuallyConciliated
                                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25'
                                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/10'
                                  }`}
                                >
                                  {isManuallyConciliated ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
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

export default ConciliacaoPage;
