import React from 'react';
import { Search, UserCheck, UserX, Zap, Trash2 } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { adminToggleTenantStatus, adminUpdateTenant, adminDeleteTenant } from '../../services/adminService';

export function UsersTab({ tenants, searchTerm, setSearchTerm, onReload }) {
  
  // Handlers internos para manter o código limpo
  const handleToggleStatus = async (tenant) => {
    const action = tenant.status === 'inactive' ? 'ACTIVATE' : 'DEACTIVATE';
    if (!confirm(`Are you sure you want to ${action} access for ${tenant.name}?`)) return;
    
    try {
      await adminToggleTenantStatus(tenant.id, tenant.status || 'active');
      onReload(); // Recarrega a lista pai
    } catch (error) { alert("Error updating status."); }
  };

  const handleTogglePlan = async (tenant) => {
    const newPlan = tenant.plan === 'pro' ? 'free' : 'pro';
    if (confirm(`Change plan for ${tenant.name} to ${newPlan.toUpperCase()}?`)) {
      await adminUpdateTenant(tenant.id, { plan: newPlan });
      onReload();
    }
  };

  const handleDelete = async (id) => {
    if (confirm("WARNING: This will permanently delete the user and their data. Continue?")) {
      await adminDeleteTenant(id);
      onReload();
    }
  };

  // Filtragem local
  const filteredTenants = tenants.filter(t => 
    t.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-barber-black border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
      {/* BARRA DE BUSCA */}
      <div className="p-6 border-b border-zinc-800 flex items-center gap-4 bg-zinc-900/30">
        <Search className="text-zinc-500" size={20} />
        <input 
          type="text" 
          placeholder="Search professionals by name or email..." 
          className="bg-transparent border-none outline-none text-white w-full text-sm font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* TABELA */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900 text-barber-gray uppercase text-[10px] font-black tracking-widest">
            <tr>
              <th className="p-6">Professional</th>
              <th className="p-6">Country</th>
              <th className="p-6">Plan</th>
              <th className="p-6">Status</th>
              <th className="p-6">Referred By</th>
              <th className="p-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filteredTenants.map(tenant => (
              <tr key={tenant.id} className={`hover:bg-zinc-900/50 transition-colors ${tenant.status === 'inactive' ? 'opacity-40' : ''}`}>
                <td className="p-6">
                  <div className="font-bold text-white">{tenant.name}</div>
                  <div className="text-xs text-zinc-500">{tenant.email}</div>
                </td>
                <td className="p-6 font-bold text-zinc-400">{tenant.country}</td>
                <td className="p-6">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${tenant.plan === 'pro' ? 'bg-barber-gold/20 text-barber-gold' : 'bg-zinc-800 text-zinc-500'}`}>
                    {tenant.plan}
                  </span>
                </td>
                <td className="p-6">
                  <StatusBadge status={tenant.status || 'active'} />
                </td>
                <td className="p-6 font-mono text-xs text-barber-gold">{tenant.referredBy || '---'}</td>
                <td className="p-6 text-right space-x-2">
                  <button 
                    onClick={() => handleToggleStatus(tenant)} 
                    className={`p-2 rounded-lg transition-colors ${tenant.status === 'inactive' ? 'text-red-500 hover:bg-red-500/10' : 'text-green-500 hover:bg-green-500/10'}`} 
                    title="Toggle Access"
                  >
                    {tenant.status === 'inactive' ? <UserX size={18} /> : <UserCheck size={18} />}
                  </button>
                  <button onClick={() => handleTogglePlan(tenant)} className="p-2 text-zinc-500 hover:text-barber-gold" title="Toggle Plan">
                    <Zap size={18} />
                  </button>
                  <button onClick={() => handleDelete(tenant.id)} className="p-2 text-zinc-500 hover:text-red-500" title="Delete">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredTenants.length === 0 && (
              <tr>
                <td colSpan="6" className="p-10 text-center text-zinc-600 italic">No professionals found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}