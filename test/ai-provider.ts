import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { expect } from "chai";
import { analyzeTransaction } from "../lib/ai/provider.ts";
import { localRiskAnalysis, type RiskInput } from "../lib/risk.ts";

const input: RiskInput = {
  from: "",
  to: "0x1111111111111111111111111111111111111111",
  value: "0",
  data: "0x",
  context: "Normal transfer"
};

describe("Configurable AI provider", function () {
  const originalEnvironment = { key: process.env.AI_API_KEY, base: process.env.AI_BASE_URL, model: process.env.AI_MODEL };

  async function withProvider(handler: (request: IncomingMessage, response: ServerResponse, body: string) => void, action: (baseURL: string) => Promise<void>) {
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      request.on("end", () => handler(request, response, Buffer.concat(chunks).toString("utf8")));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Provider test server did not start");
    try { await action(`http://127.0.0.1:${address.port}`); } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  }

  afterEach(function () {
    if (originalEnvironment.key === undefined) delete process.env.AI_API_KEY; else process.env.AI_API_KEY = originalEnvironment.key;
    if (originalEnvironment.base === undefined) delete process.env.AI_BASE_URL; else process.env.AI_BASE_URL = originalEnvironment.base;
    if (originalEnvironment.model === undefined) delete process.env.AI_MODEL; else process.env.AI_MODEL = originalEnvironment.model;
  });

  it("returns null when provider configuration is absent", async function () {
    delete process.env.AI_API_KEY;
    delete process.env.AI_BASE_URL;
    delete process.env.AI_MODEL;
    expect(await analyzeTransaction(input, localRiskAnalysis(input))).to.equal(null);
  });

  it("falls back after provider endpoint failures", async function () {
    process.env.AI_API_KEY = "test-only-key";
    process.env.AI_MODEL = "test-model";
    await withProvider((_request, response) => {
      response.writeHead(503, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: "unavailable" }));
    }, async (baseURL) => {
      process.env.AI_BASE_URL = baseURL;
      expect(await analyzeTransaction(input, localRiskAnalysis(input))).to.equal(null);
    });
  });

  it("uses Chat Completions when Responses is unavailable", async function () {
    process.env.AI_API_KEY = "test-only-key";
    process.env.AI_MODEL = "test-model";
    let requestCount = 0;
    await withProvider((_request, response, body) => {
      requestCount += 1;
      if (body.includes('"messages"')) {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ score: 12, level: "LOW", summary: "Looks routine", reasons: ["Test provider response"], recommendation: "Verify the destination before signing." }) } }] }));
      } else {
        response.writeHead(404, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "responses unsupported" }));
      }
    }, async (baseURL) => {
      process.env.AI_BASE_URL = baseURL;
      const result = await analyzeTransaction(input, localRiskAnalysis(input));
      expect(requestCount).to.equal(2);
      expect(result?.mode).to.equal("AI");
      expect(result?.providerProtocol).to.equal("chat");
      expect(result?.score).to.equal(12);
    });
  });

  it("accepts Responses output content when output_text is absent", async function () {
    process.env.AI_API_KEY = "test-only-key";
    process.env.AI_MODEL = "test-model";
    await withProvider((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ score: 14, level: "LOW", summary: "Responses works", reasons: ["Test Responses output"], recommendation: "Verify before signing.", normalizedIntent: { action: "TOKEN_TRANSFER", scope: "NONE", amount: null, asset: null, recipient: null, confidence: "MEDIUM" } }) }] }] }));
    }, async (baseURL) => {
      process.env.AI_BASE_URL = baseURL;
      const result = await analyzeTransaction(input, localRiskAnalysis(input));
      expect(result?.mode).to.equal("AI");
      expect(result?.providerProtocol).to.equal("responses");
      expect(result?.score).to.equal(14);
      expect(result?.normalizedIntent).to.include({ action: "TOKEN_TRANSFER", confidence: "MEDIUM" });
    });
  });

  it("rejects malformed provider output so the caller can use Local Analysis", async function () {
    process.env.AI_API_KEY = "test-only-key";
    process.env.AI_MODEL = "test-model";
    await withProvider((_request, response, body) => {
      response.writeHead(body.includes('"messages"') ? 200 : 404, { "content-type": "application/json" });
      response.end(body.includes('"messages"') ? JSON.stringify({ choices: [{ message: { content: "not-json" } }] }) : JSON.stringify({ error: "responses unsupported" }));
    }, async (baseURL) => {
      process.env.AI_BASE_URL = baseURL;
      expect(await analyzeTransaction(input, localRiskAnalysis(input))).to.equal(null);
    });
  });
});
