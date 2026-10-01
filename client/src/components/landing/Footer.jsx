import React from 'react';
import { Sparkles, Globe, MessageSquare, Share2 } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="w-full bg-white dark:bg-[#17171B] border-t border-[#ECEAE5] dark:border-[#26262F] transition-colors py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        
        {/* Left Logo & Status */}
        <div className="flex flex-col items-center md:items-start gap-3">
          <div className="flex items-center gap-2.5 font-heading font-bold text-lg text-[#1C1C1E] dark:text-[#F2F2F7]">
            <div className="w-7 h-7 rounded-xl bg-[#6C63FF] flex items-center justify-center text-white">
              <Sparkles className="w-4 h-4" />
            </div>
            <span>Personify</span>
          </div>
          <p className="text-xs text-[#6B6B70] dark:text-[#98989F]">
            Autonomous AI Persona Usability Platform.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EBF3F0] dark:bg-[#15201B] border border-[#8FB8A8]/30 text-xs text-[#3D6B58] dark:text-[#8FB8A8] font-medium">
            <span className="w-2 h-2 rounded-full bg-[#8FB8A8] animate-pulse" />
            All 50 Persona Engines Operational
          </div>
        </div>

        {/* Center Links */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm font-medium text-[#6B6B70] dark:text-[#98989F]">
          <a href="#features" className="hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] transition-colors">How it works</a>
          <a href="#personas" className="hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] transition-colors">Personas</a>
          <a href="#pricing" className="hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] transition-colors">Pricing</a>
          <a href="#" className="hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] transition-colors">Privacy</a>
          <a href="#" className="hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] transition-colors">Terms</a>
        </div>

        {/* Right Copyright & Social Icons */}
        <div className="flex flex-col items-center md:items-end gap-3 text-xs text-[#6B6B70] dark:text-[#98989F]">
          <div className="flex items-center gap-4">
            <a href="#" aria-label="Website" className="hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7]">
              <Globe className="w-4 h-4" />
            </a>
            <a href="#" aria-label="Community" className="hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7]">
              <MessageSquare className="w-4 h-4" />
            </a>
            <a href="#" aria-label="Share" className="hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7]">
              <Share2 className="w-4 h-4" />
            </a>
          </div>
          <p>© {new Date().getFullYear()} Personify Inc. All rights reserved.</p>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
