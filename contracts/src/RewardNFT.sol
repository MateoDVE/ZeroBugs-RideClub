// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice NFT no transferible que pasa de válido a consumido al usar el beneficio.
contract RewardNFT is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    struct RewardState {
        bytes32 companyId;
        bytes32 rewardId;
        bool valid;
    }

    uint256 private _nextTokenId = 1;
    mapping(uint256 => RewardState) public rewardState;
    mapping(uint256 => string) private _tokenURIs;

    error InvalidReward();
    error NonTransferable();

    constructor(address manager) ERC721("RideClub Reward", "RCR") {
        _grantRole(DEFAULT_ADMIN_ROLE, manager);
        _grantRole(MINTER_ROLE, manager);
    }

    function mint(
        address to,
        bytes32 companyId,
        bytes32 rewardId,
        string calldata metadataURI
    ) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        rewardState[tokenId] = RewardState(companyId, rewardId, true);
        _tokenURIs[tokenId] = metadataURI;
        _safeMint(to, tokenId);
    }

    function consume(uint256 tokenId) external onlyRole(MINTER_ROLE) {
        if (!rewardState[tokenId].valid) revert InvalidReward();
        rewardState[tokenId].valid = false;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _tokenURIs[tokenId];
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address from)
    {
        from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert NonTransferable();
        return super._update(to, tokenId, auth);
    }
}

