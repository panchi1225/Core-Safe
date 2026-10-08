import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Use the runner's event file, never interpolate event values into a shell command.
export function checkDiff({ eventName, event, sha, cwd = process.cwd(), log = console.log }) {
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const validateSha = value => {
    if (!/^[a-f0-9]{40}$/i.test(value ?? '')) throw new Error('Missing or invalid event commit SHA');
    return value;
  };
  const hasCommit = value => {
    try { git('cat-file', '-e', `${value}^{commit}`); return true; }
    catch { return false; }
  };
  const previousCommit = target => {
    const parents = git('rev-list', '--parents', '-n', '1', target).split(' ').slice(1);
    // A root commit has no parent: compare its tree with an empty tree only.
    return parents[0] ?? execFileSync('git', ['mktree'], { cwd, input: '', encoding: 'utf8' }).trim();
  };
  let base;
  let target;
  switch (eventName) {
    case 'pull_request':
      base = validateSha(event.pull_request?.base?.sha);
      target = 'HEAD';
      break;
    case 'push':
      target = validateSha(sha);
      if (!hasCommit(target)) throw new Error('Push target commit is not checked out');
      base = validateSha(event.before);
      if (/^0+$/.test(base)) {
        base = previousCommit(target);
        log('New branch push: checking the target commit against its first parent (or empty root tree).');
      } else if (!hasCommit(base)) {
        // A force-push may remove the old tip from the history fetched by checkout.
        // Fetch only the event's exact SHA; never substitute a narrower successful check.
        try { git('fetch', '--no-tags', 'origin', base); } catch { /* Report the missing range below. */ }
        if (!hasCommit(base)) throw new Error('Push comparison base is unavailable; CI cannot verify the full push range');
      }
      break;
    case 'workflow_dispatch':
      target = 'HEAD';
      base = previousCommit(target);
      break;
    default:
      throw new Error(`Unsupported CI event: ${eventName}`);
  }
  if (eventName === 'pull_request' && !hasCommit(base)) throw new Error('PR comparison base is unavailable');
  log(`git diff --check ${base} ${target}`);
  try { git('diff', '--check', base, target); }
  catch (error) { throw new Error(error.stdout?.trim() || 'git diff --check failed'); }
  return { base, target };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    checkDiff({
      eventName: process.env.GITHUB_EVENT_NAME,
      event: JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
      sha: process.env.GITHUB_SHA,
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
