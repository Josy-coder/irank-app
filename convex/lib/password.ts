
export function generateSalt(): string {
  const saltArray = new Uint8Array(32);
  crypto.getRandomValues(saltArray);
  return Array.from(saltArray, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const actualSalt = salt || generateSalt();
  const encoder = new TextEncoder();

  const passwordBuffer = encoder.encode(password);
  const saltBuffer = encoder.encode(actualSalt);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const iterations = 100_000;
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBuffer,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  const hashArray = new Uint8Array(derivedBits);
  const hash = btoa(Array.from(hashArray, ch => String.fromCharCode(ch)).join(''));

  return { hash, salt: actualSalt };
}

export async function verifyPassword(password: string, storedHash: string, storedSalt: string): Promise<boolean> {
  try {
    const { hash } = await hashPassword(password, storedSalt);
    return hash === storedHash;
  } catch (error) {
    console.error("Password verification error:", error);
    return false;
  }
}