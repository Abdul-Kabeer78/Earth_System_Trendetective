/// <reference types="google.maps" />
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AdvancedMarker,
  APIProvider,
  Map as GoogleMapView,
  MapMouseEvent,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  CloudRain,
  Compass,
  Droplets,
  Flame,
  History,
  Layers,
  LocateFixed,
  RefreshCw,
  Satellite,
  Search,
  Sparkles,
  Thermometer,
  Trees,
  Waves,
  Wind,
  X,
} from 'lucide-react';
import { useEarth } from '../contexts/EarthContext.tsx';
import type { MapLayerId } from '../types/earth.ts';

interface LayerMeta {
  id: MapLayerId;
  label: string;
  shortLabel: string;
  source: string;
  gibsLayer?: string;
  gibsFormat?: 'jpg' | 'png';
  gibsMaxZoom?: number;
  legendMin: string;
  legendMid: string;
  legendMax: string;
  legendGradient: string;
  description: string;
}

export const MAP_LAYERS: LayerMeta[] = [
  {
    id: 'live-weather',
    label: 'Live Weather Layer',
    shortLabel: 'Live Weather',
    source: 'Open-Meteo Surface Stations',
    legendMin: '-15 °C',
    legendMid: '+18 °C',
    legendMax: '+42 °C',
    legendGradient: 'linear-gradient(90deg, #38bdf8, #10b981, #f59e0b, #ef4444)',
    description: 'Real-time surface temperature, wind speed, and synoptic conditions across global observatories.',
  },
  {
    id: 'temperature-heatmap',
    label: 'Temperature Heatmap',
    shortLabel: 'Temp Anomaly',
    source: 'NASA GIBS MODIS LST + Open-Meteo',
    gibsLayer: 'MODIS_Terra_Land_Surface_Temp_Day',
    gibsFormat: 'png',
    gibsMaxZoom: 7,
    legendMin: '-3.0 °C',
    legendMid: '0.0 °C',
    legendMax: '+6.0 °C',
    legendGradient: 'linear-gradient(90deg, #0ea5e9, #94a3b8, #f59e0b, #dc2626)',
    description: 'Daytime Land Surface Temperature satellite radiance paired with station anomalies against climatology.',
  },
  {
    id: 'rainfall',
    label: 'Rainfall and Precipitation',
    shortLabel: 'Precipitation',
    source: 'NASA GPM IMERG + Open-Meteo',
    gibsLayer: 'IMERG_Precipitation_Rate',
    gibsFormat: 'png',
    gibsMaxZoom: 6,
    legendMin: '0 mm/h',
    legendMid: '10 mm/h',
    legendMax: '50+ mm/h',
    legendGradient: 'linear-gradient(90deg, #1e293b, #06b6d4, #2563eb, #a855f7)',
    description: 'Global satellite precipitation rate (GPM IMERG) combined with real-time station rainfall gauges.',
  },
  {
    id: 'wildfire',
    label: 'Wildfire Detection',
    shortLabel: 'Wildfires',
    source: 'NASA EONET v3 + MODIS Thermal',
    gibsLayer: 'MODIS_Terra_Thermal_Anomalies_Day',
    gibsFormat: 'png',
    gibsMaxZoom: 8,
    legendMin: 'Low FWI',
    legendMid: 'Moderate',
    legendMax: 'Active Fire',
    legendGradient: 'linear-gradient(90deg, #10b981, #f59e0b, #ea580c, #dc2626)',
    description: 'Active wildfire perimeters from NASA EONET, MODIS thermal anomalies, and Fire Weather Risk index.',
  },
  {
    id: 'flood',
    label: 'Flood Monitoring',
    shortLabel: 'Floods',
    source: 'NASA EONET + GPM IMERG',
    gibsLayer: 'IMERG_Precipitation_Rate',
    gibsFormat: 'png',
    gibsMaxZoom: 6,
    legendMin: 'Low Runoff',
    legendMid: 'Elevated',
    legendMax: 'Active Flood',
    legendGradient: 'linear-gradient(90deg, #334155, #0284c7, #06b6d4, #f43f5e)',
    description: 'Active NASA EONET flood events coupled with heavy precipitation surge indicators.',
  },
  {
    id: 'storm',
    label: 'Storm Tracking',
    shortLabel: 'Storms',
    source: 'NASA EONET Severe Storms + Wind',
    legendMin: '< 20 km/h',
    legendMid: '45 km/h',
    legendMax: 'Severe Cyclone',
    legendGradient: 'linear-gradient(90deg, #475569, #38bdf8, #818cf8, #f43f5e)',
    description: 'Tracked tropical cyclones, extratropical systems, and high-wind atmospheric corridors.',
  },
  {
    id: 'air-quality',
    label: 'Air Quality and Pollution',
    shortLabel: 'Air Quality',
    source: 'Copernicus CAMS + MODIS Aerosol',
    gibsLayer: 'MODIS_Terra_Aerosol',
    gibsFormat: 'png',
    gibsMaxZoom: 6,
    legendMin: 'AQI 0–50',
    legendMid: 'AQI 100',
    legendMax: 'AQI 200+',
    legendGradient: 'linear-gradient(90deg, #10b981, #eab308, #f97316, #dc2626)',
    description: 'Satellite Aerosol Optical Depth (AOD) and live Copernicus CAMS US AQI / PM2.5 stations.',
  },
  {
    id: 'deforestation',
    label: 'Deforestation Monitoring',
    shortLabel: 'Forest Cover',
    source: 'NASA MODIS Vegetation + Basin Probes',
    gibsLayer: 'MODIS_Terra_NDVI_8Day',
    gibsFormat: 'png',
    gibsMaxZoom: 8,
    legendMin: 'Sparse / Cleared',
    legendMid: 'Moderate Canopy',
    legendMax: 'Dense Forest',
    legendGradient: 'linear-gradient(90deg, #78350f, #ca8a04, #22c55e, #065f46)',
    description: '8-day MODIS Terra NDVI canopy density overlay highlighting Amazon, Congo, and Boreal forest basins.',
  },
  {
    id: 'ocean-temperature',
    label: 'Ocean Temperature',
    shortLabel: 'Ocean SST',
    source: 'NASA GHRSST + Open-Meteo Marine',
    gibsLayer: 'GHRSST_L4_MUR_Sea_Surface_Temperature',
    gibsFormat: 'png',
    gibsMaxZoom: 7,
    legendMin: '0 °C',
    legendMid: '16 °C',
    legendMax: '32 °C',
    legendGradient: 'linear-gradient(90deg, #1e3a8a, #06b6d4, #f59e0b, #dc2626)',
    description: 'Multi-scale Ultra-high Resolution (MUR) Sea Surface Temperature and live marine buoy wave telemetry.',
  },
  {
    id: 'vegetation-health',
    label: 'Vegetation Health',
    shortLabel: 'Vegetation NDVI',
    source: 'NASA MODIS Terra NDVI',
    gibsLayer: 'MODIS_Terra_NDVI_8Day',
    gibsFormat: 'png',
    gibsMaxZoom: 8,
    legendMin: '0.0 (Barren)',
    legendMid: '0.45 (Grass)',
    legendMax: '0.9 (Dense)',
    legendGradient: 'linear-gradient(90deg, #a16207, #84cc16, #16a34a, #064e3b)',
    description: 'Normalized Difference Vegetation Index (NDVI) measuring photosynthetic canopy vigor across terrestrial biomes.',
  },
  {
    id: 'drought',
    label: 'Drought Monitoring',
    shortLabel: 'Drought',
    source: 'NASA EONET + MODIS Land Temp',
    gibsLayer: 'MODIS_Terra_Land_Surface_Temp_Day',
    gibsFormat: 'png',
    gibsMaxZoom: 7,
    legendMin: 'Moist',
    legendMid: 'Dry Stress',
    legendMax: 'Severe Deficit',
    legendGradient: 'linear-gradient(90deg, #0ea5e9, #eab308, #ea580c, #991b1b)',
    description: 'Dry-stress corridors combining NASA EONET drought/dust events, surface heat, and low humidity.',
  },
  {
    id: 'satellite-imagery',
    label: 'Satellite Imagery',
    shortLabel: 'TrueColor Orbit',
    source: 'NASA EOSDIS MODIS Terra',
    gibsLayer: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    gibsFormat: 'jpg',
    gibsMaxZoom: 9,
    legendMin: '250m Orbital',
    legendMid: 'TrueColor',
    legendMax: 'Daily Swath',
    legendGradient: 'linear-gradient(90deg, #0f172a, #0284c7, #10b981, #e2e8f0)',
    description: 'Direct daily true-color orbital photograph mosaic from NASA Terra MODIS instrument.',
  },
];

function getLayerIcon(id: MapLayerId) {
  switch (id) {
    case 'live-weather':
      return <Compass className="w-3.5 h-3.5" />;
    case 'temperature-heatmap':
      return <Thermometer className="w-3.5 h-3.5" />;
    case 'rainfall':
      return <CloudRain className="w-3.5 h-3.5" />;
    case 'wildfire':
      return <Flame className="w-3.5 h-3.5" />;
    case 'flood':
      return <Droplets className="w-3.5 h-3.5" />;
    case 'storm':
      return <Wind className="w-3.5 h-3.5" />;
    case 'air-quality':
      return <Sparkles className="w-3.5 h-3.5" />;
    case 'deforestation':
    case 'vegetation-health':
      return <Trees className="w-3.5 h-3.5" />;
    case 'ocean-temperature':
      return <Waves className="w-3.5 h-3.5" />;
    case 'drought':
      return <Thermometer className="w-3.5 h-3.5" />;
    case 'satellite-imagery':
      return <Satellite className="w-3.5 h-3.5" />;
  }
}

function colorForTemp(temp: number): string {
  if (temp >= 35) return '#ef4444';
  if (temp >= 26) return '#f59e0b';
  if (temp >= 14) return '#10b981';
  return '#38bdf8';
}

function colorForAqi(aqi: number | null): string {
  if (aqi === null) return '#64748b';
  if (aqi >= 151) return '#ef4444';
  if (aqi >= 101) return '#f59e0b';
  if (aqi >= 51) return '#eab308';
  return '#10b981';
}

const MapController: React.FC<{
  activeLayer: LayerMeta;
  gibsDate: string;
  gibsOpacity: number;
  baseMapType: 'hybrid' | 'satellite' | 'terrain';
  userPos: { lat: number; lng: number } | null;
}> = ({ activeLayer, gibsDate, gibsOpacity, baseMapType, userPos }) => {
  const map = useMap();
  const { mapCameraTarget } = useEarth();

  // Sync base mapTypeId (satellite / hybrid / terrain)
  useEffect(() => {
    if (!map) return;
    map.setMapTypeId(baseMapType);
  }, [map, baseMapType]);

  // Sync flyTo camera target
  useEffect(() => {
    if (!map || !mapCameraTarget) return;
    map.panTo({ lat: mapCameraTarget.lat, lng: mapCameraTarget.lng });
    if (mapCameraTarget.zoom) {
      map.setZoom(mapCameraTarget.zoom);
    }
  }, [map, mapCameraTarget]);

  // Center on browser geolocation once acquired
  useEffect(() => {
    if (!map || !userPos) return;
    map.panTo(userPos);
    map.setZoom(6);
  }, [map, userPos]);

  // Manage NASA GIBS WMTS ImageMapType overlay
  useEffect(() => {
    if (!map) return;
    map.overlayMapTypes.clear();

    if (!activeLayer.gibsLayer) return;

    const layerId = activeLayer.gibsLayer;
    const ext = activeLayer.gibsFormat ?? 'png';
    const maxZ = activeLayer.gibsMaxZoom ?? 8;
    const matrixSet = `GoogleMapsCompatible_Level${maxZ}`;

    const tileLayer = new google.maps.ImageMapType({
      getTileUrl: (coord: google.maps.Point, zoom: number) => {
        if (zoom < 1 || zoom > maxZ) return '';
        const maxTile = 1 << zoom;
        const x = ((coord.x % maxTile) + maxTile) % maxTile;
        const y = coord.y;
        if (y < 0 || y >= maxTile) return '';
        return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layerId}/default/${gibsDate}/${matrixSet}/${zoom}/${y}/${x}.${ext}`;
      },
      tileSize: new google.maps.Size(256, 256),
      maxZoom: maxZ,
      minZoom: 1,
      opacity: gibsOpacity,
      name: activeLayer.label,
    });

    map.overlayMapTypes.insertAt(0, tileLayer);

    return () => {
      map.overlayMapTypes.clear();
    };
  }, [map, activeLayer, gibsDate, gibsOpacity]);

  return null;
};

const PlacesSearchControl: React.FC<{
  onSelectLocation: (lat: number, lng: number, name: string) => void;
}> = ({ onSelectLocation }) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');
  const [query, setQuery] = useState('');
  const [googleSuggestions, setGoogleSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
  const [fallbackResults, setFallbackResults] = useState<
    Array<{ name: string; country: string; latitude: number; longitude: number }>
  >([]);
  const [searching, setSearching] = useState(false);
  const sessionTokenRef =
    useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setGoogleSuggestions([]);
      setFallbackResults([]);
      return;
    }

    // Check direct coordinates first
    const coordMatch = trimmed.match(
      /^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/
    );
    if (coordMatch) {
      const lat = Number(coordMatch[1]);
      const lng = Number(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        setGoogleSuggestions([]);
        setFallbackResults([
          {
            name: `Jump to ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`,
            country: 'Direct Coordinates',
            latitude: lat,
            longitude: lng,
          },
        ]);
        return;
      }
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        if (placesLib) {
          const { AutocompleteSessionToken, AutocompleteSuggestion } =
            placesLib;
          if (!sessionTokenRef.current) {
            sessionTokenRef.current = new AutocompleteSessionToken();
          }
          const res =
            await AutocompleteSuggestion.fetchAutocompleteSuggestions({
              input: trimmed,
              sessionToken: sessionTokenRef.current,
            });
          if (res.suggestions.length > 0) {
            setGoogleSuggestions(res.suggestions);
            setFallbackResults([]);
            setSearching(false);
            return;
          }
        }
      } catch (err: unknown) {
        const msg = String(err);
        if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
      }

      // Fallback to server geocoding search proxy
      try {
        const res = await fetch(
          `/api/geocode/search?q=${encodeURIComponent(trimmed)}`
        );
        if (res.ok) {
          const data = (await res.json()) as {
            results: Array<{
              name: string;
              country: string;
              latitude: number;
              longitude: number;
            }>;
          };
          setFallbackResults(data.results ?? []);
          setGoogleSuggestions([]);
        }
      } catch {
        // Ignore transient search error
      } finally {
        setSearching(false);
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [query, placesLib]);

  const handleGoogleSelect = async (
    suggestion: google.maps.places.AutocompleteSuggestion
  ) => {
    if (!suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
      });
      const loc = place.location;
      if (loc) {
        const lat = loc.lat();
        const lng = loc.lng();
        if (map) {
          if (place.viewport) map.fitBounds(place.viewport);
          else {
            map.panTo({ lat, lng });
            map.setZoom(8);
          }
        }
        onSelectLocation(
          lat,
          lng,
          place.displayName || place.formattedAddress || query
        );
      }
    } catch (err: unknown) {
      const msg = String(err);
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
        window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      }
    } finally {
      sessionTokenRef.current = null;
      setQuery('');
      setGoogleSuggestions([]);
    }
  };

  const handleFallbackSelect = (item: {
    name: string;
    country: string;
    latitude: number;
    longitude: number;
  }) => {
    if (map) {
      map.panTo({ lat: item.latitude, lng: item.longitude });
      map.setZoom(7);
    }
    onSelectLocation(
      item.latitude,
      item.longitude,
      item.country && item.country !== 'Direct Coordinates'
        ? `${item.name}, ${item.country}`
        : item.name
    );
    setQuery('');
    setFallbackResults([]);
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="flex items-center gap-2 bg-[#0B111C]/92 backdrop-blur-md border border-slate-700/80 rounded-lg px-3 py-2 shadow-xl">
        <Search className="w-4 h-4 text-cyan-400 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search city, country, or lat, lng..."
          className="w-full bg-transparent text-xs md:text-sm text-slate-100 placeholder:text-slate-400 focus:outline-none"
        />
        {searching && (
          <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />
        )}
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setGoogleSuggestions([]);
              setFallbackResults([]);
            }}
            className="text-slate-400 hover:text-slate-200"
            aria-label="Clear search"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {(googleSuggestions.length > 0 || fallbackResults.length > 0) && (
        <ul className="absolute left-0 right-0 mt-1.5 bg-[#0B111C]/95 backdrop-blur-md border border-slate-700/80 rounded-lg overflow-hidden shadow-2xl z-30 max-h-64 overflow-y-auto">
          {googleSuggestions.map((s, idx) => (
            <li key={`g-${idx}`}>
              <button
                type="button"
                onClick={() => void handleGoogleSelect(s)}
                className="w-full text-left px-3.5 py-2.5 text-xs text-slate-200 hover:bg-slate-800/80 border-b border-slate-800/60 last:border-none transition-colors"
              >
                {s.placePrediction?.text.text}
              </button>
            </li>
          ))}
          {fallbackResults.map((item, idx) => (
            <li key={`f-${idx}`}>
              <button
                type="button"
                onClick={() => handleFallbackSelect(item)}
                className="w-full text-left px-3.5 py-2.5 text-xs text-slate-200 hover:bg-slate-800/80 border-b border-slate-800/60 last:border-none flex items-center justify-between gap-2 transition-colors"
              >
                <span className="truncate font-medium">{item.name}</span>
                <span className="text-[11px] font-mono text-slate-400 shrink-0">
                  {item.country}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const ElevationSampler: React.FC<{
  onElevationChange: (elevationM: number | null) => void;
}> = ({ onElevationChange }) => {
  const map = useMap();
  const elevationLib = useMapsLibrary('elevation');
  const elevatorRef = useRef<google.maps.ElevationService | null>(null);

  useEffect(() => {
    if (!elevationLib) return;
    elevatorRef.current = new elevationLib.ElevationService();
  }, [elevationLib]);

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener(
      'click',
      async (e: google.maps.MapMouseEvent) => {
        if (!e.latLng || !elevatorRef.current) return;
        try {
          const { results } =
            await elevatorRef.current.getElevationForLocations({
              locations: [e.latLng],
            });
          if (results && results.length > 0) {
            onElevationChange(results[0].elevation);
          }
        } catch (err: unknown) {
          const msg = String(err);
          if (msg.includes('OVER_QUERY_LIMIT') || msg.includes('429')) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
        }
      }
    );
    return () => listener.remove();
  }, [map, onElevationChange]);

  return null;
};

export const EarthMapView: React.FC = () => {
  const {
    activeLayer,
    setActiveLayer,
    overview,
    inspectCoordinates,
    setCompareModalOpen,
    formatTemp,
    refreshOverview,
    overviewLoading,
  } = useEarth();

  const rawApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  const apiKey = rawApiKey === 'MY_GOOGLE_MAPS_API_KEY' ? '' : rawApiKey;
  const [baseMapType, setBaseMapType] = useState<'hybrid' | 'satellite' | 'terrain'>('hybrid');
  const [layerDrawerOpen, setLayerDrawerOpen] = useState(true);
  const [gibsOpacity, setGibsOpacity] = useState(0.7);
  const [gibsDate, setGibsDate] = useState(
    () => overview?.summary.latestSatelliteDate || new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)
  );
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [clickedElevationM, setClickedElevationM] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);

  useEffect(() => {
    if (overview?.summary.latestSatelliteDate) {
      setGibsDate(overview.summary.latestSatelliteDate);
    }
  }, [overview?.summary.latestSatelliteDate]);

  const currentLayerMeta = useMemo(
    () => MAP_LAYERS.find((l) => l.id === activeLayer) ?? MAP_LAYERS[0],
    [activeLayer]
  );

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoStatus('Browser geolocation unavailable.');
      return;
    }
    setGeoStatus('Acquiring GPS fix...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: Number(pos.coords.latitude.toFixed(4)),
          lng: Number(pos.coords.longitude.toFixed(4)),
        };
        setUserLocation(coords);
        setGeoStatus(`Live fix: ${coords.lat}°, ${coords.lng}°`);
        void inspectCoordinates(coords.lat, coords.lng, 'Your Live Location');
      },
      (err) => {
        setGeoStatus(
          err.code === 1
            ? 'Location permission denied. Click any map coordinate instead.'
            : 'Unable to determine device location.'
        );
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [inspectCoordinates]);

  const handleMapClick = useCallback(
    (ev: MapMouseEvent) => {
      const latLng = ev.detail?.latLng;
      if (!latLng) return;
      void inspectCoordinates(latLng.lat, latLng.lng);
    },
    [inspectCoordinates]
  );

  const handleMouseMove = useCallback((ev: MapMouseEvent) => {
    const latLng = ev.detail?.latLng;
    if (latLng) {
      setCursorCoords({ lat: latLng.lat, lng: latLng.lng });
    }
  }, []);

  const filteredEvents = useMemo(() => {
    const all = overview?.events ?? [];
    if (activeLayer === 'wildfire') {
      return all.filter((e) => e.category === 'wildfires');
    }
    if (activeLayer === 'flood') {
      return all.filter((e) => e.category === 'floods');
    }
    if (activeLayer === 'storm') {
      return all.filter((e) => e.category === 'severeStorms');
    }
    if (activeLayer === 'drought') {
      return all.filter((e) => e.category === 'drought' || e.category === 'dustHaze');
    }
    return all.slice(0, 60);
  }, [overview?.events, activeLayer]);

  const visibleStations = useMemo(() => {
    const stations = overview?.stations ?? [];
    if (activeLayer === 'deforestation' || activeLayer === 'vegetation-health') {
      return stations.filter(
        (s) =>
          s.biome.toLowerCase().includes('forest') ||
          s.biome.toLowerCase().includes('rainforest') ||
          s.biome.toLowerCase().includes('savanna') ||
          s.id === 'jakarta'
      );
    }
    return stations;
  }, [overview?.stations, activeLayer]);

  if (!apiKey) {
    return (
      <div className="h-full min-h-[540px] flex items-center justify-center bg-[#07090E] p-8">
        <div className="max-w-md border border-slate-800 bg-[#0E1420] rounded-lg p-6 text-center">
          <Satellite className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-slate-100 mb-2">
            Google Maps Key Required
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            Set <code className="text-cyan-300">VITE_GOOGLE_MAPS_API_KEY</code> in the environment configuration to load live satellite Earth imagery.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[580px] overflow-hidden bg-[#05070B]">
      <APIProvider apiKey={apiKey} libraries={['places', 'marker', 'elevation']} language="en" region="US">
        <GoogleMapView
          mapId="DEMO_MAP_ID"
          defaultCenter={{ lat: 20.0, lng: 20.0 }}
          defaultZoom={3}
          minZoom={2}
          gestureHandling="greedy"
          mapTypeId={baseMapType}
          disableDefaultUI={false}
          zoomControl={true}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          rotateControl={true}
          scaleControl={true}
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          onClick={handleMapClick}
          onMousemove={handleMouseMove}
          style={{ width: '100%', height: '100%' }}
        >
          <MapController
            activeLayer={currentLayerMeta}
            gibsDate={gibsDate}
            gibsOpacity={gibsOpacity}
            baseMapType={baseMapType}
            userPos={userLocation}
          />

          {/* User Live Geolocation Pin */}
          {userLocation && (
            <AdvancedMarker position={userLocation} title="Your Live Location">
              <div className="flex flex-col items-center">
                <div className="w-4 h-4 rounded-full bg-cyan-400 border-2 border-white shadow-[0_0_12px_rgba(6,182,212,0.9)]" />
                <span className="mt-1 px-1.5 py-0.5 text-[10px] font-mono bg-[#07090E]/90 text-cyan-300 border border-cyan-500/40 rounded">
                  YOU
                </span>
              </div>
            </AdvancedMarker>
          )}

          {/* Ocean Temperature Buoys (Open-Meteo Marine + NOAA NDBC) when Ocean Layer is active */}
          {activeLayer === 'ocean-temperature' && (
            <>
              {(overview?.oceanBuoys ?? []).map((b) => (
                <AdvancedMarker
                  key={b.id}
                  position={{ lat: b.latitude, lng: b.longitude }}
                  onClick={() =>
                    void inspectCoordinates(b.latitude, b.longitude, b.basin)
                  }
                >
                  <div className="px-2 py-1 rounded bg-[#07090E]/90 border border-cyan-500/60 text-[10px] font-mono text-cyan-200 shadow-lg hover:scale-105 transition-transform cursor-pointer whitespace-nowrap">
                    {b.airTempC !== null ? formatTemp(b.airTempC) : 'Buoy'} ·{' '}
                    {b.waveHeightM !== null ? `${b.waveHeightM.toFixed(1)}m` : '—'}
                  </div>
                </AdvancedMarker>
              ))}
              {(overview?.noaaBuoys ?? []).slice(0, 25).map((nb) => (
                <AdvancedMarker
                  key={`ndbc-${nb.stationId}`}
                  position={{ lat: nb.latitude, lng: nb.longitude }}
                  onClick={() =>
                    void inspectCoordinates(
                      nb.latitude,
                      nb.longitude,
                      `NOAA NDBC Buoy ${nb.stationId}`
                    )
                  }
                >
                  <div
                    title={`NOAA NDBC ${nb.stationId}: SST ${nb.seaSurfaceTempC ?? '—'}°C · Wave ${nb.waveHeightM ?? '—'}m`}
                    className="px-1.5 py-0.5 rounded bg-[#07090E]/90 border border-sky-400/70 text-[10px] font-mono text-sky-300 shadow-md hover:scale-110 transition-transform cursor-pointer whitespace-nowrap"
                  >
                    NDBC {nb.stationId}
                    {nb.seaSurfaceTempC !== null ? ` · ${formatTemp(nb.seaSurfaceTempC)}` : ''}
                  </div>
                </AdvancedMarker>
              ))}
            </>
          )}

          {/* NOAA NWS Active Weather Alerts on weather/storm/flood layers */}
          {(activeLayer === 'live-weather' ||
            activeLayer === 'storm' ||
            activeLayer === 'flood') &&
            (overview?.weatherAlerts ?? [])
              .filter((wa) => wa.latitude !== null && wa.longitude !== null)
              .slice(0, 20)
              .map((wa) => (
                <AdvancedMarker
                  key={`nws-${wa.id}`}
                  position={{ lat: wa.latitude!, lng: wa.longitude! }}
                  onClick={() =>
                    void inspectCoordinates(wa.latitude!, wa.longitude!, wa.event)
                  }
                >
                  <div
                    title={`NOAA NWS: ${wa.event} — ${wa.areaDesc}`}
                    className="px-1.5 py-0.5 rounded bg-amber-950/90 border border-amber-400/80 text-[10px] font-mono text-amber-200 shadow-md hover:scale-110 transition-transform cursor-pointer whitespace-nowrap"
                  >
                    NWS: {wa.event}
                  </div>
                </AdvancedMarker>
              ))}

          {/* Global Reference Station Telemetry Markers */}
          {activeLayer !== 'ocean-temperature' &&
            activeLayer !== 'satellite-imagery' &&
            visibleStations.map((st) => {
              const displayValue =
                activeLayer === 'air-quality'
                  ? st.usAqi !== null
                    ? `AQI ${st.usAqi}`
                    : 'AQI —'
                  : activeLayer === 'rainfall'
                    ? `${st.precipitationMm.toFixed(1)} mm`
                    : activeLayer === 'temperature-heatmap'
                      ? `${st.anomalyC >= 0 ? '+' : ''}${st.anomalyC.toFixed(1)}°`
                      : activeLayer === 'wildfire'
                        ? `FWI ${st.wildfireRiskScore}`
                        : formatTemp(st.temperatureC);

              const badgeColor =
                activeLayer === 'air-quality'
                  ? colorForAqi(st.usAqi)
                  : activeLayer === 'wildfire'
                    ? st.wildfireRiskScore >= 60
                      ? '#ef4444'
                      : '#f59e0b'
                    : colorForTemp(st.temperatureC);

              return (
                <AdvancedMarker
                  key={st.id}
                  position={{ lat: st.latitude, lng: st.longitude }}
                  onClick={() =>
                    void inspectCoordinates(
                      st.latitude,
                      st.longitude,
                      `${st.name}, ${st.country}`
                    )
                  }
                >
                  <div
                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#07090E]/90 border text-[11px] font-mono text-slate-100 shadow-lg hover:scale-105 transition-transform cursor-pointer whitespace-nowrap"
                    style={{ borderColor: badgeColor }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: badgeColor }}
                    />
                    <span className="font-sans text-[10px] text-slate-300">
                      {st.name}
                    </span>
                    <span className="font-semibold" style={{ color: badgeColor }}>
                      {displayValue}
                    </span>
                  </div>
                </AdvancedMarker>
              );
            })}

          {/* Real NASA EONET + USGS + FIRMS Event Markers */}
          {activeLayer !== 'ocean-temperature' &&
            filteredEvents.map((ev) => {
              const color =
                ev.category === 'wildfires'
                  ? '#ef4444'
                  : ev.category === 'severeStorms'
                    ? '#818cf8'
                    : ev.category === 'floods'
                      ? '#38bdf8'
                      : ev.category === 'earthquakes'
                        ? '#f59e0b'
                        : '#10b981';

              return (
                <AdvancedMarker
                  key={ev.id}
                  position={{ lat: ev.latitude, lng: ev.longitude }}
                  onClick={() =>
                    void inspectCoordinates(ev.latitude, ev.longitude, ev.title)
                  }
                >
                  <div
                    title={`${ev.categoryLabel}: ${ev.title}`}
                    className="w-4 h-4 rounded-full border-2 border-white/90 shadow-md hover:scale-125 transition-transform cursor-pointer flex items-center justify-center"
                    style={{ backgroundColor: color }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>
                </AdvancedMarker>
              );
            })}
        </GoogleMapView>

        {/* Top Floating Search & Controls Bar */}
        <div className="absolute top-3 left-3 right-3 flex flex-wrap items-start justify-between gap-3 pointer-events-none z-10">
          <div className="pointer-events-auto flex-1 min-w-[260px] max-w-md">
            <PlacesSearchControl
              onSelectLocation={(lat, lng, name) =>
                void inspectCoordinates(lat, lng, name)
              }
            />
            {geoStatus && (
              <p className="mt-1.5 text-[11px] font-mono text-cyan-300 bg-[#07090E]/85 px-2.5 py-1 rounded border border-slate-800 inline-block">
                {geoStatus}
              </p>
            )}
          </div>

          <div className="pointer-events-auto flex flex-wrap items-center gap-2">
            {/* Base Imagery Selector */}
            <div className="flex items-center bg-[#0B111C]/92 backdrop-blur-md border border-slate-700/80 rounded-lg p-0.5 text-xs">
              {(['hybrid', 'satellite', 'terrain'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setBaseMapType(mode)}
                  className={`px-2.5 py-1.5 rounded-md capitalize transition-colors whitespace-nowrap shrink-0 ${
                    baseMapType === mode
                      ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleLocateMe}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#0B111C]/92 backdrop-blur-md border border-slate-700/80 text-slate-100 hover:border-cyan-500/60 hover:text-cyan-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <LocateFixed className="w-3.5 h-3.5 text-cyan-400" />
              Locate Me
            </button>

            <button
              type="button"
              onClick={() => setCompareModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#0B111C]/92 backdrop-blur-md border border-slate-700/80 text-slate-100 hover:border-emerald-500/60 hover:text-emerald-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <History className="w-3.5 h-3.5 text-emerald-400" />
              Satellite Compare
            </button>

            <button
              type="button"
              onClick={() => setLayerDrawerOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium backdrop-blur-md border rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                layerDrawerOpen
                  ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200'
                  : 'bg-[#0B111C]/92 border-slate-700/80 text-slate-200 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Layers (12)
            </button>
          </div>
        </div>

        {/* Left Floating Layer Control Dock */}
        {layerDrawerOpen && (
          <aside className="absolute top-16 left-3 bottom-14 w-64 bg-[#0B111C]/92 backdrop-blur-md border border-slate-800 rounded-lg flex flex-col z-10 overflow-hidden shadow-2xl">
            <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200">
                Environmental Layers
              </span>
              <button
                type="button"
                onClick={() => void refreshOverview()}
                className="text-slate-400 hover:text-cyan-300 transition-colors"
                title="Refresh live satellite & weather feeds"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${overviewLoading ? 'animate-spin text-cyan-400' : ''}`}
                />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {MAP_LAYERS.map((layer) => {
                const active = layer.id === activeLayer;
                return (
                  <button
                    key={layer.id}
                    type="button"
                    onClick={() => setActiveLayer(layer.id)}
                    className={`w-full text-left px-2.5 py-2 rounded-md text-xs flex items-center justify-between gap-2 transition-colors ${
                      active
                        ? 'bg-cyan-500/15 text-cyan-200 border border-cyan-500/40'
                        : 'text-slate-300 hover:bg-slate-800/70 border border-transparent'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className={active ? 'text-cyan-400' : 'text-slate-400'}>
                        {getLayerIcon(layer.id)}
                      </span>
                      <span className="truncate">{layer.label}</span>
                    </span>
                    {layer.gibsLayer && (
                      <span className="text-[10px] font-mono text-emerald-400 shrink-0">
                        GIBS
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {currentLayerMeta.gibsLayer && (
              <div className="p-3 border-t border-slate-800 bg-[#080C14] space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">NASA GIBS Date</span>
                  <input
                    type="date"
                    value={gibsDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setGibsDate(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 font-mono text-[11px] text-slate-200"
                  />
                </div>
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-400">Overlay Opacity</span>
                  <input
                    type="range"
                    min={0.15}
                    max={1}
                    step={0.05}
                    value={gibsOpacity}
                    onChange={(e) => setGibsOpacity(Number(e.target.value))}
                    className="w-24 accent-cyan-400"
                  />
                  <span className="font-mono text-slate-300 w-8 text-right">
                    {Math.round(gibsOpacity * 100)}%
                  </span>
                </div>
              </div>
            )}
          </aside>
        )}

        {/* Bottom-Left Legend + Live Coordinates Strip */}
        <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-end justify-between gap-3 pointer-events-none z-10">
          <div className="pointer-events-auto bg-[#0B111C]/92 backdrop-blur-md border border-slate-800 rounded-lg px-3.5 py-2.5 max-w-md shadow-xl">
            <div className="flex items-center justify-between gap-4 mb-1.5">
              <span className="text-xs font-semibold text-slate-100">
                {currentLayerMeta.label}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {currentLayerMeta.source}
              </span>
            </div>
            <div
              className="h-2 w-full rounded-sm mb-1"
              style={{ background: currentLayerMeta.legendGradient }}
            />
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>{currentLayerMeta.legendMin}</span>
              <span>{currentLayerMeta.legendMid}</span>
              <span>{currentLayerMeta.legendMax}</span>
            </div>
          </div>

          <ElevationSampler onElevationChange={setClickedElevationM} />
          <div className="pointer-events-auto bg-[#0B111C]/92 backdrop-blur-md border border-slate-800 rounded-lg px-3 py-2 text-[11px] font-mono text-slate-300 flex items-center gap-3">
            <span>
              LAT{' '}
              <strong className="text-cyan-300">
                {cursorCoords ? cursorCoords.lat.toFixed(4) : '—'}
              </strong>
            </span>
            <span className="text-slate-600">·</span>
            <span>
              LNG{' '}
              <strong className="text-cyan-300">
                {cursorCoords ? cursorCoords.lng.toFixed(4) : '—'}
              </strong>
            </span>
            {clickedElevationM !== null && (
              <>
                <span className="text-slate-600">·</span>
                <span>
                  ELEV{' '}
                  <strong className="text-emerald-300">
                    {Math.round(clickedElevationM)}m
                  </strong>
                </span>
              </>
            )}
            <span className="text-slate-600 hidden sm:inline">·</span>
            <span className="text-slate-400 hidden sm:inline">
              Click anywhere on Earth to inspect
            </span>
          </div>
        </div>
      </APIProvider>
    </div>
  );
};
