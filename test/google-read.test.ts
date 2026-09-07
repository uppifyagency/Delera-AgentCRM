import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GoogleReadService, assertReadOnlyScopes, type ReadGoogleApis } from '../src/google-read.js';

const account = { account: 'owner@example.invalid', subject: 'subject-1', scopes: ['openid', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/drive.metadata.readonly'] };

test('Google read adapter rejects write scopes and preserves provenance per result', async () => {
  assert.throws(() => assertReadOnlyScopes([...account.scopes, 'https://www.googleapis.com/auth/gmail.modify']));
  const apis: ReadGoogleApis = {
    gmail: {
      list: async () => ({ data: { threads: [{ id: 'thread-1' }] } } as never),
      get: async () => ({ data: { historyId: 'rev-7', messages: [{ snippet: 'Synthetic mail', labelIds: ['INBOX'] }] } } as never),
    },
    calendar: { list: async () => ({ data: { items: [{ id: 'event-1', etag: 'etag-1', summary: 'Synthetic meeting', start: { dateTime: '2026-09-07T10:00:00+02:00' }, end: { dateTime: '2026-09-07T11:00:00+02:00' }, attendees: [{ email: 'owner@example.invalid' }] }] } } as never) },
    drive: { list: async () => ({ data: { files: [{ id: 'file-1', version: '3', name: 'Synthetic doc', mimeType: 'application/vnd.google-apps.document', modifiedTime: '2026-09-07T08:00:00Z', webViewLink: 'https://docs.google.test/file-1' }] } } as never) },
  };
  const service = new GoogleReadService(account, apis);
  const [mail, events, files] = await Promise.all([service.searchMail('from:synthetic'), service.searchCalendar('2026-09-07T09:00:00Z', '2026-09-07T12:00:00Z'), service.searchDrive("trashed = false")]);
  assert.equal(mail[0].provenance.externalId, 'thread-1');
  assert.equal(mail[0].provenance.revision, 'rev-7');
  assert.equal(events[0].attendees[0], 'owner@example.invalid');
  assert.equal(files[0].provenance.revision, '3');
  assert.equal(files[0].provenance.account, 'owner@example.invalid');
});

test('Google read adapter bounds provider queries and calendar intervals', async () => {
  const apis = { gmail: { list: async () => ({ data: {} } as never), get: async () => ({ data: {} } as never) }, calendar: { list: async () => ({ data: {} } as never) }, drive: { list: async () => ({ data: {} } as never) } } as ReadGoogleApis;
  const service = new GoogleReadService(account, apis);
  await assert.rejects(service.searchMail(''));
  await assert.rejects(service.searchDrive(''));
  await assert.rejects(service.searchCalendar('2026-09-07T12:00:00Z', '2026-09-07T11:00:00Z'));
});
