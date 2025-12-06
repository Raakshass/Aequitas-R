const hre = require("hardhat");

async function main() {
  const medianizerAddress = "0x68B1D87F95878fE05B998F19b66F4baba5De1aed";
  
  // Get the Medianizer contract
  const Medianizer = await hre.ethers.getContractAt("Medianizer", medianizerAddress);
  
  console.log("\n🔍 CHECKING MEDIANIZER CONFIGURATION:\n");
  
  // Try to get oracle addresses (adjust function names based on your contract)
  try {
    // Common patterns - try each one
    const oracleA = await Medianizer.oracleA();
    const oracleB = await Medianizer.oracleB();
    const oracleC = await Medianizer.oracleC();
    
    console.log("Oracle A:", oracleA);
    console.log("Oracle B:", oracleB);
    console.log("Oracle C:", oracleC);
  } catch (e) {
    // Try array pattern
    try {
      const oracle0 = await Medianizer.oracles(0);
      const oracle1 = await Medianizer.oracles(1);
      const oracle2 = await Medianizer.oracles(2);
      
      console.log("Oracle[0]:", oracle0);
      console.log("Oracle[1]:", oracle1);
      console.log("Oracle[2]:", oracle2);
    } catch (e2) {
      console.log("Could not read oracle addresses. Error:", e2.message);
      console.log("\nLet's check the contract source...");
    }
  }
  
  // Try to get current median price
  try {
    const price = await Medianizer.getMedianPrice();
    console.log("\n💰 Current Median Price:", price.toString());
  } catch (e) {
    try {
      const price = await Medianizer.latestAnswer();
      console.log("\n💰 Current Price (latestAnswer):", price.toString());
    } catch (e2) {
      console.log("\nCould not get price. Need to check function names.");
    }
  }
}

main().catch(console.error);
