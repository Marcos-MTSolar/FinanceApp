import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, onSnapshot, doc, serverTimestamp, writeBatch, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebaseConfig';
import { useAuth } from '../hooks/useAuth';
import { applyXpEvent } from '../lib/gamification';
import { Activity, Briefcase, Calendar, CheckSquare, CreditCard, DollarSign, FileText, LayoutDashboard, LogOut, Menu, MessageCircle, Network, Percent, PiggyBank, Plus, Repeat, Scale, Shield, Star, Tag, Target, Trash2, TrendingUp, Trophy, Upload, Users, X, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function RendaExtra() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const [user, setUser] = useState(auth.currentUser);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [rendas, setRendas] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form states
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [categoria, setCategoria] = useState('Freelance');
  const [recorrente, setRecorrente] = useState(false);
  const [frequencia, setFrequencia] = useState('Mensal');

  const categorias = ["Freelance", "Venda", "Comissão", "Aluguel", "Presente", "Outros"];

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  const userName = user?.displayName || user?.email?.split('@')[0] || profile?.nome || 'Usuário Demo';
  const userInitials = userName.substring(0, 2).toUpperCase();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Erro ao realizar logout:', error);
      navigate('/login');
    }
  };

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

  // Fetch data
  useEffect(() => {
    if (!user?.uid) return;
    
    const q = query(collection(db, `rendaExtra/${user.uid}/items`));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // Sort by date desc
      docs.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
      setRendas(docs);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !descricao || !valor || !data) return;

    try {
      const batch = writeBatch(db);
      const valNumber = Number(valor);

      // Create new Renda Extra ref
      const rendaRef = doc(collection(db, `rendaExtra/${user.uid}/items`));
      batch.set(rendaRef, {
        descricao,
        valor: valNumber,
        data,
        categoria,
        recorrente,
        frequencia: recorrente ? frequencia : null,
        userId: user.uid,
        criadoEm: serverTimestamp()
      });

      // Create new Transaction ref
      const transacaoRef = doc(collection(db, `transacoes/${user.uid}/items`));
      batch.set(transacaoRef, {
        descricao,
        valor: valNumber,
        tipo: 'receita',
        categoria,
        data,
        origem: 'renda_extra',
        rendaExtraId: rendaRef.id,
        userId: user.uid,
        modo: profile?.modo || 'pessoal',
        criadoEm: serverTimestamp()
      });

      await batch.commit();

      if (recorrente) {
        await applyXpEvent(user.uid, 'RENDA_EXTRA_RECORRENTE');
        toast.success('+20 XP! Renda recorrente registrada 🎉');
      } else {
        await applyXpEvent(user.uid, 'RENDA_EXTRA_UNICA');
        toast.success('+15 XP! Renda extra adicionada com sucesso 💰');
      }

      setIsModalOpen(false);
      
      // Reset form
      setDescricao('');
      setValor('');
      setData(new Date().toISOString().split('T')[0]);
      setCategoria('Freelance');
      setRecorrente(false);
      setFrequencia('Mensal');
      
    } catch (err) {
      console.error('Erro ao adicionar renda extra:', err);
      toast.error('Erro ao adicionar renda extra');
    }
  };

  const handleDelete = async (id: string) => {
    if (!user?.uid || !window.confirm('Excluir esta renda extra e a transação vinculada?')) return;
    
    try {
      const batch = writeBatch(db);

      // Remover a renda extra
      const rendaRef = doc(db, `rendaExtra/${user.uid}/items`, id);
      batch.delete(rendaRef);

      // Precisamos buscar a transação que tem esse rendaExtraId? 
      // Não temos o ID exato da transação, a menos que guardemos na renda, OU fazemos uma query antes.
      // Ops, query em batch não existe nativamente no delete, temos que fazer um get() primeiro.
      const { getDocs, where } = await import('firebase/firestore');
      const transQ = query(collection(db, `transacoes/${user.uid}/items`), where('rendaExtraId', '==', id));
      const transDocs = await getDocs(transQ);
      transDocs.forEach(d => {
        batch.delete(d.ref);
      });
      await batch.commit();
      toast.success('Renda removida com sucesso!');

    } catch (err) {
      console.error('Erro ao deletar:', err);
      toast.error('Erro ao deletar renda extra');
    }
  };

  // Calculations for Summary
  const mesAtual = new Date().getMonth();
  const anoAtual = new Date().getFullYear();
  
  const rendasMes = rendas.filter(r => {
    const d = new Date(r.data);
    return d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
  });

  const totalMes = rendasMes.reduce((acc, curr) => acc + Number(curr.valor), 0);
  const fontesAtivas = rendasMes.length;
  const maiorFonte = rendasMes.length > 0 ? rendasMes.reduce((prev, curr) => (curr.valor > prev.valor) ? curr : prev) : null;

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

      {/* Sidebar */}
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

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-gray-950">
        <header className="h-20 px-6 lg:px-10 border-b border-gray-900 flex items-center justify-between bg-gray-950/80 backdrop-blur-md sticky top-0 z-20">
          <div className="flex items-center gap-4 flex-1">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
               Rendas Extras
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl shadow-lg font-medium hover:opacity-90 transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
            <div className="hidden sm:flex items-center gap-3">
              <div className="flex flex-col text-right">
                <span className="text-sm font-semibold leading-tight text-white">{userName}</span>
                <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 justify-end">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  Conectado
                </span>
              </div>
              <button
                onClick={handleLogout}
                title="Sair"
                className="p-2.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-full transition-all group"
              >
                <LogOut className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 lg:p-10 max-w-7xl w-full mx-auto overflow-y-auto space-y-6 scroll-container">
          
          {/* Card Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center text-green-400">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-400 font-medium">Total Mês Atual</p>
                <p className="text-2xl font-bold text-white">R$ {totalMes.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-400 font-medium">Fontes Ativas</p>
                <p className="text-2xl font-bold text-white">{fontesAtivas}</p>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center text-amber-400">
                <Star className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm text-gray-400 font-medium">Maior Fonte</p>
                <p className="text-lg font-bold text-white leading-tight">{maiorFonte?.descricao || 'Nenhuma'}</p>
                {maiorFonte && <p className="text-xs text-green-400">R$ {Number(maiorFonte.valor).toLocaleString('pt-BR')}</p>}
              </div>
            </div>
          </div>

          {/* Lista */}
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 shadow-xl min-h-[400px]">
             <h3 className="text-lg font-bold text-white mb-6">Histórico de Rendas</h3>
             {loading ? (
               <div className="flex justify-center py-10"><p className="text-gray-500">Carregando...</p></div>
             ) : rendas.length === 0 ? (
               <div className="text-center py-12 bg-gray-950/50 rounded-2xl border border-gray-800/50 border-dashed">
                 <TrendingUp className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                 <p className="text-gray-400 font-medium">Nenhuma renda extra registrada</p>
               </div>
             ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {rendas.map((r) => (
                   <div key={r.id} className="bg-gray-950 border border-gray-800 rounded-2xl p-5 hover:border-indigo-500/30 transition-colors group relative">
                     <div className="flex justify-between items-start mb-3">
                       <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg">
                         {r.categoria}
                       </span>
                       {r.recorrente && (
                         <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg flex items-center gap-1 uppercase tracking-wider">
                           <Repeat className="w-3 h-3" /> {r.frequencia}
                         </span>
                       )}
                     </div>
                     <h4 className="font-bold text-gray-100 text-lg leading-tight mb-1">{r.descricao}</h4>
                     <p className="text-green-400 font-extrabold text-xl mb-4">
                       R$ {Number(r.valor).toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                     </p>
                     <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-800/60 pt-3">
                       <div className="flex items-center gap-1.5">
                         <Calendar className="w-3.5 h-3.5" />
                         {new Date(r.data).toLocaleDateString('pt-BR')}
                       </div>
                       <button 
                         onClick={() => handleDelete(r.id)}
                         className="opacity-0 group-hover:opacity-100 p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 rounded-lg transition-all"
                         title="Excluir Renda"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                     </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-md shadow-2xl p-6 lg:p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Nova Renda Extra</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white transition">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Descrição</label>
                <input 
                  type="text" required
                  placeholder="Ex: Freelance de design"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                  value={descricao} onChange={e => setDescricao(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Valor (R$)</label>
                  <input 
                    type="number" step="0.01" required
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                    value={valor} onChange={e => setValor(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Data</label>
                  <input 
                    type="date" required
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition [color-scheme:dark]"
                    value={data} onChange={e => setData(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Categoria</label>
                <select 
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  value={categoria} onChange={e => setCategoria(e.target.value)}
                >
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-between bg-gray-950/50 p-4 rounded-xl border border-gray-800">
                <span className="text-sm font-medium text-gray-300">É recorrente?</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={recorrente} onChange={e => setRecorrente(e.target.checked)} />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                </label>
              </div>

              {recorrente && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Frequência</label>
                  <select 
                    className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition"
                    value={frequencia} onChange={e => setFrequencia(e.target.value)}
                  >
                    <option value="Semanal">Semanal</option>
                    <option value="Mensal">Mensal</option>
                  </select>
                </div>
              )}

              <div className="pt-6">
                <button 
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg transition-all"
                >
                  Salvar Renda Extra
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default RendaExtra;
