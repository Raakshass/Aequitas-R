const fs = require("fs");
const path = require("path");

async function main() {
  // Read deployed contract addresses from Scaffold-ETH's deployment folder
  const deploymentsDir = path.join(__dirname, "../deployments/localhost");
  
  const contracts = [
    "MockToken",
    "MockOracleA", 
    "MockOracleB",
    "MockOracleC",
    "Medianizer",
    "ReversibleVault",
    "AequitasCore"
  ];

  console.log("\n📋 DEPLOYED CONTRACT ADDRESSES:\n");
  console.log("================================");
  
  for (const name of contracts) {
    try {
      const filePath = path.join(deploymentsDir, `${name}.json`);
      const deployment = JSON.parse(fs.readFileSync(filePath, "utf8"));
      console.log(`${name}: ${deployment.address}`);
    } catch (e) {
      console.log(`${name}: ❌ NOT FOUND`);
    }
  }
  
  console.log("================================\n");
}

main().catch(console.error);
