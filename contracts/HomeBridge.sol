pragma solidity 0.4.19;
import "./libraries/Helpers.sol";
import "./libraries/Message.sol";
import "./libraries/MessageSigning.sol";
import "./libraries/SafeMath.sol";

contract HomeBridge {
    /// Number of authorities signatures required to withdraw the money.
    ///
    /// Must be lesser than number of authorities.
    using SafeMath for uint256;
    uint256 public requiredSignatures;

    /// The gas cost of calling `HomeBridge.withdraw`.
    ///
    /// Is subtracted from `value` on withdraw.
    /// recipient pays the relaying authority for withdraw.
    /// this shuts down attacks that exhaust authorities funds on home chain.
    uint256 public estimatedGasCostOfWithdraw;

    /// Contract authorities.
    address[] public authorities;

    /// Used foreign transaction hashes.
    mapping (bytes32 => bool) public withdraws;

    /// Event created on money deposit.
    event Deposit (address recipient, uint256 value);

    /// Event created on money withdraw.
    event Withdraw (address recipient, uint256 value);

    /// Multisig authority validation
    modifier allAuthorities(uint8[] v, bytes32[] r, bytes32[] s, bytes message) {
        var hash = MessageSigning.hashMessage(message);
        var used = new address[](requiredSignatures);

        require(requiredSignatures <= v.length);

        for (uint256 i = 0; i < requiredSignatures; i++) {
            var a = ecrecover(hash, v[i], r[i], s[i]);
            require(Helpers.addressArrayContains(authorities, a));
            require(!Helpers.addressArrayContains(used, a));
            used[i] = a;
        }
        _;
    }

    /// Constructor.
    function HomeBridge(
        uint256 requiredSignaturesParam,
        address[] authoritiesParam,
        uint256 estimatedGasCostOfWithdrawParam
    ) public
    {
        require(requiredSignaturesParam != 0);
        require(requiredSignaturesParam <= authoritiesParam.length);
        requiredSignatures = requiredSignaturesParam;
        authorities = authoritiesParam;
        estimatedGasCostOfWithdraw = estimatedGasCostOfWithdrawParam;
    }

    /// Should be used to deposit money.
    function () public payable {
        Deposit(msg.sender, msg.value);
    }

    /// to be called by authorities to check
    /// whether they withdraw message should be relayed or whether it
    /// is too low to cover the cost of calling withdraw and can be ignored
    function isMessageValueSufficientToCoverRelay(bytes message) public view returns (bool) {
        return Message.getValue(message) > getWithdrawRelayCost();
    }

    /// an upper bound to the cost of relaying a withdraw by calling HomeBridge.withdraw
    function getWithdrawRelayCost() public view returns (uint256) {
        return estimatedGasCostOfWithdraw.mul(tx.gasprice);
    }

    /// Used to withdraw money from the contract.
    ///
    /// message contains:
    /// withdrawal recipient (bytes20)
    /// withdrawal value (uint)
    /// foreign transaction hash (bytes32) // to avoid transaction duplication
    ///
    /// NOTE that anyone can call withdraw provided they have the message and required signatures!
    function withdraw(uint8[] v, bytes32[] r, bytes32[] s, bytes message) public allAuthorities(v, r, s, message) {
        require(message.length == 84);
        address recipient = Message.getRecipient(message);
        uint value = Message.getValue(message);
        bytes32 hash = Message.getTransactionHash(message);

        // The following two statements guard against reentry into this function.
        // Duplicated withdraw or reentry.
        require(!withdraws[hash]);
        // Order of operations below is critical to avoid TheDAO-like re-entry bug
        withdraws[hash] = true;

        // this fails if `value` is not even enough to cover the relay cost.
        // Authorities simply IGNORE withdraws where `value` can’t relay cost.
        // Think of it as `value` getting burned entirely on the relay with no value left to pay out the recipient.
        require(isMessageValueSufficientToCoverRelay(message));

        uint estimatedWeiCostOfWithdraw = getWithdrawRelayCost();

        // charge recipient for relay cost
        uint valueRemainingAfterSubtractingCost = value - estimatedWeiCostOfWithdraw;

        // pay out recipient
        recipient.transfer(valueRemainingAfterSubtractingCost);

        // refund relay cost to relaying authority
        msg.sender.transfer(estimatedWeiCostOfWithdraw);

        Withdraw(recipient, valueRemainingAfterSubtractingCost);
    }
}
