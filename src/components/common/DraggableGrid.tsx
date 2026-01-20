import React from 'react';
import { Responsive } from 'react-grid-layout';



interface DraggableGridProps {
  children: React.ReactNode;
  zoneId: string;
  className?: string;
  defaultLayouts: {
    lg: any[];
    md: any[];
    sm: any[];
  };
}


export default function DraggableGrid({
  children,
  defaultLayouts,
}: DraggableGridProps) {
const layouts = defaultLayouts;
  return (
<Responsive
  width={1200}
  className="layout"
  layouts={layouts}
  breakpoints={{ lg: 1200, md: 996, sm: 768 }}
  cols={{ lg: 12, md: 10, sm: 6 }}
  rowHeight={60}
  margin={[16, 16]}
  containerPadding={[0, 0]}
>

      {React.Children.map(children, (child, index) => (
        <div key={layouts.lg[index]?.i ?? index.toString()}>
          {child}
        </div>
      ))}
    </Responsive>
  );
}
