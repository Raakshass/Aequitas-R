// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockOracle
 * @notice Simulates a single price feed (e.g., Chainlink ETH/USD).
 * @dev We will deploy 3 of these.
 */
contract MockOracle is Ownable {
    uint256 public price;
    string public name;

    event PriceUpdated(string name, uint256 newPrice);

    constructor(string memory _name, uint256 _initialPrice) Ownable(msg.sender) {
        name = _name;
        price = _initialPrice;
    }

    // Judge's Button: "Trigger Flash Crash"
    function updatePrice(uint256 _price) external {
        price = _price;
        emit PriceUpdated(name, _price);
    }
    
    function latestAnswer() external view returns (uint256) {
        return price;
    }
}