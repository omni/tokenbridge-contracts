pragma solidity 0.4.24;


import "./BasicForeignBridgeErcToErc.sol";


contract ForeignBridgeErcToErc is BasicForeignBridgeErcToErc {
    function initialize(
        address _validatorContract,
        address _erc20token,
        uint256 _requiredBlockConfirmations,
        uint256 _gasPrice,
        uint256 _maxPerTx,
        uint256 _homeDailyLimit,
        uint256 _homeMaxPerTx,
        address _owner
    ) public returns(bool) {
        _initialize(
            _validatorContract,
            _erc20token,
            _requiredBlockConfirmations,
            _gasPrice,
            _maxPerTx,
            _homeDailyLimit,
            _homeMaxPerTx,
            _owner
        );
        return isInitialized();
    }

    function erc20token() public view returns(ERC20Basic) {
        return ERC20Basic(addressStorage[keccak256(abi.encodePacked("erc20token"))]);
    }

    function setErc20token(address _token) internal {
        require(_token != address(0) && isContract(_token));
        addressStorage[keccak256(abi.encodePacked("erc20token"))] = _token;
    }
}
