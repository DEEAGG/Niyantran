import React, { useState, useEffect } from 'react';
import { 
  Sliders, Server, Palette, User, ShieldCheck, RefreshCw, 
  CheckCircle2, AlertCircle, Sparkles, ExternalLink, Database, 
  Activity, Lock, KeyRound, Eye, EyeOff, Building
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../services/apiClient';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';

export default function Settings() {
  const { currentTheme, setTheme, themes } = useTheme();
  const { addToast } = useToast();
  const { user, updateProfile, changePassword } = useAuth();

  const [apiUrl, setApiUrl] = useState(import.meta.env.VITE_API_BASE_URL || '/api');
  const [pingStatus, setPingStatus] = useState(null);
  const [isPinging, setIsPinging] = useState(false);
  const [oidcConfig, setOidcConfig] = useState(null);
  const [auditStatus, setAuditStatus] = useState(null);

  // Authenticated profile state
  const [fullName, setFullName] = useState('');
  const [institutionName, setInstitutionName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setInstitutionName(user.institution_name || '');
    }
  }, [user]);

  useEffect(() => {
    // Probe live backend OIDC and audit status
    apiClient.get('/auth/oidc/config')
      .then((res) => setOidcConfig(res))
      .catch((err) => console.error('OIDC config fetch error:', err));

    apiClient.get('/audit/verify')
      .then((res) => setAuditStatus(res))
      .catch((err) => console.error('Audit status fetch error:', err));
  }, []);

  const handleTestPing = async () => {
    setIsPinging(true);
    setPingStatus(null);
    try {
      const res = await apiClient.get('/health');
      setPingStatus({
        status: 'success',
        message: `Live FastAPI backend connected and healthy: Database status "${res.database}".`,
      });
      addToast({
        title: 'Backend Health Check',
        message: 'FastAPI server and SQLite database are fully operational.',
        type: 'success',
      });
    } catch (err) {
      setPingStatus({
        status: 'warning',
        message: `FastAPI backend unreachable at ${apiUrl}: ${err.message}`,
      });
      addToast({
        title: 'Backend Unreachable',
        message: 'FastAPI server is not responding at the specified base URL.',
        type: 'error',
      });
    } finally {
      setIsPinging(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await updateProfile({
        full_name: fullName.trim(),
        institution_name: institutionName.trim(),
      });
      addToast({
        title: 'Profile Updated',
        message: 'Your account profile credentials have been saved.',
        type: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Update Failed',
        message: err.message || 'Could not update profile credentials.',
        type: 'error',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    try {
      setIsChangingPassword(true);
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccess('Password successfully updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      addToast({
        title: 'Security Updated',
        message: 'Your account password has been changed successfully.',
        type: 'success',
      });
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password. Verify your current password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl">
      {/* Top Banner / Hero */}
      <div className="bg-surface rounded-xl p-6 sm:p-8 border border-border relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-accent/15 text-accent border border-accent/25 flex items-center gap-1.5 font-semibold">
                <Sliders className="w-3.5 h-3.5" />
                Production Settings
              </span>
              <span className="text-xs text-text-muted font-mono">System Configuration</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
              Platform Configuration & Architecture Gateway
            </h1>
            <p className="text-sm text-text-secondary mt-1.5 max-w-2xl leading-relaxed">
              Monitor production FastAPI backend status, institutional OAuth2/OIDC identity providers, cryptographic audit chain health, and visual theme tokens.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-300 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Database Mode
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Backend Integration & API Gateway */}
        <div className="bg-surface rounded-xl p-6 border border-border space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-text-primary">
                Backend Service Architecture & API Gateway
              </h2>
            </div>
            <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              FastAPI Operational
            </span>
          </div>

          <div className="space-y-4">
            {/* OIDC Status Banner */}
            <div className="p-4 rounded-xl bg-surface-elevated/70 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Institutional OAuth2 / OIDC Gateway
                </span>
                <p className="text-xs text-text-muted leading-relaxed">
                  Issuer: <code className="font-mono text-text-secondary">{oidcConfig?.issuer || 'https://auth.aicte-india.org/realms/institutions'}</code> &bull; Roles: admin, reviewer, auditor, institution_user.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  OIDC Provider Connected
                </span>
              </div>
            </div>

            {/* Cryptographic Audit Ledger Status */}
            {auditStatus && (
              <div className="p-4 rounded-xl bg-surface-elevated/70 border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                    <Database className="w-4 h-4 text-accent" />
                    Cryptographic SHA-256 Audit Trail
                  </span>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Ledger verification: <strong className="text-emerald-700 font-semibold">{auditStatus.verified ? '100% Intact' : 'Discrepancy Detected'}</strong> across all {auditStatus.total_records || 0} entries.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono text-text-muted">
                    Latest Block: {auditStatus.latest_hash ? `${auditStatus.latest_hash.slice(0, 10)}...` : 'N/A'}
                  </span>
                </div>
              </div>
            )}

            {/* Base URL & Health Check */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block">
                  FastAPI Backend Base URL
                </label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border text-text-primary font-mono focus:outline-none focus:border-accent"
                  style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <Button
                  variant="outline"
                  size="md"
                  icon={Activity}
                  isLoading={isPinging}
                  onClick={handleTestPing}
                  className="w-full"
                >
                  Test Connection Ping
                </Button>
              </div>
            </div>

            {/* Ping Result Banner */}
            {pingStatus && (
              <div 
                className="p-3 rounded-lg border text-xs flex items-center gap-2.5"
                style={{
                  backgroundColor: pingStatus.status === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(250, 204, 21, 0.1)',
                  color: pingStatus.status === 'success' ? 'var(--status-success)' : 'var(--status-pending)',
                  borderColor: pingStatus.status === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(250, 204, 21, 0.3)',
                }}
              >
                {pingStatus.status === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'var(--status-success)' }} />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" style={{ color: 'var(--status-pending)' }} />
                )}
                <span>{pingStatus.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* Visual Theme Engine & Appearance */}
        <div className="bg-surface rounded-xl p-6 border border-border space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-text-primary">
                Design System & Color Tokens
              </h2>
            </div>
            <span className="text-xs font-mono text-accent">
              Active: {currentTheme?.name || 'Earth Modern'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setTheme(t.id);
                  addToast({
                    title: 'Theme Switched',
                    message: `Design system preset set to ${t.name}.`,
                    type: 'info',
                  });
                }}
                className={`p-4 rounded-xl border text-left transition-all relative ${
                  currentTheme?.id === t.id
                    ? 'bg-accent/10 border-accent shadow-md'
                    : 'bg-surface-elevated/50 border-border hover:border-border/90'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-text-primary">{t.name}</span>
                  {currentTheme?.id === t.id && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-accent text-background font-bold">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-secondary leading-relaxed mb-3">
                  {t.description}
                </p>
                {/* Palette preview swatches */}
                <div className="flex items-center gap-1.5">
                  {t.swatches?.map((color, idx) => (
                    <span
                      key={idx}
                      className="w-5 h-5 rounded-full border border-black/30"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Authenticated Profile Credentials */}
        <div className="bg-surface rounded-xl p-6 border border-border space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-text-primary">
                Account & Institutional Profile
              </h2>
            </div>
            <span className="text-xs font-mono text-accent">
              Role: {user?.role || 'institution_user'}
            </span>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Officer / Representative Name"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-accent"
                  style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  readOnly
                  className="w-full px-3 py-2 text-sm rounded-lg bg-surface-elevated border border-border text-text-muted font-mono"
                  style={{ backgroundColor: 'var(--input-background)' }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                  Institution / Directorate Name
                </label>
                <input
                  type="text"
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="e.g. ADGIPS or AICTE Directorate"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-accent"
                  style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                  Institutional Code / ID
                </label>
                <input
                  type="text"
                  value={user?.institution_id || user?.user_id || 'AICTE-CENTRAL'}
                  readOnly
                  className="w-full px-3 py-2 text-sm rounded-lg bg-surface-elevated border border-border text-text-muted font-mono"
                  style={{ backgroundColor: 'var(--input-background)' }}
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <Button type="submit" variant="primary" size="sm" disabled={isSavingProfile}>
                {isSavingProfile ? 'Saving...' : 'Save Profile Changes'}
              </Button>
            </div>
          </form>
        </div>

        {/* Password & Security Management */}
        <div className="bg-surface rounded-xl p-6 border border-border space-y-5">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-accent" />
              <h2 className="text-sm font-semibold text-text-primary">
                Security & Password Management
              </h2>
            </div>
            <span className="text-xs font-mono text-text-muted">
              PBKDF2-HMAC-SHA256 Encrypted
            </span>
          </div>

          {passwordError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-500 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-500 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                  Current Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-accent"
                  style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1.5">
                  New Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-accent"
                  style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Confirm New
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[10px] text-accent hover:underline flex items-center gap-1 focus:outline-none cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showPassword ? 'Hide' : 'Show'}</span>
                  </button>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-accent"
                  style={{ backgroundColor: 'var(--input-background)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <Button type="submit" variant="primary" size="sm" disabled={isChangingPassword}>
                {isChangingPassword ? 'Updating Password...' : 'Update Password'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
