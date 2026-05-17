import React, { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebaseConfig';
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

export function Dashboard() {
  const { user, profile, signOut, switchMode } = useAuth();
  const { checkAccess, plan } = usePlan();
  const navigate = useNavigate();

  const [transacoes, setTransacoes] = useState<any[]>([]);
  const [metas, setMetas] = useState<any[]>([]);
  const [diagnostico, setDiagnostico] = useState<any>(null);
  const [empresarial, setEmpresarial] = useState<any>(null);
  const [periodo, setPeriodo] = useState<30 | 60 | 90>(30);

  useEffect(() => {
    if (!user) return;
    
    if (localStorage.getItem('mock_user')) {
      // Use mock data
      setTransacoes([
        { id: '1', tipo: 'receita', valor: 8500, descricao: 'Salário Mock', data: new Date().toISOString(), categoria: 'Renda Fixa' },
        { id: '2', tipo: 'despesa', valor: 2500, descricao: 'Aluguel', data: new Date().toISOString(), categoria: 'Moradia' },
        { id: '3', tipo: 'despesa', valor: 450, descricao: 'Mercado', data: new Date().toISOString(), categoria: 'Alimentação' },
      ]);
      setMetas([
        { id: 'm1', titulo: 'Viagem', progresso: 50, status: 'ativa', valorAlvo: 5000, progressoAtual: 2500 }
      ]);
      setDiagnostico({ scoreFinancas: 850, perfil: 'Conservador' });
      return;
    }

    // Transações Realtime
    const qTransacoes = query(collection(db, `transacoes/${user.uid}/items`), orderBy('data', 'desc'));
    const unsubTrans = onSnapshot(qTransacoes, (snapshot) => {
      setTransacoes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Metas Realtime
    const qMetas = query(collection(db, `metas/${user.uid}/lista`));
    const unsubMetas = onSnapshot(qMetas, (snapshot) => {
      setMetas(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Diagnóstico Realtime
    const unsubDiag = onSnapshot(doc(db, 'diagnostico', user.uid), (doc) => {
      if (doc.exists()) setDiagnostico(doc.data());
    });

    // Empresarial Realtime
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
     // Request mock background alert processing upon opening dashboard (Simulation of Daily Cron)
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

      const token = await user?.getIdToken();
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

  // Cálculos Básicos
  const receitas = transacoes.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + t.valor, 0);
  const despesas = transacoes.filter(t => t.tipo === 'despesa').reduce((acc, t) => acc + Math.abs(t.valor), 0);
  const saldoAtual = receitas - despesas;
  const margemLiquida = receitas > 0 ? ((receitas - despesas) / receitas) * 100 : 0;

  // Cálculos de Gráfico (mock agrupado por dia)
  const chartData = transacoes
    .slice(0, 10).reverse() // fallback para visualização
    .map((t, idx) => ({
      data: new Date(t.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      saldo: saldoAtual - idx * 100 // mock simples para ter variação visual no gráfico
    }));

  // Top Despesas (Pie Chart)
  const despesasPorCategoria = transacoes
    .filter(t => t.tipo === 'despesa')
    .reduce((acc: any, t) => {
      acc[t.categoria] = (acc[t.categoria] || 0) + Math.abs(t.valor);
      return acc;
    }, {});
    
  const pieData = Object.keys(despesasPorCategoria)
    .map(key => ({ name: key, value: despesasPorCategoria[key] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3); // top 3

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200">
      
      {/* HEADER */}
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
                  <HeaderXPBar xp={profile.xp} />
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
        {/* Progress Bar (XP Demo) */}
        <div className="w-full h-1 bg-gray-200 dark:bg-gray-700">
          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500" style={{ width: '65%' }}></div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* TOP ROW: Score & Resumo Geral */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Card Score Gauage */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4">
              <Activity className="w-5 h-5 text-indigo-400 opacity-50"/>
            </div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">Seu Score Financeiro</h3>
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-gray-200 dark:text-gray-700"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="currentColor" strokeWidth="3"
                />
                <path
                  className="text-indigo-500"
                  strokeDasharray={`${(diagnostico?.score || 0) / 10}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none" stroke="currentColor" strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                  {diagnostico?.score || '--'}
                </span>
              </div>
            </div>
          </div>

          {/* Resumo Cards */}
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

        {/* Notificações Inteligentes */}
        {alertasFlash.map((alerta, idx) => (
          <div key={idx} className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-4 flex items-start space-x-3 mt-4">
            <AlertCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">Alerta Inteligente (Groq AI)</h4>
              <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
                "{alerta}"
              </p>
            </div>
          </div>
        ))}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Gráfico Principal */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg tracking-tight">Fluxo de Caixa</h3>
              <div className="flex space-x-2">
                {[30, 60, 90].map((d) => (
                  <button 
                    key={d} 
                    onClick={() => setPeriodo(d as any)}
                    className={`text-xs px-3 py-1 rounded-full font-medium transition ${periodo === d ? 'bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
                  >
                    {d} dias
                  </button>
                ))}
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                  <XAxis dataKey="data" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dx={-10} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line type="monotone" dataKey="saldo" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex justify-end">
              <button 
                onClick={() => navigate('/importar')}
                className="flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition"
              >
                <Upload className="w-4 h-4 mr-2" />
                Importar Extrato (IA)
              </button>
            </div>
          </div>

          {/* Cards Específicos do Modo (Coluna Direita) */}
          <div className="space-y-6">
            
            {/* Metas Ativas (Comum) */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-lg mb-4 tracking-tight flex items-center">
                <Target className="w-5 h-5 mr-2 text-indigo-500" />
                Metas Ativas
              </h3>
              <div className="space-y-4">
                {metas.slice(0,2).map((m: any) => {
                  const perc = Math.min((m.valorAtual / m.valorAlvo) * 100, 100);
                  return (
                    <div key={m.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700 dark:text-gray-300">{m.titulo}</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">{perc.toFixed(0)}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${perc}%` }}></div>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">R$ {m.valorAtual} de R$ {m.valorAlvo}</div>
                    </div>
                  );
                })}
                {metas.length === 0 && <p className="text-sm text-gray-500">Nenhuma meta ativa.</p>}
              </div>
            </div>

            {/* Painel Específico - Pessoal */}
            {isPessoal && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <h3 className="font-bold text-lg mb-4 tracking-tight">Top Despesas</h3>
                <div className="h-48 w-full relative">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
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

            {/* Painel Específico - Empresarial */}
            {!isPessoal && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
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
