// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

/// @title MockShutter
/// @notice Simulated threshold-encryption network for Aequitas-R.
/// @dev In production this would be an external network (Shutter/Ferveo) with BLS keys.
contract MockShutter {
    /// @dev batchId => encrypted blob (opaque bytes from frontend)
    mapping(uint256 => bytes) public encryptedBatches;

    /// @dev batchId => decryption key (plain string for the hackathon demo)
    mapping(uint256 => string) public decryptionKeys;

    event BatchEncrypted(uint256 indexed batchId, bytes ciphertext, address indexed committer);
    event KeyPublished(uint256 indexed batchId, string key, address indexed keyper);

    /// @notice Store encrypted order-flow for a batch.
    /// @param batchId The batch identifier (must match AequitasCore).
    /// @param ciphertext Opaque encrypted data produced client-side.
    function submitEncryptedBatch(uint256 batchId, bytes calldata ciphertext) external {
        // For simplicity, allow overwrite in demo; in prod, require empty slot.
        encryptedBatches[batchId] = ciphertext;
        emit BatchEncrypted(batchId, ciphertext, msg.sender);
    }

    /// @notice Publish the decryption key after the batch is closed.
    /// @dev For the hackathon, this is open; in production, restricted to a Keyper set.
    function publishKey(uint256 batchId, string calldata key) external {
        decryptionKeys[batchId] = key;
        emit KeyPublished(batchId, key, msg.sender);
    }

    /// @notice Returns plaintext-availability status for a batch.
    function hasKey(uint256 batchId) external view returns (bool) {
        return bytes(decryptionKeys[batchId]).length != 0;
    }

    /// @notice Convenience getter used by the off-chain Solver.
    function getBatchPayload(uint256 batchId) external view returns (bytes memory, string memory) {
        return (encryptedBatches[batchId], decryptionKeys[batchId]);
    }
}
