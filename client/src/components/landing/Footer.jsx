import React from 'react';
import { Link } from 'react-router-dom';
import { Globe, MessageSquare, Share2 } from 'lucide-react';
import Logo from '../common/Logo';

export const Footer = () => {
  return (
    <footer className="w-full bg-white dark:bg-[#17171B] border-t border-[#ECEAE5] dark:border-[#26262F] transition-colors py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
        
        {/* Left Logo & Status */}
        <div className="flex flex-col items-center md:items-start gap-3">
          <Link to="/">
            <Logo className="h-8 w-auto" />
          </Link>
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
          <a href="/#features" className="hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] transition-colors">Features</a>
          <a href="/pricing" className="hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] transition-colors">Pricing</a>
          <Link to="/privacy" className="hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] transition-colors">Terms</Link>
          <Link to="/refund" className="hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] transition-colors">Refund Policy</Link>
          <Link to="/cookies" className="hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] transition-colors">Cookies</Link>
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
          <p>© {new Date().getFullYear()} VibeTest Inc. All rights reserved.</p>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
