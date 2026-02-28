import React from 'react';

/**
 * Button Component - Schedy Premium UI
 * Foco: Alto contraste, tipografia editorial e feedback tátil.
 */
export function Button({ 
  children, 
  variant = 'primary', 
  loading, 
  className = '', 
  ...props 
}) {
  
  // Base: Cantos arredondados premium, tipografia itálica pesada e tracking apertado
  const baseStyles = "w-full py-4 px-6 rounded-2xl font-black uppercase italic tracking-tighter transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 text-sm";
  
  const variants = {
    // Principal: Preto sólido (contraste total no fundo claro)
    primary: "bg-schedy-black text-white shadow-vivid hover:bg-schedy-gray",
    
    // Outline: Borda de 2px preta, fundo transparente (Inverte no hover)
    outline: "border-2 border-schedy-black text-schedy-black bg-transparent hover:bg-schedy-black hover:text-white",
    
    // Ghost: Para ações secundárias, apenas texto e hover suave
    ghost: "text-schedy-gray hover:text-schedy-black hover:bg-schedy-canvas",
    
    // Danger: Para exclusão (Vermelho Vivo)
    danger: "bg-schedy-danger text-white hover:bg-red-700 shadow-sm"
  };

  return (
    <button 
      disabled={loading}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {loading ? (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          <span className="animate-pulse">Sincronizando...</span>
        </div>
      ) : children}
    </button>
  );
}