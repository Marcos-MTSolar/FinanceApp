import React, { useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebaseConfig';
import { getAuth } from 'firebase/auth';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { Upload, FileText, CheckCircle, AlertCircle, X, Loader2, Save } from 'lucide-react';
import * as XLSX from 'xlsx';
import Tesseract from 'tesseract.js';
import { addXp } from '../lib/gamification';
import { usePlan } from '../hooks/usePlan';

type ImportStep = 'upload' | 'processing' | 'preview' | 'success';

interface ImportedTransaction {
  id: string; // temp id for UI
  descricao: string;
  valor: number;
  data: string;
  categoria: string;
  tipo: 'receita' | 'despesa';
  recorrente: boolean;
}

const CATEGORIAS_VALIDAS = [
  'Alimentação', 'Transporte', 'Moradia', 'Saúde', 'Lazer', 
  'Assinatura', 'Investimento', 'Salário', 'Venda', 'Fornecedor', 'Imposto', 'Outros'
];

export function ImportData() {
  const { user, profile } = useAuth();
  const { plan, checkAccess } = usePlan();
  const [step, setStep] = useState<ImportStep>('upload');
  const [errorMsg, setErrorMsg] = useState('');
  const [transactions, setTransactions] = useState<ImportedTransaction[]>([]);
  const [progressMsg, setProgressMsg] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check plan limits (mock limit based on a local state or just check plan for the example)
    if (plan === 'Free') {
      const allowed = checkAccess('Pro', 'Importações Ilimitadas (Limite mensal atingido)');
      if (!allowed) {
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }
    
    // Check limit 10MB
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('O arquivo não pode exceder 10MB (Plano Free).');
      return;
    }
    
    setErrorMsg('');
    setStep('processing');
    setProgressMsg(`Analisando ${file.name}...`);
    
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const formData = new FormData();

      if (['jpg', 'jpeg', 'png'].includes(ext || '')) {
        setProgressMsg('Lendo nota fiscal de imagem (OCR)...');
        const worker = await Tesseract.createWorker("por");
        const ret = await worker.recognize(file);
        formData.append('textoBruto', ret.data.text);
        await worker.terminate();
      } else {
        setProgressMsg('Enviando documento seguro para análise...');
        formData.append('file', file);
      }

      setProgressMsg('Classificando com Inteligência Artificial...');
      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const classificarRes = await fetch('/api/ia/classificar', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}` 
        },
        body: formData
      });

      // Parse do JSON com fallback seguro — evita SyntaxError em respostas de erro (429, 500, etc.)
      let classificarData: any = {};
      try {
        classificarData = await classificarRes.json();
      } catch {
        throw new Error(`Erro do servidor (HTTP ${classificarRes.status}). Tente novamente.`);
      }
      
      if (!classificarRes.ok) throw new Error(classificarData.error || `Erro HTTP ${classificarRes.status}`);
      
      if (!classificarData.transacoes || classificarData.transacoes.length === 0) {
        throw new Error(
          'Nenhuma transação identificada. Verifique se o PDF é um extrato ' +
          'bancário com texto selecionável (não escaneado).'
        );
      }

      setTransactions(
        classificarData.transacoes.map((t: any, i: number) => ({
          id: `temp_${i}`,
          descricao: t.descricao,
          valor: Number(t.valor) || 0,
          data: t.data,
          categoria: t.categoria,
          tipo: t.tipo || 'despesa',
          recorrente: !!t.recorrente
        }))
      );
      setStep('preview');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Ocorreu um erro no processamento do arquivo.');
      setStep('upload');
      // Reset do input para permitir re-upload do mesmo arquivo sem precisar trocar de arquivo
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateTransaction = (id: string, field: keyof ImportedTransaction, value: any) => {
    setTransactions(prev => 
      prev.map(t => t.id === id ? { ...t, [field]: value } : t)
    );
  };

  const modo = (profile?.modo as 'pessoal' | 'empresarial') || 'pessoal';


  const handleSave = async () => {
    if (!user) return;
    const qtdParaSalvar = transactions.length;
    setStep('processing');
    setProgressMsg('Salvando transações na nuvem...');
    
    try {
      const batch = writeBatch(db);
      for (const t of transactions) {
        const docRef = doc(collection(db, `transacoes/${user.uid}/items`));
        batch.set(docRef, {
          descricao: t.descricao,
          valor: t.valor,
          data: t.data,
          categoria: t.categoria,
          tipo: t.tipo,
          recorrente: t.recorrente,
          modo,          // campo obrigatório para a query where('modo') funcionar
          origem: 'importado',
          userId: user.uid
        });
      }
      await batch.commit();

      // Gamification Reward: Importar extrato (+50 XP)
      await addXp(user.uid, 50);

      // Salva o contador ANTES de limpar as transações
      setSavedCount(qtdParaSalvar);
      setTransactions([]);
      setStep('success');
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Erro ao salvar as transações. Verifique sua conexão e tente novamente.');
      setStep('preview');
    }
  };

  const BadgeCategoria = ({ val }: { val: string }) => {
    let cores = 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    if (['Alimentação'].includes(val)) cores = 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    if (['Transporte'].includes(val)) cores = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    if (['Moradia'].includes(val)) cores = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
    if (['Saúde'].includes(val)) cores = 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    if (['Investimento', 'Salário', 'Venda'].includes(val)) cores = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';

    return <span className={`px-2 py-1 text-xs font-semibold rounded-md ${cores}`}>{val}</span>;
  };

  const totais = {
    receitas: transactions.filter(t => t.tipo === 'receita').reduce((acc, t) => acc + t.valor, 0),
    despesas: transactions.filter(t => t.tipo === 'despesa').reduce((acc, t) => acc + t.valor, 0),
    qtd: transactions.length
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Importação Inteligente</h2>
        <p className="text-gray-500 dark:text-gray-400">Classificação automática com IA baseada no seu documento.</p>
      </div>

      {step === 'upload' && (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 rounded-2xl p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[300px]"
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept=".pdf,.csv,.xlsx,.xls,.ofx,.jpg,.jpeg,.png"
          />
          <div className="bg-indigo-100 dark:bg-indigo-900/30 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Clique ou arraste seu arquivo aqui</h3>
          <p className="text-gray-500 text-sm max-w-md">
            Aceitamos Extratos em PDF, OFX, planilhas Excel/CSV ou Fotos (Notas Fiscais). Tamanho máximo 10MB.
          </p>
          
          {errorMsg && (
            <div className="mt-6 flex items-center text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg">
              <AlertCircle className="w-5 h-5 mr-2" />
              <span className="text-sm font-medium">{errorMsg}</span>
            </div>
          )}
        </div>
      )}

      {step === 'processing' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-6" />
          <h3 className="text-xl font-bold dark:text-white mb-2">Trabalhando no seu documento...</h3>
          <p className="text-gray-500 text-center">{progressMsg}</p>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
              <span className="text-sm font-medium text-gray-500 mb-1">Total Receitas</span>
              <span className="text-2xl font-bold text-green-600">R$ {totais.receitas.toFixed(2)}</span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
              <span className="text-sm font-medium text-gray-500 mb-1">Total Despesas</span>
              <span className="text-2xl font-bold text-red-600">R$ {totais.despesas.toFixed(2)}</span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col">
              <span className="text-sm font-medium text-gray-500 mb-1">Transações Identificadas</span>
              <span className="text-2xl font-bold text-indigo-600">{totais.qtd} itens</span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Data</th>
                    <th className="px-6 py-4 font-semibold w-1/3">Descrição (Editável)</th>
                    <th className="px-6 py-4 font-semibold">Tipo</th>
                    <th className="px-6 py-4 font-semibold">Valor</th>
                    <th className="px-6 py-4 font-semibold">Categoria</th>
                    <th className="px-6 py-4 font-semibold text-center">Recorrente</th>
                    <th className="px-6 py-4 font-semibold">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                      <td className="px-6 py-3">
                        <input 
                          type="date"
                          value={t.data || ''}
                          onChange={(e) => updateTransaction(t.id, 'data', e.target.value)}
                          className="bg-transparent text-gray-900 dark:text-white border-0 outline-none w-32 focus:ring-1 focus:ring-indigo-500 rounded px-1"
                        />
                      </td>
                      <td className="px-6 py-3">
                        <input 
                          type="text"
                          value={t.descricao}
                          onChange={(e) => updateTransaction(t.id, 'descricao', e.target.value)}
                          className="bg-transparent text-gray-900 dark:text-white border-0 outline-none w-full focus:ring-1 focus:ring-indigo-500 rounded px-1"
                        />
                      </td>
                      <td className="px-6 py-3">
                        <select 
                          value={t.tipo || 'despesa'}
                          onChange={(e) => updateTransaction(t.id, 'tipo', e.target.value)}
                          className={`bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-700 text-xs rounded-md focus:ring-indigo-500 focus:border-indigo-500 py-1 font-semibold ${
                            (t.tipo || 'despesa') === 'receita' ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'
                          }`}
                        >
                          <option value="receita">Receita</option>
                          <option value="despesa">Despesa</option>
                        </select>
                      </td>
                      <td className={`px-6 py-3 font-semibold ${t.tipo === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                        <div className="flex items-center">
                          <span className="mr-1">R$</span>
                          <input 
                            type="number"
                            value={t.valor}
                            onChange={(e) => updateTransaction(t.id, 'valor', Number(e.target.value))}
                            className="bg-transparent border-0 outline-none w-24 focus:ring-1 focus:ring-indigo-500 rounded px-1"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-3">
                        <select 
                          value={t.categoria}
                          onChange={(e) => updateTransaction(t.id, 'categoria', e.target.value)}
                          className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 py-1"
                        >
                          <option value="Sem Categoria">Selecione...</option>
                          {CATEGORIAS_VALIDAS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <input 
                          type="checkbox"
                          checked={t.recorrente || false}
                          onChange={(e) => updateTransaction(t.id, 'recorrente', e.target.checked)}
                          className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
                        />
                      </td>
                      <td className="px-6 py-3">
                        <button 
                          onClick={() => setTransactions(prev => prev.filter(x => x.id !== t.id))}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="flex justify-end space-x-4">
            <button 
              onClick={() => setStep('upload')}
              className="px-6 py-3 font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              className="px-6 py-3 font-medium text-white bg-indigo-600 rounded-xl hover:bg-indigo-700 flex items-center shadow-md shadow-indigo-200 dark:shadow-none"
            >
              <Save className="w-5 h-5 mr-2" />
              Salvar {totais.qtd} Transações
            </button>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
          <div className="bg-green-100 dark:bg-green-800/30 w-16 h-16 rounded-full flex items-center justify-center mb-6">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Importação Concluída!</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-sm">
            Foram inseridas {savedCount} transações. Os valores já constam no seu saldo e nos demais resumos.
          </p>
          <div className="flex space-x-4">
            <button 
              onClick={() => { setTransactions([]); setStep('upload'); }}
              className="px-6 py-3 font-medium text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Importar Mais
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
