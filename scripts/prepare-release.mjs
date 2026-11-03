import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const shaPattern = /^[a-f0-9]{40}$/;
export function prepareRelease(root, env) {
  if (env.GITHUB_REPOSITORY !== 'AceDylan/CFSM-SAO' || !['main', 'preview'].includes(env.GITHUB_REF_NAME) ||
      !shaPattern.test(env.GITHUB_SHA || '') || !['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME)) throw new Error('Invalid release context');
  const runId = Number(env.GITHUB_RUN_ID), runNumber = Number(env.GITHUB_RUN_NUMBER);
  const buildAttempt = Number(env.GITHUB_RUN_ATTEMPT || '1');
  if (!Number.isSafeInteger(runId) || runId < 1 || !Number.isSafeInteger(runNumber) || runNumber < 1 || !Number.isSafeInteger(buildAttempt) || buildAttempt < 1) throw new Error('Invalid run identity');
  const files = [];
  function walk(relative = '') {
    for (const name of readdirSync(path.join(root, relative)).sort()) {
      const file = relative ? `${relative}/${name}` : name;
      if (!/^(?:index\.html|assets(?:\/[A-Za-z0-9_.-]+)*)$/.test(file)) throw new Error('Unexpected build path');
      const stat = lstatSync(path.join(root, file));
      if (stat.isDirectory()) { if (file === 'index.html') throw new Error('Invalid index'); walk(file); continue; }
      if (!stat.isFile() || stat.size < 1 || stat.size > 5242880 || !file.includes('/') && file !== 'index.html') throw new Error('Invalid build file');
      if (file === 'assets/cfsm-release.json') continue;
      const bytes = readFileSync(path.join(root, file));
      files.push({ path: file, size: bytes.length, sha: createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex') });
    }
  }
  walk();
  const paths = new Set(files.map(f => f.path));
  if (!paths.has('index.html') || !files.some(f => f.path.endsWith('.js')) || !files.some(f => f.path.endsWith('.css')) || files.length > 1000) throw new Error('Incomplete build');
  // Check emitted entry points, dynamic chunks, CSS fonts and other relative assets.
  // This is intentionally scoped to this Vite output, not a general JavaScript parser.
  for (const file of files.filter(f => /\.(?:html|js|mjs|css)$/.test(f.path))) {
    const text = readFileSync(path.join(root, file.path), 'utf8');
    const refs = text.matchAll(/["'(]((?:\.\.?\/|\/assets\/)[^"'()\s?#]+\.(?:js|mjs|css|woff2?|ttf|svg|png|webp|ico|jpg|jpeg|avif))(?:[?#][^"'()\s]*)?["')]/g);
    for (const [, ref] of refs) {
      const target = ref.startsWith('/') ? ref.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(file.path), ref));
      if (!paths.has(target)) throw new Error(`Missing built dependency: ${target}`);
    }
  }
  const manifest = { version: 1, repository: env.GITHUB_REPOSITORY, branch: env.GITHUB_REF_NAME, source_sha: env.GITHUB_SHA, run_id: runId, run_number: runNumber, build_attempt: buildAttempt, files };
  writeFileSync(path.join(root, 'assets/cfsm-release.json'), JSON.stringify(manifest));
  return manifest;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifest = prepareRelease(path.resolve('dist'), process.env);
  console.log(`Validated ${manifest.files.length} artifact files`);
}
