import React from 'react';

interface BottomNavItem {
  key: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  primary?: boolean;
  onClick: () => void;
}

interface MoreMenuGroup {
  key: string;
  label: string;
  items: Array<{
    key: string;
    label: string;
    icon: React.ElementType;
    active: boolean;
    onClick: () => void;
  }>;
}

interface LayoutMobileProps {
  logoSrc: string;
  onLogoClick: () => void;
  userMenu: React.ReactNode;
  isMapPage: boolean;
  bottomNavItems: BottomNavItem[];
  moreMenuGroups?: MoreMenuGroup[];
  children: React.ReactNode;
}

export default function LayoutMobile({
  logoSrc,
  onLogoClick,
  userMenu,
  isMapPage,
  bottomNavItems,
  moreMenuGroups = [],
  children,
}: LayoutMobileProps) {
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);

  return (
    <div className="layout-mobile app-root android-native-shell flex h-[100dvh] min-h-[100dvh] w-screen min-w-full max-w-[100vw] flex-col items-stretch overflow-hidden bg-transparent text-slate-900 font-sans selection:bg-amber-500/20">
      <nav className="mobile-topbar">
        <button type="button" onClick={onLogoClick} className="mobile-topbar-logo" aria-label="Ir para dashboard">
          <img src={logoSrc} alt="Algartempo Frota" className="h-8 w-auto object-contain" />
        </button>
        {userMenu}
      </nav>

      <main className={`app-content-bg flex-1 min-h-0 min-w-0 w-full max-w-none self-stretch ${isMapPage ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden mobile-main-content'}`}>
        <div className={`relative z-10 w-full min-w-0 max-w-[100vw] self-stretch overflow-x-hidden bg-transparent ${isMapPage ? 'h-full overflow-y-auto custom-scrollbar mobile-map-content' : ''}`}>
          <div className={isMapPage ? 'h-full w-full min-w-0 max-w-[100vw]' : 'mobile-page-content mobile-page-scroll'}>{children}</div>
        </div>
      </main>

      <nav className="mobile-bottom-nav" aria-label="Navegação principal">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isMoreTab = item.key === 'bottom-mais';
          const isPrimary = item.primary;

          if (isPrimary) {
            return (
              <div key={item.key} className="relative -top-5 flex flex-col items-center flex-1 z-10 px-1 shrink-0">
                <button
                  type="button"
                  className="w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/30 flex items-center justify-center transform transition-transform active:scale-95"
                  onClick={() => {
                    setShowMoreMenu(false);
                    item.onClick();
                  }}
                >
                  <Icon className="h-6 w-6" />
                </button>
                <span className="text-[10px] font-bold text-slate-700 mt-1 whitespace-nowrap">{item.label}</span>
              </div>
            );
          }

          return (
            <button
              key={item.key}
              type="button"
              className={`mobile-bottom-nav-item flex-1 min-w-0 ${item.active ? 'active' : ''}`}
              onClick={() => {
                if (isMoreTab) {
                  setShowMoreMenu((prev) => !prev);
                  return;
                }
                setShowMoreMenu(false);
                item.onClick();
              }}
            >
              <Icon className="h-5 w-5 mb-1" />
              <span className="truncate w-full px-1">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {showMoreMenu && (
        <>
          <button
            type="button"
            aria-label="Fechar menu Mais"
            className="mobile-more-backdrop"
            onClick={() => setShowMoreMenu(false)}
          />
          <section className="mobile-more-sheet" aria-label="Menu Mais">
            <div className="mobile-more-header sticky top-0 bg-white/95 backdrop-blur-sm z-10 pb-2 mb-2 border-b border-slate-100">
              <h3 className="mobile-more-title m-0 pt-2 pb-1 text-[13px] font-black uppercase tracking-wider text-slate-800">Mais Opções</h3>
            </div>
            
            <div className="mobile-more-content flex flex-col gap-6 pb-6">
              {moreMenuGroups.map((group) => {
                if (group.items.length === 0) return null;
                
                return (
                  <div key={group.key} className="mobile-more-group">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 pl-2">
                      {group.label}
                    </h4>
                    <div className="mobile-more-list flex flex-col gap-1.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            className={`mobile-more-item flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all font-semibold text-sm ${item.active ? 'bg-blue-50 text-blue-700' : 'bg-transparent text-slate-600 hover:bg-slate-50'}`}
                            onClick={() => {
                              setShowMoreMenu(false);
                              item.onClick();
                            }}
                          >
                            <Icon className={`h-5 w-5 ${item.active ? 'text-blue-600' : 'text-slate-400'}`} />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
