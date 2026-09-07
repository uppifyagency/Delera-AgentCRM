# Security

Delera-AgentCRM is a development preview, not a security-certified production service.

Never publish credentials, private workspace files or customer data in issues or pull requests. For a suspected vulnerability, use GitHub private vulnerability reporting if enabled. Otherwise contact the maintainer through an existing private channel; do not disclose sensitive exploit details in a public issue.

The SQLite database is unencrypted. Backups and the credential vault are encrypted, but their keys require separate protection. Host-app connectors are governed by that app's permissions and the user's approvals; the local CLI is not a security gate for them.

Before reporting, read `docs/PRIVACY.md` and `docs/REVIEW.md` for known preview limitations. Reports should include a minimal synthetic reproduction, affected version and expected boundary, without real credentials or client records.
