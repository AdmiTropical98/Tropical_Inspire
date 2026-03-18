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
    return <div className="p-4 text-slate-500">Sem paragens configuradas.</div>;
  }

  const numStops = stops.length;
  const svgWidth = 800;
  const svgHeight = 200;
  
  const paddingX = 60;
  const lineY = 100;
  
  const usableWidth = svgWidth - (paddingX * 2);
  const segmentWidth = numStops > 1 ? usableWidth / (numStops - 1) : 0;

  return (
    <div className="w-full overflow-x-auto bg-slate-900 rounded-2xl border border-slate-800 p-4">
      <div className="min-w-[800px] flex justify-center">
        <svg width="100%" height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="text-slate-300">
          {/* Background Line */}
          {numStops > 1 && (
            <line 
              x1={paddingX} 
              y1={lineY} 
              x2={svgWidth - paddingX} 
              y2={lineY} 
              stroke="#334155" // slate-700
              strokeWidth="6" 
              strokeLinecap="round" 
            />
          )}

          {/* Stops */}
          {stops.map((stop, index) => {
            const stopX = paddingX + (index * segmentWidth);
            // highlight if any vehicle passed it or is at it
            const isPassed = vehicles.some(v => v.currentSegmentIndex >= index);
            
            return (
              <g key={stop.id} transform={`translate(${stopX}, ${lineY})`}>
                <circle 
                  cx="0" 
                  cy="0" 
                  r="10" 
                  fill="#0f172a" 
                  stroke={isPassed ? "#3b82f6" : "#334155"} 
                  strokeWidth="4" 
                />
                <circle 
                  cx="0" 
                  cy="0" 
                  r="4" 
                  fill={isPassed ? "#3b82f6" : "#334155"} 
                />
                
                <text 
                  x="0" 
                  y="35" 
                  fill={isPassed ? "#f8fafc" : "#94a3b8"}
                  fontSize="12" 
                  fontWeight={isPassed ? "bold" : "normal"}
                  textAnchor="middle"
                  className="font-sans"
                >
                  {stop.name}
                </text>
              </g>
            );
          })}

          {/* Vehicle Markers */}
          {vehicles.map((vehicle, idx) => {
            const truckX = paddingX + (vehicle.currentSegmentIndex * segmentWidth) + (vehicle.progressInSegment * segmentWidth);
            // Add a small vertical offset if multiple trucks are at the same spot
            const offsetIdx = vehicles.filter((v, i) => i < idx && Math.abs(v.currentSegmentIndex + v.progressInSegment - (vehicle.currentSegmentIndex + vehicle.progressInSegment)) < 0.05).length;
            const yOffset = offsetIdx * 5;

            return (
              <g key={vehicle.id} transform={`translate(${truckX}, ${lineY - 25 - yOffset})`} className="transition-all duration-1000 ease-linear">
                <rect 
                  x="-16" 
                  y="-16" 
                  width="32" 
                  height="32" 
                  rx="8" 
                  fill={vehicle.status === 'moving' ? "#2563eb" : "#475569"} 
                  className="drop-shadow-lg"
                />
                <foreignObject x="-12" y="-12" width="24" height="24">
                  <div className="w-full h-full flex items-center justify-center text-white">
                    <Truck size={16} />
                  </div>
                </foreignObject>
                
                {/* Speech bubble pointer */}
                <path d="M -4 16 L 0 20 L 4 16 Z" fill={vehicle.status === 'moving' ? "#2563eb" : "#475569"} />

                {/* Vehicle Label */}
                <text 
                  x="0" 
                  y="-22" 
                  textAnchor="middle" 
                  className="text-[10px] fill-white font-bold pointer-events-none filter drop-shadow-sm"
                  style={{ paintOrder: 'stroke', stroke: '#0f172a', strokeWidth: '2px' }}
                >
                  {vehicle.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default MetroLine;

