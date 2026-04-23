import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    H: any;
  }
}

const HERE_API_KEY = import.meta.env.VITE_HERE_API_KEY;

export default function Roteirizacao() {
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    const H = window.H;

    if (!H) {
      setMapError("HERE SDK não carregado.");
      return;
    }

    if (!mapContainerRef.current) return;

    if (!HERE_API_KEY) {
      setMapError("API Key HERE não definida.");
      return;
    }

    try {
      const platform = new H.service.Platform({
        apikey: HERE_API_KEY
      });

      const layers = platform.createDefaultLayers({
        engineType: H.Map.EngineType.VECTOR
      });

      const baseLayer = layers.vector?.normal?.map;

      if (!baseLayer) {
        setMapError("Vector layer não disponível.");
        return;
      }

      const map = new H.Map(
        mapContainerRef.current,
        baseLayer,
        {
          center: { lat: 37.0891, lng: -8.2479 },
          zoom: 12,
          pixelRatio: window.devicePixelRatio || 1
        }
      );
setTimeout(() => {
  map.getViewPort().resize();
}, 300);
      
      new H.mapevents.Behavior(
        new H.mapevents.MapEvents(map)
      );

      H.ui.UI.createDefault(map, layers, "pt-PT");

      mapRef.current = map;

      window.addEventListener("resize", () => map.getViewPort().resize());

      setMapError(null);

    } catch (err) {
      console.error(err);
      setMapError("Erro ao inicializar o mapa HERE.");
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.dispose();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      {mapError && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#ffe6e6",
            color: "#cc0000",
            padding: "10px 20px",
            borderRadius: 8,
            zIndex: 10
          }}
        >
          {mapError}
        </div>
      )}

      <div
        ref={mapContainerRef}
        style={{
          height: "100%",
          width: "100%"
        }}
      />
    </div>
  );
}
