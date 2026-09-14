import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const USDC = (n: number) => BigInt(Math.round(n * 1e6));
const DAY = 24 * 60 * 60;

async function deployFixture() {
  const [admin, operator, treasury, projectOwner, alice, bob, carol, stranger] = await ethers.getSigners();

  const usdc = await ethers.deployContract("MockUSDC");
  const registry = await ethers.deployContract("WaveRegistry", [admin.address]);
  const factory = await ethers.deployContract("WaveFactory", [
    await usdc.getAddress(),
    await registry.getAddress(),
    operator.address,
    treasury.address,
    admin.address,
  ]);
  await registry.setRegistrar(await factory.getAddress(), true);
  const badge = await ethers.deployContract("ReputationBadge", [admin.address]);
  await badge.setMinter(operator.address, true);

  await usdc.mint(projectOwner.address, USDC(100_000));

  await factory.connect(projectOwner).createWave("wave-1", "project-1", 14);
  const info = await registry.getWave("wave-1");
  const pool = await ethers.getContractAt("WavePool", info.pool);

  return { admin, operator, treasury, projectOwner, alice, bob, carol, stranger, usdc, registry, factory, badge, pool };
}

async function fundedFixture() {
  const f = await deployFixture();
  await f.usdc.connect(f.projectOwner).approve(await f.pool.getAddress(), USDC(10_000));
  await f.pool.connect(f.projectOwner).deposit(USDC(10_000));
  return f;
}

describe("WaveFactory + WaveRegistry", () => {
  it("registers waves permissionlessly", async () => {
    const { registry, projectOwner, pool } = await loadFixture(deployFixture);
    const w = await registry.getWave("wave-1");
    expect(w.projectId).to.equal("project-1");
    expect(w.owner).to.equal(projectOwner.address);
    expect(w.pool).to.equal(await pool.getAddress());
    expect(w.status).to.equal(0);
    expect(w.endTime - w.startTime).to.equal(BigInt(14 * DAY));
    expect(await registry.waveCount()).to.equal(1n);
  });

  it("rejects invalid durations and duplicate ids", async () => {
    const { factory, stranger } = await loadFixture(deployFixture);
    await expect(factory.connect(stranger).createWave("x", "p", 10)).to.be.revertedWithCustomError(factory, "InvalidDuration");
    await expect(factory.connect(stranger).createWave("wave-1", "p", 7)).to.be.reverted;
  });

  it("only registrars can write", async () => {
    const { registry, stranger } = await loadFixture(deployFixture);
    await expect(
      registry.connect(stranger).createWave("w", "p", stranger.address, 1n, stranger.address),
    ).to.be.revertedWithCustomError(registry, "NotRegistrar");
  });
});

describe("WavePool", () => {
  it("takes a 4% fee on deposit and locks the rest", async () => {
    const { pool, usdc, treasury } = await loadFixture(fundedFixture);
    expect(await usdc.balanceOf(treasury.address)).to.equal(USDC(400));
    expect(await pool.lockedAmount()).to.equal(USDC(9_600));
    expect(await usdc.balanceOf(await pool.getAddress())).to.equal(USDC(9_600));
    expect(await pool.status()).to.equal(1);
  });

  it("only the owner can deposit, and not after the wave ends", async () => {
    const { pool, stranger, projectOwner } = await loadFixture(fundedFixture);
    await expect(pool.connect(stranger).deposit(1)).to.be.revertedWithCustomError(pool, "NotOwner");
    await time.increaseTo(await pool.endTime());
    await expect(pool.connect(projectOwner).deposit(1)).to.be.revertedWithCustomError(pool, "WaveEnded");
  });

  it("distributes proportionally and empties the pool exactly", async () => {
    const { pool, usdc, operator, alice, bob, carol } = await loadFixture(fundedFixture);
    await time.increaseTo(await pool.endTime());

    // easy(100) + hard(700) + medium(300) = 1100
    await expect(
      pool.connect(operator).distribute([alice.address, bob.address, carol.address], [100, 700, 300], 1100),
    ).to.emit(pool, "Distributed");

    const a = await usdc.balanceOf(alice.address);
    const b = await usdc.balanceOf(bob.address);
    const c = await usdc.balanceOf(carol.address);
    expect(a).to.equal((USDC(9_600) * 100n) / 1100n);
    expect(b).to.equal((USDC(9_600) * 700n) / 1100n);
    expect(a + b + c).to.equal(USDC(9_600));
    expect(await usdc.balanceOf(await pool.getAddress())).to.equal(0n);
    expect(await pool.status()).to.equal(2);
  });

  it("guards distribute", async () => {
    const { pool, operator, stranger, alice, bob } = await loadFixture(fundedFixture);
    await expect(pool.connect(operator).distribute([alice.address], [100], 100)).to.be.revertedWithCustomError(pool, "WaveNotEnded");
    await time.increaseTo(await pool.endTime());
    await expect(pool.connect(stranger).distribute([alice.address], [100], 100)).to.be.revertedWithCustomError(pool, "NotOperator");
    await expect(pool.connect(operator).distribute([alice.address, bob.address], [100], 100)).to.be.revertedWithCustomError(pool, "LengthMismatch");
    await expect(pool.connect(operator).distribute([alice.address], [100], 101)).to.be.revertedWithCustomError(pool, "PointsMismatch");
    await expect(pool.connect(operator).distribute([ethers.ZeroAddress], [100], 100)).to.be.revertedWithCustomError(pool, "ZeroAddress");
    await pool.connect(operator).distribute([alice.address], [100], 100);
    await expect(pool.connect(operator).distribute([alice.address], [100], 100)).to.be.revertedWithCustomError(pool, "InvalidState");
  });

  it("refunds after the operator confirms zero contributions", async () => {
    const { pool, usdc, operator, projectOwner } = await loadFixture(fundedFixture);
    const before = await usdc.balanceOf(projectOwner.address);
    await time.increaseTo(await pool.endTime());
    await expect(pool.connect(projectOwner).emergencyRefund()).to.be.revertedWithCustomError(pool, "RefundLocked");
    await pool.connect(operator).enableRefund();
    await pool.connect(projectOwner).emergencyRefund();
    expect(await usdc.balanceOf(projectOwner.address)).to.equal(before + USDC(9_600));
    expect(await pool.status()).to.equal(3);
  });

  it("refunds after the grace period if never distributed", async () => {
    const { pool, projectOwner } = await loadFixture(fundedFixture);
    await time.increaseTo((await pool.endTime()) + BigInt(7 * DAY));
    await expect(pool.connect(projectOwner).emergencyRefund()).to.emit(pool, "Refunded");
  });
});

describe("ReputationBadge", () => {
  it("mints once, updates metadata and is soul-bound", async () => {
    const { badge, operator, alice, bob } = await loadFixture(deployFixture);
    await expect(badge.connect(operator).mint(alice.address)).to.emit(badge, "Locked").withArgs(1n);
    await expect(badge.connect(operator).mint(alice.address)).to.be.revertedWithCustomError(badge, "AlreadyMinted");
    expect(await badge.locked(1)).to.equal(true);

    await badge.connect(operator).updateMetadata(alice.address, USDC(1234.5), 7);
    const uri = await badge.tokenURI(1);
    const json = JSON.parse(Buffer.from(uri.split(",")[1], "base64").toString());
    expect(json.attributes[0].value).to.equal("1234.50");
    expect(json.attributes[1].value).to.equal(7);

    await expect(
      badge.connect(alice).transferFrom(alice.address, bob.address, 1),
    ).to.be.revertedWithCustomError(badge, "Soulbound");
    await expect(badge.connect(alice).approve(bob.address, 1)).to.be.revertedWithCustomError(badge, "Soulbound");
    expect(await badge.supportsInterface("0xb45a3c0e")).to.equal(true);
  });

  it("only minters can mint", async () => {
    const { badge, stranger } = await loadFixture(deployFixture);
    await expect(badge.connect(stranger).mint(stranger.address)).to.be.revertedWithCustomError(badge, "NotMinter");
  });
});
