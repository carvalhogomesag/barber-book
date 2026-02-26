import React from 'react';

// Este componente já vem com o Label (o título acima do campo)
export function Input({ label, type = "text", error, ...props }) {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && <label className="text-sm text-barber-gray font-medium">{label}</label>}
      <input 
        type={type}
        className={`bg-barber-black border border-zinc-800 rounded p-3 text-barber-white focus:outline-none focus:border-barber-gold transition-colors placeholder:text-zinc-700 ${error ? 'border-red-500' : ''}`}
        {...props}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}