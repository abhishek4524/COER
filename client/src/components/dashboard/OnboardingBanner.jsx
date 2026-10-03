import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../ui/Card';
import Button from '../ui/Button';

export default function OnboardingBanner({ user, runCount = 0 }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const steps = [
    {
      id: 'email',
      title: 'Verify your email address',
      completed: !!user?.emailVerified,
      actionText: 'Resend Email',
      onAction: () => alert('Verification email resent to ' + user?.email),
    },
    {
      id: 'run',
      title: 'Run your first UX simulation',
      completed: runCount > 0,
      actionText: 'Start Simulation',
      onAction: () => navigate('/app/new-run'),
    },
    {
      id: 'share',
      title: 'Share an audit report or saved project',
      completed: runCount > 1,
      actionText: 'View Runs',
      onAction: () => navigate('/app/runs'),
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  if (completedCount === steps.length) return null;

  return (
    <Card className="p-6 relative overflow-hidden bg-gradient-to-r from-[#161B22] via-[#1E2638] to-[#161B22] border-[#6C63FF]/30 shadow-xl mb-6">
      {/* Background Glow */}
      <div className="absolute -right-12 -top-12 w-48 h-48 bg-[#6C63FF]/20 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
        <div className="flex items-center gap-5">
          {/* 3D Character Illustration */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#6C63FF]/20 to-[#FF6584]/20 border border-white/10 flex items-center justify-center shrink-0">
            <img
              src="/assets/personas/default.png"
              alt="Welcome"
              className="w-12 h-12 object-contain"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">Getting Started with VibeTest</h2>
              <span className="text-xs bg-[#6C63FF]/20 text-[#6C63FF] px-2 py-0.5 rounded-full font-semibold">
                {completedCount} of {steps.length} completed
              </span>
            </div>
            <p className="text-xs text-gray-300">
              Complete these steps to unlock full automated usability insights for your products.
            </p>

            {/* Progress bar */}
            <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
              <div
                className="h-full bg-gradient-to-r from-[#6C63FF] to-[#FF6584] transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={() => setDismissed(true)}
          className="absolute top-4 right-4 text-gray-400 hover:text-white text-sm"
          title="Dismiss banner"
        >
          ✕
        </button>

        {/* Steps List */}
        <div className="w-full md:w-auto space-y-2">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center justify-between gap-4 text-xs bg-black/30 p-2.5 rounded-xl border border-white/5">
              <div className="flex items-center gap-2">
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${step.completed ? 'bg-emerald-500 text-black font-bold' : 'border border-gray-500 text-gray-400'}`}>
                  {step.completed ? '✓' : ''}
                </span>
                <span className={step.completed ? 'text-gray-400 line-through' : 'text-white font-medium'}>
                  {step.title}
                </span>
              </div>

              {!step.completed && (
                <button
                  onClick={step.onAction}
                  className="text-[11px] text-[#6C63FF] hover:underline font-semibold"
                >
                  {step.actionText} →
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
