import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  unitSystem: text('unit_system').default('metric').notNull(),
  alertMinSeverity: text('alert_min_severity').default('moderate').notNull(),
  defaultRegion: text('default_region').default('Global').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const savedLocations = pgTable('saved_locations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  country: text('country'),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const environmentalObservations = pgTable('environmental_observations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  locationKey: text('location_key').notNull(),
  locationName: text('location_name').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  source: text('source').notNull(),
  temperatureC: doublePrecision('temperature_c'),
  humidityPct: doublePrecision('humidity_pct'),
  windSpeedKmh: doublePrecision('wind_speed_kmh'),
  precipitationMm: doublePrecision('precipitation_mm'),
  aqi: integer('aqi'),
  pm25: doublePrecision('pm25'),
  anomalyZScore: doublePrecision('anomaly_z_score'),
  wildfireRiskScore: doublePrecision('wildfire_risk_score'),
  floodRiskScore: doublePrecision('flood_risk_score'),
  observedAt: timestamp('observed_at').defaultNow().notNull(),
});

export const alertRecords = pgTable('alert_records', {
  id: serial('id').primaryKey(),
  externalId: text('external_id').notNull().unique(),
  category: text('category').notNull(),
  severity: text('severity').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  locationName: text('location_name').notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  source: text('source').notNull(),
  detectedAt: timestamp('detected_at').notNull(),
  acknowledged: boolean('acknowledged').default(false).notNull(),
  acknowledgedByUid: text('acknowledged_by_uid'),
});

export const usersRelations = relations(users, ({ many }) => ({
  savedLocations: many(savedLocations),
  observations: many(environmentalObservations),
}));

export const savedLocationsRelations = relations(savedLocations, ({ one }) => ({
  user: one(users, {
    fields: [savedLocations.userId],
    references: [users.id],
  }),
}));

export const environmentalObservationsRelations = relations(
  environmentalObservations,
  ({ one }) => ({
    user: one(users, {
      fields: [environmentalObservations.userId],
      references: [users.id],
    }),
  })
);
