/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Activity,
  Bell,
  Bot,
  FileText,
  Flame,
  Globe2,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu,
  Settings,
  ShieldAlert,
  Trees,
  Waves,
  Wind,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCenterDrawer } from './components/AlertCenterDrawer.tsx';
import { EarthMapView } from './components/EarthMapView.tsx';
import { LocationIntelligenceDrawer } from './components/LocationIntelligenceDrawer.tsx';
import { SatelliteComparisonModal } from './components/SatelliteComparisonModal.tsx';
import { AiDetectiveView } from './components/views/AiDetectiveView.tsx';
import { ClimateIntelligenceView } from './components/views/ClimateIntelligenceView.tsx';
import {
  NaturalDisastersView,
  WildfireMonitoringView,
} from './components/views/DisastersAndWildfireViews.tsx';
import {
  AirQualityView,
  ForestMonitoringView,
  OceanMonitoringView,
} from './components/views/ForestOceanAirViews.tsx';
import { OverviewView } from './components/views/OverviewView.tsx';
import {
  ReportsView,
  SettingsView,
} from './components/views/ReportsAndSettingsViews.tsx';
import { EarthProvider, useEarth } from './contexts/EarthContext.tsx';
import type { NavView } from './types/earth.ts';

const NAV_ITEMS: Array<{
  id: NavView;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
  { id: 'map', label: 'Live Earth Map', icon: <Globe2 className="w-4 h-4" /> },
  { id: 'climate', label: 'Climate Intelligence', icon: <Activity className="w-4 h-4" /> },
  { id: 'disasters', label: 'Natural Disasters', icon: <ShieldAlert className="w-4 h-4" /> },
  { id: 'wildfire', label: 'Wildfire Monitoring', icon: <Flame className="w-4 h-4" /> },
  { id: 'forest', label: 'Forest Monitoring', icon: <Trees className="w-4 h-4" /> },
  { id: 'ocean', label: 'Ocean Monitoring', icon: <Waves className="w-4 h-4" /> },
  { id: 'air-quality', label: 'Air Quality', icon: <Wind className="w-4 h-4" /> },
  { id: 'ai-detective', label: 'AI Detective', icon: <Bot className="w-4 h-4" /> },
  { id: 'reports', label: 'Reports', icon: <FileText className="w-4 h-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
];

const MissionShell: React.FC = () => {
  const {
    activeView,
    setActiveView,
    alerts,
    alertsDrawerOpen,
    setAlertsDrawerOpen,
    user,
    signInWithGoogle,
    logout,
  } = useEarth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  useEffect(() => {
    const handler = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#07090E] text-slate-100 overflow-hidden">
      {/* Required Google Maps Platform Demo Quota Banner (Top-level so it never unmounts) */}
      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Clean 3-Zone Top Navigation Ribbon */}
      <header className="h-12 shrink-0 px-4 border-b border-slate-800 bg-[#090D15] flex items-center justify-between gap-8 z-30">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="lg:hidden p-1.5 rounded text-slate-300 hover:bg-slate-800"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setActiveView('map')}
            className="font-display text-sm md:text-base font-semibold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
          >
            Earth System Trend Detective
          </button>
        </div>

        {/* Zone 2: Concise Quick Navigation Links */}
        <nav className="hidden xl:flex items-center gap-6 text-xs font-medium text-slate-400">
          {(
            [
              { id: 'overview', label: 'Overview' },
              { id: 'map', label: 'Live Map' },
              { id: 'climate', label: 'Climate' },
              { id: 'disasters', label: 'Disasters' },
              { id: 'ai-detective', label: 'AI Detective' },
            ] as const
          ).map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => setActiveView(link.id)}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-100 ${
                activeView === link.id
                  ? 'text-cyan-300 border-b border-cyan-400 py-3.5'
                  : 'py-3.5'
              }`}
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: Alerts & Auth Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setAlertsDrawerOpen(!alertsDrawerOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium bg-[#0E1420] border border-slate-800 hover:border-amber-500/50 text-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>Alerts</span>
            <span className="font-mono text-amber-300">
              ({unacknowledgedCount})
            </span>
          </button>

          {user ? (
            <button
              type="button"
              onClick={() => void logout()}
              title={`Signed in as ${user.email}`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden sm:inline max-w-[130px] truncate">
                {user.displayName || user.email}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace: Left Mission Rail + Active Viewport */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left Navigation Rail */}
        <aside
          className={`${
            mobileMenuOpen ? 'fixed inset-y-12 left-0 z-40 flex' : 'hidden'
          } lg:static lg:flex w-56 shrink-0 flex-col bg-[#090D15] border-r border-slate-800`}
        >
          <div className="flex-1 overflow-y-auto p-2.5 space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveView(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <span className={active ? 'text-cyan-400' : 'text-slate-500'}>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
          <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500">
            NASA · USGS · Open-Meteo · CAMS
          </div>
        </aside>

        {/* Active View Canvas */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto relative bg-[#07090E]">
          {activeView === 'map' ? (
            <EarthMapView />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="min-h-full"
              >
                {activeView === 'overview' && <OverviewView />}
                {activeView === 'climate' && <ClimateIntelligenceView />}
                {activeView === 'disasters' && <NaturalDisastersView />}
                {activeView === 'wildfire' && <WildfireMonitoringView />}
                {activeView === 'forest' && <ForestMonitoringView />}
                {activeView === 'ocean' && <OceanMonitoringView />}
                {activeView === 'air-quality' && <AirQualityView />}
                {activeView === 'ai-detective' && <AiDetectiveView />}
                {activeView === 'reports' && <ReportsView />}
                {activeView === 'settings' && <SettingsView />}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>

      {/* Overlays */}
      <LocationIntelligenceDrawer />
      <AlertCenterDrawer />
      <SatelliteComparisonModal />
    </div>
  );
};

export default function App() {
  return (
    <EarthProvider>
      <MissionShell />
    </EarthProvider>
  );
}
