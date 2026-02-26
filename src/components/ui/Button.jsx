import React from 'react';

// Este componente aceita:
// - children: o texto dentro do botão
// - variant: 'primary' (vermelho) ou 'outline' (borda dourada)
// - loading: se for true, mostra "Carregando..." e desabilita
// - ...props: qualquer outra coisa (como onClick)
export function Button({ children, variant = 'primary', loading, className = '', ...props }) {
  
  const baseStyles = "w-full py-3 px-4 rounded font-bold transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-barber-red hover:bg-red-700 text-white shadow-lg shadow-red-900/20",
    outline: "border border-barber-gold text-barber-gold hover:bg-barber-gold hover:text-barber-black",
    ghost: "text-barber-gray hover:text-white"
  };

  return (
    <button 
      disabled={loading}
      className={`${baseStyles} ${variants[variant]} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="animate-pulse">Processando...</span>
      ) : children}
    </button>
  );
}