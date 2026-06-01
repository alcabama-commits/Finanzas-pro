import React, { useEffect, useRef, useState } from 'react';
import { useLeaflet } from './StoreMap';
import { Compass, Loader2, MapPin, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface RadarStoreMapProps {
  stores?: any[];
  radarCenter: { lat: number; lng: number } | null;
  radarRadiusKm: number;
  onCenterSelect: (lat: number, lng: number, address: string) => void;
  onStoreMarkerClick?: (storeId: string) => void;
  heightClass?: string;
}

export function RadarStoreMap({
  stores = [],
  radarCenter,
  radarRadiusKm,
  onCenterSelect,
  onStoreMarkerClick,
  heightClass = 'h-[360px]'
}: RadarStoreMapProps) {
  const isLeafletLoaded = useLeaflet();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const circleInstanceRef = useRef<any>(null);
  const centerMarkerRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [addressLabel, setAddressLabel] = useState('');

  // Haversine distance helper
  const getDistanceInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Convert lat log coordinates back into text addresses
  const triggerReverseGeocoding = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const result = await res.json();
      if (result && result.display_name) {
        const cleanName = result.display_name;
        setAddressLabel(cleanName);
        onCenterSelect(lat, lng, cleanName);
      } else {
        const coordName = `Ubicación: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setAddressLabel(coordName);
        onCenterSelect(lat, lng, coordName);
      }
    } catch (err) {
      const coordName = `Ubicación: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setAddressLabel(coordName);
      onCenterSelect(lat, lng, coordName);
    }
  };

  const handleSearchAddress = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();

      if (data && data.length > 0) {
        const result = data[0];
        const newLat = parseFloat(result.lat);
        const newLng = parseFloat(result.lon);
        const displayName = result.display_name;

        setAddressLabel(displayName);
        setSearchQuery('');
        onCenterSelect(newLat, newLng, displayName);
        toast.success('Radar relocalizado con éxito');
      } else {
        toast.error('No se pudo encontrar ninguna ubicación para esa descripción');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al realizar búsqueda geográfica');
    } finally {
      setIsSearching(false);
    }
  };

  const handleGeolocateMe = () => {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta geolocalización.');
      return;
    }

    toast.info('Obteniendo tu ubicación actual para el radar...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const currentLat = position.coords.latitude;
        const currentLng = position.coords.longitude;
        triggerReverseGeocoding(currentLat, currentLng);
        toast.success('Punto de radar establecido en tu ubicación!');
      },
      (error) => {
        console.error(error);
        toast.error('No pudimos acceder a tu ubicación. Asegúrate de dar permisos de GPS.');
      }
    );
  };

  // Map and markers initialization loop
  useEffect(() => {
    if (!isLeafletLoaded || !mapContainerRef.current || !radarCenter) return;
    const L = (window as any).L;
    if (!L) return;

    // Destroy existing map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Init map
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([radarCenter.lat, radarCenter.lng], 14);

    mapInstanceRef.current = map;

    // Add high contrast light tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Map click relocates center
    map.on('click', (e: any) => {
      triggerReverseGeocoding(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 250);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isLeafletLoaded]);

  // Sync circular radius and center pin on radarCenter or radius Km updates
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !radarCenter) return;
    const L = (window as any).L;
    if (!L) return;

    // 1. Plot radar center red indicator
    if (centerMarkerRef.current) {
      map.removeLayer(centerMarkerRef.current);
    }

    const radarPinIcon = L.divIcon({
      html: `
        <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-rose-600 text-white border-2 border-white shadow-lg animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-crosshair"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>
        </div>
      `,
      className: 'radar-center-icon-wrap',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    centerMarkerRef.current = L.marker([radarCenter.lat, radarCenter.lng], { icon: radarPinIcon })
      .addTo(map)
      .bindTooltip('<p class="font-bold text-xs px-1 text-rose-600">Centro del Radar</p>', { direction: 'top' });

    // 2. Plot circular coverage area
    if (circleInstanceRef.current) {
      map.removeLayer(circleInstanceRef.current);
    }

    circleInstanceRef.current = L.circle([radarCenter.lat, radarCenter.lng], {
      radius: radarRadiusKm * 1000,
      color: '#4f46e5',
      weight: 1.5,
      fillColor: '#818cf8',
      fillOpacity: 0.14
    }).addTo(map);

    // Pan map to center smoothly
    map.panTo([radarCenter.lat, radarCenter.lng]);

    // 3. Render and update store pins (colored by perimeter inclusion)
    if (markersGroupRef.current) {
      map.removeLayer(markersGroupRef.current);
    }

    const markersGroup = L.featureGroup().addTo(map);
    markersGroupRef.current = markersGroup;

    if (stores && stores.length > 0) {
      stores.forEach(s => {
        if (!s.latitude || !s.longitude) return;

        // Check distance relative to perimeter
        const isInside = getDistanceInKm(radarCenter.lat, radarCenter.lng, s.latitude, s.longitude) <= radarRadiusKm;
        const initialLetter = s.name ? s.name.charAt(0).toUpperCase() : 'S';

        // Pin styling: emerald green if inside radius, desaturated light grey if outside
        const markerClass = isInside
          ? 'bg-emerald-600 border-2 border-white text-white shadow-xl hover:scale-110 scale-100'
          : 'bg-zinc-300 border-2 border-zinc-100 text-zinc-500 shadow-sm opacity-60 scale-90 hover:opacity-100';

        const storePinIcon = L.divIcon({
          html: `
            <div class="relative flex items-center justify-center w-8 h-8 rounded-full ${markerClass} font-extrabold text-xs transition-all duration-300">
              ${s.logoUrl 
                ? `<img src="${s.logoUrl}" class="w-full h-full rounded-full object-cover ${!isInside ? 'grayscale opacity-75' : ''}" referrerPolicy="no-referrer" />`
                : `<span>${initialLetter}</span>`
              }
              <div class="absolute -bottom-1 h-2 w-2 ${isInside ? 'bg-emerald-600' : 'bg-zinc-300'} rotate-45 border-r border-b ${isInside ? 'border-white' : 'border-zinc-100'}"></div>
            </div>
          `,
          className: `store-pin-wrap-${s.id}`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32]
        });

        const storeMarker = L.marker([s.latitude, s.longitude], { icon: storePinIcon })
          .addTo(markersGroup);

        const distStr = isInside 
          ? `<span class="text-xs text-emerald-600 font-bold bg-emerald-50 px-1 py-0.5 rounded">En cobertura (${getDistanceInKm(radarCenter.lat, radarCenter.lng, s.latitude, s.longitude).toFixed(2)} km)</span>`
          : `<span class="text-xs text-zinc-500 bg-zinc-100 px-1 py-0.5 rounded">Fuera del radar (${getDistanceInKm(radarCenter.lat, radarCenter.lng, s.latitude, s.longitude).toFixed(2)} km)</span>`;

        const popupHtml = `
          <div class="p-2 space-y-1 text-zinc-900 select-none min-w-[180px]">
            <div class="flex items-center gap-2 mb-1.5 border-b border-zinc-100 pb-1.5">
              ${s.logoUrl 
                ? `<img src="${s.logoUrl}" class="w-6 h-6 rounded-full object-cover border border-zinc-200 bg-white" referrerPolicy="no-referrer" />`
                : `<div class="w-6 h-6 rounded-full bg-zinc-700 text-white flex items-center justify-center font-black text-[10px]">${initialLetter}</div>`
              }
              <strong class="font-bold text-xs block">${s.name}</strong>
            </div>
            <p class="text-[10px] text-zinc-650 mb-1 leading-tight"><span class="font-bold">Dirección:</span> ${s.address || 'Ubicación registrada'}</p>
            <div class="pt-1 select-none">${distStr}</div>
          </div>
        `;

        storeMarker.bindPopup(popupHtml, { closeButton: false });

        if (onStoreMarkerClick) {
          storeMarker.on('click', () => {
            onStoreMarkerClick(s.id);
          });
        }
      });
    }

  }, [radarCenter, radarRadiusKm, stores]);

  if (!isLeafletLoaded) {
    return (
      <div className={`w-full ${heightClass} bg-zinc-50 border border-zinc-200 rounded-xl flex flex-col items-center justify-center space-y-2`}>
        <Loader2 className="animate-spin size-6 text-indigo-600" />
        <span className="text-xs text-zinc-500 font-semibold">Inicializando radar de establecimientos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Geolocation and target address relocator */}
      <form onSubmit={handleSearchAddress} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
          <Input
            type="text"
            placeholder="Relocalizar radar central por dirección, barrio o ciudad..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-white text-xs border-zinc-200 text-zinc-900 shadow-sm"
          />
        </div>
        
        <Button
          type="submit"
          disabled={isSearching}
          className="h-10 bg-zinc-900 hover:bg-zinc-805 text-white gap-1.5 text-xs font-bold px-4 shrink-0 shadow-sm"
        >
          {isSearching ? <Loader2 className="animate-spin size-4" /> : <Search className="size-4" />}
          <span>Buscar</span>
        </Button>
        
        <Button
          type="button"
          variant="outline"
          onClick={handleGeolocateMe}
          title="Fijar radar en mi ubicación GPS"
          className="h-10 border-zinc-200 hover:bg-zinc-50 flex items-center justify-center p-2.5 shrink-0"
        >
          <Compass className="size-4 text-indigo-650 animate-spin" style={{ animationDuration: '6s' }} />
        </Button>
      </form>

      {/* Actual map block */}
      <div 
        ref={mapContainerRef} 
        className={`w-full ${heightClass} rounded-xl border border-zinc-200 shadow-inner overflow-hidden z-20`}
      />
    </div>
  );
}
