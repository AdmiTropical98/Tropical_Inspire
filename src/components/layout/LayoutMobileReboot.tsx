import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';

interface BottomNavItem {
  key: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
}

interface LayoutMobileRebootProps {
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

export default function LayoutMobileReboot({
  logoSrc,
  onLogoClick,
  userMenu,
  isMapPage,
  bottomNavItems,
  moreMenuItems = [],
  children,
}: LayoutMobileRebootProps) {
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const activeItem = bottomNavItems.find((item) => item.active);
  const activeTitle = activeItem?.label || 'Painel';

  const fireHaptic = React.useCallback(() => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(8);
    }
  }, []);

  React.useEffect(() => {
    let removeListener: (() => void) | undefined;

    const registerBackButton = async () => {
      try {
        const handle = await CapacitorApp.addListener('backButton', ({ canGoBack }) => {
          if (showMoreMenu) {
            setShowMoreMenu(false);
            return;
          }

          const isOnDashboard = location.pathname === '/dashboard' || location.pathname === '/';
          if (!isOnDashboard && canGoBack) {
            window.history.back();
            return;
          }

          if (!isOnDashboard) {
            navigate('/dashboard');
            return;
          }

          CapacitorApp.minimizeApp().catch(() => CapacitorApp.exitApp());
        });

        removeListener = () => {
          void handle.remove();
        };
      } catch {
        // Ignore plugin registration failures on non-supported runtimes.
      }
    };

    void registerBackButton();

    return () => {
      removeListener?.();
    };
  }, [location.pathname, navigate, showMoreMenu]);

  const runTapAction = React.useCallback((action: () => void) => {
    fireHaptic();
    action();
  }, [fireHaptic]);

  return (
    <div className="mobile-reboot-shell">
      <div className="mobile-reboot-background" aria-hidden="true" />

      <header className="mobile-reboot-header">
        <button
          type="button"
          className="mobile-reboot-logo"
          onClick={() => runTapAction(onLogoClick)}
          aria-label="Ir para dashboard"
        >
          <span className="mobile-reboot-logo-badge">
            <img src={logoSrc} alt="Algartempo Frota" />
          </span>
          <span className="mobile-reboot-logo-text">
            <strong>Algartempo</strong>
            <small>Frota</small>
          </span>
        </button>

        <div className="mobile-reboot-title-wrap">
          <p className="mobile-reboot-kicker">Operacao Android</p>
          <h1 className="mobile-reboot-title">{activeTitle}</h1>
        </div>

        <div className="mobile-reboot-user">{userMenu}</div>
      </header>

      <section className="mobile-reboot-quick-actions" aria-label="Acessos rapidos">
        {moreMenuItems.slice(0, 3).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={`quick-${item.key}`}
              type="button"
              className={`mobile-reboot-chip ${item.active ? 'active' : ''}`}
              onClick={() => runTapAction(item.onClick)}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </section>

      <main className={`mobile-reboot-main ${isMapPage ? 'map-mode' : ''}`}>
        <div className={`mobile-reboot-content ${isMapPage ? 'map-content' : ''}`}>
          <div key={`${location.pathname}${location.search}`} className="mobile-reboot-route-frame">
            {children}
          </div>
        </div>
      </main>

      <nav className="mobile-reboot-dock" aria-label="Navegacao principal">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isMoreTab = item.key === 'bottom-mais';

          return (
            <button
              key={item.key}
              type="button"
              className={`mobile-reboot-dock-item ${item.active ? 'active' : ''}`}
              onClick={() => {
                if (isMoreTab) {
                  fireHaptic();
                  setShowMoreMenu((prev) => !prev);
                  return;
                }

                setShowMoreMenu(false);
                runTapAction(item.onClick);
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
            className="mobile-reboot-sheet-backdrop"
            onClick={() => runTapAction(() => setShowMoreMenu(false))}
          />

          <section className="mobile-reboot-sheet" aria-label="Menu Mais">
            <div className="mobile-reboot-sheet-handle" aria-hidden="true" />
            <h2 className="mobile-reboot-sheet-title">Acesso rapido</h2>
            <div className="mobile-reboot-sheet-list">
              {moreMenuItems.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`mobile-reboot-sheet-item ${item.active ? 'active' : ''}`}
                    onClick={() => {
                      setShowMoreMenu(false);
                      runTapAction(item.onClick);
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