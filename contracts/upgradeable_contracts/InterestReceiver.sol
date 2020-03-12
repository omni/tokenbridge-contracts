pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IChai.sol";
import "../interfaces/ERC677Receiver.sol";
import "./Initializable.sol";
import "./Ownable.sol";
import "./Claimable.sol";
import "./TokenSwapper.sol";

/**
* @title InterestReceiver
* @dev Example contract for receiving Chai interest and immediatly converting it into Dai
*/
contract InterestReceiver is ERC677Receiver, Initializable, Ownable, Claimable, TokenSwapper {
    /**
    * @dev Initializes interest receiver, sets an owner of a contract
    * @param _owner address of owner account, only owner can withdraw Dai tokens from contract
    */
    function initialize(address _owner) external onlyRelevantSender {
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
    * @return Dai token contract address
    */
    function daiToken() public view returns (ERC20) {
        return ERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    }

    /**
    * @dev ERC677 transfer callback function, received interest from Chai token is converted into Dai and sent to owner
    * @param _value amount of transferred tokens
    */
    function onTokenTransfer(address, uint256 _value, bytes) external returns (bool) {
        require(isInitialized());

        uint256 chaiBalance = chaiToken().balanceOf(address(this));

        require(_value <= chaiBalance);

        uint256 initialDaiBalance = daiToken().balanceOf(address(this));

        chaiToken().exit(address(this), chaiBalance);

        // Dai balance cannot decrease here, so SafeMath is not needed
        uint256 redeemed = daiToken().balanceOf(address(this)) - initialDaiBalance;

        emit TokensSwapped(chaiToken(), daiToken(), redeemed);

        // chi is always >= 10**27, so chai/dai rate is always >= 1
        require(redeemed >= _value);
    }

    /**
    * @dev Withdraws DAI tokens from the receiver contract
    * @param _to address of tokens receiver
    */
    function withdraw(address _to) external onlyOwner {
        require(isInitialized());

        daiToken().transfer(_to, daiToken().balanceOf(address(this)));
    }

    /**
    * @dev Claims tokens from receiver account
    * @param _token address of claimed token, address(0) for native
    * @param _to address of tokens receiver
    */
    function claimTokens(address _token, address _to) external onlyOwner validAddress(_to) {
        require(_token != address(chaiToken()) && _token != address(daiToken()));
        claimValues(_token, _to);
    }
}
