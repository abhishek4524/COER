import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import ThemeToggle from '../ui/ThemeToggle';
import { Menu, X, Sparkles } from 'lucide-react';

export const Navbar = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[#F7F6F3]/80 dark:bg-[#0F0F12]/80 border-b border-[#ECEAE5]/60 dark:border-[#26262F]/60 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Logo */}
        <a href="#" className="flex items-center gap-2.5 text-[#1C1C1E] dark:text-[#F2F2F7] font-heading font-bold text-xl tracking-tight">
          <div className="w-9 h-9 rounded-2xl bg-[#6C63FF] flex items-center justify-center text-white shadow-md shadow-[#6C63FF]/30">
            <Sparkles className="w-5 h-5" />
          </div>
          <span>Personify</span>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#6C63FF]/10 text-[#6C63FF] font-semibold">AI</span>
        </a>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#6B6B70] dark:text-[#98989F]">
          <a href="#features" className="hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] transition-colors">How it works</a>
          <a href="#personas" className="hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] transition-colors">Personas</a>
          <a href="#pricing" className="hover:text-[#1C1C1E] dark:hover:text-[#F2F2F7] transition-colors">Pricing</a>
        </nav>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/dashboard')}>Sign in</Button>
          <Button variant="primary" size="sm" pill onClick={() => navigate('/app/new-run')}>Start testing</Button>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#1C1C1E] dark:text-[#F2F2F7] rounded-xl hover:bg-black/5 dark:hover:bg-white/5"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#ECEAE5] dark:border-[#26262F] bg-white dark:bg-[#17171B] px-6 py-6 space-y-4 shadow-xl">
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-[#1C1C1E] dark:text-[#F2F2F7]"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-[#1C1C1E] dark:text-[#F2F2F7]"
          >
            How it works
          </a>
          <a
            href="#personas"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-[#1C1C1E] dark:text-[#F2F2F7]"
          >
            Personas
          </a>
          <a
            href="#pricing"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-[#1C1C1E] dark:text-[#F2F2F7]"
          >
            Pricing
          </a>
          <div className="pt-4 border-t border-[#ECEAE5] dark:border-[#26262F] flex flex-col gap-3">
            <Button variant="secondary" size="md" className="w-full" onClick={() => { setMobileMenuOpen(false); navigate('/app/dashboard'); }}>Sign in</Button>
            <Button variant="primary" size="md" className="w-full" pill onClick={() => { setMobileMenuOpen(false); navigate('/app/new-run'); }}>Start testing</Button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
