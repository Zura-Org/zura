import crypto from "node:crypto";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

process.env.GITHUB_WEBHOOK_SECRET = "test-secret";

let app: import("express").Express;

beforeAll(async () => {
  const { createApp } = await import("./app.js");
  app = createApp();
});

describe("app", () => {
  it("serves health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.chainId).toBe(5042002);
  });

  it("requires auth on protected routes", async () => {
    expect((await request(app).post("/api/waves/create").send({})).status).toBe(401);
    expect((await request(app).get("/api/wallet")).status).toBe(401);
  });

  it("rejects webhooks with a bad signature", async () => {
    const res = await request(app)
      .post("/api/webhooks/github")
      .set("content-type", "application/json")
      .set("x-hub-signature-256", "sha256=deadbeef")
      .send(JSON.stringify({ action: "opened" }));
    expect(res.status).toBe(401);
  });

  it("accepts correctly signed webhooks for events it ignores", async () => {
    const body = JSON.stringify({ action: "created" });
    const sig = "sha256=" + crypto.createHmac("sha256", "test-secret").update(body).digest("hex");
    const res = await request(app)
      .post("/api/webhooks/github")
      .set("content-type", "application/json")
      .set("x-github-event", "star")
      .set("x-hub-signature-256", sig)
      .send(body);
    expect(res.status).toBe(202);
  });
});
