// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CommitReveal {
    struct Order {
        address trader;
        bool isBuy;      // true = buy, false = sell
        uint256 amount;  // quantity
        uint256 price;   // limit price (8 decimals)
        uint256 salt;    // random number for hiding
    }
    
    struct Commitment {
        bytes32 commitHash;
        uint256 bond;
        bool revealed;
    }
    
    // batchId => trader => commitment
    mapping(uint256 => mapping(address => Commitment)) public commitments;
    
    // batchId => revealed orders
    mapping(uint256 => Order[]) public revealedOrders;
    
    uint256 public constant MIN_BOND = 0.01 ether;
    
    event OrderCommitted(uint256 indexed batchId, address indexed trader, bytes32 commitHash);
    event OrderRevealed(uint256 indexed batchId, address indexed trader, Order order);
    
    // Phase 1: Commit
    function commitOrder(uint256 batchId, bytes32 commitHash) external payable {
        require(msg.value >= MIN_BOND, "Insufficient bond");
        require(commitments[batchId][msg.sender].commitHash == bytes32(0), "Already committed");
        
        commitments[batchId][msg.sender] = Commitment({
            commitHash: commitHash,
            bond: msg.value,
            revealed: false
        });
        
        emit OrderCommitted(batchId, msg.sender, commitHash);
    }
    
    // Phase 2: Reveal
    function revealOrder(
        uint256 batchId,
        bool isBuy,
        uint256 amount,
        uint256 price,
        uint256 salt
    ) external {
        Commitment storage commitment = commitments[batchId][msg.sender];
        require(commitment.commitHash != bytes32(0), "No commitment found");
        require(!commitment.revealed, "Already revealed");
        
        // Verify the reveal matches the commitment
        bytes32 computedHash = keccak256(abi.encodePacked(
            msg.sender,
            isBuy,
            amount,
            price,
            salt
        ));
        
        require(computedHash == commitment.commitHash, "Invalid reveal");
        
        // Mark as revealed
        commitment.revealed = true;
        
        // Store the order
        Order memory order = Order({
            trader: msg.sender,
            isBuy: isBuy,
            amount: amount,
            price: price,
            salt: salt
        });
        
        revealedOrders[batchId].push(order);
        
        // Return bond
        payable(msg.sender).transfer(commitment.bond);
        
        emit OrderRevealed(batchId, msg.sender, order);
    }
    
    // Get all revealed orders for a batch
    function getRevealedOrders(uint256 batchId) external view returns (Order[] memory) {
        return revealedOrders[batchId];
    }
    
    // Helper: Generate commit hash off-chain
    function generateCommitHash(
        address trader,
        bool isBuy,
        uint256 amount,
        uint256 price,
        uint256 salt
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(trader, isBuy, amount, price, salt));
    }
}
