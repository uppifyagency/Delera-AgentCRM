# Contributing to Delera-AgentCRM

Thank you for helping make agent-assisted customer work more reliable.

Open an issue describing the problem, expected behavior, preview version and host environment. Keep examples synthetic. For changes, fork the repository, use a focused branch and submit a pull request with tests and a description of any permissions or external effects.

Run `npm ci`, `npm run verify`, `npm run build:site` and `npm run test:site`. Follow the existing Node.js engine constraint. Keep the CRM runtime and the marketing site separate.

Priorities: event idempotency, typed provider dispatch, conflict-safe synchronization, honest readiness reporting and personal-data isolation. Never remove approval or live-execution safeguards just to make a demo appear complete.

Do not include `.agentcrm`, databases, tokens, customer records, OAuth clients or local machine paths. Do not run real-account write tests without specific authorization. Describe mock tests as mock tests.

Discuss changes to licensing, default permissions or public claims with the maintainer before implementation.
