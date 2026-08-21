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
- Final Judge Upgrade: live from `main` commit `409aa73c211a6b350af757d130c3f41ac8cfe962`
- Production deployment: `dpl_KkyED1sN18hK4QXjzLZnuNYoeamC` (`Ready`)
- Production Hybrid Analysis smoke test: passed through the server-configured OpenAI-compatible provider adapter
- Final smoke matrix: Safe `8 LOW`, Unlimited Approval `72 HIGH`, Suspicious Airdrop `100 HIGH`
- Provider identity: intentionally not asserted by public artifacts; `AI_BASE_URL` and `AI_MODEL` remain server-side deployment configuration
- Local Analysis remains the failure-isolated fallback

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
