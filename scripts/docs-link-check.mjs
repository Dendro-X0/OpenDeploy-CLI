import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd(), 'apps/docs/src/content/opendeploy');

function listMarkdown(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listMarkdown(p));
    else if (e.isFile() && p.endsWith('.md')) out.push(p);
  }
  return out;
}

const slug = (s) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9\s\-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

function extractAnchors(md) {
  const a = new Set();
  for (const line of md.split(/\r?\n/)) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) a.add(slug(m[2]));
  }
  return a;
}

function loadAnchorsFor(filePath) {
  try {
    return extractAnchors(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return new Set();
  }
}

function resolveDocPath(fromFile, target) {
  const baseDir = path.dirname(fromFile);
  let candidate = path.resolve(baseDir, target);
  if (fs.existsSync(candidate)) return candidate;
  if (!/\.md$/i.test(target)) {
    const md1 = path.resolve(baseDir, target + '.md');
    if (fs.existsSync(md1)) return md1;
    const idx = path.resolve(baseDir, path.join(target, 'index.md'));
    if (fs.existsSync(idx)) return idx;
  }
  return candidate;
}

function check(files) {
  const problems = [];
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const content = fs.readFileSync(file, 'utf8');

    // Markdown links (skip images)
    const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
    let m;
    while ((m = linkRe.exec(content))) {
      const target = m[2].trim();
      const i = m.index;
      if (i > 0 && content[i - 1] === '!') continue; // skip images
      if (/^(https?:)?\/\//i.test(target)) continue; // external
      if (target.startsWith('/') || target.startsWith('mailto:')) continue; // absolute/site/mailto

      const [filePart, anchorPart] = target.split('#', 2);
      const resolved = filePart ? resolveDocPath(file, filePart) : file;
      if (!fs.existsSync(resolved)) {
        problems.push({ file: rel, link: target, reason: 'missing file' });
        continue;
      }
      if (anchorPart) {
        const anchors = loadAnchorsFor(resolved);
        if (!anchors.has(anchorPart.toLowerCase())) {
          problems.push({ file: rel, link: target, reason: 'missing anchor' });
        }
      }
    }

    // Backtick-coded .md references
    const codeRefRe = /`([^`]+\.md(?:#[^`]*)?)`/g;
    while ((m = codeRefRe.exec(content))) {
      const ref = m[1];
      const [filePart, anchorPart] = ref.split('#', 2);
      const resolved = resolveDocPath(file, filePart);
      if (!fs.existsSync(resolved)) {
        problems.push({ file: rel, codeRef: ref, reason: 'missing file' });
        continue;
      }
      if (anchorPart) {
        const anchors = loadAnchorsFor(resolved);
        if (!anchors.has(anchorPart.toLowerCase())) {
          problems.push({ file: rel, codeRef: ref, reason: 'missing anchor' });
        }
      }
    }
  }
  return problems;
}

const files = listMarkdown(ROOT);
const problems = check(files);
const summary = {
  ok: problems.length === 0,
  filesChecked: files.length,
  problems: problems.slice(0, 25),
  more: Math.max(0, problems.length - 25),
};
console.log(JSON.stringify(summary, null, 2));
process.exitCode = problems.length ? 1 : 0;
