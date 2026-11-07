# IBW Orders — Render Free + Neon handoff

Prepared locally only. No account created, remote repo pushed, service provisioned, or deployment performed.

## Required values supplied in Render

- `DATABASE_URL`: Neon **pooled** PostgreSQL URL. Supply privately in the dashboard; do not paste into Git or logs. `sslmode=require` is accepted; TLS certificate verification is always enforced by the app.
- `ADMIN_PASSWORD`: Blueprint `generateValue: true` supplies a stable random value. Retrieve it privately from Render environment settings.
- `SESSION_SECRET`: Blueprint `generateValue: true` supplies a stable random value. Keep unchanged across redeploys to preserve valid signed session cookies.

Blueprint also sets `NODE_VERSION=24`, `NODE_ENV=production`, `TRUST_PROXY=1`, `SECURE_COOKIES=true`, `REQUIRE_POSTGRES=true`. Render supplies `PORT` automatically. No Render database or paid disk is defined. Build is `npm ci`, start is `npm start`, health check is `/healthz`.

Optional: `PG_POOL_MAX` (default 5); `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. Keep SMTP_HOST/FROM absent unless email delivery is proven: Render Free blocks common SMTP ports 25/465/587. HTTPS mail APIs are not implemented in this version.

## Before accepting real orders

1. Review/choose the Neon Free plan and its storage/compute/history limits. Do not accidentally provision Render Free Postgres (30-day expiry) instead.
2. Connect the source repo/accounts, then create the Render service from the Blueprint. `autoDeployTrigger: off` disables subsequent automatic deploys; creating a service can still run the initial deploy.
3. Test health, signup/login, a synthetic Sham Cash/COD order, customer isolation, admin filters, both status changes/audits, JSON backup and CSV export.
4. Restart the service and verify customer/admin login and orders remain. The PG session store is database-backed; stable SESSION_SECRET is essential.
5. Confirm backup download is JSON with users, sessions, orders, audit, codes and migration version. Treat it as highly sensitive. No server filesystem backup is relied on with Neon. CSV contains orders only. JSON is archival data, not a pg_restore format; use reviewed pg_dump/PITR workflows for disaster recovery.
6. Verify Neon history/PITR settings (currently up to six hours on Free per docs), and arrange encrypted off-host backups for long-term retention. PITR is not indefinite archival storage.
7. Decide whether existing SQLite data must be imported separately. Selecting DATABASE_URL does not automatically migrate local orders. Current SQLite data remains local and untouched except additional synthetic regression records.

## Test status / outstanding validation

- Live local SQLite: HTTP curl suite, customer/admin DOM tests, layout tests and loopback SMTP tests passed after async refactor. Signed session survived replacing/restarting the server on port 3000.
- PostgreSQL: verified-TLS/pool settings, parameterization, SQL grammar, migration/audit definitions, DB session methods, JSON snapshot transaction and atomic OTP contracts tested using a **mocked pool plus the PostgreSQL parser**.
- **No live PostgreSQL end-to-end test yet.** The box has psql client tools but not postgres/initdb binaries. Attempted apt installation failed because Debian repositories returned HTTP 500. No external Neon account/database was used. Run the live smoke tests above after account connection, before launch.
- Render Blueprint checked against the official Render JSON schema.
- Free Render sleeps after 15 idle minutes and can take about a minute to wake. Provider quotas/policies apply; no promise of always-on, unlimited, forever-free production hosting.

Sources: https://render.com/docs/free · https://render.com/docs/blueprint-spec · https://neon.com/docs/manage/backups
