'use client';

import { useEffect, useId, useRef, useState } from 'react';

export type MapLocationValue = {
  latitude: number;
  longitude: number;
  city?: string;
  province?: string;
  line1?: string;
  label?: string;
};

type Props = {
  value?: MapLocationValue | null;
  onChange: (v: MapLocationValue) => void;
  height?: number;
  /** Default center (Tehran) */
  defaultCenter?: { lat: number; lng: number };
  copy?: Record<string, string>;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window {
    L?: any;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let leafletPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('link[data-leaflet]');
    if (!existing) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.setAttribute('data-leaflet', '1');
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      if (window.L) resolve(window.L);
      else reject(new Error('Leaflet failed'));
    };
    script.onerror = () => reject(new Error('Leaflet load error'));
    document.body.appendChild(script);
  });
  return leafletPromise;
}

async function reverseGeocode(lat: number, lng: number): Promise<Partial<MapLocationValue>> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=fa`,
      { headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return {};
    const data = (await res.json()) as {
      display_name?: string;
      address?: {
        city?: string;
        town?: string;
        village?: string;
        county?: string;
        state?: string;
        suburb?: string;
        neighbourhood?: string;
        road?: string;
      };
    };
    const a = data.address || {};
    const city = a.city || a.town || a.village || a.county || '';
    const province = a.state || '';
    const line1 = [a.road, a.neighbourhood || a.suburb].filter(Boolean).join('، ');
    const label = [city, a.neighbourhood || a.suburb || line1].filter(Boolean).join('، ') || data.display_name;
    return { city, province, line1, label };
  } catch {
    return {};
  }
}

/**
 * Click-to-pin map for seller location (OpenStreetMap + Leaflet CDN).
 */
export function LocationMapPicker({
  value,
  onChange,
  height = 260,
  defaultCenter = { lat: 35.6892, lng: 51.389 },
  copy,
}: Props) {
  const mapId = useId().replace(/:/g, '');
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<{ map: any; marker: any } | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapRef.current) return;
        if (mapObj.current) return;

        const center = value
          ? { lat: value.latitude, lng: value.longitude }
          : defaultCenter;
        const map = L.map(mapRef.current, { zoomControl: true }).setView([center.lat, center.lng], value ? 15 : 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(map);

        const marker = L.marker([center.lat, center.lng], { draggable: true }).addTo(map);

        async function commit(lat: number, lng: number) {
          marker.setLatLng([lat, lng]);
          const geo = await reverseGeocode(lat, lng);
          onChange({
            latitude: lat,
            longitude: lng,
            city: geo.city || value?.city,
            province: geo.province || value?.province,
            line1: geo.line1 || value?.line1,
            label: geo.label || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          });
        }

        map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
          void commit(e.latlng.lat, e.latlng.lng);
        });
        marker.on('dragend', () => {
          const p = marker.getLatLng();
          void commit(p.lat, p.lng);
        });

        mapObj.current = { map, marker };
        setReady(true);
        setTimeout(() => map.invalidateSize(), 80);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'map_error');
      }
    })();
    return () => {
      cancelled = true;
      if (mapObj.current) {
        mapObj.current.map.remove();
        mapObj.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapObj.current || !value) return;
    const { map, marker } = mapObj.current;
    marker.setLatLng([value.latitude, value.longitude]);
    map.panTo([value.latitude, value.longitude]);
  }, [value?.latitude, value?.longitude]);

  function useMyLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (mapObj.current) {
          mapObj.current.marker.setLatLng([lat, lng]);
          mapObj.current.map.setView([lat, lng], 15);
        }
        void reverseGeocode(lat, lng).then((geo) => {
          onChange({
            latitude: lat,
            longitude: lng,
            city: geo.city,
            province: geo.province,
            line1: geo.line1,
            label: geo.label,
          });
        });
      },
      () => setErr(copy?.map_geo_denied || 'دسترسی به موقعیت داده نشد'),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  return (
    <div className="pk-map">
      <div className="pk-map__toolbar">
        <button type="button" className="pk-map__locate" onClick={useMyLocation}>
          {copy?.map_my_location || 'موقعیت فعلی من'}
        </button>
        <span className="pk-map__hint">{copy?.map_tap_hint || 'روی نقشه بزنید یا سنجاق را بکشید'}</span>
      </div>
      <div
        id={mapId}
        ref={mapRef}
        className="pk-map__canvas"
        style={{ height }}
        role="application"
        aria-label={copy?.map_label || 'نقشه'}
      />
      {value?.label ? <p className="pk-map__selected">{value.label}</p> : null}
      {!ready && !err ? <p className="pk-map__loading">{copy?.map_loading || 'در حال بارگذاری نقشه…'}</p> : null}
      {err ? <p className="panel-err">{err}</p> : null}
    </div>
  );
}
