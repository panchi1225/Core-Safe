const encoder = new TextEncoder();
const hex = value => Uint8Array.from(value.match(/../g), x => parseInt(x,16));
const b64 = value => btoa(String.fromCharCode(...new Uint8Array(value)));
const unb64 = value => Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const keys = new Map();
async function key(secret, algorithm) {
  if (!/^[0-9a-f]{64}$/.test(secret || '')) throw Error('missing-secret');
  const cacheKey = algorithm+secret;
  if (!keys.has(cacheKey)) keys.set(cacheKey, crypto.subtle.importKey('raw',hex(secret), algorithm === 'HMAC' ? {name:'HMAC',hash:'SHA-256'} : 'AES-GCM',false,algorithm === 'HMAC' ? ['sign'] : ['encrypt','decrypt']));
  return keys.get(cacheKey);
}
export async function mac(secret, value) {
  const signature = await crypto.subtle.sign('HMAC',await key(secret,'HMAC'),encoder.encode(value));
  return Array.from(new Uint8Array(signature),v=>v.toString(16).padStart(2,'0')).join('');
}
export async function encrypt(secret, value, aad) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(aad)},await key(secret,'AES-GCM'),encoder.encode(JSON.stringify(value)));
  return b64(iv)+'.'+b64(data);
}
export async function decrypt(secret, value, aad) {
  const [iv,data] = value.split('.');
  const raw = await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(iv),additionalData:encoder.encode(aad)},await key(secret,'AES-GCM'),unb64(data));
  return JSON.parse(new TextDecoder().decode(raw));
}
export function equalMac(a,b) {
  if (typeof a !== 'string' || a.length !== b.length) return false;
  let diff = 0; for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i);
  return diff === 0;
}
