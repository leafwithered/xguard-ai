# XGuard V3 Security Benchmark

This benchmark is a deterministic, reproducible corpus for XGuard's pre-sign security invariants. It contains **57 meaningful cases**: 34 focused corpus cases, 11 integration cases through the real analysis pipeline, and 12 V3.1 semantic/adversarial cases. It covers transaction decoding, permission consequences, token-standard evidence, X Layer RPC isolation, evidence ordering, hostile intent data, AI failure handling, stale-state protection, risk fusion, confidence, execution, verdict, and Intent vs Reality.

The `0–100` Risk Score is a deterministic heuristic severity score. It is not a probability of maliciousness, a statistically calibrated fraud probability, an audit result, or a safety guarantee. No precision, recall, false-positive, or false-negative claim is made without a trustworthy labeled dataset.

## Run it

```bash
pnpm install --frozen-lockfile
pnpm run security-benchmark:test
```

Run the focused V3 suites separately:

```bash
pnpm run consequence:test
pnpm run intent:test
pnpm run pipeline:test
pnpm run token-standard:test
```

## Corpus

| # | Security case | Expected invariant |
| ---: | --- | --- |
| 01 | Safe native transfer | Remains LOW without invented risk |
| 02 | Large native transfer | Deterministic risk increases |
| 03 | Zero-address transfer | Critical signal is preserved |
| 04 | ERC20 transfer | Method is decoded |
| 05 | Approval raw uint256 | Preserved without claiming a finite ERC20 allowance |
| 06 | Approval maxUint256 | Not called unlimited ERC20 without standard evidence |
| 07 | `transferFrom` | ERC20 units versus ERC721 token ID remains explicit |
| 08 | `setApprovalForAll(true)` | Contract-wide permission is critical without standard overclaim |
| 09 | `setApprovalForAll(false)` | Contract-wide revocation is described accurately |
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
| 27 | Approval intent under ambiguity | No finite/unlimited comparison without trusted ERC20 semantics |
| 28 | Intent MISMATCH | Claim intent vs NFT operator grant |
| 29 | Intent UNKNOWN | Ambiguous intent is not invented |
| 30 | Unsupported consequence | Unknown selector is never falsely described |
| 31 | Token metadata unavailable | Identity and decimals are not fabricated |
| 32 | Consequence determinism | Consequences do not depend on AI |
| 33 | Intent mismatch safety floor | AI cannot downgrade deterministic mismatch |
| 34 | Missing on-chain evidence | RPC observations are not fabricated |

## Evidence-first pipeline integration cases

| Case | Security scenario | Final analysis invariant |
| --- | --- | --- |
| A | Unknown selector + AI LOW + RPC available | LOW heuristic risk may remain, but confidence is LOW and verdict is UNDETERMINED |
| B | Malformed known calldata + AI LOW | Confidence is LOW, verdict is UNDETERMINED, and arguments are not guessed |
| C | Safe native transfer + successful RPC | LOW known risk, HIGH confidence, ASSESSED, execution SUCCEEDED |
| D | Known safe transaction + RPC unavailable | Local Analysis works, confidence is reduced, execution is UNAVAILABLE |
| E | Local LOW + preflight revert | Execution is REVERTED without an arbitrary malicious-risk increase or success wording |
| F | EIP-1967 implementation observed | Scoped proxy fact is shown, score is unchanged solely for proxy architecture, confidence is capped |
| G | AI evidence payload | AI receives address type, code facts, preflight, gas/RPC state, and on-chain consequences |
| H | AI below deterministic floor | The deterministic risk floor is preserved |
| I | AI unavailable | Confidence, verdict, execution, and deterministic report remain available |
| J | Unknown behavior + confident benign AI | AI cannot promote confidence or verdict |
| K | Adversarial AI consequence narrative | Final consequences remain byte-for-byte independent of AI availability/output |

## V3.1 semantic and adversarial cases

| # | Case | Invariant |
| ---: | --- | --- |
| 01 | `approve(address,uint256)` ambiguity | Signature is decoded without assuming ERC20 |
| 02 | `transferFrom(address,address,uint256)` ambiguity | Raw uint256 is not assumed to be fungible units |
| 03 | Positive ERC721 approval evidence | uint256 becomes an ERC721 token ID only after positive evidence |
| 04 | Positive ERC721 transfer evidence | transferFrom uint256 becomes an ERC721 token ID only after positive evidence |
| 05 | ERC165 unavailable | Standard remains UNKNOWN |
| 06 | Ambiguous maxUint256 approval | No automatic unlimited-allowance claim or critical signal |
| 07 | `setApprovalForAll` | Wording remains ERC721/ERC1155-neutral unless evidence exists |
| 08 | Native value to EOA | Consequence states externally owned account |
| 09 | Native value to contract | Consequence warns about receive/fallback uncertainty |
| 10 | Hostile context + deterministic mismatch | AI cannot lower the floor or erase mismatch |
| 11 | Hostile AI narrative | Confidence, verdict, execution, and decoded facts remain deterministic |
| 12 | Human token amount vs raw uint256 | No comparison without trusted token identity/decimals |

## Intent mismatch floor policy

| Mismatch type | Floor | Rationale |
| --- | ---: | --- |
| Claim intent → asset permission/exercise | 78 | Critical semantic contradiction that may grant or exercise authority instead of claiming |
| Finite approval → confirmed unlimited ERC20 allowance | 78 | Material expansion of spending authority; applies only with trusted ERC20 semantics |
| Revoke intent → permission grant | 78 | Reverses the user's safety goal |
| Native OKB amount mismatch | 65 | Known 18-decimal value differs from the user's stated amount |
| Other deterministic action mismatch | 65 | Encoded action contradicts the stated action and requires review |

The policy deliberately uses two explainable floors rather than assigning a unique arbitrary weight to every sentence. ERC20 human amounts are never compared with raw uint256 values without trusted token identity and decimals.

## Latency budget

The evidence-first pipeline remains sequential: bounded X Layer RPC intelligence runs before optional AI enrichment. V3.1 gives Responses and compatibility-only Chat fallback one shared **15-second** provider budget. A Responses network error or timeout falls back directly to Local Analysis; it does not stack another provider timeout. Explicit endpoint-compatibility responses may use the remaining shared budget for Chat Completions. This preserves provider neutrality and the deterministic safety path while bounding degraded-mode latency.

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
- **PASS:** AI receives normalized on-chain and preflight evidence before advisory analysis.
- **PASS:** unknown/malformed behavior cannot be presented as confidently safe.
- **PASS:** risk, confidence, execution, and verdict remain independent dimensions.
- **PASS:** a preflight revert or EIP-1967 observation does not add arbitrary malicious-risk points.
- **PASS:** shared ERC20/ERC721 selectors do not create unsupported fungible-token claims.
- **PASS:** positive ERC165 evidence can establish ERC721/ERC1155; negative evidence never establishes ERC20.
- **PASS:** hostile context is treated as untrusted data and cannot modify deterministic dimensions or facts.

The corpus uses local fixtures only. It does not connect a wallet, request a signature, broadcast a transaction, deploy a contract, or require a live AI/RPC credential.
