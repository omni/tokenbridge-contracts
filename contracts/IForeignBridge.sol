pragma solidity 0.4.24;

contract IForeignBridge {

  function initialize(address _validatorContract, address _erc20token, uint256 _requiredBlockConfirmations, uint256 _gasPrice) public returns(bool);
  
}
