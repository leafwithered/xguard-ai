# Deployment Guide

## Prerequisites

- Node.js and npm
- A user-controlled EVM wallet
- X Layer Testnet OKB
- Optional official or third-party OpenAI-compatible AI provider credentials

## Contract

1. Copy `.env.example` to `.env.local` or provide deployment variables in the shell.
2. Set `XLAYER_RPC_URL` to an official X Layer Testnet RPC.
3. Set `DEPLOYER_PRIVATE_KEY` only in the local secret environment.
4. Run `npm run contract:compile` and `npm run contract:test`.
5. Run `npm run contract:deploy`.
6. The verified X Layer Testnet deployment is `0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`.
7. The deployment transaction is `0xf4169572833b69bb7a5cb234d092f7ab1b27e15d2520e6544591c2358533c75b`.
8. Set `NEXT_PUBLIC_RISK_REGISTRY_ADDRESS` to the deployed address.

## Public deployment

- Website URL: `https://xguard-ai-six.vercel.app`
- Deployment provider: `Vercel`
- Source repository: `https://github.com/leafwithered/xguard-ai`
- Final Judge Upgrade core application baseline: commit `409aa73c211a6b350af757d130c3f41ac8cfe962`
- Canonical Production URL is the durable deployment reference; Vercel deployment IDs are transient
- Historical pre-polish Production deployment: `dpl_KkyED1sN18hK4QXjzLZnuNYoeamC` (`Ready` at verification time)
- Production Hybrid Analysis smoke test: passed through the server-configured OpenAI-compatible provider adapter
- Historical stable Production smoke matrix (pre-V3.1): Safe `8 LOW`, Unlimited Approval `72 HIGH`, Suspicious Airdrop `100 HIGH`
- Provider identity: intentionally not asserted by public artifacts; `AI_BASE_URL` and `AI_MODEL` remain server-side deployment configuration
- Local Analysis remains the failure-isolated fallback

### V4 live-verified Preview boundary

The `codex/v4-okx-simulation` branch is based on frozen V3 commit `04575cc764163c7cb99b948c050e974e4cd20a2e`. It is not Production. The canonical Production URL, V1 `RiskRegistry`, and verified receipt remain unchanged.

- Testnet `1952`: existing `XLAYER_RPC_URL` intelligence/preflight; OKX simulation is deterministically `UNSUPPORTED` and is never requested.
- Mainnet `196`: `XLAYER_MAINNET_RPC_URL` intelligence/preflight plus optional OKX OnchainOS Transaction Simulation using chain index `196`.
- Preview can deploy without OKX credentials; Mainnet simulation is then visibly `UNAVAILABLE` while the remaining analysis continues.
- The owner configured Preview-only `OKX_API_KEY`, `OKX_SECRET_KEY`, and `OKX_API_PASSPHRASE` after the explicit credential gate.
- Four real read-only Mainnet samples returned provider HTTP `200`, business code `0`, and normalized status `AVAILABLE`; the matrix median was `376 ms`, the slowest sample was `492 ms`, and sanitized evidence is recorded in `docs/V4_OKX_SIMULATION.md`.
- Credentials remain Preview-scoped. Do not configure or merge V4 into Production without a separate explicit release approval.

### V3 Stable evidence architecture inherited by V4

The frozen V3 baseline orders analysis as deterministic decode/risk → RPC intelligence/preflight → consequences → normalized evidence → deterministic confidence/verdict/execution → one optional AI advisory call → intent comparison and safety fusion. Unknown or malformed calldata is always `LOW` confidence and `UNDETERMINED`, even when its heuristic risk score is LOW. V4 inherits this architecture on its isolated Preview branch.

The public client can verify Hybrid versus Local mode, but it cannot prove the identity of the server-configured upstream AI provider. Deployment documentation therefore remains provider-neutral unless deployment-side evidence is explicitly audited; no API secret is exposed for that verification.

V3.1 additionally performs bounded ERC165 checks for ERC721 and ERC1155 on smart-contract targets. Only a positive interface result establishes that standard; negative or unavailable results remain `UNKNOWN` and never imply ERC20. Responses include deterministic confidence reasons and phase timings for latency audit.

The V3.1.1 Preview release gate uses this final Judge matrix:

- Safe Transfer: LOW deterministic baseline, Intent MATCH, and HIGH confidence when complete RPC evidence supports it.
- Ambiguous Approval: shared `approve(address,uint256)` selector, standard UNKNOWN, LOW confidence, `UNDETERMINED`, and no unlimited ERC20 claim.
- Suspicious Airdrop: non-zero ERC721 contract target, `0 OKB`, decoded `setApprovalForAll(true)`, CLAIM-versus-operator-permission `MISMATCH`, and deterministic HIGH floor.

V4 remains Preview-only until a separate release approval. The canonical URL, contract, verified receipt, and demo file path remain unchanged.

## Verified deployment

- Network: X Layer Testnet
- Chain ID: `1952`
- Contract: `0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`
- Deployment transaction: `0xf4169572833b69bb7a5cb234d092f7ab1b27e15d2520e6544591c2358533c75b`
- Explorer: https://www.okx.com/web3/explorer/xlayer-test/address/0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5
- Receipt status: success; deployed bytecode present

## Safe dry run

Before testnet OKB or a private key is available, run:

```bash
npm run contract:compile
npm run contract:test
npm run contract:deploy
```

The final command must stop with `DEPLOYER_PRIVATE_KEY is required...` when no local key is configured. The command must not be rerun against the already verified deployment unless a new deployment is explicitly approved.

## Web App

1. Add `AI_API_KEY`, `AI_BASE_URL`, and `AI_MODEL` to the deployment provider if provider-backed Hybrid Analysis is desired.
2. Add `NEXT_PUBLIC_RISK_REGISTRY_ADDRESS`.
3. Deploy the Next.js application.
4. Verify the production app loads, provider-backed Hybrid Analysis works when provider variables are configured, Local Analysis remains available as fallback, the wallet can switch to Chain ID `1952`, and the existing registry transaction opens in the explorer.

`XLAYER_RPC_URL` is also used server-side for Contract Intelligence, Transaction Preflight, and post-hoc transaction inspection. Transaction Preflight consists of bounded `eth_call` and `eth_estimateGas` checks; it is not full state-diff simulation. RPC timeouts or failures must not disable deterministic risk analysis.

## Evidence

- Contract address: `0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`
- Deployment transaction hash: `0xf4169572833b69bb7a5cb234d092f7ab1b27e15d2520e6544591c2358533c75b`
- Explorer link: `https://www.okx.com/web3/explorer/xlayer-test/address/0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`
- Website URL: `https://xguard-ai-six.vercel.app`
- Deployment provider: `Vercel`

## Verified real interaction

- Network / Chain ID: X Layer Testnet / `1952`
- Contract address: `0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`
- Method called: `recordAssessment(bytes32,uint8)`
- User interaction transaction: `0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb`
- Receipt status: success (`0x1`)
- Confirmed event: `RiskAssessmentRecorded` with risk score `12`
- Explorer link: `https://www.okx.com/web3/explorer/xlayer-test/tx/0x1492bc179e98fe5fe79add3528f8f1f26990ab37e189a98d4c4a052d6fd11bcb`
