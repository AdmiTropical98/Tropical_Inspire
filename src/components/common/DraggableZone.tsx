import React from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    horizontalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLayout } from '../../contexts/LayoutContext';
import { GripVertical, Maximize2, Minimize2, Eye, EyeOff } from 'lucide-react';

// --- Sortable Item Wrapper ---
// --- Sortable Item Wrapper ---
function SortableItem({ id, children, config, onToggleWidth, onToggleVisibility, isEditMode, layout }: any) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    // Calculate grid classes based on width
    const getWidthClass = () => {
        if (layout === 'flex') return '';
        const w = config?.width || 'full';
        switch (w) {
            case 'half': return 'col-span-6';
            case 'third': return 'col-span-4';
            case 'quarter': return 'col-span-3';
            default: return 'col-span-12';
        }
    };
    
    const widthClass = getWidthClass();

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            className={`${widthClass} relative group h-full`}
        >
             {/* Edit Controls Overlay */}
             {isEditMode && (
                <div className="absolute top-2 right-2 z-20 flex gap-1 bg-slate-900/80 rounded-lg p-1 backdrop-blur-sm border border-slate-700">
                    {layout !== 'flex' && (
                        <button 
                             onPointerDown={(e) => e.stopPropagation()}
                             onClick={onToggleWidth}
                             className="p-1 hover:bg-slate-700 rounded text-slate-300"
                             title="Alterar Tamanho"
                        >
                            <Maximize2 className="w-3 h-3" />
                        </button>
                    )}
                    <button 
                         onPointerDown={(e) => e.stopPropagation()}
                         onClick={onToggleVisibility}
                         className="p-1 hover:bg-slate-700 rounded text-slate-300"
                         title={config?.hidden ? "Mostrar" : "Ocultar"}
                    >
                        {config?.hidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                     {/* Drag Handle */}
                    <div {...attributes} {...listeners} className="p-1 cursor-grab hover:bg-slate-700 rounded text-slate-300">
                        <GripVertical className="w-3 h-3" />
                    </div>
                </div>
            )}

            {/* Content Wrapper */}
            <div className={`h-full ${isEditMode ? 'border-2 border-dashed border-slate-600 rounded-xl relative' : ''}`}>
               {/* Disabled overlay in edit mode to prevent clicks inside components */}
               {isEditMode && <div className="absolute inset-0 z-10 bg-transparent" />}
               {children}
            </div>
        </div>
    );
}

interface DraggableZoneProps {
    zoneId: string;
    items: { id: string; content: React.ReactNode }[];
    className?: string;
    layout?: 'grid' | 'flex';
}

export default function DraggableZone({ zoneId, items, className, layout = 'grid' }: DraggableZoneProps) {
    const { 
        isEditMode, 
        getLayout, 
        updateLayoutOrder, 
        toggleItemWidth, 
        toggleItemVisibility 
    } = useLayout();

    const sensors = useSensors(
        useSensor(PointerSensor, {
             activationConstraint: {
                distance: 5, // Prevent accidental drags
             },
        }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const layoutItems = getLayout(zoneId, items); // Returns merged items with config
    
    // Filter out hidden items unless in edit mode
    const visibleItems = isEditMode 
        ? layoutItems 
        : layoutItems.filter((i: any) => !i.layoutConfig?.hidden);

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        if (active && over && active.id !== over.id) {
            const oldIndex = visibleItems.findIndex((i: any) => i.id === active.id);
            const newIndex = visibleItems.findIndex((i: any) => i.id === over.id);
            const newOrder = arrayMove(visibleItems, oldIndex, newIndex);
            updateLayoutOrder(zoneId, newOrder);
        }
    };
    
    const strategy = layout === 'flex' ? horizontalListSortingStrategy : rectSortingStrategy;

    return (
        <DndContext 
            sensors={sensors} 
            collisionDetection={closestCenter} 
            onDragEnd={handleDragEnd}
        >
            <SortableContext 
                items={visibleItems.map((i: any) => i.id)} 
                strategy={strategy}
            >
                <div className={layout === 'flex' ? `flex gap-4 ${className}` : `grid grid-cols-12 gap-4 ${className}`}>
                    {visibleItems.map((item: any) => (
                        <SortableItem 
                            key={item.id} 
                            id={item.id}
                            config={item.layoutConfig}
                            onToggleWidth={() => toggleItemWidth(zoneId, item.id)}
                            onToggleVisibility={() => toggleItemVisibility(zoneId, item.id)}
                            isEditMode={isEditMode}
                            layout={layout}
                        >
                            {item.content || item} 
                        </SortableItem>
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
}
