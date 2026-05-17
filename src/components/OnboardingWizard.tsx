import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { addXp } from '../lib/gamification';

export function OnboardingWizard() {
  const { user, profile, switchMode } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [modo, setModo] = useState<'pessoal' | 'empresarial'>('pessoal');
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<{ score: number; recomendacoes: string[] } | null>(null);

  // Form Data (Pessoal)
  const [rendaVenda, setRendaVenda] = useState('');
  const [dividasValor, setDividasValor] = useState('');
  const [temReserva, setTemReserva] = useState<boolean | null>(null);
  const [poupancaMensal, setPoupancaMensal] = useState('');
  const [objetivoDificuldade, setObjetivoDificuldade] = useState('organizar');
  const [usaCartao, setUsaCartao] = useState<boolean | null>(null);

  // Form Data (Empresarial)
  const [faturamentoMensal, setFaturamentoMensal] = useState('');
  const [numFuncionarios, setNumFuncionarios] = useState('');
  const [temCapitalGiro, setTemCapitalGiro] = useState<boolean | null>(null);
  const [dividasEmpresariais, setDividasEmpresariais] = useState('');
  const [margemLucroEstimada, setMargemLucroEstimada] = useState('');
  const [maiorDificuldade, setMaiorDificuldade] = useState('fluxo de caixa');
  const [usaSistemaContabil, setUsaSistemaContabil] = useState<boolean | null>(null);

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);

    const payload = modo === 'pessoal' ? {
      modo,
      rendaVenda: Number(rendaVenda),
      dividasValor: Number(dividasValor),
      temReserva,
      poupancaMensal: Number(poupancaMensal),
      objetivoDificuldade,
      usaCartao,
    } : {
      modo,
      faturamentoMensal: Number(faturamentoMensal),
      numFuncionarios: Number(numFuncionarios),
      temCapitalGiro,
      dividasEmpresariais: Number(dividasEmpresariais),
      margemLucroEstimada: Number(margemLucroEstimada),
      maiorDificuldade,
      usaSistemaContabil,
    };

    try {
      const res = await fetch('/api/diagnostico', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Falha na API de diagnóstico');
      const data = await res.json();
      
      // Salvar resultado no Firestore
      await setDoc(doc(db, 'diagnostico', user.uid), {
        respostas: payload,
        score: data.score,
        recomendacoes: data.recomendacoes,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      });

      // Gamification Reward: Diagnostic (+100 XP)
      await addXp(user.uid, 100);

      if (profile?.modo !== modo) {
        await switchMode(modo);
      }

      setResultado(data);
      setStep(3);
    } catch (err) {
      console.error(err);
      alert('Erro ao calcular diagnóstico');
    } finally {
      setLoading(false);
    }
  };

  const classification = (score: number) => {
    if (score < 200) return { label: 'Crítico', color: 'text-red-500' };
    if (score < 400) return { label: 'Regular', color: 'text-orange-500' };
    if (score < 600) return { label: 'Bom', color: 'text-yellow-500' };
    if (score < 800) return { label: 'Excelente', color: 'text-green-500' };
    return { label: 'Elite', color: 'text-indigo-500' };
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-3xl shadow-xl overflow-hidden p-8">
        
        {step === 1 && (
          <div className="space-y-6 text-center text-gray-800 dark:text-gray-100">
            <h1 className="text-3xl font-bold font-sans tracking-tight">Bem-vindo ao FinanceAI</h1>
            <p className="text-gray-500 dark:text-gray-400">Qual o foco da sua gestão financeira?</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
              <button
                onClick={() => setModo('pessoal')}
                className={`p-6 border-2 rounded-2xl flex flex-col items-center justify-center transition-all ${
                  modo === 'pessoal' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-400'
                }`}
              >
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-800 rounded-full flex items-center justify-center mb-4">
                  <span className="text-xl">👨💼</span>
                </div>
                <span className="font-semibold text-lg">Pessoal</span>
                <span className="text-sm text-gray-500 mt-2">Para minhas finanças em casa</span>
              </button>

              <button
                onClick={() => setModo('empresarial')}
                className={`p-6 border-2 rounded-2xl flex flex-col items-center justify-center transition-all ${
                  modo === 'empresarial' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30' : 'border-gray-200 dark:border-gray-700 hover:border-indigo-400'
                }`}
              >
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-800 rounded-full flex items-center justify-center mb-4">
                  <span className="text-xl">🏢</span>
                </div>
                <span className="font-semibold text-lg">Empresarial</span>
                <span className="text-sm text-gray-500 mt-2">Para meu próprio negócio</span>
              </button>
            </div>
            <button
              onClick={() => setStep(2)}
              className="mt-8 w-full bg-indigo-600 text-white font-medium py-3 rounded-xl hover:bg-indigo-700 transition"
            >
              Continuar
            </button>
          </div>
        )}

        {step === 2 && modo === 'pessoal' && (
          <div className="space-y-6 text-gray-800 dark:text-gray-100">
            <h2 className="text-2xl font-bold font-sans">Diagnóstico Pessoal</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Renda Mensal (R$)</label>
                <input type="number" value={rendaVenda} onChange={e => setRendaVenda(e.target.value)} className="w-full border dark:border-gray-700 dark:bg-gray-900 rounded-lg p-3" placeholder="Ex: 5000" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Valor das Dívidas Atuais (R$)</label>
                <input type="number" value={dividasValor} onChange={e => setDividasValor(e.target.value)} className="w-full border dark:border-gray-700 dark:bg-gray-900 rounded-lg p-3" placeholder="Ex: 1500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Possui reserva de emergência?</label>
                  <select value={temReserva === null ? '' : temReserva.toString()} onChange={e => setTemReserva(e.target.value === 'true')} className="w-full border dark:border-gray-700 dark:bg-gray-900 rounded-lg p-3">
                    <option value="" disabled>Selecione...</option>
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Usa cartão com frequência?</label>
                  <select value={usaCartao === null ? '' : usaCartao.toString()} onChange={e => setUsaCartao(e.target.value === 'true')} className="w-full border dark:border-gray-700 dark:bg-gray-900 rounded-lg p-3">
                    <option value="" disabled>Selecione...</option>
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Quanto quer economizar/mês (R$)</label>
                <input type="number" value={poupancaMensal} onChange={e => setPoupancaMensal(e.target.value)} className="w-full border dark:border-gray-700 dark:bg-gray-900 rounded-lg p-3" placeholder="Ex: 500" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Objetivo Principal</label>
                <select value={objetivoDificuldade} onChange={e => setObjetivoDificuldade(e.target.value)} className="w-full border dark:border-gray-700 dark:bg-gray-900 rounded-lg p-3">
                  <option value="quitar dívidas">Quitar dívidas</option>
                  <option value="comprar algo">Comprar algo</option>
                  <option value="investir">Começar a investir</option>
                  <option value="organizar">Me organizar melhor</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between mt-8 gap-4">
              <button onClick={() => setStep(1)} className="w-1/3 bg-gray-200 dark:bg-gray-700 font-medium py-3 rounded-xl transition">Voltar</button>
              <button disabled={loading} onClick={handleSubmit} className="w-2/3 bg-indigo-600 text-white font-medium py-3 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50">
                {loading ? 'Analisando perfil...' : 'Gerar Score'}
              </button>
            </div>
          </div>
        )}

        {step === 2 && modo === 'empresarial' && (
          <div className="space-y-6 text-gray-800 dark:text-gray-100">
            <h2 className="text-2xl font-bold font-sans">Diagnóstico Empresarial</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Faturamento Médio Mensal (R$)</label>
                <input type="number" value={faturamentoMensal} onChange={e => setFaturamentoMensal(e.target.value)} className="w-full border dark:border-gray-700 dark:bg-gray-900 rounded-lg p-3" placeholder="Ex: 50000" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Dívidas da Empresa (R$)</label>
                  <input type="number" value={dividasEmpresariais} onChange={e => setDividasEmpresariais(e.target.value)} className="w-full border dark:border-gray-700 dark:bg-gray-900 rounded-lg p-3" placeholder="Ex: 5000" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Nº de Funcionários</label>
                  <input type="number" value={numFuncionarios} onChange={e => setNumFuncionarios(e.target.value)} className="w-full border dark:border-gray-700 dark:bg-gray-900 rounded-lg p-3" placeholder="Ex: 3" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Possui Capital de Giro?</label>
                  <select value={temCapitalGiro === null ? '' : temCapitalGiro.toString()} onChange={e => setTemCapitalGiro(e.target.value === 'true')} className="w-full border dark:border-gray-700 dark:bg-gray-900 rounded-lg p-3">
                    <option value="" disabled>Selecione...</option>
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Usa Sistema Contábil?</label>
                  <select value={usaSistemaContabil === null ? '' : usaSistemaContabil.toString()} onChange={e => setUsaSistemaContabil(e.target.value === 'true')} className="w-full border dark:border-gray-700 dark:bg-gray-900 rounded-lg p-3">
                    <option value="" disabled>Selecione...</option>
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Margem de Lucro Estimada (%)</label>
                <input type="number" value={margemLucroEstimada} onChange={e => setMargemLucroEstimada(e.target.value)} className="w-full border dark:border-gray-700 dark:bg-gray-900 rounded-lg p-3" placeholder="Ex: 20" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Maior Dificuldade Atual</label>
                <select value={maiorDificuldade} onChange={e => setMaiorDificuldade(e.target.value)} className="w-full border dark:border-gray-700 dark:bg-gray-900 rounded-lg p-3">
                  <option value="fluxo de caixa">Manter fluxo de caixa positivo</option>
                  <option value="inadimplência">Clientes inadimplentes</option>
                  <option value="baixo lucro">Baixa margem de lucro</option>
                  <option value="crescimento">Dificuldade para crescer e investir</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between mt-8 gap-4">
              <button onClick={() => setStep(1)} className="w-1/3 bg-gray-200 dark:bg-gray-700 font-medium py-3 rounded-xl transition">Voltar</button>
              <button disabled={loading} onClick={handleSubmit} className="w-2/3 bg-indigo-600 text-white font-medium py-3 rounded-xl hover:bg-indigo-700 transition disabled:opacity-50">
                {loading ? 'Analisando negócio...' : 'Gerar Score'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && resultado && (
          <div className="space-y-8 flex flex-col items-center">
            <h2 className="text-3xl font-bold font-sans text-center dark:text-white">Seu Diagnóstico</h2>
            
            {/* Animated Gauge placeholder mapping */}
            <div className="relative w-48 h-48 rounded-full border-[16px] border-indigo-100 dark:border-gray-700 flex items-center justify-center shadow-inner">
              <div 
                className={`absolute inset-0 rounded-full border-[16px] ${resultado.score > 500 ? 'border-t-indigo-600 border-r-indigo-600 border-b-transparent border-l-transparent' : 'border-t-orange-500 border-r-transparent border-b-transparent border-l-transparent'} rotate-45 transform transition-all duration-1000`} 
              />
              <div className="text-center z-10 flex flex-col items-center">
                <span className="text-4xl font-extrabold text-gray-900 dark:text-white">{resultado.score}</span>
                <span className={`text-sm font-bold uppercase tracking-wider ${classification(resultado.score).color}`}>
                  {classification(resultado.score).label}
                </span>
              </div>
            </div>

            <div className="w-full space-y-4">
              <h3 className="font-semibold text-xl dark:text-white mt-6">Plano de Ação Inteligente</h3>
              <ul className="space-y-3">
                {resultado.recomendacoes.map((rec, i) => (
                  <li key={i} className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl flex border border-indigo-100 dark:border-indigo-800">
                    <span className="text-indigo-600 dark:text-indigo-400 font-bold mr-3">{i + 1}.</span>
                    <span className="text-gray-800 dark:text-gray-200">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => navigate('/dashboard')}
              className="mt-8 w-full bg-indigo-600 text-white font-medium py-4 rounded-xl hover:bg-indigo-700 transition shadow-lg"
            >
              Ir para o Meu Dashboard
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
