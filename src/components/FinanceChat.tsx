import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { MessageCircle, X, Send, Loader2, Bot } from 'lucide-react';
import { db } from '../lib/firebaseConfig';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { usePlan } from '../hooks/usePlan';

export function FinanceChat() {
  const { user, profile } = useAuth();
  const { checkAccess } = usePlan();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // User Context
  const [context, setContext] = useState({ score: 0, renda: 0, dividas: 0, economias: 0 });

  useEffect(() => {
    if (!user) return;

    if (localStorage.getItem('mock_user')) {
      setMessages([
        { id: '1', role: 'assistant', content: 'Olá! Sou seu assistente financeiro. Como posso ajudar com suas finanças hoje?', timestamp: new Date() }
      ]);
      setContext({
        score: profile?.nivel ? profile.nivel * 100 : 500,
        renda: 5000, 
        dividas: 0,
        economias: 10000
      });
      return;
    }

    // Listen to chat history
    const q = query(collection(db, `chats/${user.uid}/messages`), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      scrollToBottom();
    });

    // Compile user context
    const fetchContext = async () => {
      let renda = 0, dividas = 0, economias = 0, score = 0;
      
      const diagSnap = await getDocs(query(collection(db, 'diagnostico'))); // just for score demo
      // In real scenario we use user specific diagnostic, getting the user doc directly
      // Let's mock a bit with profile data
      
      setContext({
        score: profile?.nivel ? profile.nivel * 100 : 500, // mock score context
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

    if (localStorage.getItem('mock_user')) {
      const newUserMsg = { id: Date.now().toString(), role: 'user', content: userMessage, timestamp: new Date() };
      setMessages(prev => [...prev, newUserMsg]);
      
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Esta é uma resposta mockada da IA do FinanceAI.',
          timestamp: new Date()
        }]);
        setIsTyping(false);
        scrollToBottom();
      }, 1000);
      return;
    }

    // Save user message to Firestore
    await addDoc(collection(db, `chats/${user.uid}/messages`), {
      role: 'user',
      content: userMessage,
      timestamp: serverTimestamp()
    });

    try {
      // Format history for Groq
      const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      history.push({ role: 'user', content: userMessage });

      const token = await user?.getIdToken();
      const res = await fetch('/api/groq/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ messages: history, context }),
      });

      if (!res.body) throw new Error('No readable stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiFullResponse = '';

      // Create a temporary message in UI for streaming
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
              if (data.text) {
                aiFullResponse += data.text;
                // Update temp message in UI
                setMessages(prev => prev.map(m => m.id === tempId ? { ...m, content: aiFullResponse } : m));
              }
            } catch (e) {}
          }
        }
      }

      // Save complete AI response to Firestore
      await addDoc(collection(db, `chats/${user.uid}/messages`), {
        role: 'assistant',
        content: aiFullResponse,
        timestamp: serverTimestamp()
      });

      // UI will automatically update via onSnapshot

    } catch (error) {
      console.error(error);
      // alert('Erro ao contatar o assistente IA');
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

  return (
    <>
      {/* Floating Button */}
      <button 
        onClick={handleOpenChat}
        className={`fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 rounded-full shadow-lg text-white flex items-center justify-center hover:bg-indigo-700 transition-transform ${isOpen ? 'scale-0' : 'scale-100 hover:scale-110'} z-40`}
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Chat Window */}
      <div className={`fixed bottom-6 right-6 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden transition-all duration-300 transform origin-bottom-right z-50 ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`} style={{ height: '500px' }}>
        
        {/* Header */}
        <div className="bg-indigo-600 p-4 flex items-center justify-between text-white">
          <div className="flex items-center space-x-2">
            <Bot className="w-6 h-6" />
            <div>
              <h3 className="font-bold tracking-tight">FinanceAI Assistant</h3>
              <p className="text-xs text-indigo-200">Online e pronto para ajudar</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-indigo-200 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900/50">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 text-sm my-4">
              Faça perguntas sobre suas finanças, simulações ou análise de gastos!
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id || Math.random()} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[80%] rounded-2xl p-3 text-sm shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none' 
                    : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-600 rounded-bl-none'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
             <div className="flex justify-start">
               <div className="max-w-[80%] bg-white dark:bg-gray-700 rounded-2xl p-3 text-sm shadow-sm rounded-bl-none border border-gray-100 dark:border-gray-600 text-gray-500 flex items-center space-x-2">
                 <Loader2 className="w-4 h-4 animate-spin" />
                 <span>Processando...</span>
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center space-x-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Pergunte sobre seus gastos..."
            className="flex-1 bg-gray-100 dark:bg-gray-900 border-0 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 text-gray-900 dark:text-white outline-none"
            disabled={isTyping}
          />
          <button 
            onClick={handleSend}
            disabled={isTyping || !input.trim()}
            className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
