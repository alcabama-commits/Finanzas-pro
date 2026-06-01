import React, { useEffect, useRef, useState } from 'react';
import { Search, MapPin, Loader2, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// Dynamic Leaflet CSS and JS Loader
export function useLeaflet() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if ((window as any).L) {
      setLoaded(true);
      return;
    }

    // Check if script already exists to avoid duplicates
    let cssLink = document.getElementById('leaflet-css') as HTMLLinkElement;
    if (!cssLink) {
      cssLink = document.createElement('link');
      cssLink.rel = 'stylesheet';
      cssLink.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      cssLink.id = 'leaflet-css';
      document.head.appendChild(cssLink);
    }

    let jsScript = document.getElementById('leaflet-js') as HTMLScriptElement;
    if (!jsScript) {
      jsScript = document.createElement('script');
      jsScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      jsScript.id = 'leaflet-js';
      jsScript.onload = () => setLoaded(true);
      document.head.appendChild(jsScript);
    } else {
      // Script is loading or exists
      const checkInterval = setInterval(() => {
        if ((window as any).L) {
          setLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }
  }, []);

  return loaded;
}

interface StoreMapProps {
  mode: 'select' | 'view-all';
  initialLat?: number | null;
  initialLng?: number | null;
  initialAddress?: string | null;
  stores?: any[]; // For view-all mode
  onLocationSelect?: (lat: number, lng: number, address: string) => void;
  heightClass?: string;
}

export function StoreMap({
  mode,
  initialLat,
  initialLng,
  initialAddress,
  stores = [],
  onLocationSelect,
  heightClass = 'h-[300px]'
}: StoreMapProps) {
  const isLeafletLoaded = useLeaflet();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerInstanceRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(initialAddress || '');
  const [selectedCoords, setSelectedCoords] = useState<{lat: number, lng: number} | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );

  // Colombian coordinates center by default for Latin American groceries (Unicentro Bogota region)
  const DEFAULT_CENTER = { lat: 4.7015, lng: -74.0435 };

  // Sync initial inputs when editing
  useEffect(() => {
    if (initialLat && initialLng) {
      setSelectedCoords({ lat: initialLat, lng: initialLng });
      if (initialAddress) setSelectedAddress(initialAddress);
    }
  }, [initialLat, initialLng, initialAddress]);

  // Handle map initialization and tile config
  useEffect(() => {
    if (!isLeafletLoaded || !mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    // Remove existing map if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const centerLatObj = selectedCoords?.lat || DEFAULT_CENTER.lat;
    const centerLngObj = selectedCoords?.lng || DEFAULT_CENTER.lng;

    // Create Leaflet Map Instance
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([centerLatObj, centerLngObj], selectedCoords ? 15 : 12);

    mapInstanceRef.current = map;

    // Add high contrast light tiles for nice UI match
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Call invalidateSize after short timeout so map does not yield gray empty parts on quick flex updates
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    // Config markers group
    if (mode === 'view-all') {
      const markersGroup = L.featureGroup().addTo(map);
      markersGroupRef.current = markersGroup;

      if (stores && stores.length > 0) {
        stores.forEach(s => {
          if (!s.latitude || !s.longitude) return;

          // Create dynamic circular custom marker based on classification/type
          const initialLetter = s.name ? s.name.charAt(0).toUpperCase() : 'S';
          
          let typeLabel = 'Establecimiento';
          let pinBg = 'bg-indigo-600';
          if (s.type === 'provider') {
            typeLabel = 'Proveedor';
            pinBg = 'bg-amber-500';
          } else if (s.type === 'service') {
            typeLabel = 'Servicio';
            pinBg = 'bg-rose-500';
          } else if (s.type === 'consumption') {
            typeLabel = 'Consumo';
            pinBg = 'bg-emerald-500';
          }

          const popupHtml = `
            <div class="p-2 space-y-1 text-zinc-900 select-none min-w-[150px]">
              <div class="flex items-center gap-2 mb-1 border-b border-zinc-100 pb-1.5">
                ${s.logoUrl 
                  ? `<img src="${s.logoUrl}" class="w-6 h-6 rounded-full object-cover border border-zinc-200" referrerPolicy="no-referrer" />`
                  : `<div class="w-6 h-6 rounded-full ${pinBg} text-white flex items-center justify-center font-black text-[10px]">${initialLetter}</div>`
                }
                <div class="flex flex-col">
                  <strong class="font-bold text-xs leading-tight">${s.name}</strong>
                  <span class="text-[9px] font-semibold uppercase tracking-wider text-zinc-400 mt-0.5">${typeLabel}</span>
                </div>
              </div>
              <p class="text-[10px] text-zinc-500 flex items-start gap-1">
                <span class="text-zinc-400 font-bold">Dirección:</span>
                <span>${s.address || 'Ubicación registrada'}</span>
              </p>
              <div class="text-[9px] text-zinc-400 font-mono mt-1 pt-1 opacity-70">
                Lat: ${Number(s.latitude).toFixed(5)}, Lng: ${Number(s.longitude).toFixed(5)}
              </div>
            </div>
          `;

          const pinIcon = L.divIcon({
            html: `
              <div class="relative flex items-center justify-center w-8 h-8 rounded-full ${pinBg} text-white border-2 border-white shadow-lg font-bold text-xs hover:scale-110 transition-all">
                ${s.logoUrl 
                  ? `<img src="${s.logoUrl}" class="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />`
                  : `<span>${initialLetter}</span>`
                }
                <div class="absolute -bottom-1 h-2 w-2 ${pinBg} rotate-45 border-r border-b border-white"></div>
              </div>
            `,
            className: 'custom-pin-icon-wrap',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32]
          });

          L.marker([s.latitude, s.longitude], { icon: pinIcon })
            .addTo(markersGroup)
            .bindPopup(popupHtml, { closeButton: false });
        });

        // Fit map bounds to show all stores with padding
        try {
          const bounds = markersGroup.getBounds();
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [40, 40] });
          }
        } catch (e) {}
      }
    } else if (mode === 'select') {
      // Selection mode logic
      const setupSelectMarker = (coordsObj: {lat: number, lng: number}) => {
        // Clear previous selection marker
        if (markerInstanceRef.current) {
          map.removeLayer(markerInstanceRef.current);
        }

        const pinIcon = L.divIcon({
          html: `
            <div class="relative flex items-center justify-center w-10 h-10 rounded-full bg-rose-600 text-white border-2 border-white shadow-xl animate-bounce">
              <span class="text-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 4.418-8 12-8 12s-8-7.582-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></span>
              <div class="absolute -bottom-1 h-2.5 w-2.5 bg-rose-600 rotate-45 border-r border-b border-white"></div>
            </div>
          `,
          className: 'custom-pin-select-wrap',
          iconSize: [40, 40],
          iconAnchor: [20, 40]
        });

        const marker = L.marker([coordsObj.lat, coordsObj.lng], {
          icon: pinIcon,
          draggable: true
        }).addTo(map);

        markerInstanceRef.current = marker;

        // On drag callback
        marker.on('dragend', async () => {
          const position = marker.getLatLng();
          const newCoords = { lat: position.lat, lng: position.lng };
          setSelectedCoords(newCoords);
          triggerReverseGeocoding(newCoords.lat, newCoords.lng);
        });
      };

      // If initial coords exist, show the pin
      if (selectedCoords) {
        setupSelectMarker(selectedCoords);
      }

      // Single click on map to position pin
      map.on('click', (e: any) => {
        const newCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
        setSelectedCoords(newCoords);
        setupSelectMarker(newCoords);
        triggerReverseGeocoding(newCoords.lat, newCoords.lng);
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isLeafletLoaded, mode, stores]);

  // Handle flyTo when selectedCoords update externally or from search
  useEffect(() => {
    if (mapInstanceRef.current && selectedCoords && mode === 'select') {
      const L = (window as any).L;
      if (!L) return;

      mapInstanceRef.current.flyTo([selectedCoords.lat, selectedCoords.lng], 16, {
        animate: true,
        duration: 1.5
      });

      // Position pin
      if (!markerInstanceRef.current) {
        const pinIcon = L.divIcon({
          html: `
            <div class="relative flex items-center justify-center w-10 h-10 rounded-full bg-rose-600 text-white border-2 border-white shadow-xl animate-bounce">
              <span class="text-white"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin"><path d="M20 10c0 4.418-8 12-8 12s-8-7.582-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></span>
              <div class="absolute -bottom-1 h-2.5 w-2.5 bg-rose-600 rotate-45 border-r border-b border-white"></div>
            </div>
          `,
          className: 'custom-pin-select-wrap',
          iconSize: [40, 40],
          iconAnchor: [20, 40]
        });

        const marker = L.marker([selectedCoords.lat, selectedCoords.lng], {
          icon: pinIcon,
          draggable: true
        }).addTo(mapInstanceRef.current);

        markerInstanceRef.current = marker;

        marker.on('dragend', async () => {
          const pos = marker.getLatLng();
          const newCoords = { lat: pos.lat, lng: pos.lng };
          setSelectedCoords(newCoords);
          triggerReverseGeocoding(newCoords.lat, newCoords.lng);
        });
      } else {
        markerInstanceRef.current.setLatLng([selectedCoords.lat, selectedCoords.lng]);
      }
    }
  }, [selectedCoords]);

  // Geocoding: Search with text via Nominatim OpenStreetMap Free API
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
        const cleanName = result.display_name;

        setSelectedCoords({ lat: newLat, lng: newLng });
        setSelectedAddress(cleanName);
        setSearchQuery('');

        if (onLocationSelect) {
          onLocationSelect(newLat, newLng, cleanName);
        }
        toast.success('Ubicación localizada con éxito');
      } else {
        toast.error('No se pudo encontrar ninguna ubicación para esa descripción');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al realizar búsqueda de ubicación geográfica');
    } finally {
      setIsSearching(false);
    }
  };

  // Reverse Geocoding helper (convert lat, lng coordinates back into physical addresses manually)
  const triggerReverseGeocoding = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const result = await res.json();
      if (result && result.display_name) {
        const cleanName = result.display_name;
        setSelectedAddress(cleanName);
        if (onLocationSelect) {
          onLocationSelect(lat, lng, cleanName);
        }
      } else {
        const coordName = `Coordenadas: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setSelectedAddress(coordName);
        if (onLocationSelect) {
          onLocationSelect(lat, lng, coordName);
        }
      }
    } catch (err) {
      const coordName = `Coordenadas: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setSelectedAddress(coordName);
      if (onLocationSelect) {
        onLocationSelect(lat, lng, coordName);
      }
    }
  };

  // Geolocate user browser position
  const handleGeolocateMe = () => {
    if (!navigator.geolocation) {
      toast.error('Tu navegador no soporta geolocalización.');
      return;
    }

    toast.info('Obteniendo tu ubicación actual...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const currentCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setSelectedCoords(currentCoords);
        triggerReverseGeocoding(currentCoords.lat, currentCoords.lng);
        toast.success('Ubicación obtenida!');
      },
      (error) => {
        console.error(error);
        toast.error('No pudimos acceder a tu ubicación actual. Asegúrate de otorgar permisos.');
      }
    );
  };

  if (!isLeafletLoaded) {
    return (
      <div className={`w-full ${heightClass} bg-zinc-50 border border-zinc-200 rounded-lg flex flex-col items-center justify-center space-y-2`}>
        <Loader2 className="animate-spin size-6 text-indigo-600" />
        <span className="text-xs text-zinc-500 font-medium">Inicializando motor de mapas colaborativos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search Bar (Only shown in 'select' mode) */}
      {mode === 'select' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
              <Input
                type="text"
                placeholder="Buscar por dirección, ciudad o barrio (Ej: Unicentro Bogotá)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSearchAddress();
                  }
                }}
                className="pl-9 h-10 bg-white border-zinc-200"
              />
            </div>
            <Button
              type="button"
              disabled={isSearching}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSearchAddress();
              }}
              className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 text-xs font-semibold px-4 shrink-0 shadow-sm"
            >
              {isSearching ? <Loader2 className="animate-spin size-4" /> : <Search className="size-4" />}
              <span>Localizar</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleGeolocateMe}
              title="Centrar en mi ubicación actual"
              className="h-10 border-zinc-200 hover:bg-zinc-50 flex items-center justify-center p-2.5 shrink-0"
            >
              <Compass className="size-4 text-indigo-600" />
            </Button>
          </div>

          {/* Selected attributes info banner */}
          <div className="bg-zinc-50 border border-zinc-150 rounded-lg p-3 text-xs leading-relaxed flex items-start gap-2">
            <MapPin className="size-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-zinc-900">Ubicación Seleccionada *</div>
              <p className="text-zinc-600 text-[11px] leading-tight select-all">
                {selectedAddress || 'Haz clic o busca una dirección para ubicar la tienda en el mapa.'}
              </p>
              {selectedCoords && (
                <div className="text-[9px] font-mono text-zinc-400">
                  Latitud: <span className="text-zinc-700 font-semibold">{selectedCoords.lat.toFixed(6)}</span>, 
                  Longitud: <span className="text-zinc-700 font-semibold">{selectedCoords.lng.toFixed(6)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Map Interactive Canvas */}
      <div 
        ref={mapContainerRef} 
        className={`w-full ${heightClass} rounded-xl border border-zinc-200/80 shadow-inner overflow-hidden z-10`}
      />
    </div>
  );
}
