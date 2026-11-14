import React, { useMemo, useState } from 'react';
import { Calendar, Layers, MoveHorizontal, X } from 'lucide-react';
import { useEarth } from '../contexts/EarthContext.tsx';

interface RegionPreset {
  id: string;
  name: string;
  lat: number;
  lng: number;
  zoom: number;
  note: string;
}

const PRESET_REGIONS: RegionPreset[] = [
  {
    id: 'amazon',
    name: 'Amazon Basin (Rondônia, Brazil)',
    lat: -9.8,
    lng: -62.9,
    zoom: 6,
    note: 'Tropical rainforest canopy monitoring & land-use boundary corridor.',
  },
  {
    id: 'indus',
    name: 'Indus Delta & Karachi Coast',
    lat: 24.86,
    lng: 67.5,
    zoom: 7,
    note: 'Coastal arid delta, monsoon flood plain, and urban heat corridor.',
  },
  {
    id: 'california',
    name: 'Northern California Sierra Corridor',
    lat: 39.8,
    lng: -121.2,
    zoom: 7,
    note: 'Temperate conifer forest & summer wildfire thermal monitoring zone.',
  },
  {
    id: 'borneo',
    name: 'Central Kalimantan (Borneo)',
    lat: -1.8,
    lng: 113.4,
    zoom: 6,
    note: 'Equatorial peatland & tropical forest canopy transition belt.',
  },
  {
    id: 'lake-chad',
    name: 'Lake Chad Basin (Sahel)',
    lat: 13.0,
    lng: 14.0,
    zoom: 7,
    note: 'Semi-arid hydrological shoreline variability and dust belt.',
  },
  {
    id: 'arctic',
    name: 'Svalbard / Barents Sea Ice Edge',
    lat: 78.2,
    lng: 15.6,
    zoom: 5,
    note: 'High-latitude sea-ice albedo and polar reflectance monitoring.',
  },
];

const GIBS_COMPARE_LAYERS = [
  {
    id: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    label: 'MODIS Terra TrueColor (250m)',
    ext: 'jpg',
    maxZoom: 9,
  },
  {
    id: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    label: 'VIIRS Suomi-NPP TrueColor',
    ext: 'jpg',
    maxZoom: 9,
  },
  {
    id: 'MODIS_Terra_NDVI_8Day',
    label: 'MODIS Terra Vegetation (NDVI)',
    ext: 'png',
    maxZoom: 8,
  },
  {
    id: 'MODIS_Terra_Land_Surface_Temp_Day',
    label: 'MODIS Land Surface Temperature',
    ext: 'png',
    maxZoom: 7,
  },
];

function latLngToTile(lat: number, lng: number, zoom: number) {
  const latRad = (lat * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
}

const GibsTileMosaic: React.FC<{
  lat: number;
  lng: number;
  zoom: number;
  date: string;
  layerId: string;
  ext: string;
  maxZoom: number;
}> = ({ lat, lng, zoom, date, layerId, ext, maxZoom }) => {
  const effectiveZoom = Math.min(zoom, maxZoom);
  const center = latLngToTile(lat, lng, effectiveZoom);
  const matrixSet = `GoogleMapsCompatible_Level${maxZoom}`;
  const gridOffsets = [-1, 0, 1];

  return (
    <div className="grid grid-cols-3 grid-rows-3 w-full h-full bg-[#05070B]">
      {gridOffsets.map((dy) =>
        gridOffsets.map((dx) => {
          const tx = center.x + dx;
          const ty = center.y + dy;
          const url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layerId}/default/${date}/${matrixSet}/${effectiveZoom}/${ty}/${tx}.${ext}`;
          return (
            <img
              key={`${dx}-${dy}`}
              src={url}
              alt={`NASA GIBS ${layerId} tile ${date}`}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover select-none"
              draggable={false}
            />
          );
        })
      )}
    </div>
  );
};

export const SatelliteComparisonModal: React.FC = () => {
  const { compareModalOpen, setCompareModalOpen, selectedIntel } = useEarth();

  const defaultBefore = useMemo(() => {
    const d = new Date(Date.now() - 365 * 86400000);
    return d.toISOString().slice(0, 10);
  }, []);
  const defaultAfter = useMemo(() => {
    const d = new Date(Date.now() - 3 * 86400000);
    return d.toISOString().slice(0, 10);
  }, []);

  const [regionId, setRegionId] = useState<string>('amazon');
  const [dateBefore, setDateBefore] = useState(defaultBefore);
  const [dateAfter, setDateAfter] = useState(defaultAfter);
  const [layerIdx, setLayerIdx] = useState(0);
  const [splitPct, setSplitPct] = useState(50);

  if (!compareModalOpen) return null;

  const activeRegion =
    regionId === 'selected' && selectedIntel
      ? {
          id: 'selected',
          name: `${selectedIntel.location.name}, ${selectedIntel.location.country}`,
          lat: selectedIntel.location.latitude,
          lng: selectedIntel.location.longitude,
          zoom: 7,
          note: 'Currently inspected map coordinates.',
        }
      : PRESET_REGIONS.find((r) => r.id === regionId) ?? PRESET_REGIONS[0];

  const activeLayer = GIBS_COMPARE_LAYERS[layerIdx];

  const shiftBeforeMonths = (months: number) => {
    const base = new Date(dateAfter);
    base.setUTCMonth(base.getUTCMonth() - months);
    setDateBefore(base.toISOString().slice(0, 10));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-[#0B111C] border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Historical Satellite Comparison
            </h2>
            <p className="text-xs text-slate-400">
              NASA EOSDIS GIBS Orbital Swath Comparator · {activeRegion.name}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCompareModalOpen(false)}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
            aria-label="Close comparison"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Controls Bar */}
        <div className="px-5 py-3 border-b border-slate-800 bg-[#080C14] flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Region:</span>
            <select
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
            >
              {selectedIntel && (
                <option value="selected">
                  Current Map Selection ({selectedIntel.location.name})
                </option>
              )}
              {PRESET_REGIONS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <select
              value={layerIdx}
              onChange={(e) => setLayerIdx(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
            >
              {GIBS_COMPARE_LAYERS.map((l, idx) => (
                <option key={l.id} value={idx}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Before:</span>
            <input
              type="date"
              value={dateBefore}
              max={dateAfter}
              onChange={(e) => setDateBefore(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">After:</span>
            <input
              type="date"
              value={dateAfter}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDateAfter(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 font-mono text-slate-200"
            />
          </div>

          <div className="flex items-center gap-1 ml-auto">
            {[
              { label: '-3M', months: 3 },
              { label: '-1Y', months: 12 },
              { label: '-3Y', months: 36 },
            ].map((step) => (
              <button
                key={step.label}
                type="button"
                onClick={() => shiftBeforeMonths(step.months)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-[11px]"
              >
                {step.label}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Split Swipe Stage */}
        <div className="relative flex-1 min-h-[380px] bg-black overflow-hidden select-none">
          {/* Base Layer: After */}
          <div className="absolute inset-0">
            <GibsTileMosaic
              lat={activeRegion.lat}
              lng={activeRegion.lng}
              zoom={activeRegion.zoom}
              date={dateAfter}
              layerId={activeLayer.id}
              ext={activeLayer.ext}
              maxZoom={activeLayer.maxZoom}
            />
          </div>

          {/* Clipped Layer: Before */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - splitPct}% 0 0)` }}
          >
            <GibsTileMosaic
              lat={activeRegion.lat}
              lng={activeRegion.lng}
              zoom={activeRegion.zoom}
              date={dateBefore}
              layerId={activeLayer.id}
              ext={activeLayer.ext}
              maxZoom={activeLayer.maxZoom}
            />
          </div>

          {/* Vertical Divider Line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.9)] pointer-events-none"
            style={{ left: `${splitPct}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#07090E] border border-cyan-400 flex items-center justify-center text-cyan-300 shadow-lg">
              <MoveHorizontal className="w-4 h-4" />
            </div>
          </div>

          {/* Date Labels */}
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-[#07090E]/90 border border-slate-700 text-xs font-mono text-amber-300">
            BEFORE · {dateBefore}
          </div>
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded bg-[#07090E]/90 border border-slate-700 text-xs font-mono text-cyan-300">
            AFTER · {dateAfter}
          </div>

          {/* Invisible Range Slider Over Stage for Smooth Dragging */}
          <input
            type="range"
            min={5}
            max={95}
            value={splitPct}
            onChange={(e) => setSplitPct(Number(e.target.value))}
            aria-label="Before and after satellite imagery divider"
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-slate-800 bg-[#080C14] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>
            {activeRegion.note} · Coordinates{' '}
            <span className="font-mono text-slate-200">
              {activeRegion.lat.toFixed(2)}°, {activeRegion.lng.toFixed(2)}°
            </span>
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            Drag slider across viewport to compare orbital imagery
          </span>
        </div>
      </div>
    </div>
  );
};
