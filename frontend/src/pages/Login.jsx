import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/common/BrandLogo';
import AnimatedGradient, { NIYANTRAN_BRAND_GRADIENT } from '../components/ui/animated-gradient';

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
    <div className="min-h-screen relative bg-[#F7F6F2] flex items-center justify-center p-3 sm:p-4 selection:bg-[#E43D12] selection:text-white">
      {/* Background Animated Gradient Layer */}
      <div 
         
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none w-screen h-screen min-h-[100dvh]" 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100dvh',
          minHeight: '100vh',
          pointerEvents: 'none',
          zIndex: 0,
        }}
        aria-hidden="true"
      >
        <AnimatedGradient
          config={NIYANTRAN_BRAND_GRADIENT}
          className="w-full h-full opacity-55"
          noise={{ opacity: 0.08, scale: 1 }}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        />
      </div>

      {/* Main Centered Sign-in Card (preserves original 440px width & horizontal proportions) */}
      <div className="relative z-10 w-full max-w-[440px] bg-white rounded-2xl shadow-xl border border-[#E4E2DC] p-5 sm:p-6 animate-fadeIn">
        {/* Brand Header */}
        <div className="text-center mb-4">
          <div className="inline-flex items-center justify-center mb-2">
            <BrandLogo size="md" showSubtitle={false} />
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-[#141B26] tracking-tight">
            Institutional Sign In
          </h1>
          <p className="text-xs text-[#6B7280] mt-0.5">
            AICTE Regulatory Verification & Evidence Management
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2 animate-fadeIn">
            <span className="font-bold shrink-0">&times;</span>
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@aicte.gov.in"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#D1D5DB] bg-white text-[#111827] focus:outline-none focus:border-[#E43D12] focus:ring-1 focus:ring-[#E43D12] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-9 pr-9 py-2 text-xs rounded-lg border border-[#D1D5DB] bg-white text-[#111827] focus:outline-none focus:border-[#E43D12] focus:ring-1 focus:ring-[#E43D12] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] focus:outline-none cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-1 py-2.5 px-4 rounded-lg bg-[#E43D12] hover:bg-[#c9340e] text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-60 cursor-pointer"
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
        <div className="mt-4 pt-3 border-t border-[#F3F4F6] text-center space-y-1.5">
          <p className="text-xs text-[#6B7280]">
            Don't have an institution account?{' '}
            <Link to="/register" className="font-semibold text-[#E43D12] hover:underline">
              Register Institution
            </Link>
          </p>
          <div className="text-[10px] text-[#9CA3AF] font-mono">
            Secured by AICTE ReguTrace Cryptographic RBAC
          </div>
        </div>
      </div>
    </div>
  );
}
