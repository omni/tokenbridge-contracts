const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const ERC20Mock = artifacts.require('ERC20Mock.sol')
const AMBMock = artifacts.require('AMBMock.sol')

const { expect } = require('chai')
const { ZERO_ADDRESS, toBN, ERROR_MSG } = require('../setup')
const { getEvents, expectEventInLogs, ether, strip0x, calculateDailyLimit } = require('../helpers/helpers')

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
const executionMinPerTx = minPerTx
const exampleTxHash = '0xf308b922ab9f8a7128d9d7bc9bce22cd88b2c05c8213f0e2d8104d78e0a9ecbb'
const decimalShiftZero = 0
const targetLimit = ether('0.05')
const threshold = ether('10000')

function shouldBehaveLikeBasicAMBErc677ToErc677(
  otherSideMediatorContract,
  accounts,
  isRelativeDailyLimit,
  isRelativeDailyLimitOnBridgeSide
) {
  let bridgeContract
  let mediatorContract
  let erc677Token
  let contract
  const owner = accounts[0]
  const user = accounts[1]

  let limitsArray = [dailyLimit, maxPerTx, minPerTx]
  let executionLimitsArray = [executionDailyLimit, executionMaxPerTx, executionMinPerTx]

  if (isRelativeDailyLimit) {
    if (isRelativeDailyLimitOnBridgeSide) {
      limitsArray = [targetLimit, threshold, maxPerTx, minPerTx]
    } else {
      executionLimitsArray = [targetLimit, threshold, executionMaxPerTx, executionMinPerTx]
    }
  }

  function initialize(tokenAddress) {
    return contract.initialize(
      bridgeContract.address,
      mediatorContract.address,
      tokenAddress,
      limitsArray,
      executionLimitsArray,
      maxGasPerTx,
      decimalShiftZero,
      owner
    ).should.be.fulfilled
  }

  describe('initialize', () => {
    beforeEach(async () => {
      bridgeContract = await AMBMock.new()
      await bridgeContract.setMaxGasPerTx(maxGasPerTx)
      mediatorContract = await otherSideMediatorContract.new()
      erc677Token = await ERC677BridgeToken.new('test', 'TST', 18)
    })
    it('should initialize', async function() {
      contract = this.bridge
      expect(await contract.isInitialized()).to.be.equal(false)
      expect(await contract.bridgeContract()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.mediatorContractOnOtherSide()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.erc677token()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.maxPerTx()).to.be.bignumber.equal(ZERO)
      expect(await contract.minPerTx()).to.be.bignumber.equal(ZERO)
      expect(await contract.executionMaxPerTx()).to.be.bignumber.equal(ZERO)
      expect(await contract.executionMinPerTx()).to.be.bignumber.equal(ZERO)
      expect(await contract.requestGasLimit()).to.be.bignumber.equal(ZERO)
      expect(await contract.owner()).to.be.equal(ZERO_ADDRESS)

      if (isRelativeDailyLimit) {
        expect(await contract.targetLimit()).to.be.bignumber.equal(ZERO)
        expect(await contract.threshold()).to.be.bignumber.equal(ZERO)
        if (isRelativeDailyLimitOnBridgeSide) {
          expect(await contract.executionDailyLimit()).to.be.bignumber.equal(ZERO)
        } else {
          expect(await contract.dailyLimit()).to.be.bignumber.equal(ZERO)
        }
      } else {
        expect(await contract.executionDailyLimit()).to.be.bignumber.equal(ZERO)
        expect(await contract.dailyLimit()).to.be.bignumber.equal(ZERO)
      }

      // not valid bridge contract
      await contract
        .initialize(
          ZERO_ADDRESS,
          mediatorContract.address,
          erc677Token.address,
          limitsArray,
          executionLimitsArray,
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
          limitsArray,
          executionLimitsArray,
          maxGasPerTx,
          decimalShiftZero,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)

      // dailyLimit > maxPerTx
      let limits = [maxPerTx, maxPerTx, minPerTx]
      let executionLimits = [executionDailyLimit, executionMaxPerTx, executionMinPerTx]
      let relativeDailyLimit = [targetLimit, threshold, executionMaxPerTx, executionMinPerTx]
      if (isRelativeDailyLimit) {
        limits = isRelativeDailyLimitOnBridgeSide ? relativeDailyLimit : limits
        executionLimits = isRelativeDailyLimitOnBridgeSide ? limits : relativeDailyLimit
      }
      await contract
        .initialize(
          bridgeContract.address,
          mediatorContract.address,
          erc677Token.address,
          limits,
          executionLimits,
          maxGasPerTx,
          decimalShiftZero,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)

      // maxPerTx > minPerTx
      limits = [dailyLimit, minPerTx, minPerTx]
      executionLimits = [executionDailyLimit, executionMaxPerTx, executionMinPerTx]
      relativeDailyLimit = [targetLimit, threshold, executionMaxPerTx, executionMinPerTx]
      if (isRelativeDailyLimit) {
        limits = isRelativeDailyLimitOnBridgeSide ? relativeDailyLimit : limits
        executionLimits = isRelativeDailyLimitOnBridgeSide ? limits : relativeDailyLimit
      }
      await contract
        .initialize(
          bridgeContract.address,
          mediatorContract.address,
          erc677Token.address,
          limits,
          executionLimits,
          maxGasPerTx,
          decimalShiftZero,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)

      // threshold <= 1 ether
      if (isRelativeDailyLimit) {
        limits = [dailyLimit, maxPerTx, minPerTx]
        relativeDailyLimit = [ether('1.1'), threshold, executionMaxPerTx, executionMinPerTx]
        await contract
          .initialize(
            bridgeContract.address,
            mediatorContract.address,
            erc677Token.address,
            isRelativeDailyLimitOnBridgeSide ? relativeDailyLimit : limits,
            isRelativeDailyLimitOnBridgeSide ? limits : relativeDailyLimit,
            maxGasPerTx,
            decimalShiftZero,
            owner
          )
          .should.be.rejectedWith(ERROR_MSG)

        // threshold >= executionMinPerTx
        limits = [dailyLimit, maxPerTx, minPerTx]
        relativeDailyLimit = [targetLimit, ether('0.009'), executionMaxPerTx, executionMinPerTx]
        await contract
          .initialize(
            bridgeContract.address,
            mediatorContract.address,
            erc677Token.address,
            isRelativeDailyLimitOnBridgeSide ? relativeDailyLimit : limits,
            isRelativeDailyLimitOnBridgeSide ? limits : relativeDailyLimit,
            maxGasPerTx,
            decimalShiftZero,
            owner
          )
          .should.be.rejectedWith(ERROR_MSG)
      }

      // executionMaxPerTx > executionMinPerTx
      limits = [dailyLimit, maxPerTx, minPerTx]
      executionLimits = [executionDailyLimit, executionMinPerTx, executionMinPerTx]
      relativeDailyLimit = [targetLimit, threshold, executionMinPerTx, executionMinPerTx]
      if (isRelativeDailyLimit) {
        limits = isRelativeDailyLimitOnBridgeSide ? relativeDailyLimit : limits
        executionLimits = isRelativeDailyLimitOnBridgeSide ? limits : relativeDailyLimit
      }
      await contract
        .initialize(
          bridgeContract.address,
          mediatorContract.address,
          erc677Token.address,
          limits,
          executionLimits,
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
          limitsArray,
          executionLimitsArray,
          dailyLimit,
          decimalShiftZero,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)

      const { logs } = await initialize(erc677Token.address)

      // already initialized
      await contract
        .initialize(
          bridgeContract.address,
          mediatorContract.address,
          erc677Token.address,
          limitsArray,
          executionLimitsArray,
          maxGasPerTx,
          decimalShiftZero,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)

      expect(await contract.isInitialized()).to.be.equal(true)
      expect(await contract.bridgeContract()).to.be.equal(bridgeContract.address)
      expect(await contract.mediatorContractOnOtherSide()).to.be.equal(mediatorContract.address)
      expect(await contract.erc677token()).to.be.equal(erc677Token.address)
      expect(await contract.maxPerTx()).to.be.bignumber.equal(maxPerTx)
      expect(await contract.minPerTx()).to.be.bignumber.equal(minPerTx)
      expect(await contract.executionMaxPerTx()).to.be.bignumber.equal(executionMaxPerTx)
      expect(await contract.executionMinPerTx()).to.be.bignumber.equal(executionMinPerTx)
      expect(await contract.requestGasLimit()).to.be.bignumber.equal(maxGasPerTx)
      expect(await contract.owner()).to.be.equal(owner)

      if (isRelativeDailyLimit) {
        expect(await contract.targetLimit()).to.be.bignumber.equal(targetLimit)
        expect(await contract.threshold()).to.be.bignumber.equal(threshold)
        if (isRelativeDailyLimitOnBridgeSide) {
          expect(await contract.executionDailyLimit()).to.be.bignumber.equal(executionDailyLimit)
          expectEventInLogs(logs, 'ExecutionDailyLimitChanged', { newLimit: executionDailyLimit })
        } else {
          expect(await contract.dailyLimit()).to.be.bignumber.equal(dailyLimit)
          expectEventInLogs(logs, 'DailyLimitChanged', { newLimit: dailyLimit })
        }
      } else {
        expect(await contract.executionDailyLimit()).to.be.bignumber.equal(executionDailyLimit)
        expect(await contract.dailyLimit()).to.be.bignumber.equal(dailyLimit)
        expectEventInLogs(logs, 'ExecutionDailyLimitChanged', { newLimit: executionDailyLimit })
        expectEventInLogs(logs, 'DailyLimitChanged', { newLimit: dailyLimit })
      }
    })
    it('only owner can set bridge contract', async function() {
      contract = this.bridge
      const user = accounts[1]
      const notAContractAddress = accounts[2]

      await initialize(erc677Token.address)

      expect(await contract.bridgeContract()).to.be.equal(bridgeContract.address)

      const newBridgeContract = await AMBMock.new()

      await contract.setBridgeContract(newBridgeContract.address, { from: user }).should.be.rejectedWith(ERROR_MSG)
      await contract.setBridgeContract(notAContractAddress, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      await contract.setBridgeContract(newBridgeContract.address, { from: owner }).should.be.fulfilled
      expect(await contract.bridgeContract()).to.be.equal(newBridgeContract.address)
    })
    it('only owner can set mediator contract', async function() {
      contract = this.bridge
      const user = accounts[1]

      await initialize(erc677Token.address)

      expect(await contract.bridgeContract()).to.be.equal(bridgeContract.address)

      const newMediatorContract = await otherSideMediatorContract.new()

      await contract
        .setMediatorContractOnOtherSide(newMediatorContract.address, { from: user })
        .should.be.rejectedWith(ERROR_MSG)

      await contract.setMediatorContractOnOtherSide(newMediatorContract.address, { from: owner }).should.be.fulfilled
      expect(await contract.mediatorContractOnOtherSide()).to.be.equal(newMediatorContract.address)
    })
    it('only owner can set request Gas Limit', async function() {
      contract = this.bridge
      const user = accounts[1]

      await initialize(erc677Token.address)

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
    beforeEach(async function() {
      bridgeContract = await AMBMock.new()
      await bridgeContract.setMaxGasPerTx(maxGasPerTx)
      mediatorContract = await otherSideMediatorContract.new()
      erc677Token = await ERC677BridgeToken.new('test', 'TST', 18)

      contract = this.bridge

      let limits = [3, 2, 1]
      let executionLimits = [3, 2, 1]

      if (isRelativeDailyLimit) {
        if (isRelativeDailyLimitOnBridgeSide) {
          limits = [ether('0.05'), 3, 2, 1]
        } else {
          executionLimits = [ether('0.05'), 3, 2, 1]
        }
      }

      await contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        limits,
        executionLimits,
        maxGasPerTx,
        decimalShiftZero,
        owner
      ).should.be.fulfilled
    })
    it('setMaxPerTx allows to set only to owner and cannot be more than daily limit', async () => {
      await contract.setMaxPerTx(2, { from: user }).should.be.rejectedWith(ERROR_MSG)
      await contract.setMaxPerTx(2, { from: owner }).should.be.fulfilled
      expect(await contract.maxPerTx()).to.be.bignumber.equal('2')

      if (!isRelativeDailyLimit || (isRelativeDailyLimit && !isRelativeDailyLimitOnBridgeSide)) {
        await contract.setMaxPerTx(3, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      }
    })
    it('setMinPerTx allows to set only to owner and cannot be more than daily limit and should be less than maxPerTx', async () => {
      await contract.setMinPerTx(1, { from: user }).should.be.rejectedWith(ERROR_MSG)
      await contract.setMinPerTx(1, { from: owner }).should.be.fulfilled
      expect(await contract.minPerTx()).to.be.bignumber.equal('1')

      await contract.setMinPerTx(2, { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })
    if (!isRelativeDailyLimit || (isRelativeDailyLimit && !isRelativeDailyLimitOnBridgeSide)) {
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
    }
    it('setExecutionMaxPerTx allows to set only to owner and cannot be more than daily limit', async () => {
      await contract.setExecutionMaxPerTx(2, { from: user }).should.be.rejectedWith(ERROR_MSG)
      await contract.setExecutionMaxPerTx(2, { from: owner }).should.be.fulfilled
      expect(await contract.executionMaxPerTx()).to.be.bignumber.equal('2')

      if (!isRelativeDailyLimit || (isRelativeDailyLimit && isRelativeDailyLimitOnBridgeSide)) {
        await contract.setExecutionMaxPerTx(3, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      }
    })
    it('setExecutionMinPerTx allows to set only to owner and cannot be more than execution daily limit and should be less than executionMaxPerTx', async () => {
      await contract.setExecutionMinPerTx(1, { from: user }).should.be.rejectedWith(ERROR_MSG)
      await contract.setExecutionMinPerTx(1, { from: owner }).should.be.fulfilled
      expect(await contract.executionMinPerTx()).to.be.bignumber.equal('1')

      await contract.setExecutionMinPerTx(2, { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })
    if (!isRelativeDailyLimit || (isRelativeDailyLimit && isRelativeDailyLimitOnBridgeSide)) {
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
    }
  })
  describe('getBridgeMode', () => {
    it('should return arbitrary message bridging mode and interface', async function() {
      contract = this.bridge
      const bridgeModeHash = '0x76595b56' // 4 bytes of keccak256('erc-to-erc-amb')
      expect(await contract.getBridgeMode()).to.be.equal(bridgeModeHash)

      const { major, minor, patch } = await contract.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(ZERO)
      minor.should.be.bignumber.gte(ZERO)
      patch.should.be.bignumber.gte(ZERO)
    })
  })
  describe('fixAssetsAboveLimits', () => {
    const nonce = '0x96b6af865cdaa107ede916e237afbedffa5ed36bea84c0e77a33cc28fc2e9c01'
    beforeEach(async function() {
      bridgeContract = await AMBMock.new()
      await bridgeContract.setMaxGasPerTx(maxGasPerTx)
      mediatorContract = await otherSideMediatorContract.new()
      erc677Token = await ERC677BridgeToken.new('test', 'TST', 18)

      contract = this.proxyContract

      await initialize(erc677Token.address)

      const outOfLimitValueData = await contract.contract.methods
        .handleBridgedTokens(user, twoEthers.toString(), nonce)
        .encodeABI()

      await bridgeContract.executeMessageCall(
        contract.address,
        mediatorContract.address,
        outOfLimitValueData,
        exampleTxHash,
        1000000
      ).should.be.fulfilled

      const outOfLimitEvent = await getEvents(contract, { event: 'AmountLimitExceeded' })
      expect(outOfLimitEvent.length).to.be.equal(1)
      expect(outOfLimitEvent[0].returnValues.recipient).to.be.equal(user)
      expect(outOfLimitEvent[0].returnValues.value).to.be.equal(twoEthers.toString())
      expect(outOfLimitEvent[0].returnValues.transactionHash).to.be.equal(exampleTxHash)
    })
    it('Should revert if value to unlock is bigger than max per transaction', async function() {
      await contract.fixAssetsAboveLimits(exampleTxHash, false, twoEthers).should.be.rejectedWith(ERROR_MSG)
    })
    it('Should allow to partially reduce outOfLimitAmount and not emit amb event', async function() {
      const { logs } = await contract.fixAssetsAboveLimits(exampleTxHash, false, halfEther).should.be.fulfilled

      logs.length.should.be.equal(1)
      expectEventInLogs(logs, 'AssetAboveLimitsFixed', {
        transactionHash: exampleTxHash,
        value: halfEther,
        remaining: ether('1.5')
      })
      const events = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(0)
      expect(await contract.outOfLimitAmount()).to.be.bignumber.equal(ether('1.5'))

      const { logs: logsSecondTx } = await contract.fixAssetsAboveLimits(exampleTxHash, false, halfEther).should.be
        .fulfilled

      logsSecondTx.length.should.be.equal(1)
      expectEventInLogs(logsSecondTx, 'AssetAboveLimitsFixed', {
        transactionHash: exampleTxHash,
        value: halfEther,
        remaining: oneEther
      })
      const eventsAfterSecondTx = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(eventsAfterSecondTx.length).to.be.equal(0)
      expect(await contract.outOfLimitAmount()).to.be.bignumber.equal(oneEther)
    })
    it('Should allow to partially reduce outOfLimitAmount and emit amb event', async function() {
      const { logs } = await contract.fixAssetsAboveLimits(exampleTxHash, true, halfEther).should.be.fulfilled

      logs.length.should.be.equal(1)
      expectEventInLogs(logs, 'AssetAboveLimitsFixed', {
        transactionHash: exampleTxHash,
        value: halfEther,
        remaining: ether('1.5')
      })
      const events = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      expect(await contract.outOfLimitAmount()).to.be.bignumber.equal(ether('1.5'))

      const { logs: logsSecondTx } = await contract.fixAssetsAboveLimits(exampleTxHash, true, halfEther).should.be
        .fulfilled

      logsSecondTx.length.should.be.equal(1)
      expectEventInLogs(logsSecondTx, 'AssetAboveLimitsFixed', {
        transactionHash: exampleTxHash,
        value: halfEther,
        remaining: oneEther
      })
      const eventsAfterSecondTx = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(eventsAfterSecondTx.length).to.be.equal(2)
      expect(await contract.outOfLimitAmount()).to.be.bignumber.equal(oneEther)
    })
    it('Should revert if try to unlock more than available', async function() {
      const { logs } = await contract.fixAssetsAboveLimits(exampleTxHash, true, halfEther).should.be.fulfilled

      logs.length.should.be.equal(1)
      expectEventInLogs(logs, 'AssetAboveLimitsFixed', {
        transactionHash: exampleTxHash,
        value: halfEther,
        remaining: ether('1.5')
      })

      const { logs: logsSecondTx } = await contract.fixAssetsAboveLimits(exampleTxHash, true, halfEther).should.be
        .fulfilled

      logsSecondTx.length.should.be.equal(1)
      expectEventInLogs(logsSecondTx, 'AssetAboveLimitsFixed', {
        transactionHash: exampleTxHash,
        value: halfEther,
        remaining: oneEther
      })

      const { logs: logsThirdTx } = await contract.fixAssetsAboveLimits(exampleTxHash, true, halfEther).should.be
        .fulfilled

      logsThirdTx.length.should.be.equal(1)
      expectEventInLogs(logsThirdTx, 'AssetAboveLimitsFixed', {
        transactionHash: exampleTxHash,
        value: halfEther,
        remaining: halfEther
      })

      await contract.fixAssetsAboveLimits(exampleTxHash, true, oneEther).should.be.rejectedWith(ERROR_MSG)
    })
    it('Should not be allow to be called by an already fixed txHash', async function() {
      const { logs } = await contract.fixAssetsAboveLimits(exampleTxHash, true, oneEther).should.be.fulfilled

      logs.length.should.be.equal(1)
      expectEventInLogs(logs, 'AssetAboveLimitsFixed', {
        transactionHash: exampleTxHash,
        value: oneEther,
        remaining: oneEther
      })

      const { logs: logsSecondTx } = await contract.fixAssetsAboveLimits(exampleTxHash, true, oneEther).should.be
        .fulfilled

      logsSecondTx.length.should.be.equal(1)
      expectEventInLogs(logsSecondTx, 'AssetAboveLimitsFixed', {
        transactionHash: exampleTxHash,
        value: oneEther,
        remaining: ZERO
      })

      await contract.fixAssetsAboveLimits(exampleTxHash, true, oneEther).should.be.rejectedWith(ERROR_MSG)
    })
    it('Should fail if txHash didnt increase out of limit amount', async function() {
      const invalidTxHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'

      await contract.fixAssetsAboveLimits(invalidTxHash, true, halfEther).should.be.rejectedWith(ERROR_MSG)
    })
    it('Should fail if not called by proxyOwner', async function() {
      await contract
        .fixAssetsAboveLimits(exampleTxHash, true, oneEther, {
          from: user
        })
        .should.be.rejectedWith(ERROR_MSG)
      await contract.fixAssetsAboveLimits(exampleTxHash, true, oneEther).should.be.fulfilled
    })
  })
  describe('relayTokens', () => {
    let erc20Token
    const user2 = accounts[2]
    beforeEach(async function() {
      bridgeContract = await AMBMock.new()
      await bridgeContract.setMaxGasPerTx(maxGasPerTx)
      mediatorContract = await otherSideMediatorContract.new()
      erc20Token = await ERC20Mock.new('test', 'TST', 18)
      await erc20Token.mint(user, twoEthers, { from: owner }).should.be.fulfilled

      contract = this.bridge
    })
    if (!isRelativeDailyLimit || (isRelativeDailyLimit && !isRelativeDailyLimitOnBridgeSide)) {
      it('should allow to bridge tokens using approve and transferFrom', async () => {
        // Given
        await initialize(erc20Token.address)

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
    }
    it('should allow user to specify a itself as receiver', async () => {
      // Given
      await initialize(erc20Token.address)

      const currentDay = await contract.getCurrentDay()
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      const value = oneEther
      await erc20Token.approve(contract.address, value, { from: user }).should.be.fulfilled
      expect(await erc20Token.allowance(user, contract.address)).to.be.bignumber.equal(value)

      // When
      await contract.methods['relayTokens(address,address,uint256)'](user, user, value, { from: user }).should.be
        .fulfilled

      // Then
      const events = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      expect(events[0].returnValues.encodedData.includes(strip0x(user).toLowerCase())).to.be.equal(true)
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(value)
    })
    it('should allow to specify a different receiver', async () => {
      // Given
      await initialize(erc20Token.address)

      const currentDay = await contract.getCurrentDay()
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      const value = oneEther
      await erc20Token.approve(contract.address, value, { from: user }).should.be.fulfilled
      expect(await erc20Token.allowance(user, contract.address)).to.be.bignumber.equal(value)

      // When
      await contract.methods['relayTokens(address,address,uint256)'](user, user2, value, { from: user }).should.be
        .fulfilled

      // Then
      const events = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      expect(events[0].returnValues.encodedData.includes(strip0x(user2).toLowerCase())).to.be.equal(true)
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(value)
    })
    it('should allow to specify a different receiver without specifying sender', async () => {
      // Given
      await initialize(erc20Token.address)

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
    it('should allow to complete a transfer approved by other user', async () => {
      // Given
      await initialize(erc20Token.address)

      const currentDay = await contract.getCurrentDay()
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      const value = oneEther
      await erc20Token.approve(contract.address, value, { from: user }).should.be.fulfilled
      expect(await erc20Token.allowance(user, contract.address)).to.be.bignumber.equal(value)

      // When
      await contract.methods['relayTokens(address,address,uint256)'](user, user2, value, {
        from: user2
      }).should.be.rejectedWith(ERROR_MSG)
      await contract.methods['relayTokens(address,address,uint256)'](user, user, value, { from: user2 }).should.be
        .fulfilled

      // Then
      const events = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      expect(events[0].returnValues.encodedData.includes(strip0x(user).toLowerCase())).to.be.equal(true)
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(value)
    })
    it('should fail if user did not approve the transfer', async () => {
      await initialize(erc20Token.address)

      await contract.relayTokens(user, oneEther, { from: user }).should.be.rejectedWith(ERROR_MSG)
    })
    it('should fail if value is not within limits', async () => {
      await initialize(erc20Token.address)

      const value = twoEthers
      await erc20Token.approve(contract.address, value, { from: user }).should.be.fulfilled
      expect(await erc20Token.allowance(user, contract.address)).to.be.bignumber.equal(value)

      await contract.relayTokens(user, value, { from: user }).should.be.rejectedWith(ERROR_MSG)
    })
    if (!isRelativeDailyLimit || (isRelativeDailyLimit && !isRelativeDailyLimitOnBridgeSide)) {
      it('should prevent emitting the event twice when ERC677 used by relayTokens and ERC677 is owned by token manager', async function() {
        // Given
        erc677Token = await ERC677BridgeToken.new('test', 'TST', 18)
        await erc677Token.mint(user, twoEthers, { from: owner }).should.be.fulfilled
        await erc677Token.setBridgeContract(contract.address, { from: owner }).should.be.fulfilled
        await erc677Token.transferOwnership(contract.address, { from: owner }).should.be.fulfilled

        contract = this.bridge

        await initialize(erc677Token.address)

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

        await initialize(erc677Token.address)

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
    }
  })
  describe('requestFailedMessageFix', () => {
    const nonce = '0x96b6af865cdaa107ede916e237afbedffa5ed36bea84c0e77a33cc28fc2e9c01'
    beforeEach(async function() {
      bridgeContract = await AMBMock.new()
      await bridgeContract.setMaxGasPerTx(maxGasPerTx)
      mediatorContract = await otherSideMediatorContract.new()
      erc677Token = await ERC677BridgeToken.new('test', 'TST', 18)

      contract = this.proxyContract

      await initialize(erc677Token.address)
    })
    it('should allow to request a failed message fix', async () => {
      // Given
      const data = await contract.contract.methods.handleBridgedTokens(user, oneEther.toString(), nonce).encodeABI()

      await bridgeContract.executeMessageCall(contract.address, mediatorContract.address, data, exampleTxHash, 100)
        .should.be.fulfilled

      expect(await bridgeContract.messageCallStatus(exampleTxHash)).to.be.equal(false)

      const dataHash = await bridgeContract.failedMessageDataHash(exampleTxHash)

      // When
      await contract.requestFailedMessageFix(exampleTxHash).should.be.fulfilled

      // Then
      const events = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      expect(events[0].returnValues.encodedData.includes(strip0x(dataHash))).to.be.equal(true)
    })
    it('should be a failed transaction', async () => {
      // Given
      const data = await contract.contract.methods.handleBridgedTokens(user, twoEthers.toString(), nonce).encodeABI()

      await bridgeContract.executeMessageCall(contract.address, mediatorContract.address, data, exampleTxHash, 1000000)
        .should.be.fulfilled

      expect(await bridgeContract.messageCallStatus(exampleTxHash)).to.be.equal(true)

      // When
      await contract.requestFailedMessageFix(exampleTxHash).should.be.rejectedWith(ERROR_MSG)
    })
    it('should be the receiver of the failed transaction', async () => {
      // Given
      const data = await contract.contract.methods.handleBridgedTokens(user, oneEther.toString(), nonce).encodeABI()

      await bridgeContract.executeMessageCall(
        bridgeContract.address,
        mediatorContract.address,
        data,
        exampleTxHash,
        100000
      ).should.be.fulfilled

      expect(await bridgeContract.messageCallStatus(exampleTxHash)).to.be.equal(false)

      // When
      await contract.requestFailedMessageFix(exampleTxHash).should.be.rejectedWith(ERROR_MSG)
    })
    it('message sender should be mediator from other side', async () => {
      // Given
      const data = await contract.contract.methods.handleBridgedTokens(user, oneEther.toString(), nonce).encodeABI()

      await bridgeContract.executeMessageCall(contract.address, contract.address, data, exampleTxHash, 100).should.be
        .fulfilled

      expect(await bridgeContract.messageCallStatus(exampleTxHash)).to.be.equal(false)

      // When
      await contract.requestFailedMessageFix(exampleTxHash).should.be.rejectedWith(ERROR_MSG)
    })
    it('should allow to request a fix multiple times', async () => {
      // Given
      const data = await contract.contract.methods.handleBridgedTokens(user, oneEther.toString(), nonce).encodeABI()

      await bridgeContract.executeMessageCall(contract.address, mediatorContract.address, data, exampleTxHash, 100)
        .should.be.fulfilled

      expect(await bridgeContract.messageCallStatus(exampleTxHash)).to.be.equal(false)

      const dataHash = await bridgeContract.failedMessageDataHash(exampleTxHash)

      await contract.requestFailedMessageFix(exampleTxHash).should.be.fulfilled

      const events = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      expect(events[0].returnValues.encodedData.includes(strip0x(dataHash))).to.be.equal(true)

      // When
      await contract.requestFailedMessageFix(exampleTxHash).should.be.fulfilled

      // Then
      const allEvents = await getEvents(bridgeContract, { event: 'MockedEvent' })
      expect(allEvents.length).to.be.equal(2)
      expect(allEvents[0].returnValues.encodedData.includes(strip0x(dataHash))).to.be.equal(true)
      expect(allEvents[1].returnValues.encodedData.includes(strip0x(dataHash))).to.be.equal(true)
    })
  })
  if (!isRelativeDailyLimit || (isRelativeDailyLimit && !isRelativeDailyLimitOnBridgeSide)) {
    describe('fixFailedMessage', () => {
      let dataHash
      beforeEach(async function() {
        contract = this.bridge

        bridgeContract = await AMBMock.new()
        await bridgeContract.setMaxGasPerTx(maxGasPerTx)
        mediatorContract = await otherSideMediatorContract.new()
        erc677Token = await ERC677BridgeToken.new('test', 'TST', 18)
        await erc677Token.mint(user, twoEthers, { from: owner }).should.be.fulfilled

        await initialize(erc677Token.address)
        await erc677Token.transferOwnership(contract.address)

        expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(twoEthers)
        expect(await erc677Token.totalSupply()).to.be.bignumber.equal(twoEthers)

        // User transfer tokens
        const transferTx = await erc677Token.transferAndCall(contract.address, oneEther, '0x', { from: user }).should.be
          .fulfilled

        expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(oneEther)

        const events = await getEvents(bridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        const data = `0x${events[0].returnValues.encodedData.substr(
          148,
          events[0].returnValues.encodedData.length - 148
        )}`

        // Bridge calls mediator from other side
        await bridgeContract.executeMessageCall(
          contract.address,
          contract.address,
          data,
          transferTx.tx,
          100
        ).should.be.fulfilled

        expect(await bridgeContract.messageCallStatus(transferTx.tx)).to.be.equal(false)

        // mediator from other side should use this dataHash to request fix the failed message
        dataHash = await bridgeContract.failedMessageDataHash(transferTx.tx)
      })
      it('should fix burnt/locked tokens', async () => {
        // Given
        expect(await contract.messageHashFixed(dataHash)).to.be.equal(false)

        // When
        const fixData = await contract.contract.methods.fixFailedMessage(dataHash).encodeABI()

        await bridgeContract.executeMessageCall(
          contract.address,
          mediatorContract.address,
          fixData,
          exampleTxHash,
          1000000
        ).should.be.fulfilled

        // Then
        expect(await bridgeContract.messageCallStatus(exampleTxHash)).to.be.equal(true)
        expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(twoEthers)
        expect(await erc677Token.totalSupply()).to.be.bignumber.equal(twoEthers)
        expect(await contract.messageHashFixed(dataHash)).to.be.equal(true)

        const event = await getEvents(contract, { event: 'FailedMessageFixed' })
        expect(event.length).to.be.equal(1)
        expect(event[0].returnValues.dataHash).to.be.equal(dataHash)
        expect(event[0].returnValues.recipient).to.be.equal(user)
        expect(event[0].returnValues.value).to.be.equal(oneEther.toString())

        const otherTxHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'

        // can only fix it one time
        await bridgeContract.executeMessageCall(
          contract.address,
          mediatorContract.address,
          fixData,
          otherTxHash,
          1000000
        ).should.be.fulfilled

        expect(await bridgeContract.messageCallStatus(otherTxHash)).to.be.equal(false)
        expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(twoEthers)
      })
      it('should be called by bridge', async () => {
        await contract.fixFailedMessage(dataHash, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      })
      it('message sender should be mediator from other side', async () => {
        // Given
        expect(await contract.messageHashFixed(dataHash)).to.be.equal(false)

        // When
        const fixData = await contract.contract.methods.fixFailedMessage(dataHash).encodeABI()

        await bridgeContract.executeMessageCall(contract.address, contract.address, fixData, exampleTxHash, 1000000)
          .should.be.fulfilled

        // Then
        expect(await bridgeContract.messageCallStatus(exampleTxHash)).to.be.equal(false)
        expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(oneEther)
        expect(await contract.messageHashFixed(dataHash)).to.be.equal(false)

        const otherTxHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'

        await bridgeContract.executeMessageCall(contract.address, mediatorContract.address, fixData, otherTxHash, 1000000)
          .should.be.fulfilled

        expect(await bridgeContract.messageCallStatus(otherTxHash)).to.be.equal(true)
        expect(await erc677Token.balanceOf(user)).to.be.bignumber.equal(twoEthers)
        expect(await contract.messageHashFixed(dataHash)).to.be.equal(true)

        const event = await getEvents(contract, { event: 'FailedMessageFixed' })
        expect(event.length).to.be.equal(1)
        expect(event[0].returnValues.dataHash).to.be.equal(dataHash)
        expect(event[0].returnValues.recipient).to.be.equal(user)
        expect(event[0].returnValues.value).to.be.equal(oneEther.toString())
      })
    })
  }
  describe('#claimTokens', () => {
    it('should be able to claim tokens', async function() {
      contract = this.proxyContract

      await initialize(erc677Token.address)

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
  if (isRelativeDailyLimit) {
    // eslint-disable-next-line
    function initialize(customLimits) {
      return contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        isRelativeDailyLimitOnBridgeSide ? customLimits : limitsArray,
        isRelativeDailyLimitOnBridgeSide ? executionLimitsArray : customLimits,
        maxGasPerTx,
        decimalShiftZero,
        owner
      ).should.be.fulfilled
    }
    if (isRelativeDailyLimitOnBridgeSide) {
      describe('#dailyLimit (relative)', () => {
        beforeEach(async function() {
          contract = this.bridge
          bridgeContract = await AMBMock.new()
          await bridgeContract.setMaxGasPerTx(maxGasPerTx)
          mediatorContract = await otherSideMediatorContract.new()
          erc677Token = await ERC677BridgeToken.new('test', 'TST', 18)
        })
        it('should be calculated correctly - 1', async function() {
          await initialize([targetLimit, threshold, maxPerTx, minPerTx])

          await erc677Token.mint(accounts[0], halfEther).should.be.fulfilled
          await erc677Token.mint(contract.address, halfEther).should.be.fulfilled
          expect(await erc677Token.balanceOf(contract.address)).to.be.bignumber.equal(halfEther)
          expect(await erc677Token.totalSupply()).to.be.bignumber.equal(oneEther)

          const limit = await contract.dailyLimit()
          const expectedLimit = calculateDailyLimit(oneEther, targetLimit, threshold, minPerTx)
          expect(limit).to.be.bignumber.equal(expectedLimit)
        })
        it('should be calculated correctly - 2', async function() {
          await initialize([targetLimit, threshold, maxPerTx, minPerTx])

          await erc677Token.mint(contract.address, halfEther).should.be.fulfilled
          expect(await erc677Token.totalSupply()).to.be.bignumber.equal(halfEther)

          const limit = await contract.dailyLimit()
          const expectedLimit = calculateDailyLimit(halfEther, targetLimit, threshold, minPerTx)
          expect(limit).to.be.bignumber.equal(expectedLimit)
        })
        it('should be calculated correctly - 3', async function() {
          await initialize([targetLimit, threshold, maxPerTx, minPerTx])

          await erc677Token.mint(contract.address, minPerTx).should.be.fulfilled
          expect(await erc677Token.totalSupply()).to.be.bignumber.equal(minPerTx)

          const limit = await contract.dailyLimit()
          expect(limit).to.be.bignumber.equal(minPerTx)
        })
        it('should be calculated correctly - 4', async function() {
          await initialize([targetLimit, threshold, maxPerTx, minPerTx])

          await erc677Token.mint(contract.address, threshold).should.be.fulfilled
          expect(await erc677Token.totalSupply()).to.be.bignumber.equal(threshold)

          const limit = await contract.dailyLimit()
          expect(limit).to.be.bignumber.equal(threshold.mul(targetLimit).div(oneEther))
        })
        it('should be calculated correctly - 5', async function() {
          const amountToMint = ether('5')
          const targetLimit = ether('0.06')
          const threshold = ether('100')
          const minPerTx = ether('0.1')

          await initialize([targetLimit, threshold, maxPerTx, minPerTx])

          await erc677Token.mint(accounts[0], amountToMint).should.be.fulfilled
          expect(await erc677Token.totalSupply()).to.be.bignumber.equal(amountToMint)

          const limit = await contract.dailyLimit()
          const expectedLimit = calculateDailyLimit(amountToMint, targetLimit, threshold, minPerTx)
          expect(limit).to.be.bignumber.equal(expectedLimit)
        })
      })
    } else {
      describe('#executionDailyLimit (relative)', () => {
        beforeEach(async function() {
          contract = this.bridge
          bridgeContract = await AMBMock.new()
          await bridgeContract.setMaxGasPerTx(maxGasPerTx)
          mediatorContract = await otherSideMediatorContract.new()
          erc677Token = await ERC677BridgeToken.new('test', 'TST', 18)
        })
        it('should be calculated correctly - 1', async function() {
          await initialize([targetLimit, threshold, maxPerTx, minPerTx])

          await erc677Token.mint(accounts[0], halfEther).should.be.fulfilled
          await erc677Token.mint(contract.address, halfEther).should.be.fulfilled
          expect(await erc677Token.balanceOf(contract.address)).to.be.bignumber.equal(halfEther)
          expect(await erc677Token.totalSupply()).to.be.bignumber.equal(oneEther)

          const limit = await contract.executionDailyLimit()
          const expectedLimit = calculateDailyLimit(halfEther, targetLimit, threshold, minPerTx)
          expect(limit).to.be.bignumber.equal(expectedLimit)
        })
        it('should be calculated correctly - 2', async function() {
          await initialize([targetLimit, threshold, maxPerTx, minPerTx])

          await erc677Token.mint(accounts[0], halfEther).should.be.fulfilled
          expect(await erc677Token.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
          expect(await erc677Token.totalSupply()).to.be.bignumber.equal(halfEther)

          const limit = await contract.executionDailyLimit()
          expect(limit).to.be.bignumber.equal(ZERO)
        })
        it('should be calculated correctly - 3', async function() {
          await initialize([targetLimit, threshold, maxPerTx, minPerTx])

          await erc677Token.mint(contract.address, minPerTx).should.be.fulfilled
          expect(await erc677Token.balanceOf(contract.address)).to.be.bignumber.equal(minPerTx)

          const limit = await contract.executionDailyLimit()
          expect(limit).to.be.bignumber.equal(minPerTx)
        })
        it('should be calculated correctly - 4', async function() {
          await initialize([targetLimit, threshold, maxPerTx, minPerTx])

          await erc677Token.mint(contract.address, threshold).should.be.fulfilled
          expect(await erc677Token.balanceOf(contract.address)).to.be.bignumber.equal(threshold)

          const limit = await contract.executionDailyLimit()
          expect(limit).to.be.bignumber.equal(threshold.mul(targetLimit).div(oneEther))
        })
        it('should be calculated correctly - 5', async function() {
          const amountToMint = ether('5')
          const targetLimit = ether('0.06')
          const threshold = ether('100')
          const minPerTx = ether('0.1')

          await initialize([targetLimit, threshold, maxPerTx, minPerTx])

          await erc677Token.mint(contract.address, amountToMint).should.be.fulfilled
          expect(await erc677Token.balanceOf(contract.address)).to.be.bignumber.equal(amountToMint)

          const limit = await contract.executionDailyLimit()
          const expectedLimit = calculateDailyLimit(amountToMint, targetLimit, threshold, minPerTx)
          expect(limit).to.be.bignumber.equal(expectedLimit)
        })
      })
    }
  }
}

module.exports = {
  shouldBehaveLikeBasicAMBErc677ToErc677
}
