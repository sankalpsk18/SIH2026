// ============================================================================
// ADALAT360 - Login Page
// Authentication with MFA support
// ============================================================================

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext';
import { Scale, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  totp_code: z.string().length(6, 'TOTP code must be 6 digits').optional(),
  backup_code: z.string().regex(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/, 'Backup code format: XXXX-XXXX').optional(),
  remember_me: z.boolean().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showTotp, setShowTotp] = useState(false);
  const [showBackup, setShowBackup] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      remember_me: false,
    },
  });

  const email = watch('email');

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const result = await login(data);
      if (result.requiresMfa) {
        if (data.totp_code) {
          setShowTotp(true);
        } else if (data.backup_code) {
          setShowBackup(true);
        } else {
          // MFA required but no code provided - the login function handles this
          toast.error('Two-factor authentication required');
        }
      }
    } catch (error: any) {
      // Error already toasted in auth context
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mx-auto mb-4">
            <Scale className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ADALAT360</h1>
          <p className="text-gray-600 mt-1">Secure Digital Evidence Management</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-card p-8 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="label">Email Address</label>
              <div className="relative mt-1">
                <input
                  {...register('email')}
                  type="email"
                  id="email"
                  autoComplete="email"
                  className={`input ${errors.email ? 'input-error' : ''}`}
                  placeholder="officer@adalat360.gov.in"
                  disabled={isLoading}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-danger-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.email.message}
                  </p>
                )}
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative mt-1">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  autoComplete="current-password"
                  className={`input ${errors.password ? 'input-error' : ''} pr-10`}
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                {errors.password && (
                  <p className="mt-1 text-sm text-danger-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.password.message}
                  </p>
                )}
              </div>
            </div>

            {/* MFA Fields - shown conditionally */}
            {(showTotp || showBackup) && (
              <div className="border-t border-gray-200 pt-5">
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 text-primary-800 mb-2">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Two-factor authentication required</span>
                  </div>
                  <p className="text-sm text-primary-700">
                    {showTotp ? 'Enter the 6-digit code from your authenticator app' : 'Enter one of your backup codes (format: XXXX-XXXX)'}
                  </p>
                </div>

                <div>
                  <label className="label">
                    {showTotp ? 'Authenticator Code' : 'Backup Code'}
                  </label>
                  <input
                    {...register(showTotp ? 'totp_code' : 'backup_code')}
                    type="text"
                    inputMode={showTotp ? 'numeric' : 'text'}
                    maxLength={showTotp ? 6 : 9}
                    placeholder={showTotp ? '123456' : 'XXXX-XXXX'}
                    className={`input ${(showTotp ? errors.totp_code : errors.backup_code) ? 'input-error' : ''} text-center tracking-widest font-mono`}
                    disabled={isLoading}
                  />
                  {(showTotp ? errors.totp_code : errors.backup_code) && (
                    <p className="mt-1 text-sm text-danger-600 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {(showTotp ? errors.totp_code : errors.backup_code)?.message}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowTotp(false); setShowBackup(false); setValue('totp_code', ''); setValue('backup_code', ''); }}
                    className="btn-ghost flex-1"
                  >
                    Use Password Instead
                  </button>
                </div>
              </div>
            )}
            {(!showTotp && !showBackup) && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    {...register('remember_me')}
                    type="checkbox"
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-600">Remember me</span>
                </label>
                <a href="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700">
                  Forgot password?
                </a>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </span>
              ) : (
                showTotp || showBackup ? 'Verify' : 'Sign In'
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 text-center mb-2">Demo Credentials (Password: Test@123)</p>
            <div className="space-y-1 text-xs text-gray-600">
              <p><strong>Admin:</strong> admin@adalat360.gov.in</p>
              <p><strong>Officer:</strong> officer.sharma@adalat360.gov.in</p>
              <p><strong>Forensic:</strong> lab.director@adalat360.gov.in</p>
              <p><strong>Prosecutor:</strong> prosecutor.singh@adalat360.gov.in</p>
              <p><strong>Court:</strong> judge.kumar@adalat360.gov.in</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-500">
          © 2026 ADALAT360 - Secure Digital Evidence Management System
        </p>
      </div>
    </div>
  );
}