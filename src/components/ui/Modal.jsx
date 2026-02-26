import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({ isOpen, onClose, title, children }) {
  
  // BLOQUEIO DE SCROLL DO FUNDO:
  // Impede que a tela de trás (calendário) se mova enquanto o modal está aberto.
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    // Limpeza ao fechar ou desmontar o componente
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      
      {/* Fundo escuro (clicar nele fecha o modal) */}
      <div 
        className="absolute inset-0 bg-black/90 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* A Janela do Modal - Agora com altura máxima e flexbox para permitir scroll interno */}
      <div className="relative w-full max-w-md bg-barber-black border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
        
        {/* Cabeçalho Fixo no Topo */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800/50">
          <h2 className="text-xl font-black text-barber-white uppercase italic tracking-tighter">{title}</h2>
          <button 
            onClick={onClose}
            className="text-barber-gray hover:text-white transition-colors p-1.5 bg-zinc-900 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Área de Conteúdo (Formulário) - Onde o scroll acontece */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}