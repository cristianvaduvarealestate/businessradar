import { getDatabase } from './db';

export interface AuditEvent {
  user: string;
  action: 'EXPORT' | 'PIPELINE_UPDATE' | 'AUTH_LOGIN' | 'AUTH_FAILED' | 'SETTINGS_CHANGE';
  resource?: string;
  details?: Record<string, any>;
  status: 'SUCCESS' | 'DENIED' | 'FAILED';
  ip?: string;
}

/**
 * Records a security or administrative audit event
 */
export function logAuditEvent(event: AuditEvent): void {
  const timestamp = new Date().toISOString();
  const structuredEntry = {
    timestamp,
    ...event,
  };

  // Structured log for Cloudflare Worker logs & observability
  console.log(`[AUDIT_LOG] ${JSON.stringify(structuredEntry)}`);

  // Also write to audit_log table if available
  try {
    const db = getDatabase();
    if (db && typeof db.prepare === 'function') {
      db.prepare(`
        INSERT INTO audit_log (cui, entity_table, field_name, old_value, new_value, source, confidence, changed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        event.resource ? (parseInt(event.resource, 10) || 0) : 0,
        event.action,
        'action_details',
        null,
        JSON.stringify(event.details || {}),
        `USER:${event.user}`,
        1.0,
        timestamp
      );
    }
  } catch (err) {
    // If database is read-only or in edge snapshot mode, the structured log above serves as the audit record
  }
}
