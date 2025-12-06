"use client";

import type { NextPage } from "next";
import { TraderDashboard } from "~~/components/aequitas/TraderDashboard";

const Home: NextPage = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-base-200">
      {/* Introduction / Hero Section */}
      <div className="text-center my-10 px-4">
        <h1 className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary mb-4">
          Aequitas-R
        </h1>
        <p className="text-xl text-base-content/70 max-w-2xl mx-auto">
          An Adversarial-Resilient Dark Pool. <br/>
          Resistant to MEV, Flash Crashes, and Hacks via 
          <span className="font-bold text-primary"> Reversible Settlement</span>.
        </p>
      </div>

      {/* The Main Trading Interface */}
      <TraderDashboard />
    </div>
  );
};

export default Home;
