import { createHash, timingSafeEqual } from "node:crypto";
import Redis from "ioredis";
import { prisma } from "@/lib/db/client";
import { ensureWorkspaceForUser } from "@/lib/workspace";

export const ADMIN_USER_ID = "openreply-local-admin";
export const ADMIN_LOGIN_ENABLED = process.env.AUTH_MODE === "admin";

function settings() {
  const username = process.env.ADMIN_USERNAME ?? "";
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (!username || username.length > 64 || password.length < 16 || password.length > 1024) {
    throw new Error("Admin login requires ADMIN_USERNAME and ADMIN_PASSWORD (at least 16 characters).");
  }
  return { username, password };
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function adminSessionVersion() {
  const { username, password } = settings();
  return digest(JSON.stringify([username, password])).toString("hex");
}

export function matchesAdminCredentials(username: unknown, password: unknown) {
  const expected = settings();
  if (typeof username !== "string" || typeof password !== "string" ||
      username.length > 64 || password.length > 1024) return false;
  const nameMatches = timingSafeEqual(digest(username), digest(expected.username));
  const passwordMatches = timingSafeEqual(digest(password), digest(expected.password));
  return nameMatches && passwordMatches;
}

let redis: Redis | undefined;
export async function authorizeAdmin(credentials: Partial<Record<string, unknown>>) {
  // A shared limit protects the single administrator even across processes and
  // avoids relying on caller-controlled forwarding headers. Fail closed if Redis is down.
  redis ??= new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: 1,
    commandTimeout: 5000,
    connectTimeout: 5000,
  });
  const attempts = await redis.eval(
    "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], 60) end; return n",
    1, "openreply:admin-login:attempts",
  );
  if (Number(attempts) > 20 || !matchesAdminCredentials(credentials.username, credentials.password)) {
    return null;
  }
  // An independent identity cannot accidentally take over an existing email account.
  const user = await prisma.user.upsert({
    where: { id: ADMIN_USER_ID },
    create: { id: ADMIN_USER_ID, name: settings().username },
    update: { name: settings().username },
  });
  await ensureWorkspaceForUser(user.id);
  return user;
}
