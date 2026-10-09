# Termux installation

This installer targets 64-bit ARM Android phones running Termux. It installs
Ubuntu through PRoot, Node 22, PostgreSQL, Redis, and ngrok. It runs the dashboard
with Webpack in development mode to avoid requiring a memory-intensive production
build. No Docker, purchased domain, or paid Instagram connection provider is needed.
The installer has not been verified on an Android device.

## Install

Install Termux from its official GitHub releases or F-Droid. In native Termux:

```bash
pkg update
pkg install git nano -y
cd ~
git clone https://github.com/shadisalman-ctrl/openreply.git
cd openreply
bash scripts/termux.sh install
```

Use the repository URL containing these scripts if they are in your fork.
The first run creates `.env` and stops so you can populate it:

```bash
nano .env
bash scripts/termux.sh install
bash scripts/termux.sh start
```

Fill `NEXTAUTH_URL` with the HTTPS development domain assigned to your free ngrok
account, and `NGROK_AUTHTOKEN` with that account's agent token. Configure
`EMAIL_SERVER`, `EMAIL_FROM`, and `ALLOWED_EMAILS` for your email account. Gmail
requires an app password and two-step verification. Remove spaces from its app
password and URL-encode SMTP credentials (`@` becomes `%40`). SMTP access may not
be available on every account. Never use your regular Gmail password here.

The installer fills blank application secrets, the webhook verification token,
and a randomly password-protected local database URL. It preserves nonblank
values on reruns. It manages only the local `openreply` database and role, updates
that role's password to match `.env`, and applies committed database migrations.
Do not run it against an unrelated existing Ubuntu database. Installation
downloads and runs the pinned official nvm installer and installs ngrok from its
official apt repository. Ubuntu is shared with any existing `ubuntu` PRoot install.

The existing repository `.env.example` is also usable: add `NGROK_AUTHTOKEN` and
replace its example secrets and database credentials yourself. For automatic
generation use the Termux template, `scripts/termux/env.example`.

## Run and inspect

```bash
bash scripts/termux.sh start
bash scripts/termux.sh logs
```

The four tmux windows are `web`, `worker`, `cron`, and `tunnel`. Switch windows
with Ctrl+B followed by the window number; detach with Ctrl+B then D. A crashed
process leaves its error visible in its window; this is not an automatic restart
supervisor. The start message means windows were created, not that all services
passed their health checks. Check each window and visit:

- `http://localhost:3000/api/health` for database, Redis, and worker health.
- Your `NEXTAUTH_URL` for the public dashboard and magic-link sign-in.

After changing `.env`, restart:

```bash
bash scripts/termux.sh stop
bash scripts/termux.sh start
```

Stop shuts down the application's tmux sessions and releases the wake lock.
PostgreSQL and Redis remain running. Restarting after a phone reboot uses the
same `start` command, which also starts the database services. Installation
does not configure automatic boot startup. Disable Android battery optimization
for Termux; tmux and a wake lock cannot prevent Android from killing the app.

## Instagram setup still requires Meta's dashboard

Populate `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, and `FACEBOOK_APP_SECRET`
in the same `.env` when your Meta app is ready, then restart. Follow the direct
Meta instructions in [setup.md](setup.md#the-meta-app). Use your ngrok origin for:

- OAuth redirect: `/api/instagram/callback`
- Webhook: `/api/webhook` (verification token is in `.env`)
- Privacy, deletion, and terms pages: `/privacy`, `/data-deletion`, `/terms`

Review the legal pages for your instance. Add and accept your Instagram tester
invitation, configure webhook subscriptions, connect through Settings, and
complete any publishing, review, or verification required by Meta. The script
cannot create those accounts or grant API permissions.

## Free-service limits and backups

The [ngrok free plan](https://ngrok.com/docs/pricing-limits/free-plan-limits)
currently includes an account-associated development domain, 20,000 HTTP requests
and 1 GB outgoing traffic per month. Dashboard assets and webhooks both count.
It displays a browser warning page. There is no paid-tier upgrade in the script.
Provider availability and Meta approval must be checked for your account/region.
Your phone, internet connection, email account, and ngrok quotas determine uptime.

Keep protected backups of `.env` and the PostgreSQL database off the phone.
The encryption key must be preserved to read existing stored credentials.
Do not commit `.env`, share it, or delete generated secrets during updates.
