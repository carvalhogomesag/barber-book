import React from 'react';

/**
 * Input Component - Schedy Premium UI
 * Foco: Legibilidade imediata, estados de foco nítidos e contraste absoluto.
 */
export function Input({ label, type = "text", error, ...props }) {
  return (
    <div className="flex flex-col gap-1.5 w-full group">
      {label && (
        <label className="text-[10px] font-black text-schedy-gray uppercase tracking-[0.2em] ml-1 group-focus-within:text-schedy-black transition-colors">
          {label}
        </label>
      )}
      
      <div className="relative">
        <input 
          type={type}
          className={`
            w-full bg-schedy-canvas border-2 rounded-2xl p-4 
            text-schedy-black font-bold text-sm
            placeholder:text-schedy-gray/50 
            transition-all duration-200 outline-none
            /* Estado Normal: Borda sutil */
            ${error ? 'border-schedy-danger' : 'border-schedy-border'}
            /* Estado Foco: Borda preta e leve elevação */
            focus:border-schedy-black focus:bg-white focus:shadow-sm
          `}
          {...props}
        />
        
        {/* Indicador visual de erro (Ícone de exclamação opcional ou apenas borda) */}
        {error && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-schedy-danger">
             <span className="text-xs font-black">!</span>
          </div>
        )}
      </div>

      {error && (
        <span className="text-[10px] font-bold text-schedy-danger uppercase tracking-widest ml-1 animate-in fade-in slide-in-from-top-1">
          {error}
        </span>
      )}
    </div>
  );
}