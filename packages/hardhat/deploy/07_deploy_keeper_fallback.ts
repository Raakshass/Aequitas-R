import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployKeeperFallback: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, get } = hre.deployments;

  console.log("----------------------------------------------------");
  console.log("🛰  Deploying KeeperFallback (on-chain keeper helper)...");

  // Reuse already-deployed core + shutter
  const core = await get("AequitasCore");
  const shutter = await get("MockShutter");

  // callerRewardWei = 0 for now; you can fund + change later on-chain
  const callerRewardWei = 0;

  await deploy("KeeperFallback", {
    from: deployer,
    args: [core.address, shutter.address, callerRewardWei],
    log: true,
    autoMine: true,
  });

  console.log("✅ KeeperFallback deployment complete.");
  console.log("----------------------------------------------------");
};

export default deployKeeperFallback;
deployKeeperFallback.tags = ["KeeperFallback"];
