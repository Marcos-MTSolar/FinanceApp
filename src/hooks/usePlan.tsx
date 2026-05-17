import React, { useState, createContext, useContext, useEffect } from 'react';
import { useAuth } from './useAuth';
import { ShieldAlert, Zap, Check } from 'lucide-react';

export type PlanType = 'Free' | 'Pro' | 'Empresarial';

interface PlanContextType {
  plan: PlanType;
  isUpgradeModalOpen: boolean;
  openUpgradeModal: (feature?: string) => void;
  closeUpgradeModal: () => void;
  checkAccess: (requiredPlan: PlanType, feature?: string) => boolean;
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [plan, setPlan] = useState<PlanType>('Free');
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [blockedFeature, setBlockedFeature] = useState<string>('');

  useEffect(() => {
    if (profile?.plano) {
      setPlan(profile.plano as PlanType);
    }
  }, [profile]);

  const checkAccess = (requiredPlan: PlanType, feature?: string): boolean => {
    return true; // Libera todas as features por enquanto
  };

  const openUpgradeModal = (feature?: string) => {
    if (feature) setBlockedFeature(feature);
    setIsUpgradeModalOpen(true);
  };

  const closeUpgradeModal = () => {
    setIsUpgradeModalOpen(false);
    setBlockedFeature('');
  };

  return (
    <PlanContext.Provider value={{ plan, isUpgradeModalOpen, openUpgradeModal, closeUpgradeModal, checkAccess }}>
      {children}
      {isUpgradeModalOpen && (
        <UpgradeModal onClose={closeUpgradeModal} feature={blockedFeature} plan={plan} />
      )}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const context = useContext(PlanContext);
  if (!context) throw new Error('usePlan must be used within PlanProvider');
  return context;
}

function UpgradeModal({ onClose, feature, plan }: { onClose: () => void, feature: string, plan: PlanType }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col md:flex-row relative">
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 flex justify-center items-center bg-black/10 rounded-full hover:bg-black/20 text-gray-800 dark:text-white">✕</button>
        
        {/* Banner esquerdo */}
        <div className="md:w-1/3 bg-indigo-600 p-8 text-white flex flex-col justify-center">
          <ShieldAlert className="w-12 h-12 text-indigo-300 mb-6" />
          <h2 className="text-3xl font-bold mb-4 tracking-tight">Evolua seu Financiamento</h2>
          <p className="text-indigo-200 mb-8 leading-relaxed">
            {feature 
              ? `O recurso de ${feature} é exclusivo para assinantes. Faça o upgrade para desbloquear.`
              : 'Desbloqueie todo o poder da inteligência artificial nas suas finanças.'}
          </p>
          <div className="text-sm font-semibold px-4 py-2 bg-indigo-800/50 rounded-full inline-block w-max">
            Plano atual: {plan}
          </div>
        </div>

        {/* Planos direito */}
        <div className="md:w-2/3 p-8 bg-gray-50 dark:bg-gray-900 grid grid-cols-1 sm:grid-cols-2 gap-6">
          
          {/* Card Pro */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border-2 border-indigo-500 shadow-xl shadow-indigo-100 dark:shadow-none relative">
            <div className="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">POPULAR</div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Pro</h3>
            <div className="flex items-end mb-6">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">R$ 29</span>
              <span className="text-gray-500 ml-1 mb-1">/mês</span>
            </div>
            <ul className="space-y-3 mb-8 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex"><Check className="w-5 h-5 text-indigo-500 mr-2 shrink-0" /> Importações Ilimitadas</li>
              <li className="flex"><Check className="w-5 h-5 text-indigo-500 mr-2 shrink-0" /> Chat IA Financeiro</li>
              <li className="flex"><Check className="w-5 h-5 text-indigo-500 mr-2 shrink-0" /> Simulador de Cenários Avançado</li>
              <li className="flex"><Check className="w-5 h-5 text-indigo-500 mr-2 shrink-0" /> Relatórios em PDF Exportáveis</li>
            </ul>
            <button className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition flex justify-center items-center">
              Assinar Pro <Zap className="w-4 h-4 ml-2" />
            </button>
          </div>

          {/* Card Empresarial */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-gray-600 transition">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Empresarial</h3>
            <div className="flex items-end mb-6">
              <span className="text-3xl font-bold text-gray-900 dark:text-white">R$ 79</span>
              <span className="text-gray-500 ml-1 mb-1">/mês</span>
            </div>
            <ul className="space-y-3 mb-8 text-sm text-gray-600 dark:text-gray-300">
              <li className="flex"><Check className="w-5 h-5 text-gray-400 mr-2 shrink-0" /> Tudo do Pro</li>
              <li className="flex"><Check className="w-5 h-5 text-gray-400 mr-2 shrink-0" /> Múltiplos Usuários</li>
              <li className="flex"><Check className="w-5 h-5 text-gray-400 mr-2 shrink-0" /> Acesso para Contador</li>
              <li className="flex"><Check className="w-5 h-5 text-gray-400 mr-2 shrink-0" /> Integração de Notas Fiscais NFe</li>
            </ul>
            <button className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition">
              Assinar Empresarial
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
