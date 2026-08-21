// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract XGuardReceiptAnchor {
    mapping(bytes32 => bool) public anchored;

    event ReceiptAnchored(bytes32 indexed receiptDigest, address indexed submitter, uint256 timestamp);

    function anchor(bytes32 receiptDigest) external {
        require(receiptDigest != bytes32(0), "receipt digest required");
        anchored[receiptDigest] = true;
        emit ReceiptAnchored(receiptDigest, msg.sender, block.timestamp);
    }
}
