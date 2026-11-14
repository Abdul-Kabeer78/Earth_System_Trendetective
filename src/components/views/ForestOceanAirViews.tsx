import React from 'react';
import { History, MapPin, Trees, Waves, Wind } from 'lucide-react';
import {
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

export const ForestMonitoringView: React.FC = () => {
  const {
    overview,
    flyToLocation,
    setActiveLayer,
    setActiveView,
    setCompareModalOpen,
    formatTemp,
  } = useEarth();

  const forestStations = (overview?.stations ?? []).filter(
    (s) =>
      s.biome.toLowerCase().includes('forest') ||
      s.biome.toLowerCase().includes('rainforest') ||
      s.biome.toLowerCase().includes('savanna') ||
      s.id === 'jakarta'
  );

  const forestBasins = [
    {
      name: 'Amazon Basin (Rondônia)',
      lat: -9.8,
      lng: -62.9,
      instrument: 'NASA MODIS Terra NDVI (8-Day)',
      notes: 'Primary tropical rainforest canopy transition & dry-season fire stress monitoring.',
    },
    {
      name: 'Congo Basin (Equateur)',
      lat: 0.4,
      lng: 19.8,
      instrument: 'NASA MODIS Terra NDVI + EONET',
      notes: 'Central African humid tropical canopy and biomass moisture corridor.',
    },
    {
      name: 'Central Kalimantan (Borneo)',
      lat: -1.8,
      lng: 113.4,
      instrument: 'NASA MODIS + VIIRS Reflectance',
      notes: 'Tropical peatland canopy & haze monitoring corridor.',
    },
    {
      name: 'Western Boreal (Alberta / NWT)',
      lat: 58.5,
      lng: -115.2,
      instrument: 'NASA MODIS + Fire Weather Index',
      notes: 'High-latitude conifer biome & summer wildfire regeneration zone.',
    },
  ];

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">
            Forest Cover & Deforestation Monitoring
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            NASA GIBS MODIS Terra NDVI 8-Day Vegetation Composites & Biome Thermal/Moisture Stress
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCompareModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded-md transition-colors whitespace-nowrap"
          >
            <History className="w-3.5 h-3.5" />
            Before / After Satellite Compare
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveLayer('deforestation');
              setActiveView('map');
            }}
            className="px-3.5 py-2 text-xs font-medium bg-[#0E1420] border border-slate-700 hover:border-emerald-500/60 text-slate-100 rounded-md transition-colors whitespace-nowrap"
          >
            Open MODIS NDVI Layer
          </button>
        </div>
      </div>

      {/* Priority Forest Basins */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {forestBasins.map((basin) => (
          <div
            key={basin.name}
            className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 flex flex-col justify-between gap-3"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-emerald-300">
                  {basin.name}
                </span>
                <Trees className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {basin.notes}
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className="font-mono text-slate-500 truncate">
                {basin.lat}°, {basin.lng}°
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveLayer('deforestation');
                  flyToLocation(basin.lat, basin.lng, 6, basin.name);
                }}
                className="text-cyan-300 hover:text-cyan-200 font-medium shrink-0"
              >
                Inspect Basin
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Forest Biome Telemetry & Moisture Stress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-3">
          <h2 className="text-sm font-semibold text-slate-100">
            Forest Basin Temperature Anomaly & Canopy Fire Risk
          </h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={forestStations}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
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
                <Bar
                  yAxisId="left"
                  dataKey="humidityPct"
                  name="Relative Humidity (%)"
                  fill="#10b981"
                  radius={[3, 3, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="wildfireRiskScore"
                  name="Canopy Fire Risk (0–100)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-3">
          <h2 className="text-sm font-semibold text-slate-100">
            Monitored Forest Stations
          </h2>
          <div className="space-y-2">
            {forestStations.map((st) => (
              <div
                key={st.id}
                onClick={() =>
                  flyToLocation(st.latitude, st.longitude, 7, st.name)
                }
                className="p-3 rounded bg-[#07090E] border border-slate-800 hover:border-emerald-500/50 cursor-pointer flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-100">
                    {st.name} · <span className="text-slate-400">{st.biome}</span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                    Temp {formatTemp(st.temperatureC)} · RH {st.humidityPct}% · Precip{' '}
                    {st.precipitationMm.toFixed(1)} mm
                  </div>
                </div>
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Global Forest Watch, NASA Earthdata CMR & ESA Copernicus Sentinel Catalogs */}
      <div className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-100">
            Global Forest Watch, NASA Earthdata & Copernicus Sentinel Catalog Feeds
          </h2>
          <span className="text-[11px] font-mono text-emerald-300">
            GFW Dataset {overview?.summary.gfwLatestVersion ?? 'Latest'} ·{' '}
            {overview?.satelliteFeeds.length ?? 0} Live Records
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {(overview?.satelliteFeeds ?? []).map((feed, idx) => (
            <div
              key={`${feed.provider}-${feed.identifier}-${idx}`}
              className="p-3 rounded bg-[#07090E] border border-slate-800 text-xs space-y-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-emerald-300">{feed.provider}</span>
                <span className="font-mono text-[10px] text-slate-400">{feed.dataset}</span>
              </div>
              <div className="font-mono text-[11px] text-slate-200 truncate" title={feed.identifier}>
                {feed.identifier}
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2">{feed.summary}</p>
              <div className="text-[10px] font-mono text-slate-500">
                {new Date(feed.timestamp).toUTCString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const OceanMonitoringView: React.FC = () => {
  const { overview, flyToLocation, setActiveLayer, setActiveView, formatTemp } =
    useEarth();
  const buoys = overview?.oceanBuoys ?? [];

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">
            Ocean Monitoring & Marine Telemetry
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Open-Meteo Marine WaveWatch Grid & NASA GHRSST Sea Surface Temperature Layer
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setActiveLayer('ocean-temperature');
            setActiveView('map');
          }}
          className="px-3.5 py-2 text-xs font-medium bg-cyan-500 text-slate-950 hover:bg-cyan-400 rounded-md transition-colors whitespace-nowrap"
        >
          View Ocean SST Layer
        </button>
      </div>

      {/* Wave Height & Air Temp Chart */}
      <div className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-3">
        <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <Waves className="w-4 h-4 text-cyan-400" />
          Significant Wave Height (m) & Swell Across 8 Ocean Basins
        </h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={buoys}
              margin={{ top: 8, right: 8, left: -12, bottom: 28 }}
            >
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="basin"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                angle={-20}
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
              <Bar dataKey="waveHeightM" name="Wave Height (m)" fill="#06b6d4" radius={[3, 3, 0, 0]} />
              <Bar dataKey="swellHeightM" name="Swell Height (m)" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Ocean Buoy Table */}
      <div className="rounded-lg bg-[#0E1420] border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#080C14] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-2.5 font-medium">Ocean Basin</th>
                <th className="px-4 py-2.5 font-medium">Coordinates</th>
                <th className="px-4 py-2.5 font-medium text-right">Wave Height</th>
                <th className="px-4 py-2.5 font-medium text-right">Swell</th>
                <th className="px-4 py-2.5 font-medium text-right">Period</th>
                <th className="px-4 py-2.5 font-medium text-right">Marine Air Temp</th>
                <th className="px-4 py-2.5 font-medium text-right">Wind</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {buoys.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => {
                    setActiveLayer('ocean-temperature');
                    flyToLocation(b.latitude, b.longitude, 5, b.basin);
                  }}
                  className="hover:bg-slate-800/40 cursor-pointer"
                >
                  <td className="px-4 py-2.5 font-medium text-slate-100">
                    {b.basin}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-400">
                    {b.latitude.toFixed(1)}°, {b.longitude.toFixed(1)}°
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-cyan-300">
                    {b.waveHeightM !== null ? `${b.waveHeightM.toFixed(2)} m` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                    {b.swellHeightM !== null ? `${b.swellHeightM.toFixed(2)} m` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                    {b.wavePeriodS !== null ? `${b.wavePeriodS.toFixed(1)} s` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-200">
                    {formatTemp(b.airTempC)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                    {b.windSpeedKmh !== null ? `${b.windSpeedKmh.toFixed(1)} km/h` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live NOAA NDBC Moored Buoy Network Observations */}
      <div className="rounded-lg bg-[#0E1420] border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              NOAA National Data Buoy Center (NDBC) Live Moored Buoys ({overview?.noaaBuoys.length ?? 0})
            </h2>
            <p className="text-[11px] text-slate-400">
              Direct physical ocean surface telemetry (WTMP sea surface temperature, wave height, barometric pressure)
            </p>
          </div>
          <span className="text-[11px] font-mono text-cyan-300">ndbc.noaa.gov</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#080C14] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-2.5 font-medium">Station ID</th>
                <th className="px-4 py-2.5 font-medium">Coordinates</th>
                <th className="px-4 py-2.5 font-medium text-right">Sea Surface Temp</th>
                <th className="px-4 py-2.5 font-medium text-right">Wave Height</th>
                <th className="px-4 py-2.5 font-medium text-right">Pressure</th>
                <th className="px-4 py-2.5 font-medium text-right">Wind Speed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {(overview?.noaaBuoys ?? []).map((nb) => (
                <tr
                  key={nb.stationId}
                  onClick={() => {
                    setActiveLayer('ocean-temperature');
                    flyToLocation(nb.latitude, nb.longitude, 6, `NOAA NDBC ${nb.stationId}`);
                  }}
                  className="hover:bg-slate-800/40 cursor-pointer"
                >
                  <td className="px-4 py-2 font-mono font-semibold text-cyan-300">
                    {nb.stationId}
                  </td>
                  <td className="px-4 py-2 font-mono text-slate-400">
                    {nb.latitude.toFixed(2)}°, {nb.longitude.toFixed(2)}°
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-amber-300">
                    {nb.seaSurfaceTempC !== null ? formatTemp(nb.seaSurfaceTempC) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-200">
                    {nb.waveHeightM !== null ? `${nb.waveHeightM.toFixed(2)} m` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-300">
                    {nb.pressureHpa !== null ? `${nb.pressureHpa.toFixed(1)} hPa` : '—'}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-slate-300">
                    {nb.windSpeedMs !== null ? `${(nb.windSpeedMs * 3.6).toFixed(1)} km/h` : '—'}
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

export const AirQualityView: React.FC = () => {
  const { overview, flyToLocation, setActiveLayer, setActiveView } = useEarth();
  const stations = [...(overview?.stations ?? [])].sort(
    (a, b) => (b.usAqi ?? 0) - (a.usAqi ?? 0)
  );
  const openAqSource = overview?.sources.find((s) => s.id === 'openaq');

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">
            Global Air Quality & Atmospheric Pollution
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Copernicus CAMS Aerosol & Particulate Composition (PM2.5, PM10, NO₂, O₃, US AQI)
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setActiveLayer('air-quality');
            setActiveView('map');
          }}
          className="px-3.5 py-2 text-xs font-medium bg-cyan-500 text-slate-950 hover:bg-cyan-400 rounded-md transition-colors whitespace-nowrap"
        >
          View MODIS Aerosol Map Layer
        </button>
      </div>

      {openAqSource && !openAqSource.configured && (
        <div className="p-3.5 rounded-lg border border-slate-700 bg-[#0E1420] text-xs text-slate-300">
          <strong className="text-cyan-300">Copernicus CAMS Live Active:</strong>{' '}
          Displaying live atmospheric chemistry forecasts from ECMWF CAMS. Set{' '}
          <code className="text-cyan-300">OPENAQ_API_KEY</code> on the server to overlay additional municipal ground stations.
        </div>
      )}

      {/* AQI Bar Comparison */}
      <div className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-3">
        <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <Wind className="w-4 h-4 text-emerald-400" />
          US Air Quality Index (US AQI) Ranked Across Global Cities
        </h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stations}
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
              <Bar dataKey="usAqi" name="US AQI" radius={[3, 3, 0, 0]}>
                {stations.map((s) => (
                  <Cell
                    key={s.id}
                    fill={
                      (s.usAqi ?? 0) >= 151
                        ? '#ef4444'
                        : (s.usAqi ?? 0) >= 101
                          ? '#f59e0b'
                          : (s.usAqi ?? 0) >= 51
                            ? '#eab308'
                            : '#10b981'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pollutant Breakdown Table */}
      <div className="rounded-lg bg-[#0E1420] border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#080C14] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-2.5 font-medium">City</th>
                <th className="px-4 py-2.5 font-medium text-right">US AQI</th>
                <th className="px-4 py-2.5 font-medium text-right">PM2.5 (µg/m³)</th>
                <th className="px-4 py-2.5 font-medium text-right">PM10 (µg/m³)</th>
                <th className="px-4 py-2.5 font-medium text-right">NO₂ (µg/m³)</th>
                <th className="px-4 py-2.5 font-medium text-right">O₃ (µg/m³)</th>
                <th className="px-4 py-2.5 font-medium text-right">WHO Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {stations.map((s) => {
                const whoExceed = (s.pm25 ?? 0) > 15 || (s.pm10 ?? 0) > 45;
                return (
                  <tr
                    key={s.id}
                    onClick={() => flyToLocation(s.latitude, s.longitude, 8, s.name)}
                    className="hover:bg-slate-800/40 cursor-pointer"
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-100">
                      {s.name}{' '}
                      <span className="text-slate-400 font-normal">· {s.country}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-cyan-300">
                      {s.usAqi ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-200">
                      {s.pm25?.toFixed(1) ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-200">
                      {s.pm10?.toFixed(1) ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                      {s.no2?.toFixed(1) ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-slate-300">
                      {s.o3?.toFixed(1) ?? '—'}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono text-[11px] ${
                        whoExceed ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {whoExceed ? 'Exceeds WHO 24h' : 'Within WHO 24h'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
