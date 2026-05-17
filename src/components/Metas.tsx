import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebaseConfig';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import { Target, Trophy, Plus, CheckCircle, XCircle, Sparkles, Loader2, Play } from 'lucide-react';
import { addXp, getLevelInfo } from '../lib/gamification';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';

export function Metas() {
  const { user, profile } = useAuth();
  const [metas, setMetas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [levelUpMsg, setLevelUpMsg] = useState('');
  
  // Modal nova meta
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [novaMeta, setNovaMeta] = useState({ titulo: '', valorAlvo: '', prazo: '', categoria: 'Pessoal' });
  const [aiLoading, setAiLoading] = useState(false);

  const { width, height } = useWindowSize(); // for Confetti

  useEffect(() => {
    if (!user) return;
    
    if (localStorage.getItem('mock_user')) {
      setMetas([
        { id: 'm1', titulo: 'Viagem para a Praia', valorAlvo: 5000, progressoAtual: 2500, status: 'ativa', prazo: '2026-12-31', categoria: 'Pessoal' }
      ]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, `metas/${user.uid}/items`));
    const unsub = onSnapshot(q, (snap) => {
      setMetas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const sgIA = async () => {
    if (!user) return;
    setAiLoading(true);
    try {
      // Mocking diagnostico pull for demo, in real life we could grab docs like:
      // const dSnap = await getDocs(collection(db, 'diagnostico'));
      // For now let's just make the request.
      const token = await user?.getIdToken();
      const res = await fetch('/api/groq/sugerir-meta', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ diagnostico: { respostas: {} } }) // passed mocked or real diag
      });
      const data = await res.json();
      if (data.titulo) {
        setNovaMeta({ 
          ...novaMeta, 
          titulo: data.titulo, 
          valorAlvo: data.valorAlvo?.toString() || '1000'
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!user || !novaMeta.titulo) return;
    await addDoc(collection(db, `metas/${user.uid}/items`), {
      ...novaMeta,
      valorAlvo: Number(novaMeta.valorAlvo),
      progressoAtual: 0,
      status: 'ativa',
      criadoEm: serverTimestamp()
    });
    setIsModalOpen(false);
    setNovaMeta({ titulo: '', valorAlvo: '', prazo: '', categoria: 'Pessoal' });
  };

  const handleComplete = async (id: string) => {
    if (!user) return;
    await updateDoc(doc(db, `metas/${user.uid}/items`, id), {
      status: 'concluida',
      concluidoEm: serverTimestamp()
    });

    // Reward XP +500
    const xpResult = await addXp(user.uid, 500);

    setShowConfetti(true);
    if (xpResult?.leveledUp) {
      setLevelUpMsg(`Parabéns! Você alcançou o Nível ${xpResult.nivel}: ${xpResult.name}`);
    }
    
    setTimeout(() => {
      setShowConfetti(false);
      setLevelUpMsg('');
    }, 5000);
  };

  const handleAbandon = async (id: string) => {
    if (!user) return;
    await updateDoc(doc(db, `metas/${user.uid}/items`, id), {
      status: 'abandonada'
    });
  };

  const activeMetas = metas.filter(m => m.status === 'ativa');
  const pastMetas = metas.filter(m => m.status !== 'ativa');

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 relative">
      {showConfetti && <Confetti width={width} height={height} className="fixed top-0 left-0 z-50 pointer-events-none" />}
      
      {levelUpMsg && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-2xl animate-bounce border-4 border-yellow-400">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center">{levelUpMsg}</h2>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-center justify-between mb-8 space-y-4 md:space-y-0">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/40 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold font-sans tracking-tight text-gray-900 dark:text-white">Minhas Metas</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Gamifique seu sucesso financeiro</p>
          </div>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl shadow-md font-medium flex items-center hover:bg-indigo-700 transition"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nova Meta
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Criar Nova Meta</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            
            <button 
              onClick={sgIA}
              disabled={aiLoading}
              className="w-full mb-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-medium shadow-md shadow-indigo-200 dark:shadow-none transition flex justify-center items-center hover:opacity-90"
            >
              {aiLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Sparkles className="w-5 h-5 mr-2 text-yellow-300" />}
              {aiLoading ? 'Analisando perfil...' : 'Sugerir Meta com IA'}
            </button>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Título da Meta</label>
                <input 
                  type="text" 
                  value={novaMeta.titulo} 
                  onChange={e => setNovaMeta({...novaMeta, titulo: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white" 
                  placeholder="Ex: Quitar dívida do cartão" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor Alvo (R$)</label>
                <input 
                  type="number" 
                  value={novaMeta.valorAlvo} 
                  onChange={e => setNovaMeta({...novaMeta, valorAlvo: e.target.value})}
                  className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white" 
                />
              </div>
              <div className="flex space-x-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prazo (Data)</label>
                  <input 
                    type="date" 
                    value={novaMeta.prazo} 
                    onChange={e => setNovaMeta({...novaMeta, prazo: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white" 
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo</label>
                  <select 
                    value={novaMeta.categoria} 
                    onChange={e => setNovaMeta({...novaMeta, categoria: e.target.value})}
                    className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white" 
                  >
                    <option value="Pessoal">Pessoal</option>
                    <option value="Empresarial">Empresarial</option>
                  </select>
                </div>
              </div>
            </div>
            
            <button 
              onClick={handleCreate}
              className="w-full mt-8 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition"
            >
              Criar Meta
            </button>
          </div>
        </div>
      )}

      {/* List Active Goals */}
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Metas Ativas</h3>
      {loading ? (
         <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>
      ) : activeMetas.length === 0 ? (
         <div className="bg-white dark:bg-gray-800 rounded-3xl p-12 text-center shadow-sm border border-gray-100 dark:border-gray-700 mb-8">
           <Trophy className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
           <p className="text-gray-500 dark:text-gray-400">Você não possui metas ativas. Que tal criar uma agora?</p>
         </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {activeMetas.map(m => {
             const progressoPct = Math.min(100, Math.max(0, ((m.progressoAtual || 0) / (m.valorAlvo || 1)) * 100));
             return (
              <div key={m.id} className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-indigo-100 dark:border-gray-700 hover:shadow-lg transition">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-xs font-semibold px-2 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-md">
                      {m.categoria}
                    </span>
                    <h4 className="font-bold text-gray-900 dark:text-white mt-2 leading-tight">{m.titulo}</h4>
                  </div>
                  <Target className="w-5 h-5 text-indigo-400" />
                </div>
                
                <div className="space-y-1 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 font-medium tracking-tight">Progresso</span>
                    <span className="text-gray-900 dark:text-white font-bold">R$ {m.progressoAtual?.toLocaleString() || 0} / R$ {m.valorAlvo?.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000" style={{ width: `${progressoPct}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-2">
                    <span>{progressoPct.toFixed(0)}% concluído</span>
                    <span>Prazo: {m.prazo ? new Date(m.prazo).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>

                <div className="flex space-x-2 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button 
                    onClick={async () => {
                      const val = prompt('Quanto adicionar de progresso? (R$)', '100');
                      if (val && !isNaN(Number(val)) && user) {
                         const novoProg = (m.progressoAtual || 0) + Number(val);
                         await updateDoc(doc(db, `metas/${user.uid}/items`, m.id), { progressoAtual: novoProg });
                         if (novoProg >= m.valorAlvo) {
                           handleComplete(m.id);
                         }
                      }
                    }}
                    className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 dark:text-indigo-400 rounded-xl text-sm font-medium transition flex justify-center items-center"
                  >
                    + Adicionar
                  </button>
                  <button 
                    onClick={() => handleComplete(m.id)}
                    className="flex-1 py-2 bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-900/20 dark:hover:bg-green-900/40 dark:text-green-400 rounded-xl text-sm font-medium transition flex justify-center items-center"
                  >
                    <CheckCircle className="w-4 h-4 mr-1.5" /> Concluir (+500 XP)
                  </button>
                  <button 
                    onClick={() => handleAbandon(m.id)}
                    className="p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 rounded-xl transition"
                    title="Abandonar Meta"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pastMetas.length > 0 && (
        <>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Acompanhamento</h3>
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-left text-sm whitespace-nowrap">
               <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 py-2 border-b border-gray-100 dark:border-gray-700">
                 <tr>
                   <th className="px-6 py-3 font-semibold">Meta</th>
                   <th className="px-6 py-3 font-semibold">Valor Alvo</th>
                   <th className="px-6 py-3 font-semibold">Status</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                 {pastMetas.map(m => (
                   <tr key={m.id}>
                     <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{m.titulo}</td>
                     <td className="px-6 py-4 text-gray-500">R$ {m.valorAlvo?.toLocaleString()}</td>
                     <td className="px-6 py-4">
                       <span className={`px-2 py-1 text-xs font-semibold rounded-md ${
                         m.status === 'concluida' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                         : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                       }`}>
                         {m.status === 'concluida' ? 'Concluída' : 'Abandonada'}
                       </span>
                     </td>
                   </tr>
                 ))}
               </tbody>
            </table>
          </div>
        </>
      )}

    </div>
  );
}
