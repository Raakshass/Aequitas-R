"use client";

import { useState, useEffect } from "react";
import { parseEther, formatEther, type Abi } from "viem";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useBlockNumber,
  useWatchContractEvent,
} from "wagmi";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";

// ==========================================
// 🧩 SUB-COMPONENT: Oracle Row
// ==========================================
const OracleRow = ({
  name,
  description,
  contractAddress,
  contractAbi,
  writeContractAsync,
  busy,
}: {
  name: string;
  description: string;
  contractAddress?: `0x${string}`;
  contractAbi?: Abi;
  writeContractAsync: any;
  busy: boolean;
}) => {
  const [inputPrice, setInputPrice] = useState("");

  const { data: rawPrice, refetch } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: "latestAnswer",
    query: { enabled: !!contractAddress && !!contractAbi },
  });

  const displayPrice = rawPrice
    ? formatEther((rawPrice as bigint) ?? 0n)
    : "Loading...";

  const handleUpdate = async () => {
    if (!contractAddress || !contractAbi) return;
    try {
      await writeContractAsync({
        address: contractAddress,
        abi: contractAbi,
        functionName: "updatePrice",
        args: [parseEther(inputPrice || "0")],
      });
      setInputPrice("");
      setTimeout(() => refetch(), 2000);
    } catch (e) {
      console.error(e);
      alert(`Failed to update ${name}: ` + (e as Error).message);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-base-200/80 rounded-xl p-3">
      <div className="w-28">
        <div className="text-xs font-semibold uppercase opacity-70">{name}</div>
        <div className="text-[0.7rem] opacity-60">{description}</div>
      </div>
      <div className="flex-1">
        <div className="text-[0.7rem] uppercase opacity-60 mb-1">Current</div>
        <div className="font-mono text-lg font-bold text-primary">
          ${displayPrice}
        </div>
      </div>
      <div className="flex-1">
        <div className="text-[0.7rem] uppercase opacity-60 mb-1">
          Set new price
        </div>
        <input
          type="number"
          className="input input-sm input-bordered w-full font-mono bg-base-100"
          value={inputPrice}
          onChange={e => setInputPrice(e.target.value)}
          placeholder="e.g. 2000"
        />
      </div>
      <button
        className="btn btn-sm btn-primary font-semibold"
        disabled={busy || !contractAddress}
        onClick={handleUpdate}
      >
        Save
      </button>
    </div>
  );
};

// ==========================================
// 🚀 MAIN COMPONENT: Sentinel Dashboard
// ==========================================
export const SentinelDashboard = () => {
  const { address } = useAccount();

  const { data: blockNumber } = useBlockNumber({ watch: true });

  const [inspectBatchId, setInspectBatchId] = useState("");

  // ---- Load contracts ----
  const { data: coreContract } = useDeployedContractInfo("AequitasCore");
  const { data: oracleAContract } = useDeployedContractInfo("OracleA");
  const { data: oracleBContract } = useDeployedContractInfo("OracleB");
  const { data: oracleCContract } = useDeployedContractInfo("OracleC");
  const { data: medianizerContract } = useDeployedContractInfo("Medianizer");
  const { data: shutterContract } = useDeployedContractInfo("MockShutter");
  const { data: keeperFallbackContract } = useDeployedContractInfo("KeeperFallback");

  const coreAddress = coreContract?.address as `0x${string}` | undefined;
  const coreAbi = coreContract?.abi as Abi | undefined;

  const oracleAAddr = oracleAContract?.address as `0x${string}` | undefined;
  const oracleAAbi = oracleAContract?.abi as Abi | undefined;

  const oracleBAddr = oracleBContract?.address as `0x${string}` | undefined;
  const oracleBAbi = oracleBContract?.abi as Abi | undefined;

  const oracleCAddr = oracleCContract?.address as `0x${string}` | undefined;
  const oracleCAbi = oracleCContract?.abi as Abi | undefined;

  const medianizerAddr = medianizerContract?.address as `0x${string}` | undefined;
  const medianizerAbi = medianizerContract?.abi as Abi | undefined;

  const shutterAddr = shutterContract?.address as `0x${string}` | undefined;
  const shutterAbi = shutterContract?.abi as Abi | undefined;

  const keeperFallbackAddr = keeperFallbackContract?.address as `0x${string}` | undefined;
  const keeperFallbackAbi = keeperFallbackContract?.abi as Abi | undefined;

  const zeroAddress = "0x0000000000000000000000000000000000000000" as `0x${string}`;

  // ---- Reads ----

  const { data: readMedian, refetch: refetchMedian } = useReadContract({
    address: medianizerAddr ?? zeroAddress,
    abi: (medianizerAbi ?? []) as Abi,
    functionName: "peek",
    query: { enabled: !!medianizerAddr && !!medianizerAbi },
  });

  const medianPrice =
    readMedian && Array.isArray(readMedian)
      ? (readMedian[0] as bigint)
      : undefined;

  const displayMedian =
    medianPrice !== undefined ? formatEther(medianPrice) : "Loading...";

  const { data: currentBatchIdRaw, refetch: refetchBatchId } = useReadContract({
    address: coreAddress ?? zeroAddress,
    abi: (coreAbi ?? []) as Abi,
    functionName: "currentBatchId",
    query: { enabled: !!coreAbi && !!coreAddress },
  });

  const currentBatchId = (currentBatchIdRaw as bigint | undefined) ?? 0n;

  const { data: batchDataRaw, refetch: refetchBatchData } = useReadContract({
    address: coreAddress ?? zeroAddress,
    abi: (coreAbi ?? []) as Abi,
    functionName: "batches",
    args: [currentBatchId],
    query: { enabled: !!coreAbi && !!coreAddress && currentBatchId > 0n },
  });

  const batchData = (batchDataRaw as any) || [];
  const batchStatus: bigint = batchData[1] ?? 0n;

  // auto-sync inspectBatchId
  useEffect(() => {
    if (currentBatchId > 0n) {
      setInspectBatchId(currentBatchId.toString());
    }
  }, [currentBatchId]);

  // ---- wagmi writes ----
  const { writeContractAsync, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });
  const busy = isPending || isConfirming;

  // ---- Reactivity: refresh on tx success and new blocks ----
  useEffect(() => {
    if (isSuccess) {
      refetchMedian();
      refetchBatchId();
      refetchBatchData();
    }
  }, [isSuccess, refetchMedian, refetchBatchId, refetchBatchData]);

  useEffect(() => {
    refetchMedian();
    refetchBatchData();
    refetchBatchId();
  }, [blockNumber, refetchMedian, refetchBatchData, refetchBatchId]);

  // Optional: listen to events from AequitasCore
  useWatchContractEvent({
    address: coreAddress,
    abi: coreAbi,
    eventName: "BatchStatusUpdated", // only if this exists in your core
    enabled: !!coreAddress && !!coreAbi,
    onLogs() {
      console.log("⚡ BatchStatusUpdated event – refetching…");
      refetchBatchId();
      refetchBatchData();
    },
  });

  const getStatusLabel = (s: bigint) => {
    const n = Number(s);
    const statuses = [
      "OPEN 🟢",
      "CLOSED 🔴",
      "PROPOSED 🟡",
      "FINALIZED 🔵",
      "REVERTED ⚫",
    ];
    return statuses[n] ?? "UNKNOWN";
  };

  // ---- Handlers ----

  const handleCloseBatch = async () => {
    if (!coreAddress || !coreAbi) return;
    try {
      await writeContractAsync({
        address: coreAddress,
        abi: coreAbi,
        functionName: "closeCurrentBatch",
      });
    } catch (e) {
      console.error("Close failed:", e);
      alert("Close failed: " + (e as Error).message);
    }
  };

  const handlePublishKey = async () => {
    if (!shutterAddr || !shutterAbi) return;
    try {
      await writeContractAsync({
        address: shutterAddr,
        abi: shutterAbi,
        functionName: "publishKey",
        args: [currentBatchId, "mock-secret-key"],
      });
    } catch (e) {
      console.error("Publish key failed:", e);
      alert("Publish key failed: " + (e as Error).message);
    }
  };

  const handleProposeSettlement = async () => {
    if (!coreAddress || !coreAbi || !medianPrice) {
      alert("Cannot propose: Missing core address or oracle data.");
      return;
    }
    try {
      await writeContractAsync({
        address: coreAddress,
        abi: coreAbi,
        functionName: "proposeSettlement",
        args: [currentBatchId, medianPrice, [], [], []],
      });
    } catch (e) {
      console.error("Propose failed:", e);
      alert("Propose failed: " + (e as Error).message);
    }
  };

  const handleFinalizeBatch = async () => {
    if (!coreAddress || !coreAbi) return;
    try {
      await writeContractAsync({
        address: coreAddress,
        abi: coreAbi,
        functionName: "finalizeBatch",
        args: [BigInt(inspectBatchId)],
      });
    } catch (e) {
      console.error("Finalize failed:", e);
      alert("Finalize failed: " + (e as Error).message);
    }
  };

  // 🚨 NEW: on-chain keeper nudge
  const handleKeeperNudge = async () => {
    if (!keeperFallbackAddr || !keeperFallbackAbi) {
      alert("KeeperFallback not loaded");
      return;
    }
    try {
      await writeContractAsync({
        address: keeperFallbackAddr,
        abi: keeperFallbackAbi,
        functionName: "keeperNudge",
        // ✅ FIXED: Removed args array entirely.
        // The contract function is keeperNudge() with 0 arguments.
      });
    } catch (e) {
      console.error("Keeper nudge failed:", e);
      alert("Keeper nudge failed: " + (e as Error).message);
    }
  };

  if (!coreContract) {
    return <div className="text-center p-10">Loading Sentinel...</div>;
  }

  return (
    <div className="flex flex-col gap-8 py-10 px-4 w-full max-w-5xl mx-auto text-base-content">
      {/* HEADLINE */}
      <div className="text-center mb-4">
        <h1 className="text-4xl font-black text-error tracking-tighter">
          SENTINEL COMMAND
        </h1>
        <p className="opacity-60 text-sm uppercase tracking-widest">
          Adversarial Simulation &amp; Governance
        </p>
        <div className="text-xs font-mono mt-2 opacity-40">
          Block: {blockNumber?.toString() ?? "..."}
        </div>
      </div>

      {/* ORACLE CONTROL PANEL */}
      <div className="bg-base-100 shadow-xl rounded-2xl p-6 border border-base-300">
        <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
          <span>📊 Oracle Control Panel</span>
          <span className="badge badge-outline badge-primary text-xs">
            Chaos Engineering
          </span>
        </h2>

        <div className="space-y-4 mb-6">
          <OracleRow
            name="Oracle A"
            description="Chainlink (Mock)"
            contractAddress={oracleAAddr}
            contractAbi={oracleAAbi}
            writeContractAsync={writeContractAsync}
            busy={busy}
          />
          <OracleRow
            name="Oracle B"
            description="Pyth (Mock)"
            contractAddress={oracleBAddr}
            contractAbi={oracleBAbi}
            writeContractAsync={writeContractAsync}
            busy={busy}
          />
          <OracleRow
            name="Oracle C"
            description="Uniswap TWAP (Mock)"
            contractAddress={oracleCAddr}
            contractAbi={oracleCAbi}
            writeContractAsync={writeContractAsync}
            busy={busy}
          />
        </div>

        <div className="flex flex-col lg:flex-row items-stretch gap-4">
          <div className="flex-1 bg-success/10 border border-success rounded-xl p-4">
            <div className="text-xs font-semibold uppercase opacity-70">
              Medianizer Price
            </div>
            <div className="text-3xl font-black text-success mt-1">
              ${displayMedian}
            </div>
            <p className="text-xs opacity-60 mt-1">
              Aggregates feeds to filter outliers.
            </p>
          </div>
        </div>
      </div>

      {/* BATCH OPERATIONS + KEEPER NUDGE */}
      <div className="bg-base-100 shadow-xl rounded-2xl p-6 border border-base-300">
        <h2 className="text-2xl font-bold mb-4">⚙️ Batch Operations</h2>

        <div className="stats shadow bg-base-200 w-full mb-6">
          <div className="stat">
            <div className="stat-title">Current Batch</div>
            <div className="stat-value text-primary">
              #{currentBatchId.toString()}
            </div>
            <div className="stat-desc font-bold mt-1">
              {getStatusLabel(batchStatus)}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            className="btn btn-warning btn-lg w-full shadow-md"
            onClick={handleCloseBatch}
            disabled={busy || Number(batchStatus) !== 0}
          >
            1. Close Batch 🛑
          </button>

          <button
            className="btn btn-info btn-lg w-full shadow-md"
            onClick={handlePublishKey}
            disabled={busy || Number(batchStatus) === 0}
          >
            2. Publish Key 🔑
          </button>

          <button
            className="btn btn-secondary btn-lg w-full shadow-md"
            onClick={handleProposeSettlement}
            disabled={busy || Number(batchStatus) === 0}
          >
            2.5 Propose Settlement 💰
          </button>

          {/* 🔁 NEW: Keeper Nudge (local demo) */}
          <button
            className="btn btn-outline btn-accent w-full shadow-md"
            onClick={handleKeeperNudge}
            disabled={busy || !keeperFallbackAddr}
          >
            🔁 Nudge Local Keeper (time-travel + auto-flow)
          </button>

          <div className="divider">THEN</div>

          <div className="join w-full">
            <input
              className="input input-bordered join-item w-full"
              placeholder="Batch ID to Finalize"
              value={inspectBatchId}
              onChange={e => setInspectBatchId(e.target.value)}
            />
            <button
              className="btn btn-success join-item"
              onClick={handleFinalizeBatch}
              disabled={busy}
            >
              3. Finalize ✅
            </button>
          </div>
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