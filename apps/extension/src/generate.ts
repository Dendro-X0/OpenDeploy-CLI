import * as vscode from 'vscode'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export interface GenerateGhPagesArgs { readonly appPathFs: string; readonly branch?: string; readonly template?: 'reusable' | 'inline' }

export async function generateGhPagesWorkflow(args: GenerateGhPagesArgs): Promise<string> {
  const ws = vscode.workspace.workspaceFolders?.[0]
  if (!ws) throw new Error('No workspace folder is open')
  const root = ws.uri.fsPath
  const ghDir = path.join(root, '.github', 'workflows')
  await fs.mkdir(ghDir, { recursive: true })
  const file = path.join(ghDir, 'deploy-gh-pages.yml')
  const appRel = path.relative(root, args.appPathFs).replace(/\\/g, '/') || '.'
  const branch = args.branch ?? 'main'
  const template = args.template ?? 'reusable'
  const workspaceExpr = '${{ github.workspace }}'
  const outputExpr = '${{ env.OUTPUT_DIR }}'
  const pageUrlExpr = '${{ steps.deployment.outputs.page_url }}'
  const yaml = template === 'inline'
    ? (`# template: inline\n`+
       `# NOTE: Set OUTPUT_DIR to your static site output (e.g., 'dist', 'build', '.next/out').\n`+
       `# This workflow assumes an npm-based build. Adjust steps as needed.\n`+
       `name: Deploy to GitHub Pages\n\n`+
       `on:\n`+
       `  push:\n`+
       `    branches: [ ${branch} ]\n`+
       `  workflow_dispatch:\n\n`+
       `permissions:\n`+
       `  contents: read\n`+
       `  pages: write\n`+
       `  id-token: write\n\n`+
       `concurrency:\n`+
       `  group: pages\n`+
       `  cancel-in-progress: true\n\n`+
       `env:\n`+
       `  OUTPUT_DIR: dist # change to your app's build output folder\n\n`+
       `jobs:\n`+
       `  build:\n`+
       `    runs-on: ubuntu-latest\n`+
       `    defaults:\n`+
       `      run:\n`+
       `        working-directory: ${appRel}\n`+
       `    steps:\n`+
       `      - uses: actions/checkout@v4\n`+
       `      - uses: actions/setup-node@v4\n`+
       `        with:\n`+
       `          node-version: 20\n`+
       `      - name: Install\n`+
       `        run: npm ci\n`+
       `      - name: Build\n`+
       `        run: npm run build --if-present\n`+
       `      - name: Upload artifact\n`+
       `        uses: actions/upload-pages-artifact@v3\n`+
       `        with:\n`+
       `          path: ${workspaceExpr}/${appRel}/${outputExpr}\n\n`+
       `  deploy:\n`+
       `    needs: build\n`+
       `    runs-on: ubuntu-latest\n`+
       `    environment:\n`+
       `      name: github-pages\n`+
       `      url: ${pageUrlExpr}\n`+
       `    steps:\n`+
       `      - id: deployment\n`+
       `        uses: actions/deploy-pages@v4\n`)
    : (`# template: reusable\n`+
       `name: Deploy to GitHub Pages\n\n`+
       `on:\n`+
       `  push:\n`+
       `    branches: [ ${branch} ]\n`+
       `  workflow_dispatch:\n\n`+
       `permissions:\n`+
       `  contents: read\n`+
       `  pages: write\n`+
       `  id-token: write\n\n`+
       `concurrency:\n`+
       `  group: pages\n`+
       `  cancel-in-progress: true\n\n`+
       `jobs:\n`+
       `  deploy:\n`+
       `    uses: Dendro-X0/OpenDeploy-CLI/.github/workflows/_reusable-gh-pages.yml@main\n`+
       `    with:\n`+
       `      app_path: ${appRel}\n`)
  await fs.writeFile(file, yaml, 'utf8')
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file))
  await vscode.window.showTextDocument(doc, { preview: false })
  return file
}
