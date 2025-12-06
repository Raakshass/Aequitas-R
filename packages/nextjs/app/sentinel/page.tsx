"use client";

import type { NextPage } from "next";
import { SentinelDashboard } from "~~/components/aequitas/SentinelDashboard";
import { SwitchTheme } from "~~/components/SwitchTheme";

const SentinelPage: NextPage = () => {
  return (
    <div className="min-h-screen bg-neutral text-neutral-content py-10 transition-colors duration-300">
      <div className="flex justify-end max-w-5xl mx-auto mb-6">
        {/* Dark mode toggle */}
        <SwitchTheme />
      </div>
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-error drop-shadow-lg animate-fade-in">
          ⚠️ Sentinel Command
        </h1>
        <p className="opacity-70 animate-fade-in-slow">
          Admin access only. Use for demos and dispute resolution.
        </p>
      </div>
      {/* The Admin Interface */}
      <SentinelDashboard />
    </div>
  );
};

export default SentinelPage;
