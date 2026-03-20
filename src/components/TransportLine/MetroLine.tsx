import React, { useState, useEffect } from 'react';
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
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!stops || stops.length === 0) {
    return <div className="p-12 text-slate-500 text-center bg-slate-900/20 rounded-2xl border border-slate-800/50 italic">Sem paragens configuradas no roteiro.</div>;
  }

  const isMobile = windowWidth < 768;
  const numStops = stops.length;
  
  // Dimensions based on layout
  const horizontalSvgWidth = Math.max(800, numStops * 180);
  const horizontalSvgHeight = 180;
  const verticalSvgWidth = 300;
  const verticalSvgHeight = numStops * 100 + 40;

  const paddingX = isMobile ? 60 : 80;
  const paddingY = isMobile ? 40 : 90;
  
  const usableLength = isMobile 
    ? (verticalSvgHeight - paddingY * 2) 
    : (horizontalSvgWidth - paddingX * 2);
  
  const segmentLength = numStops > 1 ? usableLength / (numStops - 1) : 0;

  return (
    <div className={`w-full bg-[#0a0f1d] rounded-xl border border-slate-800/60 custom-scrollbar ${isMobile ? 'overflow-visible' : 'overflow-x-auto p-8'}`}>
      <div className={`${isMobile ? 'flex justify-center p-4' : 'inline-block min-w-full'}`}>
        <svg 
          width={isMobile ? verticalSvgWidth : horizontalSvgWidth} 
          height={isMobile ? verticalSvgHeight : horizontalSvgHeight} 
          viewBox={isMobile ? `0 0 ${verticalSvgWidth} ${verticalSvgHeight}` : `0 0 ${horizontalSvgWidth} ${horizontalSvgHeight}`} 
          className="overflow-visible"
        >
          {/* Subtle grid guide */}
          {isMobile ? (
             <line x1={paddingX} y1={0} x2={paddingX} y2={verticalSvgHeight} stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />
          ) : (
             <line x1={0} y1={paddingY} x2={horizontalSvgWidth} y2={paddingY} stroke="#1e293b" strokeWidth="1" strokeDasharray="4 4" />
          )}

          {/* Connection Lines */}
          {numStops > 1 && (
            <>
              {/* Base Path (Grey) */}
              <line 
                x1={isMobile ? paddingX : paddingX} 
                y1={isMobile ? paddingY : paddingY} 
                x2={isMobile ? paddingX : horizontalSvgWidth - paddingX} 
                y2={isMobile ? verticalSvgHeight - paddingY : paddingY} 
                stroke="#1e293b" 
                strokeWidth="2" 
                strokeLinecap="round" 
              />
              
              {/* Active Progress Path */}
              {vehicles.map(v => {
                const headPos = paddingY + (v.currentSegmentIndex * segmentLength) + (v.progressInSegment * segmentLength);
                return (
                  <line 
                    key={`line-${v.id}`}
                    x1={isMobile ? paddingX : paddingX} 
                    y1={isMobile ? paddingY : paddingY} 
                    x2={isMobile ? paddingX : headPos} 
                    y2={isMobile ? headPos : paddingY} 
                    stroke="#3b82f6" 
                    strokeWidth="2" 
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-linear"
                  />
                );
              })}
            </>
          )}

          {/* Stops */}
          {stops.map((stop, index) => {
            const stopPos = (isMobile ? paddingY : paddingX) + (index * segmentLength);
            const stopX = isMobile ? paddingX : stopPos;
            const stopY = isMobile ? stopPos : paddingY;
            
            const isPassed = vehicles.some(v => v.currentSegmentIndex >= index);
            const isCurrent = vehicles.some(v => v.currentSegmentIndex === index);
            
            return (
              <g key={stop.id} transform={`translate(${stopX}, ${stopY})`}>
                {/* Time Indicator */}
                {index < numStops - 1 && stop.timeToNext && (
                  <text 
                    x={isMobile ? 20 : segmentLength / 2} 
                    y={isMobile ? segmentLength / 2 : -15} 
                    fill="#475569" 
                    fontSize="10" 
                    fontWeight="600" 
                    textAnchor={isMobile ? "start" : "middle"} 
                    className="font-sans tracking-wide"
                  >
                    {stop.timeToNext}
                  </text>
                )}

                {/* Stop Dot */}
                <circle 
                  r="6" 
                  fill={isPassed ? "#3b82f6" : "#0a0f1d"} 
                  stroke={isPassed ? "#3b82f6" : "#334155"} 
                  strokeWidth="2" 
                />
                {isCurrent && (
                  <circle r="12" fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="3 2" className="animate-spin-slow" />
                )}

                {/* Stop Name */}
                <text 
                  x={isMobile ? 18 : 0}
                  y={isMobile ? 4 : 25} 
                  textAnchor={isMobile ? "start" : "middle"}
                  fill={isPassed ? "#e2e8f0" : "#64748b"}
                  fontSize="11" 
                  fontWeight={isPassed ? "600" : "500"}
                  className="font-sans uppercase tracking-tighter"
                >
                  {stop.name}
                </text>
              </g>
            );
          })}

          {/* Vehicles */}
          {vehicles.map((v, idx) => {
            const truckPos = (isMobile ? paddingY : paddingX) + (v.currentSegmentIndex * segmentLength) + (v.progressInSegment * segmentLength);
            const truckX = isMobile ? paddingX : truckPos;
            const truckY = isMobile ? truckPos : paddingY;
            
            const offsetIdx = vehicles.filter((vOther, i) => i < idx && Math.abs(vOther.currentSegmentIndex + vOther.progressInSegment - (v.currentSegmentIndex + v.progressInSegment)) < 0.05).length;
            const scrollOffset = isMobile ? (idx * 20 - 40) : (isMobile ? 0 : -35); // Horizontal offset on mobile
            const verticalOffset = isMobile ? 0 : (offsetIdx * 15);

            return (
              <g 
                key={v.id} 
                transform={`translate(${isMobile ? truckX + scrollOffset : truckX}, ${isMobile ? truckY : truckY - 35 - verticalOffset})`} 
                className="transition-all duration-1000 ease-linear"
              >
                {/* Minimalist Vehicle Card */}
                <rect x="-35" y="-14" width="70" height="28" rx="4" fill="#1e293b" stroke="#3b82f6" strokeWidth="1" />
                <rect x="-35" y="-14" width="24" height="28" rx="4" fill="#3b82f6" />
                <foreignObject x="-31" y="-10" width="16" height="16">
                  <div className="text-white flex items-center justify-center">
                    <Truck size={14} />
                  </div>
                </foreignObject>
                <text x="18" y="4" textAnchor="middle" fill="white" fontSize="10" fontWeight="700" className="font-sans">
                  {v.label}
                </text>

                {/* Connector */}
                {!isMobile && (
                  <>
                    <line x1="0" y1="14" x2="0" y2="35" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="2 2" />
                    <circle cx="0" cy="35" r="3" fill="#3b82f6" />
                  </>
                )}
                
                {/* Status Pulse */}
                {v.status === 'moving' && (
                  <circle cx="-23" cy="-14" r="4" fill="#22c55e" stroke="#0a0f1d" strokeWidth="2" className="animate-pulse" />
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

