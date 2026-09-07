import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const [major, minor] = process.versions.node.split('.').map(Number);
const supported = major === 22 && minor >= 23;
if (args[0] === 'doctor') {
  console.log(JSON.stringify({ package: 'Delera-AgentCRM', node: process.versions.node, supported,
    requiredNode: '22.23+ in the 22.x series', platform: process.platform,
    dependenciesInstalled: existsSync(join(root, 'node_modules', '.package-lock.json')),
    compiled: existsSync(join(root, 'dist', 'src', 'agentcrm.js')),
    connectors: 'must be probed by the host agent', backgroundRunner: false,
    note: 'Runtime compatibility is not proof of host-app integration.' }, null, 2));
  process.exitCode = supported ? 0 : 1;
} else {
  if (!supported) throw Error('Use Node.js 22.23+ (22.x), preferably the agent’s bundled runtime. Do not change global runtimes automatically.');
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const run = (exe, params, stdio = 'inherit') => {
    const result = spawnSync(exe, params, { cwd: root, stdio, shell: process.platform === 'win32' && exe === npm });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  };
  if (!existsSync(join(root, 'node_modules', '.package-lock.json'))) run(npm, ['ci', '--no-audit', '--no-fund'], ['inherit', 'inherit', 'inherit']);
  // Recompile each time to avoid executing stale code after an update.
  run(npm, ['run', 'build']);
  run(process.execPath, [join(root, 'dist', 'src', 'agentcrm.js'), ...args]);
}
