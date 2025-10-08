import { describe, it, expect } from 'vitest'
import { renderGithubPagesWorkflow } from '../utils/workflows'

describe('renderGithubPagesWorkflow', () => {
  it('renders a valid GitHub Pages workflow with defaults', () => {
    const yaml = renderGithubPagesWorkflow({ basePath: '/site' })
    expect(typeof yaml).toBe('string')
    expect(yaml).toContain("name: Deploy Docs to GitHub Pages")
    // Ensures we keep the GitHub expression unescaped in YAML
    expect(yaml).toContain('${{ steps.deployment.outputs.page_url }}')
    // Ensures base path is injected
    expect(yaml).toContain('NEXT_BASE_PATH: /site')
  })

  it('injects site origin when provided', () => {
    const yaml = renderGithubPagesWorkflow({ basePath: '/repo', siteOrigin: 'https://owner.github.io' })
    expect(yaml).toContain('NEXT_PUBLIC_SITE_ORIGIN: https://owner.github.io')
    expect(yaml).toContain('NEXT_BASE_PATH: /repo')
  })
})
