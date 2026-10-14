import test from 'node:test';
import assert from 'node:assert/strict';
import {encrypt,decrypt,mac} from '../src/crypto.mjs';
import {createHmac} from 'node:crypto';

test('optimized byte conversion reads old AES-GCM payloads and writes the same authenticated format',async()=>{
 const secret='1'.repeat(64),aad='synthetic-generation:selection';
 const value={name:'架空社員',address:'架空の日本語住所'.repeat(300),qualifications:{slinging:true},years:10};
 const key=await crypto.subtle.importKey('raw',Buffer.from(secret,'hex'),'AES-GCM',false,['encrypt','decrypt']);
 const iv=crypto.getRandomValues(new Uint8Array(12)),encoder=new TextEncoder();
 const oldCipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(aad)},key,encoder.encode(JSON.stringify(value)));
 const legacy=Buffer.from(iv).toString('base64')+'.'+Buffer.from(oldCipher).toString('base64');
 assert.deepEqual(await decrypt(secret,legacy,aad),value);
 const [newIV,newCipher]=(await encrypt(secret,value,aad)).split('.');
 const decoded=await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(newIV,'base64'),additionalData:encoder.encode(aad)},key,Buffer.from(newCipher,'base64'));
 assert.deepEqual(JSON.parse(new TextDecoder().decode(decoded)),value);
 await assert.rejects(decrypt(secret,legacy,'wrong-generation'));
 assert.equal(await mac(secret,'synthetic-dob'),createHmac('sha256',Buffer.from(secret,'hex')).update('synthetic-dob').digest('hex'));
});
