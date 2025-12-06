// scripts/checkVaultBalance.js
const hre = require("hardhat");

async function main() {
  const vault = await hre.ethers.getContract("ReversibleVault");
  const signers = await hre.ethers.getSigners();
  const buyer = signers[1];

  const balance = await vault.internalBalance(buyer.address);
  console.log("Buyer internal vault balance:", balance.toString());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
