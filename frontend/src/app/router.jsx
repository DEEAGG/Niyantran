import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';

// Pages
import Dashboard from '../pages/Dashboard';
import Applications from '../pages/Applications';
import CreateApplication from '../pages/CreateApplication';
import ApplicationDetails from '../pages/ApplicationDetails';
import UploadDocuments from '../pages/UploadDocuments';
import ExtractionResults from '../pages/ExtractionResults';
import ValidationCenter from '../pages/ValidationCenter';
import EvidenceExplorer from '../pages/EvidenceExplorer';
import Rules from '../pages/Rules';
import RuleDetails from '../pages/RuleDetails';
import RuleVersions from '../pages/RuleVersions';
import Replay from '../pages/Replay';
import ReplayDetails from '../pages/ReplayDetails';
import ReviewCenter from '../pages/ReviewCenter';
import Reports from '../pages/Reports';
import AuditHistory from '../pages/AuditHistory';
import Settings from '../pages/Settings';
import NotFound from '../pages/NotFound';
import PassportPage from '../pages/PassportPage';
import IntelligencePage from '../pages/IntelligencePage';
import MonitoringPage from '../pages/MonitoringPage';
import VerificationHub from '../pages/VerificationHub';
import ReportsAuditHub from '../pages/ReportsAuditHub';
import GuidedDemo from '../pages/GuidedDemo';
import CoreFeaturesPage from '../pages/CoreFeaturesPage';
import CrossDocumentChecker from '../pages/CrossDocumentChecker';
import Login from '../pages/Login';
import Register from '../pages/Register';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import RouteErrorBoundary from '../components/common/RouteErrorBoundary';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/register',
    element: <Register />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <Dashboard />,
      },
      {
        path: 'demo',
        element: <GuidedDemo />,
      },
      {
        path: 'cases',
        element: <Applications />,
      },
      {
        path: 'features',
        element: <CoreFeaturesPage />,
      },
      {
        path: 'cross-check',
        element: <CrossDocumentChecker />,
      },
      {
        path: 'consistency',
        element: <CrossDocumentChecker />,
      },
      {
        path: 'evidence',
        element: <EvidenceExplorer />,
      },
      {
        path: 'authenticity',
        element: <PassportPage />,
      },
      {
        path: 'passport',
        element: <PassportPage />,
      },
      {
        path: 'intelligence',
        element: <CoreFeaturesPage />,
      },
      {
        path: 'monitoring',
        element: <MonitoringPage />,
      },
      {
        path: 'applications',
        element: <Applications />,
      },
      {
        path: 'applications/new',
        element: <CreateApplication />,
      },
      {
        path: 'applications/:id',
        element: <ApplicationDetails />,
      },
      {
        path: 'applications/:id/documents',
        element: <UploadDocuments />,
      },
      {
        path: 'applications/:id/findings',
        element: <ValidationCenter />,
      },
      {
        path: 'applications/:id/extraction',
        element: <ExtractionResults />,
      },
      {
        path: 'applications/:id/evidence',
        element: <EvidenceExplorer />,
      },
      {
        path: 'upload',
        element: <UploadDocuments />,
      },
      {
        path: 'verification',
        element: <VerificationHub />,
      },
      {
        path: 'compliance',
        element: <VerificationHub />,
      },
      {
        path: 'extraction',
        element: <ExtractionResults />,
      },
      {
        path: 'validation',
        element: <VerificationHub />,
      },
      {
        path: 'rules',
        element: <Rules />,
      },
      {
        path: 'rules/:id',
        element: <RuleDetails />,
      },
      {
        path: 'rules/:id/versions',
        element: <RuleVersions />,
      },
      {
        path: 'replay',
        element: <Replay />,
      },
      {
        path: 'replay/:id',
        element: <ReplayDetails />,
      },
      {
        path: 'review',
        element: <ReviewCenter />,
      },
      {
        path: 'reports',
        element: <ReportsAuditHub />,
      },
      {
        path: 'audit',
        element: <ReportsAuditHub />,
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
]);

export default router;
