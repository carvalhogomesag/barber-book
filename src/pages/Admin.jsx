import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { 
  Users, 
  Briefcase, 
  Bot, 
  Sparkles
} from 'lucide-react';
import { db } from '../services/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  getAllTenants, 
  getAllSalespeople, 
  getAllPayoutRequests
} from '../services/adminService';

// IMPORTAÇÃO DOS NOVOS COMPONENTES
import { AdminStats } from '../components/admin/AdminStats';
import { UsersTab } from '../components/admin/UsersTab';
import { CommercialTab } from '../components/admin/CommercialTab';
import { AiTrainingTab } from '../components/admin/AiTrainingTab';
import { SalespersonModal } from '../components/admin/SalespersonModal';

export function Admin() {
  // --- ESTADOS GERAIS ---
  const [activeTab, setActiveTab] = useState('users'); 
  const [loading, setLoading] = useState(true);
  
  // --- DADOS ---
  const [tenants, setTenants] = useState([]); 
  const [salespeople, setSalespeople] = useState([]);
  const [payoutRequests, setPayoutRequests] = useState([]);

  // --- ESTADOS DE FILTRO E MODAL ---
  const [searchTerm, setSearchTerm] = useState(''); // Busca de usuários
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(false);
  const [editingSalesperson, setEditingSalesperson] = useState(null);

  // --- ESTADOS DA IA ---
  const [aiConfig, setAiConfig] = useState({ additionalContext: '' });
  const [aiSaving, setAiSaving] = useState(false);

  // --- CARREGAMENTO INICIAL ---
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [tenantsData, salesData, payoutsData] = await Promise.all([
        getAllTenants(),
        getAllSalespeople(),
        getAllPayoutRequests()
      ]);
      setTenants(tenantsData);
      setSalespeople(salesData);
      setPayoutRequests(payoutsData);
      await loadAIConfig();
    } catch (error) {
      console.error("Error loading admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAIConfig = async () => {
    try {
      const docRef = doc(db, 'settings', 'ai_config');
      const snap = await getDoc(docRef);
      if (snap.exists()) setAiConfig({ additionalContext: snap.data().additionalContext || '' });
    } catch (error) { console.error(error); }
  };

  // --- HANDLERS ESPECÍFICOS ---

  // Salvar Treinamento da IA
  const handleSaveAIConfig = async () => {
    setAiSaving(true);
    try {
      const docRef = doc(db, 'settings', 'ai_config');
      await updateDoc(docRef, { additionalContext: aiConfig.additionalContext, updatedAt: new Date().toISOString() });
      alert("AI Training saved!");
    } catch (error) { alert("Failed to save."); }
    finally { setAiSaving(false); }
  };

  // Abrir Modal de Criação
  const handleOpenCreateSales = () => {
    setEditingSalesperson(null);
    setIsSalesModalOpen(true);
  };

  // Abrir Modal de Edição
  const handleOpenEditSales = (person) => {
    setEditingSalesperson(person);
    setIsSalesModalOpen(true);
  };

  // Cálculo de Estatísticas para os Cards
  const stats = {
    total: tenants.length,
    pro: tenants.filter(t => t.plan === 'pro').length,
    salesCount: salespeople.length,
    pendingPayouts: payoutRequests.filter(p => p.status === 'pending').length
  };

  return (
    <AppLayout>
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-barber-white uppercase italic tracking-tighter flex items-center gap-2">
            <Sparkles className="text-barber-gold" size={24} />
            Schedy Management
          </h1>
          <p className="text-barber-gray text-sm font-bold uppercase tracking-widest opacity-70">Owner Control Panel</p>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
          <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users size={16}/>} label="Users" />
          <TabButton active={activeTab === 'commercial'} onClick={() => setActiveTab('commercial')} icon={<Briefcase size={16}/>} label="Commercial" />
          <TabButton active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} icon={<Bot size={16}/>} label="AI Training" />
        </div>
      </header>

      {/* CARDS DE ESTATÍSTICA (GLOBAL) */}
      <AdminStats stats={stats} />

      {/* CONTEÚDO DAS ABAS */}
      {loading ? (
        <div className="p-10 text-center animate-pulse text-zinc-500 font-bold uppercase tracking-widest">Loading Dashboard...</div>
      ) : (
        <>
          {activeTab === 'users' && (
            <UsersTab 
              tenants={tenants} 
              searchTerm={searchTerm} 
              setSearchTerm={setSearchTerm} 
              onReload={loadInitialData} 
            />
          )}

          {activeTab === 'commercial' && (
            <CommercialTab 
              salespeople={salespeople} 
              payoutRequests={payoutRequests} 
              onReload={loadInitialData}
              onEditSalesperson={handleOpenEditSales}
              onOpenCreateSales={handleOpenCreateSales}
              pendingPayoutsCount={stats.pendingPayouts}
            />
          )}

          {activeTab === 'ai' && (
            <AiTrainingTab 
              aiConfig={aiConfig} 
              setAiConfig={setAiConfig} 
              onSave={handleSaveAIConfig} 
              saving={aiSaving} 
            />
          )}
        </>
      )}

      {/* MODAL DE VENDEDOR (COMPARTILHADO) */}
      <SalespersonModal 
        isOpen={isSalesModalOpen} 
        onClose={() => setIsSalesModalOpen(false)} 
        editingSalesperson={editingSalesperson}
        onSuccess={loadInitialData}
      />
    </AppLayout>
  );
}

// Botão de Aba Auxiliar (Pequeno demais para extrair)
function TabButton({ active, onClick, icon, label }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
        active ? 'bg-barber-gold text-black shadow-lg' : 'text-zinc-500 hover:text-white'
      }`}
    >
      {icon} {label}
    </button>
  );
}