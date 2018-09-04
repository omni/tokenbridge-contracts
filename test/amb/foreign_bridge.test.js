const ForeignBridge = artifacts.require("ForeignAMB.sol");
const BridgeValidators = artifacts.require("BridgeValidators.sol");
const EternalStorageProxy = artifacts.require("EternalStorageProxy.sol");
const Box = artifacts.require("Box.sol");

const {ERROR_MSG, ZERO_ADDRESS} = require('../setup');
const {createMessage, sign, signatureToVRS} = require('../helpers/helpers');
const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"));
const requireBlockConfirmations = 8;

contract('ForeignBridge_AMB', async (accounts) => {
  let validatorContract, boxContract, authorities, owner, token;

  before(async () => {
    validatorContract = await BridgeValidators.new()
    boxContract = await Box.new()
    authorities = [accounts[1], accounts[2]];
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
  })

  describe('balance', () => {
    it('should start with zero balance', async () => {
      const foreignBridge = await ForeignBridge.new()
      const balance = await foreignBridge.balanceOf(boxContract.address)
      '0'.should.be.bignumber.equal(balance)
    })

    it('should receive balance for a contract', async () => {
      const foreignBridge = await ForeignBridge.new()
      await foreignBridge.depositForContractSender(boxContract.address, {
        from: accounts[1],
        value: 1
      })
      const deposit = await foreignBridge.balanceOf(boxContract.address)
      const balance = await web3.eth.getBalance(foreignBridge.address)
      '1'.should.be.bignumber.equal(deposit)
      '1'.should.be.bignumber.equal(balance)
    })

    it('should revert for address 0', async () => {
      const foreignBridge = await ForeignBridge.new()
      await foreignBridge.depositForContractSender(ZERO_ADDRESS, {
        from: accounts[1],
        value: 1
      }).should.be.rejectedWith(ERROR_MSG)
    })
  })
})
