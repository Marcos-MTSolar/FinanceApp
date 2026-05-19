import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, writeBatch, getDocs, addDoc, serverTimestamp, doc, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebaseConfig';
import { Bell, X, CheckCheck } from 'lucide-react';

interface Notificacao {
  id: string;
  mensagem: string;
  lida: boolean;
  criadoEm: any;
  tipo?: string;
}

interface NotificacoesCloakProps {
  userId: string;
}

export function NotificacoesDropdown({ userId }: NotificacoesCloakProps) {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, `notificacoes/${userId}/items`),
      where('lida', '==', false),
      orderBy('criadoEm', 'desc')
    );

    let unsub: () => void;

    unsub = onSnapshot(q, (snap) => {
      setNotificacoes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Notificacao)));
    }, (err) => {
      // Cancela o listener imediatamente para evitar loop infinito de tentativas.
      // Isso ocorre quando o índice do Firestore ainda não foi criado/propagado.
      console.error('Erro no listener de notificações — listener cancelado para evitar loop:', err.message);
      if (unsub) unsub();
    });

    return () => unsub();
  }, [userId]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const marcarTodasLidas = async () => {
    if (!userId || notificacoes.length === 0) return;
    try {
      const batch = writeBatch(db);
      notificacoes.forEach(n => {
        batch.update(doc(db, `notificacoes/${userId}/items`, n.id), { lida: true });
      });
      await batch.commit();
    } catch (err) {
      console.error('Erro ao marcar notificações como lidas:', err);
    }
  };

  const marcarComoLida = async (id: string) => {
    if (!userId) return;
    try {
      await updateDoc(doc(db, `notificacoes/${userId}/items`, id), { lida: true });
    } catch (err) {
      console.error('Erro ao marcar notificação como lida:', err);
    }
  };

  const formatTime = (ts: any) => {
    if (!ts) return '';
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 1) return 'agora';
    if (diff < 60) return `${diff}min atrás`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h atrás`;
    return d.toLocaleDateString('pt-BR');
  };

  const count = notificacoes.length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2.5 text-gray-400 hover:text-white rounded-full bg-gray-900 border border-gray-800 hover:border-gray-700 transition-colors"
        title="Notificações"
      >
        <Bell className="w-4 h-4" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-2 ring-gray-950 animate-pulse">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl shadow-black/40 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-400" />
              <span className="text-sm font-bold text-white">Notificações</span>
              {count > 0 && (
                <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                  {count} nova{count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 text-gray-500 hover:text-white rounded-lg transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Lista */}
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-800/50">
            {notificacoes.length === 0 ? (
              <div className="py-10 text-center text-gray-500 text-xs font-medium">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                Nenhuma notificação nova
              </div>
            ) : (
              notificacoes.map(n => (
                <div key={n.id} className="px-4 py-3 hover:bg-gray-800/50 transition-colors flex items-start justify-between gap-2 group">
                  <div className="flex gap-2 items-start flex-1 min-w-0">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.tipo === 'alerta' ? 'bg-rose-500' : 'bg-indigo-500'}`} />
                    <div className="flex-1 min-w-0">
                      <span className={`text-[10px] font-bold block mb-0.5 ${n.tipo === 'alerta' ? 'text-rose-400' : 'text-indigo-400'}`}>
                        {n.tipo === 'alerta' ? 'Alerta Financeiro' : 'Notificação'}
                      </span>
                      <p className="text-xs text-gray-200 leading-relaxed break-words">{n.mensagem}</p>
                      <p className="text-[10px] text-gray-500 mt-1">{formatTime(n.criadoEm)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => marcarComoLida(n.id)}
                    className="p-1 text-gray-500 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition-colors flex-shrink-0"
                    title="Marcar como lida"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notificacoes.length > 0 && (
            <div className="border-t border-gray-800 px-4 py-3">
              <button
                onClick={marcarTodasLidas}
                className="w-full flex items-center justify-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 py-2 rounded-xl transition-all"
              >
                <CheckCheck className="w-4 h-4" />
                Marcar todas como lidas
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Utilitário para criar notificações ──────────────────────────────────────

export async function criarNotificacao(userId: string, mensagem: string, tipo: string = 'info') {
  if (!userId) return;
  try {
    await addDoc(collection(db, `notificacoes/${userId}/items`), {
      mensagem,
      lida: false,
      criadoEm: serverTimestamp(),
      tipo
    });
  } catch (err) {
    console.error('Erro ao criar notificação:', err);
  }
}
