import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

export const LEVEL_THRESHOLDS = [
  { level: 1, name: 'Desorganizado', minXp: 0, color: 'text-gray-500' },
  { level: 2, name: 'Consciente', minXp: 500, color: 'text-blue-500' },
  { level: 3, name: 'Planejador', minXp: 1500, color: 'text-indigo-500' },
  { level: 4, name: 'Estrategista', minXp: 3000, color: 'text-purple-500' },
  { level: 5, name: 'Investidor', minXp: 6000, color: 'text-orange-500' },
  { level: 6, name: 'Independente', minXp: 10000, color: 'text-yellow-500' }
];

export const getLevelInfo = (xp: number) => {
  let currentLevel = LEVEL_THRESHOLDS[0];
  let nextLevel = LEVEL_THRESHOLDS[1];

  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i].minXp) {
      currentLevel = LEVEL_THRESHOLDS[i];
      nextLevel = LEVEL_THRESHOLDS[i + 1] || null;
    }
  }

  const progress = nextLevel 
    ? ((xp - currentLevel.minXp) / (nextLevel.minXp - currentLevel.minXp)) * 100 
    : 100;

  return { currentLevel, nextLevel, progress };
};

export const addXp = async (userId: string, amount: number) => {
  if (!userId) return null;
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  
  if (snap.exists()) {
    const data = snap.data();
    const newXp = (data.xp || 0) + amount;
    const { currentLevel } = getLevelInfo(newXp);
    
    await updateDoc(userRef, {
      xp: newXp,
      nivel: currentLevel.level
    });
    
    return { newXp, nivel: currentLevel.level, name: currentLevel.name, leveledUp: currentLevel.level > (data.nivel || 1) };
  }
  return null;
};
