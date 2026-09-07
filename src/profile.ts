import { existsSync, lstatSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

export const profileSchema = z.object({
  organization: z.string().trim().min(1).max(160),
  owner: z.string().email(),
  timezone: z.string().refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } }, 'Invalid timezone'),
  host: z.enum(['chatgpt-work', 'claude-cowork', 'codex', 'other']),
  googleAccount: z.string().email().optional(),
}).strict();
export type Profile = z.infer<typeof profileSchema>;
export function readPrivate(path: string): unknown {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw Error('Unsafe private file');
  return JSON.parse(readFileSync(path, 'utf8'));
}
export function writePrivate(path: string, data: unknown) {
  if (existsSync(path)) readPrivate(path);
  const next = `${path}.${randomUUID()}.next`;
  writeFileSync(next, JSON.stringify(data, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  renameSync(next, path);
}
export function readProfile(home: string): Profile | null {
  const path = join(home, 'profile.json');
  return existsSync(path) ? profileSchema.parse(readPrivate(path)) : null;
}
export function initializeProfile(home: string, input: unknown) {
  const profile = profileSchema.parse(input), existing = readProfile(home);
  if (existing && JSON.stringify(existing) !== JSON.stringify(profile)) throw Error('Workspace already personalized. Use a fresh clean bundle for another person or organization.');
  if (!existing) writePrivate(join(home, 'profile.json'), profile);
  return profile;
}
const connectorReportSchema = z.object({
  connector: z.enum(['gmail','google-calendar','google-drive','google-docs','google-sheets','google-slides','google-tasks','google-contacts','slack','documents','pdf','spreadsheets','presentations','sites']),
  account: z.string().min(1).max(200), session: z.string().min(1).max(200),
  read: z.array(z.string().min(1).max(120)), write: z.array(z.string().min(1).max(120)),
  evidence: z.string().min(1).max(1000),
}).strict();
export function recordConnectorReport(home: string, input: unknown) {
  const report = connectorReportSchema.parse(input);
  const saved = { ...report, checkedAt: new Date().toISOString(), verification: 'agent-reported-not-runtime-authentication' };
  writePrivate(join(home, `connector-${report.connector}.json`), saved);
  return saved;
}
export function connectorReports(home: string) {
  return connectorReportSchema.shape.connector.options.flatMap(id => {
    const path = join(home, `connector-${id}.json`);
    return existsSync(path) ? [{ connector: id, report: readPrivate(path), requiresCurrentSessionProbe: true }] : [];
  });
}
