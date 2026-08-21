# XGuard V4 — OKX Transaction Simulation Evidence

Status: **live-verified Preview candidate** on `codex/v4-okx-simulation`; not merged and not Production.

V4 treats the official OKX OnchainOS Transaction Simulation API as an additional factual, read-only evidence source. It does not replace XGuard's deterministic decoder, local rules, X Layer RPC intelligence, bounded preflight, intent comparison, or deterministic safety floor.

## Network boundary

| Context | Chain ID | OKX chainIndex | Behavior |
| --- | ---: | --- | --- |
| X Layer Testnet | `1952` | none | Existing V3 RPC/preflight path; simulator is never called |
| X Layer Mainnet | `196` | `"196"` | Mainnet RPC/preflight plus optional OKX simulation evidence |

The analysis network is explicit input. Credentials never cause Testnet input to be sent to the Mainnet simulator. The supported-chain decision is release-validated rather than requested on every analysis, avoiding extra latency. X Layer Mainnet support must be reconfirmed during live release verification.

## Server-side request and authentication

- Endpoint: `POST https://web3.okx.com/api/v6/dex/pre-transaction/simulate`
- Body: `fromAddress`, `toAddress`, `chainIndex`, atomic `txAmount`, and exact `extJson.inputData`
- Prehash: `timestamp + "POST" + requestPath + exactRawJsonBody`
- Signature: HMAC-SHA256 with the secret key, then Base64
- Timeout: 5 seconds
- Retries: none in Phase A; no retry storm

The exact body string that is signed is the body sent on the wire. Authentication headers and credentials are never logged or returned.

## Normalized immutable evidence

```text
provider: OKX_ONCHAINOS
network / chainId / chainIndex
status: AVAILABLE | UNAVAILABLE | UNSUPPORTED | ERROR
statusDetail
intention
assetChanges[]: assetType, name, symbol, decimals, address, rawValue
gasUsed
failReason
risks[]: address, addressType
observedAt / durationMs / httpStatus / businessCode
```

Only documented factual provider fields are normalized. Asset `rawValue` is preserved exactly: positive means a simulated increase/receipt and negative means a simulated decrease/spend. Human-readable formatting is limited to bounded integer decimals and NATIVE/ERC20 asset types. A contract address is stronger identity evidence than a symbol or name; token identity is never inferred from display metadata alone.

The evidence object is assembled before AI. AI may explain it, but the final pipeline returns the original normalized simulation facts, not an AI-modified copy.

## Deterministic semantics

- Empty `risks` displays: **No OKX simulation risk entries were returned. This is not proof of safety.**
- A non-empty `failReason` indicates possible failure under simulated state. It does not prove maliciousness.
- RPC preflight and OKX simulation are shown separately.
- `RPC SUCCEEDED + simulation failReason`, or `RPC REVERTED + no simulation failReason`, creates an explicit evidence inconsistency and prevents HIGH confidence.
- OKX evidence and AI cannot lower any deterministic XGuard floor.
- Missing or unavailable simulation never blocks the rest of the analysis.

## Failure isolation

| Condition | Normalized status | Core analysis continues |
| --- | --- | --- |
| Testnet `1952` | `UNSUPPORTED` | Yes |
| Missing credentials | `UNAVAILABLE` | Yes |
| Timeout/network failure | `UNAVAILABLE` | Yes |
| HTTP `429` / `5xx` | `UNAVAILABLE` | Yes |
| HTTP `401` / `403` | `ERROR` | Yes |
| Other non-success HTTP | `ERROR` | Yes |
| Business code not `0` | `ERROR` | Yes |
| Invalid JSON / empty data / malformed fields | `ERROR` | Yes |

Errors are sanitized. Provider response bodies, secrets, passphrases, and auth signatures are never forwarded.

## Phase A verification

`pnpm run simulation:test` covers authentication prehash/signature stability, exact raw body, atomic value conversion, chain index `196`, the Testnet no-call boundary, success normalization, asset directions, fail reason, risks, empty risk semantics, missing credentials, timeout, HTTP/business/malformed failures, RPC disagreement, AI fact immutability, and deterministic-floor preservation.

No real OKX API call, wallet interaction, signature, broadcast, contract deployment, or chain mutation is performed in Phase A.

## Live Preview verification

One real read-only request was completed through the protected Vercel Preview after the project owner configured Preview-scoped credentials. No wallet was connected, no transaction was signed or broadcast, and no chain state was changed.

| Evidence | Observed value |
| --- | --- |
| UTC request timestamp | `2026-08-21T08:55:53.390Z` |
| Deployment | `dpl_4j6zppThr9tcGaF4sB2pEwSWJF6k` |
| Preview URL | `https://xguard-ai-git-codex-v4-okx-simulation-leafwithereds-projects.vercel.app` |
| Analysis network | `XLAYER_MAINNET` |
| Chain ID / chainIndex | `196` / `"196"` |
| Provider | `OKX_ONCHAINOS` |
| Provider HTTP / business code | `200` / `"0"` |
| Simulation status | `AVAILABLE` |
| Intention | `Send Token` |
| Asset changes | `0` |
| Gas used | returned |
| Failure reason | none |
| Risk entries | `0` — not interpreted as proof of safety |
| Evidence consistency | `CONSISTENT` |
| Final analysis | `8 LOW`, `HYBRID` |
| RPC / Simulation / AI / total | `291 ms` / `394 ms` / `5,232 ms` / `5,643 ms` |
| End-to-end CLI wall time | `12,524 ms` including CLI startup and protected Preview access |
| Runtime response | `/api/analyze` returned `200`; no error or `5xx` log entry |

Live latency sample count is `1`. Simulation median and slowest observed are therefore both `394 ms`; no p95 is claimed from a single sample.

Only sanitized status and timing fields are recorded. No credential value, authentication header, signature, raw secret, or private response metadata was written to Git, logs, or documentation.

## Credential handoff gate — completed for Preview

The project owner configured these server-side variable names in Preview:

- `OKX_API_KEY`
- `OKX_SECRET_KEY`
- `OKX_API_PASSPHRASE`

Local placement: `.env.local`.

Vercel placement: **Project → Settings → Environment Variables → Preview**. Do not add them to Production during the Preview verification stage.

The project owner supplied the required confirmation, and the real read-only verification above passed. Credentials remain Preview-scoped; Production is unchanged.

## Official references

- [OKX OnchainOS — Simulate Transactions](https://web3.okx.com/onchainos/dev-docs/trade/onchain-gateway-api-simulate-transaction)
- [OKX OnchainOS — Authentication](https://web3.okx.com/onchainos/dev-docs/home/api-access-and-usage)
- [OKX OnchainOS — Get Supported Chains](https://web3.okx.com/onchainos/dev-docs/trade/onchain-gateway-api-chains)
- [X Layer network information](https://web3.okx.com/onchainos/dev-docs/xlayer/developer/build-on-xlayer/network-information)
