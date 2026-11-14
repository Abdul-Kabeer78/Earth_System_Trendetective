import React from 'react';
import {
  Activity,
  AlertTriangle,
  CloudRain,
  Flame,
  Gauge,
  MapPin,
  RefreshCw,
  Satellite,
  Thermometer,
  Trees,
  Waves,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useEarth } from '../../contexts/EarthContext.tsx';

export const OverviewView: React.FC = () => {
  const {
    overview,
    overviewLoading,
    overviewError,
    refreshOverview,
    alerts,
    flyToLocation,
    setActiveView,
    formatTemp,
  } = useEarth();

  if (overviewLoading && !overview) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
          Synchronizing global NASA, USGS, and Open-Meteo telemetry...
        </div>
      </div>
    );
  }

  if (overviewError && !overview) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <div className="p-5 rounded-lg border border-rose-500/40 bg-rose-950/25 space-y-3">
          <h2 className="text-base font-semibold text-rose-200">
            Telemetry Feed Error
          </h2>
          <p className="text-xs text-rose-300">{overviewError}</p>
          <button
            type="button"
            onClick={() => void refreshOverview()}
            className="px-3 py-1.5 rounded bg-rose-500/20 border border-rose-400/40 text-xs text-rose-100 hover:bg-rose-500/30"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!overview) return null;

  const { summary, stations, events } = overview;

  const metricCards = [
    {
      label: 'Global Reference Temp',
      value: formatTemp(summary.meanStationTempC),
      unit: `Mean across ${summary.stationCount} stations`,
      location: 'Global Observatory Network',
      source: 'Open-Meteo GFS / DWD',
      updated: summary.fetchedAt,
      trend: `${summary.meanTempAnomalyC >= 0 ? '+' : ''}${summary.meanTempAnomalyC.toFixed(2)} °C vs ref`,
      trendPositive: summary.meanTempAnomalyC <= 0.5,
      icon: <Thermometer className="w-4 h-4 text-amber-400" />,
    },
    {
      label: 'Active Wildfires',
      value: String(summary.activeWildfiresCount),
      unit: 'Active incidents',
      location: 'Global Orbital Swath',
      source: 'NASA EONET v3',
      updated: summary.fetchedAt,
      trend: '30-day open window',
      trendPositive: summary.activeWildfiresCount < 20,
      icon: <Flame className="w-4 h-4 text-orange-400" />,
    },
    {
      label: 'Active Natural Disasters',
      value: String(summary.activeDisasterCount),
      unit: 'Tracked events',
      location: 'Planetary Monitoring',
      source: 'NASA EONET + USGS',
      updated: summary.fetchedAt,
      trend: `${events.filter((e) => e.category === 'earthquakes').length} M2.5+ seismic (24h)`,
      trendPositive: false,
      icon: <AlertTriangle className="w-4 h-4 text-rose-400" />,
    },
    {
      label: 'Global Air Quality Index',
      value: summary.meanUsAqi !== null ? String(summary.meanUsAqi) : '—',
      unit: 'Mean US AQI',
      location: `${summary.elevatedAqiStations} stations AQI ≥ 100`,
      source: 'Copernicus CAMS',
      updated: summary.fetchedAt,
      trend: summary.elevatedAqiStations > 0 ? 'Elevated urban plumes' : 'Nominal dispersion',
      trendPositive: summary.elevatedAqiStations === 0,
      icon: <Gauge className="w-4 h-4 text-emerald-400" />,
    },
    {
      label: 'Station Rainfall Total',
      value: `${summary.totalPrecipStationsMm.toFixed(1)}`,
      unit: 'mm instantaneous rate',
      location: `${stations.filter((s) => s.precipitationMm > 0).length} active precip zones`,
      source: 'Open-Meteo Surface',
      updated: summary.fetchedAt,
      trend: 'Live synoptic sweep',
      trendPositive: true,
      icon: <CloudRain className="w-4 h-4 text-sky-400" />,
    },
    {
      label: 'Ocean Wave Indicator',
      value:
        summary.meanOceanWaveHeightM !== null
          ? `${summary.meanOceanWaveHeightM.toFixed(2)}`
          : '—',
      unit: 'm significant wave height',
      location: '8 Major Ocean Basins',
      source: 'Open-Meteo Marine',
      updated: summary.fetchedAt,
      trend: 'NOAA WaveWatch grid',
      trendPositive: true,
      icon: <Waves className="w-4 h-4 text-cyan-400" />,
    },
    {
      label: 'Forest Biome Stations',
      value: String(
        stations.filter((s) => s.biome.toLowerCase().includes('forest')).length
      ),
      unit: 'Monitored canopy basins',
      location: 'Amazon · Congo · Boreal',
      source: 'NASA MODIS NDVI',
      updated: summary.latestSatelliteDate,
      trend: '8-day composite active',
      trendPositive: true,
      icon: <Trees className="w-4 h-4 text-emerald-400" />,
    },
    {
      label: 'Atmospheric CO₂ (MLO)',
      value:
        summary.atmosphericCo2Ppm !== null
          ? `${summary.atmosphericCo2Ppm.toFixed(2)}`
          : '—',
      unit: 'ppm (Mauna Loa)',
      location: 'NOAA Global Monitoring Lab',
      source: 'NOAA GML CO₂ Record',
      updated: summary.atmosphericCo2Date ?? summary.fetchedAt,
      trend:
        summary.atmosphericCo2TrendPpm !== null
          ? `Deseasonalized ${summary.atmosphericCo2TrendPpm.toFixed(2)} ppm`
          : 'Monthly observatory mean',
      trendPositive: false,
      icon: <Activity className="w-4 h-4 text-rose-400" />,
    },
    {
      label: 'Latest Orbital Swath',
      value: summary.latestSatelliteDate,
      unit: 'MODIS + Sentinel + GFW',
      location: 'EOSDIS CMR & Copernicus',
      source: 'NASA GIBS / CMR / ESA',
      updated: summary.earthdataLatestGranuleTime ?? summary.fetchedAt,
      trend: `${summary.weatherAlertsCount} NWS alerts · ${summary.usgsRiverGaugesCount} USGS gauges`,
      trendPositive: true,
      icon: <Satellite className="w-4 h-4 text-indigo-400" />,
    },
  ];

  const sortedByAnomaly = [...stations].sort((a, b) => b.anomalyC - a.anomalyC);

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">
            Planetary Environmental Overview
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Live multi-agency Earth observation telemetry · Last synchronized{' '}
            <span className="font-mono text-slate-300">
              {new Date(summary.fetchedAt).toUTCString()}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveView('map')}
            className="px-3.5 py-2 text-xs font-medium bg-cyan-500 text-slate-950 hover:bg-cyan-400 rounded-md transition-colors whitespace-nowrap"
          >
            Open Satellite Map
          </button>
          <button
            type="button"
            onClick={() => void refreshOverview()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#0E1624] border border-slate-800 hover:border-slate-700 text-slate-200 rounded-md transition-colors whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${overviewLoading ? 'animate-spin' : ''}`} />
            Refresh Feeds
          </button>
        </div>
      </div>

      {/* Live KPI Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {metricCards.map((card) => (
          <div
            key={card.label}
            className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 flex flex-col justify-between gap-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-300">
                {card.label}
              </span>
              {card.icon}
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-mono font-semibold text-slate-100">
                  {card.value}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {card.unit}
                </span>
              </div>
              <div
                className={`text-[11px] font-mono mt-1 ${
                  card.trendPositive ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {card.trend}
              </div>
            </div>
            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-0.5">
              <div className="truncate">{card.location}</div>
              <div className="font-mono text-[10px] text-slate-500 truncate">
                {card.source} · {card.updated.slice(0, 16).replace('T', ' ')}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Temperature Anomaly by Station */}
        <div className="lg:col-span-7 p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Station Temperature Anomaly vs. Reference Baseline (°C)
              </h2>
              <p className="text-[11px] text-slate-400">
                Current observed surface temp minus annual reference baseline across global stations
              </p>
            </div>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sortedByAnomaly}
                margin={{ top: 8, right: 8, left: -12, bottom: 28 }}
              >
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#07090E',
                    borderColor: '#1e293b',
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey="anomalyC" name="Temp Anomaly (°C)" radius={[3, 3, 0, 0]}>
                  {sortedByAnomaly.map((entry) => (
                    <Cell
                      key={entry.id}
                      fill={entry.anomalyC >= 0 ? '#f59e0b' : '#38bdf8'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Anomaly & Disaster Alerts Feed */}
        <div className="lg:col-span-5 p-4 rounded-lg bg-[#0E1420] border border-slate-800 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">
                Priority Environmental Alerts
              </h2>
              <p className="text-[11px] text-slate-400">
                NASA EONET, USGS Seismic, and Anomaly Engine triggers
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveView('disasters')}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              View All
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 max-h-72 pr-1">
            {alerts.slice(0, 8).map((al) => (
              <div
                key={al.id}
                className="p-2.5 rounded bg-[#07090E] border border-slate-800/90 flex items-start justify-between gap-2"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="text-[10px] font-mono uppercase text-amber-400">
                    {al.severity} · {al.category}
                  </div>
                  <div className="text-xs font-medium text-slate-100 truncate">
                    {al.title}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">
                    {al.source} · {new Date(al.detectedAt).toLocaleDateString()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    flyToLocation(al.latitude, al.longitude, 7, al.title)
                  }
                  className="p-1.5 rounded bg-slate-800/80 hover:bg-slate-700 text-cyan-300 shrink-0"
                  title="Inspect on Earth Map"
                >
                  <MapPin className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Satellite Catalog & Hydrology Live Strip */}
      {(overview.satelliteFeeds.length > 0 || overview.usgsRiverGauges.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-2.5">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Satellite className="w-4 h-4 text-indigo-400" />
              Live Orbital & Forest Catalog Feeds (NASA CMR · ESA Sentinel · GFW)
            </h2>
            <div className="space-y-2">
              {overview.satelliteFeeds.map((sf, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded bg-[#07090E] border border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-100 truncate">
                      {sf.provider} · <span className="text-cyan-300">{sf.dataset}</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 truncate">
                      {sf.identifier}
                    </div>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400 shrink-0">
                    {new Date(sf.timestamp).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-2.5">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Waves className="w-4 h-4 text-sky-400" />
              USGS Water Services Real-Time River Gauges
            </h2>
            <div className="space-y-2">
              {overview.usgsRiverGauges.map((g) => (
                <div
                  key={g.siteCode}
                  onClick={() => flyToLocation(g.latitude, g.longitude, 9, g.siteName)}
                  className="p-2.5 rounded bg-[#07090E] border border-slate-800 hover:border-sky-500/50 cursor-pointer flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-slate-100 truncate">{g.siteName}</div>
                    <div className="text-[11px] font-mono text-slate-400">
                      Site {g.siteCode} · {g.latitude.toFixed(2)}°, {g.longitude.toFixed(2)}°
                    </div>
                  </div>
                  <div className="text-right font-mono shrink-0">
                    <div className="text-sky-300">
                      {g.dischargeCfs !== null ? `${g.dischargeCfs.toLocaleString()} ft³/s` : '—'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {g.gageHeightFt !== null ? `Stage ${g.gageHeightFt.toFixed(2)} ft` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Global Station Telemetry Table */}
      <div className="rounded-lg bg-[#0E1420] border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-100">
            Global Reference Station Matrix
          </h2>
          <span className="text-[11px] font-mono text-slate-400">
            Click any station to inspect deep telemetry
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#080C14] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-2.5 font-medium">Station</th>
                <th className="px-4 py-2.5 font-medium">Biome</th>
                <th className="px-4 py-2.5 font-medium text-right">Temp</th>
                <th className="px-4 py-2.5 font-medium text-right">Anomaly</th>
                <th className="px-4 py-2.5 font-medium text-right">Humidity</th>
                <th className="px-4 py-2.5 font-medium text-right">Wind</th>
                <th className="px-4 py-2.5 font-medium text-right">US AQI</th>
                <th className="px-4 py-2.5 font-medium text-right">Fire Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {stations.map((st) => (
                <tr
                  key={st.id}
                  onClick={() =>
                    flyToLocation(
                      st.latitude,
                      st.longitude,
                      8,
                      `${st.name}, ${st.country}`
                    )
                  }
                  className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-2.5 font-medium text-slate-100">
                    {st.name}{' '}
                    <span className="text-slate-400 font-normal">
                      · {st.country}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">{st.biome}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-100">
                    {formatTemp(st.temperatureC)}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono ${
                      st.anomalyC >= 2
                        ? 'text-amber-400'
                        : st.anomalyC <= -2
                          ? 'text-sky-400'
                          : 'text-slate-300'
                    }`}
                  >
                    {st.anomalyC >= 0 ? '+' : ''}
                    {st.anomalyC.toFixed(1)} °C
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                    {st.humidityPct.toFixed(0)}%
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                    {st.windSpeedKmh.toFixed(1)} km/h
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono ${
                      (st.usAqi ?? 0) >= 150
                        ? 'text-rose-400'
                        : (st.usAqi ?? 0) >= 100
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                    }`}
                  >
                    {st.usAqi ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-200">
                    {st.wildfireRiskScore}/100
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
