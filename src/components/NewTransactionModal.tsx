import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebaseConfig';
import { X, ArrowUpRight, ArrowDownLeft, Loader2, DollarSign, Calendar, Tag, FileText } from 'lucide-react';
import { addXp } from '../lib/gamification';

interface NewTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  modo: 'pessoal' | 'empresarial';
}

const CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Moradia',
  'Saúde',
  'Lazer',
  'Assinatura',
  'Salário',
  'Outros'
];

export function NewTransactionModal({ isOpen, onClose, userId, modo }: NewTransactionModalProps) {
  const [tipo, setTipo] = useState<'despesa' | 'receita'>('despesa');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('Alimentação');
  const [data, setData] = useState(() => new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valor || isNaN(Number(valor)) || Number(valor) <= 0) {
      setError('Por favor, informe um valor válido maior que zero.');
      return;
    }
    if (!descricao.trim()) {
      setError('Por favor, informe a descrição da transação.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Formata a data para ISO com hora fixa ao meio-dia para evitar fuso horário de véspera
      const [year, month, day] = data.split('-');
      const formattedDate = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0).toISOString();

      await addDoc(collection(db, `transacoes/${userId}/items`), {
        descricao: descricao.trim(),
        valor: Number(valor),
        tipo,
        categoria,
        data: formattedDate,
        modo,
        criadoEm: new Date().toISOString()
      });

      await addXp(userId, 10); // +10 XP por transação

      // Reset dos campos e fecha o modal
      setValor('');
      setDescricao('');
      setLoading(false);
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar transação:', err);
      setError('Erro ao salvar transação. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-gray-900 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black text-white">
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-6 border-b border-gray-800">
          <div>
            <h3 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Nova Transação
            </h3>
            <p className="text-xs text-gray-400 mt-1">Registre uma nova entrada ou saída na sua conta</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-xl bg-gray-800/60 hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-400 font-medium">
              {error}
            </div>
          )}

          {/* Seleção de Tipo (Receita / Despesa) */}
          <div className="grid grid-cols-2 gap-3 p-1.5 bg-gray-950 border border-gray-800/80 rounded-2xl">
            <button
              type="button"
              onClick={() => { setTipo('despesa'); if (categoria === 'Salário') setCategoria('Alimentação'); }}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs transition-all duration-200 ${
                tipo === 'despesa'
                  ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900/50'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>Despesa</span>
            </button>
            <button
              type="button"
              onClick={() => { setTipo('receita'); setCategoria('Salário'); }}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold text-xs transition-all duration-200 ${
                tipo === 'receita'
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                  : 'text-gray-400 hover:text-white hover:bg-gray-900/50'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Receita</span>
            </button>
          </div>

          {/* Campo Valor */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5 uppercase tracking-wider">
              <DollarSign className="w-3.5 h-3.5 text-indigo-400" />
              <span>Valor (R$)</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-gray-500">R$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-gray-950 border border-gray-800 rounded-2xl text-lg font-bold text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                autoFocus
              />
            </div>
          </div>

          {/* Campo Descrição */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5 uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Descrição</span>
            </label>
            <input
              type="text"
              placeholder="Ex: Aluguel, Supermercado, Freela..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm font-medium text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Campo Categoria */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Tag className="w-3.5 h-3.5 text-indigo-400" />
                <span>Categoria</span>
              </label>
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm font-medium text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-gray-900 text-white">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Campo Data */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Data</span>
              </label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-2xl text-sm font-medium text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-3 px-5 bg-gray-950 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 font-semibold text-xs text-gray-300 rounded-2xl transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs rounded-2xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>Salvar Transação</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
