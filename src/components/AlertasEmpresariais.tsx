import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebaseConfig';
import { AlertTriangle, AlertCircle, Info, Loader2, Sparkles } from 'lucide-react';

interface Alerta {
  tipo: 'perigo' | 'atencao' | 'info';
  titulo: string;
  mensagem: string;
}

export function AlertasEmpresariais() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAlertsData = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const currentCompetence = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

        // Helper to check if a date is in the current month
        const isCurrentMonth = (dateVal: any) => {
          if (!dateVal) return false;
          let d: Date;
          if (typeof dateVal?.toDate === 'function') {
            d = dateVal.toDate();
          } else {
            d = new Date(dateVal);
          }
          if (isNaN(d.getTime())) return false;
          return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        };

        // 1. Fetch transactions (empresarial)
        const transSnap = await getDocs(collection(db, `transacoes/${user.uid}/items`));
        let faturamentoMes = 0;
        let totalDespesas = 0;

        transSnap.docs.forEach((doc) => {
          const t = doc.data();
          if (t.modo === 'empresarial' && isCurrentMonth(t.data)) {
            const val = Number(t.valor) || 0;
            if (t.tipo === 'receita') {
              faturamentoMes += val;
            } else {
              totalDespesas += Math.abs(val);
            }
          }
        });
        const saldoAtual = faturamentoMes - totalDespesas;

        // 2. Fetch employees (totalFuncionarios and totalFolha)
        const funcSnap = await getDocs(collection(db, `funcionarios/${user.uid}/items`));
        const totalFuncionarios = funcSnap.size;
        let totalFolha = 0;
        funcSnap.docs.forEach((doc) => {
          const f = doc.data();
          totalFolha += Number(f.salarioBruto) || 0;
        });

        // 3. Fetch reserves (reservaTrabalhista)
        let reservaTrabalhista = 0;
        const resDoc = await getDoc(doc(db, 'reservas', user.uid));
        if (resDoc.exists()) {
          const r = resDoc.data();
          reservaTrabalhista = (Number(r.guardado13) || 0) + (Number(r.guardadoFerias) || 0) + (Number(r.guardadoRescisoes) || 0);
        }

        // 4. Fetch taxes for the current competence
        const impSnap = await getDocs(collection(db, `impostos/${user.uid}/items`));
        let totalImpostos = 0;
        impSnap.docs.forEach((doc) => {
          const imp = doc.data();
          if (imp.competencia === currentCompetence) {
            totalImpostos += Number(imp.valorTotal) || 0;
          }
        });

        // 5. Calculate remaining days in month
        const lastDay = new Date(currentYear, currentMonth + 1, 0).getDate();
        const diasParaFimMes = lastDay - now.getDate();

        // 6. Request to backend
        const token = await user.getIdToken();
        const res = await fetch('/api/empresa/alertas', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            faturamentoMes,
            totalDespesas,
            totalFolha,
            saldoAtual,
            diasParaFimMes,
            totalImpostos,
            reservaTrabalhista,
            totalFuncionarios
          })
        });

        if (!res.ok) {
          throw new Error('Falha ao obter alertas inteligentes');
        }

        const data = await res.json();
        setAlertas(data.alertas || []);
      } catch (err: any) {
        console.error('Error fetching alerts:', err);
        setError(err.message || 'Erro de conexão com o servidor de IA.');
      } finally {
        setLoading(false);
      }
    };

    fetchAlertsData();
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-900/60 border border-gray-800 rounded-3xl p-8 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm text-gray-400 font-medium">Analisando indicadores com IA...</p>
      </div>
    );
  }

  if (error) {
    return null; // Silent failure or fallback without interrupting UI flow
  }

  if (alertas.length === 0) {
    return (
      <div className="bg-gray-900/40 border border-gray-800/80 rounded-3xl p-6 flex items-center gap-4">
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400">
          <Sparkles className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-white">Saúde Financeira sob Controle</h4>
          <p className="text-xs text-gray-400 mt-0.5">
            A IA analisou seus indicadores e não identificou riscos críticos no momento. Continue assim!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Alertas Inteligentes Corporativos</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {alertas.map((alerta, idx) => {
          let cardStyle = '';
          let icon = null;

          if (alerta.tipo === 'perigo') {
            cardStyle = 'bg-rose-950/20 border-rose-500/30 text-rose-200 hover:border-rose-500/50';
            icon = <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />;
          } else if (alerta.tipo === 'atencao') {
            cardStyle = 'bg-amber-950/20 border-amber-500/30 text-amber-200 hover:border-amber-500/50';
            icon = <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />;
          } else {
            cardStyle = 'bg-indigo-950/20 border-indigo-500/30 text-indigo-200 hover:border-indigo-500/50';
            icon = <Info className="w-5 h-5 text-indigo-400 flex-shrink-0" />;
          }

          return (
            <div
              key={idx}
              className={`flex gap-3.5 p-5 border rounded-2xl transition-all duration-300 hover:-translate-y-0.5 shadow-lg ${cardStyle}`}
            >
              {icon}
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-white truncate">{alerta.titulo}</h4>
                <p className="text-xs mt-1 leading-relaxed opacity-85">{alerta.mensagem}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
