// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title WavePool
/// @notice USDC escrow for a single Zura Wave (a time-boxed contribution sprint).
/// @dev On ARC, USDC is the native gas token and is also exposed through an ERC-20
///      interface (6 decimals) at 0x3600000000000000000000000000000000000000.
///      This pool only ever touches the ERC-20 interface.
contract WavePool is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        Pending, // created, not yet funded
        Funded, // USDC locked
        Distributed, // payouts sent
        Refunded // returned to project owner
    }

    uint256 public constant FEE_BPS = 400; // 4% Zura platform fee
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant MAX_RECIPIENTS = 200;
    /// @notice If the operator never distributes, the owner can reclaim funds after this window.
    uint256 public constant REFUND_GRACE_PERIOD = 7 days;

    IERC20 public immutable usdc;
    address public immutable owner;
    address public immutable operator;
    address public immutable treasury;
    uint256 public immutable startTime;
    uint256 public immutable endTime;
    string public waveId;

    Status public status;
    uint256 public totalDeposited;
    uint256 public totalFees;
    uint256 public lockedAmount;
    uint256 public totalDistributed;
    bool public refundEnabled;

    event Deposited(address indexed from, uint256 gross, uint256 fee, uint256 net);
    event Payout(address indexed contributor, uint256 points, uint256 amount);
    event Distributed(uint256 totalAmount, uint256 totalPoints, uint256 recipients);
    event RefundEnabled();
    event Refunded(address indexed owner, uint256 amount);

    error NotOwner();
    error NotOperator();
    error InvalidState();
    error WaveNotEnded();
    error WaveEnded();
    error ZeroAmount();
    error ZeroAddress();
    error LengthMismatch();
    error TooManyRecipients();
    error PointsMismatch();
    error RefundLocked();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyOperator() {
        if (msg.sender != operator) revert NotOperator();
        _;
    }

    constructor(
        IERC20 usdc_,
        address owner_,
        address operator_,
        address treasury_,
        uint256 endTime_,
        string memory waveId_
    ) {
        if (address(usdc_) == address(0) || owner_ == address(0) || operator_ == address(0) || treasury_ == address(0)) {
            revert ZeroAddress();
        }
        if (endTime_ <= block.timestamp) revert WaveEnded();
        usdc = usdc_;
        owner = owner_;
        operator = operator_;
        treasury = treasury_;
        startTime = block.timestamp;
        endTime = endTime_;
        waveId = waveId_;
    }

    /// @notice Fund (or top up) the Wave. 4% goes to the Zura treasury immediately, the rest is locked.
    /// @dev Caller must have approved this pool for `amount` on the USDC ERC-20 interface.
    function deposit(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (status != Status.Pending && status != Status.Funded) revert InvalidState();
        if (block.timestamp >= endTime) revert WaveEnded();

        uint256 fee = (amount * FEE_BPS) / BPS_DENOMINATOR;
        uint256 net = amount - fee;

        totalDeposited += amount;
        totalFees += fee;
        lockedAmount += net;
        status = Status.Funded;

        if (fee > 0) usdc.safeTransferFrom(msg.sender, treasury, fee);
        usdc.safeTransferFrom(msg.sender, address(this), net);

        emit Deposited(msg.sender, amount, fee, net);
    }

    /// @notice Pay every contributor their proportional share of the locked pool.
    /// @dev Integer-division dust is assigned to the final recipient so the pool empties exactly.
    function distribute(address[] calldata contributors, uint256[] calldata points, uint256 totalPoints)
        external
        onlyOperator
        nonReentrant
    {
        if (status != Status.Funded) revert InvalidState();
        if (block.timestamp < endTime) revert WaveNotEnded();
        uint256 n = contributors.length;
        if (n == 0 || n != points.length) revert LengthMismatch();
        if (n > MAX_RECIPIENTS) revert TooManyRecipients();

        uint256 sum;
        for (uint256 i; i < n; ++i) {
            if (points[i] == 0) revert PointsMismatch();
            sum += points[i];
        }
        if (sum != totalPoints) revert PointsMismatch();

        uint256 pool = lockedAmount;
        lockedAmount = 0;
        status = Status.Distributed;

        uint256 sent;
        for (uint256 i; i < n; ++i) {
            address to = contributors[i];
            if (to == address(0)) revert ZeroAddress();
            uint256 share = i == n - 1 ? pool - sent : (pool * points[i]) / totalPoints;
            sent += share;
            usdc.safeTransfer(to, share);
            emit Payout(to, points[i], share);
        }
        totalDistributed = sent;

        emit Distributed(sent, totalPoints, n);
    }

    /// @notice Operator confirms the Wave received zero merged contributions, unlocking an immediate refund.
    function enableRefund() external onlyOperator {
        if (status != Status.Funded) revert InvalidState();
        if (block.timestamp < endTime) revert WaveNotEnded();
        refundEnabled = true;
        emit RefundEnabled();
    }

    /// @notice Reclaim locked funds when the Wave had no contributions (or was never distributed).
    function emergencyRefund() external onlyOwner nonReentrant {
        if (status != Status.Funded) revert InvalidState();
        if (block.timestamp < endTime) revert WaveNotEnded();
        if (!refundEnabled && block.timestamp < endTime + REFUND_GRACE_PERIOD) revert RefundLocked();

        uint256 amount = lockedAmount;
        lockedAmount = 0;
        status = Status.Refunded;
        usdc.safeTransfer(owner, amount);

        emit Refunded(owner, amount);
    }

    function isActive() external view returns (bool) {
        return block.timestamp < endTime && (status == Status.Pending || status == Status.Funded);
    }
}
