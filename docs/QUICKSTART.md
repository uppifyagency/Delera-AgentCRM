# Start your Delera-AgentCRM

## With an agent

1. Download or clone the repository into a new folder.
2. Give ChatGPT Work, Claude Cowork, Codex or another compatible agent access to it.
3. Ask it to read `START_HERE.md` and `docs/AGENT_PLAYBOOK.md` and start your CRM. The shared operating manual is currently in Italian; ask the agent to conduct onboarding in your language.

The agent checks the environment, asks for your organization, owner email and timezone, and shows a local demo. It must verify existing connectors before starting any missing authorization. You complete login, MFA and consent personally.

## Requirements

Persistent read/write file access; command execution; Node.js 22.23+ in the 22.x series and npm; network access for the first dependency installation. Native SQLite may require a compatible prebuilt binary or compilation tools. The local core was tested on macOS; host/OS compatibility needs verification on your setup.

An uploaded attachment in a chat does not automatically provide a runnable, persistent environment. Cloud execution may not support a desktop OAuth callback on your computer.

## Manual setup

```bash
node scripts/start.mjs doctor
node scripts/start.mjs
```

Use your own values in the following command; the example identity is fictional:

```bash
node dist/src/agentcrm.js init '{"organization":"Example Company","owner":"owner@example.invalid","timezone":"UTC","host":"chatgpt-work"}'
npm run demo
node dist/src/agentcrm.js status
```

The personal CRM and demo are separate. `demo` creates eight synthetic records and one **local** email draft; it does not write to Gmail or Google Contacts. Repeating it reuses the same demo records.

## What happens next

Agree on the data scope and operating policy. Use minimal read-only connector probes. Only then plan authorized imports or external actions with the agent. Drafts, sends, sharing and changes have different approval requirements. The generic `agent-run live` executor is disabled in this preview.

The folder contains twelve documented workflows, not twelve deployed background jobs. See [workflow coverage](WORKFLOWS.md), [connector mapping](CONNECTORS.md), [OAuth](OAUTH.md) and [privacy](PRIVACY.md).

For another person, share a clean export—not your working `.agentcrm` directory.
