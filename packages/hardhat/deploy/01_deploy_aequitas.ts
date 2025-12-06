import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployAequitas: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment,
) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  console.log("----------------------------------------------------");
  console.log("🚀 Deploying Aequitas-R System (Core + Vault + Oracles + Encryption)...");

  // 1. Deploy MockToken (asset)
  const mockToken = await deploy("MockToken", {
    from: deployer,
    log: true,
    autoMine: true,
  });

  // 2. Deploy 3 Mock Oracles (sources) - FIXED: 18-decimal prices
  const oracleA = await deploy("OracleA", {
    contract: "MockOracle",
    from: deployer,
    args: ["Chainlink", hre.ethers.parseUnits("2000", 18)], // $2000 in wei
    log: true,
    autoMine: true,
  });

  const oracleB = await deploy("OracleB", {
    contract: "MockOracle",
    from: deployer,
    args: ["Pyth", hre.ethers.parseUnits("2005", 18)], // $2005 in wei
    log: true,
    autoMine: true,
  });

  const oracleC = await deploy("OracleC", {
    contract: "MockOracle",
    from: deployer,
    args: ["Uniswap", hre.ethers.parseUnits("1995", 18)], // $1995 in wei
    log: true,
    autoMine: true,
  });

  // 3. Deploy Medianizer (aggregates the 3 feeds)
  const medianizer = await deploy("Medianizer", {
    from: deployer,
    args: [oracleA.address, oracleB.address, oracleC.address],
    log: true,
    autoMine: true,
  });

  // 4. Deploy MockKeyper (Legacy - strictly speaking unused by new Core, but good to keep for UI compat if needed)
  const keyper = await deploy("MockKeyper", {
    from: deployer,
    log: true,
    autoMine: true,
  });

  // 5. Deploy MockShutter (threshold encryption network mock)
  const shutter = await deploy("MockShutter", {
    from: deployer,
    log: true,
    autoMine: true,
  });

  // 6. Deploy ReversibleVault (ERC-20R-style vault for fUSDC)
  const vault = await deploy("ReversibleVault", {
    from: deployer,
    args: [mockToken.address],
    log: true,
    autoMine: true,
  });

  // 7. Deploy AequitasCore (Settlement Engine)
  const core = await deploy("AequitasCore", {
    from: deployer,
    args: [vault.address, medianizer.address, shutter.address],
    log: true,
    autoMine: true,
  });

  // 8. Configure Vault: Set Settlement Engine
  const vaultContract = await hre.ethers.getContractAt(
    "ReversibleVault",
    vault.address,
  );

  // CRITICAL STEP: Wire the Vault to accept commands from the Core
  const currentEngine = await vaultContract.settlementEngine();
  if (currentEngine.toLowerCase() !== core.address.toLowerCase()) {
    console.log("⚙️  Setting Vault settlementEngine to AequitasCore...");
    const txEngine = await vaultContract.setSettlementEngine(core.address);
    await txEngine.wait();
    console.log("✅ Vault settlementEngine configured");
  }

  console.log("✅ Aequitas-R deployment complete.");
  console.log("----------------------------------------------------");
};

export default deployAequitas;
deployAequitas.tags = ["Aequitas"];
