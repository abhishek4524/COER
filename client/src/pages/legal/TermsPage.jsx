import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../components/landing/Navbar';
import Footer from '../../components/landing/Footer';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#0E1117] text-white flex flex-col justify-between">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Terms of Service</h1>
        <p className="text-gray-400 text-sm">Last updated: October 2026</p>

        <div className="space-y-4 text-sm text-gray-300 leading-relaxed bg-[#161B22]/60 p-8 rounded-2xl border border-white/10">
          <h2 className="text-lg font-bold text-white">1. Acceptance of Terms</h2>
          <p>
            By accessing and using Personify ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
          </p>

          <h2 className="text-lg font-bold text-white">2. Description of Service</h2>
          <p>
            Personify provides AI-driven automated usability testing, website crawling, persona simulation, and UX analytics. We reserve the right to modify or discontinue features at any time.
          </p>

          <h2 className="text-lg font-bold text-white">3. User Conduct & Acceptable Use</h2>
          <p>
            You agree not to use Personify to test, crawl, or target websites without authorization, perform malicious scanning, bypass security controls, or violate any applicable laws.
          </p>

          <h2 className="text-lg font-bold text-white">4. Subscriptions & Payments</h2>
          <p>
            Subscription plans are billed in advance on a recurring monthly or annual basis. Quota limits apply based on your selected plan. All payments are processed securely via Razorpay.
          </p>

          <h2 className="text-lg font-bold text-white">5. Limitation of Liability</h2>
          <p>
            Personify provides usability simulations "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages resulting from your use of the platform.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
