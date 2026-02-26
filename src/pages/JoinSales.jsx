import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { 
  TrendingUp, 
  DollarSign, 
  Zap, 
  Users, 
  ShieldCheck, 
  ArrowRight,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

export function JoinSales() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-barber-dark text-barber-white font-sans selection:bg-barber-gold selection:text-black">
      
      {/* HEADER SIMPLES */}
      <nav className="p-6 flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
            <Sparkles className="text-barber-gold" size={24} />
            <span className="text-2xl font-black uppercase italic tracking-tighter">SCHEDY <span className="text-barber-gold">PARTNERS</span></span>
        </div>
        <Button 
          variant="outline" 
          className="w-auto px-6 h-10 text-xs border-zinc-800 text-zinc-400"
          onClick={() => navigate('/login')}
        >
          Login
        </Button>
      </nav>

      {/* HERO SECTION */}
      <section className="px-6 pt-16 pb-24 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-barber-gold/10 border border-barber-gold/20 px-4 py-1.5 rounded-full mb-8">
            <TrendingUp size={14} className="text-barber-gold" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-barber-gold">Recurring Revenue Program</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter leading-[0.9] mb-8">
          Turn AI into your <span className="text-barber-gold">Monthly Income.</span>
        </h1>
        
        <p className="text-zinc-500 text-lg md:text-xl font-medium italic max-w-2xl mx-auto mb-12">
          Promote the world's most advanced AI Concierge for barbers and earn <span className="text-white font-bold">20% recurring commission</span> on every subscription.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
                onClick={() => navigate('/register?role=sales')}
                className="h-16 px-10 text-xl font-black uppercase italic tracking-tighter shadow-2xl shadow-barber-gold/20"
            >
                Become a Partner Now <ArrowRight size={20} className="ml-2" />
            </Button>
        </div>
      </section>

      {/* FEATURES / BENEFITS */}
      <section className="bg-zinc-900/30 border-y border-zinc-800 py-24 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
            <BenefitCard 
                icon={<DollarSign size={32} />}
                title="20% Lifetime"
                description="As long as the barber stays subscribed, you keep earning. No limits, no expiration."
            />
            <BenefitCard 
                icon={<Zap size={32} />}
                title="Instant Setup"
                description="Get your unique link and QR code immediately after registration. Start selling today."
            />
            <BenefitCard 
                icon={<ShieldCheck size={32} />}
                title="Global Product"
                description="Sell to barbers in the US, Brazil, Portugal, and beyond. AI knows no borders."
            />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 px-6 max-w-5xl mx-auto">
        <h2 className="text-3xl font-black uppercase italic tracking-tighter text-center mb-16">How it <span className="text-barber-gold">Works</span></h2>
        
        <div className="space-y-8">
            <Step number="01" title="Join the Program" text="Register as a sales partner in 30 seconds. No upfront costs." />
            <Step number="02" title="Share your Magic Link" text="Use your dedicated dashboard to download your QR Code or copy your referral link." />
            <Step number="03" title="Track & Earn" text="Watch your client network grow in real-time. We handle the technology, you handle the growth." />
        </div>

        <div className="mt-20 bg-barber-gold p-10 rounded-[3rem] text-black text-center relative overflow-hidden">
            <div className="relative z-10">
                <h3 className="text-4xl font-black uppercase italic tracking-tighter mb-4">Ready to scale?</h3>
                <p className="font-bold uppercase tracking-tight mb-8 opacity-80">Join the elite team of Schedy AI Partners.</p>
                <button 
                    onClick={() => navigate('/register?role=sales')}
                    className="bg-black text-white px-12 h-16 rounded-2xl font-black uppercase italic tracking-tighter hover:scale-105 transition-transform"
                >
                    Create My Partner Account
                </button>
            </div>
            <Sparkles size={120} className="absolute -bottom-10 -right-10 opacity-10 rotate-12" />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-12 border-t border-zinc-900 text-center">
        <p className="text-[10px] text-zinc-700 font-black uppercase tracking-[0.4em]">Schedy AI • Global Partner Division</p>
      </footer>
    </div>
  );
}

function BenefitCard({ icon, title, description }) {
    return (
        <div className="text-center md:text-left space-y-4">
            <div className="text-barber-gold inline-block p-3 bg-barber-gold/10 rounded-2xl border border-barber-gold/20">
                {icon}
            </div>
            <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">{title}</h3>
            <p className="text-zinc-500 text-sm leading-relaxed font-medium italic">{description}</p>
        </div>
    );
}

function Step({ number, title, text }) {
    return (
        <div className="flex items-start gap-6 group">
            <span className="text-4xl font-black text-zinc-800 group-hover:text-barber-gold transition-colors italic leading-none">{number}</span>
            <div>
                <h4 className="text-lg font-black uppercase italic tracking-tighter text-white mb-1">{title}</h4>
                <p className="text-zinc-500 text-sm font-medium italic">{text}</p>
            </div>
        </div>
    );
}