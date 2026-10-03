import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { Button } from '../../components/ui/Button';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function VerifyEmailNoticePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [verifying, setVerifying] = useState(!!token);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { verifyEmail, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      setVerifying(true);
      verifyEmail(token)
        .then(() => {
          setSuccess(true);
          setErrorMessage('');
        })
        .catch((err) => {
          setErrorMessage(err.message || 'Verification failed. The token may be expired.');
        })
        .finally(() => {
          setVerifying(false);
        });
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-[var(--bg-color)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-md">
        <GlassPanel className="p-8 sm:p-10 text-center">
          {verifying ? (
            <div className="py-6">
              <RefreshCw className="w-10 h-10 text-[#6C63FF] animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-bold font-heading text-[var(--text-color)] mb-2">
                Verifying Your Email...
              </h2>
              <p className="text-sm text-[#6B6B70] dark:text-[#98989F]">
                Please wait while we validate your token.
              </p>
            </div>
          ) : success ? (
            <div className="py-4">
              <div className="w-12 h-12 rounded-full bg-[#8FB8A8]/20 text-[#8FB8A8] flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-2xl font-bold font-heading text-[var(--text-color)] mb-2">
                Email Verified!
              </h2>
              <p className="text-sm text-[#6B6B70] dark:text-[#98989F] mb-6">
                Your email address has been verified successfully. You can now use all VibeTest features.
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate('/app/dashboard')}
                className="w-full"
              >
                Go to Dashboard
              </Button>
            </div>
          ) : errorMessage ? (
            <div className="py-4">
              <div className="w-12 h-12 rounded-full bg-[#F08A7E]/20 text-[#F08A7E] flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold font-heading text-[var(--text-color)] mb-2">
                Verification Failed
              </h2>
              <p className="text-sm text-[#F08A7E] mb-6">{errorMessage}</p>
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate('/app/dashboard')}
                className="w-full"
              >
                Continue to Dashboard
              </Button>
            </div>
          ) : (
            <div className="py-4">
              <div className="w-12 h-12 rounded-full bg-[#6C63FF]/20 text-[#6C63FF] flex items-center justify-center mx-auto mb-4 font-bold text-xl">
                @
              </div>
              <h2 className="text-2xl font-bold font-heading text-[var(--text-color)] mb-2">
                Verify Your Email
              </h2>
              <p className="text-sm text-[#6B6B70] dark:text-[#98989F] mb-6 leading-relaxed">
                We sent a verification link to your email address. (In development mode, check your server console log for the link!)
              </p>
              <div className="space-y-3">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => navigate('/app/dashboard')}
                  className="w-full"
                >
                  Continue to App
                </Button>
                <Link to="/" className="block text-xs font-semibold text-[#6C63FF] hover:underline">
                  Return to Home
                </Link>
              </div>
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
