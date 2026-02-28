import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AlertCircle, Lock, Phone } from 'lucide-react'; 
import { 
  getPositionFromTime, 
  getHeightFromDuration, 
  getNewStartTime,    
  formatTimeDisplay,
  PIXELS_PER_HOUR
} from '../../utils/timeGrid';

export function AppointmentCard({ appointment, onClick }) {
  
  // Cálculo de posição e altura baseados no novo grid de 100px/hora
  const top = getPositionFromTime(appointment.startTime, PIXELS_PER_HOUR);
  const height = getHeightFromDuration(appointment.duration, PIXELS_PER_HOUR);
  
  const isCompleted = appointment.status === 'completed';
  const isBlocked = appointment.type === 'block'; 
  const hasNotes = appointment.notes && appointment.notes.trim().length > 0;
  
  // Cor dinâmica vinda do Firestore (campo color do serviço)
  const serviceColor = appointment.color || 'emerald';

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: appointment.id,
    data: appointment,
    disabled: isCompleted 
  });

  // Feedback visual de tempo durante o arraste
  let displayTime = formatTimeDisplay(appointment.startTime);
  if (isDragging && transform) {
    const projectedTimeISO = getNewStartTime(appointment.startTime, transform.y, PIXELS_PER_HOUR);
    displayTime = formatTimeDisplay(projectedTimeISO);
  }

  // Hierarquia visual baseada na altura do card
  const isLarge = height >= 70; // 45min ou mais
  const isMedium = height >= 45; // 30min

  const style = {
    top: `${top}px`,
    height: `${height - 2}px`, // Pequeno gap entre cards
    zIndex: isDragging ? 100 : 10, 
    transform: CSS.Translate.toString(transform),
    position: 'absolute',
    left: '4px',  
    right: '4px', 
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group"
    >
      <div
        {...listeners}
        {...attributes}
        onClick={(e) => onClick(e)}
        className={`
          w-full h-full rounded-2xl transition-all duration-200 overflow-hidden relative shadow-sm
          ${isDragging 
            ? 'ring-4 ring-schedy-black shadow-vivid scale-[1.02] z-[100] cursor-grabbing'
            : isCompleted
              ? 'bg-schedy-border opacity-40 grayscale cursor-default'
              : isBlocked
                ? 'bg-schedy-gray border-2 border-dashed border-schedy-border cursor-not-allowed'
                : `bg-service-${serviceColor} hover:shadow-vivid hover:-translate-y-0.5 cursor-pointer`
          }
        `}
      >
        <div className="p-3 flex flex-col h-full pointer-events-none text-white">
          
          {/* TOPO: Hora e Alerta */}
          <div className="flex justify-between items-start mb-1">
            <span className={`font-black tracking-tighter italic ${isLarge ? 'text-sm' : 'text-[10px]'}`}>
              {displayTime}
            </span>
            {hasNotes && !isDragging && (
              <AlertCircle size={isMedium ? 14 : 10} className="text-white/80" />
            )}
          </div>

          {/* MEIO: Nome do Cliente */}
          <div className="min-w-0 flex-1">
            <h4 className={`font-black uppercase italic leading-tight truncate ${isLarge ? 'text-sm' : 'text-[11px]'}`}>
              {isBlocked && <Lock size={12} className="inline mr-1" />}
              {appointment.clientName}
            </h4>
            
            {/* DETALHES: Serviço e Telefone (Apenas se houver espaço) */}
            {isMedium && (
              <p className="text-[9px] font-bold opacity-90 uppercase truncate mt-0.5">
                {appointment.serviceName}
              </p>
            )}
          </div>

          {/* RODAPÉ: Telefone (Apenas se for card grande) */}
          {isLarge && appointment.clientPhone && (
            <div className="flex items-center gap-1 mt-auto pt-1 border-t border-white/20">
              <Phone size={8} />
              <span className="text-[8px] font-bold tabular-nums">
                {appointment.clientPhone}
              </span>
            </div>
          )}

          {/* Overlay de Concluído */}
          {isCompleted && (
            <div className="absolute inset-0 bg-white/20 flex items-center justify-center">
               <span className="text-[10px] font-black uppercase text-schedy-black bg-white px-2 py-1 rounded-lg">Done</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}