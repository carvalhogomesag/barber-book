import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { Input } from '../components/ui/Input';
import { 
  Users, 
  Search, 
  Globe, 
  MessageCircle, 
  Calendar, 
  Zap,
  Clock,
  ExternalLink,
  Filter
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getSalespersonProfile, getMyReferralClients } from '../services/salesService';

export function SalesCRM() {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'pro', 'trial', 'free'

  useEffect(() => {
    async function loadCRM() {
      if (!user) return;
      try {
        const salesProfile = await getSalespersonProfile(user.uid);
        if (salesProfile) {
          const myClients = await getMyReferralClients(salesProfile.referralCode);
          setClients(myClients);
        }
      } catch (error) {
        console.error("Error loading CRM:", error);
      } finally {
        setLoading(false);
      }
    }
    loadCRM();
  }, [user]);

  // Lógica de Filtro e Busca
  const filteredClients = clients.filter(client => {
    const matchesSearch = 
      client.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.barberShopName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'pro') return matchesSearch && client.plan === 'pro' && client.subscriptionStatus !== 'trialing';
    if (filterStatus === 'trial') return matchesSearch && client.subscriptionStatus === 'trialing';
    if (filterStatus === 'free') return matchesSearch && client.plan === 'free';
    
    return matchesSearch;
  });

  if (loading) return <AppLayout><div className="p-8 text-barber-gold animate-pulse font-black uppercase italic">Loading Your Network...</div></AppLayout>;

  return (
    <AppLayout>
      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
            <div className="bg-barber-gold text-black p-1.5 rounded-lg">
                <Users size={20} />
            </div>
            <h1 className="text-2xl font-black text-barber-white uppercase italic tracking-tighter">My Network</h1>
        </div>
        <p className="text-barber-gray font-bold uppercase tracking-widest text-[10px]">Manage and support your referred professionals</p>
      </header>

      {/* BARRA DE FERRAMENTAS (BUSCA E FILTROS) */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input 
            type="text" 
            placeholder="Search by name, business or email..." 
            className="w-full bg-barber-black border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-barber-gold transition-all"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <FilterButton active={filterStatus === 'all'} onClick={() => setFilterStatus('all')} label="All" />
            <FilterButton active={filterStatus === 'trial'} onClick={() => setFilterStatus('trial')} label="In Trial" />
            <FilterButton active={filterStatus === 'pro'} onClick={() => setFilterStatus('pro')} label="Active Pro" />
            <FilterButton active={filterStatus === 'free'} onClick={() => setFilterStatus('free')} label="Free" />
        </div>
      </div>

      {/* TABELA CRM */}
      <div className="bg-barber-black border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-barber-gray uppercase text-[10px] font-black tracking-widest">
              <tr>
                <th className="p-6">Professional / Business</th>
                <th className="p-6">Location</th>
                <th className="p-6">Status</th>
                <th className="p-6">Trial Ends</th>
                <th className="p-6 text-right">Support</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-20 text-center text-zinc-600 italic font-medium">
                    No professionals found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredClients.map(client => (
                  <tr key={client.id} className="hover:bg-zinc-900/50 transition-colors group">
                    <td className="p-6">
                      <div className="font-bold text-white group-hover:text-barber-gold transition-colors">{client.barberShopName || client.name}</div>
                      <div className="text-[10px] text-zinc-500">{client.email}</div>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2 font-bold text-zinc-400 text-xs">
                        <Globe size={14} className="text-zinc-600" /> {client.country}
                      </div>
                    </td>
                    <td className="p-6">
                      <StatusBadge plan={client.plan} status={client.subscriptionStatus} />
                    </td>
                    <td className="p-6">
                        <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium">
                            <Clock size={14} />
                            {client.trialExpiresAt ? new Date(client.trialExpiresAt).toLocaleDateString() : '---'}
                        </div>
                    </td>
                    <td className="p-6 text-right">
                        <a 
                            href={`https://wa.me/${client.phone?.replace(/\D/g, '')}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 bg-green-500/10 hover:bg-green-500 text-green-500 hover:text-black px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all italic"
                        >
                            <MessageCircle size={14} /> WhatsApp
                        </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}

// COMPONENTES AUXILIARES DE INTERFACE
function FilterButton({ active, onClick, label }) {
    return (
        <button 
            onClick={onClick}
            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                active ? 'bg-barber-gold text-black shadow-lg' : 'text-zinc-500 hover:text-white'
            }`}
        >
            {label}
        </button>
    );
}

function StatusBadge({ plan, status }) {
    if (plan === 'pro') {
        if (status === 'trialing') {
            return (
                <span className="bg-barber-gold/10 text-barber-gold px-3 py-1 rounded-full text-[9px] font-black uppercase italic border border-barber-gold/20 animate-pulse">
                    Free Trial
                </span>
            );
        }
        return (
            <span className="bg-green-500/10 text-green-500 px-3 py-1 rounded-full text-[9px] font-black uppercase italic border border-green-500/20">
                Active Pro
            </span>
        );
    }
    return (
        <span className="bg-zinc-800 text-zinc-500 px-3 py-1 rounded-full text-[9px] font-black uppercase italic border border-zinc-700">
            Free Starter
        </span>
    );
}