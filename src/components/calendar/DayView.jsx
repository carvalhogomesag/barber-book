import React, { useState, useEffect, useRef } from 'react';
import { DndContext, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { 
  hoursArray, 
  getNewStartTime, 
  START_HOUR, 
  getNowPosition, 
  getPositionFromTime 
} from '../../utils/timeGrid'; 
import { AppointmentCard } from './AppointmentCard';
import { addDays, format, isSameDay, setHours, setMinutes } from 'date-fns';

export function DayView({ 
  appointments, 
  onAppointmentMove, 
  onAppointmentClick, 
  onTimeSlotClick, 
  onComplete, 
  onDelete,   
  startDate = new Date(), 
  businessHours,
  timezone = "America/New_York"
}) {
  const scrollContainerRef = useRef(null);
  const [numDays, setNumDays] = useState(1);
  const [nowPos, setNowPos] = useState(0);
  const [currentTimeStr, setCurrentTimeStr] = useState(""); 
  const [pxPerHour, setPxPerHour] = useState(90);
  const [containerHeight, setContainerHeight] = useState(0);

  // 1. Ajuste de Responsividade e Escala
  useEffect(() => {
    const updateLayout = () => {
      setNumDays(window.innerWidth >= 768 ? 3 : 1);
      if (scrollContainerRef.current) {
        const height = scrollContainerRef.current.offsetHeight;
        setContainerHeight(height);
        setPxPerHour(height / 10); 
      }
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  // 2. Lógica da "Agulha Fixa" + Relógio Digital + Auto-Scroll
  useEffect(() => {
    const updateNowAndScroll = () => {
      const now = new Date();
      
      const pos = getNowPosition(timezone, pxPerHour);
      setNowPos(pos);

      const timeStr = new Intl.DateTimeFormat('pt-BR', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(now);
      setCurrentTimeStr(timeStr);
      
      const todayInTimezone = new Date(now.toLocaleString("en-US", {timeZone: timezone}));
      const isViewingToday = isSameDay(startDate, todayInTimezone);
      
      if (isViewingToday && scrollContainerRef.current) {
        const targetScroll = pos - (containerHeight * 0.3);
        
        scrollContainerRef.current.scrollTo({
          top: targetScroll,
          behavior: 'smooth'
        });
      }
    };

    updateNowAndScroll();
    const interval = setInterval(updateNowAndScroll, 10000); 
    return () => clearInterval(interval);
  }, [pxPerHour, containerHeight, timezone, startDate]);

  const days = Array.from({ length: numDays }, (_, i) => addDays(startDate, i));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const handleDragEnd = (event) => {
    const { active, delta } = event;
    if (!delta.y) return;
    const appointment = active.data.current;
    const newStartTime = getNewStartTime(appointment.startTime, delta.y, pxPerHour);
    if (onAppointmentMove) onAppointmentMove(appointment.id, newStartTime);
  };

  const handleGridClick = (e, dayDate) => {
    if (e.target.closest('[data-appointment-card]')) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top + e.currentTarget.scrollTop; 
    const hoursPassed = offsetY / pxPerHour;
    const hour = Math.floor(hoursPassed) + START_HOUR;
    const minutes = Math.floor((hoursPassed % 1) * 60);
    const roundedMinutes = Math.round(minutes / 15) * 15;
    
    let clickedDate = setHours(dayDate, hour);
    clickedDate = setMinutes(clickedDate, roundedMinutes);
    clickedDate.setSeconds(0);
    clickedDate.setMilliseconds(0);
    if (onTimeSlotClick) onTimeSlotClick(clickedDate);
  };

  const getTop = (timeStr) => {
    if (!timeStr || timeStr === "none") return 0;
    return getPositionFromTime(`2000-01-01T${timeStr}:00`, pxPerHour);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="w-full bg-barber-black border border-zinc-800 rounded-xl overflow-hidden flex flex-col h-full shadow-2xl relative border-t-barber-gold/20">
        
        <div className="bg-zinc-900/95 backdrop-blur-xl border-b border-zinc-800 flex divide-x divide-zinc-800 z-30">
           <div className="w-16 flex-shrink-0 bg-zinc-900/50"></div>
           {days.map((day, index) => (
             <div key={index} className="flex-1 p-3 text-center">
               <span className="block text-[10px] text-zinc-500 uppercase font-black tracking-widest">{format(day, 'EEEE')}</span>
               <span className={`block font-black text-lg ${isSameDay(day, new Date()) ? 'text-barber-gold' : 'text-white'}`}>
                 {format(day, 'MMM dd')}
               </span>
             </div>
           ))}
        </div>

        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto relative custom-scrollbar select-none"
          style={{ scrollBehavior: 'smooth' }}
        >
          <div className="flex relative" style={{ height: hoursArray.length * pxPerHour }}>
            
            {/* Linha de Tempo (Agulha) */}
            <div 
              className="absolute left-0 w-full z-20 pointer-events-none flex items-center transition-all duration-1000 ease-linear"
              style={{ top: nowPos }}
            >
              <div className="w-16 flex justify-end pr-2">
                <div className="bg-barber-gold text-black text-[11px] font-extrabold px-2 py-0.5 rounded shadow-[0_0_15px_rgba(197,160,89,0.5)] flex items-center gap-1.5 min-w-[58px] justify-center">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-black"></span>
                  </span>
                  {currentTimeStr}
                </div>
              </div>
              <div className="flex-1 border-t-2 border-barber-gold shadow-[0_0_20px_rgba(197,160,89,0.4)]"></div>
            </div>

            {/* Coluna de Horas (Lateral) */}
            <div className="w-16 flex-shrink-0 bg-zinc-900/40 border-r border-zinc-800 relative z-10 pointer-events-none">
              {hoursArray.map((hour) => (
                <div 
                  key={hour} 
                  className="absolute w-full text-right pr-3 text-[10px] font-black text-zinc-600 -mt-2.5" 
                  style={{ top: (hour - START_HOUR) * pxPerHour }}
                >
                  {hour.toString().padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Colunas de Dias */}
            {days.map((day, colIndex) => {
              const dayAppointments = appointments.filter(apt => isSameDay(new Date(apt.startTime), day));

              return (
                <div 
                  key={colIndex} 
                  className="flex-1 relative border-r border-zinc-800/50 last:border-r-0 cursor-cell hover:bg-white/[0.02] transition-colors" 
                  onClick={(e) => handleGridClick(e, day)}
                >
                  {/* Faixas de Horário Comercial (Abertura/Fechamento) */}
                  {businessHours && (
                    <>
                      <div className="absolute w-full bg-black/50 z-0 pointer-events-none" style={{ top: 0, height: getTop(businessHours.open) }} />
                      <div className="absolute w-full bg-black/50 z-0 pointer-events-none" style={{ top: getTop(businessHours.close), bottom: 0 }} />
                      
                      {/* LÓGICA DO BREAK (PAUSA) */}
                      {businessHours.break && businessHours.break !== "none" && (
                        (() => {
                          const [bStart, bEnd] = businessHours.break.split('-');
                          const bTop = getTop(bStart);
                          const bBottom = getTop(bEnd);
                          return (
                            <div
                              className="absolute w-full bg-zinc-800/40 z-0 pointer-events-none flex items-center justify-center border-y border-zinc-700/20"
                              style={{ top: bTop, height: bBottom - bTop }}
                            >
                              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600 italic">Pause / Break</span>
                            </div>
                          );
                        })()
                      )}
                    </>
                  )}

                  {/* Linhas Horizontais do Grid */}
                  {hoursArray.map((hour) => (
                    <div 
                      key={hour} 
                      className="absolute w-full border-b border-zinc-800/40 pointer-events-none" 
                      style={{ top: (hour - START_HOUR) * pxPerHour, height: pxPerHour }} 
                    />
                  ))}

                  {/* Renderização dos Cards de Agendamento */}
                  {dayAppointments.map((apt) => (
                    <div key={apt.id} data-appointment-card>
                        <AppointmentCard 
                          appointment={apt} 
                          customPxPerHour={pxPerHour}
                          onComplete={onComplete} 
                          onDelete={onDelete}     
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (onAppointmentClick) onAppointmentClick(apt); 
                          }} 
                        />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="bg-barber-black p-2 text-center border-t border-zinc-800 z-30">
            <p className="text-[9px] text-barber-gold font-black uppercase tracking-[0.3em] animate-pulse">
              System Live • Polling Active (10s) • {timezone}
            </p>
        </div>
      </div>
    </DndContext>
  );
}