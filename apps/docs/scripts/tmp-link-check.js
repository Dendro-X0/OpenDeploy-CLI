const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.cwd(), 'apps/docs/src/content/opendeploy');

/** Recursively list files ending with .md under dir */
function listMarkdown(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMarkdown(p));
    else if (entry.isFile() && p.endsWith('.md')) out.push(p);
  }
  return out;
}

function slugify(s) {
  const base = s
    .toLowerCase()
    .trim()
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9\s\-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base;
}

function extractAnchors(md) {
  const anchors = new Set();
  const lines = md.split(/\r?\n/);
  for (const line of lines) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) {
      anchors.add(slugify(m[2]));
    }
  }
  return anchors;
}

function loadAnchorsFor(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return extractAnchors(content);
  } catch {
    return new Set();
  }
}

function resolveDocPath(fromFile, target) {
  const baseDir = path.dirname(fromFile);
  // Try target as-is
  let candidate = path.resolve(baseDir, target);
  if (fs.existsSync(candidate)) return candidate;
  // Try adding .md if missing
  if (!/\.md$/i.test(target)) {
    const md1 = path.resolve(baseDir, target + '.md');
    if (fs.existsSync(md1)) return md1;
    const idx = path.resolve(baseDir, path.join(target, 'index.md'));
    if (fs.existsSync(idx)) return idx;
  }
  return candidate; // return best-effort even if missing
}

function checkLinks(files) {
  const problems = [];
  for (const file of files) {
    const rel = path.relative(ROOT, file);
    const content = fs.readFileSync(file, 'utf8');

    // Markdown links (skip images)
    const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
    let m;
    while ((m = linkRe.exec(content))) {
      const full = m[0];
      const targetRaw = m[2].trim();
      // Skip images
      const idx = m.index;
      if (idx > 0 && content[idx - 1] === '!') continue;
      // Skip external / absolute site / mailto
      if (/^(https?:)?\/\//i.test(targetRaw)) continue;
      if (targetRaw.startsWith('/') || targetRaw.startsWith('mailto:')) continue;

      const [filePart, anchorPart] = targetRaw.split('#', 2);
      const resolved = filePart ? resolveDocPath(file, filePart) : file;
      const exists = fs.existsSync(resolved);
      if (!exists) {
        problems.push({ file: rel, link: targetRaw, reason: 'missing file', resolved: path.relative(ROOT, resolved) });
        continue;
      }
      if (anchorPart) {
        const anchors = loadAnchorsFor(resolved);
        if (!anchors.has(anchorPart.toLowerCase())) {
          problems.push({ file: rel, link: targetRaw, reason: 'missing anchor', resolved: path.relative(ROOT, resolved) });
        }
      }
    }

    // Backtick-coded .md references
    const codeRefRe = /`([^`]+\.md(?:#[^`]*)?)`/g;
    while ((m = codeRefRe.exec(content))) {
      const ref = m[1];
      const [filePart, anchorPart] = ref.split('#', 2);
      const resolved = resolveDocPath(file, filePart);
      const exists = fs.existsSync(resolved);
      if (!exists) {
        problems.push({ file: rel, codeRef: ref, reason: 'missing file', resolved: path.relative(ROOT, resolved) });
        continue;
      }
      if (anchorPart) {
        const anchors = loadAnchorsFor(resolved);
        if (!anchors.has(anchorPart.toLowerCase())) {
          problems.push({ file: rel, codeRef: ref, reason: 'missing anchor', resolved: path.relative(ROOT, resolved) });
        }
      }
    }
  }
  return problems;
}

const files = listMarkdown(ROOT);
const problems = checkLinks(files);

if (problems.length) {
  console.log(JSON.stringify({ ok: false, count: problems.length, problems }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ok: true, checked: files.length }));
}
