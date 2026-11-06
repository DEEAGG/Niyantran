import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/common/BrandLogo';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.message || 'Invalid email or password. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-3 sm:p-4 selection:bg-accent selection:text-background">
      {/* Main Centered Sign-in Card */}
      <div className="w-full max-w-[440px] bg-surface rounded-xl border border-border shadow-surface p-5 sm:p-6 animate-fadeIn">
        {/* Brand Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center mb-3">
            <BrandLogo size="md" showSubtitle={false} />
          </div>
          <h1 className="text-lg sm:text-xl font-semibold text-text-primary tracking-tight">
            Institutional Sign In
          </h1>
          <p className="text-xs text-text-muted mt-1">
            AICTE Regulatory Verification &amp; Evidence Management
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-3 p-2.5 rounded-lg bg-status-error-bg border border-status-error/30 text-xs text-status-error flex items-start gap-2 animate-fadeIn">
            <span className="font-bold shrink-0">&times;</span>
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@aicte.gov.in"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border bg-input-background text-input-text placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-focus-ring transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-9 pr-9 py-2 text-xs rounded-lg border border-border bg-input-background text-input-text placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-focus-ring transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary focus:outline-none cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-1 py-2.5 px-4 rounded-lg bg-accent hover:bg-accent-hover text-accent-foreground font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>Sign In to Niyantran</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Footer info & Register link */}
        <div className="mt-4 pt-3 border-t border-border-subtle text-center space-y-1.5">
          <p className="text-xs text-text-muted">
            Don't have an institution account?{' '}
            <Link to="/register" className="font-semibold text-accent hover:text-accent-hover">
              Register Institution
            </Link>
          </p>
          <div className="text-[10px] text-text-muted font-mono">
            Secured by AICTE ReguTrace Cryptographic RBAC
          </div>
        </div>
      </div>
    </div>
  );
}
