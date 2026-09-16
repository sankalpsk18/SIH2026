// ============================================================================
// ADALAT360 - Reset Password Page
// Password reset with token
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../services/api';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Scale, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';

const resetSchema = z.object({
  token: z.string().uuid('Invalid reset token'),
  new_password: z.string().min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Must contain at least one special character'),
  confirm_password: z.string().min(1, 'Confirm password is required'),
}).refine(data => data.new_password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

type ResetFormData = z.infer<typeof resetSchema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState(true);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const token = searchParams.get('token');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      token: token || '',
    },
  });

  const newPassword = watch('new_password');

  useEffect(() => {
    if (!token) {
      setIsValidToken(false);
      toast.error('Invalid or missing reset token');
    }
  }, [token]);

  // Calculate password strength
  useEffect(() => {
    if (!newPassword) {
      setPasswordStrength(0);
      return;
    }

    let strength = 0;
    if (newPassword.length >= 12) strength += 25;
    if (/[A-Z]/.test(newPassword)) strength += 20;
    if (/[a-z]/.test(newPassword)) strength += 20;
    if (/[0-9]/.test(newPassword)) strength += 20;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) strength += 15;

    setPasswordStrength(Math.min(100, strength));
  }, [newPassword]);

  const getStrengthColor = () => {
    if (passwordStrength < 40) return 'bg-danger-500';
    if (passwordStrength < 70) return 'bg-warning-500';
    return 'bg-success-500';
  };

  const getStrengthLabel = () => {
    if (passwordStrength < 40) return 'Weak';
    if (passwordStrength < 70) return 'Moderate';
    return 'Strong';
  };

  if (!isValidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-danger-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Reset Link</h2>
          <p className="text-gray-600 mb-6">This password reset link is invalid or has expired.</p>
          <a href="/forgot-password" className="btn-primary">Request New Link</a>
        </div>
      </div>
    );
  }

  const onSubmit = async (data: ResetFormData) => {
    setIsLoading(true);
    try {
      await authApi.resetPassword(data);
      toast.success('Password has been reset successfully');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to reset password';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mx-auto mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ADALAT360</h1>
          <p className="text-gray-600 mt-1">Reset Your Password</p>
        </div>

        {/* Reset Form */}
        <div className="bg-white rounded-2xl shadow-card p-8 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Set New Password</h2>
          <p className="text-gray-600 mb-6">Your new password must be different from previous passwords.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* New Password */}
            <div>
              <label htmlFor="new_password" className="label">New Password</label>
              <div className="relative mt-1">
                <input
                  {...register('new_password')}
                  type={showPassword ? 'text' : 'password'}
                  id="new_password"
                  autoComplete="new-password"
                  className={`input ${errors.new_password ? 'input-error' : ''} pr-10`}
                  placeholder="Enter new password"
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
                {errors.new_password && (
                  <p className="mt-1 text-sm text-danger-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.new_password.message}
                  </p>
                )}
              </div>

              {/* Password Strength Meter */}
              {newPassword && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-500">Password Strength</span>
                    <span className={`font-medium ${getStrengthColor() === 'bg-danger-500' ? 'text-danger-600' : getStrengthColor() === 'bg-warning-500' ? 'text-warning-600' : 'text-success-600'}`}>
                      {getStrengthLabel()}
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getStrengthColor()} rounded-full transition-all duration-300`}
                      style={{ width: `${passwordStrength}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Requirements */}
              <div className="mt-2 space-y-1 text-xs text-gray-500">
                <div className={`flex items-center gap-1 ${newPassword.length >= 12 ? 'text-success-600' : ''}`}>
                  <CheckCircle2 className="w-3 h-3" /> At least 12 characters
                </div>
                <div className={`flex items-center gap-1 ${/[A-Z]/.test(newPassword) ? 'text-success-600' : ''}`}>
                  <CheckCircle2 className="w-3 h-3" /> One uppercase letter
                </div>
                <div className={`flex items-center gap-1 ${/[a-z]/.test(newPassword) ? 'text-success-600' : ''}`}>
                  <CheckCircle2 className="w-3 h-3" /> One lowercase letter
                </div>
                <div className={`flex items-center gap-1 ${/[0-9]/.test(newPassword) ? 'text-success-600' : ''}`}>
                  <CheckCircle2 className="w-3 h-3" /> One number
                </div>
                <div className={`flex items-center gap-1 ${/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword) ? 'text-success-600' : ''}`}>
                  <CheckCircle2 className="w-3 h-3" /> One special character
                </div>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirm_password" className="label">Confirm Password</label>
              <div className="relative mt-1">
                <input
                  {...register('confirm_password')}
                  type={showConfirm ? 'text' : 'password'}
                  id="confirm_password"
                  autoComplete="new-password"
                  className={`input ${errors.confirm_password ? 'input-error' : ''} pr-10`}
                  placeholder="Confirm new password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                {errors.confirm_password && (
                  <p className="mt-1 text-sm text-danger-600 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.confirm_password.message}
                  </p>
                )}
              </div>
            </div>

            {/* Hidden token */}
            <input type="hidden" {...register('token')} value={token || ''} />

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !isValidToken}
              className="btn-primary w-full py-3"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Resetting...
                </span>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-500">
          © 2024 ADALAT360 - Secure Digital Evidence Management System
        </p>
      </div>
    </div>
  );
}