import React from 'react';
import { Users, Zap, Briefcase, Clock } from 'lucide-react';

export function AdminStats({ stats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <StatCard 
        icon={<Users/>} 
        label="Total Users" 
        value={stats.total} 
        color="text-white" 
      />
      <StatCard 
        icon={<Zap/>} 
        label="PRO Subs" 
        value={stats.pro} 
        color="text-barber-gold" 
      />
      <StatCard 
        icon={<Briefcase/>} 
        label="Sales Team" 
        value={stats.salesCount} 
        color="text-blue-400" 
      />
      <StatCard 
        icon={<Clock/>} 
        label="Pending Payouts" 
        value={stats.pendingPayouts} 
        color="text-red-400" 
      />
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="bg-barber-black border border-zinc-800 p-6 rounded-3xl shadow-lg hover:border-zinc-700 transition-all">
      <div className={`${color} mb-3 opacity-80`}>{icon}</div>
      <div className="text-3xl font-black text-white tracking-tighter italic">{value}</div>
      <div className="text-[10px] text-barber-gray uppercase font-black tracking-[0.2em] mt-1">{label}</div>
    </div>
  );
}