/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    console.error('ErrorBoundary capturou:', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: 'white', background: '#111' }}>
          <h2>Erro capturado:</h2>
          <pre>{this.state.error?.message}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
import { AuthProvider } from './hooks/useAuth';
import { PlanProvider } from './hooks/usePlan';
import { ProtectedRoute } from './components/ProtectedRoute';
import { OnboardingWizard } from './components/OnboardingWizard';
import { Dashboard } from './pages/Dashboard';
import { Transacoes } from './pages/Transacoes';
import { MetasPage } from './pages/MetasPage';
import { ImportPage } from './pages/ImportPage';
import { ChatPage } from './pages/ChatPage';
import { NiveisPage } from './pages/NiveisPage';
import { Simulador } from './components/Simulador';
import { Login } from './pages/Login';
import { Toaster } from 'react-hot-toast';
import { RendaExtra } from './pages/RendaExtra';
import { FinanceChat } from './components/FinanceChat';
import { CadastroEmpresaPage } from './pages/CadastroEmpresaPage';
import { FuncionariosPage } from './pages/FuncionariosPage';
import { RescisaoPage } from './pages/RescisaoPage';
import { ReservaTrabalhistaPage } from './pages/ReservaTrabalhistaPage';
import { ImpostosPage } from './pages/ImpostosPage';
import { CentroCustosPage } from './pages/CentroCustosPage';
import { IndicadoresPage } from './pages/IndicadoresPage';
import { DemonstrativosPage } from './pages/DemonstrativosPage';
import { PlanoContasPage } from './pages/PlanoContasPage';
import { ConciliacaoPage } from './pages/ConciliacaoPage';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <PlanProvider>
          <Router>
            <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
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
                path="/renda-extra"
                element={
                  <ProtectedRoute>
                    <RendaExtra />
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
                path="/niveis"
                element={
                  <ProtectedRoute>
                    <NiveisPage />
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
                path="/empresa/cadastro"
                element={
                  <ProtectedRoute>
                    <CadastroEmpresaPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/empresa/funcionarios"
                element={
                  <ProtectedRoute>
                    <FuncionariosPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/empresa/rescisao" element={<ProtectedRoute><RescisaoPage /></ProtectedRoute>} />
              <Route path="/empresa/reservas" element={<ProtectedRoute><ReservaTrabalhistaPage /></ProtectedRoute>} />
              <Route path="/empresa/impostos" element={<ProtectedRoute><ImpostosPage /></ProtectedRoute>} />
              <Route path="/empresa/centro-custos" element={<ProtectedRoute><CentroCustosPage /></ProtectedRoute>} />
              <Route path="/empresa/indicadores" element={<ProtectedRoute><IndicadoresPage /></ProtectedRoute>} />
              <Route path="/empresa/demonstrativos" element={<ProtectedRoute><DemonstrativosPage /></ProtectedRoute>} />
              <Route path="/empresa/plano-contas" element={<ProtectedRoute><PlanoContasPage /></ProtectedRoute>} />
              <Route path="/empresa/conciliacao" element={<ProtectedRoute><ConciliacaoPage /></ProtectedRoute>} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            <FinanceChat />
          </Router>
        </PlanProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
