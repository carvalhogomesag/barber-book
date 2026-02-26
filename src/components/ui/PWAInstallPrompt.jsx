import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share } from 'lucide-react';
import { Button } from './Button';

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 1. Detecta se é iOS (iPhone/iPad) para mostrar instrução manual
    const userAgent = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(ios);

    // 2. Verifica se o app já está instalado e rodando como App
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    // 3. Lógica para Android e Desktop (Chrome/Edge)
    const handler = (e) => {
      // Impede o banner padrão do navegador de aparecer sozinho
      e.preventDefault();
      // Guarda o evento para disparar quando o usuário clicar no nosso botão
      setDeferredPrompt(e);
      // Se não estiver instalado, mostra o nosso popup
      if (!isStandalone) {
        setIsVisible(true);
      }
    };

    // 4. No iOS, mostramos o banner após 3 segundos (já que não existe evento automático)
    if (ios && !isStandalone) {
      const timer = setTimeout(() => setIsVisible(true), 3000);
      return () => clearTimeout(timer);
    }

    // Ouvinte para o evento de instalação do Android/Chrome
    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Dispara o prompt nativo do Android
    deferredPrompt.prompt();

    // Verifica se o usuário aceitou ou recusou
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('Usuário instalou o Schedy');
      setDeferredPrompt(null);
    }

    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-24 left-6 right-6 md:left-auto md:right-8 md:max-w-sm z-[110] animate-in fade-in slide-in-from-bottom-10 duration-700">
      <div className="bg-zinc-900 border-2 border-barber-gold p-5 rounded-2xl shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="bg-barber-gold text-black p-3 rounded-xl shrink-0">
            <Smartphone size={24} />
          </div>
          
          <div className="flex-1 text-left">
            <h3 className="text-white font-bold text-sm uppercase tracking-tight mb-1 italic">
              {isIOS ? 'Install Schedy on iPhone' : 'Install Schedy AI'}
            </h3>
            
            {isIOS ? (
              <div className="text-zinc-400 text-xs leading-relaxed mb-4">
                Tap the <Share size={14} className="inline mx-1 text-barber-gold" /> icon below and select <span className="text-white font-bold">"Add to Home Screen"</span>.
              </div>
            ) : (
              <p className="text-zinc-400 text-xs leading-relaxed mb-4">
                Install our app for a faster experience and instant access to your schedule.
              </p>
            )}
            
            {!isIOS && (
              <Button 
                onClick={handleInstall}
                className="h-10 text-xs uppercase font-black italic tracking-tighter flex gap-2"
              >
                <Download size={16} /> Install App
              </Button>
            )}
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