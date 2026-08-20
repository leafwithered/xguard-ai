import { expect } from "chai";
import { consumeAnalyzeRateLimit, resetAnalyzeRateLimits } from "../lib/api-rate-limit.ts";

describe("Analyze API rate protection", function () {
  beforeEach(function () { resetAnalyzeRateLimits(); });

  it("allows a bounded burst and returns a retry delay", function () {
    const now = 1_000;
    for (let request = 0; request < 20; request += 1) expect(consumeAnalyzeRateLimit("client", now).allowed).to.equal(true);
    const blocked = consumeAnalyzeRateLimit("client", now);
    expect(blocked.allowed).to.equal(false);
    expect(blocked.retryAfterSeconds).to.equal(60);
    expect(consumeAnalyzeRateLimit("client", now + 60_001).allowed).to.equal(true);
  });
});
