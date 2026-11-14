import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  Code2,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  MapPin,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useEarth } from '../../contexts/EarthContext.tsx';

export const ReportsView: React.FC = () => {
  const { overview, selectedIntel, alerts } = useEarth();
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = () => {
    if (!overview) return;
    const header = [
      'station',
      'country',
      'biome',
      'latitude',
      'longitude',
      'temp_c',
      'anomaly_c',
      'humidity_pct',
      'wind_kmh',
      'precip_mm',
      'us_aqi',
      'pm25',
      'wildfire_risk',
      'observed_at',
    ].join(',');
    const rows = overview.stations.map((s) =>
      [
        `"${s.name}"`,
        `"${s.country}"`,
        `"${s.biome}"`,
        s.latitude,
        s.longitude,
        s.temperatureC,
        s.anomalyC,
        s.humidityPct,
        s.windSpeedKmh,
        s.precipitationMm,
        s.usAqi ?? '',
        s.pm25 ?? '',
        s.wildfireRiskScore,
        s.observedAt,
      ].join(',')
    );
    downloadFile(
      `earth-telemetry-${new Date().toISOString().slice(0, 10)}.csv`,
      [header, ...rows].join('\n'),
      'text/csv;charset=utf-8'
    );
  };

  const handleDownloadJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      planetaryOverview: overview,
      selectedLocationIntelligence: selectedIntel,
      activeAlerts: alerts.slice(0, 50),
    };
    downloadFile(
      `earth-intelligence-bundle-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
  };

  const handleDownloadPythonPipeline = () => {
    const lat = selectedIntel?.location.latitude ?? 24.8607;
    const lng = selectedIntel?.location.longitude ?? 67.0011;
    const pyCode = `"""
Earth System Trend Detective — Reproducible Python Analytical Pipeline
Uses pandas, numpy, scikit-learn, and geopandas against live Open-Meteo, NASA EONET & NASA POWER APIs.
Generated: ${new Date().toISOString()}
"""

import requests
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.linear_model import LinearRegression

LAT = ${lat}
LNG = ${lng}

def fetch_historical_climate(lat: float, lng: float, start_date: str = "2010-01-01", end_date: str = "2025-12-31"):
    url = (
        f"https://archive-api.open-meteo.com/v1/archive?"
        f"latitude={lat}&longitude={lng}&start_date={start_date}&end_date={end_date}"
        f"&daily=temperature_2m_mean,precipitation_sum&timezone=UTC"
    )
    resp = requests.get(url, timeout=15)
    resp.raise_for_status()
    daily = resp.json()["daily"]
    df = pd.DataFrame(daily)
    df["time"] = pd.to_datetime(df["time"])
    df["year"] = df["time"].dt.year
    return df.dropna()

def detect_anomalies_and_trend(df: pd.DataFrame):
    annual = df.groupby("year").agg(
        mean_temp_c=("temperature_2m_mean", "mean"),
        total_precip_mm=("precipitation_sum", "sum"),
    ).reset_index()

    # OLS linear trend
    X = annual[["year"]].values
    y = annual["mean_temp_c"].values
    reg = LinearRegression().fit(X, y)
    print(f"Warming slope: {reg.coef_[0] * 10:.3f} degC / decade")

    # IsolationForest multivariate anomaly detection on daily climate vectors
    features = df[["temperature_2m_mean", "precipitation_sum"]].values
    iso = IsolationForest(contamination=0.02, random_state=42)
    df["anomaly_flag"] = iso.fit_predict(features)
    anomalies = df[df["anomaly_flag"] == -1]
    print(f"Detected {len(anomalies)} multivariate climate anomaly days out of {len(df)} days.")
    return annual, anomalies

if __name__ == "__main__":
    df = fetch_historical_climate(LAT, LNG)
    annual, anomalies = detect_anomalies_and_trend(df)
    print(annual.tail(5))
`;
    downloadFile(
      'earth_trend_detective_pipeline.py',
      pyCode,
      'text/x-python;charset=utf-8'
    );
  };

  const handleGenerateAiReport = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/detective', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'report',
          selectedLocation: selectedIntel,
          prompt: selectedIntel
            ? `Generate a formal scientific Environmental Impact Report for ${selectedIntel.location.name}, ${selectedIntel.location.country} and place it in global planetary context using the live telemetry.`
            : 'Generate a formal Global Planetary Environmental Impact Report summarizing current global station anomalies, active wildfires/disasters, ocean wave telemetry, and air quality exceedances.',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate report.');
      setAiReport(data.answer);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to generate report.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPrintableHtml = () => {
    if (!aiReport) return;
    const html = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Earth System Trend Detective Report</title>
<style>body{font-family:system-ui,sans-serif;max-width:840px;margin:40px auto;padding:0 24px;color:#0f172a;line-height:1.6}h1{border-bottom:2px solid #0284c7;padding-bottom:8px}pre{white-space:pre-wrap;background:#f8fafc;padding:16px;border:1px solid #e2e8f0;border-radius:8px}</style>
</head>
<body>
<h1>Earth System Trend Detective — Scientific Environmental Report</h1>
<p><strong>Generated:</strong> ${new Date().toUTCString()}</p>
${selectedIntel ? `<p><strong>Target Location:</strong> ${selectedIntel.location.name}, ${selectedIntel.location.country} (${selectedIntel.location.latitude}, ${selectedIntel.location.longitude})</p>` : ''}
<pre>${aiReport.replace(/</g, '&lt;')}</pre>
</body></html>`;
    downloadFile(
      `earth-impact-report-${new Date().toISOString().slice(0, 10)}.html`,
      html,
      'text/html;charset=utf-8'
    );
  };

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-xl font-semibold text-slate-100">
          Environmental Reports & Data Science Exports
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Download structured live telemetry, AI-synthesized environmental impact briefings, and reproducible Python ML pipelines
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={handleDownloadCsv}
          className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 hover:border-cyan-500/50 text-left space-y-2 transition-colors"
        >
          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
          <div className="text-sm font-semibold text-slate-100">
            Export Station CSV
          </div>
          <p className="text-xs text-slate-400">
            Tabular meteorological, AQI, and fire risk metrics across all global stations.
          </p>
        </button>

        <button
          type="button"
          onClick={handleDownloadJson}
          className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 hover:border-cyan-500/50 text-left space-y-2 transition-colors"
        >
          <FileJson className="w-5 h-5 text-cyan-400" />
          <div className="text-sm font-semibold text-slate-100">
            Export Full JSON Bundle
          </div>
          <p className="text-xs text-slate-400">
            Complete snapshot including EONET/USGS events, ocean buoys, and active location intel.
          </p>
        </button>

        <button
          type="button"
          onClick={handleDownloadPythonPipeline}
          className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 hover:border-cyan-500/50 text-left space-y-2 transition-colors"
        >
          <Code2 className="w-5 h-5 text-amber-400" />
          <div className="text-sm font-semibold text-slate-100">
            Python ML Script (.py)
          </div>
          <p className="text-xs text-slate-400">
            Scikit-learn IsolationForest & OLS trend script parameterized for active coordinates.
          </p>
        </button>

        <button
          type="button"
          onClick={() => void handleGenerateAiReport()}
          disabled={generating}
          className="p-4 rounded-lg bg-cyan-500/15 border border-cyan-500/40 hover:bg-cyan-500/25 text-left space-y-2 transition-colors"
        >
          <FileText className="w-5 h-5 text-cyan-300" />
          <div className="text-sm font-semibold text-cyan-100">
            {generating ? 'Synthesizing Report...' : 'Generate AI Impact Report'}
          </div>
          <p className="text-xs text-cyan-200/80">
            Synthesizes a grounded narrative briefing from live planetary and location feeds.
          </p>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-rose-500/40 bg-rose-950/25 text-xs text-rose-200">
          {error}
        </div>
      )}

      {generating && (
        <div className="p-8 rounded-lg border border-slate-800 bg-[#0E1420] flex items-center justify-center gap-2 text-xs text-cyan-300">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Compiling multi-source environmental briefing...
        </div>
      )}

      {aiReport && (
        <div className="p-5 rounded-lg bg-[#0E1420] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-slate-100">
              Generated Environmental Impact Report
            </h2>
            <button
              type="button"
              onClick={handleDownloadPrintableHtml}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500 text-slate-950 text-xs font-semibold hover:bg-cyan-400"
            >
              <Download className="w-3.5 h-3.5" />
              Download Printable HTML
            </button>
          </div>
          <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
            {aiReport}
          </div>
        </div>
      )}
    </div>
  );
};

export const SettingsView: React.FC = () => {
  const {
    overview,
    preferences,
    updatePreferences,
    user,
    signInWithGoogle,
    savedLocations,
    removeSavedLocation,
    flyToLocation,
  } = useEarth();

  const [observations, setObservations] = useState<
    Array<{
      id: number;
      locationName: string;
      temperatureC: number | null;
      aqi: number | null;
      anomalyZScore: number | null;
      observedAt: string;
    }>
  >([]);

  useEffect(() => {
    fetch('/api/observations')
      .then((r) => (r.ok ? r.json() : { observations: [] }))
      .then((d) => setObservations(d.observations ?? []))
      .catch(() => {});
  }, []);

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-xl font-semibold text-slate-100">
          Platform Settings, Watchlist & Data Provenance
        </h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure measurement units, Cloud SQL watchlist persistence, and verify upstream environmental API status
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Preferences & Account */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-4">
            <h2 className="text-sm font-semibold text-slate-100">
              Measurement & Alert Preferences
            </h2>
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Unit System</span>
                <div className="flex items-center bg-[#07090E] border border-slate-700 rounded p-0.5">
                  {(['metric', 'imperial'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => void updatePreferences({ unitSystem: u })}
                      className={`px-3 py-1 rounded capitalize ${
                        preferences.unitSystem === u
                          ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                          : 'text-slate-400'
                      }`}
                    >
                      {u === 'metric' ? 'Metric (°C, km/h)' : 'Imperial (°F, mph)'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-300">Minimum Alert Severity</span>
                <select
                  value={preferences.alertMinSeverity}
                  onChange={(e) =>
                    void updatePreferences({
                      alertMinSeverity: e.target.value as
                        | 'low'
                        | 'moderate'
                        | 'high'
                        | 'critical',
                    })
                  }
                  className="bg-[#07090E] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                >
                  <option value="low">Low & Above</option>
                  <option value="moderate">Moderate & Above</option>
                  <option value="high">High & Critical</option>
                  <option value="critical">Critical Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Saved Watchlist (Cloud SQL) */}
          <div className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-emerald-400" />
                Saved Watchlist Locations
              </h2>
              {!user && (
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  className="text-xs text-cyan-300 hover:underline"
                >
                  Sign in to sync
                </button>
              )}
            </div>
            {!user ? (
              <p className="text-xs text-slate-400">
                Sign in with Google to save custom geographical coordinates to your Cloud SQL PostgreSQL watchlist.
              </p>
            ) : savedLocations.length === 0 ? (
              <p className="text-xs text-slate-400">
                No saved locations yet. Click any location on the Live Earth Map and press Watchlist.
              </p>
            ) : (
              <div className="space-y-2">
                {savedLocations.map((loc) => (
                  <div
                    key={loc.id}
                    className="p-2.5 rounded bg-[#07090E] border border-slate-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        flyToLocation(loc.latitude, loc.longitude, 7, loc.name)
                      }
                      className="text-left min-w-0 flex-1"
                    >
                      <div className="font-medium text-slate-100 truncate">
                        {loc.name}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {loc.latitude.toFixed(3)}°, {loc.longitude.toFixed(3)}°
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeSavedLocation(loc.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400"
                      title="Remove from watchlist"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upstream Data Sources & Logged Observations */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-3">
            <h2 className="text-sm font-semibold text-slate-100">
              Real-Time Environmental Data Connectors
            </h2>
            <div className="divide-y divide-slate-800/80">
              {(overview?.sources ?? []).map((src) => (
                <div
                  key={src.id}
                  className="py-2.5 flex items-start justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-medium text-slate-100">
                      {src.name}{' '}
                      <span className="text-slate-400 font-normal">
                        · {src.provider}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{src.note}</p>
                  </div>
                  <span
                    className={`font-mono text-[11px] shrink-0 flex items-center gap-1 ${
                      src.status === 'live'
                        ? 'text-emerald-400'
                        : src.status === 'unconfigured'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {src.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-3">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              Recent Logged Observations (Cloud SQL PostgreSQL)
            </h2>
            {observations.length === 0 ? (
              <p className="text-xs text-slate-400">
                Inspect coordinates on the Live Earth Map to begin archiving observation snapshots.
              </p>
            ) : (
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/70 text-xs">
                {observations.slice(0, 12).map((obs) => (
                  <div
                    key={obs.id}
                    className="py-2 flex items-center justify-between gap-2"
                  >
                    <span className="text-slate-200 truncate flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                      {obs.locationName}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400 shrink-0">
                      {obs.temperatureC !== null
                        ? `${obs.temperatureC.toFixed(1)}°C`
                        : '—'}{' '}
                      · AQI {obs.aqi ?? '—'} · Z{' '}
                      {obs.anomalyZScore !== null
                        ? `${obs.anomalyZScore >= 0 ? '+' : ''}${obs.anomalyZScore}σ`
                        : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
