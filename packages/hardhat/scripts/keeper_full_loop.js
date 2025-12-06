#!/usr/bin/env node
const hre = require("hardhat");
const { ethers } = hre;
const { spawn } = require("child_process");

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runPythonSolver() {
  return new Promise((resolve, reject) => {
    console.log("🚀 Running Python solver.py ...");
    // NOTE: this runs ../solver/solver.py (same as local mode),
    // but solver.py will now talk to Sepolia via its own RPC URL.
    const py = spawn("python", ["../solver/solver.py"], { stdio: "inherit" });

    py.on("close", code => {
      if (code === 0) {
        console.log("✅ Python solver finished successfully.");
        resolve();
      } else {
        console.error("❌ Python solver exited with code", code);
        reject(new Error("Solver failed"));
      }
    });

    py.on("error", err => reject(err));
  });
}

async function main() {
  const core = await ethers.getContract("AequitasCore");
  const shutter = await ethers.getContract("MockShutter");

  console.log("🌐 Network:", (await ethers.provider.getNetwork()).name);
  console.log("🚀 Starting keeper + solver loop on LIVE network (no time-travel)…");

  while (true) {
    const batchId = await core.currentBatchId();
    const b = await core.batches(batchId);
    const status = Number(b.status);
    const latest = await ethers.provider.getBlock("latest");
    const now = latest.timestamp;

    console.log(
      `[${new Date().toISOString()}] Batch #${batchId} status=${status} (0=OPEN,1=CLOSED,2=PROPOSED,3=FINALIZED,4=REVERTED) time=${now}`,
    );

    // --- 0 = OPEN -> wait until closeTime, then close batch ---
    if (status === 0) {
      const closeTime = Number(b.closeTime);
      if (now >= closeTime) {
        console.log("⏰ closeTime reached, closing current batch on-chain…");
        const tx = await core.closeCurrentBatch();
        await tx.wait();
        console.log("✅ Batch closed");
      } else {
        const delta = closeTime - now;
        console.log(`⌛ Batch still OPEN. closeTime in ~${delta}s. Sleeping 30s…`);
        await sleep(30_000);
      }
      continue;
    }

    // --- 1 = CLOSED -> publish key (if missing) and run solver ---
    if (status === 1) {
      const has = await shutter.hasKey(batchId);
      if (!has) {
        console.log("🔑 No key yet. Publishing MockShutter key…");
        const tx = await shutter.publishKey(batchId, "auto-key-keeper");
        await tx.wait();
        console.log("✅ Key published");
      } else {
        console.log("🔐 Key already published");
      }

      // Run solver to propose settlement
      try {
        await runPythonSolver();
      } catch (e) {
        console.error("Solver run failed:", e);
      }

      // wait a bit before checking again
      await sleep(30_000);
      continue;
    }

    // --- 2 = PROPOSED -> wait for challengeEndTime, then finalize ---
    if (status === 2) {
      const challengeEnd = Number(b.challengeEndTime);
      if (now >= challengeEnd) {
        console.log("🏁 Challenge window over. Finalizing batch…");
        const tx = await core.finalizeBatch(batchId);
        await tx.wait();
        console.log("✅ Batch finalized");
      } else {
        const delta = challengeEnd - now;
        console.log(`⌛ Batch PROPOSED. Challenge ends in ~${delta}s. Sleeping 30s…`);
        await sleep(30_000);
      }
      continue;
    }

    // --- 3 = FINALIZED, 4 = REVERTED -> just wait for next batch ---
    console.log("🎯 Batch is FINALIZED / REVERTED. Waiting 60s for next batch…");
    await sleep(60_000);
  }
}

main().catch(e => {
  console.error("Keeper loop error:", e);
  process.exit(1);
});
