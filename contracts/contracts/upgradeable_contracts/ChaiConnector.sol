pragma solidity 0.4.24;

import "../interfaces/IChai.sol";
import "../interfaces/ERC677Receiver.sol";
import "./Ownable.sol";
import "./ERC20Bridge.sol";
import "./TokenSwapper.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title ChaiConnector
 * @dev This logic allows to use Chai token (https://github.com/dapphub/chai)
 */
contract ChaiConnector is Ownable, ERC20Bridge, TokenSwapper {
    using SafeMath for uint256;

    // emitted when specified value of Chai tokens is transfered to interest receiver
    event PaidInterest(address to, uint256 value);

    bytes32 internal constant CHAI_TOKEN_ENABLED = 0x2ae87563606f93f71ad2adf4d62661ccdfb63f3f508f94700934d5877fb92278; // keccak256(abi.encodePacked("chaiTokenEnabled"))
    bytes32 internal constant INTEREST_RECEIVER = 0xd88509eb1a8da5d5a2fc7b9bad1c72874c9818c788e81d0bc46b29bfaa83adf6; // keccak256(abi.encodePacked("interestReceiver"))
    bytes32
        internal constant INTEREST_COLLECTION_PERIOD = 0x68a6a652d193e5d6439c4309583048050a11a4cfb263a220f4cd798c61c3ad6e; // keccak256(abi.encodePacked("interestCollectionPeriod"))
    bytes32
        internal constant LAST_TIME_INTEREST_PAID = 0xcabd46177a706f95f4bb3e2c2ba45ac4aa1eac9c545425a19c62ab6de4aeea26; // keccak256(abi.encodePacked("lastTimeInterestPaid"))
    bytes32 internal constant INVESTED_AMOUNT = 0xb6afb3323c9d7dc0e9dab5d34c3a1d1ae7739d2224c048d4ee7675d3c759dd1b; // keccak256(abi.encodePacked("investedAmount"))
    bytes32
        internal constant MIN_DAI_TOKEN_BALANCE = 0xce70e1dac97909c26a87aa4ada3d490673a153b3a75b22ea3364c4c7df7c551f; // keccak256(abi.encodePacked("minDaiTokenBalance"))
    bytes4 internal constant ON_TOKEN_TRANSFER = 0xa4c0ed36; // onTokenTransfer(address,uint256,bytes)

    uint256 internal constant ONE = 10**27;

    /**
     * @dev Throws if chai token is not enabled
     */
    modifier chaiTokenEnabled {
        require(isChaiTokenEnabled());
        /* solcov ignore next */
        _;
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
    function initializeChaiToken() public onlyOwner {
        require(!isChaiTokenEnabled());
        require(address(chaiToken().daiToken()) == address(erc20token()));
        boolStorage[CHAI_TOKEN_ENABLED] = true;
        uintStorage[MIN_DAI_TOKEN_BALANCE] = 100 ether;
        uintStorage[INTEREST_COLLECTION_PERIOD] = 1 weeks;
    }

    /**
     * @dev Initializes chai token, with interestReceiver
     * @param _interestReceiver Receiver address
     */
    function initializeChaiToken(address _interestReceiver) external {
        require(_interestReceiver != address(0));
        // onlyOwner condition is checked inside this call, so it can be excluded from function definition
        initializeChaiToken();
        addressStorage[INTEREST_RECEIVER] = _interestReceiver;
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
     * Updates interest receiver address
     * @param receiver New receiver address
     */
    function setInterestReceiver(address receiver) external onlyOwner {
        // the bridge account is not allowed to receive an interest by the following reason:
        // during the Chai to Dai convertion, the Dai is minted to the receiver account,
        // the Transfer(address(0), bridgeAddress, value) is emitted during this process,
        // something can go wrong in the oracle logic, so that it will process this event as a request to the bridge
        // Instead, the interest can be transfered to any other account, and then converted to Dai,
        // which won't be related to the oracle logic anymore
        require(receiver != address(this));

        addressStorage[INTEREST_RECEIVER] = receiver;
    }

    /**
     * @return Timestamp of last interest payment
     */
    function lastInterestPayment() public view returns (uint256) {
        return uintStorage[LAST_TIME_INTEREST_PAID];
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
        if (
            // solhint-disable-next-line not-rely-on-time
            lastInterestPayment() + interestCollectionPeriod() < now ||
            IUpgradeabilityOwnerStorage(this).upgradeabilityOwner() == msg.sender
        ) {
            _payInterest();
        }
    }

    /**
     * @dev Internal function for paying all available interest, in Dai tokens
     */
    function _payInterest() internal {
        address receiver = address(interestReceiver());
        require(receiver != address(0));

        // since investedAmountInChai() returns a ceiled value,
        // the value of chaiBalance() - investedAmountInChai() will be floored,
        // leading to excess remaining chai balance

        // solhint-disable-next-line not-rely-on-time
        uintStorage[LAST_TIME_INTEREST_PAID] = now;

        uint256 interest = chaiBalance().sub(investedAmountInChai());
        // interest is paid in Chai, paying interest directly in Dai can cause an unwanter Transfer event
        // see a comment in setInterestReceiver describing why we cannot pay interest to the bridge directly
        chaiToken().transfer(receiver, interest);

        receiver.call(abi.encodeWithSelector(ON_TOKEN_TRANSFER, address(this), interest, ""));

        // Additional constant to tolerate the DAI balance deposited to the Chai token is not needed here, since we allow to withdraw only extra part of chai balance,
        // which is not necessary to cover 100% dai balance.
        // It is guaranteed that the withdrawal of interest won't left the bridge balance uncovered.
        require(dsrBalance() >= investedAmountInDai());

        emit PaidInterest(receiver, interest);
    }

    /**
     * @dev Evaluates bridge balance for tokens, holded in DSR
     * @return Balance in dai, truncated
     */
    function dsrBalance() public view returns (uint256) {
        return chaiToken().dai(address(this));
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
     * @dev Evaluates exact current invested amount, in DAI
     * @return Value in DAI
     */
    function investedAmountInDai() public view returns (uint256) {
        return uintStorage[INVESTED_AMOUNT];
    }

    /**
     * @dev Updates current invested amount, in DAI
     * @return Value in DAI
     */
    function setInvestedAmountInDai(uint256 amount) internal {
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
        // there is not need to consider overflow when performing a + operation,
        // since both values are controlled by the bridge and can't take extremely high values
        uint256 amount = daiBalance().sub(minDaiTokenBalance());

        require(amount > 0); // revert and save gas if there is nothing to convert

        uint256 newInvestedAmountInDai = investedAmountInDai() + amount;
        setInvestedAmountInDai(newInvestedAmountInDai);
        erc20token().approve(chaiToken(), amount);
        chaiToken().join(address(this), amount);

        // When evaluating the amount of DAI kept in Chai using dsrBalance(), there are some fixed point truncations.
        // The dependency between invested amount of DAI - value and returned value of dsrBalance() - res is the following:
        // res = floor(floor(value / K) * K)), where K is the fixed-point coefficient
        // from MakerDAO Pot contract (K = pot.chi() / 10**27).
        // This can lead up to losses of ceil(K) DAI in this balance evaluation.
        // The constant is needed here for making sure that everything works fine, and this error is small enough
        // The 10000 constant is considered to be small enough when decimals = 18, however,
        // it is not recommended to use it for smaller values of decimals, since it won't be negligible anymore
        require(dsrBalance() + 10000 >= newInvestedAmountInDai);

        emit TokensSwapped(erc20token(), chaiToken(), amount);
    }

    /**
     * @dev Redeems DAI from Chai, the total redeemed amount will be at least equal to specified amount
     * @param amount Amount of DAI to redeem
     */
    function _convertChaiToDai(uint256 amount) internal {
        if (amount == 0) return;

        uint256 invested = investedAmountInDai();
        uint256 initialDaiBalance = daiBalance();

        // onExecuteMessage can call a convert operation with argument greater than the current invested amount,
        // in this case bridge should withdraw all invested funds
        uint256 withdrawal = amount >= invested ? invested : amount;

        chaiToken().draw(address(this), withdrawal);
        uint256 redeemed = daiBalance() - initialDaiBalance;

        // Make sure that at least withdrawal amount was withdrawn
        require(redeemed >= withdrawal);

        uint256 newInvested = invested > redeemed ? invested - redeemed : 0;
        setInvestedAmountInDai(newInvested);

        // see comment in convertDaiToChai() for similar statement
        require(dsrBalance() + 10000 >= newInvested);

        emit TokensSwapped(chaiToken(), erc20token(), redeemed);
    }
}
