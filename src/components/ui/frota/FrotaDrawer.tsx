import React, { useEffect } from 'react';
import { cn } from './FrotaCard';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FrotaDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  position?: 'right' | 'left' | 'bottom';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export function FrotaDrawer({ isOpen, onClose, title, children, footer, position = 'right', size = 'md' }: FrotaDrawerProps) {
  
  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const sizeClasses = {
    'sm': 'max-w-sm',
    'md': 'max-w-md',
    'lg': 'max-w-lg',
    'xl': 'max-w-3xl',
    'full': 'max-w-full'
  };

  const getSlideAnimation = () => {
    switch (position) {
      case 'left': return { initial: { x: '-100%' }, animate: { x: 0 }, exit: { x: '-100%' } };
      case 'bottom': return { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' } };
      case 'right': 
      default:
        return { initial: { x: '100%' }, animate: { x: 0 }, exit: { x: '100%' } };
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[100]"
          />
          
          <motion.div
            {...getSlideAnimation()}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className={cn(
              "fixed z-[101] bg-white flex flex-col shadow-2xl",
              position === 'bottom' ? "bottom-0 left-0 right-0 h-[80vh] rounded-t-3xl" : "top-0 bottom-0",
              position === 'right' ? "right-0 rounded-l-2xl" : "",
              position === 'left' ? "left-0 rounded-r-2xl" : "",
              position !== 'bottom' ? `w-full ${sizeClasses[size]}` : ""
            )}
          >
            {/* Header */}
            {title !== undefined && (
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
                {typeof title === 'string' ? (
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h2>
                ) : (
                  title
                )}
                <button 
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors ml-4"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            {title === undefined && (
               <button 
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
                >
                  <X className="w-5 h-5" />
                </button>
            )}

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="px-6 py-4 border-t border-slate-100 bg-white flex items-center justify-end gap-3 flex-shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
