import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import RouteErrorBoundary from '../components/common/RouteErrorBoundary';

const AppLayout = lazy(() => import('../components/layout/AppLayout'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const Applications = lazy(() => import('../pages/Applications'));
const CreateApplication = lazy(() => import('../pages/CreateApplication'));
const ApplicationDetails = lazy(() => import('../pages/ApplicationDetails'));
const UploadDocuments = lazy(() => import('../pages/UploadDocuments'));
const ExtractionResults = lazy(() => import('../pages/ExtractionResults'));
const ValidationCenter = lazy(() => import('../pages/ValidationCenter'));
const EvidenceExplorer = lazy(() => import('../pages/EvidenceExplorer'));
const Rules = lazy(() => import('../pages/Rules'));
const RuleDetails = lazy(() => import('../pages/RuleDetails'));
const RuleVersions = lazy(() => import('../pages/RuleVersions'));
const Replay = lazy(() => import('../pages/Replay'));
const ReplayDetails = lazy(() => import('../pages/ReplayDetails'));
const ReviewCenter = lazy(() => import('../pages/ReviewCenter'));
const Reports = lazy(() => import('../pages/Reports'));
const AuditHistory = lazy(() => import('../pages/AuditHistory'));
const Settings = lazy(() => import('../pages/Settings'));
const PassportPage = lazy(() => import('../pages/PassportPage'));
const IntelligencePage = lazy(() => import('../pages/IntelligencePage'));
const MonitoringPage = lazy(() => import('../pages/MonitoringPage'));
const VerificationHub = lazy(() => import('../pages/VerificationHub'));
const ReportsAuditHub = lazy(() => import('../pages/ReportsAuditHub'));
const GuidedDemo = lazy(() => import('../pages/GuidedDemo'));
const CoreFeaturesPage = lazy(() => import('../pages/CoreFeaturesPage'));
const CrossDocumentChecker = lazy(() => import('../pages/CrossDocumentChecker'));
const Login = lazy(() => import('../pages/Login'));
const Register = lazy(() => import('../pages/Register'));

function RouteLoading() {
  return (
    <div role="status" aria-live="polite" className="min-h-[35vh] flex items-center justify-center text-sm text-slate-500">
      Loading workspace…
    </div>
  );
}

const page = (Component) => (
  <Suspense fallback={<RouteLoading />}>
    <Component />
  </Suspense>
);

export const router = createBrowserRouter([
  { path: '/login', element: page(Login) },
  { path: '/register', element: page(Register) },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        {page(AppLayout)}
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: page(Dashboard) },
      { path: 'demo', element: page(GuidedDemo) },
      { path: 'cases', element: page(Applications) },
      { path: 'features', element: page(CoreFeaturesPage) },
      { path: 'cross-check', element: page(CrossDocumentChecker) },
      { path: 'consistency', element: page(CrossDocumentChecker) },
      { path: 'evidence', element: page(EvidenceExplorer) },
      { path: 'authenticity', element: page(PassportPage) },
      { path: 'passport', element: page(PassportPage) },
      { path: 'intelligence', element: page(CoreFeaturesPage) },
      { path: 'monitoring', element: page(MonitoringPage) },
      { path: 'applications', element: page(Applications) },
      { path: 'applications/new', element: page(CreateApplication) },
      { path: 'applications/:id', element: page(ApplicationDetails) },
      { path: 'applications/:id/documents', element: page(UploadDocuments) },
      { path: 'applications/:id/findings', element: page(ValidationCenter) },
      { path: 'applications/:id/extraction', element: page(ExtractionResults) },
      { path: 'applications/:id/evidence', element: page(EvidenceExplorer) },
      { path: 'upload', element: page(UploadDocuments) },
      { path: 'verification', element: page(VerificationHub) },
      { path: 'compliance', element: page(VerificationHub) },
      { path: 'extraction', element: page(ExtractionResults) },
      { path: 'validation', element: page(VerificationHub) },
      { path: 'rules', element: page(Rules) },
      { path: 'rules/:id', element: page(RuleDetails) },
      { path: 'rules/:id/versions', element: page(RuleVersions) },
      { path: 'replay', element: page(Replay) },
      { path: 'replay/:id', element: page(ReplayDetails) },
      { path: 'review', element: page(ReviewCenter) },
      { path: 'reports', element: page(ReportsAuditHub) },
      { path: 'audit', element: page(ReportsAuditHub) },
      { path: 'settings', element: page(Settings) },
      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
]);

export default router;
