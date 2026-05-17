import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebaseConfig';
import { getAuth } from 'firebase/auth';
import { collection, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  ArrowUpCircle, ArrowDownCircle, DollarSign, TrendingUp, AlertCircle, 
  Target, Upload, User, Briefcase, Star, LogOut, Activity, Download
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { HeaderXPBar } from './HeaderXPBar';
import { usePlan } from '../hooks/usePlan';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

// Subcomponentes Exportados para reuso no Dashboard novo (src/pages/Dashboard.tsx)
export function ScoreGauge({ score }: { score?: number | string }) {
  const numericScore = Number(score) || 0;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center relative overflow-hidden group hover:border-indigo-500/50 transition-all duration-300">
      <div className="absolute top-0 right-0 p-4">
        <Activity className="w-5 h-5 text-indigo-400 opacity-50 group-hover:scale-110 transition-transform"/>
      </div>
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 tracking-wider uppercase mb-3">Seu Score Financeiro</h3>
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
          <path
            className="text-gray-100 dark:text-gray-700/60"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none" stroke="currentColor" strokeWidth="3.5"
          />
          <path
            className="text-indigo-500 transition-all duration-1000 ease-out"
            strokeDasharray={`${numericScore / 10}, 100`}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none" stroke="currentColor" strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {score || '--'}
          </span>
          <span className="text-[10px] font-semibold text-indigo-400 mt-0.5 uppercase tracking-wider">
            {numericScore > 700 ? 'Excelente' : numericScore > 500 ? 'Bom' : 'Regular'}
          </span>
        </div>
      </div>
    </div>
  );
}

export function AlertasInteligentes({ alertas }: { alertas: string[] }) {
  if (!alertas || alertas.length === 0) return null;
  return (
    <div className="space-y-3 my-4">
      {alertas.map((alerta, idx) => (
        <div key={idx} className="bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/60 rounded-3xl p-5 flex items-start space-x-3.5 shadow-sm">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400 flex-shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-200 tracking-tight">Alerta Inteligente (Groq AI)</h4>
            <p className="text-xs text-indigo-700 dark:text-indigo-300/90 mt-1 leading-relaxed">
              "{alerta}"
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CashFlowChart({ chartData, periodo, setPeriodo, onImport }: { chartData: any[]; periodo: number; setPeriodo: (p: any) => void; onImport: () => void; }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 lg:p-8 shadow-xl shadow-black/20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h3 className="font-bold text-lg tracking-tight text-gray-900 dark:text-white">Fluxo de Caixa</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Evolução do saldo da conta nos últimos {periodo} dias</p>
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-800/80 p-1 rounded-2xl border border-gray-200 dark:border-gray-700/60">
          {[30, 60, 90].map((d) => (
            <button 
              key={d} 
              onClick={() => setPeriodo(d as any)}
              className={`text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all ${periodo === d ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              {d} dias
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-[300px] w-full overflow-hidden pt-4">
        <ResponsiveContainer width="99%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.15} />
            <XAxis dataKey="data" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} dx={-10} tickFormatter={(val) => `R$ ${val}`} />
            <RechartsTooltip 
              formatter={(val: any) => [`R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Saldo']}
              contentStyle={{ backgroundColor: '#111827', borderRadius: '16px', border: '1px solid #374151', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.3)' }}
              labelStyle={{ color: '#9ca3af', fontWeight: 600, marginBottom: '4px' }}
            />
            <Line type="monotone" dataKey="saldo" stroke="#4f46e5" strokeWidth={3.5} dot={{ r: 4, strokeWidth: 2, fill: '#4f46e5' }} activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800/80 flex justify-end">
        <button 
          onClick={onImport}
          className="flex items-center text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors py-2 px-4 rounded-xl hover:bg-indigo-500/10"
        >
          <Upload className="w-4 h-4 mr-2" />
          <span>Importar Extrato com IA</span>
        </button>
      </div>
    </div>
  );
}

export function MetasAtivasResumo({ metas }: { metas: any[] }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 lg:p-8 shadow-xl shadow-black/20">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-lg tracking-tight text-gray-900 dark:text-white flex items-center">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400 mr-3">
            <Target className="w-5 h-5" />
          </div>
          <span>Metas Ativas</span>
        </h3>
        <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-500 dark:text-gray-400">
          {metas.length} em andamento
        </span>
      </div>
      <div className="space-y-5">
        {metas.slice(0, 3).map((m: any) => {
          const valorAtual = Number(m.progressoAtual || m.valorAtual || 0);
          const valorAlvo = Number(m.valorAlvo || 1);
          const perc = Math.min((valorAtual / valorAlvo) * 100, 100);
          return (
            <div key={m.id} className="group">
              <div className="flex justify-between text-sm mb-1.5 text-gray-700 dark:text-gray-300">
                <span className="font-semibold group-hover:text-indigo-400 transition-colors">{m.titulo}</span>
                <span className="text-indigo-600 dark:text-indigo-400 font-bold">{perc.toFixed(0)}%</span>
              </div>
              <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden p-0.5 border border-gray-200 dark:border-gray-700/60">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-1000 ease-out shadow-sm" style={{ width: `${perc}%` }}></div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 flex justify-between font-medium">
                <span>Acumulado: R$ {valorAtual.toLocaleString('pt-BR')}</span>
                <span>Meta: R$ {valorAlvo.toLocaleString('pt-BR')}</span>
              </div>
            </div>
          );
        })}
        {metas.length === 0 && (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400 text-xs font-medium bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
            Nenhuma meta ativa cadastrada no momento.
          </div>
        )}
      </div>
    </div>
  );
}

export function Dashboard() {
  const { user, profile, signOut, switchMode } = useAuth();
  const { checkAccess } = usePlan();
  const navigate = useNavigate();

  const [transacoes, setTransacoes] = useState<any[]>([]);
  const [metas, setMetas] = useState<any[]>([]);
  const [diagnostico, setDiagnostico] = useState<any>(null);
  const [empresarial, setEmpresarial] = useState<any>(null);
  const [periodo, setPeriodo] = useState<30 | 60 | 90>(30);

  useEffect(() => {
    if (!user) return;

    const qTransacoes = query(collection(db, `transacoes/${user.uid}/items`), orderBy('data', 'desc'));
    const unsubTrans = onSnapshot(qTransacoes, (snapshot) => {
      setTransacoes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qMetas = query(collection(db, `metas/${user.uid}/items`));
    const unsubMetas = onSnapshot(qMetas, (snapshot) => {
      setMetas(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubDiag = onSnapshot(doc(db, 'diagnostico', user.uid), (doc) => {
      if (doc.exists()) setDiagnostico(doc.data());
    });

    const unsubEmp = onSnapshot(doc(db, 'empresarial', user.uid), (doc) => {
      if (doc.exists()) setEmpresarial(doc.data());
    });

    return () => {
      unsubTrans();
      unsubMetas();
      unsubDiag();
      unsubEmp();
    };
  }, [user]);

  const [alertasFlash, setAlertasFlash] = useState<string[]>([]);
  
  useEffect(() => {
     const generateAlerts = async () => {
       if (!user?.uid) return;
       try {
         const res = await fetch('/api/cron/alertas', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             userId: user.uid,
             transacoes: transacoes.slice(0, 30),
             metas: metas
           })
         });
         const data = await res.json();
         if (data.alertas && data.alertas.length > 0) {
           setAlertasFlash(data.alertas);
         }
       } catch (e) {
         console.error("Failed to fetch smart alerts:", e);
       }
     };

     if (transacoes.length > 0) {
       generateAlerts();
     }
  }, [user?.uid, transacoes.length, metas.length]);

  const handleDownloadPDF = async () => {
    if (!checkAccess('Pro', 'Relatórios PDF Exportáveis')) return;
    
    try {
      const receitasPDF = transacoes.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + t.valor, 0);
      const despesasPDF = transacoes.filter(t => t.tipo === 'despesa').reduce((acc, t) => acc + Math.abs(t.valor), 0);
      const balancoPDF = receitasPDF - despesasPDF;

      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/relatorio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receitas: receitasPDF.toFixed(2),
          despesas: despesasPDF.toFixed(2),
          balanco: balancoPDF.toFixed(2),
          metas: metas.filter(m => m.status === 'concluida').slice(0, 5),
          alertas: alertasFlash
        })
      });
      if (!res.ok) throw new Error('Falha ao gerar');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'relatorio.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch(e) {
      console.error(e);
      alert('Erro buscando PDF');
    }
  };

  if (!profile) return <div>Carregando...</div>;

  const isPessoal = profile.modo === 'pessoal';

  const receitas = transacoes.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + t.valor, 0);
  const despesas = transacoes.filter(t => t.tipo === 'despesa').reduce((acc, t) => acc + Math.abs(t.valor), 0);
  const saldoAtual = receitas - despesas;
  const margemLiquida = receitas > 0 ? ((receitas - despesas) / receitas) * 100 : 0;

  const chartData = transacoes
    .slice(0, 10).reverse()
    .map((t, idx) => ({
      data: new Date(t.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      saldo: saldoAtual - idx * 100
    }));

  const despesasPorCategoria = transacoes
    .filter(t => t.tipo === 'despesa')
    .reduce((acc: any, t) => {
      acc[t.categoria] = (acc[t.categoria] || 0) + Math.abs(t.valor);
      return acc;
    }, {});
    
  const pieData = Object.keys(despesasPorCategoria)
    .map(key => ({ name: key, value: despesasPorCategoria[key] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold shadow-lg">
              {profile.nome.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Olá, {profile.nome}</h2>
              <div className="flex items-center space-x-3 text-sm">
                <span className="flex items-center text-gray-500 dark:text-gray-400">
                  {isPessoal ? <User className="w-4 h-4 mr-1"/> : <Briefcase className="w-4 h-4 mr-1"/>}
                  Modo {isPessoal ? 'Pessoal' : 'Empresarial'}
                </span>
                <span className="text-gray-300 dark:text-gray-600 hidden md:inline">|</span>
                <div className="hidden md:block w-48">
                  <HeaderXPBar xp={profile.xp || 0} />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button 
              onClick={handleDownloadPDF}
              className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-lg transition hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center"
            >
              <Download className="w-4 h-4 mr-2" /> PDF
            </button>
            <button 
              onClick={() => navigate('/metas')}
              className="px-4 py-2 text-sm font-medium border border-indigo-200 text-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400 rounded-lg transition hover:bg-indigo-100"
            >
              <Target className="w-4 h-4 inline mr-1 -mt-0.5" />
              Metas
            </button>
            <button 
              onClick={() => navigate('/simulador')}
              className="px-4 py-2 text-sm font-medium border border-indigo-200 text-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400 rounded-lg transition"
            >
              Simulador IA
            </button>
            <button 
              onClick={() => switchMode(isPessoal ? 'empresarial' : 'pessoal')}
              className="px-4 py-2 text-sm font-medium border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              Trocar para {isPessoal ? 'Empresarial' : 'Pessoal'}
            </button>
            <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-500 transition">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="w-full h-1 bg-gray-200 dark:bg-gray-700">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: '65%' }}></div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <ScoreGauge score={diagnostico?.score} />

          <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center text-gray-500 mb-2">
                <DollarSign className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Saldo Atual</span>
              </div>
              <p className="text-2xl font-bold tracking-tight">R$ {saldoAtual.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center text-green-500 mb-2">
                <ArrowUpCircle className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Receita Mês</span>
              </div>
              <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">R$ {receitas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center text-red-500 mb-2">
                <ArrowDownCircle className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Despesa Mês</span>
              </div>
              <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">R$ {despesas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="flex items-center text-indigo-500 mb-2">
                <TrendingUp className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Margem Líquida</span>
              </div>
              <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{margemLiquida.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        <AlertasInteligentes alertas={alertasFlash} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <CashFlowChart chartData={chartData} periodo={periodo} setPeriodo={setPeriodo} onImport={() => navigate('/importar')} />
          </div>

          <div className="space-y-6">
            <MetasAtivasResumo metas={metas} />

            {isPessoal && (
              <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="font-bold text-lg mb-4 tracking-tight">Top Despesas</h3>
                <div className="min-h-[300px] w-full overflow-hidden relative">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="99%" height={300}>
                      <PieChart>
                        <Pie data={pieData} innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                          {pieData.map((e, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                     <div className="flex items-center justify-center h-full text-sm text-gray-500">Sem dados suficientes</div>
                  )}
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
                   <div className="flex justify-between text-sm">
                     <span className="text-gray-500">Taxa de Poupança (Est.)</span>
                     <span className="font-bold text-green-500">22%</span>
                   </div>
                   <div className="flex justify-between text-sm">
                     <span className="text-gray-500">Dívida / Renda</span>
                     <span className="font-bold text-red-500">14%</span>
                   </div>
                   <div className="flex justify-between text-sm">
                     <span className="text-gray-500">Projeção 3 Meses</span>
                     <span className="font-bold text-indigo-500">+ R$ 4.500</span>
                   </div>
                </div>
              </div>
            )}

            {!isPessoal && (
              <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="font-bold text-lg mb-4 tracking-tight">Métricas (Empresa)</h3>
                
                <div className="space-y-4">
                   <div>
                     <div className="flex justify-between text-sm mb-1">
                       <span className="text-gray-500 font-medium">Margem Bruta</span>
                       <span className="font-bold">45%</span>
                     </div>
                   </div>
                   <div>
                     <div className="flex justify-between text-sm mb-1">
                       <span className="text-gray-500 font-medium">Ponto de Equilíbrio</span>
                       <span className="font-bold">Dia 18</span>
                     </div>
                   </div>
                   <div>
                     <div className="flex justify-between text-sm mb-1">
                       <span className="text-gray-500 font-medium">Inadimplência (Est.)</span>
                       <span className="font-bold text-red-500">4.2%</span>
                     </div>
                   </div>
                   <div>
                     <div className="flex justify-between text-sm mb-1">
                       <span className="text-gray-500 font-medium">EBITDA Estimado</span>
                       <span className="font-bold text-green-500">R$ {(empresarial?.faturamento || 25000) * 0.2}</span>
                     </div>
                   </div>
                   <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                     <div className="flex justify-between text-sm">
                       <span className="text-gray-500 font-medium">Capital de Giro</span>
                       <span className="font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">R$ {empresarial?.capitalDeGiro || '15.000'}</span>
                     </div>
                   </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
