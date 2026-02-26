import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AlertCircle, Lock } from 'lucide-react'; 
import { 
  getPositionFromTime, 
  getHeightFromDuration, 
  getNewStartTime,    
  formatTimeDisplay   
} from '../../utils/timeGrid';

export function AppointmentCard({ appointment, onClick, style: propStyle, customPxPerHour }) {
  
  const top = getPositionFromTime(appointment.startTime, customPxPerHour);
  const height = getHeightFromDuration(appointment.duration, customPxPerHour);
  const isCompleted = appointment.status === 'completed';
  const isBlocked = appointment.type === 'block'; 
  
  // Verifica se existem notas/observações para ativar o alerta
  const hasNotes = appointment.notes && appointment.notes.trim().length > 0;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: appointment.id,
    data: appointment,
    disabled: isCompleted 
  });

  let displayTime = formatTimeDisplay(appointment.startTime);
  
  if (isDragging && transform) {
    const projectedTimeISO = getNewStartTime(appointment.startTime, transform.y, customPxPerHour);
    displayTime = formatTimeDisplay(projectedTimeISO);
  }

  const showDetails = height >= 35;

  const style = {
    top: `${top}px`,
    height: `${height}px`,
    zIndex: isDragging ? 100 : 10, 
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.9 : (isCompleted ? 0.6 : 1), 
    position: 'absolute',
    left: '4px',  
    right: '4px', 
    touchAction: 'none',
    ...propStyle 
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      // hover:z-[50] garante que o card focado fique visualmente acima dos outros
      className="group hover:z-[50] transition-all duration-75"
    >
      {/* 
          BARRA FLUTUANTE REMOVIDA 
          A edição agora é feita exclusivamente clicando no card abaixo.
      */}

      {/* CARD PRINCIPAL - CLICÁVEL PARA ABRIR O MODAL */}
      <div
        {...listeners}
        {...attributes}
        onClick={(e) => {
          // IMPORTANTE: Passamos o evento 'e' para o onClick original do DayView
          if (onClick) onClick(e);
        }}
        className={`
          w-full h-full rounded-lg border-l-4 transition-all duration-200 overflow-hidden relative
          ${isDragging 
            ? 'bg-barber-gold text-barber-black border-barber-white shadow-2xl scale-[1.02] cursor-grabbing'
            : isCompleted
              ? 'bg-zinc-900 border-zinc-700 cursor-default'
              : isBlocked
                ? 'bg-zinc-900/80 border-zinc-500 hover:bg-zinc-800 cursor-pointer' 
                : hasNotes 
                  ? 'bg-zinc-800 border-barber-gold animate-pulse-gold shadow-[0_0_15px_rgba(197,160,89,0.3)]' 
                  : 'bg-zinc-800/90 border-barber-red hover:bg-zinc-700 cursor-pointer shadow-md'
          }
        `}
      >
        {/* pointer-events-none garante que o clique seja detectado pelo container pai */}
        <div className="flex justify-between items-center p-2 relative h-full w-full pointer-events-none">
          {/* Badge Visual de Notas */}
          {hasNotes && !isCompleted && !isDragging && (
            <div className="absolute top-1 right-1 text-barber-gold">
              <AlertCircle size={10} fill="currentColor" className="text-black" />
            </div>
          )}

          <div className={`flex flex-col justify-center min-w-0 ${isDragging ? 'opacity-20' : ''}`}>
            <h4 className={`font-bold text-sm leading-tight truncate flex items-center gap-1.5 ${isCompleted ? 'text-zinc-500 line-through' : 'text-barber-white'}`}>
              {isBlocked && <Lock size={12} className="text-zinc-500" />}
              {appointment.clientName}
            </h4>
            {showDetails && (
              <p className={`text-[10px] mt-0.5 truncate ${isCompleted ? 'text-zinc-600' : 'text-barber-gray'}`}>
                {appointment.serviceName}
              </p>
            )}
          </div>

          <div className={`flex flex-col items-end flex-shrink-0 ml-2 ${isDragging ? 'opacity-20' : ''}`}>
            {showDetails && !isCompleted && !isBlocked && (
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${hasNotes ? 'bg-barber-gold text-black' : 'bg-barber-black/50 text-barber-gold'}`}>
                ${appointment.price}
              </span>
            )}
            {!isDragging && (
              <span className={`text-[10px] mt-1 ${isCompleted ? 'text-zinc-600' : 'text-barber-white font-bold'}`}>
                {displayTime}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}