import React from 'react';

interface BottomNavItem {
  key: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
}

interface LayoutMobileProps {
  logoSrc: string;
  onLogoClick: () => void;
  userMenu: React.ReactNode;
  isMapPage: boolean;
  bottomNavItems: BottomNavItem[];
  moreMenuItems?: Array<{
    key: string;
    label: string;
    icon: React.ElementType;
    active: boolean;
    onClick: () => void;
  }>;
  children: React.ReactNode;
}

export default function LayoutMobile({
  logoSrc,
  onLogoClick,
  userMenu,
  isMapPage,
  bottomNavItems,
  moreMenuItems = [],
  children,
}: LayoutMobileProps) {
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);

  return (
    <div style={{ width: '100%', maxWidth: 'none', margin: 0 }} className="layout-mobile app-root w-full h-[100dvh] flex flex-col overflow-hidden bg-transparent text-slate-900 font-sans selection:bg-amber-500/20">
      <nav className="mobile-topbar">
        <button type="button" onClick={onLogoClick} className="mobile-topbar-logo" aria-label="Ir para dashboard">
          <img src={logoSrc} alt="Algartempo Frota" className="h-8 w-auto object-contain" />
        </button>
        {userMenu}
      </nav>

      <main style={{ width: '100%', maxWidth: 'none', margin: 0 }} className={`app-content-bg flex-1 min-h-0 ${isMapPage ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden mobile-main-content'}`}>
        <div style={{ width: '100%', maxWidth: 'none' }} className={`relative z-10 bg-transparent w-full overflow-x-hidden ${isMapPage ? 'h-full overflow-y-auto custom-scrollbar mobile-map-content' : ''}`}>
          <div style={{ width: '100%', maxWidth: 'none' }} className={isMapPage ? 'h-full w-full' : 'mobile-page-content mobile-page-scroll'}>{children}</div>
        </div>
      </main>

      <nav className="mobile-bottom-nav" aria-label="Navegação principal">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isMoreTab = item.key === 'bottom-mais';
          return (
            <button
              key={item.key}
              type="button"
              className={`mobile-bottom-nav-item ${item.active ? 'active' : ''}`}
              onClick={() => {
                if (isMoreTab) {
                  setShowMoreMenu((prev) => !prev);
                  return;
                }
                setShowMoreMenu(false);
                item.onClick();
              }}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
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
            <h3 className="mobile-more-title">Mais</h3>
            <div className="mobile-more-list">
              {moreMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`mobile-more-item ${item.active ? 'active' : ''}`}
                    onClick={() => {
                      setShowMoreMenu(false);
                      item.onClick();
                    }}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
