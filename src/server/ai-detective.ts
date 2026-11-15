import type {
  LocationIntelligence,
  PlanetaryOverviewPayload,
} from '../types/earth.ts';
import {
  buildPlanetaryOverview,
  fetchLocationIntelligence,
  GLOBAL_REFERENCE_STATIONS,
} from './connectors.ts';
import { fetchWithTimeout } from './cache.ts';

interface OpenRouterChatCompletion {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

function getConfiguredAiProvider():
  | {
      provider: 'openrouter' | 'gemini';
      apiKey: string;
      model: string;
    }
  | null {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey && openRouterKey !== 'your_api_key_here') {
    return {
      provider: 'openrouter',
      apiKey: openRouterKey,
      model: process.env.OPENROUTER_MODEL?.trim() || 'openai/gpt-4o-mini',
    };
  }

  const geminiKey =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (geminiKey && geminiKey !== 'your_api_key_here') {
    return {
      provider: 'gemini',
      apiKey: geminiKey,
      model:
        process.env.GEMINI_MODEL?.trim() ||
        process.env.GOOGLE_MODEL?.trim() ||
        'gemini-3.8-flash',
    };
  }

  return null;
}

function buildMissingApiKeyResponse(): {
  answer: string;
  referencedSources: string[];
  generatedAt: string;
} {
  return {
    answer:
      'AI Detective is currently unavailable because no AI provider key is configured on the server. Add OPENROUTER_API_KEY or GEMINI_API_KEY (or GOOGLE_API_KEY) to your .env file and restart the app to enable live climate and environmental analysis.',
    referencedSources: [],
    generatedAt: new Date().toISOString(),
  };
}

async function resolveCityToCoords(
  cityQuery: string
): Promise<{ name: string; lat: number; lng: number } | null> {
  const lower = cityQuery.toLowerCase();
  const ref = GLOBAL_REFERENCE_STATIONS.find(
    (s) =>
      lower.includes(s.name.toLowerCase()) ||
      lower.includes(s.id.replace('-', ' '))
  );
  if (ref) {
    return { name: ref.name, lat: ref.latitude, lng: ref.longitude };
  }

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityQuery)}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (res.ok) {
      const json = (await res.json()) as {
        results?: Array<{
          name: string;
          country?: string;
          latitude: number;
          longitude: number;
        }>;
      };
      const first = json.results?.[0];
      if (first) {
        return {
          name: first.country ? `${first.name}, ${first.country}` : first.name,
          lat: first.latitude,
          lng: first.longitude,
        };
      }
    }
  } catch {
    // Ignore geocoding error
  }
  return null;
}

export async function runEarthAiDetective(params: {
  prompt: string;
  mode?: 'chat' | 'location-analysis' | 'compare' | 'report';
  selectedLocation?: LocationIntelligence | null;
  compareCities?: [string, string] | null;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
}): Promise<{
  answer: string;
  referencedSources: string[];
  generatedAt: string;
}> {
  const configuredAi = getConfiguredAiProvider();
  if (!configuredAi) {
    return buildMissingApiKeyResponse();
  }

  const { provider, apiKey, model } = configuredAi;
  const overview: PlanetaryOverviewPayload = await buildPlanetaryOverview();

  let primaryLocation: LocationIntelligence | null = null;
  if (params.selectedLocation) {
    const raw = params.selectedLocation as Partial<LocationIntelligence> & {
      lat?: number;
      lng?: number;
      name?: string;
    };
    if (raw.currentWeather && raw.location) {
      primaryLocation = params.selectedLocation;
    } else if (
      typeof (raw.lat ?? raw.location?.latitude) === 'number' &&
      typeof (raw.lng ?? raw.location?.longitude) === 'number'
    ) {
      primaryLocation = await fetchLocationIntelligence(
        (raw.lat ?? raw.location?.latitude) as number,
        (raw.lng ?? raw.location?.longitude) as number,
        raw.name ?? raw.location?.name
      );
    }
  }
  const comparedIntel: LocationIntelligence[] = [];

  // If comparing two cities, fetch live intelligence for both
  if (params.compareCities && params.compareCities[0] && params.compareCities[1]) {
    const [c1, c2] = await Promise.all([
      resolveCityToCoords(params.compareCities[0]),
      resolveCityToCoords(params.compareCities[1]),
    ]);
    const fetches = await Promise.all([
      c1 ? fetchLocationIntelligence(c1.lat, c1.lng, c1.name) : null,
      c2 ? fetchLocationIntelligence(c2.lat, c2.lng, c2.name) : null,
    ]);
    for (const item of fetches) {
      if (item) comparedIntel.push(item);
    }
  } else if (!primaryLocation) {
    // Detect if the prompt mentions a known reference city so we enrich context
    const mentioned = GLOBAL_REFERENCE_STATIONS.find((s) =>
      params.prompt.toLowerCase().includes(s.name.toLowerCase())
    );
    if (mentioned) {
      primaryLocation = await fetchLocationIntelligence(
        mentioned.latitude,
        mentioned.longitude,
        `${mentioned.name}, ${mentioned.country}`
      );
    }
  }

  const groundedContext = {
    planetarySummary: overview.summary,
    globalStationsSnapshot: overview.stations.map((s) => ({
      name: s.name,
      country: s.country,
      tempC: s.temperatureC,
      anomalyC: s.anomalyC,
      humidityPct: s.humidityPct,
      precipMm: s.precipitationMm,
      windKmh: s.windSpeedKmh,
      usAqi: s.usAqi,
      pm25: s.pm25,
      wildfireRiskScore: s.wildfireRiskScore,
    })),
    activeNaturalEventsSample: overview.events.slice(0, 30).map((e) => ({
      title: e.title,
      category: e.categoryLabel,
      severity: e.severity,
      lat: e.latitude,
      lng: e.longitude,
      date: e.date,
      source: e.source,
    })),
    activeWeatherAlertsSample: overview.weatherAlerts.slice(0, 10),
    oceanBuoysSnapshot: overview.oceanBuoys,
    noaaMooredBuoysSample: overview.noaaBuoys.slice(0, 8),
    usgsRiverGauges: overview.usgsRiverGauges,
    satelliteObservationsCatalog: overview.satelliteFeeds,
    selectedLocationIntelligence: primaryLocation
      ? {
          location: primaryLocation.location,
          currentWeather: primaryLocation.currentWeather,
          airQuality: primaryLocation.airQuality,
          historicalAnomaly: primaryLocation.historicalAnomaly,
          climateTrend: primaryLocation.climateTrend,
          wildfireRisk: primaryLocation.wildfireRisk,
          floodRisk: primaryLocation.floodRisk,
          nearbyEvents: primaryLocation.nearbyEvents,
          enrichment: primaryLocation.enrichment ?? null,
          solarAndClimate: primaryLocation.solarAndClimate
            ? {
                recentSolarIrradianceKwhM2:
                  primaryLocation.solarAndClimate.recentSolarIrradianceKwhM2,
                recentMeanTempC: primaryLocation.solarAndClimate.recentMeanTempC,
                recentTotalPrecipMm:
                  primaryLocation.solarAndClimate.recentTotalPrecipMm,
              }
            : null,
        }
      : null,
    comparedLocations: comparedIntel.map((c) => ({
      location: c.location,
      currentWeather: c.currentWeather,
      airQuality: c.airQuality,
      historicalAnomaly: c.historicalAnomaly,
      climateTrend: c.climateTrend,
      wildfireRisk: c.wildfireRisk,
      floodRisk: c.floodRisk,
      enrichment: c.enrichment ?? null,
    })),
  };

  const systemInstruction = [
    'You are EARTH AI DETECTIVE, an empirical geospatial and climate intelligence analyst.',
    'STRICT SCIENTIFIC INTEGRITY RULES:',
    '1. Base ALL numbers, coordinates, temperatures, AQI readings, CO2 ppm, river discharge, event counts, and trends EXCLUSIVELY on the LIVE_TELEMETRY_JSON provided below. Never invent, extrapolate, or recall statistics from memory.',
    '2. If a requested metric or location is not present in LIVE_TELEMETRY_JSON, state clearly that live telemetry for that specific parameter has not been queried yet and suggest selecting the location on the map.',
    '3. Communicate scientific uncertainty clearly: distinguish observed synoptic anomalies from long-term climate trends, never claim correlation proves causation, and explicitly note that Wildfire/Flood Risk scores are statistical screening indices, not confirmed disaster predictions.',
    '4. Format responses with crisp markdown headings, bulleted metrics with explicit units and data source citations (e.g., Open-Meteo, NASA EONET v3, NASA FIRMS, NASA POWER, NASA Earthdata CMR, Copernicus CAMS, ESA Sentinel, NOAA NWS, NOAA NDBC, NOAA Mauna Loa CO2, USGS Earthquakes, USGS Water Services, Global Forest Watch, Google Maps Platform), and actionable analytical takeaways.',
  ].join('\n');

  const historyText =
    params.history && params.history.length > 0
      ? `\n\nCONVERSATION HISTORY:\n${params.history
          .slice(-6)
          .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
          .join('\n')}`
      : '';

  const userPayload = `LIVE_TELEMETRY_JSON:\n${JSON.stringify(groundedContext)}${historyText}\n\nUSER REQUEST (${params.mode ?? 'chat'}):\n${params.prompt}`;

  let answer: string;

  if (provider === 'openrouter') {
    const response = await fetchWithTimeout(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer':
            process.env.APP_URL?.trim() || 'http://localhost:3000',
          'X-Title': 'Earth System Trend Detective',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPayload },
          ],
        }),
      },
      60000
    );
    const completion = (await response.json()) as OpenRouterChatCompletion;

    if (!response.ok) {
      throw new Error(
        completion.error?.message ||
          `OpenRouter request failed with HTTP ${response.status}.`
      );
    }

    answer = completion.choices?.[0]?.message?.content?.trim() ?? '';
    if (!answer) {
      throw new Error('OpenRouter returned an empty response.');
    }
  } else {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: [
        { role: 'user', parts: [{ text: `${systemInstruction}\n\n${userPayload}` }] },
      ],
    });

    const extractedText =
      response.text?.trim() ||
      response.candidates
        ?.map((candidate) =>
          candidate.content?.parts
            ?.map((part) => part.text ?? '')
            .join('')
            .trim()
        )
        .filter(Boolean)
        .join('\n\n')
        .trim();

    if (!extractedText) {
      throw new Error('Gemini returned an empty response.');
    }

    answer = extractedText;
  }

  const referencedSources = overview.sources
    .filter((s) => s.status === 'live')
    .map((s) => s.name);

  return {
    answer,
    referencedSources,
    generatedAt: new Date().toISOString(),
  };
}
