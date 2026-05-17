import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../lib/firebaseConfig';
import { Loader2, Mail, Lock, User, Eye, EyeOff, TrendingUp, Sparkles } from 'lucide-react';

const ERROS: Record<string, string> = {
  'auth/user-not-found':         'Nenhuma conta encontrada com esse e-mail.',
  'auth/wrong-password':         'Senha incorreta. Tente novamente.',
  'auth/invalid-credential':     'Credenciais inválidas. Verifique e-mail e senha.',
  'auth/email-already-in-use':   'Este e-mail já está cadastrado. Faça login.',
  'auth/weak-password':          'A senha deve ter pelo menos 6 caracteres.',
  'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
  'auth/too-many-requests':      'Muitas tentativas. Aguarde alguns minutos.',
  'auth/invalid-email':          'Endereço de e-mail inválido.',
};

const getMensagemErro = (code: string) =>
  ERROS[code] || 'Ocorreu um erro inesperado. Tente novamente.';

export function Login() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<'login' | 'cadastro'>('login');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [erro, setErro] = useState('');

  const limparErro = () => setErro('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      if (modo === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), senha);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), senha);
        if (nome.trim()) {
          await updateProfile(cred.user, { displayName: nome.trim() });
        }
      }
      navigate('/dashboard');
    } catch (err: any) {
      setErro(getMensagemErro(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setErro('');
    setLoadingGoogle(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/dashboard');
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setErro(getMensagemErro(err.code));
      }
    } finally {
      setLoadingGoogle(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 relative overflow-hidden">

      {/* Glow de fundo */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] bg-violet-600/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-2xl shadow-indigo-600/30 mb-4">
            <TrendingUp className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">FinanceAI</h1>
          <p className="text-gray-400 text-sm mt-1 font-medium">Seu assistente financeiro inteligente</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-800/60 rounded-3xl p-8 shadow-2xl shadow-black/40">

          {/* Tabs login / cadastro */}
          <div className="flex bg-gray-950 rounded-2xl p-1 mb-7 gap-1">
            {(['login', 'cadastro'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setModo(tab); limparErro(); }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  modo === tab
                    ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Nome (apenas no cadastro) */}
            {modo === 'cadastro' && (
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome completo"
                  className="w-full bg-gray-950 border border-gray-800 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>
            )}

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full bg-gray-950 border border-gray-800 rounded-2xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>

            {/* Senha */}
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder={modo === 'cadastro' ? 'Mínimo 6 caracteres' : 'Sua senha'}
                required
                className="w-full bg-gray-950 border border-gray-800 rounded-2xl pl-11 pr-12 py-3.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
              >
                {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Mensagem de erro */}
            {erro && (
              <div className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl px-4 py-3">
                <span className="text-rose-400 text-xs font-medium leading-relaxed">{erro}</span>
              </div>
            )}

            {/* Botão principal */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Aguarde...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> {modo === 'login' ? 'Entrar na conta' : 'Criar minha conta'}</>
              )}
            </button>
          </form>

          {/* Divisor */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-600 font-medium">ou continue com</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          {/* Botão Google */}
          <button
            onClick={handleGoogle}
            disabled={loadingGoogle}
            className="w-full py-3.5 bg-gray-950 border border-gray-800 hover:border-gray-700 hover:bg-gray-900 text-white font-semibold rounded-2xl flex items-center justify-center gap-3 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loadingGoogle ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            <span>Continuar com Google</span>
          </button>

          {/* Rodapé */}
          <p className="text-center text-xs text-gray-600 mt-6">
            {modo === 'login' ? (
              <>Não tem conta?{' '}
                <button onClick={() => { setModo('cadastro'); limparErro(); }} className="text-indigo-400 hover:text-indigo-300 font-semibold transition">
                  Cadastre-se grátis
                </button>
              </>
            ) : (
              <>Já tem conta?{' '}
                <button onClick={() => { setModo('login'); limparErro(); }} className="text-indigo-400 hover:text-indigo-300 font-semibold transition">
                  Fazer login
                </button>
              </>
            )}
          </p>
        </div>

        <p className="text-center text-xs text-gray-700 mt-6">
          Seus dados são protegidos com criptografia Firebase 🔒
        </p>
      </div>
    </div>
  );
}
