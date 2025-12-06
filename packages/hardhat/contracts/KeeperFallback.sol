// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @notice Minimal interfaces for the Aequitas contracts we need to call
interface IAequitasCore {
    function currentBatchId() external view returns (uint256);
    // Batch struct: (id, status, closeTime, clearingPrice, solver, challengeEndTime)
    function batches(uint256) external view returns (
        uint256 id, uint8 status, uint256 closeTime, uint256 clearingPrice, address solver, uint256 challengeEndTime
    );
    function closeCurrentBatch() external;
    function finalizeBatch(uint256 batchId) external;
}

interface IMockShutter {
    function hasKey(uint256 batchId) external view returns (bool);
    function publishKey(uint256 batchId, string calldata key) external;
}

/// @title KeeperFallback
/// @dev Lightweight on-chain keeper helper that allows anyone to trigger close/publish/finalize
contract KeeperFallback {
    IAequitasCore public immutable core;
    IMockShutter public immutable shutter;
    address public owner;
    uint256 public callerRewardWei; // optional reward for the caller (in wei)

    event CloseTriggered(uint256 indexed batchId, address indexed caller);
    event KeyPublished(uint256 indexed batchId, address indexed caller);
    event FinalizeTriggered(uint256 indexed batchId, address indexed caller);
    event CallerRewardChanged(uint256 newRewardWei);
    event OwnerChanged(address newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor(address _core, address _shutter, uint256 _callerRewardWei) {
        require(_core != address(0) && _shutter != address(0), "zero address");
        core = IAequitasCore(_core);
        shutter = IMockShutter(_shutter);
        owner = msg.sender;
        callerRewardWei = _callerRewardWei;
    }

    /// @notice Set reward for callers who trigger actions (owner only).
    function setCallerReward(uint256 _wei) external onlyOwner {
        callerRewardWei = _wei;
        emit CallerRewardChanged(_wei);
    }

    /// @notice Allow owner to change owner
    function setOwner(address _new) external onlyOwner {
        require(_new != address(0), "zero");
        owner = _new;
        emit OwnerChanged(_new);
    }

    /// @notice Deposit ETH so the contract can pay caller rewards
    receive() external payable {}

    /// @notice Withdraw ETH from contract (owner)
    function withdraw(uint256 amount) external onlyOwner {
        payable(owner).transfer(amount);
    }

    /// -----------------------------------------------------------------------
    /// 🔁 Single entry-point used by the Sentinel UI: keeperNudge()
    /// -----------------------------------------------------------------------
    /// It inspects the current batch and:
    ///  - if OPEN      -> closes it (only if closeTime passed)
    ///  - if CLOSED    -> publishes key (if missing)
    ///  - if PROPOSED  -> finalizes (only if challenge window passed)
    /// Returns true if it actually did something, false if it was a no-op.
    /// @dev UPDATED: Non-reverting version. If time conditions aren't met, returns false.
    function keeperNudge() external returns (bool) {
        uint256 batchId = core.currentBatchId();
        (, uint8 status, uint256 closeTime, , , uint256 challengeEndTime) = core.batches(batchId);

        // If OPEN and closeTime reached → close batch
        if (status == 0 && block.timestamp >= closeTime) {
            core.closeCurrentBatch();
            _payCallerReward();
            emit CloseTriggered(batchId, msg.sender);
            return true;
        }

        // If CLOSED and key missing → publish key
        if (status == 1) {
            bool has = shutter.hasKey(batchId);
            if (!has) {
                shutter.publishKey(batchId, "auto-key-keeper");
                _payCallerReward();
                emit KeyPublished(batchId, msg.sender);
                return true;
            }
            return false;
        }

        // If PROPOSED and challenge window ended → finalize
        if (status == 2 && block.timestamp >= challengeEndTime) {
            core.finalizeBatch(batchId);
            _payCallerReward();
            emit FinalizeTriggered(batchId, msg.sender);
            return true;
        }

        // Otherwise: nothing to do — just return false (no revert)
        return false;
    }

    /// @notice Try to close the current batch if it's open and closeTime passed.
    /// Anyone can call; pays reward to caller if configured and available.
    function triggerCloseIfNeeded() external returns (bool ok) {
        uint256 batchId = core.currentBatchId();
        (, uint8 status, uint256 closeTime, , , ) = core.batches(batchId);

        // status: 0 = OPEN, 1 = CLOSED, 2 = PROPOSED, 3 = FINALIZED, 4 = REVERTED
        require(status == 0, "not open");
        require(block.timestamp >= closeTime, "closeTime not reached");

        core.closeCurrentBatch(); // calls the core's close function

        _payCallerReward();

        emit CloseTriggered(batchId, msg.sender);
        return true;
    }

    /// @notice Publish key if batch is CLOSED and key doesn't exist. Caller provides the key string.
    function triggerPublishKeyIfMissing(uint256 batchId, string calldata key) external returns (bool) {
        (, uint8 status, , , , ) = core.batches(batchId);
        require(status == 1, "batch not closed");

        bool has = shutter.hasKey(batchId);
        require(!has, "key exists");

        shutter.publishKey(batchId, key);

        _payCallerReward();
        emit KeyPublished(batchId, msg.sender);
        return true;
    }

    /// @notice Finalize a proposed batch once the challenge window expired.
    function triggerFinalizeIfNeeded(uint256 batchId) external returns (bool) {
        (, uint8 status, , , , uint256 challengeEndTime) = core.batches(batchId);
        require(status == 2, "not proposed");
        require(block.timestamp >= challengeEndTime, "challenge not ended");

        core.finalizeBatch(batchId);

        _payCallerReward();
        emit FinalizeTriggered(batchId, msg.sender);
        return true;
    }

    /// @dev internal helper to pay the caller if reward configured and contract has funds
    function _payCallerReward() internal {
        uint256 r = callerRewardWei;
        if (r > 0 && address(this).balance >= r) {
            payable(msg.sender).transfer(r);
        }
    }
}