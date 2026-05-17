import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

// Tabela visual de níveis usada na NiveisPage e HeaderXPBar
export const LEVEL_THRESHOLDS = [
  { level: 1,  name: 'Desorganizado',    minXp: 0,    color: 'text-gray-500' },
  { level: 2,  name: 'Consciente',       minXp: 100,  color: 'text-blue-500' },
  { level: 3,  name: 'Planejador',       minXp: 300,  color: 'text-indigo-500' },
  { level: 4,  name: 'Estrategista',     minXp: 600,  color: 'text-purple-500' },
  { level: 5,  name: 'Investidor',       minXp: 1000, color: 'text-orange-500' },
  { level: 6,  name: 'Independente',     minXp: 1500, color: 'text-yellow-500' },
  { level: 7,  name: 'Visionário',       minXp: 2100, color: 'text-emerald-500' },
  { level: 8,  name: 'Mestre Financeiro',minXp: 2800, color: 'text-cyan-500' },
  { level: 9,  name: 'Magnata',          minXp: 3600, color: 'text-rose-500' },
  { level: 10, name: 'Lenda',            minXp: 4500, color: 'text-amber-500' },
];

// Calcula o nível a partir do XP total
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

// Retorna metadados do nível atual e próximo com % de progresso
export const getLevelInfo = (xp: number) => {
  const nivel = calcularNivel(xp);
  const currentLevel = LEVEL_THRESHOLDS[nivel - 1];
  const nextLevel    = LEVEL_THRESHOLDS[nivel] || null;

  const progress = nextLevel
    ? ((xp - currentLevel.minXp) / (nextLevel.minXp - currentLevel.minXp)) * 100
    : 100;

  return { currentLevel, nextLevel, progress };
};

// Incrementa XP do usuário e persiste xp + nivel no Firestore via merge
export const addXp = async (userId: string, xpGanho: number) => {
  if (!userId) return null;

  try {
    const docRef  = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    const xpAtual = docSnap.data()?.xp  || 0;
    const nivelAtual = docSnap.data()?.nivel || 1;

    const novoXp    = xpAtual + xpGanho;
    const novoNivel = calcularNivel(novoXp);

    await setDoc(docRef, { xp: novoXp, nivel: novoNivel }, { merge: true });

    return {
      newXp:    novoXp,
      nivel:    novoNivel,
      name:     LEVEL_THRESHOLDS[novoNivel - 1]?.name || '',
      leveledUp: novoNivel > nivelAtual,
    };
  } catch (err) {
    console.error('[addXp] Erro ao salvar XP no Firestore:', err);
    return null;
  }
};
