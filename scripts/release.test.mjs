import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { prepareRelease } from './prepare-release.mjs';

const scripts = path.dirname(fileURLToPath(import.meta.url));
const context = { GITHUB_REPOSITORY: 'AceDylan/CFSM-SAO', GITHUB_REF_NAME: 'main', GITHUB_EVENT_NAME: 'push', GITHUB_SHA: 'a'.repeat(40), GITHUB_RUN_ID: '12345', GITHUB_RUN_NUMBER: '12' };
function fixture(root) {
  mkdirSync(path.join(root, 'assets'), { recursive: true });
  writeFileSync(path.join(root, 'index.html'), '<script src="./assets/app.js"></script><link href="./assets/app.css">');
  writeFileSync(path.join(root, 'assets/app.js'), 'import("./lazy.js")');
  writeFileSync(path.join(root, 'assets/lazy.js'), 'export default 42');
  writeFileSync(path.join(root, 'assets/app.css'), '@font-face{src:url(./font.woff2)}');
  writeFileSync(path.join(root, 'assets/font.woff2'), 'font');
}
test('manifest seals every emitted file and rejects missing lazy chunks, fonts and invalid output', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'cfsm-manifest-'));
  try {
    fixture(root);
    const manifest = prepareRelease(root, context);
    assert.equal(manifest.files.length, 5); assert.equal(manifest.source_sha, context.GITHUB_SHA);
    assert.deepEqual(prepareRelease(root, context), manifest, 'manifest is stable on a retry');
    rmSync(path.join(root, 'assets/lazy.js'));
    assert.throws(() => prepareRelease(root, context), /Missing built dependency/);
    fixture(root); rmSync(path.join(root, 'assets/font.woff2'));
    assert.throws(() => prepareRelease(root, context), /Missing built dependency/);
    fixture(root); writeFileSync(path.join(root, 'unexpected.txt'), 'bad');
    assert.throws(() => prepareRelease(root, context), /Unexpected build path/);
    rmSync(path.join(root, 'unexpected.txt'));
    assert.throws(() => prepareRelease(root, { ...context, GITHUB_REF_NAME: 'dist-preview' }), /Invalid release context/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('local Git publication retains immutable history, rejects stale source and isolates preview artifacts', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'cfsm-publish-'));
  const repo = path.join(tmp, 'source'), remote = path.join(tmp, 'remote.git');
  mkdirSync(repo);
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  function publish(env) {
    const runner = mkdtempSync(path.join(tmp, 'runner-')), output = path.join(runner, 'output');
    writeFileSync(output, '');
    const res = spawnSync(process.execPath, [path.join(scripts, 'publish-release.mjs')], { cwd: repo, env: { ...process.env, ...context, ...env, RUNNER_TEMP: runner, GITHUB_OUTPUT: output }, encoding: 'utf8' });
    assert.equal(res.status, 0, res.stderr);
    return Object.fromEntries(readFileSync(output, 'utf8').trim().split('\n').map(line => line.split('=')));
  }
  try {
    git('init', '--bare', remote); git('init', '-b', 'main');
    git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
    writeFileSync(path.join(repo, 'source.txt'), 'one'); git('add', '.'); git('commit', '-qm', 'source one');
    git('remote', 'add', 'origin', remote); git('push', '-q', 'origin', 'main');
    const source = git('rev-parse', 'HEAD');
    const dist = path.join(repo, 'dist'); mkdirSync(dist); fixture(dist);
    prepareRelease(dist, { ...context, GITHUB_SHA: source });
    const first = publish({ GITHUB_SHA: source }); assert.match(first.artifact_sha, /^[a-f0-9]{40}$/);
    assert.equal(publish({ GITHUB_SHA: source }).artifact_sha, first.artifact_sha, 'unchanged retry reuses artifact');
    writeFileSync(path.join(repo, 'source.txt'), 'two'); git('add', 'source.txt'); git('commit', '-qm', 'source two'); git('push', '-q', 'origin', 'main');
    const secondSource = git('rev-parse', 'HEAD');
    assert.equal(publish({ GITHUB_SHA: source }).stale, 'true');
    prepareRelease(dist, { ...context, GITHUB_SHA: secondSource, GITHUB_RUN_NUMBER: '13', GITHUB_RUN_ID: '12346' });
    rmSync(path.join(dist, 'assets/lazy.js'));
    const failedRunner = mkdtempSync(path.join(tmp, 'failed-'));
    const failed = spawnSync(process.execPath, [path.join(scripts, 'publish-release.mjs')], { cwd: repo, env: { ...process.env, ...context, GITHUB_SHA: secondSource, RUNNER_TEMP: failedRunner, GITHUB_OUTPUT: path.join(failedRunner, 'output') }, encoding: 'utf8' });
    assert.notEqual(failed.status, 0, 'bad build cannot publish');
    assert.equal(git('ls-remote', 'origin', 'refs/heads/dist').split(/\s/)[0], first.artifact_sha);
    fixture(dist);
    const second = publish({ GITHUB_SHA: secondSource, GITHUB_RUN_NUMBER: '13', GITHUB_RUN_ID: '12346' });
    git('fetch', '-q', 'origin', 'dist'); assert.equal(git('rev-parse', 'FETCH_HEAD^'), first.artifact_sha);
    assert.equal(git('show', `${first.artifact_sha}:assets/lazy.js`), 'export default 42');
    git('push', '-q', 'origin', 'HEAD:preview');
    prepareRelease(dist, { ...context, GITHUB_SHA: secondSource, GITHUB_REF_NAME: 'preview' });
    const preview = publish({ GITHUB_SHA: secondSource, GITHUB_REF_NAME: 'preview' });
    assert.notEqual(preview.artifact_sha, second.artifact_sha);
    assert.equal(git('ls-remote', 'origin', 'refs/heads/dist').split(/\s/)[0], second.artifact_sha);
    assert.equal(git('ls-remote', 'origin', 'refs/heads/dist-preview').split(/\s/)[0], preview.artifact_sha);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('promoter retries a lost response idempotently and confirms a fresh immutable readback', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'cfsm-promote-'));
  try {
    const bootstrap = path.join(tmp, 'network.mjs'), record = path.join(tmp, 'calls');
    writeFileSync(bootstrap, `
      import assert from 'node:assert/strict';
      import {appendFileSync} from 'node:fs';
      globalThis.setTimeout = fn => {fn(); return 0;};
      let calls=0;
      globalThis.fetch=async (url, options) => {
        assert.equal(url, 'https://monitor.acedylan.us/api/theme-release');
        assert.equal(options.redirect, 'error');
        assert.equal(options.headers.Authorization, 'Bearer '+process.env.THEME_PUBLISH_TOKEN);
        appendFileSync(process.env.TEST_RECORD, (options.method || 'GET')+'\\n');
        if(options.method==='POST') {
          const body=JSON.parse(options.body);
          assert.equal(body.artifact_sha, process.env.ARTIFACT_SHA);
          if(++calls===1) throw new Error('response lost after switch');
          return Response.json({theme_url:'https://github.com/AceDylan/CFSM-SAO/tree/'+process.env.ARTIFACT_SHA});
        }
        return Response.json({theme_url:'https://github.com/AceDylan/CFSM-SAO/tree/'+process.env.ARTIFACT_SHA,release:{run_id:Number(process.env.GITHUB_RUN_ID),paused:false}});
      };
    `);
    const res = spawnSync(process.execPath, ['--import', bootstrap, path.join(scripts, 'promote-release.mjs')], { env: { ...process.env, ...context, GITHUB_REF: 'refs/heads/main', THEME_PUBLISH_TOKEN: 'a'.repeat(64), ARTIFACT_SHA: 'b'.repeat(40), TEST_RECORD: record }, encoding: 'utf8' });
    assert.equal(res.status, 0, res.stderr);
    assert.equal(readFileSync(record, 'utf8'), 'POST\nPOST\nGET\n');
    assert.ok(!res.stdout.includes('a'.repeat(64)), 'credential never reaches logs');
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('production promoter refuses preview, forks and missing credentials before networking', () => {
  for (const env of [
    { ...context, GITHUB_REF: 'refs/heads/preview' },
    { ...context, GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: 'fork/CFSM-SAO' },
    { ...context, GITHUB_REF: 'refs/heads/main', THEME_PUBLISH_TOKEN: '' },
    { ...context, GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'pull_request' }
  ]) {
    const res = spawnSync(process.execPath, [path.join(scripts, 'promote-release.mjs')], { env: { ...process.env, ...env }, encoding: 'utf8' });
    assert.notEqual(res.status, 0); assert.match(res.stderr, /refused|token missing/);
  }
});

test('promotion rejection logs a fixed reason and never arbitrary credential-bearing response text', () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'cfsm-rejected-'));
  try {
    const bootstrap = path.join(tmp, 'network.mjs');
    for (const reason of ['Invalid validation credential', 'server echoed '+ 'a'.repeat(64)]) {
      writeFileSync(bootstrap, `globalThis.fetch = async () => Response.json({error:${JSON.stringify(reason)}},{status:400});`);
      const res = spawnSync(process.execPath, ['--import', bootstrap, path.join(scripts, 'promote-release.mjs')], { env: { ...process.env, ...context, GITHUB_REF: 'refs/heads/main', THEME_PUBLISH_TOKEN: 'a'.repeat(64), ARTIFACT_SHA: 'b'.repeat(40) }, encoding: 'utf8' });
      assert.notEqual(res.status, 0);
      if (reason === 'Invalid validation credential') assert.match(res.stderr, /400; validation-credential-format/);
      assert.ok(!(res.stdout+res.stderr).includes('a'.repeat(64)), 'credential-bearing response must never be printed');
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
