// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface IMockOracle {
    function latestAnswer() external view returns (uint256);
    // Assuming external oracles also have a timestamp function, 
    // or we use the block.timestamp of when they updated.
    // For MockOracle, we'll just trust they update 'now'.
}

/**
 * @title Medianizer
 * @notice Aggregates 3 MockOracles and returns the Median + Freshness Timestamp.
 * @dev Resilient to 1 compromised oracle.
 */
contract Medianizer {

    IMockOracle public oracleA;
    IMockOracle public oracleB;
    IMockOracle public oracleC;

    constructor(address _a, address _b, address _c) {
        oracleA = IMockOracle(_a);
        oracleB = IMockOracle(_b);
        oracleC = IMockOracle(_c);
    }

    // Returns (Price, LastUpdatedTimestamp)
    function peek() external view returns (uint256, uint256) {
        uint256[3] memory prices;
        prices[0] = oracleA.latestAnswer();
        prices[1] = oracleB.latestAnswer();
        prices[2] = oracleC.latestAnswer();

        // Bubble Sort (Simple for 3 elements)
        if (prices[0] > prices[1]) (prices[0], prices[1]) = (prices[1], prices[0]);
        if (prices[1] > prices[2]) (prices[1], prices[2]) = (prices[2], prices[1]);
        if (prices[0] > prices[1]) (prices[0], prices[1]) = (prices[1], prices[0]);

        // The Median is prices[1]
        // For this demo, we assume "freshness" is the current block timestamp 
        // because MockOracles are updated in real-time by the user.
        // In production, you'd query .latestTimestamp() from Chainlink.
        return (prices[1], block.timestamp); 
    }
}
