import React from 'react';
import { Truck } from 'lucide-react';
import type { RouteStop } from '../../utils/geoUtils';

interface MetroLineProps {
  stops: RouteStop[];
  currentSegmentIndex: number;
  progressInSegment: number;
}

const MetroLine: React.FC<MetroLineProps> = ({ stops, currentSegmentIndex, progressInSegment }) => {
  if (!stops || stops.length === 0) {
    return <div className="p-4 text-slate-500">Sem paragens configuradas.</div>;
  }

  const numStops = stops.length;
  // Use a fixed SVG height or width, depending on orientation. Let's do a horizontal metro line for simplicity.
  const svgWidth = 800;
  const svgHeight = 200;
  
  // Padding inside the SVG so the labels and truck aren't cut off
  const paddingX = 60;
  const lineY = 100;
  
  const usableWidth = svgWidth - (paddingX * 2);
  const segmentWidth = numStops > 1 ? usableWidth / (numStops - 1) : 0;

  // Calculate truck position
  let truckX = paddingX; 
  if (numStops > 1) {
    truckX = paddingX + (currentSegmentIndex * segmentWidth) + (progressInSegment * segmentWidth);
  }

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

          {/* Active Line (progress so far) */}
          {numStops > 1 && truckX > paddingX && (
            <line 
              x1={paddingX} 
              y1={lineY} 
              x2={truckX} 
              y2={lineY} 
              stroke="#3b82f6" // blue-500
              strokeWidth="6" 
              strokeLinecap="round" 
            />
          )}

          {/* Stops */}
          {stops.map((stop, index) => {
            const stopX = paddingX + (index * segmentWidth);
            // highlight if passed or active
            const isPassed = index <= currentSegmentIndex;
            
            return (
              <g key={stop.id} transform={`translate(${stopX}, ${lineY})`}>
                <circle 
                  cx="0" 
                  cy="0" 
                  r="10" 
                  fill="#0f172a" // background matching slate-950
                  stroke={isPassed ? "#3b82f6" : "#334155"} 
                  strokeWidth="4" 
                />
                <circle 
                  cx="0" 
                  cy="0" 
                  r="4" 
                  fill={isPassed ? "#3b82f6" : "#334155"} 
                />
                
                {/* Stop Name Label */}
                <text 
                  x="0" 
                  y="30" 
                  fill={isPassed ? "#f8fafc" : "#94a3b8"} // slate-50 vs slate-400
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

          {/* Vehicle Marker */}
          <g transform={`translate(${truckX}, ${lineY - 25})`} className="transition-transform duration-1000 ease-linear">
            <rect 
              x="-16" 
              y="-16" 
              width="32" 
              height="32" 
              rx="8" 
              fill="#2563eb" // blue-600
              className="drop-shadow-lg"
            />
            {/* Using a simple custom SVG for the truck for inline use to avoid React component parsing issues inside standard SVG tags, 
                or we can render a foreignObject. foreignObject is much easier for lucide-react icons. */}
            <foreignObject x="-12" y="-12" width="24" height="24">
              <div className="w-full h-full flex items-center justify-center text-white">
                <Truck size={16} />
              </div>
            </foreignObject>
            
            {/* Speech bubble pointer */}
            <path d="M -6 16 L 0 22 L 6 16 Z" fill="#2563eb" />
          </g>
        </svg>
      </div>
    </div>
  );
};

export default MetroLine;
