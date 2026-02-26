import React, { useState, useEffect } from 'react';
import { Smartphone, Download, Share } from 'lucide-react';

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 1. Detecta se é iOS
    const ios = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
    setIsIOS(ios);

    // 2. Verifica se já está instalado
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    setIsInstalled(standalone);

    // 3. Captura o evento de instalação (Android/Chrome)
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      alert('To install on iPhone: Tap the Share icon and select "Add to Home Screen".');
      return;
    }

    if (!deferredPrompt) {
      // Se não houver prompt mas não estiver instalado, o Chrome pode ter bloqueado temporariamente
      alert('Installation is ready! Look for the install icon in your browser address bar.');
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setIsInstalled(true);
    }
  };

  // Se já estiver instalado, não mostra o botão
  if (isInstalled) return null;

  return (
    <button
      onClick={handleInstallClick}
      className="flex items-center gap-3 px-4 py-3 w-full text-barber-gold hover:bg-barber-gold/10 rounded-lg transition-all duration-200 border border-barber-gold/20 group"
    >
      <div className="bg-barber-gold text-black p-1.5 rounded-md group-hover:scale-110 transition-transform">
        {isIOS ? <Share size={16} /> : <Download size={16} />}
      </div>
      <div className="text-left">
        <p className="text-xs font-black uppercase tracking-tighter italic leading-none">
          {isIOS ? 'Install on iOS' : 'Install App'}
        </p>
        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
          Faster Experience
        </p>
      </div>
    </button>
  );
}