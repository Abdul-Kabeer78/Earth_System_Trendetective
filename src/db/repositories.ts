import { and, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  alertRecords,
  environmentalObservations,
  savedLocations,
  users,
} from './schema.ts';

export async function getOrCreateUser(
  uid: string,
  email: string,
  displayName?: string | null
) {
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName: displayName ?? null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(displayName !== undefined ? { displayName } : {}),
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed (getOrCreateUser):', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function updateUserPreferences(
  uid: string,
  prefs: {
    unitSystem?: string;
    alertMinSeverity?: string;
    defaultRegion?: string;
  }
) {
  try {
    const updated = await db
      .update(users)
      .set({
        ...(prefs.unitSystem ? { unitSystem: prefs.unitSystem } : {}),
        ...(prefs.alertMinSeverity
          ? { alertMinSeverity: prefs.alertMinSeverity }
          : {}),
        ...(prefs.defaultRegion ? { defaultRegion: prefs.defaultRegion } : {}),
      })
      .where(eq(users.uid, uid))
      .returning();
    return updated[0] ?? null;
  } catch (error) {
    console.error('Database query failed (updateUserPreferences):', error);
    throw new Error('Failed to update user preferences.', { cause: error });
  }
}

export async function getSavedLocations(uid: string) {
  try {
    return await db
      .select({
        id: savedLocations.id,
        name: savedLocations.name,
        country: savedLocations.country,
        latitude: savedLocations.latitude,
        longitude: savedLocations.longitude,
        notes: savedLocations.notes,
        createdAt: savedLocations.createdAt,
      })
      .from(savedLocations)
      .innerJoin(users, eq(savedLocations.userId, users.id))
      .where(eq(users.uid, uid))
      .orderBy(desc(savedLocations.createdAt));
  } catch (error) {
    console.error('Database query failed (getSavedLocations):', error);
    throw new Error('Failed to load saved locations.', { cause: error });
  }
}

export async function addSavedLocation(
  uid: string,
  email: string,
  loc: {
    name: string;
    country?: string | null;
    latitude: number;
    longitude: number;
    notes?: string | null;
  }
) {
  try {
    const user = await getOrCreateUser(uid, email);
    const inserted = await db
      .insert(savedLocations)
      .values({
        userId: user.id,
        name: loc.name,
        country: loc.country ?? null,
        latitude: loc.latitude,
        longitude: loc.longitude,
        notes: loc.notes ?? null,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed (addSavedLocation):', error);
    throw new Error('Failed to save location.', { cause: error });
  }
}

export async function deleteSavedLocation(uid: string, locationId: number) {
  try {
    const user = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.uid, uid))
      .limit(1);
    if (!user[0]) return false;

    const deleted = await db
      .delete(savedLocations)
      .where(
        and(
          eq(savedLocations.id, locationId),
          eq(savedLocations.userId, user[0].id)
        )
      )
      .returning();
    return deleted.length > 0;
  } catch (error) {
    console.error('Database query failed (deleteSavedLocation):', error);
    throw new Error('Failed to remove saved location.', { cause: error });
  }
}

export async function logEnvironmentalObservation(obs: {
  uid?: string | null;
  email?: string | null;
  locationKey: string;
  locationName: string;
  latitude: number;
  longitude: number;
  source: string;
  temperatureC?: number | null;
  humidityPct?: number | null;
  windSpeedKmh?: number | null;
  precipitationMm?: number | null;
  aqi?: number | null;
  pm25?: number | null;
  anomalyZScore?: number | null;
  wildfireRiskScore?: number | null;
  floodRiskScore?: number | null;
}) {
  try {
    let userId: number | null = null;
    if (obs.uid && obs.email) {
      const user = await getOrCreateUser(obs.uid, obs.email);
      userId = user.id;
    }

    const inserted = await db
      .insert(environmentalObservations)
      .values({
        userId,
        locationKey: obs.locationKey,
        locationName: obs.locationName,
        latitude: obs.latitude,
        longitude: obs.longitude,
        source: obs.source,
        temperatureC: obs.temperatureC ?? null,
        humidityPct: obs.humidityPct ?? null,
        windSpeedKmh: obs.windSpeedKmh ?? null,
        precipitationMm: obs.precipitationMm ?? null,
        aqi: obs.aqi ?? null,
        pm25: obs.pm25 ?? null,
        anomalyZScore: obs.anomalyZScore ?? null,
        wildfireRiskScore: obs.wildfireRiskScore ?? null,
        floodRiskScore: obs.floodRiskScore ?? null,
      })
      .returning();
    return inserted[0];
  } catch (error) {
    console.error('Database query failed (logEnvironmentalObservation):', error);
    throw new Error('Failed to record observation.', { cause: error });
  }
}

export async function getObservationHistory(limit = 50) {
  try {
    return await db
      .select()
      .from(environmentalObservations)
      .orderBy(desc(environmentalObservations.observedAt))
      .limit(limit);
  } catch (error) {
    console.error('Database query failed (getObservationHistory):', error);
    throw new Error('Failed to retrieve observation history.', { cause: error });
  }
}

export async function upsertAlerts(
  alerts: Array<{
    externalId: string;
    category: string;
    severity: string;
    title: string;
    description: string;
    locationName: string;
    latitude: number;
    longitude: number;
    source: string;
    detectedAt: Date;
  }>
) {
  if (alerts.length === 0) return [];
  try {
    const results = [];
    for (const item of alerts.slice(0, 60)) {
      const res = await db
        .insert(alertRecords)
        .values({
          externalId: item.externalId,
          category: item.category,
          severity: item.severity,
          title: item.title,
          description: item.description,
          locationName: item.locationName,
          latitude: item.latitude,
          longitude: item.longitude,
          source: item.source,
          detectedAt: item.detectedAt,
        })
        .onConflictDoUpdate({
          target: alertRecords.externalId,
          set: {
            severity: item.severity,
            title: item.title,
            description: item.description,
            detectedAt: item.detectedAt,
          },
        })
        .returning();
      if (res[0]) results.push(res[0]);
    }
    return results;
  } catch (error) {
    console.error('Database query failed (upsertAlerts):', error);
    throw new Error('Failed to persist alert records.', { cause: error });
  }
}

export async function getStoredAlerts(limit = 80) {
  try {
    return await db
      .select()
      .from(alertRecords)
      .orderBy(desc(alertRecords.detectedAt))
      .limit(limit);
  } catch (error) {
    console.error('Database query failed (getStoredAlerts):', error);
    throw new Error('Failed to retrieve alerts.', { cause: error });
  }
}

export async function acknowledgeAlert(alertId: number, uid: string) {
  try {
    const updated = await db
      .update(alertRecords)
      .set({
        acknowledged: true,
        acknowledgedByUid: uid,
      })
      .where(eq(alertRecords.id, alertId))
      .returning();
    return updated[0] ?? null;
  } catch (error) {
    console.error('Database query failed (acknowledgeAlert):', error);
    throw new Error('Failed to acknowledge alert.', { cause: error });
  }
}
