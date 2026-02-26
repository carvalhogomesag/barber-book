import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

export function BlockModal({ isOpen, onClose, onSave, initialDate, loading }) {
  const [blockTime, setBlockTime] = useState('09:00');
  const [blockDuration, setBlockDuration] = useState(60);
  const [blockRecurrence, setBlockRecurrence] = useState('none');
  const [blockOccurrences, setBlockOccurrences] = useState(1);
  const [blockNotes, setBlockNotes] = useState('');
  const [formDate, setFormDate] = useState(new Date());

  useEffect(() => {
    if (isOpen) {
      setBlockTime(format(initialDate, 'HH:mm'));
      setFormDate(initialDate);
      setBlockDuration(60);
      setBlockRecurrence('none');
      setBlockOccurrences(1);
      setBlockNotes('');
    }
  }, [isOpen, initialDate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      blockTime,
      blockDuration,
      blockRecurrence,
      blockOccurrences,
      blockNotes,
      formDate
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Block Schedule">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 md:gap-5">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-barber-gray font-black uppercase tracking-widest italic">Blocking Date</label>
          <input 
            type="date" 
            value={format(formDate, 'yyyy-MM-dd')}
            onChange={(e) => {
              const [year, month, day] = e.target.value.split('-').map(Number);
              setFormDate(new Date(year, month - 1, day));
            }}
            className="bg-barber-black border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-barber-gold transition-colors"
            required 
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="START TIME" type="time" value={blockTime} onChange={e => setBlockTime(e.target.value)} required />
          <div className="w-full">
            <label className="text-[10px] text-barber-gray font-black uppercase mb-1 block tracking-widest italic">Duration</label>
            <select 
              className="w-full bg-barber-black border border-zinc-800 rounded-lg p-3 text-sm text-white focus:border-barber-gold outline-none"
              value={blockDuration}
              onChange={e => setBlockDuration(e.target.value)}
            >
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="60">1 hour</option>
              <option value="120">2 hours</option>
              <option value="240">4 hours</option>
              <option value="480">Full Day</option>
            </select>
          </div>
        </div>

        <div className="bg-zinc-900/30 p-4 rounded-2xl border border-zinc-800 space-y-3">
          <div className="flex items-center gap-2 text-barber-gold mb-1">
            <RefreshCw size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest italic">Recurrence</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="w-full">
              <label className="text-[9px] text-zinc-500 font-bold uppercase mb-1 block">Repeat</label>
              <select 
                className="w-full bg-black border border-zinc-800 rounded-lg p-2 text-[10px] text-white outline-none"
                value={blockRecurrence}
                onChange={e => setBlockRecurrence(e.target.value)}
              >
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {blockRecurrence !== 'none' && (
              <Input 
                label="TIMES" 
                type="number" 
                min="1" 
                max="52"
                value={blockOccurrences} 
                onChange={e => setBlockOccurrences(e.target.value)} 
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-barber-gray font-black uppercase mb-1 tracking-widest italic">Reason</label>
          <textarea 
            value={blockNotes}
            onChange={e => setBlockNotes(e.target.value)}
            placeholder="Internal note..."
            className="bg-barber-black border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-barber-gold transition-colors min-h-[60px] resize-none"
          />
        </div>

        <Button type="submit" loading={loading} className="h-12 md:h-14 text-base md:text-lg font-black uppercase tracking-tighter italic">
          CONFIRM BLOCK
        </Button>
      </form>
    </Modal>
  );
}