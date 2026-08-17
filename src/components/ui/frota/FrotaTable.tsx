import React, { useState } from 'react';
import { cn } from './FrotaCard';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, MoreHorizontal, Inbox } from 'lucide-react';

export interface FrotaTableColumn<T> {
  id: string;
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string; // e.g. w-32, text-right
}

interface FrotaTableProps<T> {
  columns: FrotaTableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  
  // Pagination
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  
  // Sorting
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (columnId: string) => void;
  
  // Actions
  onRowClick?: (row: T) => void;
  
  emptyMessage?: string;
}

export function FrotaTable<T>({
  columns,
  data,
  isLoading,
  page = 1,
  totalPages = 1,
  onPageChange,
  sortColumn,
  sortDirection,
  onSort,
  onRowClick,
  emptyMessage = "Sem dados disponíveis"
}: FrotaTableProps<T>) {

  const renderSortIcon = (colId: string) => {
    if (!sortable(colId)) return null;
    if (sortColumn !== colId) return <ChevronDown className="w-3.5 h-3.5 text-slate-300 ml-1 inline opacity-0 group-hover:opacity-100 transition-opacity" />;
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-3.5 h-3.5 text-blue-600 ml-1 inline" /> 
      : <ChevronDown className="w-3.5 h-3.5 text-blue-600 ml-1 inline" />;
  };

  const sortable = (colId: string) => {
    const col = columns.find(c => c.id === colId);
    return col?.sortable;
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden flex flex-col w-full h-full">
      <div className="overflow-x-auto overflow-y-auto flex-1">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-slate-50/80 text-xs uppercase text-slate-500 font-bold sticky top-0 z-10 backdrop-blur-md border-b border-slate-200">
            <tr>
              {columns.map((col) => (
                <th 
                  key={col.id} 
                  className={cn(
                    "px-4 py-3.5 whitespace-nowrap tracking-wider", 
                    col.sortable && "cursor-pointer hover:bg-slate-100/50 group select-none transition-colors",
                    col.className
                  )}
                  onClick={() => col.sortable && onSort?.(col.id)}
                >
                  <div className="flex items-center">
                    {col.header}
                    {renderSortIcon(col.id)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {isLoading ? (
              // Skeleton Loader
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {columns.map((col, j) => (
                    <td key={`skel-${j}`} className="px-4 py-4">
                      <div className="h-4 bg-slate-100 rounded-md animate-pulse w-3/4"></div>
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              // Empty State
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <Inbox className="w-12 h-12 text-slate-200 mb-3" />
                    <span className="font-medium">{emptyMessage}</span>
                  </div>
                </td>
              </tr>
            ) : (
              // Data Rows
              data.map((row, i) => (
                <tr 
                  key={i} 
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    "group transition-colors",
                    onRowClick ? "cursor-pointer hover:bg-slate-50/80" : "hover:bg-slate-50/50"
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.id} className={cn("px-4 py-3 text-slate-700", col.className)}>
                      {col.cell 
                        ? col.cell(row) 
                        : (col.accessorKey ? String((row as any)[col.accessorKey] ?? '') : '')
                      }
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="border-t border-slate-200 bg-slate-50/50 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-slate-500 font-medium">
            Página <span className="font-bold text-slate-700">{page}</span> de <span className="font-bold text-slate-700">{totalPages}</span>
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
