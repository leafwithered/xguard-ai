# Human-Executed X Layer Mainnet Anchor Deployment

This guide stops before signing. Deployment must be reviewed and executed personally in a browser wallet such as OKX Wallet. Never export or paste a private key, seed phrase, mnemonic, wallet password, or signing secret into a terminal, repository, website form, or model conversation.

## Review manifest

- Contract: `XGuardReceiptAnchor`
- Source: `contracts/XGuardReceiptAnchor.sol`
- Solidity: `0.8.24`
- EVM target: Paris
- Optimizer: enabled, `200` runs
- Constructor arguments: none
- Network: X Layer Mainnet
- Chain ID: `196` (`0xc4`)
- Currency: OKB
- Primary RPC: `https://rpc.xlayer.tech`
- Fallback RPC: `https://xlayerrpc.okx.com`
- Explorer: `https://www.okx.com/web3/explorer/xlayer`

The expected deployed behavior is limited to rejecting zero digests, setting `anchored[digest] = true`, and emitting `ReceiptAnchored(digest, msg.sender, block.timestamp)`. The contract has no owner or privileged control.

## Safe browser-wallet procedure

1. Review the exact committed source and compiled artifact locally.
2. Open the chosen audited browser deployment interface and select Solidity `0.8.24`, optimizer enabled, 200 runs, with no constructor arguments.
3. In OKX Wallet, explicitly select **X Layer Mainnet** and independently confirm Chain ID `196` before opening a signature request.
4. Compare the interface bytecode with the locally compiled deployment bytecode. Do not proceed if it differs.
5. Review the wallet gas estimate and total OKB cost. Stop if the network, bytecode, constructor, sender, or cost is unexpected.
6. Personally confirm the deployment transaction in the wallet.
7. After confirmation, record the public contract address and deployment transaction hash.
8. Open both on `https://www.okx.com/web3/explorer/xlayer` and verify Chain 196, successful status, deployed bytecode, and the expected sender.
9. Only after independent review, configure the real public address for the anchor branch and create a new Preview.

STOP immediately if the wallet displays any network other than X Layer Mainnet / Chain 196, requests value transfer, shows constructor data, or displays bytecode inconsistent with the compiled artifact.

Phase A does not deploy, sign, broadcast, query a wallet balance, or configure a placeholder address.
