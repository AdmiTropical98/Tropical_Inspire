import React from 'react';
import { Truck } from 'lucide-react';
import type { RouteStop } from '../../utils/geoUtils';

export interface VehicleMarker {
  id: string;
  label: string;
  currentSegmentIndex: number;
  progressInSegment: number;
  status?: string;
}

interface MetroLineProps {
  stops: RouteStop[];
  vehicles: VehicleMarker[];
}

const MetroLine: React.FC<MetroLineProps> = ({ stops, vehicles }) => {
  if (!stops || stops.length === 0) {
    return <div className="p-8 text-slate-500 text-center bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">Sem paragens configuradas.</div>;
  }

  const numStops = stops.length;
  const svgWidth = Math.max(800, numStops * 180); // Dynamic width based on stops
  const svgHeight = 240;
  
  const paddingX = 80;
  const lineY = 120;
  
  const usableWidth = svgWidth - (paddingX * 2);
  const segmentWidth = numStops > 1 ? usableWidth / (numStops - 1) : 0;

  return (
    <div className="w-full overflow-x-auto bg-[#0f172a] rounded-2xl border border-white/5 p-6 custom-scrollbar">
      <div className="inline-block min-w-full">
        <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="mx-auto overflow-visible">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="1" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.8" />
            </linearGradient>
            
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            <filter id="truckGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feColorMatrix type="matrix" values="0 0 0 0 0.23137 0 0 0 0 0.51373 0 0 0 0 0.96471 0 0 0 0.5 0" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Grid Lines (Subtle) */}
          <g opacity="0.05">
            {Array.from({ length: 10 }).map((_, i) => (
              <line key={i} x1="0" y1={i * 25} x2={svgWidth} y2={i * 25} stroke="white" strokeWidth="1" />
            ))}
          </g>

          {/* Main Connection Line */}
          {numStops > 1 && (
            <>
              {/* Shadow/Glow Line */}
              <line 
                x1={paddingX} 
                y1={lineY} 
                x2={svgWidth - paddingX} 
                y2={lineY} 
                stroke="#3b82f6"
                strokeWidth="10" 
                strokeLinecap="round" 
                opacity="0.1"
                filter="url(#glow)"
              />
              {/* Core Line */}
              <line 
                x1={paddingX} 
                y1={lineY} 
                x2={svgWidth - paddingX} 
                y2={lineY} 
                stroke="url(#lineGradient)" 
                strokeWidth="4" 
                strokeLinecap="round" 
              />
            </>
          )}

          {/* Stops */}
          {stops.map((stop, index) => {
            const stopX = paddingX + (index * segmentWidth);
            const isPassed = vehicles.some(v => v.currentSegmentIndex >= index);
            const isNext = vehicles.some(v => v.currentSegmentIndex === index - 1);
            
            return (
              <g key={stop.id} transform={`translate(${stopX}, ${lineY})`} className="transition-all duration-500">
                {/* Time Indicator Bubble */}
                {index < numStops - 1 && stop.timeToNext && (
                  <g transform={`translate(${segmentWidth / 2}, -40)`}>
                    <rect x="-28" y="-12" width="56" height="24" rx="12" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                    <text x="0" y="4" fill="#60a5fa" fontSize="11" fontWeight="bold" textAnchor="middle" className="font-mono">
                      {stop.timeToNext}
                    </text>
                  </g>
                )}

                {/* Stop Node */}
                <circle 
                  r={isNext ? "14" : "10"} 
                  fill="#0f172a" 
                  stroke={isPassed ? "#3b82f6" : "#334155"} 
                  strokeWidth="3" 
                  className={isNext ? "animate-pulse" : ""}
                />
                <circle 
                  r={isPassed ? "5" : "3"} 
                  fill={isPassed ? "#3b82f6" : "#475569"} 
                  className="transition-all duration-700"
                />

                {/* Stop Label */}
                <g transform="translate(0, 35)">
                  <text 
                    textAnchor="middle"
                    fill={isPassed ? "#f8fafc" : "#64748b"}
                    fontSize="12" 
                    fontWeight={isPassed || isNext ? "700" : "500"}
                    className="select-none"
                  >
                    {stop.name}
                  </text>
                  {isNext && (
                    <text y="15" textAnchor="middle" fill="#3b82f6" fontSize="9" fontWeight="bold" className="animate-bounce">
                      PRÓXIMA
                    </text>
                  )}
                </g>
              </g>
            );
          })}

          {/* Vehicle Markers */}
          {vehicles.map((vehicle, idx) => {
            const truckX = paddingX + (vehicle.currentSegmentIndex * segmentWidth) + (vehicle.progressInSegment * segmentWidth);
            const offsetIdx = vehicles.filter((v, i) => i < idx && Math.abs(v.currentSegmentIndex + v.progressInSegment - (vehicle.currentSegmentIndex + vehicle.progressInSegment)) < 0.05).length;
            const yOffset = offsetIdx * 12;

            return (
              <g 
                key={vehicle.id} 
                transform={`translate(${truckX}, ${lineY - 30 - yOffset})`} 
                className="transition-all duration-1000 ease-linear"
                filter="url(#truckGlow)"
              >
                {/* Visual Marker */}
                <rect 
                  x="-18" 
                  y="-18" 
                  width="36" 
                  height="36" 
                  rx="10" 
                  fill={vehicle.status === 'moving' ? "#3b82f6" : "#64748b"} 
                  className="drop-shadow-xl"
                />
                <foreignObject x="-12" y="-12" width="24" height="24">
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <Truck size={18} className={vehicle.status === 'moving' ? "animate-pulse" : ""} />
                  </div>
                </foreignObject>
                
                {/* Indicator Triangle */}
                <path d="M -6 18 L 0 24 L 6 18 Z" fill={vehicle.status === 'moving' ? "#3b82f6" : "#64748b"} />

                {/* Floating Label Container */}
                <g transform="translate(0, -32)">
                  <rect x="-40" y="-12" width="80" height="20" rx="4" fill="rgba(15, 23, 42, 0.9)" stroke="rgba(255, 255, 255, 0.1)" strokeWidth="1" />
                  <text 
                    textAnchor="middle" 
                    className="text-[11px] fill-white font-bold pointer-events-none"
                  >
                    {vehicle.label}
                  </text>
                </g>

                {/* Status Indicator */}
                {vehicle.status === 'moving' && (
                  <circle cx="14" cy="-14" r="4" fill="#22c55e" stroke="#0f172a" strokeWidth="2" />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default MetroLine;

