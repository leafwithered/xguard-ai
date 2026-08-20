// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract RiskRegistry {
    struct Assessment {
        address user;
        uint8 riskScore;
        uint256 timestamp;
    }

    mapping(bytes32 => Assessment) public assessments;

    event RiskAssessmentRecorded(bytes32 indexed analysisHash, address indexed user, uint8 riskScore, uint256 timestamp);

    function recordAssessment(bytes32 analysisHash, uint8 riskScore) external {
        require(analysisHash != bytes32(0), "analysis hash required");
        require(riskScore <= 100, "risk score out of range");
        assessments[analysisHash] = Assessment(msg.sender, riskScore, block.timestamp);
        emit RiskAssessmentRecorded(analysisHash, msg.sender, riskScore, block.timestamp);
    }
}
