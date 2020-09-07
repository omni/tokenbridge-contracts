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
const { getEvents, strip0x } = require('../helpers/helpers')
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
const exampleMessageId = '0xf308b922ab9f8a7128d9d7bc9bce22cd88b2c05c8213f0e2d8104d78e0a9ecbb'
const otherMessageId = '0x2ebc2ccc755acc8eaf9252e19573af708d644ab63a39619adb080a3500a4ff2e'
const decimalShiftZero = 0
const HOME_CHAIN_ID = 77
const HOME_CHAIN_ID_HEX = `0x${HOME_CHAIN_ID.toString(16).padStart(2, '0')}`
const FOREIGN_CHAIN_ID = 88
const FOREIGN_CHAIN_ID_HEX = `0x${FOREIGN_CHAIN_ID.toString(16).padStart(2, '0')}`

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
      await ambBridgeContract.initialize(
        FOREIGN_CHAIN_ID_HEX,
        HOME_CHAIN_ID_HEX,
        validatorContract.address,
        maxGasPerTx,
        '1',
        '1',
        owner
      )
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
      await foreignBridge.onTokenTransfer(user, halfEther, '0x', { from: owner }).should.be.rejectedWith(ERROR_MSG)

      // must be within limits
      await erc677Token
        .transferAndCall(foreignBridge.address, twoEthers, '0x', { from: user })
        .should.be.rejectedWith(ERROR_MSG)

      // When
      await erc677Token.transferAndCall(foreignBridge.address, halfEther, '0x', { from: user }).should.be.fulfilled

      // Then
      const events = await getEvents(ambBridgeContract, { event: 'UserRequestForAffirmation' })
      expect(events.length).to.be.equal(1)
      expect(events[0].returnValues.encodedData.includes(strip0x(user).toLowerCase())).to.be.equal(true)
      expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(halfEther)
    })
    it('should be able to specify a different receiver', async () => {
      // Given
      const user2 = accounts[2]
      const currentDay = await foreignBridge.getCurrentDay()
      expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)
      const initialEvents = await getEvents(ambBridgeContract, { event: 'UserRequestForAffirmation' })
      expect(initialEvents.length).to.be.equal(0)

      // only token address can call it
      await foreignBridge.onTokenTransfer(user, halfEther, '0x', { from: owner }).should.be.rejectedWith(ERROR_MSG)

      // must be within limits
      await erc677Token
        .transferAndCall(foreignBridge.address, twoEthers, '0x', { from: user })
        .should.be.rejectedWith(ERROR_MSG)

      // When
      await erc677Token
        .transferAndCall(foreignBridge.address, halfEther, '0x00', { from: user })
        .should.be.rejectedWith(ERROR_MSG)
      await erc677Token.transferAndCall(foreignBridge.address, halfEther, user2, { from: user }).should.be.fulfilled

      // Then
      const events = await getEvents(ambBridgeContract, { event: 'UserRequestForAffirmation' })
      expect(events.length).to.be.equal(1)
      expect(events[0].returnValues.encodedData.includes(strip0x(user2).toLowerCase())).to.be.equal(true)
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
      await ambBridgeContract.executeMessageCall(foreignBridge.address, owner, data, otherMessageId, 1000000).should.be
        .fulfilled

      expect(await ambBridgeContract.messageCallStatus(otherMessageId)).to.be.equal(false)

      await ambBridgeContract.executeMessageCall(
        foreignBridge.address,
        mediatorContract.address,
        data,
        exampleMessageId,
        1000000
      ).should.be.fulfilled

      expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)

      // Then
      expect(await foreignBridge.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(oneEther)
      expect(await erc677Token.balanceOf(foreignBridge.address)).to.be.bignumber.equal(oneEther)
      expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(oneEther)

      const TokensBridgedEvent = await getEvents(foreignBridge, { event: 'TokensBridged' })
      expect(TokensBridgedEvent.length).to.be.equal(1)
      expect(TokensBridgedEvent[0].returnValues.recipient).to.be.equal(user)
      expect(TokensBridgedEvent[0].returnValues.value).to.be.equal(oneEther.toString())
      expect(TokensBridgedEvent[0].returnValues.messageId).to.be.equal(exampleMessageId)
    })
    for (const decimalShift of [2, -1]) {
      it(`should transfer locked tokens on message from amb with decimal shift of ${decimalShift}`, async () => {
        // Given
        erc677Token = await ERC677BridgeToken.new('test', 'TST', 16)

        foreignBridge = await ForeignAMBErc677ToErc677.new()
        await foreignBridge.initialize(
          ambBridgeContract.address,
          mediatorContract.address,
          erc677Token.address,
          [dailyLimit, maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShift,
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
        const valueOnHome = toBN(valueOnForeign * 10 ** decimalShift)

        const data = await foreignBridge.contract.methods.handleBridgedTokens(user, valueOnHome.toString()).encodeABI()

        // message must be generated by mediator contract on the other network
        await ambBridgeContract.executeMessageCall(foreignBridge.address, owner, data, otherMessageId, 1000000).should
          .be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(otherMessageId)).to.be.equal(false)

        await ambBridgeContract.executeMessageCall(
          foreignBridge.address,
          mediatorContract.address,
          data,
          exampleMessageId,
          1000000
        ).should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)

        // Then
        expect(await foreignBridge.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(valueOnHome)
        expect(await erc677Token.balanceOf(foreignBridge.address)).to.be.bignumber.equal(twoEthers.sub(valueOnForeign))
        expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(valueOnForeign)

        const TokensBridgedEvent = await getEvents(foreignBridge, { event: 'TokensBridged' })
        expect(TokensBridgedEvent.length).to.be.equal(1)
        expect(TokensBridgedEvent[0].returnValues.recipient).to.be.equal(user)
        expect(TokensBridgedEvent[0].returnValues.value).to.be.equal(valueOnForeign.toString())
        expect(TokensBridgedEvent[0].returnValues.messageId).to.be.equal(exampleMessageId)
      })
    }
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
        exampleMessageId,
        1000000
      ).should.be.fulfilled

      expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)

      // Then
      expect(await foreignBridge.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(ZERO)
      expect(await erc677Token.balanceOf(foreignBridge.address)).to.be.bignumber.equal(twoEthers)
      expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(ZERO)

      expect(await foreignBridge.outOfLimitAmount()).to.be.bignumber.equal(twoEthers)
      const outOfLimitEvent = await getEvents(foreignBridge, { event: 'AmountLimitExceeded' })
      expect(outOfLimitEvent.length).to.be.equal(1)
      expect(outOfLimitEvent[0].returnValues.recipient).to.be.equal(user)
      expect(outOfLimitEvent[0].returnValues.value).to.be.equal(twoEthers.toString())
      expect(outOfLimitEvent[0].returnValues.transactionHash).to.be.equal(exampleMessageId)

      const TokensBridgedEvent = await getEvents(foreignBridge, { event: 'TokensBridged' })
      expect(TokensBridgedEvent.length).to.be.equal(0)
    })
  })
})
