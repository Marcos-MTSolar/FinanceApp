import { getAuth } from 'firebase/auth';

/**
 * antigravityConfig.ts
 * 
 * Centraliza as requisições do frontend para a plataforma Antigravity,
 * roteando tudo de forma segura através do nosso backend proxy (Express).
 */

const ANTIGRAVITY_PROXY_URL = '/api/antigravity/action';

export const callAntigravityAction = async (payload: any) => {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error('Usuário não autenticado no Firebase.');
  }

  const response = await fetch(ANTIGRAVITY_PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` // Firebase token para validação no backend
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let errorData = {};
    try {
      errorData = await response.json();
    } catch {
      // Ignora erro de parse se o corpo não for JSON
    }
    
    // Identifica e trata erros de Rate Limit da plataforma Antigravity
    if (response.status === 429) {
      throw new Error('Muitas requisições. O limite do Antigravity foi atingido. Tente novamente mais tarde.');
    }

    throw new Error((errorData as any).error || `Erro HTTP ${response.status} ao conectar com Antigravity.`);
  }

  return response.json();
};
