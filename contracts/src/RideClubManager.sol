// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BrandLoyaltyToken} from "./BrandLoyaltyToken.sol";
import {RewardNFT} from "./RewardNFT.sol";

/// @notice Orquesta pagos, tokens por marca y NFTs de beneficios.
/// @dev Base de prototipo: debe auditarse y usar una multisig antes de producción.
contract RideClubManager is Ownable {
    using SafeERC20 for IERC20;

    struct Company {
        address treasury;
        BrandLoyaltyToken token;
        bool active;
    }

    struct BikeOffer {
        uint256 priceUSDT;
        uint256 tokenReward;
        bool active;
    }

    struct RewardOffer {
        uint256 tokenCost;
        string metadataURI;
        bool active;
    }

    IERC20 public immutable paymentToken;
    RewardNFT public immutable rewardNFT;
    mapping(bytes32 => Company) public companies;
    mapping(bytes32 => mapping(bytes32 => BikeOffer)) public bikes;
    mapping(bytes32 => mapping(bytes32 => RewardOffer)) public rewards;

    error CompanyUnavailable();
    error OfferUnavailable();
    error UnauthorizedCompany();
    error AlreadyExists();

    event CompanyRegistered(bytes32 indexed companyId, address treasury, address token);
    event BikeConfigured(bytes32 indexed companyId, bytes32 indexed bikeId, uint256 priceUSDT, uint256 tokenReward);
    event RewardConfigured(bytes32 indexed companyId, bytes32 indexed rewardId, uint256 tokenCost);
    event BikePurchased(address indexed buyer, bytes32 indexed companyId, bytes32 indexed bikeId, uint256 amountUSDT, uint256 tokensMinted);
    event RewardRedeemed(address indexed owner, bytes32 indexed companyId, bytes32 indexed rewardId, uint256 tokenId, uint256 tokensBurned);
    event RewardConsumed(uint256 indexed tokenId, bytes32 indexed companyId, address indexed validator);

    constructor(IERC20 paymentToken_) Ownable(msg.sender) {
        paymentToken = paymentToken_;
        rewardNFT = new RewardNFT(address(this));
    }

    function registerCompany(
        bytes32 companyId,
        address treasury,
        string calldata tokenName,
        string calldata tokenSymbol
    ) external onlyOwner returns (address tokenAddress) {
        if (address(companies[companyId].token) != address(0)) revert AlreadyExists();
        BrandLoyaltyToken token = new BrandLoyaltyToken(tokenName, tokenSymbol, address(this));
        companies[companyId] = Company(treasury, token, true);
        emit CompanyRegistered(companyId, treasury, address(token));
        return address(token);
    }

    function setCompany(bytes32 companyId, address treasury, bool active) external onlyOwner {
        Company storage company = companies[companyId];
        if (address(company.token) == address(0)) revert CompanyUnavailable();
        company.treasury = treasury;
        company.active = active;
    }

    function setBike(
        bytes32 companyId,
        bytes32 bikeId,
        uint256 priceUSDT,
        uint256 tokenReward,
        bool active
    ) external onlyOwner {
        _activeCompany(companyId);
        bikes[companyId][bikeId] = BikeOffer(priceUSDT, tokenReward, active);
        emit BikeConfigured(companyId, bikeId, priceUSDT, tokenReward);
    }

    function setReward(
        bytes32 companyId,
        bytes32 rewardId,
        uint256 tokenCost,
        string calldata metadataURI,
        bool active
    ) external onlyOwner {
        _activeCompany(companyId);
        rewards[companyId][rewardId] = RewardOffer(tokenCost, metadataURI, active);
        emit RewardConfigured(companyId, rewardId, tokenCost);
    }

    function purchase(bytes32 companyId, bytes32 bikeId) external {
        Company storage company = _activeCompany(companyId);
        BikeOffer memory offer = bikes[companyId][bikeId];
        if (!offer.active || offer.priceUSDT == 0) revert OfferUnavailable();
        paymentToken.safeTransferFrom(msg.sender, company.treasury, offer.priceUSDT);
        company.token.mint(msg.sender, offer.tokenReward);
        emit BikePurchased(msg.sender, companyId, bikeId, offer.priceUSDT, offer.tokenReward);
    }

    function redeem(bytes32 companyId, bytes32 rewardId) external returns (uint256 tokenId) {
        Company storage company = _activeCompany(companyId);
        RewardOffer memory offer = rewards[companyId][rewardId];
        if (!offer.active || offer.tokenCost == 0) revert OfferUnavailable();
        company.token.burnFrom(msg.sender, offer.tokenCost);
        tokenId = rewardNFT.mint(msg.sender, companyId, rewardId, offer.metadataURI);
        emit RewardRedeemed(msg.sender, companyId, rewardId, tokenId, offer.tokenCost);
    }

    function consumeReward(uint256 tokenId) external {
        (bytes32 companyId,,) = rewardNFT.rewardState(tokenId);
        Company storage company = companies[companyId];
        if (msg.sender != company.treasury && msg.sender != owner()) revert UnauthorizedCompany();
        rewardNFT.consume(tokenId);
        emit RewardConsumed(tokenId, companyId, msg.sender);
    }

    function _activeCompany(bytes32 companyId) internal view returns (Company storage company) {
        company = companies[companyId];
        if (!company.active || address(company.token) == address(0)) revert CompanyUnavailable();
    }
}
