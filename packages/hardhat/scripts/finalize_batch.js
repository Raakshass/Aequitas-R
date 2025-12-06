// scripts/finalize_batch.js
// One-shot helper: fast-forward past challenge window and finalize
// the *current* batch (assumed to be PROPOSED).

const hre = require("hardhat");
const { ethers, network } = hre;

async function main() {
  const core = await ethers.getContract("AequitasCore");

  const batchId = await core.currentBatchId();
  const b = await core.batches(batchId);

  console.log("Finalizing batch:", batchId.toString());
  console.log(
    "Status before:",
    b.status.toString(),
    "(0=OPEN,1=CLOSED,2=PROPOSED,3=FINALIZED,4=REVERTED)",
  );

  // ---- fast-forward to end of challenge window (for local demo) ----
  const latest = await ethers.provider.getBlock("latest");
  const now = latest.timestamp;
  const challengeEnd = Number(b.challengeEndTime);

  if (now <= challengeEnd) {
    const delta = challengeEnd - now + 1;
    console.log(`Fast-forwarding EVM time by ${delta}s...`);
    await network.provider.send("evm_increaseTime", [delta]);
    await network.provider.send("evm_mine");
  }

  console.log("Calling finalizeBatch...");
  const tx = await core.finalizeBatch(batchId);
  await tx.wait();

  const bAfter = await core.batches(batchId);
  const currentAfter = await core.currentBatchId();

  console.log("Status after:", bAfter.status.toString());
  console.log("currentBatchId is now:", currentAfter.toString());
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
