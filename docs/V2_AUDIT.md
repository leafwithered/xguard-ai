# XGuard AI V2 Audit

Audit scope: `app`, `lib`, `contracts`, `test`, `scripts`, configuration, Vercel behavior, and public documentation.

## P0 — correctness and security

- [x] Add a deterministic safety floor so AI cannot reduce known risk.
- [x] Preserve deterministic critical signals and deduplicate AI enrichment.
- [x] Wait for a successful transaction receipt before showing confirmation.
- [x] Represent signature, submission, confirmation, revert, and error states explicitly.
- [x] Decode supported ERC20/ERC721/ERC1155 calldata arguments instead of trusting selectors alone.
- [x] Reject malformed known-method calldata without crashing.

## P1 — product quality

- [x] Replace floating-point OKB value parsing with 18-decimal bigint parsing.
- [x] Enforce address, context, calldata, value, and request-body limits.
- [x] Add Safe Transfer, Unlimited Approval, and Suspicious Airdrop presets.
- [x] Show decoded action, permission recipient, amount, critical signals, AI explanation, and recommendation.
- [x] Store the last report only in `sessionStorage` and provide Clear analysis.
- [x] Handle wallet account, chain, and disconnect events.
- [x] Discover EIP-6963 wallets while retaining injected-wallet fallback.
- [x] Add stable public evidence links and a clear X Layer receipt explanation.

## P2 — engineering

- [x] Add decoder, safety-fusion, transaction-state, and rate-limit tests.
- [x] Add GitHub Actions CI without secrets, deployments, real AI calls, or funds.
- [x] Document the append-only Contract V2 design without deployment.
- [ ] Deploy and validate a Vercel Preview.
- [ ] Validate the official OpenAI Responses API in Preview after user-owned secret configuration.

## Known limits

- In-memory rate limiting is best-effort per warm serverless instance. Reliable distributed rate limiting remains optional production hardening and requires shared infrastructure such as Vercel KV or Upstash.
- The decoder intentionally covers a small, explicit ABI set. Unknown methods remain visible and receive a deterministic review signal.
- XGuard AI does not simulate state changes or guarantee contract safety.
