import { useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface FlyTarget {
  lat: number;
  lng: number;
  bbox?: [number, number, number, number];
}

interface LocationPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (loc: { lat: number; lng: number }) => void;
  flyToLocation?: FlyTarget | null;
}

function ClickHandler({ onChange }: { onChange: (loc: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function MapController({ target }: { target: FlyTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    if (target.bbox) {
      const [south, north, west, east] = target.bbox;
      map.flyToBounds([[south, west], [north, east]], { duration: 1.8, maxZoom: 18, padding: [40, 40] });
    } else {
      map.flyTo([target.lat, target.lng], 16, { duration: 1.8 });
    }
  }, [target, map]);
  return null;
}

const pinIcon = divIcon({
  className: '',
  html: `<div style="
    width:22px;height:22px;border-radius:50%;
    background:#4ade80;
    border:3px solid white;
    box-shadow:0 0 18px rgba(74,222,128,0.7), 0 2px 8px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export default function LocationPicker({ value, onChange, flyToLocation }: LocationPickerProps) {
  const handleChange = useCallback(onChange, [onChange]);

  return (
    <MapContainer
      center={[48.0196, 66.9237]}
      zoom={5}
      minZoom={3}
      maxBounds={[[-90, -180], [90, 180]]}
      maxBoundsViscosity={1.0}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        noWrap={true}
        bounds={[[-90, -180], [90, 180]]}
      />
      <ClickHandler onChange={handleChange} />
      <MapController target={flyToLocation ?? null} />
      {value && <Marker position={[value.lat, value.lng]} icon={pinIcon} />}
    </MapContainer>
  );
}
