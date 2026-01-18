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
function SortableItem({ id, children, config, defaultWidth, onToggleWidth, onToggleVisibility, isEditMode, layout }: any) {
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
        const w = config?.width || defaultWidth || 'full';

        // Base is always col-span-12 (mobile first)
        // larger screens (md/lg) get the persistent width
        switch (w) {
            case 'half': return 'col-span-12 lg:col-span-6';
            case 'third': return 'col-span-12 lg:col-span-4';
            case 'quarter': return 'col-span-12 md:col-span-6 lg:col-span-3';
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

export function DraggableWidget({ id, defaultWidth, children }: { id: string, defaultWidth?: string, children: React.ReactNode }) {
    return <>{children}</>;
}

interface DraggableZoneProps {
    zoneId: string;
    items?: { id: string; content: React.ReactNode, defaultWidth?: string }[];
    children?: React.ReactNode;
    className?: string;
    layout?: 'grid' | 'flex';
}

export default function DraggableZone({ zoneId, items = [], children, className, layout = 'grid' }: DraggableZoneProps) {
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



    // Merge items: props.items take precedence or merge?
    // Let's concatenate.
    // Note: items from children already contain the content (the child itself).
    // The previous implementation used DraggableWidget just as data holder.
    // Better: DraggableWidget returns children. So content is child.props.children?
    // If I use <DraggableWidget> <div>...</div> </DraggableWidget>, content is <div>...</div>.
    // The child itself IS the DraggableWidget execution result which is Fragment>Children.
    // So `content: child` would wrap it in DraggableWidget again?
    // No, `React.Children.toArray` gives the Element.
    // If I render `item.content`, it renders the DraggableWidget element, which renders children. Correct.

    // However, if I extract `content: child.props.children`, I bypass the wrapper.
    // If DraggableWidget is just `return <>{children}</>`, it's fine to bypass.
    // Let's parse `child.props.children` to be safe/cleaner?
    // No, simpler to just use `content: <>{child.props.children}</>`.

    // Update logic:
    const parsedChildrenItems = React.Children.toArray(children).map((child: any) => {
        if (React.isValidElement(child)) {
            const props = child.props as any;
            if (props.id) {
                return {
                    id: props.id,
                    content: props.children, // Extract children to avoid double wrapper issues if any
                    defaultWidth: props.defaultWidth
                };
            }
        }
        return null;
    }).filter((i): i is { id: string; content: React.ReactNode; defaultWidth?: string } => Boolean(i));

    const allItems = [...items, ...parsedChildrenItems];

    const layoutItems = getLayout(zoneId, allItems); // Returns merged items with config
    
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
                            defaultWidth={item.defaultWidth}
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
