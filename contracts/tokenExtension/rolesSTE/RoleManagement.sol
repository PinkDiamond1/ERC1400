pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/access/Roles.sol";
import "./AdminRole.sol";

/**
 * @title RoleManagement
 * @dev Role Management for different investor types in the security token ecosystem
 */
contract RoleManagement is AdminRole {
    using Roles for Roles.Role;

    event WhitelistedInvestorAdded(address indexed account);
    event WhitelistedInvestorRemoved(address indexed account);

    event BlacklistedInvestorAdded(address indexed account);
    event BlacklistedInvestorRemoved(address indexed account);

    event FriendsFamilyInvestorAdded(address indexed account);
    event FriendsFamilyInvestorRemoved(address indexed account);

    event AccreditedInvestorAdded(address indexed account);
    event AccreditedInvestorRemoved(address indexed account);

    event EligibleInvestorAdded(address indexed account);
    event EligibleInvestorRemoved(address indexed account);

    event DealerAdvisedInvestorAdded(address indexed account);
    event DealerAdvisedInvestorRemoved(address indexed account);

    uint256 internal constant ONE = uint256(1);

    // Roles available - // Index for role multi assigning
    Roles.Role private _whitelistedInvestors; // 0
    Roles.Role private _blacklistedInvestors; // 1
    Roles.Role private _friendsFamilyInvestors; // 2
    Roles.Role private _accreditedInvestors; // 3
    Roles.Role private _eligibleInvestors; // 4
    Roles.Role private _dealerAdvisedInvestors; // 5

    function getBoolean(uint256 _packedBools, uint256 _boolNumber)
    public view returns(bool)
    {
        uint256 flag = (_packedBools >> _boolNumber) & ONE;
        return (flag == 1 ? true : false);
    }
    /**
    * @dev kyc whitelist multiple users in a single transaction
    * @param kycUsers list of whitelisted users
    * @param flags list of whitelisted users flags in boolean form
    */
    function addRolesMulti(address[] calldata kycUsers, uint256[] calldata flags) external {
        for (uint256 i = 0; i < kycUsers.length; i++) {
            if(getBoolean(flags[i], uint256(0))){
                addWhitelisted(kycUsers[i]);
            }
            if(getBoolean(flags[i], uint256(1))){
                addBlacklisted(kycUsers[i]);
            }
            if(getBoolean(flags[i], uint256(2))){
                addFriendsFamilyInvestor(kycUsers[i]);
            }
            if(getBoolean(flags[i], uint256(3))){
                addAccreditedInvestor(kycUsers[i]);
            }
            if(getBoolean(flags[i], uint256(4))){
                addEligibleInvestor(kycUsers[i]);
            }
            if(getBoolean(flags[i], uint256(5))){
                addDealerAdvisedInvestor(kycUsers[i]);
            }
        }
    }

    // Whitelist
    modifier onlyWhitelisted() {
        require(isWhitelisted(msg.sender));
        _;
    }

    function isWhitelisted(address account) public view returns (bool) {
        return _whitelistedInvestors.has(account);
    }

    function addWhitelisted(address account) public onlyAdmin {
        _addWhitelisted(account);
    }

    function removeWhitelisted(address account) public onlyAdmin {
        _removeWhitelisted(account);
    }

    function _addWhitelisted(address account) internal {
        _whitelistedInvestors.add(account);
        emit WhitelistedInvestorAdded(account);
    }

    function _removeWhitelisted(address account) internal {
        _whitelistedInvestors.remove(account);
        emit WhitelistedInvestorRemoved(account);
    }


    // Blacklist
    modifier onlyNotBlacklisted() {
        require(!isBlacklisted(msg.sender));
        _;
    }

    function isBlacklisted(address account) public view returns (bool) {
        return _blacklistedInvestors.has(account);
    }

    function addBlacklisted(address account) public onlyAdmin {
        _addBlacklisted(account);
    }

    function removeBlacklisted(address account) public onlyAdmin {
        _removeBlacklisted(account);
    }

    function _addBlacklisted(address account) internal {
        _blacklistedInvestors.add(account);
        emit BlacklistedInvestorAdded(account);
    }

    function _removeBlacklisted(address account) internal {
        _blacklistedInvestors.remove(account);
        emit BlacklistedInvestorRemoved(account);
    }


    // FriendsFamily
    modifier onlyFriendsFamilyInvestor() {
        require(isFriendsFamilyInvestor(msg.sender));
        _;
    }

    function isFriendsFamilyInvestor(address account) public view returns (bool) {
        return _friendsFamilyInvestors.has(account);
    }

    function addFriendsFamilyInvestor(address account) public onlyAdmin {
        _addFriendsFamilyInvestor(account);
    }

    function removeFriendsFamilyInvestor(address account) public onlyAdmin {
        _removeFriendsFamilyInvestor(account);
    }

    function _addFriendsFamilyInvestor(address account) internal {
        _friendsFamilyInvestors.add(account);
        emit FriendsFamilyInvestorAdded(account);
    }

    function _removeFriendsFamilyInvestor(address account) internal {
        _friendsFamilyInvestors.remove(account);
        emit FriendsFamilyInvestorRemoved(account);
    }


    // Accredited
    modifier onlyAccreditedInvestor() {
        require(isAccreditedInvestor(msg.sender));
        _;
    }

    function isAccreditedInvestor(address account) public view returns (bool) {
        return _accreditedInvestors.has(account);
    }

    function addAccreditedInvestor(address account) public onlyAdmin {
        _addAccreditedInvestor(account);
    }

    function removeAccreditedInvestor(address account) public onlyAdmin {
        _removeAccreditedInvestor(account);
    }

    function _addAccreditedInvestor(address account) internal {
        _accreditedInvestors.add(account);
        emit AccreditedInvestorAdded(account);
    }

    function _removeAccreditedInvestor(address account) internal {
        _accreditedInvestors.remove(account);
        emit AccreditedInvestorRemoved(account);
    }


    // Eligible
    modifier onlyEligibleInvestor() {
        require(isEligibleInvestor(msg.sender));
        _;
    }

    function isEligibleInvestor(address account) public view returns (bool) {
        return _eligibleInvestors.has(account);
    }

    function addEligibleInvestor(address account) public onlyAdmin {
        _addEligibleInvestor(account);
    }

    function removeEligibleInvestor(address account) public onlyAdmin {
        _removeEligibleInvestor(account);
    }

    function _addEligibleInvestor(address account) internal {
        _eligibleInvestors.add(account);
        emit EligibleInvestorAdded(account);
    }

    function _removeEligibleInvestor(address account) internal {
        _eligibleInvestors.remove(account);
        emit EligibleInvestorRemoved(account);
    }


    // DealerAdvised
    modifier onlyDealerAdvisedInvestor() {
        require(isDealerAdvisedInvestor(msg.sender));
        _;
    }

    function isDealerAdvisedInvestor(address account) public view returns (bool) {
        return _dealerAdvisedInvestors.has(account);
    }

    function addDealerAdvisedInvestor(address account) public onlyAdmin {
        _addDealerAdvisedInvestor(account);
    }

    function removeDealerAdvisedInvestor(address account) public onlyAdmin {
        _removeDealerAdvisedInvestor(account);
    }

    function _addDealerAdvisedInvestor(address account) internal {
        _dealerAdvisedInvestors.add(account);
        emit DealerAdvisedInvestorAdded(account);
    }

    function _removeDealerAdvisedInvestor(address account) internal {
        _dealerAdvisedInvestors.remove(account);
        emit DealerAdvisedInvestorRemoved(account);
    }

}
