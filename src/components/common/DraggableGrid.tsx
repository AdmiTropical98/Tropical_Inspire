import React, { useEffect, useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import { useLayout } from '../../contexts/LayoutContext';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface DraggableGridProps {
    children: React.ReactNode;
    zoneId: string;
    className?: string;
    // Default layouts for when no user config exists
    defaultLayouts?: { lg: Layout[]; md: Layout[]; sm: Layout[] };
}

export default function DraggableGrid({ children, zoneId, className, defaultLayouts }: DraggableGridProps) {
    const { isEditMode, getGridLayout, saveGridLayout } = useLayout();
    const [mounted, setMounted] = useState(false);

    // Wait for mount to avoid hydration mismatch
    useEffect(() => {
        setMounted(true);
    }, []);

    // Get current layout from context or defaults
    const currentLayouts = getGridLayout(zoneId) || defaultLayouts || { lg: [], md: [], sm: [] };

    const handleLayoutChange = (currentLayout: Layout[], allLayouts: { lg: Layout[]; md: Layout[]; sm: Layout[] }) => {
        if (!isEditMode) return;
        saveGridLayout(zoneId, allLayouts);
    };

    if (!mounted) return <div className={className}>{children}</div>;

    // Filter children to ensure they have valid keys
    const validChildren = React.Children.toArray(children).filter((child: any) => !!child.key);

    return (
        <ResponsiveGridLayout
            className={className}
            layouts={currentLayouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={60}
            isDraggable={isEditMode}
            isResizable={isEditMode}
            onLayoutChange={handleLayoutChange}
            margin={[16, 16]}
            containerPadding={[0, 0]}
            draggableHandle=".drag-handle"
        >
            {validChildren.map((child: any) => (
                <div key={child.key} className={isEditMode ? "relative group border border-dashed border-slate-600/50 rounded-xl transition-all" : ""}>
                    {/* Drag Handle Overlay in Edit Mode */}
                    {isEditMode && (
                        <div className="absolute top-2 left-2 z-50 cursor-move drag-handle bg-slate-800 p-1.5 rounded-md shadow-lg border border-slate-700 hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="19 9 22 12 19 15"></polyline><polyline points="9 19 12 22 15 19"></polyline><circle cx="12" cy="12" r="1"></circle></svg>
                        </div>
                    )}
                    <div className="h-full w-full overflow-hidden">
                         {child}
                    </div>
                </div>
            ))}
        </ResponsiveGridLayout>
    );
}
