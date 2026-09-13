// ============================================================================
// ADALAT360 - Profile Page
// User profile management with MFA settings
// ============================================================================

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User,
  Loader2,
  Save,
  Shield,
  Lock,
  Eye,
  EyeOff,
  RotateCcw,
  Copy,
  CheckCircle2,
  AlertCircle,
  Bell,
  Moon,
  Sun,
  Globe,
} from 'lucide-react';
import { authApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';

const profileSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(255),
  phone: z.string().max(20).optional(),
  designation: z.string().max(100).optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Must contain special character'),
  confirm_password: z.string().min(1, 'Confirm password is required'),
}).refine(data => data.new_password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

type PasswordFormData = z.infer<typeof passwordSchema>;

const mfaSchema = z.object({
  code: z.string().length(6, 'Code must be 6 digits'),
});

type MfaFormData = z.infer<typeof mfaSchema>;

export function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences' | 'sessions'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState({ current: false, new: false, confirm: false });
  const [mfaSetup, setMfaSetup] = useState<any>(null);

  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: profileErrors },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: user?.full_name || '',
      phone: user?.phone || '',
      designation: user?.designation || '',
    },
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    watch,
    formState: { errors: passwordErrors },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  const {
    register: registerMfa,
    handleSubmit: handleSubmitMfa,
    formState: { errors: mfaErrors },
  } = useForm<MfaFormData>({
    resolver: zodResolver(mfaSchema),
  });

  const newPassword = watch('new_password');

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return 0;
    let strength = 0;
    if (pwd.length >= 12) strength += 25;
    if (/[A-Z]/.test(pwd)) strength += 20;
    if (/[a-z]/.test(pwd)) strength += 20;
    if (/[0-9]/.test(pwd)) strength += 20;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) strength += 15;
    return Math.min(100, strength);
  };

  const passwordStrength = getPasswordStrength(newPassword);
  const strengthColor = passwordStrength < 40 ? 'bg-danger-500' : passwordStrength < 70 ? 'bg-warning-500' : 'bg-success-500';
  const strengthLabel = passwordStrength < 40 ? 'Weak' : passwordStrength < 70 ? 'Moderate' : 'Strong';

  const onProfileSubmit = async (data: ProfileFormData) => {
    setIsLoading(true);
    try {
      await authApi.updateProfile(data);
      await refreshProfile();
      toast.success('Profile updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordFormData) => {
    setIsLoading(true);
    try {
      await authApi.changePassword(data);
      toast.success('Password changed successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  const setupMfa = async () => {
    try {
      const response = await authApi.setupMfa();
      setMfaSetup(response.data);
    } catch (error: any) {
      toast.error('Failed to setup MFA');
    }
  };

  const enableMfa = async (data: MfaFormData) => {
    setIsLoading(true);
    try {
      const codes = await authApi.enableMfa(data.code);
      setMfaSetup(null);
      toast.success('Two-factor authentication enabled');
      toast.success(`Backup codes: ${codes.join(', ')}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Invalid code');
    } finally {
      setIsLoading(false);
    }
  };

  const disableMfa = async () => {
    const password = prompt('Enter your password to disable MFA:');
    if (!password) return;
    try {
      await authApi.disableMfa(password);
      toast.success('Two-factor authentication disabled');
    } catch (error: any) {
      toast.error('Failed to disable MFA');
    }
  };

  const regenerateBackupCodes = async () => {
    const password = prompt('Enter your password to regenerate backup codes:');
    if (!password) return;
    try {
      const codes = await authApi.regenerateBackupCodes(password);
      toast.success('Backup codes regenerated');
      toast.success(`New codes: ${codes.join(', ')}`);
    } catch (error: any) {
      toast.error('Failed to regenerate backup codes');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
    { id: 'preferences', label: 'Preferences', icon: <Settings className="w-4 h-4" /> },
    { id: 'sessions', label: 'Sessions', icon: <Activity className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile</h1>
          <p className="text-gray-600 mt-1">Manage your account settings</p>
        </div>
      </div>

      {/* User Info Card */}
      <div className="card p-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center">
            <span className="text-2xl font-bold text-primary-700">
              {user?.full_name?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">{user?.full_name}</h2>
            <p className="text-gray-600">{user?.email}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <BadgeCheck className="w-4 h-4" />
                {user?.role?.replace(/_/g, ' ')}
              </span>
              <span className="flex items-center gap-1">
                <Building className="w-4 h-4" />
                {user?.department}
              </span>
              <span className="flex items-center gap-1">
                <Shield className="w-4 h-4" />
                MFA: {user?.totp_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="tabs border-b border-gray-200 px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
            >
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'profile' && <ProfileTab user={user} onSubmit={onProfileSubmit} isLoading={isLoading} register={registerProfile} errors={profileErrors} />}
          {activeTab === 'security' && <SecurityTab user={user} onPasswordSubmit={onPasswordSubmit} onMfaSetup={setupMfa} onEnableMfa={enableMfa} onDisableMfa={disableMfa} onRegenerateCodes={regenerateBackupCodes} mfaSetup={mfaSetup} isLoading={isLoading} registerPassword={registerPassword} registerMfa={registerMfa} handleSubmitPassword={handleSubmitPassword} handleSubmitMfa={handleSubmitMfa} passwordErrors={passwordErrors} mfaErrors={mfaErrors} passwordStrength={passwordStrength} strengthColor={strengthColor} strengthLabel={strengthLabel} showPassword={showPassword} setShowPassword={setShowPassword} newPassword={newPassword} copyToClipboard={copyToClipboard} />}
          {activeTab === 'preferences' && <PreferencesTab />}
          {activeTab === 'sessions' && <SessionsTab />}
        </div>
      </div>
    </div>
  );
}

function ProfileTab({ user, onSubmit, isLoading, register, errors }: any) {
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
        <h3 className="font-medium text-primary-800 mb-2">Profile Information</h3>
        <p className="text-primary-700 text-sm">Update your personal information</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="label">Full Name</label>
          <input {...register('full_name')} className={`input ${errors.full_name ? 'input-error' : ''}`} disabled={isLoading} />
          {errors.full_name && <p className="mt-1 text-sm text-danger-600">{errors.full_name.message}</p>}
        </div>
        <div>
          <label className="label">Phone</label>
          <input {...register('phone')} type="tel" className={`input ${errors.phone ? 'input-error' : ''}`} disabled={isLoading} />
        </div>
        <div>
          <label className="label">Designation</label>
          <input {...register('designation')} className={`input ${errors.designation ? 'input-error' : ''}`} disabled={isLoading} />
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-2">Account Information (Read-only)</h4>
        <div className="grid grid-cols-2 gap-4 text-sm mt-2">
          <div>
            <p className="text-gray-500">Employee ID</p>
            <p className="font-medium">{user?.employee_id}</p>
          </div>
          <div>
            <p className="text-gray-500">Role</p>
            <p className="font-medium">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <p className="text-gray-500">Department</p>
            <p className="font-medium">{user?.department}</p>
          </div>
          <div>
            <p className="text-gray-500">Badge Number</p>
            <p className="font-medium">{user?.badge_number || '—'}</p>
          </div>
        </div>
      </div>

      <button type="submit" disabled={isLoading} className="btn-primary">
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : ''}
        Save Changes
      </button>
    </form>
  );
}

function SecurityTab({ user, onPasswordSubmit, onMfaSetup, onEnableMfa, onDisableMfa, onRegenerateCodes, mfaSetup, isLoading, registerPassword, registerMfa, handleSubmitPassword, handleSubmitMfa, passwordErrors, mfaErrors, passwordStrength, strengthColor, strengthLabel, showPassword, setShowPassword, newPassword, copyToClipboard }: any) {
  return (
    <div className="space-y-8 max-w-3xl">
      {/* Password Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Password
        </h3>
        <form onSubmit={handleSubmitPassword} className="space-y-6 max-w-xl">
          <div>
            <label className="label">Current Password</label>
            <div className="relative">
              <input {...registerPassword('current_password')} type={showPassword.current ? 'text' : 'password'} className={`input ${passwordErrors.current_password ? 'input-error' : ''} pr-10`} disabled={isLoading} />
              <button type="button" onClick={() => setShowPassword(p => ({ ...p, current: !p.current }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                {showPassword.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {passwordErrors.current_password && <p className="mt-1 text-sm text-danger-600">{passwordErrors.current_password.message}</p>}
          </div>
          <div>
            <label className="label">New Password</label>
            <div className="relative">
              <input {...registerPassword('new_password')} type={showPassword.new ? 'text' : 'password'} className={`input ${passwordErrors.new_password ? 'input-error' : ''} pr-10`} disabled={isLoading} />
              <button type="button" onClick={() => setShowPassword(p => ({ ...p, new: !p.new }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                {showPassword.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {passwordErrors.new_password && <p className="mt-1 text-sm text-danger-600">{passwordErrors.new_password.message}</p>}
            {newPassword && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-500">Password Strength</span>
                  <span className={`font-medium ${strengthColor === 'bg-danger-500' ? 'text-danger-600' : strengthColor === 'bg-warning-500' ? 'text-warning-600' : 'text-success-600'}`}>
                    {strengthLabel}
                  </span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full ${strengthColor} rounded-full transition-all duration-300`} style={{ width: `${passwordStrength}%` }} />
                </div>
                <div className="mt-2 space-y-1 text-xs text-gray-500">
                  <div className={`flex items-center gap-1 ${newPassword.length >= 12 ? 'text-success-600' : ''}`}><CheckCircle2 className="w-3 h-3" /> At least 12 characters</div>
                  <div className={`flex items-center gap-1 ${/[A-Z]/.test(newPassword) ? 'text-success-600' : ''}`}><CheckCircle2 className="w-3 h-3" /> One uppercase letter</div>
                  <div className={`flex items-center gap-1 ${/[a-z]/.test(newPassword) ? 'text-success-600' : ''}`}><CheckCircle2 className="w-3 h-3" /> One lowercase letter</div>
                  <div className={`flex items-center gap-1 ${/[0-9]/.test(newPassword) ? 'text-success-600' : ''}`}><CheckCircle2 className="w-3 h-3" /> One number</div>
                  <div className={`flex items-center gap-1 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? 'text-success-600' : ''}`}><CheckCircle2 className="w-3 h-3" /> One special character</div>
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <div className="relative">
              <input {...registerPassword('confirm_password')} type={showPassword.confirm ? 'text' : 'password'} className={`input ${passwordErrors.confirm_password ? 'input-error' : ''} pr-10`} disabled={isLoading} />
              <button type="button" onClick={() => setShowPassword(p => ({ ...p, confirm: !p.confirm }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                {showPassword.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {passwordErrors.confirm_password && <p className="mt-1 text-sm text-danger-600">{passwordErrors.confirm_password.message}</p>}
          </div>

          <button type="submit" disabled={isLoading} className="btn-primary w-full">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : ''}
            Change Password
          </button>
        </form>
      </div>

      {/* MFA Section */}
      <div className="pt-8 border-t border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Two-Factor Authentication
        </h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">Two-Factor Authentication</h4>
              <p className="text-gray-600 text-sm">Add an extra layer of security to your account</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`badge ${user?.totp_enabled ? 'badge-green' : 'badge-gray'}`}>
                {user?.totp_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        {mfaSetup ? (
          <div className="bg-primary-50 border border-primary-200 rounded-lg p-6">
            <h4 className="font-medium text-primary-800 mb-4">Scan QR Code with Authenticator App</h4>
            <div className="flex items-center justify-center gap-8">
              <div className="bg-white p-4 border border-gray-200 rounded-lg">
                {mfaSetup.qr_code_url && (
                  <img src={mfaSetup.qr_code_url} alt="MFA QR Code" className="w-48 h-48" />
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <label className="label text-sm">Manual Entry Key</label>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-gray-100 p-2 rounded text-sm font-mono text-primary-800">{mfaSetup.manual_entry_key}</code>
                    <button onClick={() => copyToClipboard(mfaSetup.manual_entry_key)} className="btn-secondary btn-sm">Copy</button>
                  </div>
                </div>
                <div>
                  <label className="label text-sm">Verification Code</label>
                  <form onSubmit={handleSubmitMfa} className="flex gap-2">
                    <input {...registerMfa('code')} type="text" maxLength={6} inputMode="numeric" placeholder="123456" className="input w-32 text-center tracking-widest font-mono" />
                    <button type="submit" disabled={isLoading} className="btn-primary">
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enable MFA'}
                    </button>
                  </form>
                  {mfaErrors.code && <p className="text-sm text-danger-600">{mfaErrors.code.message}</p>}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setMfaSetup(null)} className="btn-ghost">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        ) : user?.totp_enabled ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-green-800">Two-Factor Authentication Enabled</h4>
                  <p className="text-green-700 text-sm">Your account is protected with 2FA</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button onClick={disableMfa} className="btn-secondary w-full">
                <Lock className="w-4 h-4 mr-2" />
                Disable 2FA
              </button>
              <button onClick={regenerateBackupCodes} className="btn-secondary w-full">
                <RotateCcw className="w-4 h-4 mr-2" />
                Regenerate Backup Codes
              </button>
            </div>
          </div>
        ) : (
          <button onClick={onMfaSetup} className="btn-primary w-full max-w-xs">
            <Shield className="w-4 h-4 mr-2" />
            Enable Two-Factor Authentication
          </button>
        )}
      </div>

      {/* Backup Codes Section */}
      {user?.totp_enabled && (
        <div className="pt-8 border-t border-gray-200">
          <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
            <Key className="w-5 h-5" />
            Backup Codes
          </h4>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <p className="text-gray-600 text-sm mb-4">Store these codes in a safe place. Each code can be used once.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[...Array(10)].map((_, i) => (
                <code key={i} className="bg-white px-3 py-2 rounded text-sm font-mono text-gray-700 border border-gray-200">XXXX-XXXX</code>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">Backup codes are shown only once during setup. Regenerate if lost.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function PreferencesTab() {
  return (
    <div className="max-w-2xl space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h3>
      <div className="space-y-4">
        <PreferenceItem label="Email Notifications" description="Receive email notifications for case updates" />
        <PreferenceItem label="SMS Notifications" description="Receive SMS for urgent alerts" />
        <PreferenceItem label="Push Notifications" description="Receive browser push notifications" />
        <PreferenceItem label="Weekly Digest" description="Receive weekly summary of case activity" />
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Display Preferences</h3>
      <div className="space-y-4">
        <PreferenceItem label="Dark Mode" description="Use dark theme" />
        <PreferenceItem label="Compact View" description="Reduce spacing for more content" />
        <PreferenceItem label="Auto Refresh" description="Automatically refresh lists" />
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mt-8 mb-4">Language & Region</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Language</label>
          <select className="input">
            <option>English</option>
            <option>Hindi</option>
          </select>
        </div>
        <div>
          <label className="label">Timezone</label>
          <select className="input">
            <option>Asia/Kolkata (UTC+5:30)</option>
            <option>UTC</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function SessionsTab() {
  return (
    <div className="max-w-3xl">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Sessions</h3>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-gray-600">Session management - view and revoke active sessions</p>
        <button className="btn-primary mt-4">View All Sessions</button>
      </div>
    </div>
  );
}

function PreferenceItem({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
      <div>
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input type="checkbox" className="sr-only peer" defaultChecked />
        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
      </label>
    </div>
  );
}

function formatRole(role: string): string {
  return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function formatStatus(status: string): string {
  return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function getStatusBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: 'badge-green',
    INACTIVE: 'badge-gray',
    SUSPENDED: 'badge-red',
    PENDING_VERIFICATION: 'badge-yellow',
  };
  return colors[status] || 'badge-gray';
}