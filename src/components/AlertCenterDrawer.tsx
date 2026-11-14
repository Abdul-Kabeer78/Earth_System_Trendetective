import React, { useMemo, useState } from 'react';
import { Bell, CheckCircle2, MapPin, X } from 'lucide-react';
import { useEarth } from '../contexts/EarthContext.tsx';

export const AlertCenterDrawer: React.FC = () => {
  const {
    alerts,
    alertsDrawerOpen,
    setAlertsDrawerOpen,
    flyToLocation,
    acknowledgeAlertById,
  } = useEarth();

  const [severityFilter, setSeverityFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    if (severityFilter === 'all') return alerts;
    return alerts.filter((a) => a.severity === severityFilter);
  }, [alerts, severityFilter]);

  if (!alertsDrawerOpen) return null;

  return (
    <aside className="fixed top-12 right-0 bottom-0 w-full sm:w-[420px] bg-[#0B111C]/98 backdrop-blur-md border-l border-slate-800 z-40 flex flex-col shadow-2xl">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-100">
            Environmental Alert Center
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setAlertsDrawerOpen(false)}
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800"
          aria-label="Close alerts"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Severity Filter Tabs */}
      <div className="px-4 py-2.5 border-b border-slate-800 flex items-center gap-1.5 text-xs">
        {(['all', 'critical', 'high', 'moderate', 'low'] as const).map((sev) => (
          <button
            key={sev}
            type="button"
            onClick={() => setSeverityFilter(sev)}
            className={`px-2.5 py-1 rounded capitalize transition-colors whitespace-nowrap ${
              severityFilter === sev
                ? 'bg-cyan-500/20 text-cyan-300 font-medium'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {sev}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">
            No alerts match the selected severity filter.
          </p>
        ) : (
          filtered.map((al) => {
            const sevText =
              al.severity === 'critical'
                ? 'text-rose-400'
                : al.severity === 'high'
                  ? 'text-amber-400'
                  : al.severity === 'moderate'
                    ? 'text-cyan-300'
                    : 'text-slate-400';

            return (
              <div
                key={al.id}
                className={`p-3 rounded-lg border bg-[#0E1624] space-y-1.5 ${
                  al.acknowledged
                    ? 'border-slate-800/60 opacity-65'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                  <span className={`font-semibold uppercase ${sevText}`}>
                    {al.severity === 'critical' ? '✖ ' : al.severity === 'high' ? '▲ ' : '● '}
                    {al.severity} · {al.category}
                  </span>
                  <span className="text-slate-500">
                    {new Date(al.detectedAt).toLocaleDateString()}
                  </span>
                </div>

                <div className="text-xs font-semibold text-slate-100">
                  {al.title}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {al.description}
                </p>

                <div className="pt-1 flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-mono text-slate-500 truncate">
                    {al.source} · {al.locationName}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setAlertsDrawerOpen(false);
                        flyToLocation(al.latitude, al.longitude, 7, al.title);
                      }}
                      className="flex items-center gap-1 text-cyan-300 hover:text-cyan-200 font-medium"
                    >
                      <MapPin className="w-3 h-3" />
                      Locate
                    </button>
                    {al.dbId && !al.acknowledged && (
                      <button
                        type="button"
                        onClick={() => void acknowledgeAlertById(al.dbId!)}
                        className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Ack
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
