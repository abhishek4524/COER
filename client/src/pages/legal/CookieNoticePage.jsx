import React from 'react';
import Navbar from '../../components/landing/Navbar';
import Footer from '../../components/landing/Footer';

export default function CookieNoticePage() {
  return (
    <div className="min-h-screen bg-[#0E1117] text-white flex flex-col justify-between">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Cookie Notice</h1>
        <p className="text-gray-400 text-sm">Last updated: October 2026</p>

        <div className="space-y-4 text-sm text-gray-300 leading-relaxed bg-[#161B22]/60 p-8 rounded-2xl border border-white/10">
          <h2 className="text-lg font-bold text-white">1. Essential Authentication Cookies</h2>
          <p>
            Personify uses httpOnly, SameSite=Lax authentication cookies (`token`) strictly to keep you securely signed in. These essential cookies cannot be disabled.
          </p>

          <h2 className="text-lg font-bold text-white">2. No Third-Party Tracking Cookies</h2>
          <p>
            We do not use invasive third-party cross-site advertising trackers or sell browsing data to data brokers.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
