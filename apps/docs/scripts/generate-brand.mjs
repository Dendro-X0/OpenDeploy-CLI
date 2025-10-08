#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const outDir = path.resolve(process.cwd(), 'public')

/** Minimal brand palette */
const COLORS = {
  lightBg: '#FFFFFF',
  lightFg: '#0F172A', // slate-950
  darkBg: '#0B1220',  // near slate-950, a bit cooler
  darkFg: '#F8FAFC',  // slate-50
  accent: '#22C55E'   // green-500
}

/** Fast Stack icon (strokes use currentColor) */
const ICON_STACK = `
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' fill='none' stroke='currentColor' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'>
    <path d='M12 42 H36'/>
    <path d='M16 34 H40'/>
    <path d='M20 26 H44'/>
    <path d='M40 46 L48 38 L56 46'/>
  </svg>`

function logoSVG({ color = COLORS.lightFg, size = 128 } = {}) {
  return ICON_STACK
    .replace("currentColor", color)
    .replace("viewBox='0 0 64 64'", `width='${size}' height='${size}' viewBox='0 0 64 64'`)
}

function ogSVG({ theme = 'dark', width = 1200, height = 630 }) {
  const bg = theme === 'dark' ? COLORS.darkBg : COLORS.lightBg
  const fg = theme === 'dark' ? COLORS.darkFg : COLORS.lightFg
  const accent = COLORS.accent
  const title = 'OpenDeploy CLI'
  const subtitle = 'Vercel + Netlify Deploys'
  return `
    <svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='0 0 ${width} ${height}'>
      <defs>
        <linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>
          <stop offset='0%' stop-color='${bg}'/>
          <stop offset='100%' stop-color='${bg}'/>
        </linearGradient>
      </defs>
      <rect x='0' y='0' width='100%' height='100%' fill='url(#g)'/>
      <g transform='translate(120, 160)'>
        ${logoSVG({ color: fg, size: 140 })}
      </g>
      <g fill='${fg}'>
        <text x='300' y='210' font-family='Inter, Segoe UI, Roboto, Arial, sans-serif' font-size='72' font-weight='700' letter-spacing='0.2px'>${title}</text>
        <text x='300' y='280' font-family='Inter, Segoe UI, Roboto, Arial, sans-serif' font-size='30' opacity='0.9'>${subtitle}</text>
        <rect x='300' y='310' rx='10' ry='10' width='340' height='56' fill='${accent}'/>
        <text x='320' y='348' font-family='Inter, Segoe UI, Roboto, Arial, sans-serif' font-size='26' font-weight='600' fill='#0B1220'>opd start — wizard deploy</text>
      </g>
    </svg>`
}

async function ensureDir(p) { await fs.mkdir(p, { recursive: true }) }

async function writePNG(svgStr, outPath, size) {
  const img = sharp(Buffer.from(svgStr))
  if (size) await img.resize(size.w, size.h)
  await img.png().toFile(outPath)
}

async function main() {
  await ensureDir(outDir)
  // OG images
  await writePNG(ogSVG({ theme: 'dark' }), path.join(outDir, 'og-dark.png'))
  await writePNG(ogSVG({ theme: 'light' }), path.join(outDir, 'og-light.png'))
  // Thumbnails 1280x720
  await writePNG(ogSVG({ theme: 'dark', width: 1280, height: 720 }), path.join(outDir, 'thumb-dark.png'))
  await writePNG(ogSVG({ theme: 'light', width: 1280, height: 720 }), path.join(outDir, 'thumb-light.png'))
  // Icon 512
  await writePNG(logoSVG({ color: COLORS.darkFg, size: 512 }), path.join(outDir, 'icon-512-light.png'))
  await writePNG(logoSVG({ color: COLORS.lightFg, size: 512 }), path.join(outDir, 'icon-512-dark.png'))
  console.log('Brand assets generated in /public')
}

main().catch((e) => { console.error(e); process.exit(1) })
