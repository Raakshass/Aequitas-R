#!/usr/bin/env node
const hre = require("hardhat");

async function main() {
  const { ethers } = hre;
  const signers = await ethers.getSigners();

  const deployer = signers[0];
  const buyer = signers[1];
  const seller = signers[2];

  const MOCK_TOKEN_ADDR = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const VAULT_ADDR      = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";

  const token = await ethers.getContractAt("MockToken", MOCK_TOKEN_ADDR, deployer);
  const vault = await ethers.getContractAt("ReversibleVault", VAULT_ADDR, deployer);

  const amount = ethers.parseEther("1000");

  console.log("Deployer:", deployer.address);
  console.log("Buyer:", buyer.address);
  console.log("Seller:", seller.address);
  console.log("Token contract:", token.address);
  console.log("Vault contract:", vault.address);
  console.log("----");

  console.log("Transferring token from deployer to buyer and seller...");
  await (await token.transfer(buyer.address, amount)).wait();
  await (await token.transfer(seller.address, amount)).wait();

  console.log("Buyer: approving and depositing...");
  await (await token.connect(buyer).approve(vault.address, amount)).wait();
  await (await vault.connect(buyer).deposit(amount)).wait();

  console.log("Seller: approving and depositing...");
  await (await token.connect(seller).approve(vault.address, amount)).wait();
  await (await vault.connect(seller).deposit(amount)).wait();

  const buyerBal  = await vault.internalBalance(buyer.address);
  const sellerBal = await vault.internalBalance(seller.address);

  console.log("→ Buyer internal vault balance:",  buyerBal.toString());
  console.log("→ Seller internal vault balance:", sellerBal.toString());
}

main()
 .then(() => process.exit(0))
 .catch((e) => {
   console.error("ERROR in script:", e);
   process.exit(1);
 });
