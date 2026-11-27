import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createV1Modules } from "../container.js";
import { createLogger } from "../infrastructure/logger/logger.js";
import { createInMemoryRepositories } from "./in-memory-repositories.js";

const TEST_SECRET = "test-session-secret-must-be-at-least-32-chars";

function buildTestHarness() {
  const repositories = createInMemoryRepositories();
  const v1 = createV1Modules({
    repositories,
    sessionSecret: TEST_SECRET,
    isProduction: false,
  });

  const app = createApp({
    logger: createLogger("silent"),
    allowedOrigins: ["http://localhost:3000"],
    readinessChecks: {
      checkMongo: async () => true,
      checkRedis: async () => true,
    },
    v1Routers: {
      auth: v1.authRouter,
      organizations: v1.organizationRouter,
      projects: v1.projectRouter,
    },
  });

  return { app, repositories, projectService: v1.projectService };
}

describe("Phase 3: Auth, Multi-Tenancy, RBAC, and API Key Lifecycle", () => {
  it("registers an owner, creates a project and API key (shown once), and revokes it", async () => {
    const { app, repositories, projectService } = buildTestHarness();
    const agent = request.agent(app);

    const regRes = await agent.post("/v1/auth/register").send({
      email: "owner@acme.com",
      password: "Password123!",
      name: "Alice Owner",
      organizationName: "Acme Corp",
    });
    expect(regRes.status).toBe(201);
    expect(regRes.body.data.organization.slug).toBe("acme-corp");

    const meRes = await agent.get("/v1/auth/me");
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.memberships[0].role).toBe("owner");

    const projRes = await agent.post("/v1/projects").send({
      name: "Acme Support",
      slug: "acme-support",
      allowedOrigins: ["https://acme.com"],
    });
    expect(projRes.status).toBe(201);
    const projectId = projRes.body.data.id as string;
    expect(projRes.body.data.publicId).toMatch(/^proj_pub_/);

    const keyRes = await agent.post(`/v1/projects/${projectId}/api-keys`).send({
      name: "Server Key",
    });
    expect(keyRes.status).toBe(201);
    const plaintextKey = keyRes.body.data.plaintextKey as string;
    const keyId = keyRes.body.data.apiKey.id as string;
    expect(plaintextKey).toMatch(/^rsk_/);
    expect(keyRes.body.data.apiKey.keyHash).toBeUndefined();

    // Plaintext key is never returned in subsequent list calls
    const listKeysRes = await agent.get(`/v1/projects/${projectId}/api-keys`);
    expect(listKeysRes.status).toBe(200);
    expect(listKeysRes.body.data).toHaveLength(1);
    expect(listKeysRes.body.data[0].plaintextKey).toBeUndefined();
    expect(listKeysRes.body.data[0].keyHash).toBeUndefined();

    // Key verifies while active
    const verifiedActive = await projectService.verifySecretApiKey(plaintextKey);
    expect(verifiedActive?.projectId).toBe(projectId);

    // Revoking key stops authentication
    const revokeRes = await agent.delete(`/v1/projects/${projectId}/api-keys/${keyId}`);
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.data.revokedAt).toBeTruthy();

    const verifiedRevoked = await projectService.verifySecretApiKey(plaintextKey);
    expect(verifiedRevoked).toBeNull();

    // Audit logs recorded sensitive actions
    expect(repositories.auditLogsList.map((a) => a.action)).toEqual([
      "auth.register",
      "project.created",
      "api_key.created",
      "api_key.revoked",
    ]);
  });

  it("enforces strict tenant isolation between Organization A and Organization B", async () => {
    const { app } = buildTestHarness();
    const agentA = request.agent(app);
    const agentB = request.agent(app);

    const regA = await agentA.post("/v1/auth/register").send({
      email: "a@orga.com",
      password: "Password123!",
      name: "Org A Owner",
      organizationName: "Org A",
    });
    const orgAId = regA.body.data.organization.id as string;

    await agentB.post("/v1/auth/register").send({
      email: "b@orgb.com",
      password: "Password123!",
      name: "Org B Owner",
      organizationName: "Org B",
    });

    const projA = await agentA.post("/v1/projects").send({
      name: "Secret Project A",
      slug: "secret-a",
    });
    const projAId = projA.body.data.id as string;

    // Org B cannot access Org A's project by guessing its ID
    const crossGet = await agentB.get(`/v1/projects/${projAId}`);
    expect(crossGet.status).toBe(404);

    // Org B cannot spoof X-Organization-Id to impersonate Org A
    const spoofHeader = await agentB
      .get(`/v1/projects/${projAId}`)
      .set("X-Organization-Id", orgAId);
    expect(spoofHeader.status).toBe(403);

    // Org B cannot create API keys in Org A's project
    const crossKey = await agentB.post(`/v1/projects/${projAId}/api-keys`).send({
      name: "Stolen Key",
    });
    expect(crossKey.status).toBe(404);
  });

  it("enforces server-side RBAC and session revocation on logout", async () => {
    const { app } = buildTestHarness();
    const ownerAgent = request.agent(app);
    const supportAgent = request.agent(app);

    const ownerReg = await ownerAgent.post("/v1/auth/register").send({
      email: "owner@rbac.com",
      password: "Password123!",
      name: "Owner",
      organizationName: "RBAC Org",
    });
    const rbacOrgId = ownerReg.body.data.organization.id as string;

    await supportAgent.post("/v1/auth/register").send({
      email: "agent@rbac.com",
      password: "Password123!",
      name: "Support Agent",
      organizationName: "Personal Org",
    });

    const addMemberRes = await ownerAgent.post("/v1/organizations/current/members").send({
      email: "agent@rbac.com",
      role: "support_agent",
    });
    expect(addMemberRes.status).toBe(201);

    // Support agent cannot create a project inside RBAC Org
    const createProjDenied = await supportAgent
      .post("/v1/projects")
      .set("X-Organization-Id", rbacOrgId)
      .send({ name: "Unauthorized", slug: "unauth" });
    expect(createProjDenied.status).toBe(403);

    // Logout revokes session and blocks further /auth/me calls
    const logoutRes = await ownerAgent.post("/v1/auth/logout");
    expect(logoutRes.status).toBe(200);

    const meAfterLogout = await ownerAgent.get("/v1/auth/me");
    expect(meAfterLogout.status).toBe(401);
  });
});
