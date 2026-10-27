import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, Building, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/common/BrandLogo';
import AnimatedGradient, { NIYANTRAN_BRAND_GRADIENT } from '../components/ui/animated-gradient';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [institutionName, setInstitutionName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!institutionName.trim()) {
      setError('Institution / College name is required.');
      return;
    }
    if (!fullName.trim()) {
      setError('Full name of the authorized officer is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please provide a valid institutional email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      await register({
        institution_name: institutionName.trim(),
        full_name: fullName.trim(),
        email: email.trim(),
        password,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err?.message || 'Failed to complete registration. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-[#F7F6F2] flex items-center justify-center p-4 selection:bg-[#E43D12] selection:text-white">
      {/* Background Animated Gradient Layer */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden" 
        aria-hidden="true"
      >
        <AnimatedGradient
          config={NIYANTRAN_BRAND_GRADIENT}
          className="w-full h-full opacity-45"
          noise={{ opacity: 0.08, scale: 1 }}
        />
      </div>

      {/* Main Centered Registration Card */}
      <div className="relative z-10 w-full max-w-[460px] bg-white rounded-2xl shadow-xl border border-[#E4E2DC] p-6 sm:p-8 animate-fadeIn my-6">
        {/* Brand Header */}
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center mb-2">
            <BrandLogo size="md" showSubtitle={false} />
          </div>
          <h1 className="text-xl font-bold text-[#141B26] tracking-tight">
            Register Institution
          </h1>
          <p className="text-xs text-[#6B7280] mt-1">
            Create an authorized institution portal for AICTE compliance
          </p>
        </div>

        {/* Informational Banner */}
        <div className="mb-4 p-2.5 rounded-lg bg-[#FAF9F5] border border-[#EBE8DF] text-[11px] text-[#6B7280] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#E43D12] shrink-0" />
          <span>Creates an isolated institution workspace with dedicated document vaults.</span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2 animate-fadeIn">
            <span className="font-bold shrink-0">&times;</span>
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1">
              Institution / College Name
            </label>
            <div className="relative">
              <Building className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder="e.g. Dr. Akhilesh Das Gupta Institute (ADGIPS)"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#D1D5DB] bg-white text-[#111827] focus:outline-none focus:border-[#E43D12] focus:ring-1 focus:ring-[#E43D12] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1">
              Authorized Officer Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Prof. Rajesh Kumar"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#D1D5DB] bg-white text-[#111827] focus:outline-none focus:border-[#E43D12] focus:ring-1 focus:ring-[#E43D12] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1">
              Institutional Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="compliance@institution.edu.in"
                className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#D1D5DB] bg-white text-[#111827] focus:outline-none focus:border-[#E43D12] focus:ring-1 focus:ring-[#E43D12] transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#D1D5DB] bg-white text-[#111827] focus:outline-none focus:border-[#E43D12] focus:ring-1 focus:ring-[#E43D12] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-[#D1D5DB] bg-white text-[#111827] focus:outline-none focus:border-[#E43D12] focus:ring-1 focus:ring-[#E43D12] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded-lg bg-[#E43D12] hover:bg-[#c9340e] text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <span>Creating Account...</span>
            ) : (
              <>
                <span>Complete Institutional Registration</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Footer info & Login link */}
        <div className="mt-5 pt-3.5 border-t border-[#F3F4F6] text-center">
          <p className="text-xs text-[#6B7280]">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-[#E43D12] hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
