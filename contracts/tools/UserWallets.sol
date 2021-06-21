pragma solidity 0.5.10;

contract UserWallets {

    struct Wallet {
        mapping(address => uint256) securityTokensIndex;
        address[] securityTokens;
        mapping(address => uint256) stableCoinsIndex;
        address[] stableCoins;
    }

    event AddUserWallet(
        address user,
        address[] securityTokens,
        address[] stableCoins
    );

    event RemoveUserWallet(
        address user
    );

    event AddUserTokens(
        address user,
        address[] securityTokens,
        address[] stableCoins
    );

    event RemoveUserTokens(
        address user,
        address[] securityTokens,
        address[] stableCoins
    );

    address public owner;
    uint256 constant MAX_TOKENS = 20;
    mapping(address => Wallet) userWallets;

    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    function _onlyOwner() internal view {
        require(msg.sender == owner, "Only owner");
    }


    constructor() public {
        owner = msg.sender;
    }

    function setNewOwner(address _owner) public onlyOwner {
        owner = _owner;
    }

    function addUserWallet(address _user, address[] memory _securityTokens, address[] memory _stableCoins) public{
        require((_user == msg.sender) || (msg.sender == owner), "UserWallets: Not authorized to create this user");

        Wallet storage wallet = userWallets[_user];

        require((wallet.securityTokens.length == 0) && (wallet.stableCoins.length == 0), "UserWallets: User already instantiated");

        require(_securityTokens.length <= MAX_TOKENS, "UserWallets: Cannot process so many security tokens at a time");
        require(_stableCoins.length <= MAX_TOKENS, "UserWallets: Cannot process so many stablecoins at a time");

        for (uint i = 0; i < _securityTokens.length; i++) {
            uint256 index = wallet.securityTokens.push(_securityTokens[i]);
            wallet.securityTokensIndex[_securityTokens[i]] = index;
        }

        for (uint i = 0; i < _stableCoins.length; i++) {
            uint256 index = wallet.stableCoins.push(_stableCoins[i]);
            wallet.stableCoinsIndex[_stableCoins[i]] = index;
        }

        emit AddUserWallet(_user, _securityTokens, _stableCoins);
    }

    function removeUserWallet(address _user) public{
        require((_user == msg.sender) || (msg.sender == owner), "UserWallets: Not authorized to remove this user");

        Wallet storage wallet = userWallets[_user];

        require((wallet.securityTokens.length + wallet.stableCoins.length) > 0, "UserWallets: User not instantiated");

        delete(userWallets[_user]);

        emit RemoveUserWallet(_user);
    }

    function addUserTokens(address _user, address[] memory _securityTokens, address[] memory _stableCoins) public{
        require((_user == msg.sender) || (msg.sender == owner), "UserWallets: Not authorized to create this user");

        Wallet storage wallet = userWallets[_user];

        require((wallet.securityTokens.length + wallet.stableCoins.length) > 0, "UserWallets: User not instantiated");

        require(_securityTokens.length <= MAX_TOKENS, "UserWallets: Cannot process so many security tokens at a time");
        require(_stableCoins.length <= MAX_TOKENS, "UserWallets: Cannot process so many stablecoins at a time");

        for (uint i = 0; i < _securityTokens.length; i++) {
            if(!checkInSecurityTokenWallet(_user, _securityTokens[i])) {
                uint256 index = wallet.securityTokens.push(_securityTokens[i]);
                wallet.securityTokensIndex[_securityTokens[i]] = index;
            }
        }
        for (uint i = 0; i < _stableCoins.length; i++) {
            if(!checkInStableCoinWallet(_user, _stableCoins[i])) {
                uint256 index = wallet.stableCoins.push(_stableCoins[i]);
                wallet.stableCoinsIndex[_stableCoins[i]] = index;
            }
        }

        emit AddUserTokens(_user, _securityTokens, _stableCoins);
    }

    function removeUserTokens(address _user, address[] memory _securityTokens, address[] memory _stableCoins) public{
        require((_user == msg.sender) || (msg.sender == owner), "UserWallets: Not authorized to create this user");

        Wallet storage wallet = userWallets[_user];

        require((wallet.securityTokens.length + wallet.stableCoins.length) > 0, "UserWallets: User not instantiated");

        require(_securityTokens.length <= MAX_TOKENS, "UserWallets: Cannot process so many security tokens at a time");
        require(_stableCoins.length <= MAX_TOKENS, "UserWallets: Cannot process so many stablecoins at a time");

        for (uint i = 0; i < _securityTokens.length; i++) {
            if(checkInSecurityTokenWallet(_user, _securityTokens[i])) {
                uint256 rowToDelete = wallet.securityTokensIndex[_securityTokens[i]];
                address keyToMove = wallet.securityTokens[wallet.securityTokens.length-1];
                wallet.securityTokens[rowToDelete] = keyToMove;
                wallet.securityTokensIndex[keyToMove] = rowToDelete;
                wallet.securityTokens.length--;
                delete(wallet.securityTokensIndex[_securityTokens[i]]);
            }
        }
        for (uint i = 0; i < _stableCoins.length; i++) {
            if(checkInStableCoinWallet(_user, _stableCoins[i])) {
                uint256 rowToDelete = wallet.stableCoinsIndex[_stableCoins[i]];
                address keyToMove = wallet.stableCoins[wallet.stableCoins.length-1];
                wallet.stableCoins[rowToDelete] = keyToMove;
                wallet.stableCoinsIndex[keyToMove] = rowToDelete;
                wallet.stableCoins.length--;
                delete(wallet.stableCoinsIndex[_stableCoins[i]]);
            }
        }

        emit RemoveUserTokens(_user, _securityTokens, _stableCoins);
    }

    function checkInStableCoinWallet(address _user, address _tokenAddress) public view returns (bool isAddress) {
        Wallet storage wallet = userWallets[_user];
        if(wallet.stableCoins.length == 0) return false;
        return (wallet.stableCoins[wallet.stableCoinsIndex[_tokenAddress]] == _tokenAddress);
    }

    function checkInSecurityTokenWallet(address _user, address _tokenAddress) public view returns (bool isAddress) {
        Wallet storage wallet = userWallets[_user];
        if(wallet.securityTokens.length == 0) return false;
        return (wallet.securityTokens[wallet.securityTokensIndex[_tokenAddress]] == _tokenAddress);
    }

    function checkWalletsForTokens(address _user, address[] calldata _stableCoins, address[] calldata _securityTokens) external view returns (bool[] memory stableCoins, bool[] memory securityTokens){
        bool[] memory a = new bool[](_stableCoins.length);
        for (uint i=0; i< _stableCoins.length; i++) {
            a[i] = checkInStableCoinWallet(_user, _stableCoins[i]);
        }

        bool[] memory b = new bool[](_securityTokens.length);
        for (uint i=0; i< _securityTokens.length; i++) {
            b[i] = checkInSecurityTokenWallet(_user, _securityTokens[i]);
        }

        return (a,b);
    }

    function getUserWallet(address _user) public view returns (address[] memory stableCoins, address[] memory securityTokens){
        Wallet storage wallet = userWallets[_user];

        address[] memory a = new address[](wallet.stableCoins.length);
        for (uint i=0; i< wallet.stableCoins.length; i++) {
            a[i] = wallet.stableCoins[i];
        }

        address[] memory b = new address[](wallet.securityTokens.length);
        for (uint i=0; i< wallet.securityTokens.length; i++) {
            b[i] = wallet.securityTokens[i];
        }

        return (a,b);
    }
}
