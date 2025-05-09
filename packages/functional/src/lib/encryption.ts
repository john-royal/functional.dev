import crypto from "node:crypto";

export type Encrypted = {
  iv: string;
  tag: string;
  data: string;
};

export function encrypt(plaintext: string, key: Buffer): Encrypted {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: ciphertext.toString("base64"),
  };
}

export function decrypt(enc: Encrypted, key: Buffer) {
  const iv = Buffer.from(enc.iv, "base64");
  const tag = Buffer.from(enc.tag, "base64");
  const ciphertext = Buffer.from(enc.data, "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf-8");
}

export function deriveKey(passphrase: string, metadata: PassphraseMetadata) {
  return crypto.pbkdf2Sync(
    passphrase,
    Buffer.from(metadata.salt, "base64"),
    metadata.iterations,
    32,
    "sha256",
  );
}

export interface PassphraseMetadata {
  salt: string;
  iterations: number;
}

export function generatePassphraseMetadata(): PassphraseMetadata {
  return {
    salt: crypto.randomBytes(16).toString("base64"),
    iterations: 100_000,
  };
}
