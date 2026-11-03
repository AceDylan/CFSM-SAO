import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { prepareRelease } from './prepare-release.mjs';

const env = process.env;
if (env.GITHUB_REPOSITORY !== 'AceDylan/CFSM-SAO' || !['main', 'preview'].includes(env.GITHUB_REF_NAME) ||
    !['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME)) throw new Error('Publishing context refused');
const branch = env.GITHUB_REF_NAME === 'main' ? 'dist' : 'dist-preview';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const head = git('ls-remote', 'origin', `refs/heads/${env.GITHUB_REF_NAME}`).split(/\s/)[0];
if (head !== env.GITHUB_SHA) {
  appendFileSync(env.GITHUB_OUTPUT, 'stale=true\n');
  console.log('Source superseded; publication skipped');
  process.exit(0);
}
prepareRelease(path.resolve('dist'), env);
const remote = spawnSync('git', ['ls-remote', '--exit-code', 'origin', `refs/heads/${branch}`], { encoding: 'utf8' });
if (![0, 2].includes(remote.status)) throw new Error('Cannot read artifact branch');
const workdir = path.join(env.RUNNER_TEMP, 'cfsm-publish');
if (existsSync(workdir)) throw new Error('Publication directory already exists');
if (remote.status === 0) {
  git('fetch', '--no-tags', 'origin', `refs/heads/${branch}`);
  git('worktree', 'add', '--detach', workdir, 'FETCH_HEAD');
} else {
  git('worktree', 'add', '--detach', workdir, 'HEAD');
  git('-C', workdir, 'checkout', '--orphan', `publish-${branch}-${env.GITHUB_RUN_ID}`);
}
for (const name of readdirSync(workdir)) if (name !== '.git') rmSync(path.join(workdir, name), { recursive: true, force: true });
cpSync('dist/index.html', path.join(workdir, 'index.html'));
mkdirSync(path.join(workdir, 'assets'), { recursive: true });
cpSync('dist/assets', path.join(workdir, 'assets'), { recursive: true });
git('-C', workdir, 'config', 'user.name', 'github-actions[bot]');
git('-C', workdir, 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
git('-C', workdir, 'add', '-A');
const diff = spawnSync('git', ['-C', workdir, 'diff', '--cached', '--quiet']);
if (![0, 1].includes(diff.status)) throw new Error('Cannot compare artifact');
if (diff.status === 1 || env.FORCE_PUBLISH === 'true') git('-C', workdir, 'commit', '--allow-empty', '-q', '-m', env.RELEASE_NOTE || `Build ${env.GITHUB_SHA}`);
const artifact = git('-C', workdir, 'rev-parse', 'HEAD');
// A normal fast-forward push retains every previously published immutable version.
git('-C', workdir, 'push', '-q', 'origin', `HEAD:refs/heads/${branch}`);
appendFileSync(env.GITHUB_OUTPUT, `artifact_sha=${artifact}\nstale=false\n`);
console.log(`Published immutable artifact ${artifact} to ${branch}`);
