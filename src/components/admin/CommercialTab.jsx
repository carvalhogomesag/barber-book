import React, { useState } from 'react';
import { 
  Plus, 
  TrendingUp, 
  Pencil, 
  Trash2, 
  UserCheck, 
  UserX, 
  CheckCircle 
} from 'lucide-react';
import { Button } from '../ui/Button';
import { StatusBadge } from './StatusBadge';
import { 
  adminToggleSalespersonStatus, 
  adminDeleteSalesperson, 
  adminApprovePayout 
} from '../../services/adminService';

export function CommercialTab({ 
  salespeople, 
  payoutRequests, 
  onReload, 
  onEditSalesperson, 
  onOpenCreateSales,
  pendingPayoutsCount 
}) {
  const [subTab, setSubTab] = useState('partners'); // 'partners' | 'payouts'
  const [payoutProcessing, setPayoutProcessing] = useState(null);

  // --- HANDLERS INTERNOS ---

  const handleToggleStatus = async (person) => {
    const action = person.status === 'inactive' ? 'REINSTATE' : 'SUSPEND';
    if (!confirm(`Are you sure you want to ${action} ${person.name}?`)) return;

    try {
      await adminToggleSalespersonStatus(person.id, person.status || 'active');
      onReload();
    } catch (error) { alert("Error updating status."); }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`WARNING: Are you sure you want to delete ${name}?`)) return;
    try {
      await adminDeleteSalesperson(id);
      onReload();
    } catch (error) { alert("Error deleting salesperson."); }
  };

  const handleApprovePayout = async (payout) => {
    if (!confirm(`Confirm payment of $${payout.amount} to ${payout.salespersonName}?`)) return;
    
    setPayoutProcessing(payout.id);
    try {
      await adminApprovePayout(payout.id, payout.salespersonId, payout.amount);
      alert("Payout marked as paid!");
      onReload();
    } catch (error) { alert("Error processing payout."); }
    finally { setPayoutProcessing(null); }
  };

  return (
    <div className="space-y-6">
      {/* SUB-HEADER / CONTROLES */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800 w-full md:w-auto">
            <button 
                onClick={() => setSubTab('partners')}
                className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${subTab === 'partners' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
            >
                Partners List
            </button>
            <button 
                onClick={() => setSubTab('payouts')}
                className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-[10px] font-black uppercase transition-all ${subTab === 'payouts' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
            >
                Payout Requests 
                {pendingPayoutsCount > 0 && <span className="ml-1 bg-red-500 text-white px-1.5 rounded-full text-[8px]">{pendingPayoutsCount}</span>}
            </button>
        </div>
        
        {subTab === 'partners' && (
            <Button onClick={onOpenCreateSales} className="w-auto gap-2 px-6 h-10 text-xs">
                <Plus size={16} /> Add Salesperson
            </Button>
        )}
      </div>

      {/* CONTEÚDO DA TABELA */}
      <div className="bg-barber-black border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
        
        {/* TABELA DE PARCEIROS */}
        {subTab === 'partners' ? (
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-900 text-barber-gray uppercase text-[10px] font-black tracking-widest">
                        <tr>
                            <th className="p-6">Salesperson</th>
                            <th className="p-6">Referral Code</th>
                            <th className="p-6">Status</th>
                            <th className="p-6">Clients</th>
                            <th className="p-6">Balance</th>
                            <th className="p-6 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                        {salespeople.map(person => (
                            <tr key={person.id} className={`hover:bg-zinc-900/50 transition-colors group ${person.status === 'inactive' ? 'opacity-40' : ''}`}>
                                <td className="p-6">
                                    <div className="font-bold text-white group-hover:text-barber-gold transition-colors">{person.name}</div>
                                    <div className="text-xs text-zinc-500">{person.email}</div>
                                </td>
                                <td className="p-6">
                                    <span className="bg-zinc-800 px-3 py-1 rounded font-mono text-barber-gold font-bold">{person.referralCode}</span>
                                </td>
                                <td className="p-6">
                                    <StatusBadge status={person.status || 'active'} />
                                </td>
                                <td className="p-6 font-bold text-white">{person.activeClients || 0}</td>
                                <td className="p-6 font-bold text-barber-gold">${(person.currentBalance || 0).toFixed(2)}</td>
                                <td className="p-6 text-right space-x-2">
                                    <button 
                                        onClick={() => handleToggleStatus(person)} 
                                        className={`p-2 rounded-lg transition-colors ${person.status === 'inactive' ? 'text-red-500 hover:bg-red-500/10' : 'text-green-500 hover:bg-green-500/10'}`} 
                                        title="Toggle Status"
                                    >
                                        {person.status === 'inactive' ? <UserX size={18} /> : <UserCheck size={18} />}
                                    </button>
                                    <button onClick={() => onEditSalesperson(person)} className="p-2 text-zinc-500 hover:text-barber-gold transition-colors" title="Edit Partner">
                                        <Pencil size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(person.id, person.name)} className="p-2 text-zinc-500 hover:text-red-500 transition-colors" title="Delete Partner">
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {salespeople.length === 0 && (
                            <tr><td colSpan="6" className="p-10 text-center text-zinc-600 italic">No sales partners yet.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        ) : (
            /* TABELA DE SAQUES */
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-900 text-barber-gray uppercase text-[10px] font-black tracking-widest">
                        <tr>
                            <th className="p-6">Salesperson</th>
                            <th className="p-6">Amount</th>
                            <th className="p-6">Payment Info</th>
                            <th className="p-6">Status</th>
                            <th className="p-6 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                        {payoutRequests.length === 0 ? (
                            <tr><td colSpan="5" className="p-10 text-center text-zinc-600 italic">No payout requests found.</td></tr>
                        ) : (
                            payoutRequests.map(payout => (
                                <tr key={payout.id} className="hover:bg-zinc-900/50 transition-colors">
                                    <td className="p-6 font-bold text-white">{payout.salespersonName}</td>
                                    <td className="p-6 font-black text-barber-gold">${payout.amount.toFixed(2)}</td>
                                    <td className="p-6">
                                        <div className="max-w-[200px] truncate text-xs text-zinc-400 italic" title={payout.paymentInfo}>
                                            {payout.paymentInfo}
                                        </div>
                                    </td>
                                    <td className="p-6">
                                        <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${payout.status === 'paid' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500 animate-pulse'}`}>
                                            {payout.status}
                                        </span>
                                    </td>
                                    <td className="p-6 text-right">
                                        {payout.status === 'pending' && (
                                            <button 
                                                onClick={() => handleApprovePayout(payout)}
                                                disabled={payoutProcessing === payout.id}
                                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 ml-auto"
                                            >
                                                <CheckCircle size={12} /> {payoutProcessing === payout.id ? '...' : 'Mark as Paid'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        )}
      </div>
    </div>
  );
}