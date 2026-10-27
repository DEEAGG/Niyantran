import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Home } from 'lucide-react';
import Button from '../components/common/Button';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 animate-fadeIn">
      <div className="w-14 h-14 bg-rose-500/15 border border-rose-500/30 rounded-2xl flex items-center justify-center mb-6">
        <ShieldAlert className="w-7 h-7 text-rose-400" />
      </div>
      <h1 className="text-3xl font-extrabold text-text-primary tracking-tight mb-2 font-mono">
        404 — Record or Route Not Found
      </h1>
      <p className="text-text-secondary max-w-md mb-8 text-xs sm:text-sm leading-relaxed">
        The requested regulatory compliance dossier, rule specification, or verification view does not exist or has been archived.
      </p>
      <div className="flex items-center gap-3">
        <Link to="/dashboard">
          <Button variant="primary" icon={Home}>
            Back to Command Center
          </Button>
        </Link>
        <Button
          variant="outline"
          icon={ArrowLeft}
          onClick={() => window.history.back()}
        >
          Go Back
        </Button>
      </div>
    </div>
  );
}
