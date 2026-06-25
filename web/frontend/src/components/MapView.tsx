'use client';
import { useEffect, useRef } from 'react';

interface GPSRecord {
  lat: number;
  lng: number;
  speed?: number;
  recorded_at?: string;
}

interface MapViewProps {
  position?: { lat: number; lng: number };
  history?: GPSRecord[];
  height?: string;
}

export default function MapView({ position, history = [], height = '400px' }: MapViewProps) {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    import('leaflet').then((L) => {
      // Fix leaflet icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (!mapInstanceRef.current && mapRef.current) {
        const center: [number, number] = position
          ? [position.lat, position.lng]
          : [-6.2088, 106.8456]; // Jakarta default

        mapInstanceRef.current = L.map(mapRef.current).setView(center, 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
        }).addTo(mapInstanceRef.current);
      }

      const map = mapInstanceRef.current;

      // Update marker
      if (position) {
        if (markerRef.current) {
          markerRef.current.setLatLng([position.lat, position.lng]);
        } else {
          markerRef.current = L.marker([position.lat, position.lng])
            .addTo(map)
            .bindPopup(`<b>MRF700</b><br/>Lat: ${position.lat}<br/>Lng: ${position.lng}`);
        }
        map.setView([position.lat, position.lng], map.getZoom());
      }

      // Draw history polyline
      if (history.length > 1) {
        const latlngs: [number, number][] = history
          .filter(g => g.lat && g.lng)
          .map(g => [g.lat, g.lng]);

        if (polylineRef.current) {
          polylineRef.current.remove();
        }
        polylineRef.current = L.polyline(latlngs, {
          color: '#3b82f6',
          weight: 3,
          opacity: 0.7,
        }).addTo(map);
      }
    });
  }, [position, history]);

  return (
    <div
      ref={mapRef}
      style={{ height, width: '100%', borderRadius: '8px', overflow: 'hidden' }}
    />
  );
}
