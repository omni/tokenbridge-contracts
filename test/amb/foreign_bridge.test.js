const ForeignBridge = artifacts.require("ForeignAMB.sol");
const BridgeValidators = artifacts.require("BridgeValidators.sol");
const Box = artifacts.require("Box.sol");

const {ERROR_MSG, ZERO_ADDRESS} = require('../setup');

contract('ForeignAMB', async (accounts) => {
  let validatorContract, boxContract, authorities, owner;

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

  describe('getBridgeMode', () => {
    it('should return arbitrary message bridging mode', async () => {
      const homeContract = await ForeignBridge.new()
      const bridgeModeHash = '0x2544fbb9' // 4 bytes of keccak256('arbitrary-message-bridge-core')
      const bridgeMode = await homeContract.getBridgeMode()
      bridgeMode.should.be.equal(bridgeModeHash)
    })
  })
})
