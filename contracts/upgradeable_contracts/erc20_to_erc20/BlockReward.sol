pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../../interfaces/IBridgeValidators.sol";

/**
 * @title BlockReward
 * @dev Super simple implementation of a BlockReward smart contract.
 * Any fee/reward that will be minted from the bridge will be accumulated in this smart contract
 * and the owner will be able to claim those tokens.
 * This BlockReward contract is not compatible with native tokens.
 */
contract BlockReward is Ownable {
    using SafeMath for uint256;
    event BridgeTokenRewardAdded(uint256 indexed amount, uint256 indexed cumulativeAmount);

    address public token;
    address public bridgeContract;
    uint256 public totalMinted = 0;
    bool public isInitialized = false;

    bytes4 internal constant MINT_REWARD = 0x91c0aabf; // mintReward(uint256)

    /**
     * @dev Only the bridge smart contract can trigger
     */
    modifier onlyBridge() {
        require(msg.sender == bridgeContract);
        _;
    }

    /**
     * @dev Once the BlockReward contract is deployed, then the owner needs to set the Token. This can happen only once!
     * @param _token address of the claimed token.
     * @param _bridgeContract address of the bridge smart contract.
     */
    function initialize(address _token, address _bridgeContract) external onlyOwner {
        require(!isInitialized);
        require(_token != address(0));
        require(_bridgeContract != address(0));
        token = _token;
        bridgeContract = _bridgeContract;

        isInitialized = true;
    }

    /**
     * @dev Allows the owner to claim all the tokens held by this smart contract.
     */
    function claimTokens() external onlyOwner {
        require(isInitialized);
        require(ERC20(token).transfer(msg.sender, ERC20(token).balanceOf(this)));
    }

    /**
     * @dev This method is called by the BlockRewardFeeManager contract, whenever it needs to
     * "distributeFeeFromAffirmation" or "distributeFeeFromSignatures". The logic here is simple again,
     * we call the MINT_REWARD method of the Token, which mint new tokens to this smart contract, which is specified
     * as the "blockRewardContract" on the Token, which is "ERC677BridgeTokenRewardable".
     * @param _amount fee amount to be rewarded.
     */
    function addBridgeTokenRewardReceivers(uint256 _amount) external onlyBridge {
        require(isInitialized);
        require(_amount != 0);
        totalMinted = totalMinted.add(_amount);
        require(token.call(abi.encodeWithSelector(MINT_REWARD, _amount)));
        emit BridgeTokenRewardAdded(_amount, totalMinted);
    }

    function blockRewardContractId() public pure returns (bytes4) {
        return bytes4(keccak256("blockReward"));
    }
}
