import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { 
  TrendingUp, Users, AlertCircle, CheckCircle, 
  DollarSign, UserMinus, BarChart3, Search, Clock 
} from 'lucide-react';
import { getAllSubscriptions, getAllTenants } from '../services/adminService';
import { format, differenceInDays } from 'date-fns';

export function AdminDashboard() {
  const [subs, setSubs] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function loadData() {
      const [subsData, tenantsData] = await Promise.all([
        getAllSubscriptions(),
        getAllTenants()
      ]);
      setSubs(subsData);
      setTenants(tenantsData);
      setLoading(false);
    }
    loadData();
  }, []);

  // --- CÁLCULO DE MÉTRICAS ---
  const metrics = {
    activeTrials: subs.filter(s => s.status === 'trialing').length,
    expiring7d: subs.filter(s => {
      const days = differenceInDays(new Date(s.trialEnd?.seconds * 1000), new Date());
      return s.status === 'trialing' && days <= 7 && days > 2;
    }).length,
    expiring2d: subs.filter(s => {
      const days = differenceInDays(new Date(s.trialEnd?.seconds * 1000), new Date());
      return s.status === 'trialing' && days <= 2 && days >= 0;
    }).length,
    activePaid: subs.filter(s => s.status === 'active').length,
    mrr: subs.filter(s => s.status === 'active').length * 29, // Valor fixo de $29
    conversionRate: subs.length > 0 
      ? ((subs.filter(s => s.convertedToPaid).length / subs.length) * 100).toFixed(1) 
      : 0
  };

  // Mapear nome do usuário para a tabela
  const tableData = subs.map(sub => {
    const user = tenants.find(t => t.id === sub.userId);
    const daysLeft = differenceInDays(new Date(sub.trialEnd?.seconds * 1000), new Date());
    return { ...sub, userName: user?.name || 'Unknown', userEmail: user?.email, daysLeft };
  }).filter(item => 
    item.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.userEmail?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8 text-barber-gold animate-pulse font-black uppercase italic">Loading Intelligence...</div>;

  return (
    <AppLayout>
      <header className="mb-8">
        <h1 className="text-3xl font-black text-barber-white uppercase italic tracking-tighter flex items-center gap-3">
          <BarChart3 className="text-barber-gold" size={32} />
          Business Intelligence
        </h1>
        <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">Schedy AI Revenue & Growth</p>
      </header>

      {/* METRICS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard icon={<TrendingUp/>} label="Current MRR" value={`$${metrics.mrr}`} color="text-green-500" />
        <MetricCard icon={<Users/>} label="Active Trials" value={metrics.activeTrials} color="text-barber-gold" />
        <MetricCard icon={<Clock/>} label="Expiring (2 days)" value={metrics.expiring2d} color="text-red-500" />
        <MetricCard icon={<CheckCircle/>} label="Conversion" value={`${metrics.conversionRate}%`} color="text-blue-500" />
      </div>

      {/* SUBSCRIPTION TABLE */}
      <div className="bg-barber-black border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-zinc-800 flex items-center gap-4 bg-zinc-900/30">
          <Search className="text-zinc-500" size={20} />
          <input 
            type="text" 
            placeholder="Search by professional name..." 
            className="bg-transparent border-none outline-none text-white w-full text-sm font-medium"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-500 uppercase text-[10px] font-black tracking-widest">
              <tr>
                <th className="p-6">Professional</th>
                <th className="p-6">Status</th>
                <th className="p-6">Trial Ends</th>
                <th className="p-6">Days Left</th>
                <th className="p-6">Emails Sent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {tableData.map(item => (
                <tr key={item.id} className="hover:bg-zinc-900/50 transition-colors group">
                  <td className="p-6">
                    <div className="font-bold text-white group-hover:text-barber-gold transition-colors">{item.userName}</div>
                    <div className="text-[10px] text-zinc-500">{item.userEmail}</div>
                  </td>
                  <td className="p-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase italic ${
                      item.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-barber-gold/10 text-barber-gold'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="p-6 text-zinc-400 font-mono text-xs">
                    {item.trialEnd ? format(new Date(item.trialEnd.seconds * 1000), 'MMM dd, yyyy') : '-'}
                  </td>
                  <td className="p-6">
                    <span className={`font-black ${item.daysLeft <= 2 ? 'text-red-500' : 'text-white'}`}>
                      {item.daysLeft}d
                    </span>
                  </td>
                  <td className="p-6">
                    <div className="flex gap-2">
                      <EmailBadge active={item.trial21EmailSent} label="21d" />
                      <EmailBadge active={item.trial28EmailSent} label="28d" />
                      <EmailBadge active={item.trial29EmailSent} label="29d" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}

function MetricCard({ icon, label, value, color }) {
  return (
    <div className="bg-barber-black border border-zinc-800 p-6 rounded-3xl shadow-lg">
      <div className={`${color} mb-3`}>{icon}</div>
      <div className="text-3xl font-black text-white tracking-tighter italic">{value}</div>
      <div className="text-[10px] text-zinc-500 uppercase font-black tracking-widest mt-1">{label}</div>
    </div>
  );
}

function EmailBadge({ active, label }) {
  return (
    <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${
      active ? 'bg-green-500/20 border-green-500/50 text-green-500' : 'bg-zinc-800 border-zinc-700 text-zinc-600'
    }`}>
      {label}
    </span>
  );
}