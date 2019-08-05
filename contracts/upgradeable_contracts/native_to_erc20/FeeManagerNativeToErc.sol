pragma solidity 0.4.24;

import "../../interfaces/IBurnableMintableERC677Token.sol";
import "../Sacrifice.sol";
import "../ValidatorsFeeManager.sol";
import "../ERC677Storage.sol";

contract FeeManagerNativeToErc is ValidatorsFeeManager, ERC677Storage {
    function getFeeManagerMode() external pure returns (bytes4) {
        return bytes4(keccak256(abi.encodePacked("manages-one-direction")));
    }

    function erc677token() public view returns (IBurnableMintableERC677Token) {
        return IBurnableMintableERC677Token(addressStorage[ERC677_TOKEN]);
    }

    function onAffirmationFeeDistribution(address _rewardAddress, uint256 _fee) internal {
        if (!_rewardAddress.send(_fee)) {
            (new Sacrifice).value(_fee)(_rewardAddress);
        }
    }

    function onSignatureFeeDistribution(address _rewardAddress, uint256 _fee) internal {
        erc677token().mint(_rewardAddress, _fee);
    }
}
