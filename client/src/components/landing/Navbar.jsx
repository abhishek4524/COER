import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Button from '../ui/Button';
import ThemeToggle from '../ui/ThemeToggle';
import { Menu, X, Sparkles, User, LayoutDashboard, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

import Logo from '../common/Logo';

export const Navbar = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'U';

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-[#F7F6F3]/80 dark:bg-[#0F0F12]/80 border-b border-[#ECEAE5]/60 dark:border-[#26262F]/60 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Logo */}
        <Link to="/">
          <Logo className="h-14 w-auto" />
        </Link>

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

          {user ? (
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                pill
                onClick={() => navigate('/app/dashboard')}
                icon={LayoutDashboard}
              >
                Dashboard
              </Button>

              <button
                onClick={() => navigate('/app/account')}
                className="w-9 h-9 rounded-full bg-[#6C63FF] text-white flex items-center justify-center text-xs font-bold shadow-md hover:opacity-90 transition-opacity overflow-hidden"
                title={user.name}
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  initials
                )}
              </button>
            </div>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                Sign in
              </Button>
              <Button variant="primary" size="sm" pill onClick={() => navigate('/login')}>
                Start testing
              </Button>
            </>
          )}
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
            {user ? (
              <>
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                  pill
                  onClick={() => { setMobileMenuOpen(false); navigate('/app/dashboard'); }}
                >
                  Go to Dashboard
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  className="w-full"
                  onClick={() => { setMobileMenuOpen(false); navigate('/app/account'); }}
                >
                  My Account ({user.name})
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" size="md" className="w-full" onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}>
                  Sign in
                </Button>
                <Button variant="primary" size="md" className="w-full" pill onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}>
                  Start testing
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
