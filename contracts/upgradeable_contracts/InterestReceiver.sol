pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";
import "../interfaces/IChai.sol";
import "../interfaces/ERC677Receiver.sol";
import "./Claimable.sol";
import "./TokenSwapper.sol";

/**
* @title InterestReceiver
* @dev Сontract for receiving Chai interest and immediatly converting it into Dai.
* Contract also will try to automaticaly relay tokens to configured xDai receiver
*/
contract InterestReceiver is ERC677Receiver, Ownable, Claimable, TokenSwapper {
    bytes4 internal constant RELAY_TOKENS = 0x01e4f53a; // relayTokens(address,uint256)

    address public bridgeContract;
    address public receiverInXDai;

    event RelayTokensFailed(address receiver, uint256 amount);

    /**
    * @dev Initializes interest receiver, sets an owner of a contract
    * @param _owner address of owner account, only owner can withdraw Dai tokens from contract
    * @param _bridgeContract address of the bridge contract in the foreign chain
    * @param _receiverInXDai address of the receiver account, in the xDai chain
    */
    constructor(address _owner, address _bridgeContract, address _receiverInXDai) public {
        require(AddressUtils.isContract(_bridgeContract));
        require(_receiverInXDai != address(0));
        _transferOwnership(_owner);
        bridgeContract = _bridgeContract;
        receiverInXDai = _receiverInXDai;
    }

    /**
    * @dev Updates bridge contract from which interest is expected to come from,
    * the incoming tokens will be relayed through this bridge also
    * @param _bridgeContract address of new contract in the foreign chain
    */
    function setBridgeContract(address _bridgeContract) external onlyOwner {
        require(AddressUtils.isContract(_bridgeContract));
        bridgeContract = _bridgeContract;
    }

    /**
    * @dev Updates receiver address in the xDai chain
    * @param _receiverInXDai address of new receiver account in the xDai chain
    */
    function setReceiverInXDai(address _receiverInXDai) external onlyOwner {
        require(_receiverInXDai != address(0));
        receiverInXDai = _receiverInXDai;
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
    * @dev ERC677 transfer callback function, received interest is converted from Chai token into Dai
    * and then relayed via bridge to xDai receiver
    */
    function onTokenTransfer(address, uint256, bytes) external returns (bool) {
        uint256 chaiBalance = chaiToken().balanceOf(address(this));
        uint256 initialDaiBalance = daiToken().balanceOf(address(this));
        uint256 finalDaiBalance = initialDaiBalance;

        if (chaiBalance > 0) {
            chaiToken().exit(address(this), chaiBalance);

            finalDaiBalance = daiToken().balanceOf(address(this));
            // Dai balance cannot decrease here, so SafeMath is not needed
            uint256 redeemed = finalDaiBalance - initialDaiBalance;

            emit TokensSwapped(chaiToken(), daiToken(), redeemed);

            // chi is always >= 10**27, so chai/dai rate is always >= 1
            require(redeemed >= chaiBalance);
        }

        daiToken().approve(address(bridgeContract), finalDaiBalance);
        if (!bridgeContract.call(abi.encodeWithSelector(RELAY_TOKENS, receiverInXDai, finalDaiBalance))) {
            daiToken().approve(address(bridgeContract), 0);
            emit RelayTokensFailed(receiverInXDai, finalDaiBalance);
        }
        return true;
    }

    /**
    * @dev Claims tokens from receiver account
    * @param _token address of claimed token, address(0) for native
    * @param _to address of tokens receiver
    */
    function claimTokens(address _token, address _to) external onlyOwner {
        // Only tokens other than CHAI/DAI can be claimed from this contract.
        require(_token != address(chaiToken()) && _token != address(daiToken()));
        claimValues(_token, _to);
    }
}
