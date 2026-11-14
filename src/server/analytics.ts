import type {
  AnomalyDetectionResult,
  RiskEstimate,
  TrendAnalysisResult,
} from '../types/earth.ts';

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  if (values.length < 2) return 1;
  const variance =
    values.reduce((acc, v) => acc + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.max(Math.sqrt(variance), 0.15);
}

// Approximate standard normal CDF (Abramowitz and Stegun 7.1.26)
function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t) *
      Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

export function detectTemperatureAnomaly(
  currentValue: number,
  historicalSamples: number[],
  baselinePeriod: string
): AnomalyDetectionResult {
  const valid = historicalSamples.filter((v) => Number.isFinite(v));
  const mu = valid.length > 0 ? mean(valid) : currentValue;
  const sigma = valid.length > 1 ? stdDev(valid, mu) : 1.5;
  const zScore = Number(((currentValue - mu) / sigma).toFixed(2));
  const percentile = Math.round(normalCdf(zScore) * 100);

  let classification: AnomalyDetectionResult['classification'] = 'Normal Range';
  if (zScore >= 2.0) classification = 'Extreme Warm Anomaly';
  else if (zScore >= 1.0) classification = 'Warm Anomaly';
  else if (zScore <= -2.0) classification = 'Extreme Cool Anomaly';
  else if (zScore <= -1.0) classification = 'Cool Anomaly';

  return {
    currentValue: Number(currentValue.toFixed(2)),
    baselineMean: Number(mu.toFixed(2)),
    baselineStdDev: Number(sigma.toFixed(2)),
    zScore,
    percentile,
    classification,
    sampleSize: valid.length,
    baselinePeriod,
    uncertaintyNote:
      valid.length >= 10
        ? `Computed against N=${valid.length} historical observations (±1σ = ${sigma.toFixed(2)} °C). Single-point anomalies reflect short-term synoptic variability and do not alone establish long-term climate shifts.`
        : 'Limited historical baseline samples retrieved; Z-score carries elevated statistical uncertainty.',
  };
}

export function analyzeTimeSeriesTrend(
  points: Array<{ xYear: number; yValue: number }>
): TrendAnalysisResult {
  const valid = points.filter(
    (p) => Number.isFinite(p.xYear) && Number.isFinite(p.yValue)
  );
  const n = valid.length;
  if (n < 4) {
    return {
      slopePerYear: 0,
      mannKendallS: 0,
      zStatistic: 0,
      pValueApprox: 1,
      direction: 'no-significant-trend',
      confidenceNote:
        'Insufficient observations (N < 4) to evaluate a statistically meaningful monotonic trend.',
      sampleCount: n,
    };
  }

  // Ordinary Least Squares slope
  const xMean = mean(valid.map((p) => p.xYear));
  const yMean = mean(valid.map((p) => p.yValue));
  let num = 0;
  let den = 0;
  for (const p of valid) {
    num += (p.xYear - xMean) * (p.yValue - yMean);
    den += (p.xYear - xMean) ** 2;
  }
  const slope = den > 0 ? num / den : 0;

  // Mann-Kendall S statistic
  let s = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const diff = valid[j].yValue - valid[i].yValue;
      if (diff > 0) s += 1;
      else if (diff < 0) s -= 1;
    }
  }
  const varS = (n * (n - 1) * (2 * n + 5)) / 18;
  let z = 0;
  if (s > 0) z = (s - 1) / Math.sqrt(varS);
  else if (s < 0) z = (s + 1) / Math.sqrt(varS);

  const pValue = Math.min(1, Math.max(0.0001, 2 * (1 - normalCdf(Math.abs(z)))));
  let direction: TrendAnalysisResult['direction'] = 'no-significant-trend';
  if (pValue < 0.1) {
    direction = s > 0 ? 'increasing' : 'decreasing';
  }

  return {
    slopePerYear: Number(slope.toFixed(4)),
    mannKendallS: s,
    zStatistic: Number(z.toFixed(2)),
    pValueApprox: Number(pValue.toFixed(4)),
    direction,
    confidenceNote:
      pValue < 0.05
        ? `Mann-Kendall monotonic test suggests a statistically notable ${direction} tendency (p ≈ ${pValue.toFixed(3)}, N=${n}). Observed trend is descriptive and does not isolate causal attribution.`
        : `Trend magnitude (${slope >= 0 ? '+' : ''}${slope.toFixed(3)}/yr) is not statistically distinguishable from natural interannual variance at α=0.05 (p ≈ ${pValue.toFixed(3)}, N=${n}).`,
    sampleCount: n,
  };
}

export function estimateWildfireRisk(params: {
  temperatureC: number;
  humidityPct: number;
  windSpeedKmh: number;
  recentPrecipMm: number;
}): RiskEstimate {
  const { temperatureC, humidityPct, windSpeedKmh, recentPrecipMm } = params;
  // Saturation & actual vapor pressure (Tetens formula) -> Vapor Pressure Deficit (kPa)
  const es =
    0.61078 * Math.exp((17.27 * temperatureC) / (temperatureC + 237.3));
  const ea = es * Math.max(0.05, Math.min(1, humidityPct / 100));
  const vpd = Math.max(0, es - ea);

  const vpdFactor = Math.min(40, vpd * 12);
  const dryFactor = Math.max(0, (55 - humidityPct) * 0.45);
  const windFactor = Math.min(25, windSpeedKmh * 0.75);
  const precipSuppression = Math.min(28, recentPrecipMm * 1.4);

  const rawScore = Math.max(
    2,
    Math.min(98, vpdFactor + dryFactor + windFactor - precipSuppression + 12)
  );
  const score = Math.round(rawScore);

  const drivers: string[] = [];
  if (vpd > 1.8) drivers.push(`Elevated vapor pressure deficit (${vpd.toFixed(2)} kPa)`);
  if (humidityPct < 35) drivers.push(`Low relative humidity (${humidityPct.toFixed(0)}%)`);
  if (windSpeedKmh > 25) drivers.push(`Sustained surface wind (${windSpeedKmh.toFixed(1)} km/h)`);
  if (recentPrecipMm < 2) drivers.push(`Dry antecedent surface (${recentPrecipMm.toFixed(1)} mm recent precip)`);
  if (drivers.length === 0) drivers.push('Moderate moisture and wind equilibrium');

  let level: RiskEstimate['level'] = 'Low';
  if (score >= 75) level = 'Very High';
  else if (score >= 55) level = 'High';
  else if (score >= 30) level = 'Moderate';

  return {
    score,
    level,
    drivers,
    methodology:
      'Composite Fire Weather Index proxy combining Tetens Vapor Pressure Deficit (VPD), relative humidity, 10m wind speed, and antecedent precipitation.',
    uncertaintyDisclaimer:
      'Statistical meteorological risk indicator only—does not confirm ignition sources, local fuel moisture, or active fire spread.',
  };
}

export function estimateFloodRisk(params: {
  recentPrecipMm: number;
  forecast7dPrecipMm: number;
  elevationM: number | null;
}): RiskEstimate {
  const { recentPrecipMm, forecast7dPrecipMm, elevationM } = params;
  const totalPrecip = recentPrecipMm + forecast7dPrecipMm;
  const precipScore = Math.min(72, totalPrecip * 0.55);
  const lowElevationBonus =
    elevationM !== null && elevationM < 40
      ? 18
      : elevationM !== null && elevationM < 150
        ? 8
        : 0;
  const score = Math.round(Math.max(3, Math.min(96, precipScore + lowElevationBonus)));

  const drivers: string[] = [];
  if (forecast7dPrecipMm > 40) {
    drivers.push(`Heavy 7-day forecast accumulation (${forecast7dPrecipMm.toFixed(1)} mm)`);
  }
  if (recentPrecipMm > 25) {
    drivers.push(`Recent surface saturation (${recentPrecipMm.toFixed(1)} mm)`);
  }
  if (elevationM !== null && elevationM < 50) {
    drivers.push(`Low-lying terrain elevation (${Math.round(elevationM)} m ASL)`);
  }
  if (drivers.length === 0) {
    drivers.push('Precipitation totals within typical drainage capacity');
  }

  let level: RiskEstimate['level'] = 'Low';
  if (score >= 72) level = 'Very High';
  else if (score >= 50) level = 'High';
  else if (score >= 28) level = 'Moderate';

  return {
    score,
    level,
    drivers,
    methodology:
      'Hydro-meteorological proxy combining antecedent rainfall, 7-day numerical forecast totals, and DEM terrain elevation.',
    uncertaintyDisclaimer:
      'Screening index only—local drainage infrastructure, soil permeability, and upstream river discharge are not modeled.',
  };
}

export function evaluateWhoAirQuality(metrics: {
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
}): string[] {
  const exceedances: string[] = [];
  if (metrics.pm25 !== null && metrics.pm25 > 15) {
    exceedances.push(
      `PM2.5 (${metrics.pm25.toFixed(1)} µg/m³) exceeds WHO 24h guideline (15 µg/m³)`
    );
  }
  if (metrics.pm10 !== null && metrics.pm10 > 45) {
    exceedances.push(
      `PM10 (${metrics.pm10.toFixed(1)} µg/m³) exceeds WHO 24h guideline (45 µg/m³)`
    );
  }
  if (metrics.no2 !== null && metrics.no2 > 25) {
    exceedances.push(
      `NO₂ (${metrics.no2.toFixed(1)} µg/m³) exceeds WHO 24h guideline (25 µg/m³)`
    );
  }
  if (metrics.o3 !== null && metrics.o3 > 100) {
    exceedances.push(
      `O₃ (${metrics.o3.toFixed(1)} µg/m³) exceeds WHO 8h peak guideline (100 µg/m³)`
    );
  }
  return exceedances;
}
