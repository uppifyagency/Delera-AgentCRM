import { renameSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { CRMBootstrap } from './workflows.js';
import { CONNECTOR_DEFINITIONS } from './connectors.js';

export type StartupManifest = {
  schemaVersion: 1;
  initializedAt: string;
  core: CRMBootstrap['core'];
  workflows: CRMBootstrap['workflows'];
  connectors: typeof CONNECTOR_DEFINITIONS;
  integration: { status: string; provider?: string; next?: string | null; missingCapabilities?: readonly string[] };
};

export function persistStartupManifest(home: string, bootstrap: CRMBootstrap, integration: StartupManifest['integration']) {
  const manifest: StartupManifest = {
    schemaVersion: 1,
    initializedAt: bootstrap.initializedAt,
    core: bootstrap.core,
    workflows: bootstrap.workflows,
    connectors: CONNECTOR_DEFINITIONS,
    integration,
  };
  const path = join(home, 'startup-manifest.json');
  const next = `${path}.${process.pid}.${randomUUID()}.next`;
  writeFileSync(next, JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  renameSync(next, path);
  return manifest;
}
