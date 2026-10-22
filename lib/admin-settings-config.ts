export const ADMIN_SETTINGS_DEFAULTS = {
  recentReportHours: 72,
  publicReportVisibilityHours: 24,
  showLikelyRecededReports: true,
  autoArchiveExpiredReports: true,
  newReportAlerts: true,
  highSeverityAlerts: true,
  pendingReportReminders: false,
  reminderMinutes: 60,
  centerUpdateAlerts: true,
} as const;

export type AdminSettingsValues = {
  recentReportHours: 24 | 48 | 72 | 168;
  publicReportVisibilityHours: 12 | 24 | 48 | 72;
  showLikelyRecededReports: boolean;
  autoArchiveExpiredReports: boolean;
  newReportAlerts: boolean;
  highSeverityAlerts: boolean;
  pendingReportReminders: boolean;
  reminderMinutes: 30 | 60 | 180 | 360;
  centerUpdateAlerts: boolean;
};

export const ADMIN_SETTINGS_KEYS = Object.keys(ADMIN_SETTINGS_DEFAULTS) as (keyof AdminSettingsValues)[];

export function parseAdminSettings(input: unknown): AdminSettingsValues | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (Object.keys(value).length !== ADMIN_SETTINGS_KEYS.length ||
    Object.keys(value).some((key) => !ADMIN_SETTINGS_KEYS.includes(key as keyof AdminSettingsValues))) return null;
  if (![24, 48, 72, 168].includes(value.recentReportHours as number) ||
    ![12, 24, 48, 72].includes(value.publicReportVisibilityHours as number) ||
    ![30, 60, 180, 360].includes(value.reminderMinutes as number) ||
    ["newReportAlerts", "highSeverityAlerts", "pendingReportReminders", "centerUpdateAlerts", "showLikelyRecededReports", "autoArchiveExpiredReports"].some((key) => typeof value[key] !== "boolean")) return null;
  return value as AdminSettingsValues;
}

export function settingsFromRows(rows: { key: string; value: string }[]): AdminSettingsValues {
  const values: Record<string, unknown> = { ...ADMIN_SETTINGS_DEFAULTS };
  for (const row of rows) {
    if (!ADMIN_SETTINGS_KEYS.includes(row.key as keyof AdminSettingsValues)) continue;
    try { values[row.key] = JSON.parse(row.value); } catch { /* Keep the safe default. */ }
  }
  return parseAdminSettings(values) ?? { ...ADMIN_SETTINGS_DEFAULTS };
}
