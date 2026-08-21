# XGuard X Layer Mainnet Receipt Anchor

The Phase A anchor adds one narrow X Layer-native claim to the existing trust pipeline:

`Evidence → Receipt Integrity → Deployment-key Authenticity → Deterministic Policy → X Layer Mainnet Receipt Anchor`

## Exact digest semantics

The contract anchors the existing V5 Analysis Receipt SHA-256 digest. For a fingerprint `sha256:<64 lowercase hex characters>`, XGuard removes only the literal `sha256:` prefix and interprets the remaining 64 hex characters directly as Solidity `bytes32`.

No second hash is applied. The fingerprint string is not hashed. SHA-256 is not replaced by keccak256. [`receiptFingerprintToBytes32`](../lib/anchor.ts) requires the exact lowercase format and fails closed.

## Contract

[`XGuardReceiptAnchor.sol`](../contracts/XGuardReceiptAnchor.sol) contains only:

- `mapping(bytes32 => bool) public anchored`
- `anchor(bytes32 receiptDigest)`
- `ReceiptAnchored(receiptDigest, submitter, timestamp)`

Zero digest reverts. Duplicate explicit anchors remain safe: the mapping stays true and another event may be emitted. The contract does not establish receipt ownership.

It has no owner, admin, upgrade mechanism, custody, withdrawal, fee, arbitrary external call, delegatecall, selfdestruct, proxy, batching, or Merkle structure. It cannot receive OKB through the anchor function.

## Trust boundaries

`X LAYER ANCHOR CONFIRMED` proves only that a confirmed X Layer Mainnet transaction called the configured anchor contract with the exact V5 receipt digest.

It does not prove transaction safety, provider truth, execution of the analyzed transaction, address ownership, OKX endorsement, or XGuard authorship. V5 verifies receipt content integrity. V6 separately verifies XGuard deployment-key authorship. V7 policy remains an adjacent deterministic integration recommendation and is not cryptographically included in the anchor.

## Eligibility

The competition UI permits an anchor transaction only when all conditions hold:

1. A current Analysis Receipt exists on X Layer Mainnet, Chain 196.
2. Receipt Integrity is `INTEGRITY VERIFIED`.
3. XGuard Attestation is `ATTESTATION VERIFIED` and binds the same fingerprint.
4. The fingerprint parses to a non-zero exact SHA-256 `bytes32` digest.
5. A real anchor contract address is configured.

Policy does not determine eligibility. `BLOCK_RECOMMENDED` evidence may still be anchored because anchoring records evidence rather than endorsing a transaction.

## Verification and wallet flow

`Verify On-chain Anchor` is an explicit read-only action using public X Layer Mainnet RPC. A true `anchored(digest)` result becomes `CONFIRMED`; false becomes `NOT_ANCHORED`; RPC errors become `UNAVAILABLE`/`FAILED`, never a false negative.

The transaction path requires separate explicit actions: Connect Wallet, Switch wallet to X Layer Mainnet, and Anchor Receipt. Initial render, refresh, Judge navigation, eligibility, and read-only verification never request wallet accounts, network switching, signing, or broadcasting.

## Predeployment configuration

Phase A intentionally has no deployed address. `NEXT_PUBLIC_XGUARD_MAINNET_ANCHOR_ADDRESS` is absent and the application displays `NOT CONFIGURED`. A missing, malformed, or zero address fails closed. Only the real public address from the human-signed deployment may be configured in the follow-up phase.
