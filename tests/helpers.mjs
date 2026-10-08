import { build } from 'esbuild';
import { randomUUID } from 'node:crypto';
import { unlink } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
export async function loadModule(entry, stubs = {}) {
  const output = fileURLToPath(new URL(`.generated-${randomUUID()}.mjs`, import.meta.url));
  const root = fileURLToPath(new URL('../', import.meta.url));
  const plugin = { name: 'test-services', setup(b) {
    b.onResolve({ filter: /.*/ }, args => { const key = Object.keys(stubs).find(k => args.path === k || args.path.endsWith('/' + k)); return key ? { path: key, namespace: 'test-stub' } : undefined; });
    b.onLoad({ filter: /.*/, namespace: 'test-stub' }, args => ({ contents: stubs[args.path], loader: 'js' }));
  } };
  try {
    await build({ entryPoints: [entry], absWorkingDir: root, bundle: true, platform: 'node', format: 'esm', outfile: output, external: ['react','react-dom/server'], plugins: [plugin], logLevel: 'silent' });
    return await import(pathToFileURL(output).href);
  } finally { await unlink(output).catch(() => {}); }
}
