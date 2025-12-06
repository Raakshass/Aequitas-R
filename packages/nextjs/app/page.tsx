import type { NextPage } from "next";
import { TraderDashboard } from "~~/components/aequitas/TraderDashboard";

const Home: NextPage = () => {
  return (
    <div className="flex items-center flex-col flex-grow pt-10">
      <div className="px-5">
        <h1 className="text-center mb-8">
          <span className="block text-2xl mb-2">Welcome to</span>
          <span className="block text-4xl font-bold">Aequitas-R</span>
          <span className="block text-lg mt-2 text-gray-500">Adversarial-Resilient Settlement Engine</span>
        </h1>
        <p className="text-center text-lg max-w-2xl mx-auto mb-8">
          A decentralized <b>Dark Pool</b> that protects you from MEV, Flash Crashes, and Hacks using 
          <b> Threshold Encryption</b> and <b>Reversible Settlement</b>.
        </p>
      </div>

      <TraderDashboard />
    </div>
  );
};

export default Home;
