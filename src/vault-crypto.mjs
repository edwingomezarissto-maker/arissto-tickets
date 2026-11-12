const encoder = new TextEncoder();

function toBase64(bytes) {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 8192) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 8192));
  }
  return btoa(binary);
}

function fromBase64(value) {
  return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

// Format 1 fixes the KDF, iterations, salt size and authenticated account context.
export function newVaultSalt() {
  return toBase64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function vaultKey(passphrase, salt) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromBase64(salt), iterations: 600000, hash: 'SHA-256' }, material,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

function cipher(iv, ownerId) {
  return { name: 'AES-GCM', iv, tagLength: 128, additionalData: encoder.encode('arissto-vault:1:' + ownerId) };
}

export async function sealVault(entries, key, salt, ownerId) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(cipher(iv, ownerId), key, encoder.encode(JSON.stringify(entries)));
  return { format: 1, salt, iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(encrypted)) };
}

export async function openVault(envelope, key, ownerId) {
  if (envelope.format !== 1) throw new Error('Formato de bóveda desconocido.');
  const clear = await crypto.subtle.decrypt(cipher(fromBase64(envelope.iv), ownerId), key, fromBase64(envelope.ciphertext));
  const rows = JSON.parse(new TextDecoder().decode(clear));
  if (!Array.isArray(rows)) throw new Error('Contenido de bóveda inválido.');
  return rows;
}
