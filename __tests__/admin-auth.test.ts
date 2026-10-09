import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  eval: vi.fn(),
  upsert: vi.fn(),
  workspace: vi.fn(),
}));
vi.mock("ioredis", () => ({ default: class { eval = mocks.eval; } }));
vi.mock("@/lib/db/client", () => ({ prisma: { user: { upsert: mocks.upsert } } }));
vi.mock("@/lib/workspace", () => ({ ensureWorkspaceForUser: mocks.workspace }));

import { ADMIN_USER_ID, adminSessionVersion, authorizeAdmin, matchesAdminCredentials } from "@/lib/admin-auth";

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("ADMIN_USERNAME", "admin");
  vi.stubEnv("ADMIN_PASSWORD", "a-long-unique-test-password");
  mocks.eval.mockResolvedValue(1);
  mocks.upsert.mockResolvedValue({ id: ADMIN_USER_ID, name: "admin", email: null });
});

describe("single administrator login", () => {
  it("rejects incorrect, missing, and oversized credentials without database access", async () => {
    for (const credentials of [{}, { username: "wrong", password: "a-long-unique-test-password" },
      { username: "admin", password: "wrong" }, { username: "admin", password: "x".repeat(1025) }]) {
      expect(await authorizeAdmin(credentials)).toBeNull();
    }
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.workspace).not.toHaveBeenCalled();
  });

  it("creates or reuses an independent admin identity and provisions its workspace", async () => {
    expect(await authorizeAdmin({ username: "admin", password: "a-long-unique-test-password" }))
      .toMatchObject({ id: ADMIN_USER_ID });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ADMIN_USER_ID } }));
    expect(mocks.workspace).toHaveBeenCalledWith(ADMIN_USER_ID);
  });

  it("limits attempts and fails closed when Redis is unavailable", async () => {
    mocks.eval.mockResolvedValue(21);
    expect(await authorizeAdmin({ username: "admin", password: "a-long-unique-test-password" })).toBeNull();
    mocks.eval.mockRejectedValue(new Error("offline"));
    await expect(authorizeAdmin({ username: "admin", password: "a-long-unique-test-password" })).rejects.toThrow("offline");
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("requires strong configuration and changes the session version on password rotation", () => {
    const original = adminSessionVersion();
    vi.stubEnv("ADMIN_PASSWORD", "another-long-unique-password");
    expect(adminSessionVersion()).not.toBe(original);
    vi.stubEnv("ADMIN_PASSWORD", "short");
    expect(() => matchesAdminCredentials("admin", "short")).toThrow("at least 16");
  });
});
