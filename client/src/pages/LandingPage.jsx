import React from 'react';
import Navbar from '../components/landing/Navbar';
import HeroSection from '../components/landing/HeroSection';
import LiveTicker from '../components/landing/LiveTicker';
import HowItWorksSection from '../components/landing/HowItWorksSection';
import PersonaCarouselSection from '../components/landing/PersonaCarouselSection';
import ProductShowcaseSection from '../components/landing/ProductShowcaseSection';
import StatsGridSection from '../components/landing/StatsGridSection';
import HeatmapSliderSection from '../components/landing/HeatmapSliderSection';
import PricingSection from '../components/landing/PricingSection';
import FinalCTASection from '../components/landing/FinalCTASection';
import Footer from '../components/landing/Footer';

export const LandingPage = () => {
  return (
    <div className="min-h-screen bg-[#F7F6F3] dark:bg-[#0F0F12] text-[#1C1C1E] dark:text-[#F2F2F7] flex flex-col font-sans transition-colors duration-300">
      {/* 1. Minimal Nav */}
      <Navbar />

      {/* Main Content Sections */}
      <main className="flex-1">
        {/* 2. Hero Section */}
        <HeroSection />

        {/* 3. Live Ticker Strip */}
        <LiveTicker />

        {/* 4. How It Works Section */}
        <HowItWorksSection />

        {/* 5. Meet Your Testers Carousel */}
        <PersonaCarouselSection />

        {/* 6. Product Showcase Section */}
        <ProductShowcaseSection />

        {/* 7. Stats Grid Section */}
        <StatsGridSection />

        {/* 8. Before/After Heatmap Slider */}
        <HeatmapSliderSection />

        {/* 9. Pricing Section */}
        <PricingSection />

        {/* 10. Final CTA */}
        <FinalCTASection />
      </main>

      {/* 10. Minimal Footer */}
      <Footer />
    </div>
  );
};

export default LandingPage;
