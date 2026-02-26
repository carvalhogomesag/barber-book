import React from 'react';
import { UserCheck, UserX, AlertTriangle } from 'lucide-react';

export function StatusBadge({ status }) {
  const configs = {
    active: { 
      label: 'Active', 
      color: 'bg-green-500/10 text-green-500', 
      icon: <UserCheck size={10} /> 
    },
    inactive: { 
      label: 'Inactive', 
      color: 'bg-red-500/10 text-red-500', 
      icon: <UserX size={10} /> 
    },
    closure_requested: { 
      label: 'Closure Req.', 
      color: 'bg-barber-gold/20 text-barber-gold animate-pulse', 
      icon: <AlertTriangle size={10} /> 
    }
  };

  const config = configs[status] || configs.active;

  return (
    <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase flex items-center gap-1 w-fit ${config.color}`}>
      {config.icon} {config.label}
    </span>
  );
}