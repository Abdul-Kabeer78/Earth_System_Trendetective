import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { isDatabaseConfigured } from './src/db/index.ts';
import {
  acknowledgeAlert,
  addSavedLocation,
  deleteSavedLocation,
  getObservationHistory,
  getOrCreateUser,
  getSavedLocations,
  getStoredAlerts,
  logEnvironmentalObservation,
  updateUserPreferences,
  upsertAlerts,
} from './src/db/repositories.ts';
import { AuthRequest, optionalAuth, requireAuth } from './src/middleware/auth.ts';
import { runEarthAiDetective } from './src/server/ai-detective.ts';
import { analyzeTimeSeriesTrend } from './src/server/analytics.ts';
import { fetchWithTimeout, withCache } from './src/server/cache.ts';
import {
  buildPlanetaryOverview,
  deriveLiveAlerts,
  fetchLocationIntelligence,
  forwardGeocodeServer,
} from './src/server/connectors.ts';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '2mb' }));

// Health endpoint
app.get('/api/health', (_req, res) => {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim() || '';
  const geminiKey =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || '';
  const mapsKey =
    process.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    '';
  const aiProvider = openRouterKey && openRouterKey !== 'your_api_key_here'
    ? 'openrouter'
    : geminiKey && geminiKey !== 'your_api_key_here'
      ? 'gemini'
      : 'none';
  res.json({
    status: 'ok',
    databaseConfigured: isDatabaseConfigured(),
    aiProvider,
    openRouterConfigured: Boolean(
      openRouterKey && openRouterKey !== 'your_api_key_here'
    ),
    geminiConfigured: Boolean(geminiKey && geminiKey !== 'your_api_key_here'),
    googleMapsConfigured: Boolean(mapsKey && mapsKey !== 'MY_GOOGLE_MAPS_API_KEY'),
    timestamp: new Date().toISOString(),
  });
});

// Planetary Overview (stations, events, ocean buoys, source status)
app.get('/api/planet/overview', async (_req, res) => {
  try {
    const overview = await buildPlanetaryOverview();
    res.json(overview);
  } catch (error: any) {
    console.error('Error building planetary overview:', error);
    res
      .status(502)
      .json({ error: error?.message || 'Failed to retrieve planetary telemetry.' });
  }
});

// Location Intelligence (weather, historical baseline, ML anomaly, trend, AQI, NASA POWER, risks, nearby events)
app.get('/api/location/intelligence', optionalAuth, async (req: AuthRequest, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const name = typeof req.query.name === 'string' ? req.query.name : undefined;

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'Valid latitude (-90..90) and longitude (-180..180) are required.' });
  }

  try {
    const intel = await fetchLocationIntelligence(lat, lng, name);

    // Non-blocking background persistence of observation snapshot when DB is configured
    if (isDatabaseConfigured()) {
      logEnvironmentalObservation({
        uid: req.user?.uid ?? null,
        email: req.user?.email ?? null,
        locationKey: `${lat.toFixed(2)},${lng.toFixed(2)}`,
        locationName: `${intel.location.name}, ${intel.location.country}`,
        latitude: intel.location.latitude,
        longitude: intel.location.longitude,
        source: 'Open-Meteo + CAMS + NASA POWER',
        temperatureC: intel.currentWeather.temperatureC,
        humidityPct: intel.currentWeather.humidityPct,
        windSpeedKmh: intel.currentWeather.windSpeedKmh,
        precipitationMm: intel.currentWeather.precipitationMm,
        aqi: intel.airQuality.usAqi,
        pm25: intel.airQuality.pm25,
        anomalyZScore: intel.historicalAnomaly.zScore,
        wildfireRiskScore: intel.wildfireRisk.score,
        floodRiskScore: intel.floodRisk.score,
      }).catch((err) => {
        console.warn('Non-blocking observation log skipped:', err?.message);
      });
    }

    res.json(intel);
  } catch (error: any) {
    console.error('Error fetching location intelligence:', error);
    res.status(502).json({ error: 'Unable to fetch environmental intelligence for these coordinates.' });
  }
});

// Historical Climate Multi-Year Time Series for Climate Intelligence View
app.get('/api/climate/timeseries', async (req, res) => {
  const lat = Number(req.query.lat ?? 24.8607);
  const lng = Number(req.query.lng ?? 67.0011);
  const years = Math.min(30, Math.max(5, Number(req.query.years ?? 15)));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ error: 'Invalid coordinates.' });
  }

  try {
    const { data } = await withCache(
      `climate-ts:${lat.toFixed(2)},${lng.toFixed(2)},${years}`,
      30 * 60 * 1000,
      async () => {
        const end = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
        const startYear = end.getUTCFullYear() - years;
        const startDate = `${startYear}-01-01`;
        const endDate = end.toISOString().slice(0, 10);

        const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&start_date=${startDate}&end_date=${endDate}&daily=temperature_2m_mean,precipitation_sum&timezone=UTC`;
        const response = await fetchWithTimeout(url, {}, 15000);
        if (!response.ok) {
          throw new Error(`Open-Meteo Archive HTTP ${response.status}`);
        }
        const json = (await response.json()) as {
          daily?: {
            time: string[];
            temperature_2m_mean: Array<number | null>;
            precipitation_sum: Array<number | null>;
          };
        };

        const dates = json.daily?.time ?? [];
        const temps = json.daily?.temperature_2m_mean ?? [];
        const precips = json.daily?.precipitation_sum ?? [];

        const byYear = new Map<
          number,
          { temps: number[]; precipTotal: number; hotDays: number }
        >();
        const byMonth = new Map<string, { temps: number[]; precips: number[] }>();

        for (let i = 0; i < dates.length; i++) {
          const d = dates[i];
          const t = temps[i];
          const p = precips[i];
          const yr = Number(d.slice(0, 4));
          const mo = d.slice(5, 7);

          if (!byYear.has(yr)) {
            byYear.set(yr, { temps: [], precipTotal: 0, hotDays: 0 });
          }
          const yBucket = byYear.get(yr)!;
          if (typeof t === 'number' && Number.isFinite(t)) {
            yBucket.temps.push(t);
            if (t >= 35) yBucket.hotDays += 1;
          }
          if (typeof p === 'number' && Number.isFinite(p)) {
            yBucket.precipTotal += p;
          }

          if (!byMonth.has(mo)) byMonth.set(mo, { temps: [], precips: [] });
          if (typeof t === 'number') byMonth.get(mo)!.temps.push(t);
          if (typeof p === 'number') byMonth.get(mo)!.precips.push(p);
        }

        const annualSeries = Array.from(byYear.entries())
          .filter(([, b]) => b.temps.length > 180)
          .sort((a, b) => a[0] - b[0])
          .map(([year, b]) => ({
            year,
            meanTempC: Number(
              (b.temps.reduce((acc, v) => acc + v, 0) / b.temps.length).toFixed(2)
            ),
            totalPrecipMm: Number(b.precipTotal.toFixed(1)),
            extremeHeatDays: b.hotDays,
          }));

        const baselineMean =
          annualSeries.length > 0
            ? annualSeries.reduce((acc, a) => acc + a.meanTempC, 0) /
              annualSeries.length
            : 0;

        const annualWithAnomaly = annualSeries.map((row) => ({
          ...row,
          anomalyC: Number((row.meanTempC - baselineMean).toFixed(2)),
        }));

        const monthNames = [
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
        ];
        const monthlyClimatology = Array.from({ length: 12 }, (_, idx) => {
          const mo = String(idx + 1).padStart(2, '0');
          const b = byMonth.get(mo);
          const avgT =
            b && b.temps.length > 0
              ? b.temps.reduce((a, v) => a + v, 0) / b.temps.length
              : 0;
          const avgP =
            b && b.precips.length > 0
              ? (b.precips.reduce((a, v) => a + v, 0) / b.precips.length) * 30
              : 0;
          return {
            month: monthNames[idx],
            meanTempC: Number(avgT.toFixed(2)),
            meanMonthlyPrecipMm: Number(avgP.toFixed(1)),
          };
        });

        const tempTrend = analyzeTimeSeriesTrend(
          annualWithAnomaly.map((r) => ({ xYear: r.year, yValue: r.meanTempC }))
        );
        const precipTrend = analyzeTimeSeriesTrend(
          annualWithAnomaly.map((r) => ({ xYear: r.year, yValue: r.totalPrecipMm }))
        );

        return {
          latitude: lat,
          longitude: lng,
          yearsAnalyzed: annualWithAnomaly.length,
          baselineMeanC: Number(baselineMean.toFixed(2)),
          annualSeries: annualWithAnomaly,
          monthlyClimatology,
          tempTrend,
          precipTrend,
          source: 'Open-Meteo ERA5 Historical Archive',
          fetchedAt: new Date().toISOString(),
        };
      }
    );

    res.json(data);
  } catch (error: any) {
    console.error('Climate timeseries error:', error);
    res.status(502).json({ error: 'Failed to retrieve historical climate series.' });
  }
});

// Server-side Geocoding Search Proxy (prevents CORS trap & protects server key)
app.get('/api/geocode/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) {
    return res.status(400).json({ error: 'Query parameter q is required.' });
  }

  // Check if user entered direct "lat, lng" coordinates
  const coordMatch = q.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (coordMatch) {
    const lat = Number(coordMatch[1]);
    const lng = Number(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return res.json({
        results: [
          {
            name: `Coordinates ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            country: 'Direct Coordinate Lookup',
            latitude: lat,
            longitude: lng,
          },
        ],
      });
    }
  }

  try {
    const results = await forwardGeocodeServer(q);
    res.json({ results });
  } catch (error) {
    console.error('Geocode search error:', error);
    res.status(502).json({ error: 'Failed to search locations.' });
  }
});

// Alerts: merges live EONET/USGS/anomaly alerts and persists/reads Cloud SQL alert_records
app.get('/api/alerts', async (_req, res) => {
  try {
    const overview = await buildPlanetaryOverview();
    const liveAlerts = deriveLiveAlerts(overview);

    if (!isDatabaseConfigured()) {
      return res.json({ alerts: liveAlerts, fetchedAt: new Date().toISOString() });
    }

    // Sync to PostgreSQL in background / upsert
    try {
      await upsertAlerts(
        liveAlerts.map((a) => ({
          externalId: a.id,
          category: a.category,
          severity: a.severity,
          title: a.title,
          description: a.description,
          locationName: a.locationName,
          latitude: a.latitude,
          longitude: a.longitude,
          source: a.source,
          detectedAt: new Date(a.detectedAt),
        }))
      );
      const stored = await getStoredAlerts(80);
      const ackMap = new Map(stored.map((s) => [s.externalId, s]));
      const merged = liveAlerts.map((a) => {
        const dbRow = ackMap.get(a.id);
        return {
          ...a,
          dbId: dbRow?.id,
          acknowledged: dbRow?.acknowledged ?? false,
        };
      });
      return res.json({ alerts: merged, fetchedAt: new Date().toISOString() });
    } catch {
      return res.json({ alerts: liveAlerts, fetchedAt: new Date().toISOString() });
    }
  } catch (error) {
    console.error('Error loading alerts:', error);
    res.status(502).json({ error: 'Failed to fetch environmental alerts.' });
  }
});

app.post('/api/alerts/:id/ack', requireAuth, async (req: AuthRequest, res) => {
  const dbId = Number(req.params.id);
  if (!Number.isInteger(dbId)) {
    return res.status(400).json({ error: 'Valid numeric alert id required.' });
  }
  try {
    const updated = await acknowledgeAlert(dbId, req.user!.uid);
    if (!updated) return res.status(404).json({ error: 'Alert record not found.' });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to acknowledge alert.' });
  }
});

// Authenticated User Profile & Preferences
app.get('/api/user/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(
      req.user!.uid,
      req.user!.email || `${req.user!.uid}@users.local`,
      req.user!.name ?? null
    );
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load profile.' });
  }
});

app.patch('/api/user/preferences', requireAuth, async (req: AuthRequest, res) => {
  const { unitSystem, alertMinSeverity, defaultRegion } = req.body ?? {};
  try {
    await getOrCreateUser(
      req.user!.uid,
      req.user!.email || `${req.user!.uid}@users.local`,
      req.user!.name ?? null
    );
    const updated = await updateUserPreferences(req.user!.uid, {
      unitSystem,
      alertMinSeverity,
      defaultRegion,
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save preferences.' });
  }
});

// Saved Watchlist Locations
app.get('/api/watchlist', requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await getSavedLocations(req.user!.uid);
    res.json({ locations: items });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to load watchlist.' });
  }
});

app.post('/api/watchlist', requireAuth, async (req: AuthRequest, res) => {
  const { name, country, latitude, longitude, notes } = req.body ?? {};
  if (!name || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
    return res.status(400).json({ error: 'name, latitude, and longitude are required.' });
  }
  try {
    const created = await addSavedLocation(
      req.user!.uid,
      req.user!.email || `${req.user!.uid}@users.local`,
      {
        name: String(name),
        country: country ? String(country) : null,
        latitude: Number(latitude),
        longitude: Number(longitude),
        notes: notes ? String(notes) : null,
      }
    );
    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to save location.' });
  }
});

app.delete('/api/watchlist/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid location id.' });
  }
  try {
    const deleted = await deleteSavedLocation(req.user!.uid, id);
    if (!deleted) return res.status(404).json({ error: 'Location not found.' });
    res.json({ deleted: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to delete location.' });
  }
});

// Observation History (from PostgreSQL when configured)
app.get('/api/observations', async (_req, res) => {
  if (!isDatabaseConfigured()) {
    return res.json({ observations: [], localStatelessMode: true });
  }
  try {
    const observations = await getObservationHistory(40);
    res.json({ observations });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch observation log.' });
  }
});

// Earth AI Detective (OpenRouter grounded in live telemetry)
app.post('/api/ai/detective', async (req, res) => {
  const { prompt, mode, selectedLocation, compareCities, history } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'A prompt question is required.' });
  }

  try {
    const result = await runEarthAiDetective({
      prompt: prompt.trim(),
      mode,
      selectedLocation,
      compareCities,
      history,
    });
    res.json(result);
  } catch (error: any) {
    console.error('Earth AI Detective error:', error);
    const msg = error?.message || 'Earth AI Detective failed to generate response.';
    const status = msg.includes('OPENROUTER_API_KEY') ? 503 : 500;
    res.status(status).json({ error: msg });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `Earth System Trend Detective listening on http://localhost:${PORT} (0.0.0.0:${PORT})`
    );
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
