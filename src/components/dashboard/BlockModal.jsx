import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { RefreshCw, Clock, Calendar as CalIcon, ShieldAlert } from 'lucide-react';
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

  // Rodapé Fixo do Modal
  const modalFooter = (
    <div className="flex items-center justify-end w-full">
      <Button 
        onClick={handleSubmit} 
        loading={loading} 
        className="max-w-[280px] h-14 shadow-vivid"
      >
        CONFIRM BLOCK
      </Button>
    </div>
  );

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Block Schedule"
      footer={modalFooter}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        
        {/* COLUNA ESQUERDA: TEMPO E DURAÇÃO */}
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] text-schedy-gray font-black uppercase tracking-widest flex items-center gap-2 ml-1">
              <CalIcon size={12} /> Blocking Date
            </label>
            <input 
              type="date" 
              value={format(formDate, 'yyyy-MM-dd')}
              onChange={(e) => {
                const [year, month, day] = e.target.value.split('-').map(Number);
                setFormDate(new Date(year, month - 1, day));
              }}
              className="w-full bg-schedy-canvas border-2 border-schedy-border rounded-2xl p-4 text-schedy-black font-bold text-sm outline-none focus:border-schedy-black transition-all"
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Start Time" 
              type="time" 
              value={blockTime} 
              onChange={e => setBlockTime(e.target.value)} 
              required 
            />
            <div className="space-y-2">
              <label className="text-[10px] text-schedy-gray font-black uppercase tracking-widest flex items-center gap-2 ml-1">
                <Clock size={12} /> Duration
              </label>
              <select 
                className="w-full bg-schedy-canvas border-2 border-schedy-border rounded-2xl p-4 text-sm font-bold text-schedy-black outline-none focus:border-schedy-black transition-all appearance-none"
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
        </div>

        {/* COLUNA DIREITA: RECORRÊNCIA E MOTIVO */}
        <div className="space-y-6">
          <div className="bg-schedy-canvas/50 p-6 rounded-[24px] border border-schedy-border/50 space-y-4">
            <div className="flex items-center gap-2 text-schedy-black">
              <RefreshCw size={14} className="animate-spin-slow" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] italic">Recurrence Rules</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] text-schedy-gray font-black uppercase tracking-widest ml-1">Repeat</label>
                <select 
                  className="w-full bg-white border border-schedy-border rounded-xl p-2.5 text-[11px] font-bold text-schedy-black outline-none focus:border-schedy-black transition-all"
                  value={blockRecurrence}
                  onChange={e => setBlockRecurrence(e.target.value)}
                >
                  <option value="none">None (Single Event)</option>
                  <option value="daily">Every Day</option>
                  <option value="weekly">Every Week</option>
                  <option value="monthly">Every Month</option>
                </select>
              </div>

              {blockRecurrence !== 'none' && (
                <Input 
                  label="Occurrences" 
                  type="number" 
                  min="1" 
                  max="52"
                  value={blockOccurrences} 
                  onChange={e => setBlockOccurrences(e.target.value)} 
                />
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] text-schedy-gray font-black uppercase tracking-widest flex items-center gap-2 ml-1">
              <ShieldAlert size={12} /> Reason / Internal Note
            </label>
            <textarea 
              value={blockNotes}
              onChange={e => setBlockNotes(e.target.value)}
              placeholder="Ex: Lunch break, doctor appointment, vacation..."
              className="w-full bg-schedy-canvas border-2 border-schedy-border rounded-2xl p-4 text-sm font-bold text-schedy-black outline-none focus:border-schedy-black transition-all min-h-[100px] resize-none placeholder:text-schedy-gray/30"
            />
          </div>
        </div>

      </div>
    </Modal>
  );
}