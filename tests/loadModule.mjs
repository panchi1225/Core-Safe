import { build } from 'esbuild';
export async function loadModule(entry, plugins = []) {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'esm', plugins });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
}
