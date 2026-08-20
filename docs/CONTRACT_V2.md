# RiskRegistry V2 Proposal

The deployed `RiskRegistry` remains unchanged at `0xf4505A4e8dEca4659b8A2054555788Ddc1f5AcE5`. This document is a design proposal only. No V2 contract has been deployed, and the verified V1 evidence remains canonical.

## Current behavior

V1 stores `mapping(bytes32 => Assessment)`. Reusing an `analysisHash` overwrites the previous assessment. Events preserve historical logs, but the direct storage lookup only exposes the latest write.

## Options

| Option | Design | Gas | UX | Auditability | Compatibility |
| --- | --- | --- | --- | --- | --- |
| A | Reject a duplicate hash | Lowest incremental storage | Simple, but retries and multi-user reviews can revert | Strong uniqueness | Smallest API change; behavior changes on duplicates |
| B | Append-only assessment ID | One new record per write plus hash/index lookup | Clear receipt IDs and pagination | Strongest ordered history | New read API and event fields required |
| C | `hash => Assessment[]` | One array append per write | Natural per-analysis history | Strong per-hash history, weaker global discovery | Existing mapping getter must be replaced or retained separately |

## Recommendation

Use **Option B** for a future audited V2: an incrementing `assessmentId`, append-only `mapping(uint256 => Assessment)`, and `mapping(bytes32 => uint256[])` for analysis history. This makes overwrites impossible and gives each receipt a stable identifier. The tradeoff is higher storage gas and a new interface.

Suggested properties:

- Keep `recordAssessment(bytes32,uint8)` nonpayable and user-authorized.
- Store `analysisHash`, `user`, `riskScore`, and timestamp for every ID.
- Emit the ID and hash in an append-only event.
- Reject a zero hash and scores above 100.
- Add paginated reads rather than returning unbounded arrays.
- Treat V1 and V2 as separate registries; never mutate or hide V1 evidence.

Deployment requires explicit user approval, a separate security review, and new testnet evidence. It is not part of the current V2 application upgrade.
