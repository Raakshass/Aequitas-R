#!/usr/bin/env node
const hre = require("hardhat");

async function main() {
  const { ethers, artifacts, network } = hre;

  console.log("NODE:", network.name);
  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const buyer = signers[1];
  const seller = signers[2];

  console.log("Deployer:", deployer.address);
  console.log("Buyer:", buyer.address);
  console.log("Seller:", seller.address);
  console.log("----");

  // Use the addresses from your hardhat-deploy output
  const MOCK_TOKEN_ADDR = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const VAULT_ADDR      = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";

  console.log("Using addresses (hardcoded):");
  console.log("  MockToken:", MOCK_TOKEN_ADDR);
  console.log("  ReversibleVault:", VAULT_ADDR);

  // --- Artifacts sanity check ---
  try {
    const mockTokenArtifact = await artifacts.readArtifact("MockToken");
    console.log("MockToken artifact ABI length:", mockTokenArtifact.abi.length);
  } catch (e) {
    console.error("ERROR: Could not read MockToken artifact:", e.message || e);
  }

  try {
    const vaultArtifact = await artifacts.readArtifact("ReversibleVault");
    console.log("ReversibleVault artifact ABI length:", vaultArtifact.abi.length);
  } catch (e) {
    console.error("ERROR: Could not read ReversibleVault artifact:", e.message || e);
  }

  // --- Get contract instances (ethers v6 uses .target instead of .address) ---
  let token, vault;
  try {
    token = await ethers.getContractAt("MockToken", MOCK_TOKEN_ADDR, deployer);
    console.log("token (getContractAt) OK. token.target =", token.target);
  } catch (e) {
    console.error("ERROR: ethers.getContractAt('MockToken', addr) failed:", e.message || e);
  }

  try {
    vault = await ethers.getContractAt("ReversibleVault", VAULT_ADDR, deployer);
    console.log("vault (getContractAt) OK. vault.target =", vault.target);
  } catch (e) {
    console.error("ERROR: ethers.getContractAt('ReversibleVault', addr) failed:", e.message || e);
  }

  console.log("---- DEBUG: contract objects:");
  console.log(" token === undefined ?", token === undefined);
  console.log(" vault === undefined ?", vault === undefined);

  if (!token || !vault) {
    console.error("Aborting: token or vault contract objects are missing. See errors above.");
    process.exit(1);
  }

  // Deployer ERC20 balance
  try {
    const deployerTokenBal = await token.balanceOf(deployer.address);
    console.log("Deployer token balance (raw):", deployerTokenBal.toString());
  } catch (e) {
    console.error("Could not read token.balanceOf(deployer):", e.message || e);
  }

  const amount = ethers.parseEther("1000");

  // --- 1) Transfer MockToken to buyer & seller ---
  try {
    console.log("Transferring token from deployer -> buyer & seller...");
    const tx1 = await token.transfer(buyer.address, amount);
    await tx1.wait();
    const tx2 = await token.transfer(seller.address, amount);
    await tx2.wait();
    console.log("Transfers complete.");
  } catch (e) {
    console.error("Transfer error:", e.message || e);
    process.exit(1);
  }

  // --- 2) Buyer approve vault & deposit ---
  try {
    console.log("Buyer: approve vault -> deposit (using vault.target)...");
    const txA = await token.connect(buyer).approve(vault.target, amount);
    await txA.wait();
    const txB = await vault.connect(buyer).deposit(amount);
    await txB.wait();
    console.log("Buyer deposit done.");
  } catch (e) {
    console.error("Buyer approve/deposit error:", e.message || e);
    try {
      const allowance = await token.allowance(buyer.address, vault.target);
      console.log("Allowance(buyer -> vault):", allowance.toString());
    } catch (_) {}
    process.exit(1);
  }

  // --- 3) Seller approve vault & deposit (optional but good for demo) ---
  try {
    console.log("Seller: approve vault -> deposit (using vault.target)...");
    const txC = await token.connect(seller).approve(vault.target, amount);
    await txC.wait();
    const txD = await vault.connect(seller).deposit(amount);
    await txD.wait();
    console.log("Seller deposit done.");
  } catch (e) {
    console.error("Seller approve/deposit error:", e.message || e);
    process.exit(1);
  }

  // --- 4) Final internal balances in ReversibleVault ---
  try {
    const buyerBal = await vault.internalBalance(buyer.address);
    const sellerBal = await vault.internalBalance(seller.address);
    console.log("Buyer internal vault balance:", buyerBal.toString());
    console.log("Seller internal vault balance:", sellerBal.toString());
  } catch (e) {
    console.error("Could not read vault internal balances:", e.message || e);
  }

  console.log("ALL DONE - debug script finished.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Unhandled error in script:", err);
    process.exit(1);
  });
