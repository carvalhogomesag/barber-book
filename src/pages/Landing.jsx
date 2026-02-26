import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Sparkles, 
  CheckCircle, 
  MessageSquare, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  Zap,
  UserCheck,
  ArrowRight
} from 'lucide-react';
import { Button } from '../components/ui/Button';

export function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-barber-dark text-barber-white font-sans">
      
      {/* --- NAVBAR --- */}
      <nav className="border-b border-zinc-800 bg-barber-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="text-barber-gold" size={24} />
            <span className="text-xl font-black tracking-tighter uppercase italic">Schedy</span>
          </div>
          <Link to="/login">
            <button className="text-sm font-bold text-barber-gray hover:text-barber-white transition-colors">
              Log In
            </button>
          </Link>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <section className="pt-20 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[0.9] mb-6 uppercase">
            STOP LOSING CLIENTS WHILE <br />
            <span className="text-barber-gold">YOU WORK.</span>
          </h1>
          <p className="text-xl md:text-2xl text-barber-gray mb-10 max-w-2xl mx-auto leading-relaxed">
            Never miss a booking again while you’re focused on a client. Our AI answers your WhatsApp and fills your schedule automatically.
          </p>
          <div className="flex flex-col items-center gap-4">
            <Button 
              onClick={() => navigate('/register')} 
              className="w-full md:w-80 h-16 text-xl shadow-2xl shadow-barber-red/20 uppercase tracking-widest italic font-black"
            >
              Start My 30-Day Free Trial
            </Button>
            <p className="text-xs text-zinc-500 flex items-center gap-2 font-bold uppercase tracking-widest italic">
              <CheckCircle size={14} className="text-green-500" /> Setup takes 2 minutes. No hidden fees.
            </p>
          </div>
        </div>
      </section>

      {/* --- PROBLEM SECTION --- */}
      <section className="py-20 bg-barber-black">
        <div className="max-w-5xl mx-auto px-4">
          <div className="mb-12">
            <h2 className="text-3xl font-black uppercase tracking-tighter mb-2 italic">The "Invisible" Cost of <br/> Being a Service Professional</h2>
            <div className="w-20 h-1 bg-barber-red"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ProblemCard 
              icon={<Clock className="text-barber-red" />}
              title="The 2-Hour Delay"
              desc="You reply when you finish a session, but the client already booked with someone else who answered faster."
            />
            <ProblemCard 
              icon={<UserCheck className="text-barber-red" />}
              title="The Interrupted Flow"
              desc="Checking your phone every 10 minutes ruins your focus and makes the client in front of you feel ignored."
            />
            <ProblemCard 
              icon={<AlertTriangle className="text-barber-red" />}
              title="The Overbooking Headache"
              desc="Forgetting to write a booking down and having two people show up at the same time is a nightmare."
            />
            <ProblemCard 
              icon={<Zap className="text-barber-red" />}
              title="The After-Hours Shift"
              desc="Spending your personal night replying to 'Are you free tomorrow?' instead of resting for the next day."
            />
          </div>
        </div>
      </section>

      {/* --- SOLUTION SECTION --- */}
      <section className="py-24 px-4 bg-zinc-900/30">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-black mb-6 uppercase">You Focus on Your Clients. <br/> <span className="text-barber-gold">We Handle the Rest.</span></h2>
          <p className="text-lg text-barber-gray leading-relaxed">
            While you are giving your best to the person in front of you, Schedy acts as your personal front desk. 
            It talks to your clients on WhatsApp, checks your real-time availability, and secures the booking. 
            <span className="text-white font-bold"> You don't have to lift a finger—you just show up and provide your service.</span>
          </p>
        </div>
      </section>

      {/* --- HOW IT WORKS --- */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <h3 className="text-center text-sm font-black tracking-[0.3em] text-barber-gold uppercase mb-16 italic">How it works</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <Step num="1" title="Client Texts WhatsApp" desc="Your client sends a message to your dedicated number asking for an appointment." />
            <Step num="2" title="AI Books the Slot" desc="The system shows availability, collects info, and confirms in seconds." />
            <Step num="3" title="Check Your Calendar" desc="The appointment appears automatically on your Schedy dashboard." />
          </div>
        </div>
      </section>

      {/* --- QUALIFICATION --- */}
      <section className="py-24 px-4 bg-barber-black border-y border-zinc-800">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16">
          <div>
            <h4 className="text-xl font-black uppercase mb-6 flex items-center gap-2 italic">
              <CheckCircle size={20} className="text-green-500" /> This is for you if:
            </h4>
            <ul className="space-y-4 text-barber-gray">
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-barber-gold mt-2 shrink-0"></div>
                <span className="font-medium text-sm uppercase tracking-tight">You are a solo professional or small business owner.</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-barber-gold mt-2 shrink-0"></div>
                <span className="font-medium text-sm uppercase tracking-tight">You don't have a receptionist to answer your phone.</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-barber-gold mt-2 shrink-0"></div>
                <span className="font-medium text-sm uppercase tracking-tight">You want a premium, automated booking experience for your clients.</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xl font-black uppercase mb-6 flex items-center gap-2 text-zinc-500 italic">
              <AlertTriangle size={20} /> This is NOT for you if:
            </h4>
            <ul className="space-y-4 text-zinc-600">
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 mt-2 shrink-0"></div>
                <span className="font-medium text-sm uppercase tracking-tight">You already have a full-time receptionist.</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 mt-2 shrink-0"></div>
                <span className="font-medium text-sm uppercase tracking-tight">You prefer spending hours manually texting clients back and forth.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* --- FINAL CTA --- */}
      <section className="py-32 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-black mb-4 uppercase leading-none italic tracking-tighter">Take back your focus. <br/> <span className="text-barber-red">Fill your schedule.</span></h2>
          <p className="text-barber-gray mb-10 text-lg font-medium italic">Stop letting unanswered messages turn into lost revenue.</p>
          <Button 
            onClick={() => navigate('/register')} 
            className="w-full md:w-80 h-16 text-xl uppercase tracking-widest font-black italic shadow-2xl shadow-barber-red/20"
          >
            Start My Free Trial Now
          </Button>
          <p className="mt-6 text-zinc-500 text-sm font-bold uppercase tracking-widest">Free for 30 days. Cancel anytime with one click.</p>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-12 border-t border-zinc-900 bg-barber-black/20 text-center">
        <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest italic">
          © 2026 Schedy AI • All rights reserved • Built for the modern professional.
        </p>
      </footer>
    </div>
  );
}

function ProblemCard({ icon, title, desc }) {
  return (
    <div className="bg-zinc-900/50 p-6 rounded-2xl border border-zinc-800/50 hover:border-barber-red/30 transition-all group">
      <div className="mb-4 p-3 bg-barber-red/10 w-fit rounded-xl group-hover:scale-110 transition-transform italic">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-barber-white mb-2 uppercase tracking-tighter italic">{title}</h3>
      <p className="text-sm text-barber-gray leading-relaxed font-medium italic">{desc}</p>
    </div>
  );
}

function Step({ num, title, desc }) {
  return (
    <div className="text-center group">
      <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 text-barber-gold rounded-full flex items-center justify-center mx-auto mb-6 text-xl font-black group-hover:bg-barber-gold group-hover:text-black transition-all italic">
        {num}
      </div>
      <h4 className="text-lg font-black uppercase mb-3 italic tracking-tighter">{title}</h4>
      <p className="text-sm text-barber-gray leading-relaxed font-medium italic">{desc}</p>
    </div>
  );
}