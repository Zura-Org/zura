import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

const ARC_USDC = "0x3600000000000000000000000000000000000000";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying to ${network.name} as ${deployer.address}`);

  let usdc = process.env.USDC_ADDRESS || ARC_USDC;
  if (network.name === "hardhat") {
    const mock = await ethers.deployContract("MockUSDC");
    await mock.waitForDeployment();
    usdc = await mock.getAddress();
    console.log(`MockUSDC      ${usdc}`);
  }

  const operator = process.env.OPERATOR_ADDRESS || deployer.address;
  const treasury = process.env.TREASURY_ADDRESS || deployer.address;

  const registry = await ethers.deployContract("WaveRegistry", [deployer.address]);
  await registry.waitForDeployment();
  console.log(`WaveRegistry  ${await registry.getAddress()}`);

  const factory = await ethers.deployContract("WaveFactory", [
    usdc,
    await registry.getAddress(),
    operator,
    treasury,
    deployer.address,
  ]);
  await factory.waitForDeployment();
  console.log(`WaveFactory   ${await factory.getAddress()}`);

  await (await registry.setRegistrar(await factory.getAddress(), true)).wait();

  const badge = await ethers.deployContract("ReputationBadge", [deployer.address]);
  await badge.waitForDeployment();
  console.log(`ReputationBadge ${await badge.getAddress()}`);
  await (await badge.setMinter(operator, true)).wait();

  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    operator,
    treasury,
    usdc,
    waveRegistry: await registry.getAddress(),
    waveFactory: await factory.getAddress(),
    reputationBadge: await badge.getAddress(),
  };

  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${network.name}.json`), JSON.stringify(out, null, 2));
  console.log(`Saved deployments/${network.name}.json`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
