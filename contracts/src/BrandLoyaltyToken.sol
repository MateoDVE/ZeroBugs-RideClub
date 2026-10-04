// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @notice Token de lealtad no transferible. Solo RideClub puede mintear o quemar.
contract BrandLoyaltyToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    error NonTransferable();

    constructor(string memory name_, string memory symbol_, address manager)
        ERC20(name_, symbol_)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, manager);
        _grantRole(MINTER_ROLE, manager);
    }

    function decimals() public pure override returns (uint8) {
        return 0;
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burnFrom(address account, uint256 amount) external onlyRole(MINTER_ROLE) {
        _burn(account, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) revert NonTransferable();
        super._update(from, to, value);
    }
}

