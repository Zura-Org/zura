// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {WavePool} from "./WavePool.sol";
import {WaveRegistry} from "./WaveRegistry.sol";

/// @title WaveFactory
/// @notice Permissionless entry point: any ARC project owner can spin up a WavePool.
contract WaveFactory is Ownable {
    IERC20 public immutable usdc;
    WaveRegistry public immutable registry;
    address public operator;
    address public treasury;

    event WaveDeployed(string waveId, string projectId, address indexed pool, address indexed owner, uint256 endTime);
    event OperatorUpdated(address operator);
    event TreasuryUpdated(address treasury);

    error InvalidDuration();
    error ZeroAddress();

    constructor(IERC20 usdc_, WaveRegistry registry_, address operator_, address treasury_, address initialOwner)
        Ownable(initialOwner)
    {
        if (address(usdc_) == address(0) || address(registry_) == address(0)) revert ZeroAddress();
        if (operator_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        usdc = usdc_;
        registry = registry_;
        operator = operator_;
        treasury = treasury_;
    }

    /// @param durationDays Must be 7, 14 or 30.
    function createWave(string calldata waveId, string calldata projectId, uint256 durationDays)
        external
        returns (address pool)
    {
        if (durationDays != 7 && durationDays != 14 && durationDays != 30) revert InvalidDuration();
        uint256 endTime = block.timestamp + durationDays * 1 days;

        pool = address(new WavePool(usdc, msg.sender, operator, treasury, endTime, waveId));
        registry.createWave(waveId, projectId, msg.sender, endTime, pool);

        emit WaveDeployed(waveId, projectId, pool, msg.sender, endTime);
    }

    function setOperator(address operator_) external onlyOwner {
        if (operator_ == address(0)) revert ZeroAddress();
        operator = operator_;
        emit OperatorUpdated(operator_);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }
}
