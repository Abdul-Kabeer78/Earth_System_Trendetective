export type NavView =
  | 'overview'
  | 'map'
  | 'climate'
  | 'disasters'
  | 'wildfire'
  | 'forest'
  | 'ocean'
  | 'air-quality'
  | 'ai-detective'
  | 'reports'
  | 'settings';

export type MapLayerId =
  | 'live-weather'
  | 'temperature-heatmap'
  | 'rainfall'
  | 'wildfire'
  | 'flood'
  | 'storm'
  | 'air-quality'
  | 'deforestation'
  | 'ocean-temperature'
  | 'vegetation-health'
  | 'drought'
  | 'satellite-imagery';

export interface DataSourceStatus {
  id: string;
  name: string;
  provider: string;
  status: 'live' | 'unconfigured' | 'unavailable';
  requiresKey: boolean;
  configured: boolean;
  lastUpdated: string | null;
  note: string;
}

export interface NaturalEvent {
  id: string;
  title: string;
  category:
    | 'wildfires'
    | 'severeStorms'
    | 'floods'
    | 'volcanoes'
    | 'drought'
    | 'earthquakes'
    | 'dustHaze'
    | 'seaLakeIce'
    | 'other';
  categoryLabel: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  latitude: number;
  longitude: number;
  date: string;
  source: string;
  sourceUrl?: string;
  magnitude?: number;
  depthKm?: number;
  description: string;
}

export interface WeatherAlertItem {
  id: string;
  event: string;
  headline: string;
  severity: 'Extreme' | 'Severe' | 'Moderate' | 'Minor' | 'Unknown';
  areaDesc: string;
  senderName: string;
  sentAt: string;
  expiresAt: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
  sourceUrl: string;
}

export interface NoaaBuoyObservation {
  stationId: string;
  latitude: number;
  longitude: number;
  observedAt: string;
  windSpeedMs: number | null;
  waveHeightM: number | null;
  dominantPeriodS: number | null;
  pressureHpa: number | null;
  airTempC: number | null;
  seaSurfaceTempC: number | null;
  source: string;
}

export interface UsgsWaterGauge {
  siteCode: string;
  siteName: string;
  latitude: number;
  longitude: number;
  dischargeCfs: number | null;
  gageHeightFt: number | null;
  observedAt: string;
  source: string;
}

export interface SatelliteObservationRecord {
  provider: 'NASA Earthdata CMR' | 'ESA Copernicus Sentinel' | 'Global Forest Watch';
  dataset: string;
  identifier: string;
  timestamp: string;
  summary: string;
}

export interface GlobalStationReading {
  id: string;
  name: string;
  country: string;
  region: string;
  biome: string;
  latitude: number;
  longitude: number;
  temperatureC: number;
  apparentTempC: number;
  humidityPct: number;
  windSpeedKmh: number;
  precipitationMm: number;
  cloudCoverPct: number;
  pressureHpa: number;
  weatherCode: number;
  usAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  uvIndex: number | null;
  baselineTempC: number;
  anomalyC: number;
  wildfireRiskScore: number;
  observedAt: string;
}

export interface OceanBuoyReading {
  id: string;
  basin: string;
  latitude: number;
  longitude: number;
  waveHeightM: number | null;
  wavePeriodS: number | null;
  waveDirectionDeg: number | null;
  swellHeightM: number | null;
  airTempC: number | null;
  windSpeedKmh: number | null;
  observedAt: string;
  source: string;
}

export interface TrendAnalysisResult {
  slopePerYear: number;
  mannKendallS: number;
  zStatistic: number;
  pValueApprox: number;
  direction: 'increasing' | 'decreasing' | 'no-significant-trend';
  confidenceNote: string;
  sampleCount: number;
}

export interface AnomalyDetectionResult {
  currentValue: number;
  baselineMean: number;
  baselineStdDev: number;
  zScore: number;
  percentile: number;
  classification:
    | 'Extreme Warm Anomaly'
    | 'Warm Anomaly'
    | 'Normal Range'
    | 'Cool Anomaly'
    | 'Extreme Cool Anomaly';
  sampleSize: number;
  baselinePeriod: string;
  uncertaintyNote: string;
}

export interface RiskEstimate {
  score: number;
  level: 'Low' | 'Moderate' | 'High' | 'Very High';
  drivers: string[];
  methodology: string;
  uncertaintyDisclaimer: string;
}

export interface LocationEnrichment {
  openWeather: {
    tempC: number;
    feelsLikeC: number;
    humidityPct: number;
    pressureHpa: number;
    windSpeedKmh: number;
    description: string;
    observedAt: string;
    source: string;
  } | null;
  openAq: {
    locationName: string;
    distanceKm: number;
    sensors: Array<{ parameter: string; value: number | null; unit: string }>;
    observedAt: string;
    source: string;
  } | null;
  googleMaps: {
    elevationM: number | null;
    elevationResolutionM: number | null;
    timeZoneId: string | null;
    timeZoneName: string | null;
    weather: {
      tempC: number;
      condition: string;
      humidityPct: number;
      uvIndex: number | null;
      windKmh: number | null;
    } | null;
    airQuality: {
      uaqi: number | null;
      category: string | null;
      dominantPollutant: string | null;
      healthRecommendation: string | null;
    } | null;
    pollen: {
      treeUpi: number | null;
      grassUpi: number | null;
      weedUpi: number | null;
      summary: string | null;
    } | null;
    solar: {
      maxArrayPanelsCount: number;
      maxSunshineHoursPerYear: number;
      carbonOffsetFactorKgPerMwh: number;
    } | null;
    weatherAlerts: Array<{
      title: string;
      severity: string;
      agencyName: string;
      agencyUrl: string;
    }>;
  } | null;
  quotaExceeded?: boolean;
}

export interface LocationIntelligence {
  location: {
    name: string;
    country: string;
    adminArea: string;
    latitude: number;
    longitude: number;
    elevationM: number | null;
    timezone: string;
  };
  currentWeather: {
    temperatureC: number;
    apparentTempC: number;
    humidityPct: number;
    windSpeedKmh: number;
    windDirectionDeg: number;
    precipitationMm: number;
    cloudCoverPct: number;
    surfacePressureHpa: number;
    weatherCode: number;
    weatherLabel: string;
    observedAt: string;
    source: string;
  };
  airQuality: {
    usAqi: number | null;
    europeanAqi: number | null;
    pm25: number | null;
    pm10: number | null;
    no2: number | null;
    o3: number | null;
    so2: number | null;
    co: number | null;
    dust: number | null;
    uvIndex: number | null;
    whoExceedances: string[];
    observedAt: string;
    source: string;
  };
  solarAndClimate: {
    nasaPowerAvailable: boolean;
    recentSolarIrradianceKwhM2: number | null;
    recentMeanTempC: number | null;
    recentTotalPrecipMm: number | null;
    dailySeries: Array<{
      date: string;
      tempMeanC: number;
      precipMm: number;
      solarKwhM2: number | null;
    }>;
    source: string;
  };
  forecast7d: Array<{
    date: string;
    tempMaxC: number;
    tempMinC: number;
    precipSumMm: number;
    windMaxKmh: number;
  }>;
  historicalAnomaly: AnomalyDetectionResult;
  climateTrend: TrendAnalysisResult;
  wildfireRisk: RiskEstimate;
  floodRisk: RiskEstimate;
  nearbyEvents: Array<NaturalEvent & { distanceKm: number }>;
  enrichment?: LocationEnrichment;
  fetchedAt: string;
}

export interface PlanetaryOverviewPayload {
  summary: {
    meanStationTempC: number;
    meanTempAnomalyC: number;
    activeWildfiresCount: number;
    firmsHotspotsCount: number;
    activeDisasterCount: number;
    weatherAlertsCount: number;
    usgsRiverGaugesCount: number;
    meanUsAqi: number | null;
    elevatedAqiStations: number;
    totalPrecipStationsMm: number;
    meanOceanWaveHeightM: number | null;
    atmosphericCo2Ppm: number | null;
    atmosphericCo2TrendPpm: number | null;
    atmosphericCo2Date: string | null;
    latestSatelliteDate: string;
    earthdataLatestGranuleTime: string | null;
    sentinelLatestTimestamp: string | null;
    gfwLatestVersion: string | null;
    stationCount: number;
    fetchedAt: string;
  };
  stations: GlobalStationReading[];
  events: NaturalEvent[];
  weatherAlerts: WeatherAlertItem[];
  oceanBuoys: OceanBuoyReading[];
  noaaBuoys: NoaaBuoyObservation[];
  usgsRiverGauges: UsgsWaterGauge[];
  satelliteFeeds: SatelliteObservationRecord[];
  sources: DataSourceStatus[];
}

export interface AlertItem {
  id: string;
  dbId?: number;
  category: string;
  severity: 'low' | 'moderate' | 'high' | 'critical';
  title: string;
  description: string;
  locationName: string;
  latitude: number;
  longitude: number;
  source: string;
  detectedAt: string;
  acknowledged: boolean;
}
