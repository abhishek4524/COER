import React from 'react';
import Navbar from '../../components/landing/Navbar';
import Footer from '../../components/landing/Footer';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0E1117] text-white flex flex-col justify-between">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Privacy Policy</h1>
        <p className="text-gray-400 text-sm">Last updated: October 2026</p>

        <div className="space-y-4 text-sm text-gray-300 leading-relaxed bg-[#161B22]/60 p-8 rounded-2xl border border-white/10">
          <h2 className="text-lg font-bold text-white">1. Information We Collect</h2>
          <p>
            We collect account credentials (name, email, password hashes), usage telemetry, simulation test targets, and billing details. We do not store raw credit card numbers.
          </p>

          <h2 className="text-lg font-bold text-white">2. How We Use Information</h2>
          <p>
            Information collected is strictly used to render usability analytics reports, authenticate user sessions, enforce subscription quotas, and improve system performance.
          </p>

          <h2 className="text-lg font-bold text-white">3. Data Security & Cookies</h2>
          <p>
            All passwords are encrypted using bcrypt (cost 12). Authentication session tokens are stored exclusively in httpOnly, SameSite=Lax cookies. We never sell your personal data.
          </p>

          <h2 className="text-lg font-bold text-white">4. Your Rights & Account Deletion</h2>
          <p>
            You may request complete account and data deletion at any time directly through your Account settings or by contacting privacy@personify.dev.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
