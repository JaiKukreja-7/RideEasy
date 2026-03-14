import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface DriverLocation {
  id: string;
  lat: number;
  lng: number;
  is_busy?: boolean;
}

interface MapProps {
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  drivers?: DriverLocation[];
  route?: [number, number][]; // [[lng, lat]]
  pickup?: [number, number];
  destination?: [number, number];
  height?: string;
  onMapClick?: (lng: number, lat: number) => void;
}

const MapLibreMap: React.FC<MapProps> = ({
  center = [72.8777, 19.0760],
  zoom = 14,
  drivers = [],
  route,
  pickup,
  destination,
  height = "400px",
  onMapClick
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const driverMarkers = useRef<Map<string, maplibregl.Marker>>(new Map());

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: center,
      zoom: zoom,
    });

    map.current.on('load', () => {
      map.current?.resize();
    });

    // Fallback resize
    setTimeout(() => {
        map.current?.resize();
    }, 500);

    map.current.on('click', (e) => {
      if (onMapClick) onMapClick(e.lngLat.lng, e.lngLat.lat);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update center
  useEffect(() => {
    if (map.current) {
      map.current.setCenter(center);
      map.current.resize();
    }
  }, [center]);

  // Update drivers
  useEffect(() => {
    if (!map.current) return;

    // Remove drivers that are gone
    const currentIds = new Set(drivers.map(d => d.id));
    driverMarkers.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        driverMarkers.current.delete(id);
      }
    });

    // Add or update drivers
    drivers.forEach(driver => {
      const existing = driverMarkers.current.get(driver.id);
      if (existing) {
        existing.setLngLat([driver.lng, driver.lat]);
      } else {
        const el = document.createElement('div');
        el.className = 'driver-marker';
        el.innerHTML = driver.is_busy ? '🚕' : '🚕';
        el.style.fontSize = '24px';
        el.style.transition = 'all 0.5s ease-out';
        el.style.filter = driver.is_busy ? 'grayscale(100%)' : 'none';

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([driver.lng, driver.lat])
          .addTo(map.current!);
        driverMarkers.current.set(driver.id, marker);
      }
    });
  }, [drivers]);

  // Update Route
  useEffect(() => {
    if (!map.current || !route) return;

    const sourceId = 'route-source';
    const layerId = 'route-layer';

    const geojson: any = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: route
      }
    };

    const drawRoute = () => {
      if (!map.current) return;
      if (!map.current.isStyleLoaded()) {
        map.current.once('style.load', drawRoute);
        return;
      }

      const source = map.current.getSource(sourceId);
      if (source && 'setData' in source) {
        (source as any).setData(geojson);
      } else {
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: geojson
        });

        map.current.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#facc15',
            'line-width': 6
          }
        });
      }
    };

    drawRoute();
  }, [route]);

  // Pickup and Destination Markers
  useEffect(() => {
    if (!map.current) return;
    
    // Clear existing special markers
    markers.current.forEach(m => m.remove());
    markers.current = [];

    if (pickup) {
        const el = document.createElement('div');
        el.innerHTML = '<div class="w-4 h-4 bg-primary rounded-full ring-4 ring-primary/20"></div>';
        const m = new maplibregl.Marker({ element: el }).setLngLat(pickup).addTo(map.current);
        markers.current.push(m);
    }

    if (destination) {
        const el = document.createElement('div');
        el.innerHTML = '📍';
        el.style.fontSize = '24px';
        const m = new maplibregl.Marker({ element: el }).setLngLat(destination).addTo(map.current);
        markers.current.push(m);
    }

  }, [pickup, destination]);

  return (
    <div ref={mapContainer} style={{ width: '100%', height, overflow: 'hidden' }} />
  );
};

export default MapLibreMap;
