/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { PlanProvider } from './hooks/usePlan';
import { ProtectedRoute } from './components/ProtectedRoute';
import { OnboardingWizard } from './components/OnboardingWizard';
import { Dashboard } from './components/Dashboard';
import { ImportData } from './components/ImportData';
import { Metas } from './components/Metas';
import { FinanceChat } from './components/FinanceChat';
import { Simulador } from './components/Simulador';
import { Login } from './components/Login';

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
            path="/importar"
            element={
              <ProtectedRoute>
                <ImportData />
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
          <Route
            path="/metas"
            element={
              <ProtectedRoute>
                <Metas />
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
