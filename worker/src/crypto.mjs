const encoder = new TextEncoder();
const decoder = new TextDecoder();
const hex = value => Uint8Array.from(value.match(/../g), x => parseInt(x,16));
const b64 = value => {
  const bytes=new Uint8Array(value);
  if(typeof bytes.toBase64==='function')return bytes.toBase64();
  return btoa(String.fromCharCode(...bytes));
};
const unb64 = value => {
  if(typeof Uint8Array.fromBase64==='function')return Uint8Array.fromBase64(value);
  const binary=atob(value),bytes=new Uint8Array(binary.length);
  // Avoid allocating a string iterator/callback for every ciphertext byte.
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return bytes;
};
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
  return JSON.parse(decoder.decode(raw));
}
export function equalMac(a,b) {
  if (typeof a !== 'string' || a.length !== b.length) return false;
  let diff = 0; for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i);
  return diff === 0;
}
