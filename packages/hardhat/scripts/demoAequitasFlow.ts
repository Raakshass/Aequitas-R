// scripts/demoAequitasFlow.ts

import { ethers, network } from "hardhat";
import deployedContracts from "../../nextjs/contracts/deployedContracts";
import type {
  MockToken,
  ReversibleVault,
  AequitasCore,
  MockKeyper,
  MockShutter,
} from "../typechain-types";

async function main() {
  const [deployer, trader1, trader2] = await ethers.getSigners();
  console.log("Using deployer:", deployer.address);

  console.log("\n============================================================");
  console.log("🧪 AEQUITAS-R DEMO FLOW (TS, encryption + partial finality)");
  console.log("============================================================\n");

  // 1. Load core contracts from registry
  const net = await ethers.provider.getNetwork();
  const chainId = Number(net.chainId);

  const chainContracts = deployedContracts[chainId];

  if (!chainContracts) {
    throw new Error(`No deployedContracts entry for chainId ${chainId}`);
  }

  const mockTokenInfo = chainContracts["MockToken"];
  const vaultInfo = chainContracts["ReversibleVault"];
  const coreInfo = chainContracts["AequitasCore"];
  const keyperInfo = chainContracts["MockKeyper"];

  if (!mockTokenInfo || !vaultInfo || !coreInfo || !keyperInfo) {
    console.log("Available contracts in registry:", Object.keys(chainContracts));
    throw new Error("Missing required core contract artifacts in deployedContracts registry.");
  }

  const mockToken = (await ethers.getContractAt(
    "MockToken",
    mockTokenInfo.address,
  )) as MockToken;

  const vault = (await ethers.getContractAt(
    "ReversibleVault",
    vaultInfo.address,
  )) as ReversibleVault;

  const core = (await ethers.getContractAt(
    "AequitasCore",
    coreInfo.address,
  )) as AequitasCore;

  const keyper = (await ethers.getContractAt(
    "MockKeyper",
    keyperInfo.address,
  )) as MockKeyper;

  // TEMP: Hard-wire MockShutter address for local dev (from last deploy log)
  const shutterAddress = "0x0165878A594ca255338adfa4d48449f69242Eb8F";
  const shutter = (await ethers.getContractAt(
    "MockShutter",
    shutterAddress,
  )) as MockShutter;

  console.log(`MockToken      : ${mockToken.target.toString()}`);
  console.log(`ReversibleVault: ${vault.target.toString()}`);
  console.log(`AequitasCore   : ${core.target.toString()}`);
  console.log(`MockKeyper     : ${keyper.target.toString()}`);
  console.log(`MockShutter    : ${shutter.target.toString()}\n`);

  // 2. Fund traders with fUSDC and deposit into ReversibleVault
  const amountTrader = ethers.parseUnits("1000", 18);

  console.log("🔹 Distributing fUSDC to traders...");
  await (await mockToken.transfer(trader1.address, amountTrader)).wait();
  await (await mockToken.transfer(trader2.address, amountTrader)).wait();

  console.log("🔹 Traders approving Vault...");
  await (await mockToken.connect(trader1).approve(vault.target, amountTrader)).wait();
  await (await mockToken.connect(trader2).approve(vault.target, amountTrader)).wait();

  // 3. Deposit into Vault (REQUIRED for settlement)
  console.log("🔹 Traders depositing into Vault...");
  await (await vault.connect(trader1).deposit(amountTrader)).wait();
  await (await vault.connect(trader2).deposit(amountTrader)).wait();
  console.log("   Deposits complete. Internal balances updated.\n");

  // 3. Close current batch
  console.log("⏱  Closing batch 1...");
  await (await core.closeCurrentBatch()).wait();

  const batchId = 1n; // constructor opened batch 1; this call just closed it
  console.log(`   Using Batch ID: ${batchId.toString()}\n`);

  // 4. Dynamic orders from traders (Targeting $2000 Oracle)
  console.log("🧑‍💼 Trader1 submits: BUY 50 @ $2050");
  console.log("🧑‍💼 Trader2 submits: SELL 60 @ $1950");
  const traderOrders = "buy,2050,50|sell,1950,60";
  const dummyCiphertext = ethers.toUtf8Bytes(traderOrders);

  console.log("🔐 Writing encrypted batch payload to MockShutter...");
  await (await shutter.submitEncryptedBatch(batchId, dummyCiphertext)).wait();

  console.log("🔐 Publishing decryption key via MockShutter AND MockKeyper...");
  
  // 1. Publish to Shutter (Data Availability layer)
  await (await shutter.publishKey(batchId, "demo-symmetric-key")).wait();
  
  // 2. Publish to Keyper (Application Logic layer) - REQUIRED for core to accept settlement
  await (await keyper.publishKey(batchId, "demo-symmetric-key")).wait();
  
  console.log("   Encryption key published (both layers).\n");

  // 5. Wait for Solver
  console.log("📊 Waiting for external Solver to propose settlement...");
  console.log("   👉 RUN 'python solver.py' IN ANOTHER TERMINAL NOW! 👈");

  // SMART POLLING: Wait for status to become PROPOSED (Enum Index 2)
  let isProposed = false;
  for (let i = 0; i < 30; i++) { // Wait up to 60 seconds
    const batchData = await core.batches(batchId);
    
    // [0]=id, [1]=status, ...
    const status = BigInt(batchData[1]); 

    // Enum: 0=OPEN, 1=CLOSED, 2=PROPOSED, 3=FINALIZED
    if (status === 2n) { 
      console.log("   ✅ Settlement detected on-chain!");
      isProposed = true;
      break;
    }
    
    process.stdout.write("."); // simple progress bar
    await new Promise(r => setTimeout(r, 2000));
  }
  console.log(""); // newline

  if (!isProposed) {
    console.log("❌ Solver timed out. Demo stopping.");
    return;
  }

  // 6. Finalize batch (partial finality + idempotence)
  console.log("⏩ Advancing time past CHALLENGE_WINDOW (demo jump: 2 days)...");
  await network.provider.send("evm_increaseTime", [2 * 24 * 60 * 60]);
  await network.provider.send("evm_mine");

  console.log("✅ Finalizing batch once...");
  await (await core.finalizeBatch(batchId)).wait();

  try {
    console.log("🚫 Trying to finalize same batch again (should fail)...");
    await (await core.finalizeBatch(batchId)).wait();
  } catch {
    console.log("   Second finalize reverted as expected (idempotence).");
  }

  console.log("\n🎉 Demo complete.\n");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
