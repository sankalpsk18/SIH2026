// ============================================================================
// ADALAT360 - MFA Verification Page
// Two-factor authentication verification
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, Shield, AlertCircle, CheckCircle2, RotateCcw, ArrowLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';

const mfaSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  type: z.enum(['totp', 'backup']),
});

type MfaFormData = z.infer<typeof mfaSchema>;

export function MfaVerifyPage() {
  const { verifyMfa } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showTotp, setShowTotp] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(30);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MfaFormData>({
    resolver: zodResolver(mfaSchema),
    defaultValues: {
      type: 'totp',
    },
  });

  // TOTP timer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = 30 - (now % 30);
      setTimeRemaining(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const onSubmit = async (data: MfaFormData) => {
    setIsLoading(true);
    try {
      await verifyMfa(data.code, data.type);
      toast.success('Authentication successful');
      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Invalid authentication code';
      toast.error(message);
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
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ADALAT360</h1>
          <p className="text-gray-600 mt-1">Two-factor Authentication</p>
        </div>

        {/* MFA Form */}
        <div className="bg-white rounded-2xl shadow-card p-8 border border-gray-200">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-full mx-auto mb-3">
              <Shield className="w-6 h-6 text-primary-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Two-factor Authentication</h2>
            <p className="text-gray-600 mt-1">Enter the code to complete sign in</p>
          </div>

          {/* MFA Method Tabs */}
          <div className="tabs mb-6">
            <button
              type="button"
              onClick={() => { setShowTotp(true); }}
              className={`tab ${showTotp ? 'tab-active' : ''}`}
            >
              <Shield className="w-4 h-4 inline mr-2" />
              Authenticator App
            </button>
            <button
              type="button"
              onClick={() => { setShowTotp(false); }}
              className={`tab ${!showTotp ? 'tab-active' : ''}`}
            >
              <RotateCcw className="w-4 h-4 inline mr-2" />
              Backup Code
            </button>
          </div>

          {/* TOTP Timer */}
          {showTotp && (
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-primary-800">Code expires in</span>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-mono font-bold text-primary-600">{timeRemaining.toString().padStart(2, '0')}s</span>
                  <div className="w-24 h-2 bg-primary-100 rounded-full overflow-hidden">
                    <div
                      className="bg-primary-600 h-full transition-all duration-1000 ease-linear"
                      style={{ width: `${(timeRemaining / 30) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="label">
                {showTotp ? '6-Digit Authenticator Code' : 'Backup Code (XXXX-XXXX)'}
              </label>
              <input
                {...register('code')}
                type="text"
                inputMode={showTotp ? 'numeric' : 'text'}
                maxLength={showTotp ? 6 : 9}
                placeholder={showTotp ? '123456' : 'XXXX-XXXX'}
                className={`input ${errors.code ? 'input-error' : ''} text-center tracking-widest font-mono text-lg`}
                disabled={isLoading}
                autoFocus
              />
              {errors.code && (
                <p className="mt-1 text-sm text-danger-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.code.message}
                </p>
              )}
            </div>

            <input type="hidden" {...register('type')} value={showTotp ? 'totp' : 'backup'} />

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-3"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </span>
              ) : (
                'Verify & Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="btn-ghost"
            >
              <ArrowLeft className="w-4 h-4 inline mr-1" />
              Back to Login
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-500">
          © 2024 ADALAT360 - Secure Digital Evidence Management System
        </p>
      </div>
    </div>
  );
}