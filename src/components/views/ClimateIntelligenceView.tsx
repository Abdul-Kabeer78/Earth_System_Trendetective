import React, { useEffect, useState } from 'react';
import { RefreshCw, TrendingUp } from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useEarth } from '../../contexts/EarthContext.tsx';
import type { TrendAnalysisResult } from '../../types/earth.ts';

interface ClimateSeriesResponse {
  latitude: number;
  longitude: number;
  yearsAnalyzed: number;
  baselineMeanC: number;
  annualSeries: Array<{
    year: number;
    meanTempC: number;
    totalPrecipMm: number;
    extremeHeatDays: number;
    anomalyC: number;
  }>;
  monthlyClimatology: Array<{
    month: string;
    meanTempC: number;
    meanMonthlyPrecipMm: number;
  }>;
  tempTrend: TrendAnalysisResult;
  precipTrend: TrendAnalysisResult;
  source: string;
  fetchedAt: string;
}

export const ClimateIntelligenceView: React.FC = () => {
  const { overview, selectedIntel } = useEarth();
  const stations = overview?.stations ?? [];

  const [selectedCoords, setSelectedCoords] = useState<{
    label: string;
    lat: number;
    lng: number;
  }>(() =>
    selectedIntel
      ? {
          label: `${selectedIntel.location.name}, ${selectedIntel.location.country}`,
          lat: selectedIntel.location.latitude,
          lng: selectedIntel.location.longitude,
        }
      : { label: 'Karachi, Pakistan', lat: 24.8607, lng: 67.0011 }
  );

  const [years, setYears] = useState<number>(15);
  const [data, setData] = useState<ClimateSeriesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/climate/timeseries?lat=${selectedCoords.lat}&lng=${selectedCoords.lng}&years=${years}`
        );
        if (!res.ok) throw new Error('Failed to load historical climate archive.');
        const json = (await res.json()) as ClimateSeriesResponse;
        if (active) setData(json);
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Archive unavailable.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [selectedCoords, years]);

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">
            Climate Intelligence & Historical Trend Analysis
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            ERA5 Multi-Year Reanalysis · Mann-Kendall Monotonic Test & Ordinary Least Squares Regression
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <select
            value={`${selectedCoords.lat},${selectedCoords.lng}`}
            onChange={(e) => {
              const [lat, lng] = e.target.value.split(',').map(Number);
              const found = stations.find(
                (s) => s.latitude === lat && s.longitude === lng
              );
              if (found) {
                setSelectedCoords({
                  label: `${found.name}, ${found.country}`,
                  lat: found.latitude,
                  lng: found.longitude,
                });
              } else if (selectedIntel) {
                setSelectedCoords({
                  label: `${selectedIntel.location.name}, ${selectedIntel.location.country}`,
                  lat: selectedIntel.location.latitude,
                  lng: selectedIntel.location.longitude,
                });
              }
            }}
            className="bg-[#0E1420] border border-slate-700 rounded-md px-3 py-2 text-slate-100"
          >
            {selectedIntel && (
              <option
                value={`${selectedIntel.location.latitude},${selectedIntel.location.longitude}`}
              >
                Selected: {selectedIntel.location.name}
              </option>
            )}
            {stations.map((s) => (
              <option key={s.id} value={`${s.latitude},${s.longitude}`}>
                {s.name}, {s.country}
              </option>
            ))}
          </select>

          <div className="flex items-center bg-[#0E1420] border border-slate-700 rounded-md p-0.5">
            {[10, 15, 25].map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setYears(y)}
                className={`px-3 py-1.5 rounded font-mono transition-colors ${
                  years === y
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {y}Y
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-slate-300">
          <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
          Computing {years}-year ERA5 reanalysis baseline for {selectedCoords.label}...
        </div>
      )}

      {error && (
        <div className="p-4 border border-rose-500/40 bg-rose-950/20 rounded-lg text-xs text-rose-200">
          {error}
        </div>
      )}

      {data && !loading && (
        <>
          {/* Statistical Summary Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Annual Temperature Slope (OLS)</span>
                <TrendingUp className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-mono font-semibold text-slate-100">
                {data.tempTrend.slopePerYear >= 0 ? '+' : ''}
                {(data.tempTrend.slopePerYear * 10).toFixed(2)} °C / decade
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {data.tempTrend.confidenceNote}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Precipitation Trend (Mann-Kendall)</span>
                <span className="font-mono text-cyan-400">
                  Z = {data.precipTrend.zStatistic}
                </span>
              </div>
              <div className="text-2xl font-mono font-semibold text-slate-100">
                {data.precipTrend.slopePerYear >= 0 ? '+' : ''}
                {data.precipTrend.slopePerYear.toFixed(1)} mm / yr
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {data.precipTrend.confidenceNote}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Period Baseline Mean</span>
                <span className="font-mono text-slate-400">
                  N = {data.yearsAnalyzed} yrs
                </span>
              </div>
              <div className="text-2xl font-mono font-semibold text-slate-100">
                {data.baselineMeanC.toFixed(2)} °C
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Location: {selectedCoords.label} ({data.latitude.toFixed(2)}°,{' '}
                {data.longitude.toFixed(2)}°) · Source: {data.source}
              </p>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-3">
              <h2 className="text-sm font-semibold text-slate-100">
                Annual Mean Temperature Anomaly (°C vs Period Baseline)
              </h2>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.annualSeries}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#07090E',
                        borderColor: '#1e293b',
                        fontSize: '11px',
                      }}
                    />
                    <Bar dataKey="anomalyC" name="Anomaly (°C)" radius={[3, 3, 0, 0]}>
                      {data.annualSeries.map((row) => (
                        <Cell
                          key={row.year}
                          fill={row.anomalyC >= 0 ? '#ef4444' : '#38bdf8'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-3">
              <h2 className="text-sm font-semibold text-slate-100">
                Monthly Climatology: Temperature (°C) & Rainfall (mm)
              </h2>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.monthlyClimatology}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#07090E',
                        borderColor: '#1e293b',
                        fontSize: '11px',
                      }}
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="meanMonthlyPrecipMm"
                      name="Mean Monthly Precip (mm)"
                      fill="#06b6d4"
                      fillOpacity={0.2}
                      stroke="#06b6d4"
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="meanTempC"
                      name="Mean Temp (°C)"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Extreme Heat Days Trend */}
          <div className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-3">
            <h2 className="text-sm font-semibold text-slate-100">
              Annual Total Precipitation (mm) & Extreme Heat Days (≥ 35 °C)
            </h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.annualSeries}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis yAxisId="p" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis
                    yAxisId="h"
                    orientation="right"
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#07090E',
                      borderColor: '#1e293b',
                      fontSize: '11px',
                    }}
                  />
                  <Bar
                    yAxisId="p"
                    dataKey="totalPrecipMm"
                    name="Total Precip (mm)"
                    fill="#0284c7"
                    radius={[3, 3, 0, 0]}
                  />
                  <Line
                    yAxisId="h"
                    type="monotone"
                    dataKey="extremeHeatDays"
                    name="Days ≥ 35 °C"
                    stroke="#f43f5e"
                    strokeWidth={2}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
