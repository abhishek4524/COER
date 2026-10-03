import React from 'react';
import Navbar from '../../components/landing/Navbar';
import Footer from '../../components/landing/Footer';

export default function RefundPage() {
  return (
    <div className="min-h-screen bg-[#0E1117] text-white flex flex-col justify-between">
      <Navbar />
      <main className="max-w-4xl mx-auto px-6 py-12 space-y-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Refund Policy</h1>
        <p className="text-gray-400 text-sm">Last updated: October 2026</p>

        <div className="space-y-4 text-sm text-gray-300 leading-relaxed bg-[#161B22]/60 p-8 rounded-2xl border border-white/10">
          <h2 className="text-lg font-bold text-white">1. 7-Day Money-Back Guarantee</h2>
          <p>
            If you upgrade to Pro or Team and are dissatisfied with Personify for any reason, you may request a full refund within 7 days of your initial purchase.
          </p>

          <h2 className="text-lg font-bold text-white">2. Subscription Cancellations</h2>
          <p>
            You can cancel your subscription at any time via the Account & Billing tab. Your paid features will remain active until the end of your current billing period.
          </p>

          <h2 className="text-lg font-bold text-white">3. How to Request a Refund</h2>
          <p>
            To request a refund, please email billing@personify.dev with your registered account email and payment reference ID. Refunds are credited back to the original payment method via Razorpay within 5–7 business days.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
