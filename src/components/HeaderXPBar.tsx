import React from 'react';
import { getLevelInfo } from '../lib/gamification';
import { Star } from 'lucide-react';

export function HeaderXPBar({ xp, showBar = true }: { xp: number, showBar?: boolean }) {
  const { currentLevel, nextLevel, progress } = getLevelInfo(xp);

  return (
    <div className="flex flex-col flex-1 max-w-[200px]">
      <div className="flex justify-between items-end mb-1 text-xs font-semibold">
        <span className={`flex items-center ${currentLevel.color}`}>
          <Star className="w-3 h-3 mr-1 fill-current" />
          Nível {currentLevel.level}: {currentLevel.name}
        </span>
        {nextLevel && (
           <span className="text-gray-400 dark:text-gray-500">
             {xp} / {nextLevel.minXp} XP
           </span>
        )}
      </div>
      {showBar && (
        <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all duration-1000 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}
