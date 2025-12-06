// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockKeyper
 * @notice Simulates a Threshold Encryption Network (like Shutter).
 * @dev In production, this would use BLS signatures. For the Hackathon, we simulate the Key release.
 */
contract MockKeyper is Ownable {

    // Batch ID -> Decryption Key
    mapping(uint256 => string) public batchKeys;
    
    event KeyPublished(uint256 indexed batchId, string key);

    // FIX: Pass msg.sender to Ownable
    constructor() Ownable(msg.sender) {}

    /**
     * @notice The Keyper publishes the key only AFTER the batch is closed.
     * @param batchId The ID of the batch to unlock.
     * @param key The decryption key (simulated as a string).
     */
    function publishKey(uint256 batchId, string calldata key) external {
        // In a real system, we would verify the BLS signature here.
        batchKeys[batchId] = key;
        emit KeyPublished(batchId, key);
    }

    /**
     * @notice Checks if a batch is decryptable.
     */
    function isBatchDecrypted(uint256 batchId) external view returns (bool) {
        // specific check: bytes(str).length > 0
        return bytes(batchKeys[batchId]).length > 0;
    }
}