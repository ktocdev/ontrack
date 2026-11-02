// Prints a new pair of VAPID keys for push notifications, for one deployment.
// VAPID_KEYS goes in the hosted project's function secrets, and is private.
// VITE_VAPID_PUBLIC_KEY goes in the Worker's build variables, and is public.
// Changing them later stops every existing device until it turns notifications on again.
import { webcrypto as crypto } from 'node:crypto'

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const keys = {
  publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey),
  privateKey: await crypto.subtle.exportKey('jwk', pair.privateKey),
}
const raw = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url')

console.log(`VAPID_KEYS=${JSON.stringify(keys)}`)
console.log(`VITE_VAPID_PUBLIC_KEY=${raw}`)
