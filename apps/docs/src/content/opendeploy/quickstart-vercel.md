# Quick Start: Vercel (3 steps)

Follow these 3 steps to deploy your app to Vercel using OpenDeploy CLI.

## 1) Install and Start

Follow the steps in the [Install](./install.md) page to install from a tag (source) for now.

Then start the wizard:

```bash
opd start
```

The Start wizard detects your framework, checks auth, and links your directory if needed. In JSON/CI mode you can pass `--json`.

## 2) Preview Deploy

```bash
opd up vercel --env preview
```

- Streams deploy output and captures the preview URL.
- Prints a final JSON summary with `final: true` in `--json` mode.

Optional alias/promotion from the Start wizard:

```bash
# Promote preview to a production domain
opd start --provider vercel --env preview --promote --alias your-domain.com
```

## 3) Production

```bash
# Promote via dedicated command
opd promote vercel --alias your-domain.com
```

Tips:

- Use `opd logs vercel --open` to view logs for the latest deployment.
- Use `opd env sync vercel --file .env.local --env preview` to push env vars.
- In CI, prefer `--json --summary-only --timestamps` or `--gha`.

## GitHub Actions quickstart

Use the ready-to-run workflow in your repo:

- `.github/workflows/quickstart-vercel.yml`

Trigger it from GitHub Actions → Workflows → "Quickstart (Vercel)".

## Screenshots (placeholders)

<div style={{ display: 'grid', gap: 12 }}>
  <img alt="Start wizard" src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/screens/wizard-start.svg`} style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--gray-800)' }} />
</div>
