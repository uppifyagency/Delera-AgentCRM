import { google, gmail_v1, calendar_v3, drive_v3 } from 'googleapis';
import type { Credentials } from 'google-auth-library';
import { z } from 'zod';

export const READ_ONLY_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
] as const;

export function assertReadOnlyScopes(scopes: readonly string[]) {
  const allowed = new Set<string>(READ_ONLY_SCOPES);
  const unexpected = scopes.filter(scope => !allowed.has(scope));
  if (unexpected.length) throw Error(`write-capable or unknown Google scope: ${unexpected.join(',')}`);
}

const accountSchema = z.object({ account: z.string().email(), subject: z.string().min(1), scopes: z.array(z.string()) }).strict();
export type ReadAccount = z.infer<typeof accountSchema>;

export type Provenance = {
  provider: 'google';
  account: string;
  subject: string;
  externalId: string;
  resource: 'gmail-thread' | 'gmail-message' | 'calendar-event' | 'drive-file';
  observedAt: string;
  acquiredAt: string;
  revision?: string;
};

export type MailHit = { id: string; threadId: string; snippet?: string; labelIds: string[]; provenance: Provenance };
export type CalendarHit = { id: string; summary?: string; start?: string; end?: string; attendees: string[]; provenance: Provenance };
export type DriveHit = { id: string; name?: string; mimeType?: string; modifiedTime?: string; webViewLink?: string; provenance: Provenance };

export interface ReadGoogleApis {
  gmail: Pick<gmail_v1.Resource$Users$Threads, 'list' | 'get'>;
  calendar: Pick<calendar_v3.Resource$Events, 'list'>;
  drive: Pick<drive_v3.Resource$Files, 'list'>;
}

export function createReadOnlyGoogleApis(tokens: Credentials, account: ReadAccount): ReadGoogleApis {
  accountSchema.parse(account);
  assertReadOnlyScopes(account.scopes);
  const auth = new google.auth.OAuth2();
  auth.setCredentials(tokens);
  return {
    gmail: google.gmail({ version: 'v1', auth }).users.threads,
    calendar: google.calendar({ version: 'v3', auth }).events,
    drive: google.drive({ version: 'v3', auth }).files,
  };
}

export class GoogleReadService {
  private readonly account: ReadAccount;
  private readonly apis: ReadGoogleApis;

  constructor(account: ReadAccount, apis: ReadGoogleApis) {
    this.account = accountSchema.parse(account);
    assertReadOnlyScopes(this.account.scopes);
    this.apis = apis;
  }

  private source(resource: Provenance['resource'], externalId: string, revision?: string): Provenance {
    const now = new Date().toISOString();
    return { provider: 'google', account: this.account.account, subject: this.account.subject, externalId, resource, observedAt: now, acquiredAt: now, ...(revision ? { revision } : {}) };
  }

  async searchMail(query: string, maxResults = 25): Promise<MailHit[]> {
    if (!query.trim() || query.length > 500) throw Error('invalid Gmail query');
    const limit = Math.min(Math.max(maxResults, 1), 100);
    const page = await this.apis.gmail.list({ userId: 'me', q: query, maxResults: limit });
    const rows = await Promise.all((page.data.threads ?? []).map(async thread => {
      if (!thread.id) return null;
      const detail = await this.apis.gmail.get({ userId: 'me', id: thread.id, format: 'metadata', metadataHeaders: [] });
      const first = detail.data.messages?.[0];
      return { id: thread.id, threadId: thread.id, snippet: first?.snippet ?? undefined, labelIds: first?.labelIds ?? [], provenance: this.source('gmail-thread', thread.id, detail.data.historyId ?? undefined) } satisfies MailHit;
    }));
    return rows.filter(Boolean) as MailHit[];
  }

  async searchCalendar(timeMin: string, timeMax: string, calendarId = 'primary'): Promise<CalendarHit[]> {
    const min = z.string().datetime().parse(timeMin), max = z.string().datetime().parse(timeMax);
    if (Date.parse(min) >= Date.parse(max)) throw Error('invalid calendar interval');
    const page = await this.apis.calendar.list({ calendarId, timeMin: min, timeMax: max, singleEvents: true, orderBy: 'startTime', maxResults: 250 });
    return (page.data.items ?? []).filter(event => Boolean(event.id)).map(event => {
      const start = event.start?.dateTime ?? event.start?.date;
      const end = event.end?.dateTime ?? event.end?.date;
      return { id: event.id!, summary: event.summary ?? undefined, start: start ?? undefined, end: end ?? undefined, attendees: (event.attendees ?? []).map(a => a.email ?? undefined).filter((email): email is string => Boolean(email)), provenance: this.source('calendar-event', event.id!, event.etag ?? undefined) } satisfies CalendarHit;
    });
  }

  async searchDrive(query: string, pageSize = 25): Promise<DriveHit[]> {
    if (!query.trim() || query.length > 1000) throw Error('invalid Drive query');
    const page = await this.apis.drive.list({ q: query, pageSize: Math.min(Math.max(pageSize, 1), 100), fields: 'files(id,name,mimeType,modifiedTime,webViewLink,version)' });
    return (page.data.files ?? []).filter(file => Boolean(file.id)).map(file => ({ id: file.id!, name: file.name ?? undefined, mimeType: file.mimeType ?? undefined, modifiedTime: file.modifiedTime ?? undefined, webViewLink: file.webViewLink ?? undefined, provenance: this.source('drive-file', file.id!, file.version ?? undefined) } satisfies DriveHit));
  }
}
