pragma solidity 0.4.24;

import "../interfaces/IChai.sol";
import "../interfaces/ERC677Receiver.sol";
import "./Ownable.sol";
import "./ERC20Bridge.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
* @title ChaiConnector
* @dev This logic allows to use Chai token (https://github.com/dapphub/chai)
*/
contract ChaiConnector is Ownable, ERC20Bridge {
    using SafeMath for uint256;

    bytes32 internal constant CHAI_TOKEN_ENABLED = 0x2ae87563606f93f71ad2adf4d62661ccdfb63f3f508f94700934d5877fb92278; // keccak256(abi.encodePacked("chaiTokenEnabled"))
    bytes32 internal constant INTEREST_RECEIVER = 0xd88509eb1a8da5d5a2fc7b9bad1c72874c9818c788e81d0bc46b29bfaa83adf6; // keccak256(abi.encodePacked("interestReceiver"))
    bytes32 internal constant INTEREST_COLLECTION_PERIOD = 0x68a6a652d193e5d6439c4309583048050a11a4cfb263a220f4cd798c61c3ad6e; // keccak256(abi.encodePacked("interestCollectionPeriod"))
    bytes32 internal constant LAST_TIME_INTEREST_PAYED = 0x120db89f168bb39d737b6a1d240da847e2ead5ecca5b2e4c5e94edbe39d614d9; // keccak256(abi.encodePacked("lastTimeInterestPayed"))
    bytes32 internal constant INVESTED_AMOUNT = 0xb6afb3323c9d7dc0e9dab5d34c3a1d1ae7739d2224c048d4ee7675d3c759dd1b; // keccak256(abi.encodePacked("investedAmount"))
    bytes32 internal constant MIN_DAI_TOKEN_BALANCE = 0xce70e1dac97909c26a87aa4ada3d490673a153b3a75b22ea3364c4c7df7c551f; // keccak256(abi.encodePacked("minDaiTokenBalance"))

    uint256 internal constant ONE = 10**27;

    /**
    * @dev Throws if chai token is not enabled
    */
    modifier chaiTokenEnabled {
        require(isChaiTokenEnabled());
        _;
    }

    /**
    * @dev Fixed point multiplication
    * @return Truncated value of x * y
    */
    function rmul(uint256 x, uint256 y) internal pure returns (uint256) {
        return x.mul(y) / ONE;
    }

    /**
    * @dev Fixed point division
    * @return Ceiled value of x / y
    */
    function rdivup(uint256 x, uint256 y) internal pure returns (uint256) {
        return x.mul(ONE).add(y.sub(1)) / y;
    }

    /**
    * @return true, if chai token is enabled
    */
    function isChaiTokenEnabled() public view returns (bool) {
        return boolStorage[CHAI_TOKEN_ENABLED];
    }

    /**
    * @return Chai token contract address
    */
    function chaiToken() public view returns (IChai) {
        return IChai(0x06AF07097C9Eeb7fD685c692751D5C66dB49c215);
    }

    /**
    * @dev Initializes chai token
    */
    function initializeChaiToken() external onlyOwner {
        require(!isChaiTokenEnabled());
        require(address(chaiToken().daiToken()) == address(erc20token()));
        boolStorage[CHAI_TOKEN_ENABLED] = true;
        uintStorage[MIN_DAI_TOKEN_BALANCE] = 100 ether;
        uintStorage[INTEREST_COLLECTION_PERIOD] = 1 weeks;
    }

    /**
    * @dev Sets minimum DAI limit, needed for converting DAI into CHAI
    */
    function setMinDaiTokenBalance(uint256 _minBalance) external onlyOwner {
        uintStorage[MIN_DAI_TOKEN_BALANCE] = _minBalance;
    }

    /**
    * @dev Evaluates edge DAI token balance, which has an impact on the invest amounts
    * @return Value in DAI
    */
    function minDaiTokenBalance() public view returns (uint256) {
        return uintStorage[MIN_DAI_TOKEN_BALANCE];
    }

    /**
    * @dev Withdraws all invested tokens, pays remaining interest, removes chai token from contract storage
    */
    function removeChaiToken() external onlyOwner chaiTokenEnabled {
        _convertChaiToDai(investedAmountInDai());
        _payInterest();
        delete boolStorage[CHAI_TOKEN_ENABLED];
    }

    /**
     * @return Configured address of a receiver
     */
    function interestReceiver() public view returns (ERC677Receiver) {
        return ERC677Receiver(addressStorage[INTEREST_RECEIVER]);
    }

    /**
     * Updates interest receiver contract address
     * @param receiver New receiver contract address
     */
    function setInterestReceiver(address receiver) external onlyOwner {
        require(AddressUtils.isContract(receiver));
        addressStorage[INTEREST_RECEIVER] = receiver;
    }

    /**
     * @return Timestamp of last interest payment
     */
    function lastInterestPayment() public view returns (uint256) {
        return uintStorage[LAST_TIME_INTEREST_PAYED];
    }

    /**
     * @return Configured minimum interest collection period
     */
    function interestCollectionPeriod() public view returns (uint256) {
        return uintStorage[INTEREST_COLLECTION_PERIOD];
    }

    /**
     * @dev Configures minimum interest collection period
     * @param period collection period
     */
    function setInterestCollectionPeriod(uint256 period) external onlyOwner {
        uintStorage[INTEREST_COLLECTION_PERIOD] = period;
    }

    /**
    * @dev Pays all available interest, in Dai tokens.
    * Upgradeability owner can call this method without time restrictions,
    * for others, the method can be called only once a specified period.
    */
    function payInterest() external chaiTokenEnabled {
        // solhint-disable not-rely-on-time
        if (
            lastInterestPayment() + interestCollectionPeriod() < now ||
            IUpgradeabilityOwnerStorage(this).upgradeabilityOwner() == msg.sender
        ) {
            uintStorage[LAST_TIME_INTEREST_PAYED] = now;
            _payInterest();
        }
        // solhint-enable not-rely-on-time
    }

    /**
    * @dev Internal function for paying all available interest, in Dai tokens
    */
    function _payInterest() internal {
        require(address(interestReceiver()) != address(0));

        // since investedAmountInChai() returns a ceiled value,
        // the value of chaiBalance() - investedAmountInChai() will be floored,
        // leading to excess remaining chai balance
        uint256 balanceBefore = daiBalance();
        chaiToken().exit(address(this), chaiBalance().sub(investedAmountInChai()));
        uint256 interestInDai = daiBalance() - balanceBefore;

        erc20token().transfer(interestReceiver(), interestInDai);

        interestReceiver().onTokenTransfer(address(this), interestInDai, "");

        require(dsrBalance() >= investedAmountInDai());
    }

    /**
    * @dev Evaluates bridge balance for tokens, holded in DSR
    * @return Balance in dai, truncated
    */
    function dsrBalance() public view returns (uint256) {
        uint256 chi = chaiToken().pot().chi();
        return rmul(chi, chaiBalance());
    }

    /**
    * @dev Evaluates bridge balance in Chai tokens
    * @return Balance in chai, exact
    */
    function chaiBalance() public view returns (uint256) {
        return chaiToken().balanceOf(address(this));
    }

    /**
    * @dev Evaluates bridge balance in Dai tokens
    * @return Balance in Dai
    */
    function daiBalance() internal view returns (uint256) {
        return erc20token().balanceOf(address(this));
    }

    /**
    * @dev Evaluates exact current invested amount, id DAI
    * @return Value in DAI
    */
    function investedAmountInDai() public view returns (uint256) {
        return uintStorage[INVESTED_AMOUNT];
    }

    /**
    * @dev Updates current invested amount, id DAI
    * @return Value in DAI
    */
    function setInvestedAmointInDai(uint256 amount) internal {
        uintStorage[INVESTED_AMOUNT] = amount;
    }

    /**
    * @dev Evaluates amount of chai tokens that is sufficent to cover 100% of the invested DAI
    * @return Amount in chai, ceiled
    */
    function investedAmountInChai() internal returns (uint256) {
        IPot pot = chaiToken().pot();
        // solhint-disable-next-line not-rely-on-time
        uint256 chi = (now > pot.rho()) ? pot.drip() : pot.chi();
        return rdivup(investedAmountInDai(), chi);
    }

    /**
    * @dev Checks if DAI balance is high enough to be partially converted to Chai
    * Twice limit is used in order to decrease frequency of convertDaiToChai calls,
    * In case of high bridge utilization in DAI => xDAI direction,
    * convertDaiToChai() will be called as soon as DAI balance reaches 2 * limit,
    * limit DAI will be left as a buffer for future operations.
    * @return true if convertDaiToChai() call is needed to be performed by the oracle
    */
    function isDaiNeedsToBeInvested() public view returns (bool) {
        // chai token needs to be initialized, DAI balance should be at least twice greater than minDaiTokenBalance
        return isChaiTokenEnabled() && daiBalance() > 2 * minDaiTokenBalance();
    }

    /**
    * @dev Converts all DAI into Chai tokens, keeping minDaiTokenBalance() DAI as a buffer
    */
    function convertDaiToChai() public chaiTokenEnabled {
        _convertDaiToChai(daiBalance().sub(minDaiTokenBalance()));
    }

    /**
    * @dev Invests DAI into Chai
    * @param amount Amount of DAI to invest
    */
    function _convertDaiToChai(uint256 amount) internal {
        setInvestedAmointInDai(investedAmountInDai() + amount);
        erc20token().approve(chaiToken(), amount);
        chaiToken().join(address(this), amount);
    }

    /**
    * @dev Redeems DAI from Chai, the total redeemed amount will be at least equal to specified amount
    * @param amount Amount of DAI to redeem
    */
    function _convertChaiToDai(uint256 amount) internal {
        uint256 invested = investedAmountInDai();
        if (amount >= invested) {
            // onExecuteMessage can call a convert operation with argument greater than the current invested amount,
            // in this case bridge should withdraw all invested funds
            chaiToken().draw(address(this), invested);
            setInvestedAmointInDai(0);
        } else if (amount > 0) {
            uint256 initialDaiBalance = daiBalance();
            chaiToken().draw(address(this), amount);
            uint256 redeemed = daiBalance() - initialDaiBalance;
            setInvestedAmointInDai(redeemed < invested ? invested - redeemed : 0);
        }
    }
}
