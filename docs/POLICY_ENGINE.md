# XGuard Deterministic Policy Engine

XGuard V7 turns normalized pre-sign evidence into a machine-readable integration recommendation:

`Evidence → Integrity → Authenticity → Policy Action`

The policy is designed for wallets, dApps, custody layers, transaction gateways, and browser extensions. XGuard never silently connects a wallet, signs, broadcasts, blocks, or mutates a transaction.

## Threat model

The engine addresses unsafe automatic progression when deterministic evidence is high risk, incomplete, unavailable, reverted, inconsistent, or inconsistent with a stated user intent. It does not establish transaction safety, provider truth, blockchain finality, or authorization to sign.

## Identity and versioning

- Policy ID: `xguard-pre-sign-policy-v1`
- Policy version: `1.0.0`
- Analysis Receipt schema: remains `1.0.0`
- Signed Analysis Attestation format: unchanged from V6

Policy output is an adjacent API object. It is not included in or signed by the V5/V6 receipt and attestation formats.

## Deterministic inputs

The pure evaluator accepts only normalized analysis facts: analysis network, deterministic score, confidence, verdict, execution status, stated-intent presence and comparison, evidence consistency, and simulation availability. It performs no network, wallet, provider, environment, time, or random operation.

AI score, AI risk level, AI explanation, AI signals, and `finalScore` are not policy inputs. Changing AI output while deterministic inputs remain identical cannot change the policy result.

## Decision precedence

1. `BLOCK_RECOMMENDED`: deterministic score is at least `70`.
2. `REQUIRE_REVIEW`: below the block threshold, any LOW confidence, UNDETERMINED verdict, reverted or unavailable execution, stated-intent mismatch, inconsistent evidence, or unavailable Mainnet simulation requires review.
3. `WARN`: below stronger thresholds, deterministic score `30–69`, MEDIUM confidence, or stated-intent partial match warns.
4. `ALLOW`: no stronger rule applies.

`ALLOW` does not mean safe. It means: “The configured deterministic XGuard policy does not require additional review based on the currently available normalized evidence.”

## Stable reason codes

- `DETERMINISTIC_HIGH_RISK`
- `DETERMINISTIC_ELEVATED_RISK`
- `LOW_CONFIDENCE`
- `MEDIUM_CONFIDENCE`
- `VERDICT_UNDETERMINED`
- `EXECUTION_REVERTED`
- `EXECUTION_UNAVAILABLE`
- `INTENT_MISMATCH`
- `INTENT_PARTIAL`
- `EVIDENCE_INCONSISTENT`
- `MAINNET_SIMULATION_UNAVAILABLE`
- `ALLOW_BASELINE`

All applicable deterministic reasons are returned in stable canonical order. Decision precedence is independent of the number or order of triggering facts.

## Intent and simulation boundaries

Missing free-text intent does not manufacture risk: `UNKNOWN` or absence alone does not escalate. A normalized `MISMATCH` or `PARTIAL` matters only when the user supplied intent.

On X Layer Mainnet, simulation statuses other than `AVAILABLE` require review. On X Layer Testnet, Mainnet simulation does not participate. `AVAILABLE` only satisfies the availability requirement; it never independently produces `ALLOW`, overrides deterministic risk, or means “OKX says safe.”

`INCONSISTENT` evidence requires review. `NOT_COMPARABLE` does not escalate by itself.

## Integration

Use [`sdk/xguard.ts`](../sdk/xguard.ts) to call `/api/analyze` and validate the returned policy object. See [`examples/wallet-integration.ts`](../examples/wallet-integration.ts) for a pre-sign branch that keeps wallet signature explicit and user-controlled.

Recommended handling:

- `ALLOW`: continue to the normal explicit confirmation UI.
- `WARN`: show a visible warning before explicit confirmation.
- `REQUIRE_REVIEW`: stop automatic progression and require human review.
- `BLOCK_RECOMMENDED`: recommend blocking progression unless an explicitly documented higher-level override policy exists.

Policy actions are deterministic integration recommendations. They are not guarantees of transaction safety.
