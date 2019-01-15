pragma solidity 0.4.24;

contract IHomeBridge {

  function initialize(address _validatorContract, uint256 _dailyLimit, uint256 _maxPerTx, uint256 _minPerTx, uint256 _homeGasPrice, uint256 _requiredBlockConfirmations, address _erc677token) public returns(bool);
  
}
