// ============================================================================
// ADALAT360 - Forgot Password Page
// Password reset request
// ============================================================================

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi } from '../../../../services/api';
import { Scale, Eye, EyeOff, Loader2, AlertCircle, Mail, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

const forgotSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type ForgotFormData = z.infer<typeof forgotSchema>;

export function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
  });

  const onSubmit = async (data: ForgotFormData) => {
    setIsLoading(true);
    try {
      await authApi.forgotPassword(data);
      setIsSent(true);
      toast.success('If the email exists, a password reset link has been sent');
    } catch (error: any) {
      // API always returns success to prevent email enumeration
      setIsSent(true);
      toast.success('If the email exists, a password reset link has been sent');
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

        {!isSent ? (
          {/* Forgot Password Form */}
          <div className="bg-white rounded-2xl shadow-card p-8 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Forgot Password?</h2>
            <p className="text-gray-600 mb-6">Enter your email and we'll send you a link to reset your password.</p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full py-3"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending...
                  </span>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>
          </div>
        ) : (
          {/* Success State */}
          <div className="bg-white rounded-2xl shadow-card p-8 border border-gray-200 text-center">
            <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-success-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Check Your Email</h2>
            <p className="text-gray-600 mb-6">
              If an account exists for that email, you'll receive a password reset link shortly.
              The link will expire in 1 hour.
            </p>
            <button
              onClick={() => window.location.href = '/login'}
              className="btn-primary"
            >
              Back to Login
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 text-center">
          <a href="/login" className="text-sm text-primary-600 hover:text-primary-700">
            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Login
          </a>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-500">
          © 2024 ADALAT360 - Secure Digital Evidence Management System
        </p>
      </div>
    </div>
  );
}