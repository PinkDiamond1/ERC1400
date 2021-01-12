pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/access/Roles.sol";
import "./AdminRole.sol";
import "./IKycAddedUsers.sol";

/**
 * @title RoleManagement
 * @dev Role Management for different investor types in the security token ecosystem
 */
contract RoleManagement is AdminRole, IKycAddedUsers {
    using Roles for Roles.Role;

    struct KYCValidity {
        bool added;
        uint256 canSendAfter;
        uint256 canReceiveAfter;
        uint256 kycExpiredAfter;
    }

    mapping(address => KYCValidity) public kycValidityMap;
    address[] public kycAddedUsers;

    event MultiRolesAdded(address token, address[] accounts);

    event AllowlistedInvestorAdded(address token, address indexed account);
    event AllowlistedInvestorRemoved(address token, address indexed account);

    event BlocklistedInvestorAdded(address token, address indexed account);
    event BlocklistedInvestorRemoved(address token, address indexed account);

    event FriendsFamilyInvestorAdded(address token, address indexed account);
    event FriendsFamilyInvestorRemoved(address token, address indexed account);

    event AccreditedInvestorAdded(address indexed account);
    event AccreditedInvestorRemoved(address indexed account);

    event EligibleInvestorAdded(address token, address indexed account);
    event EligibleInvestorRemoved(address token, address indexed account);

    event EmployeeInvestorAdded(address token, address indexed account);
    event EmployeeInvestorRemoved(address token, address indexed account);

    event CorporateInvestorAdded(address token, address indexed account);
    event CorporateInvestorRemoved(address token, address indexed account);

    uint256 internal constant ONE = uint256(1);

    mapping(address => Roles.Role) private _allowlisteds; // 0
    mapping(address => Roles.Role) private _blocklisteds; // 1
    mapping(address => Roles.Role) private _friendsFamilyInvestors; // 2
    Roles.Role private _accreditedInvestors; // 3 Is a global flag
    mapping(address => Roles.Role) private _eligibleInvestors; // 4
    mapping(address => Roles.Role) private _employeeInvestors; // 5
    mapping(address => Roles.Role) private _corporateInvestors; // 6

    constructor(address owner) public
    AdminRole(owner)
    {
    }

    function getKycAddedUsers() external view returns(address[] memory users){
        return kycAddedUsers;
    }

    function getBoolean(uint256 _packedBools, uint256 _boolNumber)
    public pure returns(bool)
    {
        uint256 flag = (_packedBools >> _boolNumber) & ONE;
        return (flag == 1 ? true : false);
    }
    /**
    * @dev kyc allowlist multiple users in a single transaction
    * @param kycUsers list of allowlisted users
    * @param flags list of allowlisted users flags in boolean form
    */
    function addRolesMulti(address token, address[] calldata kycUsers, uint256[] calldata flags, uint256[] calldata canSendAfters, uint256[] calldata canReceiveAfters, uint256[] calldata kycExpiredAfters) external {
        for (uint256 i = 0; i < kycUsers.length; i++) {
            addKycValidTimes(kycUsers[i], canSendAfters[i], canReceiveAfters[i], kycExpiredAfters[i]);

            if(getBoolean(flags[i], uint256(0))){
                addAllowlisted(token, kycUsers[i]);
            }
            if(getBoolean(flags[i], uint256(1))){
                addBlocklisted(token, kycUsers[i]);
            }
            if(getBoolean(flags[i], uint256(2))){
                addFriendsFamilyInvestor(token, kycUsers[i]);
            }
            if(getBoolean(flags[i], uint256(3))){
                addAccreditedInvestor(kycUsers[i]);
            }
            if(getBoolean(flags[i], uint256(4))){
                addEligibleInvestor(token, kycUsers[i]);
            }
            if(getBoolean(flags[i], uint256(5))){
                addEmployeeInvestor(token, kycUsers[i]);
            }
            if(getBoolean(flags[i], uint256(6))){
                addCorporateInvestor(token, kycUsers[i]);
            }
        }
        emit MultiRolesAdded(token, kycUsers);
    }

    // KYC expiry and valid timings (UTC)
    function addKycValidTimes(address _account, uint256 _canSendAfter, uint256 _canReceiveAfter, uint256 _kycExpiredAfter) public onlyAdmin {
        // If this user has not been added previously, add it in to the kyc users
        if(kycValidityMap[_account].added == false){
            kycAddedUsers.push(_account);
            kycValidityMap[_account].added = true;
        }
        kycValidityMap[_account].canSendAfter = _canSendAfter;
        kycValidityMap[_account].canReceiveAfter = _canReceiveAfter;
        kycValidityMap[_account].kycExpiredAfter = _kycExpiredAfter;
    }

    function kycUserCanSend(address _account) public view returns (bool) {
        return (kycValidityMap[_account].canSendAfter <= now && !kycUserIsExpired(_account));
    }

    function kycUserCanReceive(address _account) public view returns (bool) {
        return (kycValidityMap[_account].canReceiveAfter <= now && !kycUserIsExpired(_account));
    }

    function kycUserIsExpired(address _account) public view returns (bool) {
        return (kycValidityMap[_account].kycExpiredAfter < now);
    }

    // Allowlist
    function isAllowlisted(address token, address account) public view returns (bool) {
        return _allowlisteds[token].has(account);
    }

    function addAllowlisted(address token, address account) public onlyAdmin {
        _addAllowlisted(token, account);
    }

    function removeAllowlisted(address token, address account) public onlyAdmin {
        _removeAllowlisted(token, account);
    }

    function _addAllowlisted(address token, address account) internal {
        _allowlisteds[token].add(account);
        emit AllowlistedInvestorAdded(token, account);
    }

    function _removeAllowlisted(address token, address account) internal {
        _allowlisteds[token].remove(account);
        emit AllowlistedInvestorRemoved(token, account);
    }

    // Blocklist
    function isBlocklisted(address token, address account) public view returns (bool) {
        return _blocklisteds[token].has(account);
    }

    function addBlocklisted(address token, address account) public onlyAdmin {
        _addBlocklisted(token, account);
    }

    function removeBlocklisted(address token, address account) public onlyAdmin {
        _removeBlocklisted(token, account);
    }

    function _addBlocklisted(address token, address account) internal {
        _blocklisteds[token].add(account);
        emit BlocklistedInvestorAdded(token, account);
    }

    function _removeBlocklisted(address token, address account) internal {
        _blocklisteds[token].remove(account);
        emit BlocklistedInvestorRemoved(token, account);
    }

    // Friends and Family
    function isFriendsFamilyInvestor(address token, address account) public view returns (bool) {
        return _friendsFamilyInvestors[token].has(account);
    }

    function addFriendsFamilyInvestor(address token, address account) public onlyAdmin {
        _addFriendsFamilyInvestor(token, account);
    }

    function removeFriendsFamilyInvestor(address token, address account) public onlyAdmin {
        _removeFriendsFamilyInvestor(token, account);
    }

    function _addFriendsFamilyInvestor(address token, address account) internal {
        _friendsFamilyInvestors[token].add(account);
        emit FriendsFamilyInvestorAdded(token, account);
    }

    function _removeFriendsFamilyInvestor(address token, address account) internal {
        _friendsFamilyInvestors[token].remove(account);
        emit FriendsFamilyInvestorRemoved(token, account);
    }

    // Accredited
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
    function isEligibleInvestor(address token, address account) public view returns (bool) {
        return _eligibleInvestors[token].has(account);
    }

    function addEligibleInvestor(address token, address account) public onlyAdmin {
        _addEligibleInvestor(token, account);
    }

    function removeEligibleInvestor(address token, address account) public onlyAdmin {
        _removeEligibleInvestor(token, account);
    }

    function _addEligibleInvestor(address token, address account) internal {
        _eligibleInvestors[token].add(account);
        emit EligibleInvestorAdded(token, account);
    }

    function _removeEligibleInvestor(address token, address account) internal {
        _eligibleInvestors[token].remove(account);
        emit EligibleInvestorRemoved(token, account);
    }

    // Employee
    function isEmployeeInvestor(address token, address account) public view returns (bool) {
        return _employeeInvestors[token].has(account);
    }

    function addEmployeeInvestor(address token, address account) public onlyAdmin {
        _addEmployeeInvestor(token, account);
    }

    function removeEmployeeInvestor(address token, address account) public onlyAdmin {
        _removeEmployeeInvestor(token, account);
    }

    function _addEmployeeInvestor(address token, address account) internal {
        _employeeInvestors[token].add(account);
        emit EmployeeInvestorAdded(token, account);
    }

    function _removeEmployeeInvestor(address token, address account) internal {
        _employeeInvestors[token].remove(account);
        emit EmployeeInvestorRemoved(token, account);
    }

    // Corporate
    function isCorporateInvestor(address token, address account) public view returns (bool) {
        return _corporateInvestors[token].has(account);
    }

    function addCorporateInvestor(address token, address account) public onlyAdmin {
        _addCorporateInvestor(token, account);
    }

    function removeCorporateInvestor(address token, address account) public onlyAdmin {
        _removeCorporateInvestor(token, account);
    }

    function _addCorporateInvestor(address token, address account) internal {
        _corporateInvestors[token].add(account);
        emit CorporateInvestorAdded(token, account);
    }

    function _removeCorporateInvestor(address token, address account) internal {
        _corporateInvestors[token].remove(account);
        emit CorporateInvestorRemoved(token, account);
    }
}
