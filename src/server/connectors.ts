import type {
  AlertItem,
  DataSourceStatus,
  GlobalStationReading,
  LocationEnrichment,
  LocationIntelligence,
  NaturalEvent,
  NoaaBuoyObservation,
  OceanBuoyReading,
  PlanetaryOverviewPayload,
  SatelliteObservationRecord,
  UsgsWaterGauge,
  WeatherAlertItem,
} from '../types/earth.ts';
import {
  analyzeTimeSeriesTrend,
  detectTemperatureAnomaly,
  estimateFloodRisk,
  estimateWildfireRisk,
  evaluateWhoAirQuality,
} from './analytics.ts';
import { fetchWithTimeout, withCache } from './cache.ts';

interface ReferenceStation {
  id: string;
  name: string;
  country: string;
  region: string;
  biome: string;
  latitude: number;
  longitude: number;
  baselineTempC: number;
}

export const GLOBAL_REFERENCE_STATIONS: ReferenceStation[] = [
  { id: 'karachi', name: 'Karachi', country: 'Pakistan', region: 'South Asia', biome: 'Coastal Arid', latitude: 24.8607, longitude: 67.0011, baselineTempC: 27.2 },
  { id: 'delhi', name: 'New Delhi', country: 'India', region: 'South Asia', biome: 'Indo-Gangetic Plain', latitude: 28.6139, longitude: 77.209, baselineTempC: 25.0 },
  { id: 'london', name: 'London', country: 'United Kingdom', region: 'Europe', biome: 'Temperate Maritime', latitude: 51.5072, longitude: -0.1276, baselineTempC: 11.2 },
  { id: 'new-york', name: 'New York', country: 'United States', region: 'North America', biome: 'Temperate Coastal', latitude: 40.7128, longitude: -74.006, baselineTempC: 12.8 },
  { id: 'los-angeles', name: 'Los Angeles', country: 'United States', region: 'North America', biome: 'Mediterranean Basin', latitude: 34.0522, longitude: -118.2437, baselineTempC: 18.4 },
  { id: 'tokyo', name: 'Tokyo', country: 'Japan', region: 'East Asia', biome: 'Humid Subtropical', latitude: 35.6762, longitude: 139.6503, baselineTempC: 15.8 },
  { id: 'singapore', name: 'Singapore', country: 'Singapore', region: 'Southeast Asia', biome: 'Tropical Rainforest', latitude: 1.3521, longitude: 103.8198, baselineTempC: 27.5 },
  { id: 'manaus', name: 'Manaus (Amazon)', country: 'Brazil', region: 'South America', biome: 'Amazon Basin Forest', latitude: -3.119, longitude: -60.0217, baselineTempC: 27.4 },
  { id: 'sao-paulo', name: 'São Paulo', country: 'Brazil', region: 'South America', biome: 'Subtropical Highland', latitude: -23.5505, longitude: -46.6333, baselineTempC: 19.8 },
  { id: 'kinshasa', name: 'Kinshasa (Congo)', country: 'DR Congo', region: 'Central Africa', biome: 'Congo Basin Forest', latitude: -4.4419, longitude: 15.2663, baselineTempC: 25.6 },
  { id: 'nairobi', name: 'Nairobi', country: 'Kenya', region: 'East Africa', biome: 'Tropical Savanna', latitude: -1.2921, longitude: 36.8219, baselineTempC: 19.5 },
  { id: 'cairo', name: 'Cairo', country: 'Egypt', region: 'MENA', biome: 'Sahara Desert Margin', latitude: 30.0444, longitude: 31.2357, baselineTempC: 22.1 },
  { id: 'sydney', name: 'Sydney', country: 'Australia', region: 'Oceania', biome: 'Temperate Coastal', latitude: -33.8688, longitude: 151.2093, baselineTempC: 18.1 },
  { id: 'jakarta', name: 'Jakarta', country: 'Indonesia', region: 'Southeast Asia', biome: 'Equatorial Maritime', latitude: -6.2088, longitude: 106.8456, baselineTempC: 27.8 },
  { id: 'beijing', name: 'Beijing', country: 'China', region: 'East Asia', biome: 'Continental Steppe', latitude: 39.9042, longitude: 116.4074, baselineTempC: 12.6 },
  { id: 'reykjavik', name: 'Reykjavik', country: 'Iceland', region: 'North Atlantic', biome: 'Subpolar Tundra', latitude: 64.1466, longitude: -21.9426, baselineTempC: 4.8 },
  { id: 'anchorage', name: 'Anchorage', country: 'United States', region: 'Arctic Margin', biome: 'Boreal Forest', latitude: 61.2181, longitude: -149.9003, baselineTempC: 2.9 },
  { id: 'cape-town', name: 'Cape Town', country: 'South Africa', region: 'Southern Africa', biome: 'Fynbos Mediterranean', latitude: -33.9249, longitude: 18.4241, baselineTempC: 16.9 },
];

const OCEAN_BUOYS: Array<{
  id: string;
  basin: string;
  latitude: number;
  longitude: number;
}> = [
  { id: 'nino34', basin: 'Equatorial Pacific (Niño 3.4)', latitude: 0.0, longitude: -140.0 },
  { id: 'north-atlantic', basin: 'North Atlantic Drift', latitude: 42.5, longitude: -38.0 },
  { id: 'arabian-sea', basin: 'Arabian Sea / Northern Indian', latitude: 15.0, longitude: 64.0 },
  { id: 'kuroshio', basin: 'Western Pacific (Kuroshio)', latitude: 30.0, longitude: 145.0 },
  { id: 'south-atlantic', basin: 'South Atlantic Gyre', latitude: -24.0, longitude: -18.0 },
  { id: 'bay-of-bengal', basin: 'Bay of Bengal', latitude: 13.5, longitude: 88.0 },
  { id: 'southern-ocean', basin: 'Southern Ocean (Drake Passage)', latitude: -56.0, longitude: -65.0 },
  { id: 'norwegian-sea', basin: 'Arctic / Norwegian Sea', latitude: 68.5, longitude: 4.0 },
];

const GMP_ATTRIBUTION_HEADER = {
  'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
};

function getServerGoogleMapsKey(): string {
  const raw =
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ||
    '';
  return raw === 'MY_GOOGLE_MAPS_API_KEY' ? '' : raw;
}

export function weatherCodeToLabel(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code <= 3) return 'Partly Cloudy';
  if (code === 45 || code === 48) return 'Fog / Mist';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow / Ice';
  if (code >= 80 && code <= 82) return 'Rain Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Variable Conditions';
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapEonetCategory(
  rawId: string
): { category: NaturalEvent['category']; label: string } {
  switch (rawId) {
    case 'wildfires':
      return { category: 'wildfires', label: 'Wildfire' };
    case 'severeStorms':
      return { category: 'severeStorms', label: 'Severe Storm' };
    case 'floods':
      return { category: 'floods', label: 'Flood' };
    case 'volcanoes':
      return { category: 'volcanoes', label: 'Volcanic Activity' };
    case 'drought':
      return { category: 'drought', label: 'Drought' };
    case 'dustHaze':
      return { category: 'dustHaze', label: 'Dust & Haze' };
    case 'seaLakeIce':
      return { category: 'seaLakeIce', label: 'Sea & Lake Ice' };
    default:
      return { category: 'other', label: rawId || 'Environmental Event' };
  }
}

async function fetchPublicFirmsSample(): Promise<{
  hotspots: NaturalEvent[];
  ok: boolean;
}> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(
      'https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv',
      { signal: ctrl.signal }
    );
    if (!res.ok || !res.body) {
      clearTimeout(timer);
      return { hotspots: [], ok: false };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (buffer.length < 32000) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
    }
    clearTimeout(timer);
    await reader.cancel().catch(() => {});

    const lines = buffer.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length < 2) return { hotspots: [], ok: false };
    const headers = lines[0].split(',').map((h) => h.trim());
    const latIdx = headers.indexOf('latitude');
    const lngIdx = headers.indexOf('longitude');
    const frpIdx = headers.indexOf('frp');
    const confIdx = headers.indexOf('confidence');
    const dateIdx = headers.indexOf('acq_date');
    const timeIdx = headers.indexOf('acq_time');
    const satIdx = headers.indexOf('satellite');

    const hotspots: NaturalEvent[] = [];
    const seenGrid = new Set<string>();
    for (const row of lines.slice(1, -1)) {
      const cols = row.split(',');
      if (cols.length < 10) continue;
      const lat = Number(cols[latIdx]);
      const lng = Number(cols[lngIdx]);
      const frp = Number(cols[frpIdx] ?? 0);
      const conf = Number(cols[confIdx] ?? 0);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || conf < 55) continue;

      const gridKey = `${lat.toFixed(1)},${lng.toFixed(1)}`;
      if (seenGrid.has(gridKey)) continue;
      seenGrid.add(gridKey);

      const acqDate = cols[dateIdx] || new Date().toISOString().slice(0, 10);
      const acqTime = (cols[timeIdx] || '0000').padStart(4, '0');
      const isoDate = `${acqDate}T${acqTime.slice(0, 2)}:${acqTime.slice(2, 4)}:00Z`;
      const satName = cols[satIdx] === 'T' ? 'Terra MODIS' : cols[satIdx] === 'A' ? 'Aqua MODIS' : 'MODIS';

      hotspots.push({
        id: `firms-nrt-${lat.toFixed(3)}-${lng.toFixed(3)}-${acqDate}`,
        title: `FIRMS Active Fire (${frp.toFixed(1)} MW FRP)`,
        category: 'wildfires',
        categoryLabel: 'Wildfire Hotspot',
        severity: frp >= 60 ? 'critical' : frp >= 20 ? 'high' : 'moderate',
        latitude: lat,
        longitude: lng,
        date: isoDate,
        source: 'NASA FIRMS MODIS C6.1 NRT',
        description: `${satName} thermal anomaly · Confidence ${conf}% · Fire Radiative Power ${frp.toFixed(1)} MW.`,
      });
      if (hotspots.length >= 45) break;
    }

    return { hotspots, ok: hotspots.length > 0 };
  } catch {
    return { hotspots: [], ok: false };
  }
}

export async function fetchLiveNaturalEvents(): Promise<{
  events: NaturalEvent[];
  eonetOk: boolean;
  usgsOk: boolean;
  firmsOk: boolean;
  firmsCount: number;
  firmsMode: 'map-key-viirs' | 'public-modis-nrt' | 'unavailable';
}> {
  const { data } = await withCache('live-natural-events-v4', 5 * 60 * 1000, async () => {
    const events: NaturalEvent[] = [];
    let eonetOk = false;
    let usgsOk = false;
    let firmsOk = false;
    let firmsCount = 0;
    let firmsMode: 'map-key-viirs' | 'public-modis-nrt' | 'unavailable' = 'unavailable';
    const firmsKey = process.env.NASA_FIRMS_MAP_KEY?.trim() || '';

    const [eonetRes, usgsRes] = await Promise.all([
      fetchWithTimeout(
        'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100&days=30',
        {},
        10000
      ).catch(() => null),
      fetchWithTimeout(
        'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
        {},
        10000
      ).catch(() => null),
    ]);

    if (eonetRes && eonetRes.ok) {
      eonetOk = true;
      const json = (await eonetRes.json()) as {
        events?: Array<{
          id: string;
          title: string;
          link?: string;
          categories?: Array<{ id: string; title: string }>;
          geometry?: Array<{
            date: string;
            type: string;
            coordinates: number[] | number[][][];
          }>;
        }>;
      };

      for (const ev of json.events ?? []) {
        const geom = ev.geometry?.[ev.geometry.length - 1];
        if (!geom || !geom.coordinates) continue;
        let lng = 0;
        let lat = 0;
        if (geom.type === 'Point' && Array.isArray(geom.coordinates)) {
          lng = Number(geom.coordinates[0]);
          lat = Number(geom.coordinates[1]);
        } else if (
          geom.type === 'Polygon' &&
          Array.isArray(geom.coordinates[0]) &&
          Array.isArray(geom.coordinates[0][0])
        ) {
          lng = Number(geom.coordinates[0][0][0]);
          lat = Number(geom.coordinates[0][0][1]);
        } else {
          continue;
        }
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const rawCat = ev.categories?.[0]?.id ?? 'other';
        const mapped = mapEonetCategory(rawCat);
        const severity: NaturalEvent['severity'] =
          mapped.category === 'wildfires' ||
          mapped.category === 'severeStorms' ||
          mapped.category === 'floods'
            ? 'high'
            : mapped.category === 'volcanoes'
              ? 'critical'
              : 'moderate';

        events.push({
          id: `eonet-${ev.id}`,
          title: ev.title,
          category: mapped.category,
          categoryLabel: mapped.label,
          severity,
          latitude: lat,
          longitude: lng,
          date: geom.date || new Date().toISOString(),
          source: 'NASA EONET v3',
          sourceUrl: ev.link,
          description: `${mapped.label} tracked by NASA Earth Observatory Natural Event Tracker.`,
        });
      }
    }

    if (usgsRes && usgsRes.ok) {
      usgsOk = true;
      const geo = (await usgsRes.json()) as {
        features?: Array<{
          id: string;
          properties: {
            mag: number;
            place: string;
            time: number;
            url: string;
            tsunami: number;
            title: string;
          };
          geometry: { coordinates: [number, number, number] };
        }>;
      };

      for (const f of (geo.features ?? []).slice(0, 60)) {
        const [lng, lat, depthKm] = f.geometry.coordinates;
        const mag = Number(f.properties.mag ?? 0);
        const severity: NaturalEvent['severity'] =
          mag >= 6.0
            ? 'critical'
            : mag >= 5.0
              ? 'high'
              : mag >= 4.0
                ? 'moderate'
                : 'low';
        events.push({
          id: `usgs-${f.id}`,
          title: f.properties.title || `M${mag.toFixed(1)} Earthquake`,
          category: 'earthquakes',
          categoryLabel: 'Earthquake',
          severity,
          latitude: lat,
          longitude: lng,
          date: new Date(f.properties.time).toISOString(),
          source: 'USGS Earthquake Hazards',
          sourceUrl: f.properties.url,
          magnitude: mag,
          depthKm: Number(depthKm?.toFixed(1) ?? 0),
          description: `${f.properties.place || 'Seismic event'} · Depth ${depthKm?.toFixed(1) ?? '?'} km${f.properties.tsunami ? ' · Tsunami advisory flagged' : ''}`,
        });
      }
    }

    if (firmsKey) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 9000);
      try {
        const firmsRes = await fetch(
          `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(firmsKey)}/VIIRS_SNPP_NRT/world/1`,
          { signal: ctrl.signal }
        );
        if (firmsRes.ok && firmsRes.body) {
          const reader = firmsRes.body.getReader();
          const decoder = new TextDecoder();
          let csv = '';
          while (csv.length < 48000) {
            const { value, done } = await reader.read();
            if (done) break;
            csv += decoder.decode(value, { stream: true });
          }
          clearTimeout(timer);
          await reader.cancel().catch(() => {});

          const lines = csv.trim().split('\n');
          if (lines.length > 2 && lines[0].includes('latitude')) {
            const headers = lines[0].split(',');
            const latIdx = headers.indexOf('latitude');
            const lngIdx = headers.indexOf('longitude');
            const frpIdx = headers.indexOf('frp');
            const dateIdx = headers.indexOf('acq_date');
            for (const row of lines.slice(1, 61)) {
              const cols = row.split(',');
              const lat = Number(cols[latIdx]);
              const lng = Number(cols[lngIdx]);
              const frp = Number(cols[frpIdx] ?? 0);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
              firmsCount++;
              events.push({
                id: `firms-${lat.toFixed(3)}-${lng.toFixed(3)}-${cols[dateIdx] ?? ''}`,
                title: `VIIRS Thermal Hotspot (${frp.toFixed(1)} MW FRP)`,
                category: 'wildfires',
                categoryLabel: 'Wildfire Hotspot',
                severity: frp > 50 ? 'critical' : frp > 15 ? 'high' : 'moderate',
                latitude: lat,
                longitude: lng,
                date: cols[dateIdx] || new Date().toISOString(),
                source: 'NASA FIRMS VIIRS',
                description: `Active thermal anomaly detected via Suomi NPP VIIRS with Fire Radiative Power ${frp.toFixed(1)} MW.`,
              });
            }
            if (firmsCount > 0) {
              firmsOk = true;
              firmsMode = 'map-key-viirs';
            }
          }
        } else {
          clearTimeout(timer);
        }
      } catch {
        clearTimeout(timer);
        firmsOk = false;
      }
    }

    if (!firmsOk) {
      const publicFirms = await fetchPublicFirmsSample();
      if (publicFirms.ok) {
        firmsOk = true;
        firmsMode = 'public-modis-nrt';
        firmsCount = publicFirms.hotspots.length;
        events.push(...publicFirms.hotspots);
      }
    }

    return { events, eonetOk, usgsOk, firmsOk, firmsCount, firmsMode };
  });

  return data;
}

export async function fetchNoaaAndUsgsFeeds(): Promise<{
  co2Ppm: number | null;
  co2TrendPpm: number | null;
  co2Date: string | null;
  co2Ok: boolean;
  weatherAlerts: WeatherAlertItem[];
  nwsOk: boolean;
  noaaBuoys: NoaaBuoyObservation[];
  ndbcOk: boolean;
  usgsRiverGauges: UsgsWaterGauge[];
  usgsWaterOk: boolean;
  satelliteFeeds: SatelliteObservationRecord[];
  earthdataOk: boolean;
  sentinelOk: boolean;
  gfwOk: boolean;
  gfwVersion: string | null;
}> {
  const { data } = await withCache('noaa-usgs-sat-feeds', 10 * 60 * 1000, async () => {
    const [
      co2Res,
      nwsRes,
      ndbcRes,
      usgsWaterRes,
      cmrRes,
      copernicusRes,
      gfwLossRes,
      gfwAlertsRes,
    ] = await Promise.allSettled([
      fetchWithTimeout(
        'https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_mm_mlo.txt',
        {},
        7000
      ),
      fetchWithTimeout(
        'https://api.weather.gov/alerts/active?status=actual&message_type=alert',
        {
          headers: {
            'User-Agent': 'EarthSystemTrendDetective/1.0 (environmental-telemetry)',
            Accept: 'application/geo+json',
          },
        },
        7000
      ),
      fetchWithTimeout(
        'https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt',
        {},
        7000
      ),
      fetchWithTimeout(
        'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=01646500,09380000,11447650,07010000,14211720&parameterCd=00060,00065',
        {},
        7000
      ),
      fetchWithTimeout(
        'https://cmr.earthdata.nasa.gov/search/granules.json?short_name=MOD09GA&page_size=3',
        {},
        7000
      ),
      fetchWithTimeout(
        'https://catalogue.dataspace.copernicus.eu/odata/v1/Products?%24top=4',
        {},
        7000
      ),
      fetchWithTimeout(
        'https://data-api.globalforestwatch.org/dataset/umd_tree_cover_loss/latest',
        {},
        7000
      ),
      fetchWithTimeout(
        'https://data-api.globalforestwatch.org/dataset/gfw_integrated_alerts/latest',
        {},
        7000
      ),
    ]);

    // 1. NOAA Mauna Loa CO2
    let co2Ppm: number | null = null;
    let co2TrendPpm: number | null = null;
    let co2Date: string | null = null;
    let co2Ok = false;
    if (co2Res.status === 'fulfilled' && co2Res.value.ok) {
      const txt = await co2Res.value.text();
      const lines = txt.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
      const last = lines[lines.length - 1];
      if (last) {
        const cols = last.trim().split(/\s+/);
        const yr = cols[0];
        const mo = (cols[1] || '01').padStart(2, '0');
        const avg = Number(cols[3]);
        const deseason = Number(cols[4]);
        if (Number.isFinite(avg) && avg > 300) {
          co2Ppm = Number(avg.toFixed(2));
          co2TrendPpm = Number.isFinite(deseason) ? Number(deseason.toFixed(2)) : null;
          co2Date = `${yr}-${mo}`;
          co2Ok = true;
        }
      }
    }

    // 2. NOAA NWS Active Weather Alerts
    const weatherAlerts: WeatherAlertItem[] = [];
    let nwsOk = false;
    if (nwsRes.status === 'fulfilled' && nwsRes.value.ok) {
      nwsOk = true;
      const geo = (await nwsRes.value.json()) as {
        features?: Array<{
          id: string;
          geometry?: {
            type?: string;
            coordinates?: number[] | number[][][] | number[][][][];
          } | null;
          properties: {
            event?: string;
            headline?: string;
            severity?: string;
            areaDesc?: string;
            senderName?: string;
            sent?: string;
            expires?: string;
          };
        }>;
      };
      for (const f of (geo.features ?? []).slice(0, 25)) {
        const p = f.properties;
        let lat: number | null = null;
        let lng: number | null = null;
        if (f.geometry?.type === 'Polygon' && Array.isArray(f.geometry.coordinates?.[0])) {
          const ring = f.geometry.coordinates[0] as unknown as number[][];
          if (ring.length > 0) {
            lng = Number(ring[0][0]);
            lat = Number(ring[0][1]);
          }
        } else if (f.geometry?.type === 'Point' && Array.isArray(f.geometry.coordinates)) {
          lng = Number(f.geometry.coordinates[0]);
          lat = Number(f.geometry.coordinates[1]);
        }
        const sev = p.severity;
        const normalizedSev: WeatherAlertItem['severity'] =
          sev === 'Extreme' || sev === 'Severe' || sev === 'Moderate' || sev === 'Minor'
            ? sev
            : 'Unknown';
        weatherAlerts.push({
          id: f.id,
          event: p.event || 'Weather Advisory',
          headline: p.headline || p.event || 'Active NWS Weather Alert',
          severity: normalizedSev,
          areaDesc: p.areaDesc || 'NOAA Forecast Zone',
          senderName: p.senderName || 'NOAA National Weather Service',
          sentAt: p.sent || new Date().toISOString(),
          expiresAt: p.expires || null,
          latitude: Number.isFinite(lat) ? lat : null,
          longitude: Number.isFinite(lng) ? lng : null,
          source: 'NOAA National Weather Service',
          sourceUrl: 'https://www.weather.gov/',
        });
      }
    }

    // 3. NOAA NDBC Live Moored Ocean Buoys
    const noaaBuoys: NoaaBuoyObservation[] = [];
    let ndbcOk = false;
    if (ndbcRes.status === 'fulfilled' && ndbcRes.value.ok) {
      const txt = await ndbcRes.value.text();
      const lines = txt.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
      ndbcOk = lines.length > 0;
      const parseOpt = (v: string | undefined) => {
        if (!v || v === 'MM') return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };
      for (const line of lines) {
        const c = line.trim().split(/\s+/);
        if (c.length < 16) continue;
        const lat = Number(c[1]);
        const lng = Number(c[2]);
        const wave = parseOpt(c[9]);
        const sst = parseOpt(c[15]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        if (wave === null && sst === null) continue;
        noaaBuoys.push({
          stationId: c[0],
          latitude: lat,
          longitude: lng,
          observedAt: `${c[3]}-${c[4]}-${c[5]}T${c[6]}:${c[7]}:00Z`,
          windSpeedMs: parseOpt(c[8]),
          waveHeightM: wave,
          dominantPeriodS: parseOpt(c[10]),
          pressureHpa: parseOpt(c[13]),
          airTempC: parseOpt(c[14]),
          seaSurfaceTempC: sst,
          source: 'NOAA NDBC',
        });
        if (noaaBuoys.length >= 16) break;
      }
    }

    // 4. USGS Water Services River Streamflow Gauges
    const usgsRiverGauges: UsgsWaterGauge[] = [];
    let usgsWaterOk = false;
    if (usgsWaterRes.status === 'fulfilled' && usgsWaterRes.value.ok) {
      usgsWaterOk = true;
      const json = (await usgsWaterRes.value.json()) as {
        value?: {
          timeSeries?: Array<{
            sourceInfo: {
              siteName: string;
              siteCode: Array<{ value: string }>;
              geoLocation: {
                geogLocation: { latitude: number; longitude: number };
              };
            };
            variable: { variableCode: Array<{ value: string }> };
            values: Array<{ value: Array<{ value: string; dateTime: string }> }>;
          }>;
        };
      };
      const bySite = new Map<string, UsgsWaterGauge>();
      for (const ts of json.value?.timeSeries ?? []) {
        const code = ts.sourceInfo.siteCode?.[0]?.value;
        if (!code) continue;
        const latest = ts.values?.[0]?.value?.[0];
        const val = latest ? Number(latest.value) : null;
        const varCode = ts.variable?.variableCode?.[0]?.value;
        if (!bySite.has(code)) {
          bySite.set(code, {
            siteCode: code,
            siteName: ts.sourceInfo.siteName,
            latitude: ts.sourceInfo.geoLocation.geogLocation.latitude,
            longitude: ts.sourceInfo.geoLocation.geogLocation.longitude,
            dischargeCfs: null,
            gageHeightFt: null,
            observedAt: latest?.dateTime || new Date().toISOString(),
            source: 'USGS Water Services NWIS',
          });
        }
        const entry = bySite.get(code)!;
        if (val !== null && Number.isFinite(val) && val >= 0) {
          if (varCode === '00060') entry.dischargeCfs = val;
          if (varCode === '00065') entry.gageHeightFt = val;
        }
      }
      usgsRiverGauges.push(...bySite.values());
    }

    // 5. Satellite Catalog Feeds: NASA Earthdata CMR + ESA Copernicus Sentinel + Global Forest Watch
    const satelliteFeeds: SatelliteObservationRecord[] = [];
    let earthdataOk = false;
    let sentinelOk = false;
    let gfwOk = false;
    let gfwVersion: string | null = null;

    if (cmrRes.status === 'fulfilled' && cmrRes.value.ok) {
      const json = (await cmrRes.value.json()) as {
        feed?: {
          entry?: Array<{
            producer_granule_id?: string;
            dataset_id?: string;
            time_start?: string;
            updated?: string;
          }>;
        };
      };
      for (const e of (json.feed?.entry ?? []).slice(0, 2)) {
        earthdataOk = true;
        satelliteFeeds.push({
          provider: 'NASA Earthdata CMR',
          dataset: e.dataset_id || 'MOD09GA Terra Surface Reflectance',
          identifier: e.producer_granule_id || 'MOD09GA',
          timestamp: e.updated || e.time_start || new Date().toISOString(),
          summary: '1 km Daily Surface Reflectance NRT Granule',
        });
      }
    }

    if (copernicusRes.status === 'fulfilled' && copernicusRes.value.ok) {
      const json = (await copernicusRes.value.json()) as {
        value?: Array<{
          Name?: string;
          ContentDate?: { Start?: string };
          OriginDate?: string;
        }>;
      };
      for (const item of (json.value ?? []).slice(0, 2)) {
        sentinelOk = true;
        satelliteFeeds.push({
          provider: 'ESA Copernicus Sentinel',
          dataset: 'Copernicus Data Space OData',
          identifier: item.Name || 'Sentinel Product',
          timestamp: item.ContentDate?.Start || item.OriginDate || new Date().toISOString(),
          summary: 'ESA Copernicus Sentinel Earth Observation Product',
        });
      }
    }

    if (gfwLossRes.status === 'fulfilled' && gfwLossRes.value.ok) {
      const json = (await gfwLossRes.value.json()) as {
        data?: { dataset?: string; version?: string; updated_on?: string };
      };
      if (json.data) {
        gfwOk = true;
        gfwVersion = json.data.version || 'latest';
        satelliteFeeds.push({
          provider: 'Global Forest Watch',
          dataset: 'UMD Hansen Tree Cover Loss',
          identifier: `${json.data.dataset || 'umd_tree_cover_loss'} (${gfwVersion})`,
          timestamp: json.data.updated_on || new Date().toISOString(),
          summary: 'Global annual tree cover loss raster & forest change dataset',
        });
      }
    }

    if (gfwAlertsRes.status === 'fulfilled' && gfwAlertsRes.value.ok) {
      const json = (await gfwAlertsRes.value.json()) as {
        data?: { dataset?: string; version?: string; updated_on?: string };
      };
      if (json.data) {
        gfwOk = true;
        satelliteFeeds.push({
          provider: 'Global Forest Watch',
          dataset: 'GFW Integrated Deforestation Alerts',
          identifier: `${json.data.dataset || 'gfw_integrated_alerts'} (${json.data.version || 'latest'})`,
          timestamp: json.data.updated_on || new Date().toISOString(),
          summary: 'Near-real-time RADD/GLAD deforestation disturbance alerts',
        });
      }
    }

    return {
      co2Ppm,
      co2TrendPpm,
      co2Date,
      co2Ok,
      weatherAlerts,
      nwsOk,
      noaaBuoys,
      ndbcOk,
      usgsRiverGauges,
      usgsWaterOk,
      satelliteFeeds,
      earthdataOk,
      sentinelOk,
      gfwOk,
      gfwVersion,
    };
  });

  return data;
}

export async function fetchGlobalStationGrid(): Promise<{
  stations: GlobalStationReading[];
  weatherOk: boolean;
  aqiOk: boolean;
}> {
  const { data } = await withCache('global-station-grid', 5 * 60 * 1000, async () => {
    const lats = GLOBAL_REFERENCE_STATIONS.map((s) => s.latitude).join(',');
    const lngs = GLOBAL_REFERENCE_STATIONS.map((s) => s.longitude).join(',');

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,cloud_cover,surface_pressure,wind_speed_10m,weather_code&timezone=UTC`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lats}&longitude=${lngs}&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,uv_index&timezone=UTC`;

    const [weatherRes, aqiRes] = await Promise.allSettled([
      fetchWithTimeout(weatherUrl, {}, 12000),
      fetchWithTimeout(aqiUrl, {}, 12000),
    ]);

    let weatherOk = false;
    let aqiOk = false;
    let weatherPayload: Array<{ current?: Record<string, number | string> }> = [];
    let aqiPayload: Array<{ current?: Record<string, number | string> }> = [];

    if (weatherRes.status === 'fulfilled' && weatherRes.value.ok) {
      weatherOk = true;
      const parsed = await weatherRes.value.json();
      weatherPayload = Array.isArray(parsed) ? parsed : [parsed];
    }

    if (aqiRes.status === 'fulfilled' && aqiRes.value.ok) {
      aqiOk = true;
      const parsed = await aqiRes.value.json();
      aqiPayload = Array.isArray(parsed) ? parsed : [parsed];
    }

    const stations: GlobalStationReading[] = [];
    for (let i = 0; i < GLOBAL_REFERENCE_STATIONS.length; i++) {
      const ref = GLOBAL_REFERENCE_STATIONS[i];
      const w = weatherPayload[i]?.current;
      const a = aqiPayload[i]?.current;
      if (!w) continue;

      const temperatureC = Number(w.temperature_2m ?? 0);
      const humidityPct = Number(w.relative_humidity_2m ?? 50);
      const windSpeedKmh = Number(w.wind_speed_10m ?? 0);
      const precipitationMm = Number(w.precipitation ?? 0);
      const risk = estimateWildfireRisk({
        temperatureC,
        humidityPct,
        windSpeedKmh,
        recentPrecipMm: precipitationMm,
      });

      stations.push({
        id: ref.id,
        name: ref.name,
        country: ref.country,
        region: ref.region,
        biome: ref.biome,
        latitude: ref.latitude,
        longitude: ref.longitude,
        temperatureC,
        apparentTempC: Number(w.apparent_temperature ?? temperatureC),
        humidityPct,
        windSpeedKmh,
        precipitationMm,
        cloudCoverPct: Number(w.cloud_cover ?? 0),
        pressureHpa: Number(w.surface_pressure ?? 1013),
        weatherCode: Number(w.weather_code ?? 0),
        usAqi: a?.us_aqi !== undefined ? Number(a.us_aqi) : null,
        pm25: a?.pm2_5 !== undefined ? Number(a.pm2_5) : null,
        pm10: a?.pm10 !== undefined ? Number(a.pm10) : null,
        no2: a?.nitrogen_dioxide !== undefined ? Number(a.nitrogen_dioxide) : null,
        o3: a?.ozone !== undefined ? Number(a.ozone) : null,
        uvIndex: a?.uv_index !== undefined ? Number(a.uv_index) : null,
        baselineTempC: ref.baselineTempC,
        anomalyC: Number((temperatureC - ref.baselineTempC).toFixed(2)),
        wildfireRiskScore: risk.score,
        observedAt: String(w.time ?? new Date().toISOString()),
      });
    }

    return { stations, weatherOk, aqiOk };
  });

  return data;
}

export async function fetchOceanBuoys(): Promise<{
  buoys: OceanBuoyReading[];
  marineOk: boolean;
}> {
  const { data } = await withCache('ocean-buoy-grid', 10 * 60 * 1000, async () => {
    const lats = OCEAN_BUOYS.map((b) => b.latitude).join(',');
    const lngs = OCEAN_BUOYS.map((b) => b.longitude).join(',');

    const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lats}&longitude=${lngs}&current=wave_height,wave_direction,wave_period,swell_wave_height&timezone=UTC`;
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,wind_speed_10m&timezone=UTC`;

    const [marineRes, weatherRes] = await Promise.allSettled([
      fetchWithTimeout(marineUrl, {}, 12000),
      fetchWithTimeout(weatherUrl, {}, 12000),
    ]);

    let marineOk = false;
    let marinePayload: Array<{ current?: Record<string, number | string> }> = [];
    let weatherPayload: Array<{ current?: Record<string, number | string> }> = [];

    if (marineRes.status === 'fulfilled' && marineRes.value.ok) {
      marineOk = true;
      const parsed = await marineRes.value.json();
      marinePayload = Array.isArray(parsed) ? parsed : [parsed];
    }

    if (weatherRes.status === 'fulfilled' && weatherRes.value.ok) {
      const parsed = await weatherRes.value.json();
      weatherPayload = Array.isArray(parsed) ? parsed : [parsed];
    }

    const buoys: OceanBuoyReading[] = OCEAN_BUOYS.map((b, i) => {
      const m = marinePayload[i]?.current;
      const w = weatherPayload[i]?.current;
      return {
        id: b.id,
        basin: b.basin,
        latitude: b.latitude,
        longitude: b.longitude,
        waveHeightM: m?.wave_height !== undefined ? Number(m.wave_height) : null,
        wavePeriodS: m?.wave_period !== undefined ? Number(m.wave_period) : null,
        waveDirectionDeg:
          m?.wave_direction !== undefined ? Number(m.wave_direction) : null,
        swellHeightM:
          m?.swell_wave_height !== undefined ? Number(m.swell_wave_height) : null,
        airTempC: w?.temperature_2m !== undefined ? Number(w.temperature_2m) : null,
        windSpeedKmh:
          w?.wind_speed_10m !== undefined ? Number(w.wind_speed_10m) : null,
        observedAt: String(
          m?.time ?? w?.time ?? new Date().toISOString()
        ),
        source: 'Open-Meteo Marine & Atmospheric',
      };
    });

    return { buoys, marineOk };
  });

  return data;
}

export function getLatestGibsDate(): string {
  // NASA GIBS MODIS Terra/Aqua imagery is reliably complete 1–2 days prior to UTC today
  const d = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export async function buildPlanetaryOverview(): Promise<PlanetaryOverviewPayload> {
  const [eventsBundle, stationsBundle, oceanBundle, extraFeeds] = await Promise.all([
    fetchLiveNaturalEvents(),
    fetchGlobalStationGrid(),
    fetchOceanBuoys(),
    fetchNoaaAndUsgsFeeds(),
  ]);

  const stations = stationsBundle.stations;
  const events = eventsBundle.events;
  const oceanBuoys = oceanBundle.buoys;

  const meanStationTempC =
    stations.length > 0
      ? Number(
          (
            stations.reduce((acc, s) => acc + s.temperatureC, 0) /
            stations.length
          ).toFixed(2)
        )
      : 0;

  const meanTempAnomalyC =
    stations.length > 0
      ? Number(
          (
            stations.reduce((acc, s) => acc + s.anomalyC, 0) / stations.length
          ).toFixed(2)
        )
      : 0;

  const aqiStations = stations.filter((s) => s.usAqi !== null);
  const meanUsAqi =
    aqiStations.length > 0
      ? Math.round(
          aqiStations.reduce((acc, s) => acc + (s.usAqi ?? 0), 0) /
            aqiStations.length
        )
      : null;

  const elevatedAqiStations = aqiStations.filter(
    (s) => (s.usAqi ?? 0) >= 100
  ).length;

  const waveBuoys = oceanBuoys.filter((b) => b.waveHeightM !== null);
  const meanOceanWaveHeightM =
    waveBuoys.length > 0
      ? Number(
          (
            waveBuoys.reduce((acc, b) => acc + (b.waveHeightM ?? 0), 0) /
            waveBuoys.length
          ).toFixed(2)
        )
      : null;

  const activeWildfiresCount = events.filter(
    (e) => e.category === 'wildfires'
  ).length;

  const totalPrecipStationsMm = Number(
    stations.reduce((acc, s) => acc + s.precipitationMm, 0).toFixed(1)
  );

  const earthdataRecord = extraFeeds.satelliteFeeds.find(
    (f) => f.provider === 'NASA Earthdata CMR'
  );
  const sentinelRecord = extraFeeds.satelliteFeeds.find(
    (f) => f.provider === 'ESA Copernicus Sentinel'
  );
  const gmapsKey = getServerGoogleMapsKey();

  const sources: DataSourceStatus[] = [
    {
      id: 'google-maps-platform',
      name: 'Google Maps Platform (Maps JS, Places, Geocoding, Elevation & Environment)',
      provider: 'Google Maps Platform',
      status: 'live',
      requiresKey: true,
      configured: true,
      lastUpdated: new Date().toISOString(),
      note: gmapsKey
        ? 'Maps JS, Places (New), Geocoding, Elevation, Time Zone, Weather, Air Quality, Pollen & Solar server enrichments active.'
        : 'Client Maps JS, Places (New) & ElevationService active via frontend API key.',
    },
    {
      id: 'nasa-firms',
      name: 'NASA FIRMS Active Fire Detections',
      provider: 'NASA LANCE FIRMS',
      status: eventsBundle.firmsOk ? 'live' : 'unavailable',
      requiresKey: false,
      configured: true,
      lastUpdated: eventsBundle.firmsOk ? new Date().toISOString() : null,
      note:
        eventsBundle.firmsMode === 'map-key-viirs'
          ? `VIIRS Suomi-NPP 375m NRT feed active (${eventsBundle.firmsCount} hotspots).`
          : `MODIS C6.1 Global 24h NRT stream active (${eventsBundle.firmsCount} sampled hotspots). Set NASA_FIRMS_MAP_KEY for regional VIIRS full query.`,
    },
    {
      id: 'nasa-eonet',
      name: 'NASA EONET Natural Events',
      provider: 'NASA Earth Observatory',
      status: eventsBundle.eonetOk ? 'live' : 'unavailable',
      requiresKey: false,
      configured: true,
      lastUpdated: new Date().toISOString(),
      note: 'Active global wildfires, severe storms, floods, volcanoes, and drought.',
    },
    {
      id: 'nasa-gibs',
      name: 'NASA GIBS Orbital Satellite Tiles',
      provider: 'NASA EOSDIS GIBS',
      status: 'live',
      requiresKey: false,
      configured: true,
      lastUpdated: getLatestGibsDate(),
      note: 'MODIS Terra/Aqua TrueColor, LST, AOD, NDVI, SST, and IMERG tile layers.',
    },
    {
      id: 'nasa-power',
      name: 'NASA POWER Solar & Agroclimatology',
      provider: 'NASA Langley Research Center',
      status: 'live',
      requiresKey: false,
      configured: true,
      lastUpdated: getLatestGibsDate(),
      note: 'Daily solar irradiance (ALLSKY_SFC_SW_DWN), T2M & corrected precipitation per coordinate.',
    },
    {
      id: 'nasa-earthdata-cmr',
      name: 'NASA Earthdata CMR Granule Catalog',
      provider: 'NASA EOSDIS CMR',
      status: extraFeeds.earthdataOk ? 'live' : 'unavailable',
      requiresKey: false,
      configured: true,
      lastUpdated: earthdataRecord?.timestamp ?? null,
      note: 'Real-time MODIS & VIIRS Earth observation granule timestamps.',
    },
    {
      id: 'open-meteo-forecast',
      name: 'Open-Meteo Atmospheric Forecast & ERA5 Archive',
      provider: 'Open-Meteo / DWD / NOAA GFS / ECMWF',
      status: stationsBundle.weatherOk ? 'live' : 'unavailable',
      requiresKey: false,
      configured: true,
      lastUpdated: new Date().toISOString(),
      note: 'Real-time surface meteorology & 15-year ERA5 historical reanalysis.',
    },
    {
      id: 'open-meteo-aqi',
      name: 'Copernicus CAMS Air Quality',
      provider: 'Open-Meteo / ECMWF CAMS',
      status: stationsBundle.aqiOk ? 'live' : 'unavailable',
      requiresKey: false,
      configured: true,
      lastUpdated: new Date().toISOString(),
      note: 'PM2.5, PM10, NO2, O3, SO2, dust & US/European AQI telemetry.',
    },
    {
      id: 'copernicus-sentinel',
      name: 'ESA Copernicus Sentinel Data Space',
      provider: 'European Space Agency / Copernicus',
      status: extraFeeds.sentinelOk ? 'live' : 'unavailable',
      requiresKey: false,
      configured: true,
      lastUpdated: sentinelRecord?.timestamp ?? null,
      note: 'Sentinel-2 / Sentinel-3 Earth observation product catalogue.',
    },
    {
      id: 'noaa-nws-alerts',
      name: 'NOAA NWS Weather Alerts',
      provider: 'National Oceanic and Atmospheric Administration',
      status: extraFeeds.nwsOk ? 'live' : 'unavailable',
      requiresKey: false,
      configured: true,
      lastUpdated: new Date().toISOString(),
      note: `Active severe weather warnings & advisories (${extraFeeds.weatherAlerts.length} live alerts).`,
    },
    {
      id: 'noaa-ndbc-co2',
      name: 'NOAA NDBC Ocean Buoys & Mauna Loa CO₂',
      provider: 'NOAA GML & NDBC',
      status: extraFeeds.ndbcOk || extraFeeds.co2Ok ? 'live' : 'unavailable',
      requiresKey: false,
      configured: true,
      lastUpdated: extraFeeds.co2Date ?? new Date().toISOString(),
      note: `Live moored buoy SST/wave telemetry & Mauna Loa atmospheric CO₂ (${extraFeeds.co2Ppm ?? '—'} ppm).`,
    },
    {
      id: 'open-meteo-marine',
      name: 'Open-Meteo Marine & WaveWatch',
      provider: 'Open-Meteo / NOAA WaveWatch',
      status: oceanBundle.marineOk ? 'live' : 'unavailable',
      requiresKey: false,
      configured: true,
      lastUpdated: new Date().toISOString(),
      note: 'Global ocean basin wave height, swell, and marine conditions.',
    },
    {
      id: 'usgs-earthquakes',
      name: 'USGS Earthquake & Water Services',
      provider: 'U.S. Geological Survey',
      status: eventsBundle.usgsOk || extraFeeds.usgsWaterOk ? 'live' : 'unavailable',
      requiresKey: false,
      configured: true,
      lastUpdated: new Date().toISOString(),
      note: `M2.5+ seismic GeoJSON feed & ${extraFeeds.usgsRiverGauges.length} real-time NWIS river gauges.`,
    },
    {
      id: 'global-forest-watch',
      name: 'Global Forest Watch Data API',
      provider: 'World Resources Institute / GFW',
      status: extraFeeds.gfwOk ? 'live' : 'unavailable',
      requiresKey: false,
      configured: true,
      lastUpdated: new Date().toISOString(),
      note: `UMD Tree Cover Loss (${extraFeeds.gfwVersion ?? 'latest'}) & Integrated Deforestation Alerts catalog.`,
    },
    {
      id: 'openweather',
      name: 'OpenWeatherMap Cross-Check',
      provider: 'OpenWeather',
      status: process.env.OPENWEATHER_API_KEY ? 'live' : 'unconfigured',
      requiresKey: true,
      configured: Boolean(process.env.OPENWEATHER_API_KEY),
      lastUpdated: process.env.OPENWEATHER_API_KEY ? new Date().toISOString() : null,
      note: process.env.OPENWEATHER_API_KEY
        ? 'Active secondary surface meteorology cross-check per inspected coordinate.'
        : 'Optional: set OPENWEATHER_API_KEY on server for secondary station cross-check.',
    },
    {
      id: 'openaq',
      name: 'OpenAQ v3 Ground Monitors',
      provider: 'OpenAQ',
      status: process.env.OPENAQ_API_KEY ? 'live' : 'unconfigured',
      requiresKey: true,
      configured: Boolean(process.env.OPENAQ_API_KEY),
      lastUpdated: process.env.OPENAQ_API_KEY ? new Date().toISOString() : null,
      note: process.env.OPENAQ_API_KEY
        ? 'Active 25 km municipal ground monitor lookup per inspected coordinate.'
        : 'Optional: set OPENAQ_API_KEY on server to enrich Copernicus CAMS with ground sensors.',
    },
  ];

  return {
    summary: {
      meanStationTempC,
      meanTempAnomalyC,
      activeWildfiresCount,
      firmsHotspotsCount: eventsBundle.firmsCount,
      activeDisasterCount: events.length,
      weatherAlertsCount: extraFeeds.weatherAlerts.length,
      usgsRiverGaugesCount: extraFeeds.usgsRiverGauges.length,
      meanUsAqi,
      elevatedAqiStations,
      totalPrecipStationsMm,
      meanOceanWaveHeightM,
      atmosphericCo2Ppm: extraFeeds.co2Ppm,
      atmosphericCo2TrendPpm: extraFeeds.co2TrendPpm,
      atmosphericCo2Date: extraFeeds.co2Date,
      latestSatelliteDate: getLatestGibsDate(),
      earthdataLatestGranuleTime: earthdataRecord?.timestamp ?? null,
      sentinelLatestTimestamp: sentinelRecord?.timestamp ?? null,
      gfwLatestVersion: extraFeeds.gfwVersion,
      stationCount: stations.length,
      fetchedAt: new Date().toISOString(),
    },
    stations,
    events,
    weatherAlerts: extraFeeds.weatherAlerts,
    oceanBuoys,
    noaaBuoys: extraFeeds.noaaBuoys,
    usgsRiverGauges: extraFeeds.usgsRiverGauges,
    satelliteFeeds: extraFeeds.satelliteFeeds,
    sources,
  };
}

export function deriveLiveAlerts(overview: PlanetaryOverviewPayload): AlertItem[] {
  const alerts: AlertItem[] = [];

  for (const ev of overview.events.slice(0, 35)) {
    alerts.push({
      id: ev.id,
      category: ev.categoryLabel,
      severity: ev.severity,
      title: ev.title,
      description: ev.description,
      locationName: `${ev.latitude.toFixed(2)}°, ${ev.longitude.toFixed(2)}°`,
      latitude: ev.latitude,
      longitude: ev.longitude,
      source: ev.source,
      detectedAt: ev.date,
      acknowledged: false,
    });
  }

  for (const wa of overview.weatherAlerts.slice(0, 12)) {
    alerts.push({
      id: `nws-${wa.id}`,
      category: 'Weather Alert',
      severity:
        wa.severity === 'Extreme'
          ? 'critical'
          : wa.severity === 'Severe'
            ? 'high'
            : 'moderate',
      title: wa.event,
      description: `${wa.headline} · ${wa.areaDesc}`,
      locationName: wa.areaDesc.split(';')[0] || 'NOAA Forecast Zone',
      latitude: wa.latitude ?? 39.8283,
      longitude: wa.longitude ?? -98.5795,
      source: wa.source,
      detectedAt: wa.sentAt,
      acknowledged: false,
    });
  }

  for (const st of overview.stations) {
    if (st.anomalyC >= 4.0) {
      alerts.push({
        id: `heat-anom-${st.id}`,
        category: 'Extreme Temperature Anomaly',
        severity: st.anomalyC >= 6 ? 'critical' : 'high',
        title: `${st.name}: +${st.anomalyC.toFixed(1)} °C above reference baseline`,
        description: `Observed ${st.temperatureC.toFixed(1)} °C vs. ${st.baselineTempC.toFixed(1)} °C reference mean. Fire Weather Risk index ${st.wildfireRiskScore}/100.`,
        locationName: `${st.name}, ${st.country}`,
        latitude: st.latitude,
        longitude: st.longitude,
        source: 'Open-Meteo / Trend Engine',
        detectedAt: st.observedAt,
        acknowledged: false,
      });
    }
    if ((st.usAqi ?? 0) >= 150) {
      alerts.push({
        id: `aqi-${st.id}`,
        category: 'Unusual Air Pollution',
        severity: (st.usAqi ?? 0) >= 200 ? 'critical' : 'high',
        title: `${st.name}: US AQI ${st.usAqi} (Unhealthy)`,
        description: `PM2.5 ${st.pm25?.toFixed(1) ?? '—'} µg/m³ · PM10 ${st.pm10?.toFixed(1) ?? '—'} µg/m³ via Copernicus CAMS.`,
        locationName: `${st.name}, ${st.country}`,
        latitude: st.latitude,
        longitude: st.longitude,
        source: 'Copernicus CAMS / Open-Meteo',
        detectedAt: st.observedAt,
        acknowledged: false,
      });
    }
  }

  return alerts.sort((a, b) => {
    const rank = { critical: 4, high: 3, moderate: 2, low: 1 };
    return (
      rank[b.severity] - rank[a.severity] ||
      new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
    );
  });
}

export async function forwardGeocodeServer(
  query: string
): Promise<
  Array<{ name: string; country: string; latitude: number; longitude: number }>
> {
  const gmapsKey = getServerGoogleMapsKey();
  if (gmapsKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${encodeURIComponent(gmapsKey)}`;
      const res = await fetchWithTimeout(
        url,
        { headers: GMP_ATTRIBUTION_HEADER },
        6000
      );
      if (res.ok) {
        const json = (await res.json()) as {
          status: string;
          results?: Array<{
            formatted_address: string;
            geometry: { location: { lat: number; lng: number } };
            address_components?: Array<{ long_name: string; types: string[] }>;
          }>;
        };
        if (json.status === 'OK' && json.results && json.results.length > 0) {
          return json.results.slice(0, 6).map((r) => {
            const country =
              r.address_components?.find((c) => c.types.includes('country'))
                ?.long_name || 'Google Geocoding API';
            return {
              name: r.formatted_address,
              country,
              latitude: r.geometry.location.lat,
              longitude: r.geometry.location.lng,
            };
          });
        }
      }
    } catch {
      // Fall back to Open-Meteo Geocoding
    }
  }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`;
  const response = await fetchWithTimeout(url, {}, 7000);
  if (!response.ok) {
    throw new Error('Geocoding upstream error');
  }
  const json = (await response.json()) as {
    results?: Array<{
      name: string;
      country?: string;
      admin1?: string;
      latitude: number;
      longitude: number;
    }>;
  };
  return (json.results ?? []).map((r) => ({
    name: r.admin1 ? `${r.name}, ${r.admin1}` : r.name,
    country: r.country ?? '',
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

export async function reverseGeocodeServer(
  lat: number,
  lng: number
): Promise<{ name: string; country: string; adminArea: string }> {
  const gmapsKey = getServerGoogleMapsKey();

  if (gmapsKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${encodeURIComponent(gmapsKey)}`;
      const res = await fetchWithTimeout(
        url,
        { headers: GMP_ATTRIBUTION_HEADER },
        6000
      );
      if (res.ok) {
        const json = (await res.json()) as {
          status: string;
          results?: Array<{
            formatted_address: string;
            address_components: Array<{
              long_name: string;
              types: string[];
            }>;
          }>;
        };
        if (json.status === 'OK' && json.results && json.results[0]) {
          const comps = json.results[0].address_components;
          const locality =
            comps.find((c) => c.types.includes('locality'))?.long_name ||
            comps.find((c) =>
              c.types.includes('administrative_area_level_2')
            )?.long_name ||
            comps.find((c) =>
              c.types.includes('administrative_area_level_1')
            )?.long_name ||
            json.results[0].formatted_address.split(',')[0];
          const country =
            comps.find((c) => c.types.includes('country'))?.long_name ||
            'International / Ocean';
          const adminArea =
            comps.find((c) =>
              c.types.includes('administrative_area_level_1')
            )?.long_name || '';
          return { name: locality, country, adminArea };
        }
      }
    } catch {
      // Fall through cleanly
    }
  }

  let nearest = GLOBAL_REFERENCE_STATIONS[0];
  let bestDist = Infinity;
  for (const st of GLOBAL_REFERENCE_STATIONS) {
    const d = haversineKm(lat, lng, st.latitude, st.longitude);
    if (d < bestDist) {
      bestDist = d;
      nearest = st;
    }
  }
  if (bestDist < 45) {
    return {
      name: nearest.name,
      country: nearest.country,
      adminArea: nearest.region,
    };
  }
  return {
    name: `Sector ${lat.toFixed(2)}°, ${lng.toFixed(2)}°`,
    country: bestDist < 300 ? `Near ${nearest.name}, ${nearest.country}` : 'Global Sector',
    adminArea: `${lat >= 0 ? 'Northern' : 'Southern'} Hemisphere`,
  };
}

async function fetchLocationEnrichment(
  lat: number,
  lng: number
): Promise<LocationEnrichment> {
  const owmKey = process.env.OPENWEATHER_API_KEY?.trim() || '';
  const openAqKey = process.env.OPENAQ_API_KEY?.trim() || '';
  const gmapsKey = getServerGoogleMapsKey();

  let quotaExceeded = false;
  let openWeather: LocationEnrichment['openWeather'] = null;
  let openAq: LocationEnrichment['openAq'] = null;
  let googleMaps: LocationEnrichment['googleMaps'] = null;

  const checkQuota = (status: number, bodyText: string) => {
    if (status === 429 || bodyText.includes('RESOURCE_EXHAUSTED')) {
      quotaExceeded = true;
    }
  };

  const tasks: Array<Promise<void>> = [];

  if (owmKey) {
    tasks.push(
      (async () => {
        try {
          const res = await fetchWithTimeout(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${encodeURIComponent(owmKey)}`,
            {},
            6000
          );
          if (res.ok) {
            const j = (await res.json()) as any;
            openWeather = {
              tempC: Number(j.main?.temp ?? 0),
              feelsLikeC: Number(j.main?.feels_like ?? 0),
              humidityPct: Number(j.main?.humidity ?? 0),
              pressureHpa: Number(j.main?.pressure ?? 1013),
              windSpeedKmh: Number(((j.wind?.speed ?? 0) * 3.6).toFixed(1)),
              description: String(j.weather?.[0]?.description ?? 'Observed'),
              observedAt: j.dt
                ? new Date(j.dt * 1000).toISOString()
                : new Date().toISOString(),
              source: 'OpenWeatherMap API 2.5',
            };
          }
        } catch {
          // Optional enrichment failure should not block primary telemetry
        }
      })()
    );
  }

  if (openAqKey) {
    tasks.push(
      (async () => {
        try {
          const res = await fetchWithTimeout(
            `https://api.openaq.org/v3/locations?coordinates=${lat.toFixed(4)},${lng.toFixed(4)}&radius=25000&limit=1`,
            { headers: { 'X-API-Key': openAqKey } },
            6000
          );
          if (res.ok) {
            const j = (await res.json()) as {
              results?: Array<{
                name?: string;
                distance?: number;
                datetimeLast?: { utc?: string };
                sensors?: Array<{
                  parameter?: { name?: string; units?: string };
                  latest?: { value?: number };
                }>;
              }>;
            };
            const first = j.results?.[0];
            if (first) {
              openAq = {
                locationName: first.name || 'OpenAQ Municipal Station',
                distanceKm: Number(((first.distance ?? 0) / 1000).toFixed(1)),
                sensors: (first.sensors ?? []).slice(0, 5).map((s) => ({
                  parameter: s.parameter?.name || 'pm25',
                  value:
                    s.latest?.value !== undefined ? Number(s.latest.value) : null,
                  unit: s.parameter?.units || 'µg/m³',
                })),
                observedAt:
                  first.datetimeLast?.utc || new Date().toISOString(),
                source: 'OpenAQ v3 Ground Monitor',
              };
            }
          }
        } catch {
          // Optional enrichment
        }
      })()
    );
  }

  if (gmapsKey) {
    tasks.push(
      (async () => {
        const ts = Math.floor(Date.now() / 1000);
        const [elevRes, tzRes, wxRes, aqRes, pollenRes, solarRes, alertsRes] =
          await Promise.allSettled([
            fetchWithTimeout(
              `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}&key=${encodeURIComponent(gmapsKey)}`,
              { headers: GMP_ATTRIBUTION_HEADER },
              5000
            ),
            fetchWithTimeout(
              `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${ts}&key=${encodeURIComponent(gmapsKey)}`,
              { headers: GMP_ATTRIBUTION_HEADER },
              5000
            ),
            fetchWithTimeout(
              `https://weather.googleapis.com/v1/currentConditions:lookup?key=${encodeURIComponent(gmapsKey)}&location.latitude=${lat}&location.longitude=${lng}`,
              { headers: GMP_ATTRIBUTION_HEADER },
              5000
            ),
            fetchWithTimeout(
              `https://airquality.googleapis.com/v1/currentConditions:lookup?key=${encodeURIComponent(gmapsKey)}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...GMP_ATTRIBUTION_HEADER,
                },
                body: JSON.stringify({
                  universalAqi: true,
                  location: { latitude: lat, longitude: lng },
                  extraComputations: [
                    'HEALTH_RECOMMENDATIONS',
                    'LOCAL_AQI',
                    'POLLUTANT_CONCENTRATION',
                  ],
                  languageCode: 'en',
                }),
              },
              5000
            ),
            fetchWithTimeout(
              `https://pollen.googleapis.com/v1/forecast:lookup?key=${encodeURIComponent(gmapsKey)}&location.latitude=${lat}&location.longitude=${lng}&days=1&plantsDescription=false`,
              { headers: GMP_ATTRIBUTION_HEADER },
              5000
            ),
            fetchWithTimeout(
              `https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude=${lat.toFixed(5)}&location.longitude=${lng.toFixed(5)}&requiredQuality=BASE&key=${encodeURIComponent(gmapsKey)}`,
              { headers: GMP_ATTRIBUTION_HEADER },
              5000
            ),
            fetchWithTimeout(
              `https://weather.googleapis.com/v1/publicAlerts:lookup?key=${encodeURIComponent(gmapsKey)}&location.latitude=${lat}&location.longitude=${lng}&languageCode=en`,
              { headers: GMP_ATTRIBUTION_HEADER },
              5000
            ),
          ]);

        const gm: NonNullable<LocationEnrichment['googleMaps']> = {
          elevationM: null,
          elevationResolutionM: null,
          timeZoneId: null,
          timeZoneName: null,
          weather: null,
          airQuality: null,
          pollen: null,
          solar: null,
          weatherAlerts: [],
        };
        let anySuccess = false;

        if (elevRes.status === 'fulfilled') {
          const txt = await elevRes.value.text();
          checkQuota(elevRes.value.status, txt);
          if (elevRes.value.ok) {
            const j = JSON.parse(txt);
            if (j.status === 'OK' && j.results?.[0]) {
              gm.elevationM = Number(j.results[0].elevation.toFixed(1));
              gm.elevationResolutionM = j.results[0].resolution
                ? Number(j.results[0].resolution.toFixed(1))
                : null;
              anySuccess = true;
            }
          }
        }

        if (tzRes.status === 'fulfilled') {
          const txt = await tzRes.value.text();
          checkQuota(tzRes.value.status, txt);
          if (tzRes.value.ok) {
            const j = JSON.parse(txt);
            if (j.status === 'OK') {
              gm.timeZoneId = j.timeZoneId ?? null;
              gm.timeZoneName = j.timeZoneName ?? null;
              anySuccess = true;
            }
          }
        }

        if (wxRes.status === 'fulfilled') {
          const txt = await wxRes.value.text();
          checkQuota(wxRes.value.status, txt);
          if (wxRes.value.ok) {
            const j = JSON.parse(txt);
            if (j.temperature?.degrees !== undefined) {
              gm.weather = {
                tempC: Number(j.temperature.degrees),
                condition:
                  j.weatherCondition?.description?.text ||
                  j.weatherCondition?.type ||
                  'Observed',
                humidityPct: Number(j.relativeHumidity ?? 0),
                uvIndex: j.uvIndex !== undefined ? Number(j.uvIndex) : null,
                windKmh:
                  j.wind?.speed?.value !== undefined
                    ? Number(j.wind.speed.value)
                    : null,
              };
              anySuccess = true;
            }
          }
        }

        if (aqRes.status === 'fulfilled') {
          const txt = await aqRes.value.text();
          checkQuota(aqRes.value.status, txt);
          if (aqRes.value.ok) {
            const j = JSON.parse(txt);
            const idx = j.indexes?.[0];
            if (idx) {
              gm.airQuality = {
                uaqi: idx.aqi !== undefined ? Number(idx.aqi) : null,
                category: idx.category ?? null,
                dominantPollutant: idx.dominantPollutant ?? null,
                healthRecommendation:
                  j.healthRecommendations?.generalPopulation ?? null,
              };
              anySuccess = true;
            }
          }
        }

        if (pollenRes.status === 'fulfilled') {
          const txt = await pollenRes.value.text();
          checkQuota(pollenRes.value.status, txt);
          if (pollenRes.value.ok) {
            const j = JSON.parse(txt);
            const day = j.dailyInfo?.[0];
            if (day?.pollenTypeInfo) {
              const findUpi = (code: string) => {
                const entry = day.pollenTypeInfo.find(
                  (p: any) => p.code === code
                );
                return entry?.indexInfo?.value !== undefined
                  ? Number(entry.indexInfo.value)
                  : null;
              };
              const treeUpi = findUpi('TREE');
              const grassUpi = findUpi('GRASS');
              const weedUpi = findUpi('WEED');
              const firstDesc =
                day.pollenTypeInfo.find((p: any) => p.indexInfo?.category)
                  ?.indexInfo?.category ?? null;
              gm.pollen = {
                treeUpi,
                grassUpi,
                weedUpi,
                summary: firstDesc,
              };
              anySuccess = true;
            }
          }
        }

        if (solarRes.status === 'fulfilled') {
          const txt = await solarRes.value.text();
          // Solar API buildingInsights is optional per-coordinate coverage; do not trip global quota banner on 404/quota
          if (solarRes.value.ok) {
            const j = JSON.parse(txt);
            if (j.solarPotential) {
              gm.solar = {
                maxArrayPanelsCount: Number(
                  j.solarPotential.maxArrayPanelsCount ?? 0
                ),
                maxSunshineHoursPerYear: Math.round(
                  Number(j.solarPotential.maxSunshineHoursPerYear ?? 0)
                ),
                carbonOffsetFactorKgPerMwh: Math.round(
                  Number(j.solarPotential.carbonOffsetFactorKgPerMwh ?? 0)
                ),
              };
              anySuccess = true;
            }
          }
        }

        if (alertsRes.status === 'fulfilled') {
          const txt = await alertsRes.value.text();
          checkQuota(alertsRes.value.status, txt);
          if (alertsRes.value.ok) {
            const j = JSON.parse(txt);
            if (Array.isArray(j.weatherAlerts)) {
              gm.weatherAlerts = j.weatherAlerts.slice(0, 5).map((a: any) => ({
                title: a.alertTitle?.text || a.eventType || 'Weather Alert',
                severity: a.severity || 'MODERATE',
                agencyName: a.dataSource?.name || 'Official Weather Agency',
                agencyUrl:
                  a.dataSource?.authorityUri || 'https://www.weather.gov/',
              }));
              anySuccess = true;
            }
          }
        }

        if (anySuccess) {
          googleMaps = gm;
        }
      })()
    );
  }

  await Promise.all(tasks);
  return { openWeather, openAq, googleMaps, quotaExceeded };
}

export async function fetchLocationIntelligence(
  lat: number,
  lng: number,
  explicitName?: string
): Promise<LocationIntelligence> {
  const key = `loc-intel-v2:${lat.toFixed(2)},${lng.toFixed(2)}`;
  const { data } = await withCache(key, 5 * 60 * 1000, async () => {
    const now = new Date();
    const endArchive = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const startRecent90 = new Date(
      endArchive.getTime() - 60 * 24 * 60 * 60 * 1000
    );
    const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

    const powerEnd = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    const powerStart = new Date(powerEnd.getTime() - 21 * 24 * 60 * 60 * 1000);
    const fmtCompact = (d: Date) => fmtDate(d).replace(/-/g, '');

    const currentYear = now.getUTCFullYear();
    const monthDay = fmtDate(now).slice(5);
    const histStartYear = currentYear - 15;
    const histStart = `${histStartYear}-01-01`;
    const histEnd = fmtDate(endArchive);

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,cloud_cover,surface_pressure,wind_speed_10m,wind_direction_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&past_days=3&forecast_days=7&timezone=auto`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=us_aqi,european_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,dust,uv_index&timezone=auto`;
    const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${fmtDate(startRecent90)}&end_date=${fmtDate(endArchive)}&daily=temperature_2m_mean,precipitation_sum&timezone=UTC`;
    const longArchiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${histStart}&end_date=${histEnd}&daily=temperature_2m_mean&timezone=UTC`;
    const powerUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M,ALLSKY_SFC_SW_DWN,PRECTOTCORR&community=RE&longitude=${lng.toFixed(4)}&latitude=${lat.toFixed(4)}&start=${fmtCompact(powerStart)}&end=${fmtCompact(powerEnd)}&format=JSON`;

    const [
      geoPlace,
      weatherRes,
      aqiRes,
      archiveRes,
      longArchiveRes,
      powerRes,
      eventsBundle,
      enrichment,
    ] = await Promise.all([
      reverseGeocodeServer(lat, lng),
      fetchWithTimeout(weatherUrl, {}, 10000).catch(() => null),
      fetchWithTimeout(aqiUrl, {}, 10000).catch(() => null),
      fetchWithTimeout(archiveUrl, {}, 10000).catch(() => null),
      fetchWithTimeout(longArchiveUrl, {}, 12000).catch(() => null),
      fetchWithTimeout(powerUrl, {}, 10000).catch(() => null),
      fetchLiveNaturalEvents(),
      fetchLocationEnrichment(lat, lng),
    ]);

    const weatherJson =
      weatherRes && weatherRes.ok ? ((await weatherRes.json()) as any) : null;
    const aqiJson =
      aqiRes && aqiRes.ok ? ((await aqiRes.json()) as any) : null;
    const archiveJson =
      archiveRes && archiveRes.ok ? ((await archiveRes.json()) as any) : null;
    const longArchiveJson =
      longArchiveRes && longArchiveRes.ok
        ? ((await longArchiveRes.json()) as any)
        : null;
    const powerJson =
      powerRes && powerRes.ok ? ((await powerRes.json()) as any) : null;

    const curW = weatherJson?.current ?? {};
    const curA = aqiJson?.current ?? {};

    const temperatureC = Number(curW.temperature_2m ?? 0);
    const humidityPct = Number(curW.relative_humidity_2m ?? 50);
    const windSpeedKmh = Number(curW.wind_speed_10m ?? 0);
    const precipitationMm = Number(curW.precipitation ?? 0);
    const elevationM =
      enrichment.googleMaps?.elevationM ??
      (weatherJson?.elevation !== undefined ? Number(weatherJson.elevation) : null);

    const dailyTimes: string[] = weatherJson?.daily?.time ?? [];
    const dailyMax: number[] = weatherJson?.daily?.temperature_2m_max ?? [];
    const dailyMin: number[] = weatherJson?.daily?.temperature_2m_min ?? [];
    const dailyPrecip: number[] = weatherJson?.daily?.precipitation_sum ?? [];
    const dailyWind: number[] = weatherJson?.daily?.wind_speed_10m_max ?? [];

    const todayStr = fmtDate(now);
    const past3Precip = dailyTimes
      .map((t, idx) => (t < todayStr ? Number(dailyPrecip[idx] ?? 0) : 0))
      .reduce((a, b) => a + b, 0);

    const forecast7d: LocationIntelligence['forecast7d'] = [];
    for (let i = 0; i < dailyTimes.length; i++) {
      if (dailyTimes[i] >= todayStr && forecast7d.length < 7) {
        forecast7d.push({
          date: dailyTimes[i],
          tempMaxC: Number(dailyMax[i] ?? 0),
          tempMinC: Number(dailyMin[i] ?? 0),
          precipSumMm: Number(dailyPrecip[i] ?? 0),
          windMaxKmh: Number(dailyWind[i] ?? 0),
        });
      }
    }
    const forecast7dPrecip = forecast7d.reduce((a, b) => a + b.precipSumMm, 0);

    const longDates: string[] = longArchiveJson?.daily?.time ?? [];
    const longTemps: Array<number | null> =
      longArchiveJson?.daily?.temperature_2m_mean ?? [];
    const targetMonth = monthDay.slice(0, 2);
    const seasonalSamples: number[] = [];
    const annualBuckets = new Map<number, number[]>();

    for (let i = 0; i < longDates.length; i++) {
      const val = longTemps[i];
      if (val === null || val === undefined || !Number.isFinite(val)) continue;
      const yr = Number(longDates[i].slice(0, 4));
      const mo = longDates[i].slice(5, 7);
      if (mo === targetMonth) {
        seasonalSamples.push(val);
      }
      if (!annualBuckets.has(yr)) annualBuckets.set(yr, []);
      annualBuckets.get(yr)!.push(val);
    }

    const annualMeans = Array.from(annualBuckets.entries())
      .filter(([, vals]) => vals.length > 200)
      .map(([yr, vals]) => ({
        xYear: yr,
        yValue: vals.reduce((a, b) => a + b, 0) / vals.length,
      }))
      .sort((a, b) => a.xYear - b.xYear);

    const historicalAnomaly = detectTemperatureAnomaly(
      temperatureC,
      seasonalSamples.length >= 5
        ? seasonalSamples
        : (archiveJson?.daily?.temperature_2m_mean ?? []).filter(
            (v: unknown) => typeof v === 'number'
          ),
      `${histStartYear}–${currentYear} Seasonal Climatology (Month ${targetMonth})`
    );

    const climateTrend = analyzeTimeSeriesTrend(annualMeans);

    const powerParams = powerJson?.properties?.parameter ?? {};
    const solarMap: Record<string, number> = powerParams.ALLSKY_SFC_SW_DWN ?? {};
    const t2mMap: Record<string, number> = powerParams.T2M ?? {};
    const precipMap: Record<string, number> = powerParams.PRECTOTCORR ?? {};
    const validSolarVals = Object.values(solarMap).filter(
      (v) => typeof v === 'number' && v >= 0
    );
    const validT2mVals = Object.values(t2mMap).filter(
      (v) => typeof v === 'number' && v > -90
    );
    const validPrecipVals = Object.values(precipMap).filter(
      (v) => typeof v === 'number' && v >= 0
    );

    const recentArchiveDates: string[] = archiveJson?.daily?.time ?? [];
    const recentArchiveTemp: number[] =
      archiveJson?.daily?.temperature_2m_mean ?? [];
    const recentArchivePrecip: number[] =
      archiveJson?.daily?.precipitation_sum ?? [];

    const dailySeries = recentArchiveDates.slice(-30).map((d, idx) => {
      const compact = d.replace(/-/g, '');
      const sVal = solarMap[compact];
      return {
        date: d,
        tempMeanC: Number(
          recentArchiveTemp[recentArchiveDates.length - 30 + idx] ??
            recentArchiveTemp[idx] ??
            0
        ),
        precipMm: Number(
          recentArchivePrecip[recentArchiveDates.length - 30 + idx] ??
            recentArchivePrecip[idx] ??
            0
        ),
        solarKwhM2:
          typeof sVal === 'number' && sVal >= 0 ? Number(sVal.toFixed(2)) : null,
      };
    });

    const pm25 = curA.pm2_5 !== undefined ? Number(curA.pm2_5) : null;
    const pm10 = curA.pm10 !== undefined ? Number(curA.pm10) : null;
    const no2 =
      curA.nitrogen_dioxide !== undefined ? Number(curA.nitrogen_dioxide) : null;
    const o3 = curA.ozone !== undefined ? Number(curA.ozone) : null;

    const nearbyEvents = eventsBundle.events
      .map((ev) => ({
        ...ev,
        distanceKm: Math.round(haversineKm(lat, lng, ev.latitude, ev.longitude)),
      }))
      .filter((ev) => ev.distanceKm <= 1500)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 8);

    return {
      location: {
        name: explicitName || geoPlace.name,
        country: geoPlace.country,
        adminArea: geoPlace.adminArea,
        latitude: Number(lat.toFixed(4)),
        longitude: Number(lng.toFixed(4)),
        elevationM,
        timezone: String(
          enrichment.googleMaps?.timeZoneId ?? weatherJson?.timezone ?? 'UTC'
        ),
      },
      currentWeather: {
        temperatureC,
        apparentTempC: Number(curW.apparent_temperature ?? temperatureC),
        humidityPct,
        windSpeedKmh,
        windDirectionDeg: Number(curW.wind_direction_10m ?? 0),
        precipitationMm,
        cloudCoverPct: Number(curW.cloud_cover ?? 0),
        surfacePressureHpa: Number(curW.surface_pressure ?? 1013),
        weatherCode: Number(curW.weather_code ?? 0),
        weatherLabel: weatherCodeToLabel(Number(curW.weather_code ?? 0)),
        observedAt: String(curW.time ?? now.toISOString()),
        source: 'Open-Meteo Atmospheric Forecast',
      },
      airQuality: {
        usAqi: curA.us_aqi !== undefined ? Number(curA.us_aqi) : null,
        europeanAqi:
          curA.european_aqi !== undefined ? Number(curA.european_aqi) : null,
        pm25,
        pm10,
        no2,
        o3,
        so2:
          curA.sulphur_dioxide !== undefined
            ? Number(curA.sulphur_dioxide)
            : null,
        co:
          curA.carbon_monoxide !== undefined
            ? Number(curA.carbon_monoxide)
            : null,
        dust: curA.dust !== undefined ? Number(curA.dust) : null,
        uvIndex: curA.uv_index !== undefined ? Number(curA.uv_index) : null,
        whoExceedances: evaluateWhoAirQuality({ pm25, pm10, no2, o3 }),
        observedAt: String(curA.time ?? now.toISOString()),
        source: 'Copernicus CAMS / Open-Meteo',
      },
      solarAndClimate: {
        nasaPowerAvailable: validSolarVals.length > 0,
        recentSolarIrradianceKwhM2:
          validSolarVals.length > 0
            ? Number(
                (
                  validSolarVals.reduce((a, b) => a + b, 0) /
                  validSolarVals.length
                ).toFixed(2)
              )
            : null,
        recentMeanTempC:
          validT2mVals.length > 0
            ? Number(
                (
                  validT2mVals.reduce((a, b) => a + b, 0) / validT2mVals.length
                ).toFixed(2)
              )
            : null,
        recentTotalPrecipMm:
          validPrecipVals.length > 0
            ? Number(
                validPrecipVals.reduce((a, b) => a + b, 0).toFixed(1)
              )
            : null,
        dailySeries,
        source: 'NASA POWER + Open-Meteo ERA5 Reanalysis',
      },
      forecast7d,
      historicalAnomaly,
      climateTrend,
      wildfireRisk: estimateWildfireRisk({
        temperatureC,
        humidityPct,
        windSpeedKmh,
        recentPrecipMm: past3Precip + precipitationMm,
      }),
      floodRisk: estimateFloodRisk({
        recentPrecipMm: past3Precip + precipitationMm,
        forecast7dPrecipMm: forecast7dPrecip,
        elevationM,
      }),
      nearbyEvents,
      enrichment,
      fetchedAt: now.toISOString(),
    };
  });

  return data;
}
