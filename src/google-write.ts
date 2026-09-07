import { google } from 'googleapis';
import type { Credentials } from 'google-auth-library';

export type GoogleAccount = { account: string; subject: string; scopes: readonly string[] };
export type Task = { id: string; title?: string; notes?: string; due?: string; status?: string; updated?: string; selfLink?: string };
export type TaskList = { id: string; title?: string; updated?: string };
export type Contact = { resourceName: string; etag?: string; names?: string[]; emails?: string[]; phones?: string[]; organizations?: string[] };

export type GoogleTasksApi = {
  tasklists: { list(args: { maxResults?: number; pageToken?: string }): Promise<{ data: { items?: TaskList[]; nextPageToken?: string } }> };
  tasks: {
    list(args: { tasklist: string; maxResults?: number; showCompleted?: boolean; showHidden?: boolean; pageToken?: string }): Promise<{ data: { items?: Task[]; nextPageToken?: string } }>;
    insert(args: { tasklist: string; requestBody: { title: string; notes?: string; due?: string } }): Promise<{ data: Task }>;
    update(args: { tasklist: string; task: string; requestBody: { id: string; title?: string; notes?: string; due?: string; status?: string } }): Promise<{ data: Task }>;
    delete(args: { tasklist: string; task: string }): Promise<unknown>;
  };
};

export type GooglePeopleApi = {
  people: {
    connections: { list(args: { resourceName: string; personFields: string; pageSize?: number; pageToken?: string }): Promise<{ data: { connections?: Array<Record<string, unknown>>; nextPageToken?: string } }> };
    createContact(args: { requestBody: Record<string, unknown> }): Promise<{ data: Record<string, unknown> }>;
    updateContact(args: { resourceName: string; updatePersonFields: string; requestBody: Record<string, unknown> }): Promise<{ data: Record<string, unknown> }>;
  };
};

export type GoogleWriteApis = { tasks: GoogleTasksApi; people: GooglePeopleApi };

export function createGoogleWriteApis(tokens: Credentials): GoogleWriteApis {
  const auth = new google.auth.OAuth2();
  auth.setCredentials(tokens);
  return {
    tasks: google.tasks({ version: 'v1', auth }) as unknown as GoogleTasksApi,
    people: google.people({ version: 'v1', auth }) as unknown as GooglePeopleApi,
  };
}

function requireScope(account: GoogleAccount, scope: string) {
  if (!account.scopes.includes(scope)) throw Error(`required Google scope missing: ${scope}`);
}

export class GoogleTasksService {
  constructor(private readonly account: GoogleAccount, private readonly api: GoogleTasksApi) {}
  async listTaskLists() {
    requireScope(this.account, 'https://www.googleapis.com/auth/tasks.readonly');
    return (await this.api.tasklists.list({ maxResults: 100 })).data.items ?? [];
  }
  async listTasks(tasklist: string) {
    requireScope(this.account, 'https://www.googleapis.com/auth/tasks.readonly');
    return (await this.api.tasks.list({ tasklist, maxResults: 100, showCompleted: true, showHidden: true })).data.items ?? [];
  }
  async createTask(tasklist: string, task: { title: string; notes?: string; due?: string }) {
    requireScope(this.account, 'https://www.googleapis.com/auth/tasks');
    return (await this.api.tasks.insert({ tasklist, requestBody: task })).data;
  }
  async updateTask(tasklist: string, task: { id: string; title?: string; notes?: string; due?: string; status?: string }) {
    requireScope(this.account, 'https://www.googleapis.com/auth/tasks');
    return (await this.api.tasks.update({ tasklist, task: task.id, requestBody: task })).data;
  }
  async deleteTask(tasklist: string, taskId: string) {
    requireScope(this.account, 'https://www.googleapis.com/auth/tasks');
    await this.api.tasks.delete({ tasklist, task: taskId });
    return { deleted: true, tasklist, taskId };
  }
}

export class GoogleContactsService {
  constructor(private readonly account: GoogleAccount, private readonly api: GooglePeopleApi) {}
  async listContacts(pageToken?: string) {
    requireScope(this.account, 'https://www.googleapis.com/auth/contacts.readonly');
    const response = await this.api.people.connections.list({ resourceName: 'people/me', personFields: 'names,emailAddresses,phoneNumbers,organizations', pageSize: 1000, ...(pageToken ? { pageToken } : {}) });
    return { contacts: (response.data.connections ?? []).map(normalizeContact), nextPageToken: response.data.nextPageToken };
  }
  async createContact(contact: { name: string; email?: string; phone?: string; organization?: string }) {
    requireScope(this.account, 'https://www.googleapis.com/auth/contacts');
    return normalizeContact((await this.api.people.createContact({ requestBody: personBody(contact) })).data);
  }
  async updateContact(resourceName: string, contact: { name?: string; email?: string; phone?: string; organization?: string }) {
    requireScope(this.account, 'https://www.googleapis.com/auth/contacts');
    return normalizeContact((await this.api.people.updateContact({ resourceName, updatePersonFields: 'names,emailAddresses,phoneNumbers,organizations', requestBody: { resourceName, ...personBody(contact) } })).data);
  }
}

function personBody(contact: { name?: string; email?: string; phone?: string; organization?: string }) {
  return {
    ...(contact.name ? { names: [{ givenName: contact.name }] } : {}),
    ...(contact.email ? { emailAddresses: [{ value: contact.email }] } : {}),
    ...(contact.phone ? { phoneNumbers: [{ value: contact.phone }] } : {}),
    ...(contact.organization ? { organizations: [{ name: contact.organization }] } : {}),
  };
}

function normalizeContact(raw: Record<string, unknown>): Contact {
  const values=(key: string, nested: string) => (Array.isArray(raw[key]) ? raw[key].flatMap(item => item && typeof item==='object' && nested in item && typeof (item as Record<string,unknown>)[nested]==='string' ? [(item as Record<string,unknown>)[nested] as string] : []) : []);
  return { resourceName: typeof raw.resourceName==='string' ? raw.resourceName : '', etag: typeof raw.etag==='string' ? raw.etag : undefined, names: values('names','displayName'), emails: values('emailAddresses','value'), phones: values('phoneNumbers','value'), organizations: values('organizations','name') };
}

export function deduplicateContacts(contacts: readonly Contact[]) {
  const groups = new Map<string, Contact[]>();
  for (const contact of contacts) {
    const key=(contact.emails?.[0] ?? `${contact.names?.[0] ?? ''}|${contact.phones?.[0] ?? ''}`).trim().toLowerCase();
    const bucket=groups.get(key) ?? []; bucket.push(contact); groups.set(key,bucket);
  }
  return [...groups.entries()].filter(([key, items]) => key && items.length>1).map(([key, items]) => ({ key, contacts: items }));
}
