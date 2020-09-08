const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const ERC20Mock = artifacts.require('ERC20Mock.sol')
const AMBMock = artifacts.require('AMBMock.sol')

const { expect } = require('chai')
const { ZERO_ADDRESS, toBN, ERROR_MSG } = require('../setup')
const { getEvents, expectEventInLogs, ether, strip0x } = require('../helpers/helpers')

const ZERO = toBN(0)
const oneEther = ether('1')
const twoEthers = ether('2')
const halfEther = ether('0.5')
const maxGasPerTx = oneEther
const dailyLimit = twoEthers
const maxPerTx = oneEther
const minPerTx = ether('0.01')
const executionDailyLimit = dailyLimit
const executionMaxPerTx = maxPerTx
const exampleMessageId = '0xf308b922ab9f8a7128d9d7bc9bce22cd88b2c05c8213f0e2d8104d78e0a9ecbb'
const otherMessageId = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
const decimalShiftZero = 0

function shouldBehaveLikeBasicAMBErc677ToErc677(otherSideMediatorContract, accounts) {
  let bridgeContract
  let mediatorContract
  let erc677Token
  const owner = accounts[0]
  const user = accounts[1]
  const user2 = accounts[2]
  describe('initialize', () => {
    beforeEach(async () => {
      bridgeContract = await AMBMock.new()
      await bridgeContract.setMaxGasPerTx(maxGasPerTx)
      mediatorContract = await otherSideMediatorContract.new()
      erc677Token = await ERC677BridgeToken.new('test', 'TST', 18)
    })
    it('should initialize', async function() {
      const contract = this.bridge
      expect(await contract.isInitialized()).to.be.equal(false)
      expect(await contract.bridgeContract()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.mediatorContractOnOtherSide()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.erc677token()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.dailyLimit()).to.be.bignumber.equal(ZERO)
      expect(await contract.maxPerTx()).to.be.bignumber.equal(ZERO)
      expect(await contract.minPerTx()).to.be.bignumber.equal(ZERO)
      expect(await contract.executionDailyLimit()).to.be.bignumber.equal(ZERO)
      expect(await contract.executionMaxPerTx()).to.be.bignumber.equal(ZERO)
      expect(await contract.requestGasLimit()).to.be.bignumber.equal(ZERO)
      expect(await contract.owner()).to.be.equal(ZERO_ADDRESS)

      // not valid bridge contract
      await contract
        .initialize(
          ZERO_ADDRESS,
          mediatorContract.address,
          erc677Token.address,
          [dailyLimit, maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)

      // not valid erc677 contract
      await contract
        .initialize(
          bridgeContract.address,
          mediatorContract.address,
          ZERO_ADDRESS,
          [dailyLimit, maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)

      // dailyLimit > maxPerTx
      await contract
        .initialize(
          bridgeContract.address,
          mediatorContract.address,
          erc677Token.address,
          [maxPerTx, maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)

      // maxPerTx > minPerTx
      await contract
        .initialize(
          bridgeContract.address,
          mediatorContract.address,
          erc677Token.address,
          [dailyLimit, minPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)

      // executionDailyLimit > executionMaxPerTx
      await contract
        .initialize(
          bridgeContract.address,
          mediatorContract.address,
          erc677Token.address,
          [dailyLimit, maxPerTx, minPerTx],
          [executionMaxPerTx, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)

      // maxGasPerTx > bridge maxGasPerTx
      await contract
        .initialize(
          bridgeContract.address,
          mediatorContract.address,
          erc677Token.address,
          [dailyLimit, maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          dailyLimit,
          decimalShiftZero,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)

      // not valid decimal shift
      await contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        100,
        owner
      ).should.be.rejected

      const { logs } = await contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner
      ).should.be.fulfilled

      // already initialized
      await contract
        .initialize(
          bridgeContract.address,
          mediatorContract.address,
          erc677Token.address,
          [dailyLimit, maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)

      expect(await contract.isInitialized()).to.be.equal(true)
      expect(await contract.bridgeContract()).to.be.equal(bridgeContract.address)
      expect(await contract.mediatorContractOnOtherSide()).to.be.equal(mediatorContract.address)
      expect(await contract.erc677token()).to.be.equal(erc677Token.address)
      expect(await contract.dailyLimit()).to.be.bignumber.equal(dailyLimit)
      expect(await contract.maxPerTx()).to.be.bignumber.equal(maxPerTx)
      expect(await contract.minPerTx()).to.be.bignumber.equal(minPerTx)
      expect(await contract.executionDailyLimit()).to.be.bignumber.equal(executionDailyLimit)
      expect(await contract.executionMaxPerTx()).to.be.bignumber.equal(executionMaxPerTx)
      expect(await contract.requestGasLimit()).to.be.bignumber.equal(maxGasPerTx)
      expect(await contract.owner()).to.be.equal(owner)

      expectEventInLogs(logs, 'ExecutionDailyLimitChanged', { newLimit: executionDailyLimit })
      expectEventInLogs(logs, 'DailyLimitChanged', { newLimit: dailyLimit })
    })
    it('only owner can set bridge contract', async function() {
      const contract = this.bridge
      const user = accounts[1]
      const notAContractAddress = accounts[2]

      await contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner
      ).should.be.fulfilled

      expect(await contract.bridgeContract()).to.be.equal(bridgeContract.address)

      const newBridgeContract = await AMBMock.new()

      await contract.setBridgeContract(newBridgeContract.address, { from: user }).should.be.rejectedWith(ERROR_MSG)
      await contract.setBridgeContract(notAContractAddress, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      await contract.setBridgeContract(newBridgeContract.address, { from: owner }).should.be.fulfilled
      expect(await contract.bridgeContract()).to.be.equal(newBridgeContract.address)
    })
    it('only owner can set mediator contract', async function() {
      const contract = this.bridge
      const user = accounts[1]

      await contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner
      ).should.be.fulfilled

      expect(await contract.bridgeContract()).to.be.equal(bridgeContract.address)

      const newMediatorContract = await otherSideMediatorContract.new()

      await contract
        .setMediatorContractOnOtherSide(newMediatorContract.address, { from: user })
        .should.be.rejectedWith(ERROR_MSG)

      await contract.setMediatorContractOnOtherSide(newMediatorContract.address, { from: owner }).should.be.fulfilled
      expect(await contract.mediatorContractOnOtherSide()).to.be.equal(newMediatorContract.address)
    })
    it('only owner can set request Gas Limit', async function() {
      const contract = this.bridge
      const user = accounts[1]

      await contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner
      ).should.be.fulfilled

      expect(await contract.requestGasLimit()).to.be.bignumber.equal(maxGasPerTx)

      const newMaxGasPerTx = ether('0.5')
      const invalidMaxGasPerTx = ether('1.5')

      await contract.setRequestGasLimit(newMaxGasPerTx, { from: user }).should.be.rejectedWith(ERROR_MSG)

      // invalidMaxGasPerTx > bridgeContract.maxGasPerTx
      await contract.setRequestGasLimit(invalidMaxGasPerTx, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      await contract.setRequestGasLimit(newMaxGasPerTx, { from: owner }).should.be.fulfilled
      expect(await contract.requestGasLimit()).to.be.bignumber.equal(newMaxGasPerTx)
    })
  })
  describe('set limits', () => {
    let contract
    beforeEach(async function() {
      bridgeContract = await AMBMock.new()
      await bridgeContract.setMaxGasPerTx(maxGasPerTx)
      mediatorContract = await otherSideMediatorContract.new()
      erc677Token = await ERC677BridgeToken.new('test', 'TST', 18)

      contract = this.bridge

      await contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        [3, 2, 1],
        [3, 2],
        maxGasPerTx,
        decimalShiftZero,
        owner
      ).should.be.fulfilled
    })
    it('setMaxPerTx allows to set only to owner and cannot be more than daily limit', async () => {
      await contract.setMaxPerTx(2, { from: user }).should.be.rejectedWith(ERROR_MSG)
      await contract.setMaxPerTx(2, { from: owner }).should.be.fulfilled
      expect(await contract.maxPerTx()).to.be.bignumber.equal('2')

      await contract.setMaxPerTx(3, { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })
    it('setMinPerTx allows to set only to owner and cannot be more than daily limit and should be less than maxPerTx', async () => {
      await contract.setMinPerTx(1, { from: user }).should.be.rejectedWith(ERROR_MSG)
      await contract.setMinPerTx(1, { from: owner }).should.be.fulfilled
      expect(await contract.minPerTx()).to.be.bignumber.equal('1')

      await contract.setMinPerTx(2, { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })
    it('setDailyLimit allow to set by owner and should be greater than maxPerTx or zero', async () => {
      await contract.setDailyLimit(4, { from: user }).should.be.rejectedWith(ERROR_MSG)
      await contract.setDailyLimit(2, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      await contract.setDailyLimit(4, { from: owner }).should.be.fulfilled
      expect(await contract.dailyLimit()).to.be.bignumber.equal('4')

      await contract.setDailyLimit(0, { from: owner }).should.be.fulfilled
      expect(await contract.dailyLimit()).to.be.bignumber.equal(ZERO)

      await contract.setDailyLimit(4, { from: owner }).should.be.fulfilled
      expect(await contract.dailyLimit()).to.be.bignumber.equal('4')
    })
    it('setExecutionMaxPerTx allows to set only to owner and cannot be more than daily limit', async () => {
      await contract.setExecutionMaxPerTx(2, { from: user }).should.be.rejectedWith(ERROR_MSG)
      await contract.setExecutionMaxPerTx(2, { from: owner }).should.be.fulfilled
      expect(await contract.executionMaxPerTx()).to.be.bignumber.equal('2')

      await contract.setExecutionMaxPerTx(3, { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })
    it('setExecutionDailyLimit allow to set by owner and should be greater than maxPerTx or zero', async () => {
      await contract.setExecutionDailyLimit(4, { from: user }).should.be.rejectedWith(ERROR_MSG)
      await contract.setExecutionDailyLimit(2, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      await contract.setExecutionDailyLimit(4, { from: owner }).should.be.fulfilled
      expect(await contract.executionDailyLimit()).to.be.bignumber.equal('4')

      await contract.setExecutionDailyLimit(0, { from: owner }).should.be.fulfilled
      expect(await contract.executionDailyLimit()).to.be.bignumber.equal(ZERO)

      await contract.setExecutionDailyLimit(4, { from: owner }).should.be.fulfilled
      expect(await contract.executionDailyLimit()).to.be.bignumber.equal('4')
    })
  })
  describe('getBridgeMode', () => {
    it('should return arbitrary message bridging mode and interface', async function() {
      const contract = this.bridge
      const bridgeModeHash = '0x76595b56' // 4 bytes of keccak256('erc-to-erc-amb')
      expect(await contract.getBridgeMode()).to.be.equal(bridgeModeHash)

      const { major, minor, patch } = await contract.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(ZERO)
      minor.should.be.bignumber.gte(ZERO)
      patch.should.be.bignumber.gte(ZERO)
    })
  })
  describe('fixAssetsAboveLimits', () => {
    let contract
    beforeEach(async function() {
      bridgeContract = await AMBMock.new()
      await bridgeContract.setMaxGasPerTx(maxGasPerTx)
      mediatorContract = await otherSideMediatorContract.new()
      erc677Token = await ERC677BridgeToken.new('test', 'TST', 18)

      contract = this.proxyContract

      await contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner
      ).should.be.fulfilled

      const outOfLimitValueData = await contract.contract.methods
        .handleBridgedTokens(user, twoEthers.toString())
        .encodeABI()

      await bridgeContract.executeMessageCall(
        contract.address,
        mediatorContract.address,
        outOfLimitValueData,
        exampleMessageId,
        1000000
      ).should.be.fulfilled

      const outOfLimitEvent = await getEvents(contract, { event: 'AmountLimitExceeded' })
      expect(outOfLimitEvent.length).to.be.equal(1)
      expect(outOfLimitEvent[0].returnValues.recipient).to.be.equal(user)
      expect(outOfLimitEvent[0].returnValues.value).to.be.equal(twoEthers.toString())
      expect(outOfLimitEvent[0].returnValues.transactionHash).to.be.equal(exampleMessageId)
    })
    it('Should revert if value to unlock is bigger than max per transaction', async function() {
      await contract.fixAssetsAboveLimits(exampleMessageId, false, twoEthers).should.be.rejectedWith(ERROR_MSG)
    })
    it('Should allow to partially reduce outOfLimitAmount and not emit amb event', async function() {
      const { logs } = await contract.fixAssetsAboveLimits(exampleMessageId, false, halfEther).should.be.fulfilled

      logs.length.should.be.equal(1)
      expectEventInLogs(logs, 'AssetAboveLimitsFixed', {
        transactionHash: exampleMessageId,
        value: halfEther,
        remaining: ether('1.5')
      })
      const events = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(0)
      expect(await contract.outOfLimitAmount()).to.be.bignumber.equal(ether('1.5'))

      const { logs: logsSecondTx } = await contract.fixAssetsAboveLimits(exampleMessageId, false, halfEther).should.be
        .fulfilled

      logsSecondTx.length.should.be.equal(1)
      expectEventInLogs(logsSecondTx, 'AssetAboveLimitsFixed', {
        transactionHash: exampleMessageId,
        value: halfEther,
        remaining: oneEther
      })
      const eventsAfterSecondTx = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(eventsAfterSecondTx.length).to.be.equal(0)
      expect(await contract.outOfLimitAmount()).to.be.bignumber.equal(oneEther)
    })
    it('Should allow to partially reduce outOfLimitAmount and emit amb event', async function() {
      const { logs } = await contract.fixAssetsAboveLimits(exampleMessageId, true, halfEther).should.be.fulfilled

      logs.length.should.be.equal(1)
      expectEventInLogs(logs, 'AssetAboveLimitsFixed', {
        transactionHash: exampleMessageId,
        value: halfEther,
        remaining: ether('1.5')
      })
      const events = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      expect(await contract.outOfLimitAmount()).to.be.bignumber.equal(ether('1.5'))

      const { logs: logsSecondTx } = await contract.fixAssetsAboveLimits(exampleMessageId, true, halfEther).should.be
        .fulfilled

      logsSecondTx.length.should.be.equal(1)
      expectEventInLogs(logsSecondTx, 'AssetAboveLimitsFixed', {
        transactionHash: exampleMessageId,
        value: halfEther,
        remaining: oneEther
      })
      const eventsAfterSecondTx = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(eventsAfterSecondTx.length).to.be.equal(2)
      expect(await contract.outOfLimitAmount()).to.be.bignumber.equal(oneEther)
    })
    it('Should revert if try to unlock more than available', async function() {
      const { logs } = await contract.fixAssetsAboveLimits(exampleMessageId, true, halfEther).should.be.fulfilled

      logs.length.should.be.equal(1)
      expectEventInLogs(logs, 'AssetAboveLimitsFixed', {
        transactionHash: exampleMessageId,
        value: halfEther,
        remaining: ether('1.5')
      })

      const { logs: logsSecondTx } = await contract.fixAssetsAboveLimits(exampleMessageId, true, halfEther).should.be
        .fulfilled

      logsSecondTx.length.should.be.equal(1)
      expectEventInLogs(logsSecondTx, 'AssetAboveLimitsFixed', {
        transactionHash: exampleMessageId,
        value: halfEther,
        remaining: oneEther
      })

      const { logs: logsThirdTx } = await contract.fixAssetsAboveLimits(exampleMessageId, true, halfEther).should.be
        .fulfilled

      logsThirdTx.length.should.be.equal(1)
      expectEventInLogs(logsThirdTx, 'AssetAboveLimitsFixed', {
        transactionHash: exampleMessageId,
        value: halfEther,
        remaining: halfEther
      })

      await contract.fixAssetsAboveLimits(exampleMessageId, true, oneEther).should.be.rejectedWith(ERROR_MSG)
    })
    it('Should not be allow to be called by an already fixed message', async function() {
      const { logs } = await contract.fixAssetsAboveLimits(exampleMessageId, true, oneEther).should.be.fulfilled

      logs.length.should.be.equal(1)
      expectEventInLogs(logs, 'AssetAboveLimitsFixed', {
        transactionHash: exampleMessageId,
        value: oneEther,
        remaining: oneEther
      })

      const { logs: logsSecondTx } = await contract.fixAssetsAboveLimits(exampleMessageId, true, oneEther).should.be
        .fulfilled

      logsSecondTx.length.should.be.equal(1)
      expectEventInLogs(logsSecondTx, 'AssetAboveLimitsFixed', {
        transactionHash: exampleMessageId,
        value: oneEther,
        remaining: ZERO
      })

      await contract.fixAssetsAboveLimits(exampleMessageId, true, oneEther).should.be.rejectedWith(ERROR_MSG)
    })
    it('Should fail if message didnt increase out of limit amount', async function() {
      const invalidMessageId = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'

      await contract.fixAssetsAboveLimits(invalidMessageId, true, halfEther).should.be.rejectedWith(ERROR_MSG)
    })
    it('Should fail if not called by proxyOwner', async function() {
      await contract
        .fixAssetsAboveLimits(exampleMessageId, true, oneEther, {
          from: user
        })
        .should.be.rejectedWith(ERROR_MSG)
      await contract.fixAssetsAboveLimits(exampleMessageId, true, oneEther).should.be.fulfilled
    })
  })
  describe('relayTokens', () => {
    let contract
    let erc20Token
    beforeEach(async function() {
      bridgeContract = await AMBMock.new()
      await bridgeContract.setMaxGasPerTx(maxGasPerTx)
      mediatorContract = await otherSideMediatorContract.new()
      erc20Token = await ERC20Mock.new('test', 'TST', 18)
      await erc20Token.mint(user, twoEthers, { from: owner }).should.be.fulfilled

      contract = this.bridge
    })
    it('should allow to bridge tokens using approve and transferFrom', async () => {
      // Given
      await contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc20Token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner
      ).should.be.fulfilled

      const currentDay = await contract.getCurrentDay()
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      const value = oneEther
      await erc20Token.approve(contract.address, value, { from: user }).should.be.fulfilled
      expect(await erc20Token.allowance(user, contract.address)).to.be.bignumber.equal(value)

      // When
      await contract.relayTokens(user, value, { from: user }).should.be.fulfilled

      // Then
      const events = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(value)
    })
    it('should allow to specify a different receiver without specifying sender', async () => {
      // Given
      await contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc20Token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner
      ).should.be.fulfilled

      const currentDay = await contract.getCurrentDay()
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      const value = oneEther
      await erc20Token.approve(contract.address, value, { from: user }).should.be.fulfilled
      expect(await erc20Token.allowance(user, contract.address)).to.be.bignumber.equal(value)

      // When
      await contract.relayTokens(user2, value, { from: user }).should.be.fulfilled

      // Then
      const events = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      expect(events[0].returnValues.encodedData.includes(strip0x(user2).toLowerCase())).to.be.equal(true)
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(value)
    })
    it('should fail if user did not approve the transfer', async () => {
      await contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc20Token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner
      ).should.be.fulfilled

      await contract.relayTokens(user, oneEther, { from: user }).should.be.rejectedWith(ERROR_MSG)
    })
    it('should fail if value is not within limits', async () => {
      await contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc20Token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner
      ).should.be.fulfilled

      const value = twoEthers
      await erc20Token.approve(contract.address, value, { from: user }).should.be.fulfilled
      expect(await erc20Token.allowance(user, contract.address)).to.be.bignumber.equal(value)

      await contract.relayTokens(user, value, { from: user }).should.be.rejectedWith(ERROR_MSG)
    })
    it('should prevent emitting the event twice when ERC677 used by relayTokens and ERC677 is owned by token manager', async function() {
      // Given
      const erc677Token = await ERC677BridgeToken.new('test', 'TST', 18)
      await erc677Token.mint(user, twoEthers, { from: owner }).should.be.fulfilled
      await erc677Token.setBridgeContract(contract.address, { from: owner }).should.be.fulfilled
      await erc677Token.transferOwnership(contract.address, { from: owner }).should.be.fulfilled

      contract = this.bridge

      await contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner
      ).should.be.fulfilled

      const currentDay = await contract.getCurrentDay()
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      const value = oneEther
      await erc677Token.approve(contract.address, value, { from: user }).should.be.fulfilled
      expect(await erc677Token.allowance(user, contract.address)).to.be.bignumber.equal(value)

      // When
      await contract.relayTokens(user, value, { from: user }).should.be.fulfilled

      // Then
      const events = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(value)
    })
    it('should prevent emitting the event twice when ERC677 used by relayTokens and ERC677 is not owned by token manager', async function() {
      // Given
      const erc677Token = await ERC677BridgeToken.new('test', 'TST', 18)
      await erc677Token.mint(user, twoEthers, { from: owner }).should.be.fulfilled

      contract = this.bridge

      await contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner
      ).should.be.fulfilled

      const currentDay = await contract.getCurrentDay()
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      const value = oneEther
      await erc677Token.approve(contract.address, value, { from: user }).should.be.fulfilled
      expect(await erc677Token.allowance(user, contract.address)).to.be.bignumber.equal(value)

      // When
      await contract.relayTokens(user, value, { from: user }).should.be.fulfilled

      // Then
      const events = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(value)
    })
  })
  describe('requestFailedMessageFix', () => {
    let contract
    beforeEach(async function() {
      bridgeContract = await AMBMock.new()
      await bridgeContract.setMaxGasPerTx(maxGasPerTx)
      mediatorContract = await otherSideMediatorContract.new()
      erc677Token = await ERC677BridgeToken.new('test', 'TST', 18)

      contract = this.proxyContract

      await contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner
      ).should.be.fulfilled
    })
    it('should allow to request a failed message fix', async () => {
      // Given
      const data = await contract.contract.methods.handleBridgedTokens(user, oneEther.toString()).encodeABI()

      await bridgeContract.executeMessageCall(contract.address, mediatorContract.address, data, exampleMessageId, 100)
        .should.be.fulfilled

      expect(await bridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(false)

      // When
      await contract.requestFailedMessageFix(exampleMessageId).should.be.fulfilled

      // Then
      const events = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      expect(events[0].returnValues.encodedData.includes(strip0x(exampleMessageId))).to.be.equal(true)
    })
    it('should be a failed transaction', async () => {
      // Given
      const data = await contract.contract.methods.handleBridgedTokens(user, twoEthers.toString()).encodeABI()

      await bridgeContract.executeMessageCall(
        contract.address,
        mediatorContract.address,
        data,
        exampleMessageId,
        1000000
      ).should.be.fulfilled

      expect(await bridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)

      // When
      await contract.requestFailedMessageFix(exampleMessageId).should.be.rejectedWith(ERROR_MSG)
    })
    it('should be the receiver of the failed transaction', async () => {
      // Given
      const data = await contract.contract.methods.handleBridgedTokens(user, oneEther.toString()).encodeABI()

      await bridgeContract.executeMessageCall(
        bridgeContract.address,
        mediatorContract.address,
        data,
        exampleMessageId,
        100000
      ).should.be.fulfilled

      expect(await bridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(false)

      // When
      await contract.requestFailedMessageFix(exampleMessageId).should.be.rejectedWith(ERROR_MSG)
    })
    it('message sender should be mediator from other side', async () => {
      // Given
      const data = await contract.contract.methods.handleBridgedTokens(user, oneEther.toString()).encodeABI()

      await bridgeContract.executeMessageCall(contract.address, contract.address, data, exampleMessageId, 100).should.be
        .fulfilled

      expect(await bridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(false)

      // When
      await contract.requestFailedMessageFix(exampleMessageId).should.be.rejectedWith(ERROR_MSG)
    })
    it('should allow to request a fix multiple times', async () => {
      // Given
      const data = await contract.contract.methods.handleBridgedTokens(user, oneEther.toString()).encodeABI()

      await bridgeContract.executeMessageCall(contract.address, mediatorContract.address, data, exampleMessageId, 100)
        .should.be.fulfilled

      expect(await bridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(false)

      await contract.requestFailedMessageFix(exampleMessageId).should.be.fulfilled

      const events = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      expect(events[0].returnValues.encodedData.includes(strip0x(exampleMessageId))).to.be.equal(true)

      // When
      await contract.requestFailedMessageFix(exampleMessageId).should.be.fulfilled

      // Then
      const allEvents = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(allEvents.length).to.be.equal(2)
      expect(allEvents[0].returnValues.encodedData.includes(strip0x(exampleMessageId))).to.be.equal(true)
      expect(allEvents[1].returnValues.encodedData.includes(strip0x(exampleMessageId))).to.be.equal(true)
    })
  })
  describe('fixFailedMessage', () => {
    let contract
    let transferMessageId
    beforeEach(async function() {
      bridgeContract = await AMBMock.new()
      await bridgeContract.setMaxGasPerTx(maxGasPerTx)
      mediatorContract = await otherSideMediatorContract.new()
      erc677Token = await ERC677BridgeToken.new('test', 'TST', 18)
      await erc677Token.mint(user, twoEthers, { from: owner }).should.be.fulfilled

      contract = this.bridge

      await contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner
      ).should.be.fulfilled
      await erc677Token.transferOwnership(contract.address)

      expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(twoEthers)
      expect(await erc677Token.totalSupply()).to.be.bignumber.equal(twoEthers)

      // User transfer tokens
      await erc677Token.transferAndCall(contract.address, oneEther, '0x', { from: user }).should.be.fulfilled

      expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(oneEther)

      const events = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      transferMessageId = events[0].returnValues.messageId
    })
    it('should fix burnt/locked tokens', async () => {
      // Given
      expect(await contract.messageFixed(transferMessageId)).to.be.equal(false)

      // When
      const fixData = await contract.contract.methods.fixFailedMessage(transferMessageId).encodeABI()
      await bridgeContract.executeMessageCall(
        contract.address,
        mediatorContract.address,
        fixData,
        exampleMessageId,
        1000000
      ).should.be.fulfilled

      // Then
      expect(await bridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)
      expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(twoEthers)
      expect(await erc677Token.totalSupply()).to.be.bignumber.equal(twoEthers)
      expect(await contract.messageFixed(transferMessageId)).to.be.equal(true)

      const event = await getEvents(contract, { event: 'FailedMessageFixed' })
      expect(event.length).to.be.equal(1)
      expect(event[0].returnValues.messageId).to.be.equal(transferMessageId)
      expect(event[0].returnValues.recipient).to.be.equal(user)
      expect(event[0].returnValues.value).to.be.equal(oneEther.toString())

      // can only fix it one time
      await bridgeContract.executeMessageCall(
        contract.address,
        mediatorContract.address,
        fixData,
        otherMessageId,
        1000000
      ).should.be.fulfilled

      expect(await bridgeContract.messageCallStatus(otherMessageId)).to.be.equal(false)
      expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(twoEthers)
    })
    it('should be called by bridge', async () => {
      await contract.fixFailedMessage(transferMessageId, { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })
    it('message sender should be mediator from other side', async () => {
      // Given
      expect(await contract.messageFixed(transferMessageId)).to.be.equal(false)

      // When
      const fixData = await contract.contract.methods.fixFailedMessage(transferMessageId).encodeABI()

      await bridgeContract.executeMessageCall(contract.address, contract.address, fixData, exampleMessageId, 1000000)
        .should.be.fulfilled

      // Then
      expect(await bridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(false)
      expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(oneEther)
      expect(await contract.messageFixed(transferMessageId)).to.be.equal(false)

      const otherMessageId = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'

      await bridgeContract.executeMessageCall(
        contract.address,
        mediatorContract.address,
        fixData,
        otherMessageId,
        1000000
      ).should.be.fulfilled

      expect(await bridgeContract.messageCallStatus(otherMessageId)).to.be.equal(true)
      expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(twoEthers)
      expect(await contract.messageFixed(transferMessageId)).to.be.equal(true)

      const event = await getEvents(contract, { event: 'FailedMessageFixed' })
      expect(event.length).to.be.equal(1)
      expect(event[0].returnValues.messageId).to.be.equal(transferMessageId)
      expect(event[0].returnValues.recipient).to.be.equal(user)
      expect(event[0].returnValues.value).to.be.equal(oneEther.toString())
    })
  })
  describe('fixFailedMessage for alternative receiver', () => {
    let transferMessageId
    let contract
    beforeEach(async function() {
      bridgeContract = await AMBMock.new()
      await bridgeContract.setMaxGasPerTx(maxGasPerTx)
      mediatorContract = await otherSideMediatorContract.new()
      erc677Token = await ERC677BridgeToken.new('test', 'TST', 18)
      await erc677Token.mint(user, twoEthers, { from: owner }).should.be.fulfilled

      contract = this.bridge

      await contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner
      ).should.be.fulfilled
      await erc677Token.transferOwnership(contract.address)

      expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(twoEthers)
      expect(await erc677Token.totalSupply()).to.be.bignumber.equal(twoEthers)

      // User transfer tokens
      await erc677Token.transferAndCall(contract.address, oneEther, user2, { from: user }).should.be.fulfilled

      expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(oneEther)

      const events = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      transferMessageId = events[0].returnValues.messageId
    })
    it('should fix burnt/locked tokens', async () => {
      // Given
      expect(await contract.messageFixed(transferMessageId)).to.be.equal(false)

      // When
      const fixData = await contract.contract.methods.fixFailedMessage(transferMessageId).encodeABI()

      await bridgeContract.executeMessageCall(
        contract.address,
        mediatorContract.address,
        fixData,
        exampleMessageId,
        1000000
      ).should.be.fulfilled

      // Then
      expect(await bridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)
      expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(twoEthers)
      expect(await erc677Token.totalSupply()).to.be.bignumber.equal(twoEthers)
      expect(await contract.messageFixed(transferMessageId)).to.be.equal(true)

      const event = await getEvents(contract, { event: 'FailedMessageFixed' })
      expect(event.length).to.be.equal(1)
      expect(event[0].returnValues.messageId).to.be.equal(transferMessageId)
      expect(event[0].returnValues.recipient).to.be.equal(user)
      expect(event[0].returnValues.value).to.be.equal(oneEther.toString())
    })
  })
  describe('#claimTokens', () => {
    it('should be able to claim tokens', async function() {
      const contract = this.proxyContract

      await contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner
      ).should.be.fulfilled

      const tokenSecond = await ERC677BridgeToken.new('Test Token', 'TST', 18)

      await tokenSecond.mint(accounts[0], halfEther).should.be.fulfilled
      expect(await tokenSecond.balanceOf(accounts[0])).to.be.bignumber.equal(halfEther)

      await tokenSecond.transfer(contract.address, halfEther)
      expect(await tokenSecond.balanceOf(accounts[0])).to.be.bignumber.equal(ZERO)
      expect(await tokenSecond.balanceOf(contract.address)).to.be.bignumber.equal(halfEther)

      await contract
        .claimTokens(tokenSecond.address, accounts[3], { from: accounts[3] })
        .should.be.rejectedWith(ERROR_MSG)
      await contract.claimTokens(tokenSecond.address, accounts[3], { from: owner }).should.be.fulfilled
      expect(await tokenSecond.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
      expect(await tokenSecond.balanceOf(accounts[3])).to.be.bignumber.equal(halfEther)
    })
  })
}

module.exports = {
  shouldBehaveLikeBasicAMBErc677ToErc677
}
