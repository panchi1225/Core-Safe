import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { checkDiff } from './check-diff.mjs';

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'core-safe-ci-'));
  t.after(() => {
    assert.equal(dirname(resolve(cwd)), resolve(tmpdir()));
    assert.ok(cwd.includes('core-safe-ci-'));
    rmSync(cwd, { recursive: true, force: true });
  });
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '--initial-branch=main');
  git('config', 'user.name', 'CI Fixture');
  git('config', 'user.email', 'ci@example.invalid');
  git('config', 'core.autocrlf', 'false');
  git('config', 'core.whitespace', 'blank-at-eol,blank-at-eof,space-before-tab');
  const commit = content => {
    writeFileSync(join(cwd, 'fixture.txt'), content);
    git('add', 'fixture.txt');
    git('commit', '-m', 'Synthetic CI fixture');
    return git('rev-parse', 'HEAD');
  };
  const check = (eventName, event = {}, sha) => checkDiff({ cwd, eventName, event, sha, log() {} });
  return { git, commit, check };
}

test('PR compares event base with checked-out HEAD, including multiple commits', t => {
  const { commit, check } = fixture(t);
  const base = commit('base\n');
  commit('base\ninvalid trailing space \n');
  commit('base\ninvalid trailing space \nlast\n');
  assert.throws(() => check('pull_request', { pull_request: { base: { sha: base } } }), /trailing whitespace/);
});

test('push compares before with github.sha rather than the current HEAD', t => {
  const { commit, check } = fixture(t);
  const before = commit('base\n');
  const sha = commit('base\nvalid\n');
  commit('base\nvalid\ninvalid \n');
  assert.deepEqual(check('push', { before }, sha), { base: before, target: sha });
});

test('push checks the entire multi-commit range', t => {
  const { commit, check } = fixture(t);
  const before = commit('base\n');
  commit('base\ninvalid \n');
  const sha = commit('base\ninvalid \nlast\n');
  assert.throws(() => check('push', { before }, sha), /trailing whitespace/);
});

test('manual execution checks only the HEAD change, excluding old whitespace', t => {
  const { commit, check } = fixture(t);
  const base = commit('historical whitespace \n');
  commit('historical whitespace \nnew clean line\n');
  assert.deepEqual(check('workflow_dispatch'), { base, target: 'HEAD' });
});

test('manual execution uses the first parent of a merge commit', t => {
  const { git, commit, check } = fixture(t);
  commit('base\n');
  git('switch', '-c', 'feature');
  commit('base\ninvalid \n');
  git('switch', 'main');
  git('merge', '--no-ff', 'feature', '-m', 'Fixture merge');
  assert.throws(() => check('workflow_dispatch'), /trailing whitespace/);
});

test('manual root commit has a valid empty-tree comparison', t => {
  const { commit, check } = fixture(t);
  commit('invalid \n');
  assert.throws(() => check('workflow_dispatch'), /trailing whitespace/);
});

test('new branch push accepts the zero before SHA and checks only the new commit', t => {
  const { commit, check } = fixture(t);
  const base = commit('old whitespace \n');
  const sha = commit('old whitespace \nnew line\n');
  assert.deepEqual(check('push', { before: '0'.repeat(40) }, sha), { base, target: sha });
});

test('new branch root push checks the root commit', t => {
  const { commit, check } = fixture(t);
  const sha = commit('invalid \n');
  assert.throws(() => check('push', { before: '0'.repeat(40) }, sha), /trailing whitespace/);
});

test('unavailable push base fails clearly instead of passing a partial range', t => {
  const { commit, check } = fixture(t);
  const sha = commit('clean\n');
  assert.throws(() => check('push', { before: '1'.repeat(40) }, sha), /cannot verify the full push range/);
});

test('push can fetch the exact before commit missing from checkout history', t => {
  const remote = fixture(t);
  const before = remote.commit('old remote tip\n');
  const local = fixture(t);
  const sha = local.commit('current push target\n');
  local.git('remote', 'add', 'origin', remote.git('rev-parse', '--show-toplevel'));
  assert.deepEqual(local.check('push', { before }, sha), { base: before, target: sha });
});

test('missing PR SHA and unsupported events fail without an invalid diff command', t => {
  const { commit, check } = fixture(t);
  commit('clean\n');
  assert.throws(() => check('pull_request'), /Missing or invalid/);
  assert.throws(() => check('unknown'), /Unsupported CI event/);
});
