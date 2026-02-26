import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { 
  Users, 
  Search, 
  Phone, 
  Calendar, 
  Tag, 
  FileText, 
  Trash2, 
  ExternalLink,
  UserCircle,
  Loader2,
  Edit,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  getCustomers, 
  updateCustomer, 
  deleteCustomer, 
  getProfessionalProfile 
} from '../services/professionalService';

export function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [profile, setProfile] = useState(null);
  
  // Estados para Edição Manual
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [editNotes, setEditNotes] = useState('');
  const [editPreferences, setEditPreferences] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Busca o perfil e os clientes em paralelo para ganhar velocidade
      const [profData, customersData] = await Promise.all([
        getProfessionalProfile(),
        getCustomers()
      ]);
      
      setProfile(profData);
      setCustomers(customersData);
    } catch (error) {
      console.error("Schedy CRM Error: Loading failed", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (customer) => {
    setSelectedCustomer(customer);
    setEditNotes(customer.notes || '');
    setEditPreferences(customer.preferences || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateCustomer(selectedCustomer.id, {
        notes: editNotes,
        preferences: editPreferences,
        updatedAt: new Date().toISOString()
      });
      await loadData();
      setIsModalOpen(false);
    } catch (error) {
      alert("Error updating customer records.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure? This will remove the client from your CRM records.")) return;
    try {
      await deleteCustomer(id);
      loadData();
    } catch (error) {
      alert("Error removing customer.");
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone?.includes(searchTerm)
  );

  return (
    <AppLayout>
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-barber-gold text-black p-1.5 rounded-lg shadow-lg shadow-barber-gold/20">
                <Users size={24} />
            </div>
            <h1 className="text-3xl font-black text-barber-white uppercase italic tracking-tighter">
              Customer <span className="text-barber-gold">Vault</span>
            </h1>
          </div>
          <p className="text-barber-gray text-xs font-bold uppercase tracking-widest opacity-70">
            Intelligence and insights captured by your AI Concierge
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          {/* Contador de Clientes */}
          <div className="bg-zinc-900/50 border border-zinc-800 px-6 py-2.5 rounded-2xl flex items-center gap-3 w-full sm:w-auto">
            <TrendingUp size={16} className="text-green-500" />
            <div>
              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Total Network</p>
              <p className="text-sm font-black text-white italic">{customers.length} Clients</p>
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
            <input 
              type="text" 
              placeholder="Search name or phone..." 
              className="w-full bg-barber-black border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-barber-gold transition-all placeholder:text-zinc-700"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 className="animate-spin text-barber-gold" size={48} />
          <p className="text-barber-gray animate-pulse text-[10px] uppercase font-black tracking-[0.3em] text-center">Decrypting CRM Data...</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-24 bg-zinc-900/20 border-2 border-dashed border-zinc-800 rounded-[3rem]">
          <Sparkles size={48} className="mx-auto text-zinc-800 mb-4" />
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs italic">No customer records captured yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCustomers.map((customer) => (
            <div key={customer.id} className="bg-barber-black border border-zinc-800 rounded-3xl p-6 hover:border-barber-gold/50 transition-all group relative overflow-hidden shadow-xl">
              
              {/* Botões de Ação no Hover */}
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 z-10">
                 <button 
                  onClick={() => handleOpenEdit(customer)} 
                  className="p-2 bg-zinc-900 text-barber-gold rounded-xl hover:bg-barber-gold hover:text-black transition-all shadow-2xl"
                  title="Edit Records"
                 >
                    <Edit size={14} />
                 </button>
                 <button 
                  onClick={() => handleDelete(customer.id)} 
                  className="p-2 bg-zinc-900 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-2xl"
                  title="Delete Client"
                 >
                    <Trash2 size={14} />
                 </button>
              </div>

              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800 text-barber-gold font-black text-2xl italic shadow-inner">
                  {customer.name?.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-black text-white leading-tight truncate uppercase italic tracking-tighter">{customer.name || "Unknown Client"}</h3>
                  <a 
                    href={`https://wa.me/${customer.phone?.replace(/\D/g, '')}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[10px] text-barber-gold font-black flex items-center gap-1.5 hover:text-white transition-colors mt-1 uppercase tracking-widest"
                  >
                    <Phone size={10} /> {customer.phone} <ExternalLink size={10} />
                  </a>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/50 min-h-[80px]">
                   <p className="text-[9px] font-black text-barber-gold uppercase tracking-widest mb-2 flex items-center gap-1.5 italic">
                     <Sparkles size={10} /> AI Captured Preferences
                   </p>
                   <p className="text-xs text-zinc-400 italic line-clamp-3 leading-relaxed font-medium">
                     {customer.preferences || "The AI is still learning about this client's style..."}
                   </p>
                </div>

                <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/50 min-h-[80px]">
                   <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2 flex items-center gap-1.5 italic">
                     <FileText size={10} /> Professional Observations
                   </p>
                   <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed font-medium">
                     {customer.notes || "No manual observations recorded yet."}
                   </p>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-zinc-800/50 flex justify-between items-center text-[9px] text-zinc-600 font-black uppercase tracking-widest italic">
                <span className="flex items-center gap-1"><Calendar size={10} /> Last Interaction</span>
                <span>{customer.updatedAt ? format(new Date(customer.updatedAt), 'MMM dd, yyyy') : 'New Client'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE EDIÇÃO CRM */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={`Edit Profile: ${selectedCustomer?.name}`}
      >
        <form onSubmit={handleSave} className="flex flex-col gap-6">
           <div className="flex flex-col gap-2">
              <label className="text-[10px] text-barber-gray font-black uppercase tracking-widest italic">Professional Notes</label>
              <textarea 
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="Allergies, family info, or personal notes..."
                className="bg-barber-black border border-zinc-800 rounded-xl p-4 text-sm text-white focus:border-barber-gold outline-none h-32 resize-none transition-all font-medium"
              />
           </div>

           <div className="flex flex-col gap-2">
              <label className="text-[10px] text-barber-gray font-black uppercase tracking-widest italic">Style Preferences</label>
              <textarea 
                value={editPreferences}
                onChange={e => setEditPreferences(e.target.value)}
                placeholder="Favorite products, preferred styling, etc."
                className="bg-barber-black border border-zinc-800 rounded-xl p-4 text-sm text-white focus:border-barber-gold outline-none h-32 resize-none transition-all font-medium"
              />
           </div>

           <Button type="submit" loading={saving} className="h-16 font-black uppercase italic tracking-tighter text-lg shadow-2xl shadow-barber-gold/10">
              Update Client Records
           </Button>
        </form>
      </Modal>
    </AppLayout>
  );
}