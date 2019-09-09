const ForeignAMBErc677ToErc677 = artifacts.require('ForeignAMBErc677ToErc677.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')
const HomeAMBErc677ToErc677 = artifacts.require('HomeAMBErc677ToErc677.sol')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const ForeignAMB = artifacts.require('ForeignAMB.sol')
const BridgeValidators = artifacts.require('BridgeValidators.sol')
const AMBMock = artifacts.require('AMBMock.sol')

const { expect } = require('chai')
const { shouldBehaveLikeBasicAMBErc677ToErc677 } = require('./AMBErc677ToErc677Behavior.test')
const { ether } = require('../helpers/helpers')
const { getEvents } = require('../helpers/helpers')
const { ERROR_MSG, toBN } = require('../setup')

const ZERO = toBN(0)
const halfEther = ether('0.5')
const oneEther = ether('1')
const twoEthers = ether('2')
const maxGasPerTx = oneEther
const dailyLimit = twoEthers
const maxPerTx = oneEther
const minPerTx = ether('0.01')
const executionDailyLimit = dailyLimit
const executionMaxPerTx = maxPerTx
const exampleTxHash = '0xf308b922ab9f8a7128d9d7bc9bce22cd88b2c05c8213f0e2d8104d78e0a9ecbb'
const decimalShiftZero = 0

contract('ForeignAMBErc677ToErc677', async accounts => {
  const owner = accounts[0]
  const user = accounts[1]
  let ambBridgeContract
  let mediatorContract
  let erc677Token
  let foreignBridge
  beforeEach(async function() {
    this.bridge = await ForeignAMBErc677ToErc677.new()
    const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
    await storageProxy.upgradeTo('1', this.bridge.address).should.be.fulfilled
    this.proxyContract = await ForeignAMBErc677ToErc677.at(storageProxy.address)
  })
  shouldBehaveLikeBasicAMBErc677ToErc677(HomeAMBErc677ToErc677, accounts)
  describe('onTokenTransfer', () => {
    beforeEach(async () => {
      const validatorContract = await BridgeValidators.new()
      const authorities = [accounts[1], accounts[2]]
      await validatorContract.initialize(1, authorities, owner)
      ambBridgeContract = await ForeignAMB.new()
      await ambBridgeContract.initialize(validatorContract.address, maxGasPerTx, '1', '1', owner)
      mediatorContract = await HomeAMBErc677ToErc677.new()
      erc677Token = await ERC677BridgeToken.new('test', 'TST', 18)
      await erc677Token.mint(user, twoEthers, { from: owner }).should.be.fulfilled

      foreignBridge = await ForeignAMBErc677ToErc677.new()
      await foreignBridge.initialize(
        ambBridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner
      ).should.be.fulfilled
    })
    it('should emit UserRequestForAffirmation in AMB bridge', async () => {
      // Given
      const currentDay = await foreignBridge.getCurrentDay()
      expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)
      const initialEvents = await getEvents(ambBridgeContract, { event: 'UserRequestForAffirmation' })
      expect(initialEvents.length).to.be.equal(0)

      // only token address can call it
      await foreignBridge.onTokenTransfer(user, halfEther, '0x00', { from: owner }).should.be.rejectedWith(ERROR_MSG)

      // must be within limits
      await erc677Token
        .transferAndCall(foreignBridge.address, twoEthers, '0x00', { from: user })
        .should.be.rejectedWith(ERROR_MSG)

      // When
      await erc677Token.transferAndCall(foreignBridge.address, halfEther, '0x00', { from: user }).should.be.fulfilled

      // Then
      const events = await getEvents(ambBridgeContract, { event: 'UserRequestForAffirmation' })
      expect(events.length).to.be.equal(1)
      expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(halfEther)
    })
  })
  describe('handleBridgedTokens', () => {
    beforeEach(async () => {
      ambBridgeContract = await AMBMock.new()
      await ambBridgeContract.setMaxGasPerTx(maxGasPerTx)
      mediatorContract = await HomeAMBErc677ToErc677.new()
      erc677Token = await ERC677BridgeToken.new('test', 'TST', 18)

      foreignBridge = await ForeignAMBErc677ToErc677.new()
      await foreignBridge.initialize(
        ambBridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner
      ).should.be.fulfilled
      await erc677Token.mint(foreignBridge.address, twoEthers, { from: owner }).should.be.fulfilled
      await erc677Token.transferOwnership(foreignBridge.address)
    })
    it('should transfer locked tokens on message from amb', async () => {
      // Given
      const currentDay = await foreignBridge.getCurrentDay()
      expect(await foreignBridge.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(ZERO)
      const initialEvents = await getEvents(erc677Token, { event: 'Transfer' })
      expect(initialEvents.length).to.be.equal(0)
      expect(await erc677Token.balanceOf(foreignBridge.address)).to.be.bignumber.equal(twoEthers)
      expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(ZERO)

      // can't be called by user
      await foreignBridge.handleBridgedTokens(user, oneEther, { from: user }).should.be.rejectedWith(ERROR_MSG)
      // can't be called by owner
      await foreignBridge.handleBridgedTokens(user, oneEther, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      const data = await foreignBridge.contract.methods.handleBridgedTokens(user, oneEther.toString()).encodeABI()

      // message must be generated by mediator contract on the other network
      await ambBridgeContract
        .executeMessageCall(foreignBridge.address, owner, data, exampleTxHash)
        .should.be.rejectedWith(ERROR_MSG)

      await ambBridgeContract.executeMessageCall(foreignBridge.address, mediatorContract.address, data, exampleTxHash)
        .should.be.fulfilled

      // Then
      expect(await foreignBridge.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(oneEther)
      expect(await erc677Token.balanceOf(foreignBridge.address)).to.be.bignumber.equal(oneEther)
      expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(oneEther)
    })
    it('should transfer locked tokens on message from amb with decimal shift of two', async () => {
      // Given
      const decimalShiftTwo = 2
      erc677Token = await ERC677BridgeToken.new('test', 'TST', 16)

      foreignBridge = await ForeignAMBErc677ToErc677.new()
      await foreignBridge.initialize(
        ambBridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftTwo,
        owner
      ).should.be.fulfilled
      await erc677Token.mint(foreignBridge.address, twoEthers, { from: owner }).should.be.fulfilled
      await erc677Token.transferOwnership(foreignBridge.address)

      const currentDay = await foreignBridge.getCurrentDay()
      expect(await foreignBridge.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(ZERO)
      const initialEvents = await getEvents(erc677Token, { event: 'Transfer' })
      expect(initialEvents.length).to.be.equal(0)
      expect(await erc677Token.balanceOf(foreignBridge.address)).to.be.bignumber.equal(twoEthers)
      expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(ZERO)

      const valueOnForeign = toBN('1000')
      const valueOnHome = toBN(valueOnForeign * 10 ** decimalShiftTwo)

      const data = await foreignBridge.contract.methods.handleBridgedTokens(user, valueOnHome.toString()).encodeABI()

      // message must be generated by mediator contract on the other network
      await ambBridgeContract
        .executeMessageCall(foreignBridge.address, owner, data, exampleTxHash)
        .should.be.rejectedWith(ERROR_MSG)

      await ambBridgeContract.executeMessageCall(foreignBridge.address, mediatorContract.address, data, exampleTxHash)
        .should.be.fulfilled

      // Then
      expect(await foreignBridge.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(valueOnHome)
      expect(await erc677Token.balanceOf(foreignBridge.address)).to.be.bignumber.equal(twoEthers.sub(valueOnForeign))
      expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(valueOnForeign)
    })
    it('should emit AmountLimitExceeded and not transfer tokens when out of execution limits', async () => {
      // Given
      const currentDay = await foreignBridge.getCurrentDay()
      expect(await foreignBridge.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(ZERO)
      const initialEvents = await getEvents(erc677Token, { event: 'Transfer' })
      expect(initialEvents.length).to.be.equal(0)
      expect(await erc677Token.balanceOf(foreignBridge.address)).to.be.bignumber.equal(twoEthers)
      expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(ZERO)

      const outOfLimitValueData = await foreignBridge.contract.methods
        .handleBridgedTokens(user, twoEthers.toString())
        .encodeABI()

      // When
      await ambBridgeContract.executeMessageCall(
        foreignBridge.address,
        mediatorContract.address,
        outOfLimitValueData,
        exampleTxHash
      ).should.be.fulfilled

      // Then
      expect(await foreignBridge.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(ZERO)
      expect(await erc677Token.balanceOf(foreignBridge.address)).to.be.bignumber.equal(twoEthers)
      expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(ZERO)

      expect(await foreignBridge.outOfLimitAmount()).to.be.bignumber.equal(twoEthers)
      const outOfLimitEvent = await getEvents(foreignBridge, { event: 'AmountLimitExceeded' })
      expect(outOfLimitEvent.length).to.be.equal(1)
      expect(outOfLimitEvent[0].returnValues.recipient).to.be.equal(user)
      expect(outOfLimitEvent[0].returnValues.value).to.be.equal(twoEthers.toString())
      expect(outOfLimitEvent[0].returnValues.transactionHash).to.be.equal(exampleTxHash)
    })
  })
})
