import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Shield, Wallet, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/contexts/AuthContext';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const { walletAddress, isConnected, disconnectWallet } = useWallet();
  const { isAuthenticated, logout, user } = useAuth();

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/login', label: 'Login' },
    { path: '/signup', label: 'Sign Up' },
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/contact', label: 'Contact' },
    { path: '/about', label: 'Details' },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
    disconnectWallet();
    setIsOpen(false);
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            <span className="font-display text-xl font-bold gradient-text">SafeHaven</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`nav-link ${isActive(link.path) ? 'active' : ''}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Wallet & Auth Status */}
          <div className="hidden md:flex items-center gap-4">
            {isConnected && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border border-border">
                <Wallet className="w-4 h-4 text-primary" />
                <span className="text-sm font-mono">{truncateAddress(walletAddress!)}</span>
              </div>
            )}
            {isAuthenticated && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-border/50">
            <div className="flex flex-col gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    isActive(link.path)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              {isConnected && (
                <div className="flex items-center gap-2 px-4 py-2 mt-2 border-t border-border/50">
                  <Wallet className="w-4 h-4 text-primary" />
                  <span className="text-sm font-mono">{truncateAddress(walletAddress!)}</span>
                </div>
              )}
              {isAuthenticated && (
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 text-destructive hover:bg-destructive/10 rounded-lg"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
