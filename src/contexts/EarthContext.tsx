import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import type {
  AlertItem,
  LocationIntelligence,
  MapLayerId,
  NavView,
  PlanetaryOverviewPayload,
} from '../types/earth.ts';

export interface SavedLocationItem {
  id: number;
  name: string;
  country: string | null;
  latitude: number;
  longitude: number;
  notes: string | null;
  createdAt: string;
}

export interface UserPreferences {
  unitSystem: 'metric' | 'imperial';
  alertMinSeverity: 'low' | 'moderate' | 'high' | 'critical';
  defaultRegion: string;
}

interface EarthContextValue {
  activeView: NavView;
  setActiveView: (v: NavView) => void;
  activeLayer: MapLayerId;
  setActiveLayer: (l: MapLayerId) => void;
  mapCameraTarget: { lat: number; lng: number; zoom?: number; nonce: number } | null;
  flyToLocation: (lat: number, lng: number, zoom?: number, inspectName?: string) => void;
  overview: PlanetaryOverviewPayload | null;
  overviewLoading: boolean;
  overviewError: string | null;
  refreshOverview: () => Promise<void>;
  alerts: AlertItem[];
  alertsDrawerOpen: boolean;
  setAlertsDrawerOpen: (open: boolean) => void;
  acknowledgeAlertById: (dbId: number) => Promise<void>;
  selectedIntel: LocationIntelligence | null;
  intelLoading: boolean;
  intelError: string | null;
  intelDrawerOpen: boolean;
  setIntelDrawerOpen: (open: boolean) => void;
  inspectCoordinates: (lat: number, lng: number, explicitName?: string) => Promise<void>;
  compareModalOpen: boolean;
  setCompareModalOpen: (open: boolean) => void;
  user: User | null;
  authLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  savedLocations: SavedLocationItem[];
  saveCurrentLocation: (loc: { name: string; country?: string; latitude: number; longitude: number }) => Promise<void>;
  removeSavedLocation: (id: number) => Promise<void>;
  preferences: UserPreferences;
  updatePreferences: (next: Partial<UserPreferences>) => Promise<void>;
  formatTemp: (c: number | null | undefined) => string;
  formatSpeed: (kmh: number | null | undefined) => string;
  aiSeedPrompt: string | null;
  openAiDetectiveWithPrompt: (prompt: string) => void;
  clearAiSeedPrompt: () => void;
}

const EarthContext = createContext<EarthContextValue | null>(null);

export const EarthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Launch directly onto Live Earth Map per approved plan
  const [activeView, setActiveView] = useState<NavView>('map');
  const [activeLayer, setActiveLayer] = useState<MapLayerId>('live-weather');
  const [mapCameraTarget, setMapCameraTarget] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
    nonce: number;
  } | null>(null);

  const [overview, setOverview] = useState<PlanetaryOverviewPayload | null>(null);
  const [overviewLoading, setOverviewLoading] = useState<boolean>(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [alertsDrawerOpen, setAlertsDrawerOpen] = useState(false);

  const [selectedIntel, setSelectedIntel] =
    useState<LocationIntelligence | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [intelError, setIntelError] = useState<string | null>(null);
  const [intelDrawerOpen, setIntelDrawerOpen] = useState(false);

  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [aiSeedPrompt, setAiSeedPrompt] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [savedLocations, setSavedLocations] = useState<SavedLocationItem[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>({
    unitSystem: 'metric',
    alertMinSeverity: 'moderate',
    defaultRegion: 'Global',
  });

  const getToken = useCallback(async () => {
    if (!auth.currentUser) return null;
    return await auth.currentUser.getIdToken();
  }, []);

  const refreshOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const [ovRes, alRes] = await Promise.all([
        fetch('/api/planet/overview'),
        fetch('/api/alerts'),
      ]);
      if (!ovRes.ok) {
        const errBody = await ovRes.json().catch(() => ({}));
        throw new Error(errBody.error || 'Failed to load planetary telemetry.');
      }
      const ovData = (await ovRes.json()) as PlanetaryOverviewPayload;
      setOverview(ovData);

      if (alRes.ok) {
        const alData = (await alRes.json()) as { alerts: AlertItem[] };
        setAlerts(alData.alerts ?? []);
      }
    } catch (err: unknown) {
      setOverviewError(
        err instanceof Error ? err.message : 'Unable to reach planetary feeds.'
      );
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshOverview();
    const interval = setInterval(() => {
      void refreshOverview();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshOverview]);

  const loadUserCloudState = useCallback(async (currentUser: User) => {
    try {
      const token = await currentUser.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };
      const [meRes, wlRes] = await Promise.all([
        fetch('/api/user/me', { headers }),
        fetch('/api/watchlist', { headers }),
      ]);
      if (meRes.ok) {
        const profile = (await meRes.json()) as Partial<UserPreferences>;
        setPreferences((prev) => ({
          unitSystem:
            profile.unitSystem === 'imperial' ? 'imperial' : prev.unitSystem,
          alertMinSeverity:
            profile.alertMinSeverity === 'low' ||
            profile.alertMinSeverity === 'moderate' ||
            profile.alertMinSeverity === 'high' ||
            profile.alertMinSeverity === 'critical'
              ? profile.alertMinSeverity
              : prev.alertMinSeverity,
          defaultRegion: profile.defaultRegion || prev.defaultRegion,
        }));
      }
      if (wlRes.ok) {
        const wl = (await wlRes.json()) as { locations: SavedLocationItem[] };
        setSavedLocations(wl.locations ?? []);
      }
    } catch {
      // Fail gracefully without crashing UI
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
      if (firebaseUser) {
        void loadUserCloudState(firebaseUser);
      } else {
        setSavedLocations([]);
      }
    });
    return () => unsub();
  }, [loadUserCloudState]);

  const signInWithGoogle = useCallback(async () => {
    await signInWithPopup(auth, googleAuthProvider);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const inspectCoordinates = useCallback(
    async (lat: number, lng: number, explicitName?: string) => {
      setIntelDrawerOpen(true);
      setIntelLoading(true);
      setIntelError(null);
      try {
        const token = await getToken();
        const params = new URLSearchParams({
          lat: lat.toFixed(4),
          lng: lng.toFixed(4),
        });
        if (explicitName) params.set('name', explicitName);
        const res = await fetch(`/api/location/intelligence?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to retrieve location intelligence.');
        }
        const data = (await res.json()) as LocationIntelligence;
        if (data.enrichment?.quotaExceeded) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        setSelectedIntel(data);
      } catch (err: unknown) {
        setIntelError(
          err instanceof Error ? err.message : 'Unable to query coordinates.'
        );
      } finally {
        setIntelLoading(false);
      }
    },
    [getToken]
  );

  const flyToLocation = useCallback(
    (lat: number, lng: number, zoom = 6, inspectName?: string) => {
      setActiveView('map');
      setMapCameraTarget({ lat, lng, zoom, nonce: Date.now() });
      void inspectCoordinates(lat, lng, inspectName);
    },
    [inspectCoordinates]
  );

  const saveCurrentLocation = useCallback(
    async (loc: {
      name: string;
      country?: string;
      latitude: number;
      longitude: number;
    }) => {
      const token = await getToken();
      if (!token) {
        await signInWithGoogle();
        return;
      }
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(loc),
      });
      if (res.ok) {
        const created = (await res.json()) as SavedLocationItem;
        setSavedLocations((prev) => [created, ...prev]);
      }
    },
    [getToken, signInWithGoogle]
  );

  const removeSavedLocation = useCallback(
    async (id: number) => {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`/api/watchlist/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setSavedLocations((prev) => prev.filter((item) => item.id !== id));
      }
    },
    [getToken]
  );

  const updatePreferences = useCallback(
    async (next: Partial<UserPreferences>) => {
      setPreferences((prev) => ({ ...prev, ...next }));
      const token = await getToken();
      if (!token) return;
      await fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(next),
      });
    },
    [getToken]
  );

  const acknowledgeAlertById = useCallback(
    async (dbId: number) => {
      const token = await getToken();
      if (!token) {
        await signInWithGoogle();
        return;
      }
      const res = await fetch(`/api/alerts/${dbId}/ack`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setAlerts((prev) =>
          prev.map((a) => (a.dbId === dbId ? { ...a, acknowledged: true } : a))
        );
      }
    },
    [getToken, signInWithGoogle]
  );

  const formatTemp = useCallback(
    (c: number | null | undefined) => {
      if (c === null || c === undefined || !Number.isFinite(c)) return '—';
      if (preferences.unitSystem === 'imperial') {
        return `${((c * 9) / 5 + 32).toFixed(1)} °F`;
      }
      return `${c.toFixed(1)} °C`;
    },
    [preferences.unitSystem]
  );

  const formatSpeed = useCallback(
    (kmh: number | null | undefined) => {
      if (kmh === null || kmh === undefined || !Number.isFinite(kmh)) return '—';
      if (preferences.unitSystem === 'imperial') {
        return `${(kmh * 0.621371).toFixed(1)} mph`;
      }
      return `${kmh.toFixed(1)} km/h`;
    },
    [preferences.unitSystem]
  );

  const openAiDetectiveWithPrompt = useCallback((prompt: string) => {
    setAiSeedPrompt(prompt);
    setActiveView('ai-detective');
  }, []);

  const clearAiSeedPrompt = useCallback(() => {
    setAiSeedPrompt(null);
  }, []);

  return (
    <EarthContext.Provider
      value={{
        activeView,
        setActiveView,
        activeLayer,
        setActiveLayer,
        mapCameraTarget,
        flyToLocation,
        overview,
        overviewLoading,
        overviewError,
        refreshOverview,
        alerts,
        alertsDrawerOpen,
        setAlertsDrawerOpen,
        acknowledgeAlertById,
        selectedIntel,
        intelLoading,
        intelError,
        intelDrawerOpen,
        setIntelDrawerOpen,
        inspectCoordinates,
        compareModalOpen,
        setCompareModalOpen,
        user,
        authLoading,
        signInWithGoogle,
        logout,
        savedLocations,
        saveCurrentLocation,
        removeSavedLocation,
        preferences,
        updatePreferences,
        formatTemp,
        formatSpeed,
        aiSeedPrompt,
        openAiDetectiveWithPrompt,
        clearAiSeedPrompt,
      }}
    >
      {children}
    </EarthContext.Provider>
  );
};

export function useEarth() {
  const ctx = useContext(EarthContext);
  if (!ctx) throw new Error('useEarth must be used inside EarthProvider');
  return ctx;
}
