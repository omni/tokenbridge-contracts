pragma solidity 0.4.24;

import "../interfaces/IChai.sol";
import "../interfaces/ERC677Receiver.sol";
import "./Initializable.sol";
import "./Ownable.sol";

/**
* @title InterestReceiver
* @dev Example contract for receiving Chai interest and immediatly converting it into Dai
*/
contract InterestReceiver is ERC677Receiver, Initializable, Ownable {
    /**
    * @dev Initializes interest receiver, sets an owner of a contract
    * @param _owner address of owner account, only owner can withdraw Dai tokens from contract
    */
    function initialize(address _owner) external {
        require(!isInitialized());
        setOwner(_owner);
        setInitialize();
    }

    /**
    * @return Chai token contract address
    */
    function chaiToken() public view returns (IChai) {
        return IChai(0x06AF07097C9Eeb7fD685c692751D5C66dB49c215);
    }

    /**
    * @dev ERC677 transfer callback function, received interest from Chai token is converted into Dai and sent to owner
    * @param _value amount of transferred tokens
    */
    function onTokenTransfer(address, uint256 _value, bytes) external returns (bool) {
        require(isInitialized());
        require(_value == chaiToken().balanceOf(address(this)));

        chaiToken().exit(address(this), _value);
    }

    /**
    * @dev Withdraws DAI tokens from the receiver contract
    * @param _to address of tokens receiver
    */
    function withdraw(address _to) external onlyOwner {
        chaiToken().daiToken().transfer(_to, chaiToken().daiToken().balanceOf(address(this)));
    }
}
