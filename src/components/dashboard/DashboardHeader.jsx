import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '../ui/Button';

export function DashboardHeader({ 
  timezone, 
  selectedDate, 
  onPrevDay, 
  onNextDay, 
  onToday, 
  onOpenBlock, 
  onOpenBooking 
}) {
  return (
    <header className="flex flex-col gap-4 mb-4 md:mb-6">
      <div className="hidden sm:flex items-center gap-3">
        <div className="w-10 h-10 md:w-12 md:h-12 bg-barber-gold/10 rounded-xl flex items-center justify-center text-barber-gold border border-barber-gold/20">
          <CalendarIcon size={20} />
        </div>
        <div>
          <h1 className="text-lg md:text-2xl font-black text-barber-white uppercase tracking-tighter italic leading-none">Schedule</h1>
          <p className="text-[9px] md:text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em] mt-1">
            {timezone.split('/')[1]?.replace('_', ' ') || timezone}
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex items-center justify-between bg-barber-black border border-zinc-800 p-1 rounded-xl shadow-inner flex-1 max-w-full lg:max-w-md">
          <button onClick={onPrevDay} className="p-2 md:p-2.5 hover:bg-zinc-800 rounded-lg text-barber-gray hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button onClick={onToday} className="px-2 text-[10px] md:text-xs font-black text-barber-white hover:text-barber-gold uppercase tracking-widest italic text-center">
            {format(selectedDate, "MMM dd, yyyy")}
          </button>
          <button onClick={onNextDay} className="p-2 md:p-2.5 hover:bg-zinc-800 rounded-lg text-barber-gray hover:text-white transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
        
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <button 
            onClick={onOpenBlock}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 h-[44px] md:h-[48px] bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-xl border border-zinc-700 transition-all font-bold uppercase text-[10px] italic"
          >
            <Lock size={14} /> Block
          </button>

          <Button 
            onClick={onOpenBooking} 
            className="flex-[2] lg:flex-none px-4 md:px-6 h-[44px] md:h-[48px] bg-barber-gold text-black hover:bg-yellow-600 shadow-xl shadow-barber-gold/20 text-[10px] md:text-xs"
          >
             <span className="font-black uppercase tracking-tighter italic">+ NEW BOOKING</span>
          </Button>
        </div>
      </div>
    </header>
  );
}