import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { MessageCircle, X, Send, Loader2, Bot } from 'lucide-react';
import { db } from '../lib/firebaseConfig';
import { getAuth } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { usePlan } from '../hooks/usePlan';

export function FinanceChat({ fullPage = false }: { fullPage?: boolean }) {
  const { user, profile } = useAuth();
  const { checkAccess } = usePlan();
  const [isOpen, setIsOpen] = useState(fullPage);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // User Context
  const [context, setContext] = useState({ score: 0, renda: 0, dividas: 0, economias: 0 });

  useEffect(() => {
    if (!user) return;

    // Escuta histórico de mensagens do Firestore
    const q = query(collection(db, `chats/${user.uid}/messages`), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      scrollToBottom();
    });

    // Contexto do usuário para o prompt do Groq
    const fetchContext = async () => {
      setContext({
        score: profile?.nivel ? profile.nivel * 100 : 500,
        renda: 5000,
        dividas: 1500,
        economias: 2000
      });
    };
    fetchContext();

    return () => unsub();
  }, [user, profile]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || !user) return;
    
    const userMessage = input.trim();
    setInput('');
    setIsTyping(true);

    // Salva mensagem do usuário no Firestore
    await addDoc(collection(db, `chats/${user.uid}/messages`), {
      role: 'user',
      content: userMessage,
      timestamp: serverTimestamp()
    });

    try {
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      history.push({ role: 'user', content: userMessage });

      const auth = getAuth();
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/groq/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ messages: history, context }),
      });

      // Trata erros HTTP (401, 429, 500) antes de tentar ler o stream SSE
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: `Erro HTTP ${res.status}` }));
        throw new Error(errData.error || `Erro HTTP ${res.status}`);
      }

      if (!res.body) throw new Error('No readable stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiFullResponse = '';
      let hasError = false;

      const tempId = 'temp_' + Date.now();
      setMessages(prev => [...prev, { id: tempId, role: 'assistant', content: '', timestamp: new Date() }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value);
        const lines = chunkText.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6);
            if (dataStr === '[DONE]') break;
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                // Backend sinalizou erro dentro do stream
                hasError = true;
                aiFullResponse = `⚠️ ${data.error}`;
                setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: aiFullResponse } : m));
              } else if (data.text) {
                aiFullResponse += data.text;
                setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: aiFullResponse } : m));
              }
            } catch (e) {}
          }
        }
      }

      // Só persiste no Firestore se a resposta não foi um erro
      if (aiFullResponse && !hasError) {
        await addDoc(collection(db, `chats/${user.uid}/messages`), {
          role: 'assistant',
          content: aiFullResponse,
          timestamp: serverTimestamp()
        });
      } else if (!aiFullResponse) {
        // Remove a bolha temporária vazia se nada chegou
        setMessages(prev => prev.filter(m => m.id !== tempId));
      }

    } catch (error: any) {
      console.error('[FinanceChat] Erro na chamada Groq:', error);
      // Exibe mensagem de erro amigável na interface
      setMessages(prev => [...prev, { 
        id: 'err_' + Date.now(), 
        role: 'assistant', 
        content: `⚠️ Não foi possível conectar ao assistente: ${error.message || 'Tente novamente.'}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleOpenChat = () => {
    if (checkAccess('Pro', 'Chat com IA Financeira')) {
      setIsOpen(true);
    }
  };

  if (!user) return null;

  // Renderização em Modo Página Completa
  if (fullPage) {
    return (
      <div className="flex flex-col h-[calc(100vh-140px)] w-full bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl overflow-hidden text-white font-sans">
        {/* Header FullPage */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 p-6 flex items-center justify-between border-b border-gray-800 shadow-lg">
          <div className="flex items-center space-x-3.5">
            <div className="p-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 text-white">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-xl font-extrabold tracking-tight">Assistente Financeiro IA (Groq)</h3>
              <p className="text-xs text-indigo-100/90 font-medium mt-0.5">Tire dúvidas, peça conselhos e simule cenários em tempo real</p>
            </div>
          </div>
        </div>

        {/* Messages FullPage */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 bg-gray-950/60">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-12 text-sm font-medium border border-dashed border-gray-800 rounded-3xl bg-gray-900/30">
              👋 Olá! Sou sua Inteligência Artificial Financeira. Faça perguntas sobre suas metas, gastos ou planejamento!
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id || Math.random()} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[85%] sm:max-w-[75%] rounded-3xl p-4.5 text-sm sm:text-base font-medium shadow-xl ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none shadow-indigo-600/20' 
                    : 'bg-gray-900 text-gray-100 border border-gray-800/80 rounded-bl-none shadow-black/20 leading-relaxed'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
             <div className="flex justify-start">
               <div className="max-w-[80%] bg-gray-900 text-gray-400 border border-gray-800 rounded-3xl p-4 text-sm font-medium shadow-xl rounded-bl-none flex items-center space-x-3">
                 <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                 <span>Processando resposta com Groq AI...</span>
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form FullPage */}
        <div className="p-4 sm:p-6 bg-gray-900/90 backdrop-blur-md border-t border-gray-800 flex items-center space-x-3">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Digite sua pergunta (ex: Como posso economizar mais este mês?)..."
            className="flex-1 bg-gray-950 border border-gray-800 rounded-2xl px-5 py-4 text-sm sm:text-base font-medium text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
            disabled={isTyping}
            autoFocus
          />
          <button 
            onClick={handleSend}
            disabled={isTyping || !input.trim()}
            className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-600/25 flex items-center justify-center hover:from-indigo-500 hover:to-violet-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 gap-2"
          >
            <span>Enviar</span>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Modo Widget Flutuante (quando não estiver no /chat)
  return (
    <>
      <button 
        onClick={handleOpenChat}
        className={`fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 rounded-full shadow-2xl shadow-indigo-600/50 text-white flex items-center justify-center hover:bg-indigo-500 transition-transform ${isOpen ? 'scale-0' : 'scale-100 hover:scale-110'} z-40`}
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      <div className={`fixed bottom-6 right-6 w-80 sm:w-96 bg-gray-900 rounded-3xl shadow-2xl border border-gray-800 flex flex-col overflow-hidden transition-all duration-300 transform origin-bottom-right z-50 text-white ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`} style={{ height: '520px' }}>
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 p-4 flex items-center justify-between text-white shadow-md">
          <div className="flex items-center space-x-2.5">
            <Bot className="w-6 h-6" />
            <div>
              <h3 className="font-bold text-sm tracking-tight">FinanceAI Assistant</h3>
              <p className="text-[11px] text-indigo-100">Online e pronto para ajudar</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-indigo-200 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-950/80">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 text-xs my-4 bg-gray-900/50 p-4 rounded-2xl border border-gray-800">
              Faça perguntas sobre finanças, simulações ou análise de gastos!
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id || Math.random()} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[85%] rounded-2xl p-3 text-xs sm:text-sm font-medium shadow-md ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none' 
                    : 'bg-gray-900 text-gray-200 border border-gray-800 rounded-bl-none'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
             <div className="flex justify-start">
               <div className="max-w-[80%] bg-gray-900 text-gray-400 border border-gray-800 rounded-2xl p-3 text-xs shadow-sm rounded-bl-none flex items-center space-x-2">
                 <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                 <span>Processando...</span>
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-3 bg-gray-900 border-t border-gray-800 flex items-center space-x-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Pergunte algo..."
            className="flex-1 bg-gray-950 border border-gray-800 rounded-full px-4 py-2.5 text-xs focus:ring-1 focus:ring-indigo-500 text-white outline-none placeholder-gray-500"
            disabled={isTyping}
          />
          <button 
            onClick={handleSend}
            disabled={isTyping || !input.trim()}
            className="w-9 h-9 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-500 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 shadow-md"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
