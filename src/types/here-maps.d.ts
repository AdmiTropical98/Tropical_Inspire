// HERE Maps JavaScript API v3 — global type declarations
// Extend Vite ImportMetaEnv with HERE Maps API key
interface ImportMetaEnv {
  readonly VITE_HERE_API_KEY: string;
  readonly HERE_API_KEY?: string;
}

declare namespace H {
  namespace service {
    class Platform {
      constructor(options: { apikey: string });
      createDefaultLayers(options?: Record<string, unknown>): any;
      getRoutingService(opt: null, version: number): any;
      getSearchService(): any;
    }
  }

  class Map {
    constructor(element: HTMLElement, layer: any, options?: { zoom?: number; center?: { lat: number; lng: number }; pixelRatio?: number });
    setCenter(pos: { lat: number; lng: number }, animate?: boolean): void;
    setZoom(zoom: number, animate?: boolean): void;
    getViewPort(): { resize(): void };
    addObject(obj: any): void;
    removeObject(obj: any): void;
    addLayer(layer: any): void;
    removeLayer(layer: any): void;
    dispose(): void;
    getObjects(recursive?: boolean): any[];
    setLookAtData(data: { bounds?: geo.Rect; position?: { lat: number; lng: number }; zoom?: number }, animate?: boolean): void;
    addEventListener(event: string, handler: (evt: any) => void): void;
    removeEventListener(event: string, handler: (evt: any) => void): void;
    screenToGeo(x: number, y: number): { lat: number; lng: number };
  }

  namespace map {
    class Marker {
      constructor(pos: { lat: number; lng: number }, options?: any);
      setGeometry(pos: { lat: number; lng: number }): void;
      getGeometry(): { lat: number; lng: number };
      getData(): any;
      addEventListener(evt: string, handler: (e: any) => void): void;
    }
    class DomIcon {
      constructor(element: HTMLElement, options?: any);
    }
    class DomMarker {
      constructor(pos: { lat: number; lng: number }, options?: any);
      setGeometry(pos: { lat: number; lng: number }): void;
      getData(): any;
      addEventListener(evt: string, handler: (e: any) => void): void;
    }
    class Icon {
      constructor(url: string, options?: any);
    }
    class Polyline {
      constructor(lineString: geo.LineString, options?: any);
      setGeometry(ls: geo.LineString): void;
    }
    class Polygon {
      constructor(lineString: geo.LineString, options?: any);
    }
    class Circle {
      constructor(center: { lat: number; lng: number }, radius: number, options?: any);
    }
    class Group {
      constructor(options?: any);
      addObject(obj: any): void;
      removeObject(obj: any): void;
      addObjects(objs: any[]): void;
      removeObjects(objs: any[]): void;
      getObjects(recursive?: boolean): any[];
      getBoundingBox(): geo.Rect | null;
      dispose(): void;
      addEventListener(evt: string, handler: (e: any) => void): void;
    }
    namespace layer {
      class ObjectLayer {
        constructor(provider: any, options?: any);
      }
    }
  }

  namespace geo {
    class LineString {
      constructor();
      pushPoint(point: { lat: number; lng: number }): void;
      pushLatLngAlt(lat: number, lng: number, alt: number): void;
      getPointCount(): number;
      extractPoint(idx: number): { lat: number; lng: number; alt: number };
      static fromFlexPolyline(encoded: string): LineString;
    }
    class Rect {
      constructor(top: number, left: number, bottom: number, right: number);
      getTop(): number;
      getLeft(): number;
      getBottom(): number;
      getRight(): number;
    }
  }

  namespace mapevents {
    class MapEvents {
      constructor(map: Map);
    }
    class Behavior {
      constructor(mapEvents: MapEvents, options?: any);
    }
  }

  namespace ui {
    class UI {
      static createDefault(map: Map, layers: any, locale?: string): UI;
      addBubble(bubble: InfoBubble): void;
      removeBubble(bubble: InfoBubble): void;
    }
    class InfoBubble {
      constructor(pos: { lat: number; lng: number }, options?: { content: string });
      close(): void;
    }
  }

  namespace clustering {
    class DataPoint {
      constructor(lat: number, lng: number, weight?: number | null, data?: any);
    }
    class Provider {
      constructor(dataPoints: DataPoint[], options?: any);
      setDataPoints(pts: DataPoint[]): void;
    }
  }
}

interface Window {
  H: typeof H;
}
