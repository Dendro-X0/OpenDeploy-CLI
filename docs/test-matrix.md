# Local Test Matrix

Run the test suite locally across multiple Node versions in Docker for CI-like parity.

## Requirements

- Docker installed and running.
- Internet access to pull base images (`node:18`, `node:20`, `node:22`).

## Usage

```bash
pnpm build
node dist/index.js test-matrix --local
```

Behavior:

- Pulls/runs `node:18`, `node:20`, and `node:22` images.
- Inside each container:
  - Enables corepack and prepares `pnpm@10.13.1`.
  - Installs dependencies with `pnpm install --frozen-lockfile`.
  - Runs tests with `pnpm test -- --reporter=dot`.
- Sets CI-like environment variables: `CI=1`, `FORCE_COLOR=0`, `TZ=UTC`, `LC_ALL=C`.
- If Docker is unavailable, falls back to a single host run: `pnpm test -- --reporter=dot`.
- Non-zero exit code if any container run fails.

## Notes

- Experimental Windows containers are not enabled by default. If your local Docker supports Windows containers, you may adapt the flow to a Windows image, but mileage may vary.
- For CI matrix, see `.github/workflows/ci-matrix.yml` which runs Node `18.x`, `20.x`, and `22.x` across Ubuntu and Windows.
