// scripts/sentinel_keeper.js
// Automated "keeper" / sentinel for local demo:
// - closes batch when time passes (fast-forwards on Hardhat)
// - publishes MockShutter key
// - finalizes batch after challenge window

const hre = require("hardhat");
const { ethers, network } = hre;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const core = await ethers.getContract("AequitasCore");
  const shutter = await ethers.getContract("MockShutter");

  console.log("🛰  Sentinel keeper started (Ctrl+C to stop)...");

  while (true) {
    const batchId = await core.currentBatchId();
    const b = await core.batches(batchId);

    const status = Number(b.status); // 0..4
    const latest = await ethers.provider.getBlock("latest");
    const now = latest.timestamp;

    console.log(
      `\n[Keeper] Batch #${batchId} | status=${status} (0=OPEN,1=CLOSED,2=PROPOSED,3=FINALIZED,4=REVERTED) | time=${now}`,
    );

    if (status === 0) {
      // ---- OPEN ----
      const closeTime = Number(b.closeTime);
      if (now >= closeTime) {
        console.log("→ Closing batch (closeCurrentBatch)...");
        const tx = await core.closeCurrentBatch();
        await tx.wait();
        console.log("✅ Batch closed.");
      } else {
        const delta = closeTime - now + 1;
        console.log(
          `→ Fast-forwarding ${delta}s to closeTime then closing batch...`,
        );
        await network.provider.send("evm_increaseTime", [delta]);
        await network.provider.send("evm_mine");
        const tx = await core.closeCurrentBatch();
        await tx.wait();
        console.log("✅ Batch closed (after time travel).");
      }
    } else if (status === 1) {
      // ---- CLOSED ----
      const hasKey = await shutter.hasKey(batchId);
      if (!hasKey) {
        console.log("→ No key yet. Publishing MockShutter key...");
        const tx = await shutter.publishKey(batchId, "auto-key-keeper");
        await tx.wait();
        console.log(
          "✅ Key published. Now run `python solver.py` to propose settlement.",
        );
      } else {
        console.log(
          "→ Key already published. Waiting for solver to call proposeSettlement (status=PROPOSED).",
        );
      }
    } else if (status === 2) {
      // ---- PROPOSED ----
      const challengeEnd = Number(b.challengeEndTime);
      if (now < challengeEnd) {
        const delta = challengeEnd - now + 1;
        console.log(
          `→ Fast-forwarding ${delta}s to end of challenge window...`,
        );
        await network.provider.send("evm_increaseTime", [delta]);
        await network.provider.send("evm_mine");
      }

      console.log("→ Finalizing batch...");
      const tx = await core.finalizeBatch(batchId);
      await tx.wait();
      console.log("✅ Batch finalized.");

      const nextId = await core.currentBatchId();
      console.log(`Next batch opened: #${nextId.toString()}`);
    } else if (status === 3) {
      console.log("→ Batch already FINALIZED. Waiting for new activity.");
    } else if (status === 4) {
      console.log("→ Batch is REVERTED (disputed). Keeper standing by.");
    }

    // Poll every 10 seconds (for demo)
    await sleep(10_000);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
