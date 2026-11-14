import crypto from 'crypto';
import { getDatabase } from './db';

export interface TelegramConfig {
  botToken?: string;
  chatId?: string;
}

export interface CompanyAlertPayload {
  cui: number;
  name: string;
  incorporationDate?: string;
  county?: string;
  city?: string;
  primaryCaen?: string;
  caenDescription?: string;
  phone?: string;
  email?: string;
  website?: string;
  topOpportunities: string[];
}

export interface DailySummaryPayload {
  date: string;
  totalNewCompanies: number;
  topCounties: Array<{ county: string; count: number }>;
  topIndustries: Array<{ category: string; count: number }>;
  companiesWithContact: number;
  highPriorityOpportunities: number;
}

export interface HeartbeatPayload {
  status: 'OPERATIONAL' | 'DEGRADED' | 'FAILED';
  dbCompaniesCount: number;
  newCompanies24h: number;
  onrcStatus: string;
  anafStatus: string;
  jobsSuccessCount: number;
  jobsFailedCount: number;
  nextExecution: string;
}

export class TelegramService {
  private botToken: string;
  private chatId: string;

  constructor(config?: TelegramConfig) {
    this.botToken = config?.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = config?.chatId || process.env.TELEGRAM_CHAT_ID || '';
  }

  public isConfigured(): boolean {
    return Boolean(this.botToken && this.chatId);
  }

  public async sendMessage(htmlMessage: string, type: string = 'ALERT'): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const payloadHash = crypto.createHash('sha256').update(htmlMessage).digest('hex');
    const db = getDatabase();

    // Check for duplicate notification within 1 hour
    const existing = db.prepare(`
      SELECT id, status, sent_at FROM telegram_notifications 
      WHERE payload_hash = ? AND datetime(sent_at, '+1 hour') > datetime('now')
    `).get(payloadHash) as { id: number; status: string; sent_at: string } | undefined;

    if (existing) {
      return { success: true, messageId: 'DEDUPLICATED' };
    }

    if (!this.isConfigured()) {
      // Record pending notification in DB
      db.prepare(`
        INSERT OR IGNORE INTO telegram_notifications (notification_type, payload_hash, content, status, error_message)
        VALUES (?, ?, ?, 'SKIPPED', 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured')
      `).run(type, payloadHash, htmlMessage);
      return { success: false, error: 'Telegram credentials not configured' };
    }

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const payload = {
      chat_id: this.chatId,
      text: htmlMessage,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json() as { ok: boolean; result?: { message_id: number }; description?: string };

      if (data.ok && data.result) {
        const msgId = String(data.result.message_id);
        db.prepare(`
          INSERT INTO telegram_notifications (notification_type, payload_hash, content, status, sent_at, telegram_message_id)
          VALUES (?, ?, ?, 'SENT', datetime('now'), ?)
        `).run(type, payloadHash, htmlMessage, msgId);
        return { success: true, messageId: msgId };
      } else {
        const errorMsg = data.description || 'Telegram API returned error';
        db.prepare(`
          INSERT INTO telegram_notifications (notification_type, payload_hash, content, status, error_message)
          VALUES (?, ?, ?, 'FAILED', ?)
        `).run(type, payloadHash, htmlMessage, errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Network exception calling Telegram';
      db.prepare(`
        INSERT INTO telegram_notifications (notification_type, payload_hash, content, status, error_message)
        VALUES (?, ?, ?, 'FAILED', ?)
      `).run(type, payloadHash, htmlMessage, errorMsg);
      return { success: false, error: errorMsg };
    }
  }

  public async sendNewCompanyAlert(c: CompanyAlertPayload): Promise<boolean> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://radar.cristianvaduva.com';
    const profileUrl = `${appUrl}/companies/${c.cui}`;

    let msg = `🚨 <b>RADAR BUSINESS ROMÂNIA — COMPANIE NOUĂ</b>\n\n`;
    msg += `🏢 <b>${escapeHtml(c.name)}</b>\n`;
    msg += `🔢 <b>CUI:</b> <code>${c.cui}</code>\n`;
    if (c.incorporationDate) msg += `📅 <b>Înmatriculare:</b> ${escapeHtml(c.incorporationDate)}\n`;
    msg += `📍 <b>Locație:</b> ${escapeHtml(c.county || 'Nespecificat')}, ${escapeHtml(c.city || '')}\n`;
    if (c.primaryCaen) msg += `🏷️ <b>CAEN:</b> <code>${escapeHtml(c.primaryCaen)}</code> - ${escapeHtml(c.caenDescription || '')}\n`;

    if (c.phone || c.email || c.website) {
      msg += `\n📞 <b>Contact Comercial:</b>\n`;
      if (c.phone) msg += `  • Tel: <code>${escapeHtml(c.phone)}</code>\n`;
      if (c.email) msg += `  • Email: <code>${escapeHtml(c.email)}</code>\n`;
      if (c.website) msg += `  • Web: <a href="${escapeHtml(c.website)}">${escapeHtml(c.website)}</a>\n`;
    }

    if (c.topOpportunities && c.topOpportunities.length > 0) {
      msg += `\n🛡️ <b>Oportunități de Asigurare:</b>\n`;
      for (const opp of c.topOpportunities) {
        msg += `  ✅ ${escapeHtml(opp)}\n`;
      }
    }

    msg += `\n🔗 <a href="${profileUrl}">Deschide Profilul Complet în Radar</a>`;

    const res = await this.sendMessage(msg, 'NEW_COMPANY');
    return res.success;
  }

  public async sendDailySummary(s: DailySummaryPayload): Promise<boolean> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://radar.cristianvaduva.com';

    let msg = `📊 <b>RADAR BUSINESS ROMÂNIA — RAPORT ZILNIC</b>\n`;
    msg += `📅 Data: <b>${escapeHtml(s.date)}</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    msg += `✨ <b>Firme noi descoperite:</b> <b>${s.totalNewCompanies}</b>\n`;
    msg += `🎯 <b>Oportunități prioritare:</b> <b>${s.highPriorityOpportunities}</b>\n`;
    msg += `📞 <b>Firme cu date de contact:</b> <b>${s.companiesWithContact}</b>\n\n`;

    if (s.topCounties.length > 0) {
      msg += `📍 <b>Top Județe:</b>\n`;
      for (const item of s.topCounties.slice(0, 5)) {
        msg += `  • ${escapeHtml(item.county)}: ${item.count} firme\n`;
      }
      msg += `\n`;
    }

    if (s.topIndustries.length > 0) {
      msg += `🏷️ <b>Top Sectoare Economice:</b>\n`;
      for (const item of s.topIndustries.slice(0, 5)) {
        msg += `  • ${escapeHtml(item.category)}: ${item.count} firme\n`;
      }
      msg += `\n`;
    }

    msg += `🔗 <a href="${appUrl}/radar">Accesează Radarul Firme Noi</a>`;

    const res = await this.sendMessage(msg, 'DAILY_BRIEF');
    return res.success;
  }

  public async sendHeartbeat(h: HeartbeatPayload): Promise<boolean> {
    const statusEmoji = h.status === 'OPERATIONAL' ? '✅' : h.status === 'DEGRADED' ? '⚠️' : '🚨';

    let msg = `⚡ <b>RADAR BUSINESS — RAPORT TEHNIC SISTEM</b>\n`;
    msg += `Stare Generală: <b>${h.status} ${statusEmoji}</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📦 Total Companii în Baza de Date: <b>${h.dbCompaniesCount.toLocaleString('ro-RO')}</b>\n`;
    msg += `🆕 Companii Noi (Ultimele 24h): <b>${h.newCompanies24h}</b>\n`;
    msg += `🏛️ Conector ONRC: <b>${escapeHtml(h.onrcStatus)}</b>\n`;
    msg += `📑 Conector ANAF: <b>${escapeHtml(h.anafStatus)}</b>\n`;
    msg += `⚙️ Joburi Rulate: <b>${h.jobsSuccessCount} cu succes</b>, <b>${h.jobsFailedCount} eșuate</b>\n`;
    msg += `⏱️ Următoarea Sincronizare: <b>${escapeHtml(h.nextExecution)}</b>\n`;

    const res = await this.sendMessage(msg, 'HEARTBEAT');
    return res.success;
  }
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const telegram = new TelegramService();
