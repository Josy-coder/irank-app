const SALT_STRING = process.env.NEXT_PUBLIC_FIXED_PBKDF2_SALT!;
const encoder = new TextEncoder();
const FIXED_SALT = encoder.encode(SALT_STRING);

export async function hashPassword(password: string): Promise<string> {
  const passwordBuffer = encoder.encode(password);

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
      salt: FIXED_SALT,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );

  const hashArray = new Uint8Array(derivedBits);
  return btoa(Array.from(hashArray, ch => String.fromCharCode(ch)).join(''));
}
