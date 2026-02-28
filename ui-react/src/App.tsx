import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { InlineLoading, Theme } from "@carbon/react";
import Shell from "./components/Shell";
import Dashboard from "./pages/Dashboard";
import Factory from "./pages/Factory";
import ContentFactory from "./pages/ContentFactory"; // New Modular Cloud Module
import Console from "./pages/Console"; // New Central Console Hub
import MatrixGridPage from "./pages/MatrixGridPage";
import CsvBrowser from "./pages/CsvBrowser";
import BrandDna from "./pages/BrandDna";
import SemanticMapPage from "./pages/SemanticMapPage";
import ComplianceAuditPage from "./pages/ComplianceAuditPage";
import QuantumObservabilityPage from "./pages/QuantumObservabilityPage";
import Schedule from "./pages/Schedule";
import Settings from "./pages/Settings";
import Observatory from "./pages/Observatory";
import ObservatoryPricing from "./pages/ObservatoryPricing";
import HandoverHubPage from "./pages/HandoverHubPage";
import GlobalHealthDashboard from "./pages/admin/GlobalHealthDashboard";
import TenantMasterList from "./pages/admin/TenantMasterList";
import APIConnectorHub from "./pages/admin/APIConnectorHub";
import SystemTopologyHub from "./pages/admin/SystemTopologyHub";
import CommerceCatalog from "./pages/admin/CommerceCatalog";
import CarbonComponentsShowcase from "./pages/admin/CarbonComponentsShowcase";
import Architect from "./pages/Architect";
import Login from "./pages/Login";
import MasterLogin from "./pages/MasterLogin";
import WixPasswordRecovery from "./pages/WixPasswordRecovery";
import NotificationProvider from "./components/NotificationProvider";
import AccessDenied from "./components/AccessDenied";
import { api, type MeResponse, type Permission } from "./services/api";
import { AuthProvider, hasPermission } from "./contexts/AuthContext";

function Guard({
  me,
  permission,
  children,
}: {
  me: MeResponse;
  permission: Permission;
  children: ReactNode;
}) {
  if (!me.authenticated || !hasPermission(permission, me)) {
    return (
      <AccessDenied message="A conta atual não tem permissão para este módulo." />
    );
  }
  return <>{children}</>;
}

export default function App() {
  const location = useLocation();
  const [me, setMe] = useState<MeResponse>({
    authenticated: false,
    user: null,
    tenant: null,
  });
  const [loading, setLoading] = useState(true);

  const refreshMe = async (): Promise<MeResponse> => {
    try {
      const data = await api.getMe();
      setMe(data);
      return data;
    } catch {
      const fallback = { authenticated: false, user: null, tenant: null };
      setMe(fallback);
      return fallback;
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await refreshMe();
      if (!cancelled) {
        setMe(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async (email: string): Promise<boolean> => {
    api.setActiveUserEmail(email);
    const data = await refreshMe();
    if (data.authenticated) {
      sessionStorage.setItem("genOS_system_analysis_after_login", "1");
    }
    return Boolean(data.authenticated);
  };

  if (loading) {
    return (
      <Theme theme="g100">
        <div className="page-loading">
          <InlineLoading description="Carregando sessão..." />
        </div>
      </Theme>
    );
  }

  if (location.pathname === "/login" || location.pathname === "/auth/login") {
    return (
      <Theme theme="g100">
        <AuthProvider value={me}>
          <Login authenticated={me.authenticated} onLogin={handleLogin} />
        </AuthProvider>
      </Theme>
    );
  }

  if (location.pathname === "/master-login") {
    return (
      <Theme theme="g100">
        <AuthProvider value={me}>
          <MasterLogin authenticated={me.authenticated} onLogin={handleLogin} />
        </AuthProvider>
      </Theme>
    );
  }

  if (location.pathname === "/auth/forgot") {
    return (
      <Theme theme="g100">
        <WixPasswordRecovery />
      </Theme>
    );
  }

  if (!me.authenticated) {
    return (
      <Theme theme="g100">
        <Navigate to="/login" replace />
      </Theme>
    );
  }

  return (
    <Theme theme="g100">
      <AuthProvider value={me}>
        <NotificationProvider>
          <Shell me={me}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/console" element={<Console />} />
              <Route path="/architect" element={<Architect />} />
              <Route path="/factory" element={<Factory />} />
              <Route path="/content-factory" element={<ContentFactory />} />
              <Route path="/factory/matrix" element={<MatrixGridPage />} />
              <Route path="/factory/audit" element={<ComplianceAuditPage />} />
              <Route path="/csv-browser" element={<CsvBrowser />} />
              <Route path="/brand-dna" element={<BrandDna />} />
              <Route path="/brand-dna/semantic" element={<SemanticMapPage />} />
              <Route path="/schedule" element={<Schedule />} />
              <Route path="/settings" element={<Settings />} />
              <Route
                path="/observatory"
                element={
                  <Guard me={me} permission="observatory.read">
                    <Observatory />
                  </Guard>
                }
              />
              <Route
                path="/observatory/quantum"
                element={
                  <Guard me={me} permission="observatory.read">
                    <QuantumObservabilityPage />
                  </Guard>
                }
              />
              <Route
                path="/observatory/pricing"
                element={
                  <Guard me={me} permission="pricing.read">
                    <ObservatoryPricing />
                  </Guard>
                }
              />
              <Route
                path="/admin/health"
                element={
                  <Guard me={me} permission="tenants.manage">
                    <GlobalHealthDashboard />
                  </Guard>
                }
              />
              <Route
                path="/admin/tenants"
                element={
                  <Guard me={me} permission="tenants.manage">
                    <TenantMasterList />
                  </Guard>
                }
              />
              <Route
                path="/admin/api-hub"
                element={
                  <Guard me={me} permission="tenants.manage">
                    <APIConnectorHub />
                  </Guard>
                }
              />
              <Route
                path="/admin/topology"
                element={
                  <Guard me={me} permission="tenants.manage">
                    <SystemTopologyHub />
                  </Guard>
                }
              />
              <Route
                path="/admin/commerce"
                element={
                  <Guard me={me} permission="tenants.manage">
                    <CommerceCatalog />
                  </Guard>
                }
              />
              <Route
                path="/admin/components"
                element={
                  <Guard me={me} permission="tenants.manage">
                    <CarbonComponentsShowcase />
                  </Guard>
                }
              />
              <Route path="/handover-hub" element={<HandoverHubPage />} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Shell>
        </NotificationProvider>
      </AuthProvider>
    </Theme>
  );
}
