"use client";

import { useState, useEffect } from "react";
import { parseEther, formatEther, type Abi, toHex } from "viem";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBlockNumber,
  useWatchContractEvent,
} from "wagmi";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";

export const TraderDashboard = () => {
  const { address } = useAccount();

  // -------- Form state --------
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [vaultAmount, setVaultAmount] = useState("");
  const [orderAmount, setOrderAmount] = useState("");
  const [price, setPrice] = useState("");

  // -------- Load contracts --------
  const { data: coreContract } = useDeployedContractInfo("AequitasCore");
  const { data: tokenContract } = useDeployedContractInfo("MockToken");
  const { data: vaultContract } = useDeployedContractInfo("ReversibleVault");
  const { data: shutterContract } = useDeployedContractInfo("MockShutter");
  const { data: medianizerContract } = useDeployedContractInfo("Medianizer");

  const coreAddress = coreContract?.address as `0x${string}` | undefined;
  const coreAbi = coreContract?.abi as Abi | undefined;

  const tokenAddress = tokenContract?.address as `0x${string}` | undefined;
  const tokenAbi = tokenContract?.abi as Abi | undefined;

  const vaultAddress = vaultContract?.address as `0x${string}` | undefined;
  const vaultAbi = vaultContract?.abi as Abi | undefined;

  const shutterAddress = shutterContract?.address as `0x${string}` | undefined;
  const shutterAbi = shutterContract?.abi as Abi | undefined;

  const medianizerAddress = medianizerContract?.address as `0x${string}` | undefined;
  const medianizerAbi = medianizerContract?.abi as Abi | undefined;

  const zeroAddress = "0x0000000000000000000000000000000000000000" as `0x${string}`;

  // =================================================================================
  // ✅ REACTIVITY HOOKS
  // =================================================================================

  // 1. Watch for new blocks (heartbeat of the blockchain)
  const { data: blockNumber } = useBlockNumber({ watch: true });

  // -------- READ DATA (with refetch handles) --------

  // Current Batch ID
  const { data: currentBatchIdRaw, refetch: refetchBatchId } = useReadContract({
    address: coreAddress ?? zeroAddress,
    abi: (coreAbi ?? []) as Abi,
    functionName: "currentBatchId",
    query: { enabled: !!coreAbi },
  });
  const currentBatchId = (currentBatchIdRaw as bigint | undefined) ?? 0n;

  // Batch Info
  const { data: batchDataRaw, refetch: refetchBatchData } = useReadContract({
    address: coreAddress ?? zeroAddress,
    abi: (coreAbi ?? []) as Abi,
    functionName: "batches",
    args: [currentBatchId],
    query: { enabled: !!coreAbi && currentBatchId > 0n },
  });

  const batchData = (batchDataRaw as any) || [];
  const batchStatus: bigint = batchData[1] ?? 0n;
  // index 2 is closeTime in Batch struct: [id, status, closeTime, clearingPrice, solver, challengeEndTime]
  const batchCloseTime: bigint = batchData[2] ?? 0n;
  // index 3 is clearingPrice
  const batchClearingPrice: bigint = batchData[3] ?? 0n;

  // Vault Balance (internalBalance mapping)
  const { data: vaultBalanceRaw, refetch: refetchVault } = useReadContract({
    address: vaultAddress ?? zeroAddress,
    abi: (vaultAbi ?? []) as Abi,
    functionName: "internalBalance",
    args: [address ?? zeroAddress],
    query: { enabled: !!vaultAbi && !!address },
  });
  const vaultBalance = (vaultBalanceRaw as bigint | undefined) ?? 0n;

  // Medianizer peek() returns (price, timestamp)
  const { data: medianRaw, refetch: refetchMedian } = useReadContract({
    address: medianizerAddress ?? zeroAddress,
    abi: (medianizerAbi ?? []) as Abi,
    functionName: "peek",
    query: { enabled: !!medianizerAbi && !!medianizerAddress },
  });

  const medianTuple = (medianRaw as [bigint, bigint] | undefined) ?? undefined;
  const medianPrice = medianTuple ? medianTuple[0] : 0n;

  // =================================================================================
  // ✅ AUTO-REFETCH LOGIC
  // =================================================================================

  // 2. Effect: When blockNumber changes, refetch all data
  useEffect(() => {
    refetchBatchId();
    refetchBatchData();
    refetchVault();
    refetchMedian();
  }, [blockNumber, refetchBatchId, refetchBatchData, refetchVault, refetchMedian]);

  // 3. Event Listener: Listen for low-level core events (BatchClosed exists)
  // This updates the UI immediately when the contract emits a BatchClosed event.
  useWatchContractEvent({
    address: coreAddress,
    abi: coreAbi,
    eventName: "BatchClosed", // matches event in your core ABI
    onLogs: logs => {
      console.log("⚡ BatchClosed event detected", logs);
      // refetch everything that can change due to status update
      try {
        refetchBatchId();
        refetchBatchData();
        refetchVault();
        refetchMedian();
      } catch (err) {
        console.error("Refetch error after event:", err);
      }
    },
    // optional safety hooks
    // once: false, // removed 'once' to allow continuous listening if needed
    onError(error) {
      console.error("useWatchContractEvent error:", error);
    },
  });

  // -------- WRITES --------
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });
  const busy = isPending || isConfirming;

  // 4. Effect: When any write tx succeeds, refresh on-chain reads so UI is up to date
  useEffect(() => {
    if (isSuccess) {
      console.log("Transaction confirmed — refetching data");
      refetchBatchId();
      refetchBatchData();
      refetchVault();
      refetchMedian();
    }
  }, [isSuccess, refetchBatchId, refetchBatchData, refetchVault, refetchMedian]);

  // -------- Helpers --------
  const getStatusLabel = (s: bigint) => {
    const n = Number(s);
    const statuses = ["OPEN 🟢", "CLOSED 🔴", "PROPOSED 🟡", "FINALIZED 🟢", "REVERTED ⚠️"];
    return statuses[n] ?? "UNKNOWN";
  };

  const getCircuitStatus = () => {
    if (!medianPrice || !batchClearingPrice) {
      return { label: "Monitoring", badgeClass: "badge-neutral" };
    }

    const diff =
      medianPrice > batchClearingPrice
        ? medianPrice - batchClearingPrice
        : batchClearingPrice - medianPrice;

    const bps = (diff * 10000n) / medianPrice; // basis points difference

    if (bps > 2000n) {
      return { label: "TRIPPED (>20% deviation)", badgeClass: "badge-error" };
    }
    if (bps > 500n) {
      return { label: "Warning (>5% deviation)", badgeClass: "badge-warning" };
    }
    return { label: "Healthy", badgeClass: "badge-success" };
  };

  const circuit = getCircuitStatus();

  // -------- HANDLERS --------

  const handleDeposit = async () => {
    if (!vaultAddress || !tokenAddress || !tokenAbi || !vaultAbi || !vaultAmount) return;
    try {
      const weiAmount = parseEther(vaultAmount);
      // 1) Approve vault
      await writeContract({
        address: tokenAddress,
        abi: tokenAbi,
        functionName: "approve",
        args: [vaultAddress, weiAmount],
      });
      // 2) Deposit
      await writeContract({
        address: vaultAddress,
        abi: vaultAbi,
        functionName: "deposit",
        args: [weiAmount],
      });
    } catch (e) {
      console.error("Deposit error:", e);
    }
  };

  const handleWithdraw = async () => {
    if (!vaultAddress || !vaultAbi || !vaultAmount) return;
    try {
      const weiAmount = parseEther(vaultAmount);
      await writeContract({
        address: vaultAddress,
        abi: vaultAbi,
        functionName: "withdraw",
        args: [weiAmount],
      });
    } catch (e) {
      console.error("Withdraw error:", e);
    }
  };

  // ---- ORDER: send "encrypted" batch payload to MockShutter ----
  const handleSubmitOrder = async () => {
    if (!shutterAddress || !shutterAbi || !price || !orderAmount || currentBatchId === 0n) return;
    try {
      // Solver expects plaintext layout: "side,price,amount|..."
      const sideText = side === "BUY" ? "buy" : "sell";
      const orderText = `${sideText},${price},${orderAmount}|`;

      // Mock encryption: encode as bytes (utf8) then to hex
      const encoder = new TextEncoder();
      const ciphertext = toHex(encoder.encode(orderText)); // safe bytes -> hex

      await writeContract({
        address: shutterAddress,
        abi: shutterAbi as Abi,
        functionName: "submitEncryptedBatch",
        args: [currentBatchId, ciphertext],
      });
    } catch (e) {
      console.error("Submit order error:", e);
    }
  };

  if (!coreContract) return <div className="text-center p-10">Loading Trader Dashboard...</div>;

  return (
    <div className="flex flex-col gap-8 py-10 px-4 w-full max-w-5xl mx-auto">
      {/* HEADLINE */}
      <div className="text-center mb-4">
        <h1 className="text-4xl font-black text-primary tracking-tighter">TRADER DASHBOARD</h1>
        <p className="opacity-60 text-sm uppercase tracking-widest">Encrypted Dark Pool Trading</p>
      </div>

      {/* STATS ROW + CIRCUIT BREAKER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-2">
        {/* Current Batch */}
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-base-200 dark:to-base-300 p-5 shadow flex flex-col items-center">
          <div className="text-lg font-semibold text-gray-600 dark:text-gray-300">
            Current Batch
          </div>
          <div className="text-4xl font-black text-primary mt-2">#{currentBatchId.toString()}</div>
          <div className="mt-2 font-bold text-sm">{getStatusLabel(batchStatus)}</div>
          {batchCloseTime > 0n && (
            <div className="text-xs text-gray-400 mt-1">Closes at TS: {batchCloseTime.toString()}</div>
          )}
        </div>

        {/* Your Vault Balance */}
        <div className="rounded-xl bg-gradient-to-br from-green-50 to-green-100 dark:from-base-200 dark:to-base-300 p-5 shadow flex flex-col items-center">
          <div className="text-lg font-semibold text-gray-600 dark:text-gray-300">
            Your Vault Balance
          </div>
          <div className="text-3xl font-black text-success mt-2">
            {formatEther(vaultBalance)} TOKEN
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Collateral for trading (MockToken)
          </div>
        </div>

        {/* Circuit Breaker Status */}
        <div className="rounded-xl bg-gradient-to-br from-red-50 to-red-100 dark:from-base-200 dark:to-base-300 p-5 shadow flex flex-col items-center">
          <div className="text-lg font-semibold text-gray-600 dark:text-gray-300">
            Circuit Breaker
          </div>
          <div className={`badge mt-3 ${circuit.badgeClass} text-sm px-4 py-2`}>{circuit.label}</div>
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
            Compares clearing price vs Medianizer; trips if deviation &gt; 20%.
          </div>
          <div className="mt-1 text-xs font-mono text-gray-500 dark:text-gray-400">
            Median: {medianPrice ? formatEther(medianPrice) : "-"} • Clear:{" "}
            {batchClearingPrice ? formatEther(batchClearingPrice) : "-"}
          </div>
        </div>
      </div>

      {/* ========== VAULT MANAGEMENT ========== */}
      <div className="bg-base-100 shadow-xl rounded-2xl p-6 border border-base-300">
        <h2 className="text-2xl font-bold mb-4">💰 Vault Management</h2>
        <p className="text-sm opacity-70 mb-4">
          Deposit MockToken as collateral to trade or withdraw your balance.
        </p>

        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="number"
            className="input input-bordered flex-1 font-mono"
            placeholder="Amount (MockToken)"
            value={vaultAmount}
            onChange={e => setVaultAmount(e.target.value)}
          />
          <button
            className="btn btn-success flex-1"
            disabled={busy || !vaultAmount}
            onClick={handleDeposit}
          >
            Deposit
          </button>
          <button
            className="btn btn-warning flex-1"
            disabled={busy || !vaultAmount}
            onClick={handleWithdraw}
          >
            Withdraw
          </button>
        </div>
      </div>

      {/* ========== ORDER SUBMISSION ========== */}
      <div className="bg-base-100 shadow-xl rounded-2xl p-6 border border-base-300">
        <h2 className="text-2xl font-bold mb-4">📄 Submit Order</h2>
        <p className="text-sm opacity-70 mb-4">
          Orders are <b>encrypted (mock)</b> into a dark pool batch. The solver only sees them after
          the batch closes, so front-running is impossible.
        </p>

        <div className="flex flex-col gap-4">
          {/* Side Toggle */}
          <div className="flex gap-3">
            <button
              className={`btn flex-1 ${side === "BUY" ? "btn-primary" : "btn-outline"}`}
              onClick={() => setSide("BUY")}
            >
              BUY
            </button>
            <button
              className={`btn flex-1 ${side === "SELL" ? "btn-secondary" : "btn-outline"}`}
              onClick={() => setSide("SELL")}
            >
              SELL
            </button>
          </div>

          {/* Price */}
          <div>
            <label className="label">
              <span className="label-text font-semibold">Limit Price (e.g. 2000)</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full font-mono"
              placeholder="e.g. 2000"
              value={price}
              onChange={e => setPrice(e.target.value)}
            />
          </div>

          {/* Amount */}
          <div>
            <label className="label">
              <span className="label-text font-semibold">Amount (whole units)</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full font-mono"
              placeholder="e.g. 10"
              value={orderAmount}
              onChange={e => setOrderAmount(e.target.value)}
            />
          </div>

          {/* Submit Button */}
          <button
            className="btn btn-lg btn-primary font-bold shadow-lg"
            disabled={busy || !price || !orderAmount}
            onClick={handleSubmitOrder}
          >
            Submit Encrypted Order 🔒
          </button>
        </div>
      </div>

      {isSuccess && (
        <div className="toast toast-end">
          <div className="alert alert-success">
            <span>✅ Transaction Confirmed</span>
          </div>
        </div>
      )}
    </div>
  );
};