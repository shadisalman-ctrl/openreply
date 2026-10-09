import { beforeEach, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ default: () => ({ handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }) }));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));
vi.mock("@/lib/db/client", () => ({ prisma: {} }));
vi.mock("@/lib/workspace", () => ({ ensureWorkspaceForUser: vi.fn(), getPrimaryWorkspace: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv("ADMIN_USERNAME", "admin");
  vi.stubEnv("ADMIN_PASSWORD", "a-long-unique-test-password");
});

it("uses only credentials and JWT sessions in admin mode, and rejects stale sessions", async () => {
  vi.stubEnv("AUTH_MODE", "admin");
  const { authConfig } = await import("@/lib/auth");
  const { ADMIN_USER_ID } = await import("@/lib/admin-auth");
  expect(authConfig.session.strategy).toBe("jwt");
  expect(authConfig.providers).toHaveLength(1);
  expect(authConfig.providers[0]).toMatchObject({ type: "credentials" });
  const token = { sub: ADMIN_USER_ID };
  expect(await authConfig.callbacks.jwt({ token, user: { id: ADMIN_USER_ID } } as never)).toBe(token);
  expect(await authConfig.callbacks.jwt({ token } as never)).toBe(token);
  const session = { user: {} };
  await authConfig.callbacks.session({ session, token } as never);
  expect(session.user).toMatchObject({ id: ADMIN_USER_ID });
  vi.stubEnv("ADMIN_PASSWORD", "a-different-long-password");
  expect(await authConfig.callbacks.jwt({ token } as never)).toBeNull();
  expect(await authConfig.callbacks.signIn({ user: { id: "other-user" } } as never)).toBe(false);
});

it("retains database sessions and email providers outside admin mode", async () => {
  vi.stubEnv("AUTH_MODE", "");
  vi.stubEnv("EMAIL_SERVER", "smtps://example.com");
  const { authConfig } = await import("@/lib/auth");
  expect(authConfig.session.strategy).toBe("database");
  expect(authConfig.providers).toHaveLength(1);
  expect(authConfig.providers[0]).toMatchObject({ type: "email", id: "nodemailer" });
});
