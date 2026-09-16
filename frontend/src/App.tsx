// ============================================================================
// ADALAT360 - Main App Component
// Routing and layout
// ============================================================================

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useAuthStore } from './hooks/useAuthStore';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/auth/LoginPage';
import { MfaVerifyPage } from './pages/auth/MfaVerifyPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { RolePermissions, UserRole } from './types';
import { ROLE_PERMISSIONS } from './types';

const lazyPage = (importer: () => Promise<any>, exportName?: string) =>
  lazy(async () => {
    const module = await importer();
    const resolved = exportName ? module[exportName] ?? module.default : module.default;

    if (!resolved) {
      throw new Error(`Failed to resolve page export for ${exportName ?? 'default'}`);
    }

    return { default: resolved };
  });

const DashboardPage = lazyPage(() => import('./pages/DashboardPage'), 'DashboardPage');
const CasesPage = lazyPage(() => import('./pages/CasesPage'), 'CasesPage');
const CaseDetailPage = lazyPage(() => import('./pages/CaseDetailPage'), 'CaseDetailPage');
const DocumentsPage = lazyPage(() => import('./pages/DocumentsPage'), 'DocumentsPage');
const DocumentDetailPage = lazyPage(() => import('./pages/DocumentDetailPage'), 'DocumentDetailPage');
const EvidencePage = lazyPage(() => import('./pages/EvidencePage'), 'EvidencePage');
const EvidenceDetailPage = lazyPage(() => import('./pages/EvidenceDetailPage'), 'EvidenceDetailPage');
const SearchPage = lazyPage(() => import('./pages/SearchPage'), 'SearchPage');
const TimelinePage = lazyPage(() => import('./pages/TimelinePage'), 'TimelinePage');
const EntityGraphPage = lazyPage(() => import('./pages/EntityGraphPage'), 'EntityGraphPage');
const BsaCertificatePage = lazyPage(() => import('./pages/BsaCertificatePage'), 'BsaCertificatePage');
const AuditPage = lazyPage(() => import('./pages/AuditPage'), 'AuditPage');
const AdminUsersPage = lazyPage(() => import('./pages/admin/AdminUsersPage'), 'AdminUsersPage');
const AdminConfigPage = lazyPage(() => import('./pages/admin/AdminConfigPage'), 'AdminConfigPage');
const AdminBlockchainPage = lazyPage(() => import('./pages/admin/AdminBlockchainPage'), 'AdminBlockchainPage');
const RtiPage = lazyPage(() => import('./pages/RtiPage'), 'RtiPage');
const ProfilePage = lazyPage(() => import('./pages/ProfilePage'), 'ProfilePage');
const SettingsPage = lazyPage(() => import('./pages/SettingsPage'), 'SettingsPage');

// Loading component for Suspense
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-10 w-10 border-3 border-primary-500 border-t-transparent"></div>
  </div>
);

// Protected route wrapper
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredPermission?: keyof RolePermissions;
}

function ProtectedRoute({ children, allowedRoles, requiredPermission }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  // Check permission
  if (requiredPermission && user) {
    const permissions = ROLE_PERMISSIONS[user.role];
    if (!permissions[requiredPermission]) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}

function App() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" replace />} />
        <Route path="/mfa/verify" element={!isAuthenticated ? <MfaVerifyPage /> : <Navigate to="/" replace />} />
        <Route path="/forgot-password" element={!isAuthenticated ? <ForgotPasswordPage /> : <Navigate to="/" replace />} />
        <Route path="/reset-password" element={!isAuthenticated ? <ResetPasswordPage /> : <Navigate to="/" replace />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />

          {/* Cases */}
          <Route path="cases" element={<CasesPage />} />
          <Route path="cases/:caseId" element={<CaseDetailPage />} />

          {/* Documents */}
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="cases/:caseId/documents" element={<DocumentsPage />} />
          <Route path="documents/:documentId" element={<DocumentDetailPage />} />

          {/* Evidence */}
          <Route path="evidence" element={<EvidencePage />} />
          <Route path="cases/:caseId/evidence" element={<EvidencePage />} />
          <Route path="evidence/:evidenceId" element={<EvidenceDetailPage />} />

          {/* Search */}
          <Route path="search" element={<SearchPage />} />

          {/* Timeline & Analytics */}
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="cases/:caseId/timeline" element={<TimelinePage />} />
          <Route path="entity-graph" element={<EntityGraphPage />} />
          <Route path="cases/:caseId/entity-graph" element={<EntityGraphPage />} />

          {/* BSA Certificates */}
          <Route path="bsa" element={<BsaCertificatePage />} />
          <Route path="bsa/:certificateId" element={<BsaCertificatePage />} />

          {/* RTI */}
          <Route path="rti" element={<RtiPage />} />

          {/* Audit (Admin/Auditor) */}
          <Route
            path="audit"
            element={
              <ProtectedRoute allowedRoles={['CENTRAL_ADMIN', 'AUDITOR']}>
                <AuditPage />
              </ProtectedRoute>
            }
          />

          {/* Admin */}
          <Route
            path="admin/users"
            element={
              <ProtectedRoute allowedRoles={['CENTRAL_ADMIN', 'AUDITOR']}>
                <AdminUsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/config"
            element={
              <ProtectedRoute allowedRoles={['CENTRAL_ADMIN']}>
                <AdminConfigPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/blockchain"
            element={
              <ProtectedRoute allowedRoles={['CENTRAL_ADMIN', 'AUDITOR']}>
                <AdminBlockchainPage />
              </ProtectedRoute>
            }
          />

          {/* Profile & Settings */}
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Unauthorized */}
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md mx-auto px-4 text-center">
        <div className="bg-white rounded-xl shadow-card p-8">
          <div className="w-16 h-16 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-danger-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">
            You don't have permission to access this page. Please contact your administrator if you believe this is an error.
          </p>
          <button
            onClick={() => window.history.back()}
            className="btn-primary"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md mx-auto px-4 text-center">
        <div className="bg-white rounded-xl shadow-card p-8">
          <h1 className="text-6xl font-bold text-primary-600 mb-2">404</h1>
          <p className="text-gray-600 mb-6">The page you're looking for doesn't exist.</p>
          <button onClick={() => window.location.href = '/'} className="btn-primary">
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;