import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Modal Component - Schedy Premium UI
 * Foco: Largura generosa (Wide Layout), Header/Footer fixos e Contraste Máximo.
 */
export function Modal({ isOpen, onClose, title, children, footer }) {
  
  // BLOQUEIO DE SCROLL DO FUNDO
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      
      {/* Overlay com Blur Elegante */}
      <div 
        className="absolute inset-0 bg-schedy-black/20 backdrop-blur-md transition-opacity"
        onClick={onClose}
      ></div>

      {/* 
         JANELA DO MODAL:
         - max-w-2xl: Aumentamos a largura para comportar agendamentos manuais
         - bg-white: Agora no padrão Light de alto contraste
      */}
      <div className="relative w-full max-w-2xl bg-white border border-schedy-border rounded-[32px] shadow-vivid flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-300 overflow-hidden">
        
        {/* 1. CABEÇALHO (FIXO) */}
        <div className="flex items-center justify-between p-8 border-b border-schedy-border bg-white z-10">
          <div className="flex flex-col">
            <h2 className="text-2xl font-black text-schedy-black uppercase italic tracking-tighter leading-none">
              {title}
            </h2>
            <div className="h-1 w-12 bg-schedy-black mt-2 rounded-full" />
          </div>
          
          <button 
            onClick={onClose}
            className="text-schedy-gray hover:text-schedy-black transition-all p-2 bg-schedy-canvas rounded-xl hover:rotate-90"
          >
            <X size={20} />
          </button>
        </div>

        {/* 2. ÁREA DE CONTEÚDO (SCROLL INTERNO) */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-white">
          <div className="space-y-6">
            {children}
          </div>
        </div>

        {/* 3. RODAPÉ (FIXO - Se houver botões passados via prop) */}
        {footer && (
          <div className="p-8 border-t border-schedy-border bg-schedy-canvas/30 z-10">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}