import React, { useMemo, useState } from 'react';
import { ExternalLink, Flame, MapPin, ShieldAlert } from 'lucide-react';
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

export const NaturalDisastersView: React.FC = () => {
  const { overview, flyToLocation } = useEarth();
  const events = overview?.events ?? [];
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categories = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ev of events) {
      counts[ev.categoryLabel] = (counts[ev.categoryLabel] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [events]);

  const filtered = useMemo(() => {
    if (categoryFilter === 'all') return events;
    return events.filter((e) => e.categoryLabel === categoryFilter);
  }, [events, categoryFilter]);

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">
            Global Natural Disasters & Seismic Feed
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time aggregation from NASA EONET v3 and USGS Earthquake Hazards GeoJSON
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              categoryFilter === 'all'
                ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                : 'bg-[#0E1420] text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            All ({events.length})
          </button>
          {categories.map(([label, count]) => (
            <button
              key={label}
              type="button"
              onClick={() => setCategoryFilter(label)}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                categoryFilter === label
                  ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                  : 'bg-[#0E1420] text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Category Distribution Chart */}
      <div className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-3">
        <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          Active Event Distribution by Hazard Category
        </h2>
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={categories.map(([name, count]) => ({ name, count }))}
              margin={{ top: 6, right: 12, left: -12, bottom: 8 }}
            >
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#07090E',
                  borderColor: '#1e293b',
                  fontSize: '11px',
                }}
              />
              <Bar dataKey="count" name="Active Events" fill="#06b6d4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Event Table */}
      <div className="rounded-lg bg-[#0E1420] border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#080C14] text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-2.5 font-medium">Event Title</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Severity</th>
                <th className="px-4 py-2.5 font-medium">Coordinates</th>
                <th className="px-4 py-2.5 font-medium">Source</th>
                <th className="px-4 py-2.5 font-medium">Detected</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filtered.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 font-medium text-slate-100 max-w-xs truncate">
                    {ev.title}
                  </td>
                  <td className="px-4 py-2.5 text-slate-300">{ev.categoryLabel}</td>
                  <td
                    className={`px-4 py-2.5 font-mono uppercase text-[11px] ${
                      ev.severity === 'critical'
                        ? 'text-rose-400'
                        : ev.severity === 'high'
                          ? 'text-amber-400'
                          : 'text-cyan-300'
                    }`}
                  >
                    {ev.severity}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-300">
                    {ev.latitude.toFixed(2)}°, {ev.longitude.toFixed(2)}°
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">{ev.source}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-400">
                    {new Date(ev.date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          flyToLocation(ev.latitude, ev.longitude, 7, ev.title)
                        }
                        className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200 font-medium"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        Map
                      </button>
                      {ev.sourceUrl && (
                        <a
                          href={ev.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-slate-200"
                          title="Open upstream record"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* NOAA NWS Active Weather Alerts & USGS Flood Streamflow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-3">
          <h2 className="text-sm font-semibold text-slate-100">
            NOAA National Weather Service Active Alerts ({overview?.weatherAlerts.length ?? 0})
          </h2>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {(overview?.weatherAlerts ?? []).slice(0, 12).map((wa) => (
              <div
                key={wa.id}
                className="p-2.5 rounded bg-[#07090E] border border-slate-800 flex items-start justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium text-amber-300">
                    {wa.event} <span className="font-mono text-[10px] uppercase">({wa.severity})</span>
                  </div>
                  <div className="text-[11px] text-slate-300 truncate">{wa.areaDesc}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{wa.senderName}</div>
                </div>
                {wa.latitude !== null && wa.longitude !== null && (
                  <button
                    type="button"
                    onClick={() =>
                      flyToLocation(wa.latitude!, wa.longitude!, 7, wa.event)
                    }
                    className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 shrink-0"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-3">
          <h2 className="text-sm font-semibold text-slate-100">
            USGS Water Services Real-Time River Gauges
          </h2>
          <div className="space-y-2">
            {(overview?.usgsRiverGauges ?? []).map((g) => (
              <div
                key={g.siteCode}
                onClick={() => flyToLocation(g.latitude, g.longitude, 9, g.siteName)}
                className="p-2.5 rounded bg-[#07090E] border border-slate-800 hover:border-cyan-500/40 cursor-pointer flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-100 truncate">{g.siteName}</div>
                  <div className="text-[11px] font-mono text-slate-400">
                    USGS {g.siteCode} · {new Date(g.observedAt).toLocaleTimeString()}
                  </div>
                </div>
                <div className="text-right font-mono shrink-0">
                  <div className="text-sky-300">
                    {g.dischargeCfs !== null ? `${g.dischargeCfs.toLocaleString()} ft³/s` : '—'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {g.gageHeightFt !== null ? `${g.gageHeightFt.toFixed(2)} ft` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const WildfireMonitoringView: React.FC = () => {
  const { overview, flyToLocation, setActiveLayer, setActiveView } = useEarth();
  const wildfires = (overview?.events ?? []).filter(
    (e) => e.category === 'wildfires'
  );
  const stationsByRisk = [...(overview?.stations ?? [])].sort(
    (a, b) => b.wildfireRiskScore - a.wildfireRiskScore
  );

  const firmsSource = overview?.sources.find((s) => s.id === 'nasa-firms');

  return (
    <div className="p-6 max-w-[1440px] mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">
            Wildfire Detection & Fire Weather Risk Monitoring
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            NASA EONET Active Fires + Meteorological Vapor Pressure Deficit (VPD) Risk Screening
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setActiveLayer('wildfire');
            setActiveView('map');
          }}
          className="px-3.5 py-2 text-xs font-medium bg-orange-500 text-slate-950 hover:bg-orange-400 rounded-md transition-colors whitespace-nowrap"
        >
          View Wildfire Layer on Map
        </button>
      </div>

      {firmsSource && (
        <div className="p-3.5 rounded-lg border border-slate-700 bg-[#0E1420] text-xs text-slate-300 flex items-center justify-between gap-3">
          <span>
            <strong className="text-orange-300">{firmsSource.name}:</strong>{' '}
            {firmsSource.note}
          </span>
          <span className="font-mono text-[11px] text-emerald-400 shrink-0">
            {firmsSource.status.toUpperCase()}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 p-4 rounded-lg bg-[#0E1420] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" />
              Fire Weather Screening Index Across Global Stations (0–100)
            </h2>
          </div>
          <p className="text-[11px] text-slate-400">
            Derived from temperature, relative humidity, 10m wind, and antecedent precipitation. Statistical meteorological index only—not an ignition prediction.
          </p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stationsByRisk}
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
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#07090E',
                    borderColor: '#1e293b',
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey="wildfireRiskScore" name="Fire Weather Index" radius={[3, 3, 0, 0]}>
                  {stationsByRisk.map((s) => (
                    <Cell
                      key={s.id}
                      fill={
                        s.wildfireRiskScore >= 70
                          ? '#ef4444'
                          : s.wildfireRiskScore >= 45
                            ? '#f59e0b'
                            : '#10b981'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 p-4 rounded-lg bg-[#0E1420] border border-slate-800 flex flex-col">
          <h2 className="text-sm font-semibold text-slate-100 mb-3">
            Active Wildfire Events ({wildfires.length})
          </h2>
          <div className="flex-1 overflow-y-auto space-y-2 max-h-80 pr-1">
            {wildfires.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">
                No active wildfire incidents currently returned by NASA EONET.
              </p>
            ) : (
              wildfires.map((wf) => (
                <div
                  key={wf.id}
                  className="p-3 rounded bg-[#07090E] border border-slate-800 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-100 truncate">
                      {wf.title}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      {wf.latitude.toFixed(2)}°, {wf.longitude.toFixed(2)}° ·{' '}
                      {new Date(wf.date).toLocaleDateString()} · {wf.source}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      flyToLocation(wf.latitude, wf.longitude, 7, wf.title)
                    }
                    className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300 shrink-0"
                  >
                    Inspect
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
