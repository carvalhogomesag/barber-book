import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { 
  BarChart3, 
  TrendingUp, 
  Globe, 
  PieChart, 
  ArrowUpRight, 
  Target,
  Zap,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getSalespersonProfile, getMyReferralClients, getSalesAnalytics, calculateSalesStats } from '../services/salesService';

export function SalesAnalytics() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState({ growth: [], countries: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        const profile = await getSalespersonProfile(user.uid);
        if (profile) {
          const myClients = await getMyReferralClients(profile.referralCode);
          setClients(myClients);
          setStats(calculateSalesStats(myClients));
          setAnalytics(getSalesAnalytics(myClients));
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  if (loading) return <AppLayout><div className="p-8 text-barber-gold animate-pulse font-black uppercase italic">Analyzing Performance...</div></AppLayout>;

  const maxGrowth = Math.max(...analytics.growth.map(d => d.value), 1);

  return (
    <AppLayout>
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
            <div className="bg-barber-gold text-black p-1.5 rounded-lg">
                <BarChart3 size={20} />
            </div>
            <h1 className="text-2xl font-black text-barber-white uppercase italic tracking-tighter">Performance Insights</h1>
        </div>
        <p className="text-barber-gray font-bold uppercase tracking-widest text-[10px]">Data-driven growth for your partner network</p>
      </header>

      {/* TOP METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-barber-black border border-zinc-800 p-6 rounded-3xl shadow-xl">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Conversion Rate (Trial to Pro)</p>
            <div className="flex items-end gap-3">
                <p className="text-4xl font-black text-white italic tracking-tighter">
                    {stats?.total > 0 ? ((stats.activePro / stats.total) * 100).toFixed(1) : 0}%
                </p>
                <div className="mb-1 flex items-center text-green-500 text-[10px] font-bold">
                    <TrendingUp size={12} className="mr-1" /> HEALTHY
                </div>
            </div>
        </div>

        <div className="bg-barber-black border border-zinc-800 p-6 rounded-3xl shadow-xl">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Projected Annual Income</p>
            <p className="text-4xl font-black text-barber-gold italic tracking-tighter">
                ${(stats?.currentMonthly * 12).toFixed(2)}
            </p>
            <p className="text-[9px] text-zinc-600 font-bold uppercase mt-2">Based on current active subscribers</p>
        </div>

        <div className="bg-barber-black border border-zinc-800 p-6 rounded-3xl shadow-xl">
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-4">Network Value</p>
            <p className="text-4xl font-black text-blue-400 italic tracking-tighter">
                ${(stats?.potentialMonthly * 12).toFixed(2)}
            </p>
            <p className="text-[9px] text-zinc-600 font-bold uppercase mt-2">Potential if all trials convert</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* GROWTH CHART (CSS BARS) */}
        <div className="bg-barber-black border border-zinc-800 rounded-3xl p-8 shadow-xl">
            <h3 className="text-sm font-black text-white uppercase italic mb-10 flex items-center gap-2">
                <TrendingUp size={18} className="text-barber-gold" /> Referral Growth (6 Months)
            </h3>
            
            <div className="flex items-end justify-between h-48 gap-2">
                {analytics.growth.map((data, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-3 group">
                        <div className="w-full relative flex flex-col justify-end h-full">
                            <div 
                                className="w-full bg-zinc-800 group-hover:bg-barber-gold transition-all duration-500 rounded-t-lg relative"
                                style={{ height: `${(data.value / maxGrowth) * 100}%`, minHeight: data.value > 0 ? '4px' : '0' }}
                            >
                                {data.value > 0 && (
                                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-black text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                        {data.value}
                                    </span>
                                )}
                            </div>
                        </div>
                        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-tighter">{data.name}</span>
                    </div>
                ))}
            </div>
        </div>

        {/* COUNTRY RANKING */}
        <div className="bg-barber-black border border-zinc-800 rounded-3xl p-8 shadow-xl">
            <h3 className="text-sm font-black text-white uppercase italic mb-8 flex items-center gap-2">
                <Globe size={18} className="text-barber-gold" /> Global Reach
            </h3>
            
            <div className="space-y-6">
                {analytics.countries.length === 0 ? (
                    <p className="text-zinc-600 italic text-sm">No geographic data available yet.</p>
                ) : (
                    analytics.countries.map((c, idx) => (
                        <div key={idx} className="space-y-2">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                <span className="text-zinc-400">{c.name}</span>
                                <span className="text-white">{c.value} Clients</span>
                            </div>
                            <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden">
                                <div 
                                    className="bg-barber-gold h-full rounded-full" 
                                    style={{ width: `${(c.value / stats.total) * 100}%` }}
                                />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      </div>

      {/* STRATEGY CARD */}
      <div className="mt-12 p-8 bg-barber-gold/5 border border-barber-gold/10 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8">
        <div className="w-20 h-20 bg-barber-gold rounded-full flex items-center justify-center text-black shadow-2xl shadow-barber-gold/20 shrink-0">
            <Target size={40} />
        </div>
        <div>
            <h4 className="text-xl font-black text-white uppercase italic tracking-tighter mb-2">Growth Strategy Tip</h4>
            <p className="text-zinc-500 text-sm font-medium italic leading-relaxed">
                Your highest conversion comes from <span className="text-white font-bold">Trial users</span> who receive support in the first 7 days. 
                Use your <span className="text-barber-gold font-bold">Network CRM</span> to identify clients in trial and offer them a quick setup call. 
                Every Pro activation increases your <span className="text-white font-bold">Projected Annual Income</span>.
            </p>
        </div>
      </div>
    </AppLayout>
  );
}