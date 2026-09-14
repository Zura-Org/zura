// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IWavePoolView {
    function status() external view returns (uint8);
    function lockedAmount() external view returns (uint256);
    function totalDeposited() external view returns (uint256);
}

/// @title WaveRegistry
/// @notice On-chain index of every Zura Wave. Registrars (the WaveFactory) write, anyone reads.
contract WaveRegistry is Ownable {
    struct Wave {
        string projectId;
        address pool;
        address owner;
        uint256 startTime;
        uint256 endTime;
        bool exists;
    }

    struct WaveView {
        string waveId;
        string projectId;
        address pool;
        address owner;
        uint256 startTime;
        uint256 endTime;
        uint8 status;
        uint256 lockedAmount;
        uint256 totalDeposited;
    }

    mapping(string => Wave) private _waves;
    string[] private _waveIds;
    mapping(address => bool) public registrars;

    event RegistrarSet(address indexed registrar, bool allowed);
    event WaveCreated(string waveId, string projectId, address indexed pool, address indexed owner, uint256 endTime);

    error NotRegistrar();
    error WaveExists();
    error UnknownWave();
    error ZeroAddress();

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setRegistrar(address registrar, bool allowed) external onlyOwner {
        if (registrar == address(0)) revert ZeroAddress();
        registrars[registrar] = allowed;
        emit RegistrarSet(registrar, allowed);
    }

    function createWave(
        string calldata waveId,
        string calldata projectId,
        address waveOwner,
        uint256 endTime,
        address poolAddress
    ) external {
        if (!registrars[msg.sender]) revert NotRegistrar();
        if (poolAddress == address(0) || waveOwner == address(0)) revert ZeroAddress();
        if (_waves[waveId].exists) revert WaveExists();

        _waves[waveId] = Wave({
            projectId: projectId,
            pool: poolAddress,
            owner: waveOwner,
            startTime: block.timestamp,
            endTime: endTime,
            exists: true
        });
        _waveIds.push(waveId);

        emit WaveCreated(waveId, projectId, poolAddress, waveOwner, endTime);
    }

    function getWave(string calldata waveId) external view returns (WaveView memory v) {
        Wave storage w = _waves[waveId];
        if (!w.exists) revert UnknownWave();
        IWavePoolView pool = IWavePoolView(w.pool);
        v = WaveView({
            waveId: waveId,
            projectId: w.projectId,
            pool: w.pool,
            owner: w.owner,
            startTime: w.startTime,
            endTime: w.endTime,
            status: pool.status(),
            lockedAmount: pool.lockedAmount(),
            totalDeposited: pool.totalDeposited()
        });
    }

    function waveExists(string calldata waveId) external view returns (bool) {
        return _waves[waveId].exists;
    }

    function waveCount() external view returns (uint256) {
        return _waveIds.length;
    }

    function waveIdAt(uint256 index) external view returns (string memory) {
        return _waveIds[index];
    }
}
