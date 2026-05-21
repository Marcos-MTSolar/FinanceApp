import { doc, getDoc, setDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from './firebaseConfig';

// ── Tabela de níveis (usada em NiveisPage e HeaderXPBar) ─────────────────────
export const LEVEL_THRESHOLDS = [
  { level: 1,  name: 'Desorganizado',     minXp: 0,    color: 'text-gray-500' },
  { level: 2,  name: 'Consciente',        minXp: 100,  color: 'text-blue-500' },
  { level: 3,  name: 'Planejador',        minXp: 300,  color: 'text-indigo-500' },
  { level: 4,  name: 'Estrategista',      minXp: 600,  color: 'text-purple-500' },
  { level: 5,  name: 'Investidor',        minXp: 1000, color: 'text-orange-500' },
  { level: 6,  name: 'Independente',      minXp: 1500, color: 'text-yellow-500' },
  { level: 7,  name: 'Visionário',        minXp: 2100, color: 'text-emerald-500' },
  { level: 8,  name: 'Mestre Financeiro', minXp: 2800, color: 'text-cyan-500' },
  { level: 9,  name: 'Magnata',           minXp: 3600, color: 'text-rose-500' },
  { level: 10, name: 'Lenda',             minXp: 4500, color: 'text-amber-500' },
];

// ── Catálogo de eventos de XP (fonte única de verdade para UI e lógica) ───────
export const XP_EVENTS = {
  // ── GANHOS ────────────────────────────────────────────────────────────────
  IMPORTAR_EXTRATO:    { xp: +20, label: 'Importar extrato',                tipo: 'ganho' as const },
  CADASTRAR_META:      { xp: +15, label: 'Cadastrar nova meta',             tipo: 'ganho' as const },
  META_CONCLUIDA:      { xp: +50, label: 'Marcar meta como concluída',      tipo: 'ganho' as const },
  ADICIONAR_RECEITA:   { xp: +10, label: 'Adicionar uma receita',           tipo: 'ganho' as const },
  DIAGNOSTICO_INICIAL: { xp: +30, label: 'Completar diagnóstico inicial',   tipo: 'ganho' as const },
  SALDO_POSITIVO_MES:  { xp: +25, label: 'Fechar o mês com saldo positivo', tipo: 'ganho' as const },
  RENDA_EXTRA_UNICA:   { xp: +15, label: 'Cadastrar primeira renda extra',  tipo: 'ganho' as const },
  RENDA_EXTRA_RECORRENTE: { xp: +20, label: 'Cadastrar renda extra recorrente', tipo: 'ganho' as const },

  // ── PENALIDADES ──────────────────────────────────────────────────────────
  EXCESSO_DESPESAS_DIA:     { xp: -15, label: '3+ despesas no mesmo dia após alerta de economia',      tipo: 'perda' as const },
  SALDO_NEGATIVO_MES:       { xp: -20, label: 'Fechar o mês com saldo negativo',                       tipo: 'perda' as const },
  EXCESSO_LUXO:             { xp: -10, label: 'Gastos com luxo acima de 40% da renda cadastrada',      tipo: 'perda' as const },
  INATIVIDADE_COM_METAS:    { xp: -5,  label: '7 dias sem acessar com metas ativas',                   tipo: 'perda' as const },
} as const;

export type XpEventKey = keyof typeof XP_EVENTS;

// ── Cálculo de nível a partir do XP ──────────────────────────────────────────
const calcularNivel = (xp: number): number => {
  if (xp < 100)  return 1;
  if (xp < 300)  return 2;
  if (xp < 600)  return 3;
  if (xp < 1000) return 4;
  if (xp < 1500) return 5;
  if (xp < 2100) return 6;
  if (xp < 2800) return 7;
  if (xp < 3600) return 8;
  if (xp < 4500) return 9;
  return 10;
};

// ── Metadados do nível atual + progresso (usado em NiveisPage, HeaderXPBar) ──
export const getLevelInfo = (xp: number) => {
  const nivel = calcularNivel(xp);
  const currentLevel = LEVEL_THRESHOLDS[nivel - 1];
  const nextLevel    = LEVEL_THRESHOLDS[nivel] || null;
  const progress = nextLevel
    ? ((xp - currentLevel.minXp) / (nextLevel.minXp - currentLevel.minXp)) * 100
    : 100;
  return { currentLevel, nextLevel, progress };
};

// ── Score Financeiro (com Renda Extra) ───────────────────────────────────────
export const calcularScoreFinanceiro = (
  receitaFixa: number,
  totalRendaExtra: number,
  totalDespesas: number,
  qtdRendasExtras: number
) => {
  const receitaTotal = receitaFixa + totalRendaExtra;
  
  if (receitaTotal <= 0) return { score: 0, label: 'Sem dados' };
  
  const taxaCompromisso = totalDespesas / receitaTotal;
  const saldo = receitaTotal - totalDespesas;
  
  const calcularScoreBase = (taxa: number) => {
    if (taxa <= 0.5 && saldo > 0) return { base: 85, lbl: 'Ótimo' };
    if (taxa <= 0.7 && saldo > 0) return { base: 65, lbl: 'Bom' };
    if (taxa <= 0.9) return { base: 45, lbl: 'Regular' };
    return { base: 25, lbl: 'Crítico' };
  };

  const { base: scoreBase, lbl: label } = calcularScoreBase(taxaCompromisso);
  
  // Bônus no score por ter renda diversificada
  const bonusDiversificacao = qtdRendasExtras > 1 ? 10 : 0;
  const scoreFinal = Math.min(100, scoreBase + bonusDiversificacao);
  
  return { score: scoreFinal, label };
};

// ── Aplica delta de XP (positivo ou negativo) e persiste no Firestore ────────
// XP mínimo é 0 — o usuário nunca fica negativo, mas pode perder pontos acumulados.
export const addXp = async (userId: string, xpDelta: number): Promise<void> => {
  if (!userId) return;
  try {
    const docRef  = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    const xpAtual = docSnap.data()?.xp || 0;
    const novoXp  = Math.max(0, xpAtual + xpDelta); // nunca abaixo de 0
    const novoNivel = calcularNivel(novoXp);
    await setDoc(docRef, { xp: novoXp, nivel: novoNivel }, { merge: true });
    if (xpDelta < 0) {
      console.log(`[gamification] Penalidade aplicada: ${xpDelta} XP → total agora: ${novoXp}`);
    }
  } catch (err) {
    console.error('Erro ao atualizar XP:', err);
  }
};

// ── Aplica XP por chave de evento (usa o catálogo XP_EVENTS) ─────────────────
export const applyXpEvent = async (userId: string, event: XpEventKey): Promise<void> => {
  const { xp } = XP_EVENTS[event];
  await addXp(userId, xp);
};

// ── Helper: data de hoje em YYYY-MM-DD ───────────────────────────────────────
const hoje = () => new Date().toISOString().slice(0, 10);

// ── Penalidade: verificar saldo do mês (chamar no fim do mês / login) ─────────
// Lê as transações do mês atual e aplica +25 ou -20 XP conforme o saldo.
export const verificarSaldoMensal = async (userId: string): Promise<void> => {
  if (!userId) return;
  try {
    const agora = new Date();
    const anoMes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;

    // Verifica se já foi avaliado este mês para não aplicar duplo
    const userRef = doc(db, 'users', userId);
    const userData = (await getDoc(userRef)).data() || {};
    if (userData.ultimaAvaliacaoSaldo === anoMes) return;

    const snap = await getDocs(
      query(collection(db, `transacoes/${userId}/items`))
    );

    let receitas = 0;
    let despesas = 0;

    snap.docs.forEach(d => {
      const t = d.data();
      const dataStr: string = typeof t.data === 'string'
        ? t.data
        : (t.data as Timestamp)?.toDate?.()?.toISOString?.()?.slice(0, 10) || '';

      if (!dataStr.startsWith(anoMes)) return;
      const val = Math.abs(Number(t.valor) || 0);
      if (t.tipo === 'receita') receitas += val;
      else despesas += val;
    });

    const saldo = receitas - despesas;
    const xpDelta = saldo >= 0 ? XP_EVENTS.SALDO_POSITIVO_MES.xp : XP_EVENTS.SALDO_NEGATIVO_MES.xp;
    await addXp(userId, xpDelta);
    await setDoc(userRef, { ultimaAvaliacaoSaldo: anoMes }, { merge: true });
  } catch (err) {
    console.error('[gamification] Erro ao verificar saldo mensal:', err);
  }
};

// ── Penalidade: excesso de gastos de luxo no mês ─────────────────────────────
// Calcula se Lazer + Assinatura > 40% da renda cadastrada. Aplica -10 XP se sim.
export const verificarExcessoLuxo = async (userId: string): Promise<void> => {
  if (!userId) return;
  try {
    const userRef = doc(db, 'users', userId);
    const userData = (await getDoc(userRef)).data() || {};
    const renda: number = Number(userData.renda) || 0;
    if (renda <= 0) return; // sem renda cadastrada, não avalia

    const agora = new Date();
    const anoMes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
    if (userData.ultimaAvaliacaoLuxo === anoMes) return;

    const snap = await getDocs(
      query(
        collection(db, `transacoes/${userId}/items`),
        where('tipo', '==', 'despesa')
      )
    );

    let totalLuxo = 0;
    snap.docs.forEach(d => {
      const t = d.data();
      const dataStr: string = typeof t.data === 'string'
        ? t.data
        : (t.data as Timestamp)?.toDate?.()?.toISOString?.()?.slice(0, 10) || '';
      if (!dataStr.startsWith(anoMes)) return;
      if (['Lazer', 'Assinatura'].includes(t.categoria)) {
        totalLuxo += Math.abs(Number(t.valor) || 0);
      }
    });

    if (totalLuxo > renda * 0.4) {
      await addXp(userId, XP_EVENTS.EXCESSO_LUXO.xp);
      await setDoc(userRef, { ultimaAvaliacaoLuxo: anoMes }, { merge: true });
    }
  } catch (err) {
    console.error('[gamification] Erro ao verificar excesso de luxo:', err);
  }
};

// ── Penalidade: 3+ despesas no mesmo dia ─────────────────────────────────────
// Chamada dentro do NewTransactionModal após salvar uma despesa.
// Conta quantas despesas o usuário já cadastrou hoje. Se >= 3, aplica -15 XP.
// Aplica apenas uma vez por dia (controla via lastPenalidadeDia no Firestore).
export const verificarExcessoDespesasDia = async (userId: string): Promise<void> => {
  if (!userId) return;
  try {
    const dataHoje = hoje();
    const userRef = doc(db, 'users', userId);
    const userData = (await getDoc(userRef)).data() || {};
    if (userData.lastPenalidadeDia === dataHoje) return; // já penalizou hoje

    // Usa range no criadoEm (Timestamp) pois o campo data é ISO com hora, não plain YYYY-MM-DD
    const inicioDia = Timestamp.fromDate(new Date(`${dataHoje}T00:00:00.000`));
    const fimDia    = Timestamp.fromDate(new Date(`${dataHoje}T23:59:59.999`));

    const snap = await getDocs(
      query(
        collection(db, `transacoes/${userId}/items`),
        where('tipo', '==', 'despesa'),
        where('criadoEm', '>=', inicioDia),
        where('criadoEm', '<=', fimDia)
      )
    );

    if (snap.size >= 3) {
      await addXp(userId, XP_EVENTS.EXCESSO_DESPESAS_DIA.xp);
      await setDoc(userRef, { lastPenalidadeDia: dataHoje }, { merge: true });
      console.log('[gamification] Penalidade EXCESSO_DESPESAS_DIA aplicada:', dataHoje);
    }
  } catch (err) {
    console.error('[gamification] Erro ao verificar excesso de despesas no dia:', err);
  }
};

// ── Penalidade: inatividade com metas ativas ─────────────────────────────────
// Chamada no login. Se o usuário tem metas ativas E o último acesso foi há 7+ dias,
// aplica -5 XP. Registra o acesso atual para a próxima verificação.
export const verificarInatividade = async (userId: string): Promise<void> => {
  if (!userId) return;
  try {
    const userRef = doc(db, 'users', userId);
    const userData = (await getDoc(userRef)).data() || {};

    // Registra o acesso atual (independente de penalidade)
    const agora = new Date().toISOString();
    const ultimoAcesso = userData.ultimoAcesso
      ? new Date(userData.ultimoAcesso)
      : null;

    const diasSemAcesso = ultimoAcesso
      ? Math.floor((Date.now() - ultimoAcesso.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    if (diasSemAcesso >= 7) {
      // Verifica se há metas ativas (campo correto é status === 'ativa')
      const metasSnap = await getDocs(
        query(
          collection(db, `metas/${userId}/items`),
          where('status', '==', 'ativa')
        )
      );

      if (metasSnap.size > 0) {
        await addXp(userId, XP_EVENTS.INATIVIDADE_COM_METAS.xp);
        console.log('[gamification] Penalidade INATIVIDADE_COM_METAS aplicada.');
      }
    }

    await setDoc(userRef, { ultimoAcesso: agora }, { merge: true });
  } catch (err) {
    console.error('[gamification] Erro ao verificar inatividade:', err);
  }
};
