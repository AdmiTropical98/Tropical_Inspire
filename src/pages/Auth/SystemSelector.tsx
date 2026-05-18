import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BG_IMAGE = 'modulos.png';
const IMAGE_RATIO = 1671 / 941;

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const HOTSPOTS = [
  {
    key: 'frota',
    ariaLabel: 'Entrar em Frota',
    route: '/frota',
    left: 0.027,
    top: 0.292,
    width: 0.303,
    height: 0.549,
  },
  {
    key: 'inventario',
    ariaLabel: 'Entrar em Inventário',
    route: '/inventario',
    left: 0.341,
    top: 0.292,
    width: 0.303,
    height: 0.549,
  },
  {
    key: 'operacoes',
    ariaLabel: 'Entrar em Operações',
    route: '/operacoes',
    left: 0.654,
    top: 0.292,
    width: 0.32,
    height: 0.549,
  },
  {
    key: 'menu',
    ariaLabel: 'Abrir menu',
    route: '/frota',
    left: 0.797,
    top: 0.058,
    width: 0.175,
    height: 0.15,
  },
];

function useContainImageRect(imageAspectRatio: number): Rect {
  const [viewport, setViewport] = useState({ width: 1, height: 1 });

  useEffect(() => {
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };

    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return useMemo(() => {
    const vw = Math.max(viewport.width, 1);
    const vh = Math.max(viewport.height, 1);
    const viewportRatio = vw / vh;

    if (viewportRatio > imageAspectRatio) {
      const height = vh;
      const width = height * imageAspectRatio;
      return {
        left: (vw - width) / 2,
        top: 0,
        width,
        height,
      };
    }

    const width = vw;
    const height = width / imageAspectRatio;
    return {
      left: 0,
      top: (vh - height) / 2,
      width,
      height,
    };
  }, [imageAspectRatio, viewport.height, viewport.width]);
}

export default function SystemSelector() {
  const navigate = useNavigate();
  const imageRect = useContainImageRect(IMAGE_RATIO);

  useEffect(() => {
    const root = document.getElementById('root');
    const previousRootWidth = root?.style.width;
    const previousRootHeight = root?.style.height;
    const previousRootMargin = root?.style.margin;
    const previousRootOverflow = root?.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyMargin = document.body.style.margin;
    const previousBodyWidth = document.body.style.width;
    const previousBodyHeight = document.body.style.height;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousHtmlMargin = document.documentElement.style.margin;
    const previousHtmlWidth = document.documentElement.style.width;
    const previousHtmlHeight = document.documentElement.style.height;

    if (root) {
      root.style.width = '100%';
      root.style.height = '100%';
      root.style.margin = '0';
      root.style.overflow = 'hidden';
    }

    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';

    document.documentElement.style.width = '100%';
    document.documentElement.style.height = '100%';
    document.documentElement.style.margin = '0';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      if (root) {
        root.style.width = previousRootWidth || '';
        root.style.height = previousRootHeight || '';
        root.style.margin = previousRootMargin || '';
        root.style.overflow = previousRootOverflow || '';
      }

      document.body.style.width = previousBodyWidth;
      document.body.style.height = previousBodyHeight;
      document.body.style.margin = previousBodyMargin;
      document.body.style.overflow = previousBodyOverflow;

      document.documentElement.style.width = previousHtmlWidth;
      document.documentElement.style.height = previousHtmlHeight;
      document.documentElement.style.margin = previousHtmlMargin;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  return (
    <div
      className="dashboard"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        backgroundImage: `url('${BG_IMAGE}')`,
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'contain',
        backgroundColor: '#020b2d',
      }}
    >
      {HOTSPOTS.map((hotspot) => (
        <button
          key={hotspot.key}
          type="button"
          aria-label={hotspot.ariaLabel}
          onClick={() => navigate(hotspot.route)}
          style={{
            position: 'absolute',
            left: imageRect.left + imageRect.width * hotspot.left,
            top: imageRect.top + imageRect.height * hotspot.top,
            width: imageRect.width * hotspot.width,
            height: imageRect.height * hotspot.height,
            background: 'transparent',
            border: 'none',
            padding: 0,
            margin: 0,
            cursor: 'pointer',
            transition: 'transform 150ms ease',
            transform: 'scale(1)',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.transform = 'scale(1.01)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.transform = 'scale(1)';
          }}
        />
      ))}
    </div>
  );
}
