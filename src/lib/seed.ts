import { doc, setDoc, collection } from 'firebase/firestore';
import { db } from './firebaseConfig';

/**
 * Função para popular o Firestore com dados de teste.
 * É recomendável chamar isso no console ou em uma área de "Admin" para teste.
 */
export async function seedDatabase(userId: string) {
  try {
    console.log('Iniciando seed de dados...');

    // 1. Perfil Inicial (Se já não existir)
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      nome: 'Usuário Teste',
      email: 'teste@financeai.com',
      modo: 'pessoal',
      plano: 'pro',
      xp: 150,
      nivel: 2,
      criadoEm: new Date().toISOString()
    }, { merge: true });

    // 2. Transações
    const transacoesRef = collection(db, `transacoes/${userId}/items`);
    const mockTransacoes = [
      {
        valor: 5000,
        tipo: 'receita',
        categoria: 'Salário',
        descricao: 'Salário Mensal',
        data: new Date().toISOString(),
        origem: 'manual',
        recorrente: true,
        userId
      },
      {
        valor: -150,
        tipo: 'despesa',
        categoria: 'Alimentação',
        descricao: 'Mercado',
        data: new Date().toISOString(),
        origem: 'manual',
        recorrente: false,
        userId
      }
    ];

    for (const t of mockTransacoes) {
      const novaTransacaoRef = doc(transacoesRef);
      await setDoc(novaTransacaoRef, t);
    }

    // 3. Metas
    const metasRef = collection(db, `metas/${userId}/lista`);
    const novaMetaRef = doc(metasRef);
    await setDoc(novaMetaRef, {
      titulo: 'Reserva de Emergência',
      valorAlvo: 10000,
      valorAtual: 2500,
      prazo: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(), // +1 ano
      status: 'ativa',
      tipo: 'pessoal',
      userId
    });

    // 4. Diagnóstico
    const diagnosticoRef = doc(db, 'diagnostico', userId);
    await setDoc(diagnosticoRef, {
      respostas: {
        pergunta1: 'Sim, tenho dívidas',
        pergunta2: 'Guardo 10% do salário'
      },
      score: 75,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    });

    // 5. Dados Empresariais (mock)
    const empresarialRef = doc(db, 'empresarial', userId);
    await setDoc(empresarialRef, {
      faturamento: 25000,
      funcionarios: 3,
      margemEstimada: 25,
      capitalDeGiro: 15000,
      dividasEmpresariais: 0
    });

    console.log('Seed realizado com sucesso!');
  } catch (error) {
    console.error('Erro no seed de dados:', error);
  }
}
