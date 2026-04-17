import React from 'react';

interface LayoutDesktopProps {
  isFullScreenPage: boolean;
  navbar: React.ReactNode;
  children: React.ReactNode;
}

export default function LayoutDesktop({ isFullScreenPage, navbar, children }: LayoutDesktopProps) {
  return (
    <div className={`layout-desktop app-root w-full flex flex-col overflow-x-hidden bg-transparent text-slate-900 font-sans selection:bg-amber-500/20 ${isFullScreenPage ? 'h-[100dvh]' : 'min-h-[100dvh]'}`}>
      {navbar}
      <main className={`app-content-bg flex-1 min-h-0 ${isFullScreenPage ? 'overflow-hidden' : 'overflow-visible'}`}>
        <div className={`relative z-10 bg-transparent ${isFullScreenPage ? 'h-full w-full overflow-hidden' : 'flex h-full min-h-0 w-full min-w-0 max-w-full overflow-x-auto overflow-y-auto custom-scrollbar'}`}>
          <div className={isFullScreenPage ? 'h-full w-full' : 'flex-1 w-full max-w-none px-4 sm:px-6 lg:px-8 py-4 sm:py-6 min-w-0'}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
