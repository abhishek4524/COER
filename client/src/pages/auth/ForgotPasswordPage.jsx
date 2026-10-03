import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Mail, ArrowRight, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { forgotPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (!email) {
      setErrorMessage('Please enter your email address');
      return;
    }

    try {
      setLoading(true);
      await forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setErrorMessage(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-color)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md">
        <GlassPanel className="p-8 sm:p-10">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#6C63FF] hover:underline mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </Link>

          {!submitted ? (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold font-heading text-[var(--text-color)] mb-2">
                  Forgot Password?
                </h1>
                <p className="text-sm text-[#6B6B70] dark:text-[#98989F]">
                  Enter your registered email address and we'll send you a password reset link.
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
                    Email Address
                  </label>
                  <Input
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    startIcon={Mail}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={loading}
                  className="w-full"
                  icon={ArrowRight}
                >
                  {loading ? 'Sending link...' : 'Send Reset Link'}
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-[#8FB8A8]/20 text-[#8FB8A8] flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold font-heading text-[var(--text-color)] mb-2">
                Check Your Email
              </h2>
              <p className="text-sm text-[#6B6B70] dark:text-[#98989F] mb-6">
                If an account with <strong className="text-[var(--text-color)]">{email}</strong> exists, we have sent a reset link to it. (In development mode, check your backend terminal logs!)
              </p>
              <Button
                variant="secondary"
                size="md"
                onClick={() => setSubmitted(false)}
                className="w-full"
              >
                Try Another Email
              </Button>
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
