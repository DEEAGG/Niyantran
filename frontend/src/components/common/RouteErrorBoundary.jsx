import React from 'react';
import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { ShieldAlert, AlertTriangle, ArrowLeft, Home, RefreshCw } from 'lucide-react';
import Button from './Button';
import NotFound from '../../pages/NotFound';

export default function RouteErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFound />;
  }

  const errorMessage = error?.message || (typeof error === 'string' ? error : 'An unexpected exception occurred during view render.');

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 animate-fadeIn">
      <div className="w-14 h-14 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-center justify-center mb-6">
        <AlertTriangle className="w-7 h-7 text-amber-500" />
      </div>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight mb-2 font-mono">
        Regulatory Workspace Render Notice
      </h1>
      <p className="text-text-secondary max-w-lg mb-4 text-xs sm:text-sm leading-relaxed">
        The platform encountered an issue preparing this regulatory dossier view.
      </p>
      <div className="max-w-md p-3 mb-6 rounded-lg bg-surface-secondary border border-border text-left font-mono text-xs text-rose-600 break-words">
        {errorMessage}
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          icon={RefreshCw}
          onClick={() => window.location.reload()}
        >
          Reload View
        </Button>
        <Link to="/dashboard">
          <Button variant="outline" icon={Home}>
            Command Center
          </Button>
        </Link>
      </div>
    </div>
  );
}
