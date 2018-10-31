const Web3Utils = require('web3-utils');
const HomeAMB = artifacts.require("HomeAMB.sol");
const BridgeValidators = artifacts.require("BridgeValidators.sol");
const requiredBlockConfirmations = 8;
const gasPrice = Web3Utils.toWei('1', 'gwei');
const oneEther = web3.toBigNumber(web3.toWei(1, "ether"));
const { ERROR_MSG } = require('../setup');

contract('HomeAMB', async (accounts) => {
  let validatorContract, authorities, owner;
  before(async () => {
    validatorContract = await BridgeValidators.new()
    authorities = [accounts[1]];
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
  })
  describe('getBridgeMode', () => {
    it('should return arbitrary message bridging mode and interface', async () => {
      const homeContract = await HomeAMB.new()
      const bridgeModeHash = '0x2544fbb9' // 4 bytes of keccak256('arbitrary-message-bridge-core')
      const bridgeMode = await homeContract.getBridgeMode()
      bridgeMode.should.be.equal(bridgeModeHash)

      const [major, minor, patch] = await homeContract.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)

    })
  })
  describe('initialize', () => {
    it('sets variables', async () => {
      const homeBridge = await HomeAMB.new()
      '0'.should.be.bignumber.equal(await homeBridge.deployedAtBlock())
      '0'.should.be.bignumber.equal(await homeBridge.maxPerTx())
      false.should.be.equal(await homeBridge.isInitialized())

      await homeBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations).should.be.fulfilled;

      (await homeBridge.deployedAtBlock()).should.be.bignumber.above(0);
      (await homeBridge.validatorContract()).should.be.equal(validatorContract.address);
      (await homeBridge.maxPerTx()).should.be.bignumber.equal(oneEther);
      (await homeBridge.gasPrice()).should.be.bignumber.equal(gasPrice);
      (await homeBridge.requiredBlockConfirmations()).should.be.bignumber.equal(requiredBlockConfirmations);
    })
  })
  describe('requireToPassMessage', () => {
    let homeBridge
    beforeEach(async () => {
      homeBridge = await HomeAMB.new()
      await homeBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations)
    })
    it('call requireToPassMessage(address, bytes, uint256)', async () => {
      await homeBridge.setSubsidizedModeForHomeToForeign().should.be.fulfilled;

      const tx = await homeBridge.contract.requireToPassMessage['address,bytes,uint256'](
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        1535604485,
        { from: accounts[3] })
      const { logs } = await web3.eth.getTransactionReceipt(tx)
      logs.length.should.be.equal(1)
    })
    it('call requireToPassMessage(address, bytes, uint256) should fail', async () => {
      try {
        // Should fail because subsidized mode not set by default
        await homeBridge.contract.requireToPassMessage['address,bytes,uint256'](
          "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
          "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
          1535604485,
          { from: accounts[3] })
        throw new Error("Method should have failed.")
      } catch (e) {
        e.message.should.be.equal(ERROR_MSG)
      }

      await homeBridge.setSubsidizedModeForHomeToForeign().should.be.fulfilled;

      try {
        // Should fail because gas < minimumGasUsage
        await homeBridge.contract.requireToPassMessage['address,bytes,uint256'](
          "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
          "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
          10,
          { from: accounts[3] })
        throw new Error("Method should have failed.")
      } catch (e) {
        e.message.should.be.equal(ERROR_MSG)
      }

      try {
        const twoEther = web3.toBigNumber(web3.toWei(2, "ether"));

        // Should fail because gas > maxGasPerTx
        await homeBridge.contract.requireToPassMessage['address,bytes,uint256'](
          "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
          "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
          twoEther,
          { from: accounts[3] })
        throw new Error("Method should have failed.")
      } catch (e) {
        e.message.should.be.equal(ERROR_MSG)
      }
    })
    it('call requireToPassMessage(address, bytes, uint256, uint256)', async () => {
      const tx = await homeBridge.contract.requireToPassMessage['address,bytes,uint256,uint256'](
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        1535604485,
        1000000000
        , { from: accounts[3] })
      const { logs } = await web3.eth.getTransactionReceipt(tx)
      logs.length.should.be.equal(1)
    })
    it('call requireToPassMessage(address, bytes, uint256, uint256) on subsidized mode', async () => {
      await homeBridge.setSubsidizedModeForHomeToForeign().should.be.fulfilled;
      const tx = await homeBridge.contract.requireToPassMessage['address,bytes,uint256,uint256'](
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        1535604485,
        1000000000
        , { from: accounts[3] })
      const { logs } = await web3.eth.getTransactionReceipt(tx)
      logs.length.should.be.equal(1)
    })
    it('call requireToPassMessage(address, bytes, uint256, uint256) should fail', async () => {
      try {
        // Should fail because gas < minimumGasUsage
        await homeBridge.contract.requireToPassMessage['address,bytes,uint256,uint256'](
          "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
          "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
          10,
          1000000000,
          { from: accounts[3] })
        throw new Error("Method should have failed.")
      } catch (e) {
        e.message.should.be.equal(ERROR_MSG)
      }

      try {
        const twoEther = web3.toBigNumber(web3.toWei(2, "ether"));

        // Should fail because gas > maxGasPerTx
        await homeBridge.contract.requireToPassMessage['address,bytes,uint256,uint256'](
          "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
          "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
          twoEther,
          1000000000,
          { from: accounts[3] })
        throw new Error("Method should have failed.")
      } catch (e) {
        e.message.should.be.equal(ERROR_MSG)
      }
    })
    it('call requireToPassMessage(address, bytes, uint256, bytes1)', async () => {
      const { logs } = await homeBridge.requireToPassMessage(
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        1535604485,
        1)
      logs.length.should.be.equal(1)
      logs[0].event.should.be.equal('UserRequestForSignature')
    })
    it('call requireToPassMessage(address, bytes, uint256, bytes1) on subsidized mode', async () => {
      await homeBridge.setSubsidizedModeForHomeToForeign().should.be.fulfilled;
      const { logs } = await homeBridge.requireToPassMessage(
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        1535604485,
        1)
      logs.length.should.be.equal(1)
      logs[0].event.should.be.equal('UserRequestForSignature')
    })
    it('call requireToPassMessage(address, bytes, uint256, bytes1) should fail', async () => {
      const twoEther = web3.toBigNumber(web3.toWei(2, "ether"));

      // Should fail because gas < minimumGasUsage
      await homeBridge.requireToPassMessage(
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        10,
        1).should.be.rejectedWith(ERROR_MSG)

      // Should fail because gas > maxGasPerTx
      await homeBridge.requireToPassMessage(
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        twoEther,
        1).should.be.rejectedWith(ERROR_MSG)
    })
  })
})
