import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { User as UserIcon, Mail, Lock, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const { signup } = useAuth();
  const navigate = useNavigate();

  // Password strength logic
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, label: '', color: 'bg-transparent' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-[#F08A7E]' };
    if (score === 2 || score === 3) return { score: 2, label: 'Medium', color: 'bg-amber-400' };
    return { score: 3, label: 'Strong', color: 'bg-[#8FB8A8]' };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name || !email || !password) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    try {
      setLoading(true);
      await signup({ name, email, password });
      navigate('/app/dashboard');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    const serverUrl = import.meta.env.VITE_API_URL || '/api';
    window.location.href = `${serverUrl}/auth/google`;
  };

  return (
    <div className="min-h-screen bg-[var(--bg-color)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        
        {/* Left Side Panel */}
        <div className="md:col-span-5 flex flex-col justify-between p-6 sm:p-8 bg-gradient-to-br from-[#6C63FF]/10 via-transparent to-[#8FB8A8]/10 rounded-3xl border border-[#ECEAE5] dark:border-[#26262F] relative overflow-hidden min-h-[480px]">
          <div className="relative z-10">
            <Link to="/" className="flex items-center gap-2 mb-8">
              <div className="w-9 h-9 rounded-2xl bg-[#6C63FF] flex items-center justify-center text-white font-bold text-lg shadow-md shadow-[#6C63FF]/30">
                V
              </div>
              <span className="font-heading font-extrabold text-xl text-[var(--text-color)]">
                VibeTest
              </span>
            </Link>

            <h2 className="text-2xl font-bold font-heading text-[var(--text-color)] mb-3">
              Get Started with AI User Testing
            </h2>
            <p className="text-sm text-[#6B6B70] dark:text-[#98989F] mb-6 leading-relaxed">
              Join hundreds of developers and designers catching UX friction before real users do.
            </p>

            <ul className="space-y-3 text-xs text-[#1C1C1E] dark:text-[#F2F2F7]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#8FB8A8]" />
                <span>Simulate 20+ personas in parallel</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#8FB8A8]" />
                <span>Automated rage click & confusion analysis</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#8FB8A8]" />
                <span>Zero code integration required</span>
              </li>
            </ul>
          </div>

          <div className="relative z-10 pt-4 mt-6 border-t border-[#ECEAE5] dark:border-[#26262F]">
            <div className="flex items-center gap-3">
              <img src="/assets/personas/priya.png" alt="Priya" className="w-10 h-10 rounded-full border-2 border-white dark:border-[#17171B] object-cover" />
              <div>
                <p className="text-xs font-semibold text-[var(--text-color)]">Priya Sharma</p>
                <p className="text-[11px] text-[#6B6B70] dark:text-[#98989F]">Product Designer</p>
              </div>
            </div>
          </div>

          <img
            src="/assets/hero-scene.png"
            alt="Hero Background"
            className="absolute bottom-0 right-0 w-64 opacity-20 pointer-events-none object-contain translate-x-8 translate-y-8"
          />
        </div>

        {/* Right Form Panel */}
        <div className="md:col-span-7">
          <GlassPanel className="p-8 sm:p-10">
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold font-heading text-[var(--text-color)] mb-2">
                Create your account
              </h1>
              <p className="text-sm text-[#6B6B70] dark:text-[#98989F]">
                Start testing your website with realistic AI personas in seconds.
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
                  Full Name
                </label>
                <Input
                  type="text"
                  placeholder="Jane Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  startIcon={UserIcon}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] mb-1.5">
                  Email Address
                </label>
                <Input
                  type="email"
                  placeholder="jane@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  startIcon={Mail}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1C1C1E] dark:text-[#F2F2F7] mb-1.5">
                  Password
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  startIcon={Lock}
                  required
                />

                {/* Password Strength Meter */}
                {password && (
                  <div className="mt-2.5">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[#6B6B70] dark:text-[#98989F]">Password strength:</span>
                      <span className="font-semibold text-[var(--text-color)]">{strength.label}</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#ECEAE5] dark:bg-[#26262F] rounded-full overflow-hidden flex gap-1 p-0.5">
                      <div className={`h-full rounded-full transition-all duration-300 ${strength.score >= 1 ? strength.color : 'bg-transparent'} w-1/3`} />
                      <div className={`h-full rounded-full transition-all duration-300 ${strength.score >= 2 ? strength.color : 'bg-transparent'} w-1/3`} />
                      <div className={`h-full rounded-full transition-all duration-300 ${strength.score >= 3 ? strength.color : 'bg-transparent'} w-1/3`} />
                    </div>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={loading}
                className="w-full mt-2"
                icon={ArrowRight}
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#ECEAE5] dark:border-[#26262F]" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-3 bg-white dark:bg-[#17171B] text-[#6B6B70] dark:text-[#98989F]">
                  Or signup with
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={handleGoogleSignup}
              className="w-full"
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Google
            </Button>

            <p className="text-center text-xs text-[#6B6B70] dark:text-[#98989F] mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-[#6C63FF] font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </GlassPanel>
        </div>

      </div>
    </div>
  );
}
