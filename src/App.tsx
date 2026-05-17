/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { PlanProvider } from './hooks/usePlan';
import { ProtectedRoute } from './components/ProtectedRoute';
import { OnboardingWizard } from './components/OnboardingWizard';
import { Dashboard } from './pages/Dashboard';
import { Transacoes } from './pages/Transacoes';
import { MetasPage } from './pages/MetasPage';
import { ImportPage } from './pages/ImportPage';
import { ChatPage } from './pages/ChatPage';
import { Simulador } from './components/Simulador';
import { Login } from './pages/Login';
import { FinanceChat } from './components/FinanceChat';

export default function App() {
  return (
    <AuthProvider>
      <PlanProvider>
        <BrowserRouter>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute>
                <OnboardingWizard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transacoes"
            element={
              <ProtectedRoute>
                <Transacoes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/metas"
            element={
              <ProtectedRoute>
                <MetasPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/importar"
            element={
              <ProtectedRoute>
                <ImportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/simulador"
            element={
              <ProtectedRoute>
                <Simulador />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <FinanceChat />
      </BrowserRouter>
      </PlanProvider>
    </AuthProvider>
  );
}
