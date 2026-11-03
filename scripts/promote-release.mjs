// No dependencies and no credentials in command arguments, URLs or diagnostic output.
const env = process.env;
if (env.GITHUB_REPOSITORY !== 'AceDylan/CFSM-SAO' || env.GITHUB_REF !== 'refs/heads/main' ||
    !['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME)) throw new Error('Production promotion refused');
if (!/^[a-f0-9]{64}$/.test(env.THEME_PUBLISH_TOKEN || '')) throw new Error('Publisher token missing');
if (!/^[a-f0-9]{40}$/.test(env.ARTIFACT_SHA || '')) throw new Error('Artifact SHA missing');
const endpoint = 'https://monitor.acedylan.us/api/theme-release';
const headers = { Authorization: `Bearer ${env.THEME_PUBLISH_TOKEN}`, 'Content-Type': 'application/json' };
if (env.GH_READ_TOKEN) headers['X-GitHub-Token'] = env.GH_READ_TOKEN;
if (env.GH_READ_TOKEN && !/^[A-Za-z0-9_]{20,255}$/.test(env.GH_READ_TOKEN)) {
  console.log('GitHub validation uses an opaque installation credential format');
}
const data = { action: 'promote', artifact_sha: env.ARTIFACT_SHA, source_sha: env.GITHUB_SHA, run_id: Number(env.GITHUB_RUN_ID), run_number: Number(env.GITHUB_RUN_NUMBER) };
let ok = false;
for (let attempt = 0; attempt < 5; attempt++) {
  try {
    const result = await fetch(endpoint, { method: 'POST', headers, redirect: 'error', signal: AbortSignal.timeout(180000), body: JSON.stringify(data) });
    if (result.ok) { ok = true; break; }
    if ([400, 401, 403, 409, 415].includes(result.status)) {
      const failure = await result.json().catch(() => ({}));
      // Only fixed diagnostic labels may reach logs, never arbitrary response or credential text.
      const reasons = { 'Invalid validation credential': 'validation-credential-format', 'Invalid promotion schema': 'promotion-schema', 'Invalid JSON': 'invalid-json', 'Query parameters are not allowed': 'query-parameters' };
      const reason = Object.hasOwn(reasons, failure.error) ? `; ${reasons[failure.error]}` : '';
      throw new Error(`Promotion refused (${result.status}${reason}); inspect authenticated release status`);
    }
  } catch (error) {
    if (error.message.startsWith('Promotion refused')) throw error;
  }
  // A lost response may follow a successful atomic switch. Identical retries are safe.
  await new Promise(resolve => setTimeout(resolve, 15000));
}
if (!ok) throw new Error('Promotion not confirmed; inspect authenticated release status before recovery');
const readback = await fetch(endpoint, { headers, redirect: 'error', signal: AbortSignal.timeout(30000) });
if (!readback.ok) throw new Error('Promotion readback unavailable');
const state = await readback.json();
if (state.theme_url !== `https://github.com/AceDylan/CFSM-SAO/tree/${env.ARTIFACT_SHA}` || state.release?.run_id !== data.run_id || state.release?.paused) throw new Error('Promotion readback mismatch');
console.log(`Production now references artifact ${env.ARTIFACT_SHA}; new page loads converge within 120 seconds. Existing tabs retain their loaded version.`);
