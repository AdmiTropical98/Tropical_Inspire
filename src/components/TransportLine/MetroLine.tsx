import React, { useState, useEffect } from 'react';
import { Truck, Navigation } from 'lucide-react';
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
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!stops || stops.length === 0) {
    return (
      <div className="p-16 text-slate-500 text-center bg-[#0a0f1d]/40 rounded-3xl border border-slate-800/40 backdrop-blur-md">
        <Navigation className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p className="font-sans tracking-widest uppercase text-xs">Sistema Offline</p>
        <p className="text-slate-600 text-[10px] mt-2 italic">Sem roteiro ativo para visualização</p>
      </div>
    );
  }

  const isMobile = windowWidth < 768;
  const numStops = stops.length;
  
  const horizontalSvgWidth = Math.max(900, numStops * 220);
  const horizontalSvgHeight = 220;
  const verticalSvgWidth = 340;
  const verticalSvgHeight = numStops * 120 + 80;

  const paddingX = isMobile ? 80 : 100;
  const paddingY = isMobile ? 60 : 110;
  
  const usableLength = isMobile 
    ? (verticalSvgHeight - paddingY * 2) 
    : (horizontalSvgWidth - paddingX * 2);
  
  const segmentLength = numStops > 1 ? usableLength / (numStops - 1) : 0;

  return (
    <div className={`w-full bg-[#030712] rounded-3xl border border-white/5 shadow-2xl custom-scrollbar relative overflow-hidden ${isMobile ? '' : 'p-10'}`}>
      {/* Dynamic Background Noise/Pulsing Layer */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px]" />
      
      <div className={`${isMobile ? 'flex justify-center py-10' : 'inline-block min-w-full'}`}>
        <svg 
          width={isMobile ? verticalSvgWidth : horizontalSvgWidth} 
          height={isMobile ? verticalSvgHeight : horizontalSvgHeight} 
          viewBox={isMobile ? `0 0 ${verticalSvgWidth} ${verticalSvgHeight}` : `0 0 ${horizontalSvgWidth} ${horizontalSvgHeight}`} 
          className="overflow-visible"
        >
          <defs>
            {/* Elegant Path Gradient */}
            <linearGradient id="activeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>

            {/* Depth Effects */}
            <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            
            <filter id="stopPulse" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feColorMatrix type="matrix" values="0 0 0 0 0.231 0 0 0 0 0.513 0 0 0 0 0.964 0 0 0 0.4 0" />
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Base Static Path (Elegant, dark slate) */}
          <line 
            x1={isMobile ? paddingX : paddingX} 
            y1={isMobile ? paddingY : paddingY} 
            x2={isMobile ? paddingX : horizontalSvgWidth - paddingX} 
            y2={isMobile ? verticalSvgHeight - paddingY : paddingY} 
            stroke="#111827" 
            strokeWidth="4" 
            strokeLinecap="round" 
          />

          {/* Flowing Path Progress */}
          {vehicles.map(v => {
            const headPos = paddingY + (v.currentSegmentIndex * segmentLength) + (v.progressInSegment * segmentLength);
            return (
              <g key={`progress-${v.id}`}>
                {/* Glow layer */}
                <line 
                  x1={isMobile ? paddingX : paddingX} 
                  y1={isMobile ? paddingY : paddingY} 
                  x2={isMobile ? paddingX : headPos} 
                  y2={isMobile ? headPos : paddingY} 
                  stroke="#3b82f6" 
                  strokeWidth="6" 
                  strokeLinecap="round"
                  opacity="0.15"
                  filter="url(#softGlow)"
                  className="transition-all duration-1000 ease-linear"
                />
                {/* Core animated path */}
                <line 
                  x1={isMobile ? paddingX : paddingX} 
                  y1={isMobile ? paddingY : paddingY} 
                  x2={isMobile ? paddingX : headPos} 
                  y2={isMobile ? headPos : paddingY} 
                  stroke="url(#activeGradient)" 
                  strokeWidth="2" 
                  strokeLinecap="round"
                  strokeDasharray="4,6"
                  className="transition-all duration-1000 ease-linear"
                >
                  <animate attributeName="stroke-dashoffset" from="20" to="0" dur="0.8s" repeatCount="indefinite" />
                </line>
              </g>
            );
          })}

          {/* Stops Rendering */}
          {stops.map((stop, index) => {
            const stopPos = (isMobile ? paddingY : paddingX) + (index * segmentLength);
            const stopX = isMobile ? paddingX : stopPos;
            const stopY = isMobile ? stopPos : paddingY;
            
            const isPassed = vehicles.some(v => v.currentSegmentIndex >= index);
            const isCurrent = vehicles.some(v => v.currentSegmentIndex === index);
            const isNext = vehicles.some(v => v.currentSegmentIndex === index - 1);
            
            return (
              <g key={stop.id} transform={`translate(${stopX}, ${stopY})`}>
                {/* Stop Time Indicator (Floating glass style) */}
                {index < numStops - 1 && stop.timeToNext && (
                  <g transform={`translate(${isMobile ? 25 : segmentLength / 2}, ${isMobile ? segmentLength / 2 : -25})`}>
                    <text 
                      fill="#4b5563" 
                      fontSize="9" 
                      fontWeight="bold" 
                      textAnchor={isMobile ? "start" : "middle"} 
                      className="font-sans tracking-[0.2em] opacity-80"
                    >
                      {stop.timeToNext}
                    </text>
                  </g>
                )}

                {/* Stop Visual Node */}
                {isPassed && (
                   <circle r="4" fill="#3b82f6" filter="url(#stopPulse)" />
                )}
                
                <circle 
                  r={isCurrent ? "10" : "6"} 
                  fill={isCurrent ? "#030712" : (isPassed ? "#3b82f6" : "#030712")} 
                  stroke={isPassed ? "#3b82f6" : "#1f2937"} 
                  strokeWidth="2" 
                  className="transition-all duration-500"
                />

                {isCurrent && (
                   <circle r="12" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.4" className="animate-ping" />
                )}

                {/* Stop Label Block */}
                <g transform={`translate(${isMobile ? 24 : 0}, ${isMobile ? 4 : 32})`}>
                   <text 
                    textAnchor={isMobile ? "start" : "middle"}
                    fill={isPassed || isCurrent ? "#f3f4f6" : "#4b5563"}
                    fontSize="10" 
                    fontWeight={isPassed || isCurrent ? "800" : "500"}
                    className={`font-sans tracking-widest uppercase transition-all duration-500 ${isCurrent ? 'scale-110' : ''}`}
                  >
                    {stop.name}
                  </text>
                  {isNext && (
                    <text 
                      y={isMobile ? 12 : 12} 
                      textAnchor={isMobile ? "start" : "middle"} 
                      fill="#3b82f6" 
                      fontSize="7" 
                      fontWeight="bold" 
                      className="animate-pulse tracking-[0.3em]"
                    >
                      UPCOMING
                    </text>
                  )}
                </g>
              </g>
            );
          })}

          {/* Vehicles (Floating Pill Style) */}
          {vehicles.map((v, idx) => {
            const truckPos = (isMobile ? paddingY : paddingX) + (v.currentSegmentIndex * segmentLength) + (v.progressInSegment * segmentLength);
            const truckX = isMobile ? paddingX : truckPos;
            const truckY = isMobile ? truckPos : paddingY;
            
            const mobileXOffset = isMobile ? (idx * 24 - 42) : 0;
            const desktopYOffset = isMobile ? 0 : (idx * 24 - 50);

            return (
              <g 
                key={v.id} 
                transform={`translate(${isMobile ? truckX + mobileXOffset : truckX}, ${isMobile ? truckY : truckY + desktopYOffset})`} 
                className="transition-all duration-1000 ease-linear"
              >
                {/* Floating Shadow */}
                <ellipse cx="0" cy="20" rx="10" ry="4" fill="black" opacity="0.3" filter="url(#softGlow)" />

                {/* Premium Pill Background */}
                <rect 
                  x="-42" y="-16" width="84" height="32" rx="16" 
                  fill="#0f172a" 
                  stroke="rgba(59, 130, 246, 0.4)" 
                  strokeWidth="1"
                  className="shadow-2xl"
                />
                
                {/* Icon Circle */}
                <circle cx="-26" cy="0" r="10" fill="#3b82f6" />
                <foreignObject x="-31" y="-5" width="10" height="10">
                  <div className="text-white flex items-center justify-center">
                    <Truck size={10} className={v.status === 'moving' ? 'animate-bounce' : ''} />
                  </div>
                </foreignObject>

                {/* Label (Bold/Technical) */}
                <text x="12" y="3.5" textAnchor="middle" fill="white" fontSize="9" fontWeight="800" className="font-sans tracking-tight">
                  {v.label}
                </text>

                {/* Live Activity indicator */}
                {v.status === 'moving' && (
                  <circle cx="34" cy="-8" r="2.5" fill="#22c55e" className="animate-pulse" />
                )}
                
                {/* Minimalist connector point */}
                {!isMobile && (
                  <circle cx="0" cy={-desktopYOffset} r="2" fill="#3b82f6" opacity="0.4" />
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

