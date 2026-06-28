import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";

export const API_KEY_PREFIX = "vph_";

export function generateApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(24).toString("hex")}`;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function apiKeyDisplayPrefix(key: string): string {
  return key.slice(0, 12) + "…";
}

export async function createApiKey(userId: string, name: string) {
  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);
  const prefix = apiKeyDisplayPrefix(rawKey);

  const record = await prisma.apiKey.create({
    data: { userId, name, keyHash, prefix },
  });

  return { record, rawKey };
}

export async function verifyApiKey(
  key: string
): Promise<{ userId: string; keyId: string } | null> {
  if (!key.startsWith(API_KEY_PREFIX)) return null;
  const keyHash = hashApiKey(key);
  const record = await prisma.apiKey.findUnique({ where: { keyHash } });
  if (!record) return null;

  void prisma.apiKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });

  return { userId: record.userId, keyId: record.id };
}
