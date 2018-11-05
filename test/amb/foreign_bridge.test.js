const Web3Utils = require('web3-utils');
const ForeignBridge = artifacts.require("ForeignAMB.sol");
const BridgeValidators = artifacts.require("BridgeValidators.sol");
const Box = artifacts.require("Box.sol");
const requiredBlockConfirmations = 8;
const gasPrice = Web3Utils.toWei('1', 'gwei');
const oneEther = web3.toBigNumber(web3.toWei(1, "ether"));

const {ERROR_MSG, ZERO_ADDRESS} = require('../setup');

contract('ForeignAMB', async (accounts) => {
  let validatorContract, boxContract, authorities, owner;

  before(async () => {
    validatorContract = await BridgeValidators.new()
    boxContract = await Box.new()
    authorities = [accounts[1]];
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
      const foreignContract = await ForeignBridge.new()
      const bridgeModeHash = '0x2544fbb9' // 4 bytes of keccak256('arbitrary-message-bridge-core')
      const bridgeMode = await foreignContract.getBridgeMode()
      bridgeMode.should.be.equal(bridgeModeHash)
    })
  })
  describe('initialize', () => {
    it('sets variables', async () => {
      const foreignBridge = await ForeignBridge.new()
      '0'.should.be.bignumber.equal(await foreignBridge.deployedAtBlock())
      '0'.should.be.bignumber.equal(await foreignBridge.maxPerTx())
      false.should.be.equal(await foreignBridge.isInitialized())

      await foreignBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations).should.be.fulfilled;

      (await foreignBridge.deployedAtBlock()).should.be.bignumber.above(0);
      (await foreignBridge.validatorContract()).should.be.equal(validatorContract.address);
      (await foreignBridge.maxPerTx()).should.be.bignumber.equal(oneEther);
      (await foreignBridge.gasPrice()).should.be.bignumber.equal(gasPrice);
      (await foreignBridge.requiredBlockConfirmations()).should.be.bignumber.equal(requiredBlockConfirmations);
    })
  })
  describe('requireToPassMessage', () => {
    let foreignBridge
    beforeEach(async () => {
      foreignBridge = await ForeignBridge.new()
      await foreignBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations)
    })
    it('call requireToPassMessage(address, bytes, uint256, bytes1)', async () => {
      const { logs } = await foreignBridge.requireToPassMessage(
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        1535604485,
        1)
      logs.length.should.be.equal(1)
      logs[0].event.should.be.equal('UserRequestForAffirmation')
    })
    it('call requireToPassMessage(address, bytes, uint256)', async () => {
      await foreignBridge.setSubsidizedModeForForeignToHome().should.be.fulfilled;
      const tx = await foreignBridge.contract.requireToPassMessage['address,bytes,uint256'](
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        1535604485,
        { from: accounts[3] })
      const { logs } = await web3.eth.getTransactionReceipt(tx)
      logs.length.should.be.equal(1)
    })
    it('call requireToPassMessage(address, bytes, uint256, uint256)', async () => {
      const tx = await foreignBridge.contract.requireToPassMessage['address,bytes,uint256,uint256'](
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        1535604485,
        1000000000
        , { from: accounts[3] })
      const { logs } = await web3.eth.getTransactionReceipt(tx)
      logs.length.should.be.equal(1)
    })
  })
})
