import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployCommitReveal: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("CommitReveal", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });
};

export default deployCommitReveal;
deployCommitReveal.tags = ["CommitReveal"];
