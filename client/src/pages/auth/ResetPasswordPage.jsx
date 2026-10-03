import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Lock, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { resetPassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!token) {
      setErrorMessage('Missing password reset token from URL.');
      return;
    }

    if (!password || password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setErrorMessage(err.message || 'Password reset failed. The token may be invalid or expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-color)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md">
        <GlassPanel className="p-8 sm:p-10">
          {!success ? (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold font-heading text-[var(--text-color)] mb-2">
                  Reset Your Password
                </h1>
                <p className="text-sm text-[#6B6B70] dark:text-[#98989F]">
                  Enter a new strong password for your VibeTest account.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-6 p-4 rounded-2xl bg-[#F08A7E]/10 border border-[#F08A7E]/30 text-[#F08A7E] text-sm flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] mb-1.5">
                    New Password
                  </label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    startIcon={Lock}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] mb-1.5">
                    Confirm New Password
                  </label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    startIcon={Lock}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={loading}
                  className="w-full mt-2"
                  icon={ArrowRight}
                >
                  {loading ? 'Resetting...' : 'Reset Password'}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-[#8FB8A8]/20 text-[#8FB8A8] flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold font-heading text-[var(--text-color)] mb-2">
                Password Reset Complete
              </h2>
              <p className="text-sm text-[#6B6B70] dark:text-[#98989F] mb-6">
                Your password has been reset successfully. You can now sign in with your new credentials.
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/login')}
                className="w-full"
              >
                Go to Sign In
              </Button>
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
