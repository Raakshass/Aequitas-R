// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

// USE THIS EXACT IMPORT with the '@' symbol
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockToken is ERC20, Ownable {
    // ... rest of the code stays the same
    constructor() ERC20("Fake USDC", "fUSDC") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }

    function mint(address to, uint256 amount) external { // <--- PUBLIC
        _mint(to, amount);
    }
}
