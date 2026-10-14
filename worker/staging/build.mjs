import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build} from '../../node_modules/esbuild/lib/main.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const result=await build({entryPoints:[path.join(root,'entry.mjs')],outfile:path.join(root,'../dist-staging/worker.mjs'),bundle:true,metafile:true,format:'esm',platform:'browser',target:'es2022',plugins:[{name:'synthetic-firestore-only',setup(b){b.onResolve({filter:/firestore\.mjs$/},args=>({path:path.join(root,'firestore.mjs')}));}}]});
const source=fs.readFileSync(path.join(root,'../dist-staging/worker.mjs'),'utf8');
if(/firestore\.googleapis/.test(source)||Object.keys(result.metafile.inputs).some(p=>p.replaceAll('\\','/').endsWith('/src/firestore.mjs')))throw Error('Staging bundle contains the production Firestore adapter');
console.log('Synthetic-only staging bundle built; production source files unchanged.');
