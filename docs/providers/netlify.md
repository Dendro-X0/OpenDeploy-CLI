# Netlify (Not Supported)

OpenDeploy no longer supports Netlify. For Netlify deployments, environment management, logs and advanced features, please use the official Netlify CLI:

- GitHub: https://github.com/netlify/cli
- Docs: https://docs.netlify.com/

OpenDeploy focuses on providers where we can deliver a best‑in‑class, simplified experience:

- Vercel
- Cloudflare Pages
- GitHub Pages

If you have existing Netlify projects, we recommend keeping `netlify.toml` in your repository and driving deploys via `netlify deploy` (or CI) directly.
