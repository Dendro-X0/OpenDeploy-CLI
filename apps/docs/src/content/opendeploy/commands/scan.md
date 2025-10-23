# Scan

Detect potential secrets in your repository with the built‑in scanner. This is a lightweight fallback (and complement) to tools like gitleaks. It uses the same redaction patterns the CLI applies to logs and NDJSON streams.

## Usage

```bash
opd scan
```

- JSON output:

```bash
opd scan --json
```

- Strict mode (exit non‑zero when any findings are detected):

```bash
opendeploy scan --json --strict
```

- Include test files and add excludes inline:

```bash
opd scan --include-tests --exclude "**/dist/**" --exclude "**/*.png"
```

## Configuration (opendeploy.scan.json)

Place a file named `opendeploy.scan.json` at the repo root to customize defaults.

```json
{
  "exclude": ["**/dist/**", "**/build/**", "**/*.png", "**/*.jpg"],
  "includeTests": false
}
```

Notes:
- `exclude` supports glob patterns.
- By default, common binary/build folders are excluded and tests are skipped. Set `includeTests: true` to scan tests.

## Output format

Human mode prints a short summary. JSON mode emits a single object like:

```json
{
  "action": "scan",
  "ok": true,
  "totalFindings": 0,
  "files": [],
  "final": true
}
```

When findings exist, `files` contains entries `{ path, count }`.

## CI guard

Use strict mode in CI to fail early on potential leaks:

```yaml
- name: Scan (strict)
  run: node packages/cli/dist/index.js scan --json --strict
```

See also: [Security Guard](../ci#security-guard) and [Security](../security).

## VSCode extension

From the Command Palette:
- "OpenDeploy: Scan Repo"
- "OpenDeploy: Scan Repo (Strict)"

The panel header shows a `Scan: OK` or `Scan: <count>` badge after scans. Findings are summarized in the Output channel and mirrored as hints in the Control Panel.
