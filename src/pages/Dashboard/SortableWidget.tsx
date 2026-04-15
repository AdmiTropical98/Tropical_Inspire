import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

interface SortableWidgetProps {
  id: string;
  children: React.ReactNode;
  editing: boolean;
  className?: string; // Allow col-span classes to be passed through
}

export function SortableWidget({ id, children, editing, className }: SortableWidgetProps) {
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
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group h-full flex flex-col ${className || ''}`}
    >
      {/* Drag Content Wrapper */}
      <div className="flex-1 h-full relative">
         {/* Edit Mode Overlay & Handle */}
        {editing && (
          <>
            {/* Drag Handle */}
            <div
              {...listeners}
              {...attributes}
              className="absolute top-2 right-2 p-2 bg-slate-100/90 text-slate-400 rounded-lg cursor-grab active:cursor-grabbing z-50 hover:text-slate-900 hover:bg-slate-700 transition-all shadow-lg border border-slate-200"
            >
              <GripVertical className="w-5 h-5" />
            </div>
            
            {/* Visual Border for Edit Mode */}
            <div className="absolute inset-0 border-2 border-dashed border-slate-300/50 rounded-2xl pointer-events-none bg-white/90/10 z-40" />
          </>
        )}
        
        {children}
      </div>
    </div>
  );
}
