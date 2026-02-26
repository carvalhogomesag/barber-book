import React, { useState, useEffect } from 'react';
import { Cookie, X } from 'lucide-react';
import { Button } from './Button';

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Verifica se o usuário já aceitou os cookies anteriormente
    const consent = localStorage.getItem('schedy_cookies_consent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('schedy_cookies_consent', 'accepted');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-8 md:max-w-md z-[100] animate-in fade-in slide-in-from-bottom-10 duration-700">
      <div className="bg-barber-black border border-zinc-800 p-6 rounded-2xl shadow-2xl shadow-black/50">
        <div className="flex items-start gap-4">
          <div className="bg-barber-gold/10 p-3 rounded-xl text-barber-gold shrink-0">
            <Cookie size={24} />
          </div>
          
          <div className="flex-1">
            <h3 className="text-white font-bold text-sm uppercase tracking-tight mb-1 italic">
              Cookies & Privacy
            </h3>
            <p className="text-zinc-400 text-xs leading-relaxed mb-4">
              We use cookies to enhance your experience and analyze our traffic via Google Analytics. By clicking "Accept", you agree to our use of cookies.
            </p>
            
            <div className="flex gap-3">
              <Button 
                onClick={handleAccept}
                className="h-10 text-xs uppercase font-black italic tracking-tighter"
              >
                Accept All
              </Button>
              <button 
                onClick={() => setIsVisible(false)}
                className="text-zinc-500 hover:text-white text-[10px] uppercase font-bold tracking-widest transition-colors px-2"
              >
                Decline
              </button>
            </div>
          </div>

          <button 
            onClick={() => setIsVisible(false)}
            className="text-zinc-600 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}