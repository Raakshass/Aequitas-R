// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title ReversibleVault
 * @notice Holds assets in a "Schrödinger's State" (Proposed vs Finalized).
 * @dev Funds are moved internally but "frozen" until the Settlement Engine finalizes the batch.
 */
contract ReversibleVault is Ownable, ReentrancyGuard, Pausable {
    
    IERC20 public immutable asset;
    
    // The address of the AequitasCore contract (set after deployment)
    address public settlementEngine;
    
    // Mapping: User -> Total Balance (Available + Frozen)
    mapping(address => uint256) public internalBalance;
    
    // Mapping: User -> Frozen Amount (Cannot withdraw)
    mapping(address => uint256) public frozenBalance;

    event Deposit(address indexed user, uint256 amount);
    event Withdrawal(address indexed user, uint256 amount);
    event FrozenTransfer(address indexed from, address indexed to, uint256 amount);
    event Reverted(address indexed criminal, address indexed victim, uint256 amount);
    event Finalized(address indexed user, uint256 amount);

    modifier onlyEngine() {
        require(msg.sender == settlementEngine, "Caller is not the Settlement Engine");
        _;
    }

    constructor(address _asset) Ownable(msg.sender) {
        asset = IERC20(_asset);
    }

    /// @notice Connect the Settlement Engine (AequitasCore)
    function setSettlementEngine(address _engine) external onlyOwner {
        settlementEngine = _engine;
    }

    // --- USER ACTIONS ---

    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        require(asset.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        internalBalance[msg.sender] += amount;
        emit Deposit(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        // Critical Invariant: Can only withdraw funds that are NOT frozen
        uint256 available = internalBalance[msg.sender] - frozenBalance[msg.sender];
        require(amount <= available, "Funds are frozen in challenge window");
        
        internalBalance[msg.sender] -= amount;
        require(asset.transfer(msg.sender, amount), "Transfer failed");
        emit Withdrawal(msg.sender, amount);
    }

    // --- SETTLEMENT ENGINE ACTIONS (Protected) ---

    // Move funds, but lock them in the receiver's account
    function internalTransfer(address from, address to, uint256 amount) external onlyEngine {
        require(internalBalance[from] >= amount, "Insufficient internal balance");
        
        // Deduct from Sender
        internalBalance[from] -= amount;
        
        // Add to Receiver
        internalBalance[to] += amount;
        
        // Mark as Frozen for Receiver (Reversible State)
        frozenBalance[to] += amount;
        
        emit FrozenTransfer(from, to, amount);
    }

    // Undo a transfer (Dispute resolution)
    function revertState(address criminal, address victim, uint256 amount) external onlyEngine {
        // We can only revert if the criminal actually has the funds (frozen or not)
        require(internalBalance[criminal] >= amount, "Criminal has withdrawn funds (CRITICAL BUG)");

        // 1. Take from Criminal
        internalBalance[criminal] -= amount;
        // If they had frozen balance, reduce that too
        if (frozenBalance[criminal] >= amount) {
            frozenBalance[criminal] -= amount;
        } else {
            frozenBalance[criminal] = 0;
        }
        
        // 2. Give back to Victim (Available immediately)
        internalBalance[victim] += amount;
        
        emit Reverted(criminal, victim, amount);
    }

    // Unlock funds (Batch finalized)
    function unlockFunds(address user, uint256 amount) external onlyEngine {
        if (frozenBalance[user] >= amount) {
            frozenBalance[user] -= amount;
        } else {
            frozenBalance[user] = 0;
        }
        emit Finalized(user, amount);
    }

    // --- EMERGENCY CONTROLS ---
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
