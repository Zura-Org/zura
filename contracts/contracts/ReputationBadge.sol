// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title ReputationBadge
/// @notice Soul-bound (EIP-5192) ERC-721 recording a contributor's Zura track record.
contract ReputationBadge is ERC721, Ownable {
    using Strings for uint256;
    using Strings for address;

    struct Stats {
        uint256 totalEarned; // USDC, 6 decimals
        uint256 mergeCount;
        uint256 updatedAt;
    }

    mapping(address => bool) public minters;
    mapping(address => uint256) public badgeOf;
    mapping(uint256 => Stats) public stats;
    uint256 public totalMinted;

    /// @dev EIP-5192
    event Locked(uint256 tokenId);
    /// @dev ERC-4906
    event MetadataUpdate(uint256 _tokenId);
    event MinterSet(address indexed minter, bool allowed);
    event MetadataUpdated(address indexed contributor, uint256 indexed tokenId, uint256 totalEarned, uint256 mergeCount);

    error NotMinter();
    error AlreadyMinted();
    error NoBadge();
    error Soulbound();

    modifier onlyMinter() {
        if (!minters[msg.sender]) revert NotMinter();
        _;
    }

    constructor(address initialOwner) ERC721("Zura Reputation", "ZREP") Ownable(initialOwner) {}

    function setMinter(address minter, bool allowed) external onlyOwner {
        minters[minter] = allowed;
        emit MinterSet(minter, allowed);
    }

    function mint(address contributor) external onlyMinter returns (uint256 tokenId) {
        if (badgeOf[contributor] != 0) revert AlreadyMinted();
        tokenId = ++totalMinted;
        badgeOf[contributor] = tokenId;
        stats[tokenId].updatedAt = block.timestamp;
        _safeMint(contributor, tokenId);
        emit Locked(tokenId);
    }

    function updateMetadata(address contributor, uint256 totalEarned, uint256 mergeCount) external onlyMinter {
        uint256 tokenId = badgeOf[contributor];
        if (tokenId == 0) revert NoBadge();
        stats[tokenId] = Stats(totalEarned, mergeCount, block.timestamp);
        emit MetadataUpdated(contributor, tokenId, totalEarned, mergeCount);
        emit MetadataUpdate(tokenId);
    }

    /// @dev EIP-5192: every badge is permanently locked.
    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == 0xb45a3c0e /* IERC5192 */ || interfaceId == 0x49064906 /* IERC4906 */
            || super.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        address holder = _requireOwned(tokenId);
        Stats memory s = stats[tokenId];
        string memory earned = _formatUsdc(s.totalEarned);

        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">',
            '<rect width="400" height="400" rx="24" fill="#080810"/>',
            '<text x="32" y="72" fill="#7C5CFF" font-family="Inter,sans-serif" font-size="36" font-weight="700">ZURA</text>',
            '<text x="32" y="104" fill="#9a9ab0" font-family="Inter,sans-serif" font-size="16">Contributor Reputation</text>',
            '<text x="32" y="220" fill="#ffffff" font-family="Inter,sans-serif" font-size="40" font-weight="700">',
            earned,
            " USDC</text>",
            '<text x="32" y="260" fill="#9a9ab0" font-family="Inter,sans-serif" font-size="18">',
            s.mergeCount.toString(),
            " merged PRs</text>",
            "</svg>"
        );

        string memory json = string.concat(
            '{"name":"Zura Reputation #',
            tokenId.toString(),
            '","description":"Soul-bound record of open-source contributions rewarded on ARC via Zura.",',
            '"image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '","attributes":[{"trait_type":"Total Earned (USDC)","value":"',
            earned,
            '"},{"trait_type":"Merged PRs","display_type":"number","value":',
            s.mergeCount.toString(),
            '},{"trait_type":"Contributor","value":"',
            holder.toHexString(),
            '"}]}'
        );

        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    /// @dev Block every transfer except mint (from == 0). Burns are also disallowed.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }

    function _formatUsdc(uint256 amount) private pure returns (string memory) {
        uint256 whole = amount / 1e6;
        uint256 cents = (amount % 1e6) / 1e4;
        return string.concat(whole.toString(), ".", cents < 10 ? "0" : "", cents.toString());
    }
}
