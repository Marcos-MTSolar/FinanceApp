import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { Calculator, Target, TrendingUp, HelpCircle, Loader2 } from 'lucide-react';
import { usePlan } from '../hooks/usePlan';
import { useAuth } from '../hooks/useAuth';

export function Simulador() {
  const { user } = useAuth();
  const { plan, checkAccess } = usePlan();
  const [tipoSimulacao, setTipoSimulacao] = useState<'poupanca' | 'divida' | 'corte'>('poupanca');

  useEffect(() => {
    // Check if user has access when opening the page
    checkAccess('Pro', 'Simulador de Cenários');
  }, [plan]);
  
  // Variáveis Poupança
  const [objetivoPoupanca, setObjetivoPoupanca] = useState(10000);
  const [aporteMensal, setAporteMensal] = useState(500);
  const [taxaRenderMensal, setTaxaRenderMensal] = useState(0.8); // 0.8%

  // Variáveis Dívida
  const [valorDivida, setValorDivida] = useState(5000);
  const [parcelaDivida, setParcelaDivida] = useState(300);
  const [taxaJurosMensal, setTaxaJurosMensal] = useState(4.5);

  const [graficoData, setGraficoData] = useState<any[]>([]);
  const [explicacaoIA, setExplicacaoIA] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<any>(null);

  const simularPoupanca = () => {
    let saldo = 0;
    const data = [];
    let meses = 0;
    
    while (saldo < objetivoPoupanca && meses < 360) { // limite 30 anos
      saldo = saldo * (1 + (taxaRenderMensal / 100)) + aporteMensal;
      meses++;
      if (meses % 3 === 0 || saldo >= objetivoPoupanca) { // salva a cada trimestre pra não poluir gráfico
        data.push({ mes: `Mês ${meses}`, saldo: Math.round(saldo) });
      }
    }
    setResultados({ meses, totalInvestido: meses * aporteMensal, jurosGanhos: saldo - (meses * aporteMensal) });
    setGraficoData(data);
    return { meses, saldoFim: saldo };
  };

  const simularDivida = () => {
    let saldo = valorDivida;
    const data = [{ mes: 'Mês 0', divida: Math.round(saldo) }];
    let meses = 0;
    let totalPago = 0;

    while (saldo > 0 && meses < 120) { // limite 10 anos
      const juros = saldo * (taxaJurosMensal / 100);
      saldo = saldo + juros - parcelaDivida;
      totalPago += parcelaDivida;
      meses++;
      if (saldo < 0) {
        totalPago += saldo; // devolve o troco da última parcela
        saldo = 0;
      }
      if (meses % 2 === 0 || saldo === 0) {
        data.push({ mes: `Mês ${meses}`, divida: Math.round(saldo) });
      }
    }
    
    setResultados({ meses, totalPagoGeral: totalPago, jurosPagos: totalPago - valorDivida });
    setGraficoData(data);
    return { meses, totalPago };
  };

  const simular = async () => {
    setLoading(true);
    let resCalculo;
    let variables;
    let scenarioStr = '';

    if (tipoSimulacao === 'poupanca') {
      resCalculo = simularPoupanca();
      variables = { objetivo: objetivoPoupanca, aporteMensal, taxaRenderMensal };
      scenarioStr = "Quanto tempo levo para juntar dinheiro?";
    } else if (tipoSimulacao === 'divida') {
      resCalculo = simularDivida();
      variables = { valorDivida, parcelaDivida, taxaJurosMensal };
      scenarioStr = "Em quanto tempo quito minha dívida e quanto pagarei de juros?";
    }

    const token = await user?.getIdToken();
    try {
      const gRes = await fetch('/api/groq/simulador', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          scenario: scenarioStr,
          variables,
          results: resCalculo
        })
      });
      const data = await gRes.json();
      setExplicacaoIA(data.explicacao);
    } catch (e) {
      console.error(e);
      setExplicacaoIA("Não foi possível gerar análise inteligente no momento. Fique apenas com os gráficos gerados numericamente acima.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center space-x-3 mb-8">
        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/40 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <Calculator className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-bold font-sans tracking-tight text-gray-900 dark:text-white">Simulador de Cenários</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Projete seu futuro financeiro com inteligência artificial.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Formulário de Variáveis */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 space-y-6 flex flex-col">
          <div className="flex bg-gray-100 dark:bg-gray-900 rounded-xl p-1 font-medium text-sm">
             <button 
               onClick={() => { setTipoSimulacao('poupanca'); setGraficoData([]); setExplicacaoIA(''); setResultados(null); }}
               className={`flex-1 py-2 rounded-lg transition ${tipoSimulacao === 'poupanca' ? 'bg-white dark:bg-gray-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500'}`}
             >
               Investimento
             </button>
             <button 
               onClick={() => { setTipoSimulacao('divida'); setGraficoData([]); setExplicacaoIA(''); setResultados(null); }}
               className={`flex-1 py-2 rounded-lg transition ${tipoSimulacao === 'divida' ? 'bg-white dark:bg-gray-800 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-500'}`}
             >
               Dívidas
             </button>
          </div>

          {tipoSimulacao === 'poupanca' && (
            <div className="space-y-4 flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Qual é o seu objetivo? (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                  <input type="number" value={objetivoPoupanca} onChange={e => setObjetivoPoupanca(Number(e.target.value))} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Aporte Mensal (R$)</label>
                <div className="relative">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                   <input type="number" value={aporteMensal} onChange={e => setAporteMensal(Number(e.target.value))} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rentabilidade Mensal (%)</label>
                <div className="relative">
                  <input type="number" step="0.1" value={taxaRenderMensal} onChange={e => setTaxaRenderMensal(Number(e.target.value))} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Ex: Poupança ~0.5% | Tesouro Direto/CDB ~0.8 a 1.0%</p>
              </div>
            </div>
          )}

          {tipoSimulacao === 'divida' && (
            <div className="space-y-4 flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Valor Total da Dívida (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                  <input type="number" value={valorDivida} onChange={e => setValorDivida(Number(e.target.value))} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quanto quer pagar por mês? (R$)</label>
                <div className="relative">
                   <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                   <input type="number" value={parcelaDivida} onChange={e => setParcelaDivida(Number(e.target.value))} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Taxa de Juros Mensal (%)</label>
                <div className="relative">
                  <input type="number" step="0.1" value={taxaJurosMensal} onChange={e => setTaxaJurosMensal(Number(e.target.value))} className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Ex: Cartão de Crédito ~14% | Empréstimo Pessoal ~4%</p>
              </div>
            </div>
          )}

          <button 
            disabled={loading}
            onClick={simular} 
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium tracking-wide shadow-lg shadow-indigo-200 dark:shadow-none transition flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <TrendingUp className="w-5 h-5 mr-2" />}
            Gerar Simulação
          </button>
        </div>

        {/* Resultados */}
        <div className="col-span-1 lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 h-96">
            <h3 className="font-bold tracking-tight text-gray-900 dark:text-white mb-6">Projeção a termo</h3>
            
            {graficoData.length > 0 ? (
              <ResponsiveContainer width="100%" height="90%">
                <LineChart data={graficoData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} dx={-10} tickFormatter={(val) => `R$ ${val}`} width={80} />
                  <RechartsTooltip formatter={(value) => `R$ ${value}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Line type="monotone" dataKey={tipoSimulacao === 'poupanca' ? 'saldo' : 'divida'} stroke={tipoSimulacao === 'poupanca' ? '#10b981' : '#ef4444'} strokeWidth={4} dot={{ r: 0 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-400">
                Preencha as variáveis e clique em Gerar Simulação
              </div>
            )}
          </div>

          {(resultados || explicacaoIA) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Resultados Numéricos */}
              <div className="bg-gray-50 dark:bg-gray-900 rounded-3xl p-6 border border-gray-200 dark:border-gray-800">
                <h4 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center">
                  <Target className="w-5 h-5 mr-2 text-indigo-500" /> Resumo do Cálculo
                </h4>
                {tipoSimulacao === 'poupanca' && resultados && (
                   <ul className="space-y-3 font-medium text-gray-700 dark:text-gray-300">
                     <li className="flex justify-between"><span>Tempo estimado:</span> <span className="text-gray-900 dark:text-white font-bold">{Math.floor(resultados.meses / 12)} anos e {resultados.meses % 12} meses</span></li>
                     <li className="flex justify-between"><span>Total Investido:</span> <span>R$ {resultados.totalInvestido.toLocaleString('pt-BR')}</span></li>
                     <li className="flex justify-between"><span>Total Rendimentos (Juros):</span> <span className="text-green-500">+ R$ {Math.round(resultados.jurosGanhos).toLocaleString('pt-BR')}</span></li>
                   </ul>
                )}
                {tipoSimulacao === 'divida' && resultados && (
                   <ul className="space-y-3 font-medium text-gray-700 dark:text-gray-300">
                     <li className="flex justify-between"><span>Tempo para quitar:</span> <span className="text-gray-900 dark:text-white font-bold">{Math.floor(resultados.meses / 12)} anos e {resultados.meses % 12} meses</span></li>
                     <li className="flex justify-between"><span>Total a ser pago (com juros):</span> <span>R$ {Math.round(resultados.totalPagoGeral).toLocaleString('pt-BR')}</span></li>
                     <li className="flex justify-between"><span>Juros totais acumulados:</span> <span className="text-red-500">- R$ {Math.round(resultados.jurosPagos).toLocaleString('pt-BR')}</span></li>
                   </ul>
                )}
              </div>

              {/* Explicação IA */}
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl p-6 border border-indigo-100 dark:border-indigo-800">
                <h4 className="font-bold text-indigo-900 dark:text-indigo-200 mb-4 flex items-center">
                  <HelpCircle className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" /> Análise IA
                </h4>
                {loading ? (
                  <div className="h-full flex items-center text-indigo-400">
                     <Loader2 className="w-5 h-5 animate-spin mr-2" /> Gerando insights...
                  </div>
                ) : (
                  <p className="text-sm text-indigo-800 dark:text-indigo-300 leading-relaxed whitespace-pre-line">
                    {explicacaoIA}
                  </p>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
