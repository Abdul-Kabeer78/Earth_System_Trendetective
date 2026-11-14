import React, { useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  Bot,
  CloudRain,
  Compass,
  Flame,
  Gauge,
  History,
  MapPin,
  RefreshCw,
  Sun,
  Thermometer,
  Wind,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useEarth } from '../contexts/EarthContext.tsx';

export const LocationIntelligenceDrawer: React.FC = () => {
  const {
    selectedIntel,
    intelLoading,
    intelError,
    intelDrawerOpen,
    setIntelDrawerOpen,
    saveCurrentLocation,
    setCompareModalOpen,
    openAiDetectiveWithPrompt,
    formatTemp,
    formatSpeed,
    user,
  } = useEarth();

  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  if (!intelDrawerOpen) return null;

  const handleAnalyzeLocation = async () => {
    if (!selectedIntel) return;
    setAiLoading(true);
    setAiError(null);
    setAiAnalysis(null);
    try {
      const res = await fetch('/api/ai/detective', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'location-analysis',
          selectedLocation: selectedIntel,
          prompt: `Provide a structured scientific environmental briefing for ${selectedIntel.location.name}, ${selectedIntel.location.country} (${selectedIntel.location.latitude}, ${selectedIntel.location.longitude}). Summarize current meteorology, temperature anomaly Z-score, air quality vs WHO guidelines, wildfire and flood screening indices, nearby disasters, and uncertainty limits.`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed.');
      setAiAnalysis(data.answer);
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : 'Unable to run AI analysis.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedIntel) return;
    await saveCurrentLocation({
      name: selectedIntel.location.name,
      country: selectedIntel.location.country,
      latitude: selectedIntel.location.latitude,
      longitude: selectedIntel.location.longitude,
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <aside className="fixed top-12 right-0 bottom-0 w-full sm:w-[440px] bg-[#0B111C]/96 backdrop-blur-md border-l border-slate-800 z-30 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-100 truncate">
              {selectedIntel
                ? `${selectedIntel.location.name}`
                : 'Location Intelligence'}
            </h2>
            <p className="text-[11px] font-mono text-slate-400 truncate">
              {selectedIntel
                ? `${selectedIntel.location.country} · ${selectedIntel.location.latitude.toFixed(4)}°, ${selectedIntel.location.longitude.toFixed(4)}°`
                : 'Querying environmental telemetry...'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIntelDrawerOpen(false)}
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
          aria-label="Close Location Intelligence"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {intelLoading && (
          <div className="py-12 flex flex-col items-center justify-center text-center gap-2">
            <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
            <p className="text-xs text-slate-300">
              Retrieving Open-Meteo, NASA POWER, CAMS AQI, and 15-year archive baselines...
            </p>
          </div>
        )}

        {intelError && !intelLoading && (
          <div className="p-4 border border-rose-500/40 bg-rose-950/30 rounded-lg text-xs text-rose-200">
            {intelError}
          </div>
        )}

        {selectedIntel && !intelLoading && (
          <>
            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void handleAnalyzeLocation()}
                disabled={aiLoading}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-md transition-colors whitespace-nowrap disabled:opacity-60"
              >
                <Bot className="w-3.5 h-3.5" />
                {aiLoading ? 'Analyzing...' : 'Analyze This Location'}
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors whitespace-nowrap"
              >
                <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
                {savedNotice ? 'Saved' : user ? 'Watchlist' : 'Sign in & Save'}
              </button>
              <button
                type="button"
                onClick={() => setCompareModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md transition-colors whitespace-nowrap"
              >
                <History className="w-3.5 h-3.5 text-amber-400" />
                Compare
              </button>
            </div>

            {/* Inline AI Detective Briefing */}
            {(aiAnalysis || aiError) && (
              <div className="p-3.5 rounded-lg border border-cyan-500/40 bg-[#08101C] space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-cyan-300">
                  <span>EARTH AI DETECTIVE BRIEFING</span>
                  <button
                    type="button"
                    onClick={() =>
                      openAiDetectiveWithPrompt(
                        `Continue deeper analysis on ${selectedIntel.location.name}, ${selectedIntel.location.country}.`
                      )
                    }
                    className="underline hover:text-cyan-200"
                  >
                    Open in Chat
                  </button>
                </div>
                {aiError ? (
                  <p className="text-xs text-rose-300">{aiError}</p>
                ) : (
                  <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {aiAnalysis}
                  </div>
                )}
              </div>
            )}

            {/* Primary Meteorological Telemetry Grid */}
            <section className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold text-slate-200">
                  Live Surface Meteorology
                </span>
                <span className="font-mono">
                  {selectedIntel.currentWeather.weatherLabel} · Elev{' '}
                  {selectedIntel.location.elevationM ?? '—'} m
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-lg bg-[#0E1624] border border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Temperature</span>
                    <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-xl font-mono font-semibold text-slate-100">
                    {formatTemp(selectedIntel.currentWeather.temperatureC)}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    Feels {formatTemp(selectedIntel.currentWeather.apparentTempC)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#0E1624] border border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Humidity & Cloud</span>
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div className="text-xl font-mono font-semibold text-slate-100">
                    {selectedIntel.currentWeather.humidityPct.toFixed(0)}%
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    Cloud cover {selectedIntel.currentWeather.cloudCoverPct}%
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#0E1624] border border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Wind Speed</span>
                    <Wind className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <div className="text-xl font-mono font-semibold text-slate-100">
                    {formatSpeed(selectedIntel.currentWeather.windSpeedKmh)}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    Bearing {selectedIntel.currentWeather.windDirectionDeg}°
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#0E1624] border border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Precipitation</span>
                    <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <div className="text-xl font-mono font-semibold text-slate-100">
                    {selectedIntel.currentWeather.precipitationMm.toFixed(1)} mm
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    {selectedIntel.currentWeather.surfacePressureHpa.toFixed(0)} hPa
                  </div>
                </div>
              </div>
            </section>

            {/* Air Quality (Copernicus CAMS) */}
            <section className="p-3.5 rounded-lg bg-[#0E1624] border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                  Air Quality (Copernicus CAMS)
                </span>
                <span className="font-mono text-xs font-semibold text-cyan-300">
                  US AQI {selectedIntel.airQuality.usAqi ?? '—'}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center font-mono text-[11px]">
                <div className="p-2 rounded bg-[#07090E] border border-slate-800/80">
                  <div className="text-slate-400">PM2.5</div>
                  <div className="text-slate-100 font-semibold mt-0.5">
                    {selectedIntel.airQuality.pm25?.toFixed(1) ?? '—'}
                  </div>
                </div>
                <div className="p-2 rounded bg-[#07090E] border border-slate-800/80">
                  <div className="text-slate-400">PM10</div>
                  <div className="text-slate-100 font-semibold mt-0.5">
                    {selectedIntel.airQuality.pm10?.toFixed(1) ?? '—'}
                  </div>
                </div>
                <div className="p-2 rounded bg-[#07090E] border border-slate-800/80">
                  <div className="text-slate-400">NO₂</div>
                  <div className="text-slate-100 font-semibold mt-0.5">
                    {selectedIntel.airQuality.no2?.toFixed(1) ?? '—'}
                  </div>
                </div>
                <div className="p-2 rounded bg-[#07090E] border border-slate-800/80">
                  <div className="text-slate-400">O₃</div>
                  <div className="text-slate-100 font-semibold mt-0.5">
                    {selectedIntel.airQuality.o3?.toFixed(1) ?? '—'}
                  </div>
                </div>
              </div>
              {selectedIntel.airQuality.whoExceedances.length > 0 && (
                <ul className="space-y-1 text-[11px] text-amber-300 pt-1">
                  {selectedIntel.airQuality.whoExceedances.map((msg, i) => (
                    <li key={i}>▲ {msg}</li>
                  ))}
                </ul>
              )}
            </section>

            {/* Historical Climatology Anomaly & Trend */}
            <section className="p-3.5 rounded-lg bg-[#0E1624] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">
                  Historical Climate Anomaly
                </span>
                <span
                  className={`font-mono text-xs font-semibold ${
                    selectedIntel.historicalAnomaly.zScore >= 1.5
                      ? 'text-rose-400'
                      : selectedIntel.historicalAnomaly.zScore <= -1.5
                        ? 'text-sky-400'
                        : 'text-emerald-400'
                  }`}
                >
                  Z = {selectedIntel.historicalAnomaly.zScore >= 0 ? '+' : ''}
                  {selectedIntel.historicalAnomaly.zScore}σ
                </span>
              </div>
              <div className="text-xs text-slate-300">
                <span className="font-medium text-slate-100">
                  {selectedIntel.historicalAnomaly.classification}
                </span>{' '}
                · Baseline mean{' '}
                <span className="font-mono">
                  {formatTemp(selectedIntel.historicalAnomaly.baselineMean)}
                </span>{' '}
                ({selectedIntel.historicalAnomaly.percentile}th percentile)
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {selectedIntel.historicalAnomaly.uncertaintyNote}
              </p>
              <div className="pt-1 border-t border-slate-800/80 text-[11px] text-slate-400">
                Multi-year Mann-Kendall slope:{' '}
                <span className="font-mono text-slate-200">
                  {selectedIntel.climateTrend.slopePerYear >= 0 ? '+' : ''}
                  {selectedIntel.climateTrend.slopePerYear.toFixed(3)} °C/yr
                </span>{' '}
                (p ≈ {selectedIntel.climateTrend.pValueApprox.toFixed(3)})
              </div>
            </section>

            {/* NASA POWER Solar + 30-Day Trend Sparkline */}
            <section className="p-3.5 rounded-lg bg-[#0E1624] border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  30-Day Thermal & Solar Profile
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  {selectedIntel.solarAndClimate.recentSolarIrradianceKwhM2 !== null
                    ? `${selectedIntel.solarAndClimate.recentSolarIrradianceKwhM2} kWh/m²/d`
                    : 'ERA5 Reanalysis'}
                </span>
              </div>
              <div className="h-32 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selectedIntel.solarAndClimate.dailySeries}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      tickFormatter={(v: string) => v.slice(5)}
                      minTickGap={18}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#94a3b8' }}
                      width={32}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#07090E',
                        borderColor: '#1e293b',
                        fontSize: '11px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="tempMeanC"
                      name="Mean Temp (°C)"
                      stroke="#06b6d4"
                      fill="#06b6d4"
                      fillOpacity={0.18}
                      strokeWidth={1.75}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Environmental Risk Screening */}
            <section className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-lg bg-[#0E1624] border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    Wildfire Risk
                  </span>
                  <span className="font-mono text-orange-300 font-semibold">
                    {selectedIntel.wildfireRisk.score}/100
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-100">
                  {selectedIntel.wildfireRisk.level}
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  {selectedIntel.wildfireRisk.drivers[0]}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#0E1624] border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                    Flood Risk
                  </span>
                  <span className="font-mono text-sky-300 font-semibold">
                    {selectedIntel.floodRisk.score}/100
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-100">
                  {selectedIntel.floodRisk.level}
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  {selectedIntel.floodRisk.drivers[0]}
                </p>
              </div>
            </section>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Risk disclaimer: {selectedIntel.wildfireRisk.uncertaintyDisclaimer}
            </p>

            {/* Multi-Source Enrichments (Google Maps Environment, OpenWeather, OpenAQ) */}
            {(selectedIntel.enrichment?.googleMaps ||
              selectedIntel.enrichment?.openWeather ||
              selectedIntel.enrichment?.openAq) && (
              <section className="p-3.5 rounded-lg bg-[#0E1624] border border-slate-800 space-y-2.5">
                <div className="text-xs font-semibold text-slate-200">
                  Supplemental Multi-Agency Enrichments
                </div>

                {selectedIntel.enrichment.googleMaps && (
                  <div className="space-y-2 text-[11px]">
                    {selectedIntel.enrichment.googleMaps.airQuality && (
                      <div className="p-2.5 rounded bg-[#07090E] border border-slate-800">
                        <div className="flex items-center justify-between text-slate-200 font-medium">
                          <span>Google Air Quality (UAQI)</span>
                          <span className="font-mono text-cyan-300">
                            {selectedIntel.enrichment.googleMaps.airQuality.uaqi ?? '—'} ·{' '}
                            {selectedIntel.enrichment.googleMaps.airQuality.category ?? ''}
                          </span>
                        </div>
                        {selectedIntel.enrichment.googleMaps.airQuality
                          .healthRecommendation && (
                          <p className="text-slate-400 mt-1">
                            {
                              selectedIntel.enrichment.googleMaps.airQuality
                                .healthRecommendation
                            }
                          </p>
                        )}
                      </div>
                    )}

                    {selectedIntel.enrichment.googleMaps.pollen && (
                      <div className="p-2.5 rounded bg-[#07090E] border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-300">Google Pollen UPI</span>
                        <span className="font-mono text-emerald-300">
                          Tree {selectedIntel.enrichment.googleMaps.pollen.treeUpi ?? '—'} · Grass{' '}
                          {selectedIntel.enrichment.googleMaps.pollen.grassUpi ?? '—'} · Weed{' '}
                          {selectedIntel.enrichment.googleMaps.pollen.weedUpi ?? '—'}
                        </span>
                      </div>
                    )}

                    {selectedIntel.enrichment.googleMaps.solar && (
                      <div className="p-2.5 rounded bg-[#07090E] border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-300">Google Solar Rooftop</span>
                        <span className="font-mono text-amber-300">
                          {selectedIntel.enrichment.googleMaps.solar.maxArrayPanelsCount} panels ·{' '}
                          {selectedIntel.enrichment.googleMaps.solar.maxSunshineHoursPerYear} hr/yr
                        </span>
                      </div>
                    )}

                    {selectedIntel.enrichment.googleMaps.weatherAlerts.length > 0 && (
                      <div className="space-y-1">
                        {selectedIntel.enrichment.googleMaps.weatherAlerts.map(
                          (wa, i) => (
                            <div
                              key={i}
                              className="p-2 rounded bg-amber-950/30 border border-amber-500/40"
                            >
                              <div className="font-medium text-amber-200">
                                {wa.title} ({wa.severity})
                              </div>
                              <div className="text-[10px] text-slate-300 mt-0.5">
                                Source:{' '}
                                <a
                                  href={wa.agencyUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline text-cyan-300"
                                >
                                  {wa.agencyName}
                                </a>
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}

                {selectedIntel.enrichment.openWeather && (
                  <div className="p-2.5 rounded bg-[#07090E] border border-slate-800 text-[11px] flex items-center justify-between">
                    <span className="text-slate-300">
                      OpenWeatherMap ({selectedIntel.enrichment.openWeather.description})
                    </span>
                    <span className="font-mono text-slate-100">
                      {formatTemp(selectedIntel.enrichment.openWeather.tempC)} ·{' '}
                      {selectedIntel.enrichment.openWeather.humidityPct}% RH
                    </span>
                  </div>
                )}

                {selectedIntel.enrichment.openAq && (
                  <div className="p-2.5 rounded bg-[#07090E] border border-slate-800 text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-slate-200 font-medium">
                      <span>OpenAQ: {selectedIntel.enrichment.openAq.locationName}</span>
                      <span className="font-mono text-cyan-300">
                        {selectedIntel.enrichment.openAq.distanceKm} km away
                      </span>
                    </div>
                    <div className="font-mono text-slate-400">
                      {selectedIntel.enrichment.openAq.sensors
                        .map((s) => `${s.parameter}: ${s.value ?? '—'} ${s.unit}`)
                        .join(' · ')}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Nearby Natural Events */}
            <section className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Nearby Active Events (within 1,500 km)
              </h3>
              {selectedIntel.nearbyEvents.length === 0 ? (
                <p className="text-xs text-slate-400">
                  No active NASA EONET or USGS M2.5+ events detected within 1,500 km.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {selectedIntel.nearbyEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2.5 rounded-md bg-[#0E1624] border border-slate-800 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-100 truncate">
                          {ev.title}
                        </span>
                        <span className="font-mono text-[11px] text-cyan-300 shrink-0">
                          {ev.distanceKm} km
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {ev.categoryLabel} · {ev.source} ·{' '}
                        {new Date(ev.date).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  );
};
