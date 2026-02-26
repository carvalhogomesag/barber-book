import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/ui/AppLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { 
  Users, 
  TrendingUp, 
  DollarSign, 
  QrCode, 
  Copy, 
  Check, 
  Download, 
  Globe,
  Clock,
  Zap,
  Wallet,
  ArrowUpRight,
  History
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { useAuth } from '../contexts/AuthContext';
import { 
  getSalespersonProfile, 
  getMyReferralClients, 
  calculateSalesStats,
  requestWithdrawal,
  getMyPayoutHistory 
} from '../services/salesService';

export function SalesDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [clients, setClients] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // ESTADOS DO MODAL DE SAQUE
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paymentInfo, setPaymentInfo] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  useEffect(() => {
    loadSalesData();
  }, [user]);

  const loadSalesData = async () => {
    if (!user) return;
    try {
      const salesProfile = await getSalespersonProfile(user.uid);
      if (salesProfile) {
        setProfile(salesProfile);
        const [myClients, myPayouts] = await Promise.all([
          getMyReferralClients(salesProfile.referralCode),
          getMyPayoutHistory(user.uid)
        ]);
        setClients(myClients);
        setPayouts(myPayouts);
        setStats(calculateSalesStats(myClients));
      }
    } catch (error) {
      console.error("Error loading sales dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawRequest = async (e) => {
    e.preventDefault();
    setWithdrawLoading(true);
    try {
      await requestWithdrawal(user.uid, parseFloat(withdrawAmount), paymentInfo);
      alert("Withdrawal request sent successfully!");
      setIsWithdrawModalOpen(false);
      setWithdrawAmount('');
      setPaymentInfo('');
      loadSalesData(); // Recarrega para atualizar o saldo
    } catch (error) {
      alert(error.message);
    } finally {
      setWithdrawLoading(false);
    }
  };

  const referralLink = `https://barber-book-d4a5a.web.app/register?ref=${profile?.referralCode}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <AppLayout><div className="p-8 text-barber-gold animate-pulse font-black uppercase italic">Loading Sales Console...</div></AppLayout>;

  return (
    <AppLayout>
      <header className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
              <div className="bg-barber-gold text-black p-1.5 rounded-lg">
                  <TrendingUp size={20} />
              </div>
              <h1 className="text-2xl font-black text-barber-white uppercase italic tracking-tighter">Sales Console</h1>
          </div>
          <p className="text-barber-gray font-bold uppercase tracking-widest text-[10px]">Welcome back, {profile?.name} • Code: <span className="text-barber-gold">{profile?.referralCode}</span></p>
        </div>

        {/* CARD DE SALDO DISPONÍVEL (WALLET) */}
        <div className="bg-barber-gold p-1 rounded-2xl shadow-xl shadow-barber-gold/10">
            <div className="bg-black rounded-xl px-6 py-3 flex items-center gap-6">
                <div>
                    <p className="text-[8px] font-black text-barber-gold uppercase tracking-widest">Available Balance</p>
                    <p className="text-2xl font-black text-white italic tracking-tighter">
                        ${profile?.currentBalance?.toFixed(2) || '0.00'}
                    </p>
                </div>
                <Button 
                    onClick={() => setIsWithdrawModalOpen(true)}
                    className="h-10 px-4 text-[10px] bg-barber-gold text-black hover:bg-yellow-600"
                >
                    <ArrowUpRight size={14} className="mr-1" /> WITHDRAW
                </Button>
            </div>
        </div>
      </header>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Users/>} label="Total Referrals" value={stats?.total} color="text-white" />
        <StatCard icon={<Clock/>} label="In Trial" value={stats?.trialing} color="text-barber-gold" />
        <StatCard icon={<Zap/>} label="Active Pro" value={stats?.activePro} color="text-green-500" />
        <StatCard icon={<DollarSign/>} label="Lifetime Earned" value={`$${profile?.totalEarnings?.toFixed(2) || '0.00'}`} color="text-blue-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUNA ESQUERDA: FERRAMENTAS E HISTÓRICO */}
        <div className="lg:col-span-1 space-y-6">
          {/* Ferramentas de Divulgação (Preservado) */}
          <div className="bg-barber-black border border-zinc-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-sm font-black text-white uppercase italic mb-6 flex items-center gap-2">
                <QrCode size={18} className="text-barber-gold" /> Referral Tools
            </h3>
            <div className="bg-white p-4 rounded-2xl mb-6 flex justify-center">
                <QRCodeCanvas id="sales-qr" value={referralLink} size={150} level={"H"} />
            </div>
            <div className="flex items-center gap-2 mb-4">
                <div className="bg-black border border-zinc-800 p-3 rounded-xl text-[9px] text-zinc-400 font-mono truncate flex-1">{referralLink}</div>
                <button onClick={copyToClipboard} className="p-3 bg-barber-gold text-black rounded-xl">{copied ? <Check size={16} /> : <Copy size={16} />}</button>
            </div>
          </div>

          {/* Histórico de Saques (Novo) */}
          <div className="bg-barber-black border border-zinc-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-sm font-black text-white uppercase italic mb-4 flex items-center gap-2">
                <History size={18} className="text-barber-gold" /> Recent Payouts
            </h3>
            <div className="space-y-3">
                {payouts.length === 0 ? (
                    <p className="text-[10px] text-zinc-600 italic">No payout history yet.</p>
                ) : (
                    payouts.slice(0, 5).map(p => (
                        <div key={p.id} className="flex justify-between items-center bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
                            <div>
                                <p className="text-xs font-bold text-white">${p.amount.toFixed(2)}</p>
                                <p className="text-[8px] text-zinc-500 uppercase">{new Date(p.requestedAt).toLocaleDateString()}</p>
                            </div>
                            <span className={`text-[8px] font-black uppercase px-2 py-1 rounded ${
                                p.status === 'paid' ? 'bg-green-500/10 text-green-500' : 'bg-barber-gold/10 text-barber-gold'
                            }`}>
                                {p.status}
                            </span>
                        </div>
                    ))
                )}
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: CRM DE CLIENTES (Preservado) */}
        <div className="lg:col-span-2">
          <div className="bg-barber-black border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-zinc-800 bg-zinc-900/30 flex justify-between items-center">
                <h3 className="text-sm font-black text-white uppercase italic">My Client Network (CRM)</h3>
                <span className="text-[10px] text-barber-gold font-black uppercase tracking-widest">20% Commission</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-900 text-barber-gray uppercase text-[10px] font-black tracking-widest">
                  <tr>
                    <th className="p-6">Client / Business</th>
                    <th className="p-6">Country</th>
                    <th className="p-6">Status</th>
                    <th className="p-6">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {clients.map(client => (
                    <tr key={client.id} className="hover:bg-zinc-900/50 transition-colors">
                      <td className="p-6">
                        <div className="font-bold text-white text-xs">{client.barberShopName || client.name}</div>
                        <div className="text-[9px] text-zinc-500">{client.email}</div>
                      </td>
                      <td className="p-6 font-bold text-zinc-400 text-xs">{client.country}</td>
                      <td className="p-6">
                        <span className={`text-[9px] font-black uppercase ${client.subscriptionStatus === 'trialing' ? 'text-barber-gold' : 'text-green-500'}`}>
                            {client.subscriptionStatus === 'trialing' ? 'Trial' : 'Active'}
                        </span>
                      </td>
                      <td className="p-6 text-zinc-500 text-[10px]">{new Date(client.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE SOLICITAÇÃO DE SAQUE */}
      <Modal isOpen={isWithdrawModalOpen} onClose={() => setIsWithdrawModalOpen(false)} title="Withdraw Funds">
        <form onSubmit={handleWithdrawRequest} className="flex flex-col gap-5">
            <div className="bg-barber-gold/10 p-4 rounded-2xl border border-barber-gold/20 mb-2">
                <p className="text-[10px] text-barber-gold font-black uppercase tracking-widest mb-1">Your Balance</p>
                <p className="text-2xl font-black text-white italic">${profile?.currentBalance?.toFixed(2) || '0.00'}</p>
            </div>

            <Input 
                label="AMOUNT TO WITHDRAW ($)" 
                type="number" 
                step="0.01"
                placeholder="0.00"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                required
            />

            <div className="space-y-1">
                <label className="text-sm text-barber-gray font-medium">Payment Method Details</label>
                <textarea 
                    className="w-full bg-barber-black border border-zinc-800 rounded-xl p-4 text-sm text-white focus:border-barber-gold outline-none min-h-[100px]"
                    placeholder="Enter your PayPal email or Bank Transfer info (IBAN/Swift)..."
                    value={paymentInfo}
                    onChange={e => setPaymentInfo(e.target.value)}
                    required
                />
            </div>

            <Button type="submit" loading={withdrawLoading} className="h-14 font-black uppercase italic tracking-tighter">
                Confirm Withdrawal Request
            </Button>
            <p className="text-[9px] text-zinc-600 text-center font-bold uppercase italic">
                Requests are processed within 3-5 business days.
            </p>
        </form>
      </Modal>
    </AppLayout>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="bg-barber-black border border-zinc-800 p-6 rounded-3xl shadow-lg">
      <div className={`${color} mb-3 opacity-80`}>{icon}</div>
      <div className="text-2xl font-black text-white tracking-tighter italic">{value || 0}</div>
      <div className="text-[9px] text-barber-gray uppercase font-black tracking-[0.2em] mt-1">{label}</div>
    </div>
  );
}