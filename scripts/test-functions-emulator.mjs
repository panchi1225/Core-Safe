import { writeFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const secret=fileURLToPath(new URL('../functions/.secret.local',import.meta.url));
let created=false;
try {
  // Disposable, synthetic key only; never fetch a Secret Manager value or overwrite a local key.
  try{await writeFile(secret,`EMPLOYEE_AUTOFILL_KEY=${'a'.repeat(64)}\n`,{flag:'wx'});created=true;}
  catch(error){if(error.code!=='EEXIST')throw error;}
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('../node_modules/firebase-tools/lib/bin/firebase.js',import.meta.url)),
    'emulators:exec','--only','firestore,functions','--project','demo-core-safe','node --test functions/tests/emulator/*.test.mjs'],{
      cwd:root,stdio:'inherit',env:{...process.env,GCLOUD_PROJECT:'demo-core-safe',GOOGLE_CLOUD_PROJECT:'demo-core-safe',METADATA_SERVER_DETECTION:'none',FUNCTIONS_DISCOVERY_TIMEOUT:'60'},
    });
  process.exitCode=result.status??1;
}finally{if(created)await unlink(secret);}
