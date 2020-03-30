pragma solidity 0.4.24;

import "../interfaces/IGasToken.sol";
import "../upgradeable_contracts/Ownable.sol";

/**
* @title GasTokenConnector
* @dev This logic allows to use GasToken (https://gastoken.io)
*/
contract GasTokenConnector is Ownable {
    bytes32 internal constant GAS_TOKEN_TARGET_MINT_VALUE = 0x7188f1264c90762deb4dbddcab803d6487a8f108fbcdec3ff08c642d35826f9f; // keccak256(abi.encodePacked("gasTokenTargetMintValue"))
    bytes32 internal constant GAS_TOKEN_RECEIVER = 0x6778a39b83358b10315b40840597142f1db77a44f312ed9c0e45ee7af3bbc552; // keccak256(abi.encodePacked("gasTokenReceiver"))
    bytes4 internal constant ON_TOKEN_TRANSFER = 0xa4c0ed36; // onTokenTransfer(address,uint256,bytes)

    /**
    * @dev Updates gas token related parameters, target mint value and token receiver
    * @param _targetMintValue target amount of token to mint/transfer during one call to _collectGasTokens
    * @param _receiver receiver of minted gas token
    */
    function setGasTokenParameters(uint256 _targetMintValue, address _receiver) external onlyOwner {
        uintStorage[GAS_TOKEN_TARGET_MINT_VALUE] = _targetMintValue;
        addressStorage[GAS_TOKEN_RECEIVER] = _receiver;
    }

    /**
    * @dev Updates gas token target mint value
    * @param _targetMintValue target amount of token to mint/transfer during one call to _collectGasTokens
    */
    function setGasTokenTargetMintValue(uint256 _targetMintValue) external onlyOwner {
        uintStorage[GAS_TOKEN_TARGET_MINT_VALUE] = _targetMintValue;
    }

    /**
    * @dev Updates gas token receiver
    * @param _receiver receiver of minted gas token
    */
    function setGasTokenReceiver(address _receiver) external onlyOwner {
        addressStorage[GAS_TOKEN_RECEIVER] = _receiver;
    }

    /**
    * @return Configured gas token target mint value
    */
    function gasTokenTargetMintValue() public view returns (uint256) {
        return uintStorage[GAS_TOKEN_TARGET_MINT_VALUE];
    }

    /**
    * @return Configured gas token receiver
    */
    function gasTokenReceiver() public view returns (address) {
        return addressStorage[GAS_TOKEN_RECEIVER];
    }

    /**
    * @return GST2 contract address in ethereum Mainnet
    */
    function gasToken() public pure returns (IGasToken) {
        return IGasToken(0x0000000000b3F879cb30FE243b4Dfee438691c04);
    }

    /**
    * @dev Internal function, for collection gas tokens
    * If sufficient allowance from sender exist, the new tokens are not minted at all
    * Otherwise, all allowance is taken + remaining tokens are minted
    * In total, configured target amount of tokens is transfered to gas token receiver
    */
    function _collectGasTokens() internal {
        uint256 target = gasTokenTargetMintValue();

        if (target == 0) return;

        address receiver = gasTokenReceiver();
        if (receiver == address(0)) return;

        IGasToken gst = gasToken();
        uint256 approved = gst.allowance(msg.sender, address(this));

        if (approved >= target) {
            // tokens are transfered directly to receiver, avoiding transfer to the bridge contract
            require(gst.transferFrom(msg.sender, receiver, target));
        } else {
            if (approved > 0) {
                require(gst.transferFrom(msg.sender, address(this), approved));
            }

            gst.mint(target - approved);
            require(gst.transfer(receiver, target));
        }

        receiver.call(abi.encodeWithSelector(ON_TOKEN_TRANSFER, address(this), target, ""));
    }
}
