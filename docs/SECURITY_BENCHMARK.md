# XGuard V3 Security Benchmark

This benchmark is a deterministic, reproducible corpus for XGuard's pre-sign security invariants. It contains **34 meaningful cases** across transaction decoding, permission consequences, X Layer RPC isolation, AI failure handling, stale-state protection, risk fusion, and Intent vs Reality.

## Run it

```bash
pnpm install --frozen-lockfile
pnpm run security-benchmark:test
```

Run the focused V3 suites separately:

```bash
pnpm run consequence:test
pnpm run intent:test
```

## Corpus

| # | Security case | Expected invariant |
| ---: | --- | --- |
| 01 | Safe native transfer | Remains LOW without invented risk |
| 02 | Large native transfer | Deterministic risk increases |
| 03 | Zero-address transfer | Critical signal is preserved |
| 04 | ERC20 transfer | Method is decoded |
| 05 | Finite ERC20 approval | Finite scope remains distinguishable |
| 06 | Unlimited ERC20 approval | Unlimited permission is critical |
| 07 | `transferFrom` | Existing allowance use is explained |
| 08 | `setApprovalForAll(true)` | Collection-wide permission is critical |
| 09 | `setApprovalForAll(false)` | Revocation is described accurately |
| 10 | Unknown selector | Unsupported behavior is labeled |
| 11 | Malformed known calldata | Arguments are not guessed |
| 12 | Empty calldata | Native-value path is used |
| 13 | EOA target | Empty bytecode is reported as EOA |
| 14 | Contract target | Bytecode is reported as smart contract |
| 15 | EIP-1967 implementation slot | Evidence is scoped to EIP-1967 |
| 16 | Preflight success | Bounded `eth_call` success is reported |
| 17 | Preflight revert | Revert is not labeled safe |
| 18 | Gas estimate unavailable | Other RPC evidence remains usable |
| 19 | RPC unavailable | Local Analysis still works |
| 20 | AI unavailable | Local Analysis still works |
| 21 | Malformed AI response | Invalid provider output is rejected |
| 22 | AI below deterministic floor | Final risk cannot decrease |
| 23 | AI above deterministic floor | AI may raise advisory risk |
| 24 | Stale input | Analysis is invalidated immediately |
| 25 | Stale recording prevention | No active result remains recordable |
| 26 | Intent MATCH | Exact native intent and value match |
| 27 | Intent MISMATCH | Finite intent vs unlimited approval |
| 28 | Intent MISMATCH | Claim intent vs NFT operator grant |
| 29 | Intent UNKNOWN | Ambiguous intent is not invented |
| 30 | Unsupported consequence | Unknown selector is never falsely described |
| 31 | Token metadata unavailable | Identity and decimals are not fabricated |
| 32 | Consequence determinism | Consequences do not depend on AI |
| 33 | Intent mismatch safety floor | AI cannot downgrade deterministic mismatch |
| 34 | Missing on-chain evidence | RPC observations are not fabricated |

## Security invariants

- **PASS:** AI cannot reduce deterministic risk.
- **PASS:** RPC failure cannot disable Local Analysis.
- **PASS:** AI failure cannot disable Local Analysis.
- **PASS:** stale analysis cannot be recorded.
- **PASS:** unsupported calldata is never falsely decoded.
- **PASS:** unavailable evidence is never fabricated.
- **PASS:** deterministic consequences do not depend on AI.
- **PASS:** intent analysis cannot lower deterministic risk.
- **PASS:** deterministic intent mismatch cannot be downgraded by AI.

The corpus uses local fixtures only. It does not connect a wallet, request a signature, broadcast a transaction, deploy a contract, or require a live AI/RPC credential.
