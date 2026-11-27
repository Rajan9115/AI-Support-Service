import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";

export interface AccessTokenClaims {
  sub: string;
  sessionId: string;
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export function generateOpaqueToken(byteLength: number = 32): string {
  return randomBytes(byteLength).toString("hex");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function generatePublicProjectId(): string {
  return `proj_pub_${randomBytes(12).toString("hex")}`;
}

export function generateProjectApiKey(): { plaintext: string; keyPrefix: string; keyHash: string } {
  const random = randomBytes(24).toString("hex");
  const plaintext = `rsk_${random}`;
  return {
    plaintext,
    keyPrefix: plaintext.slice(0, 12),
    keyHash: sha256Hex(plaintext),
  };
}

export async function signAccessToken(
  claims: AccessTokenClaims,
  secret: string,
  expiresInSeconds: number = 900,
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({ sessionId: claims.sessionId, email: claims.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(key);
}

export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<AccessTokenClaims | null> {
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.sessionId !== "string" ||
      typeof payload.email !== "string"
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      sessionId: payload.sessionId,
      email: payload.email,
    };
  } catch {
    return null;
  }
}
