const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const AMBMock = artifacts.require('AMBMock.sol')

const { expect } = require('chai')
const { ZERO_ADDRESS, toBN, ERROR_MSG } = require('../setup')
const { getEvents, expectEventInLogs, ether } = require('../helpers/helpers')

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
const exampleTxHash = '0xf308b922ab9f8a7128d9d7bc9bce22cd88b2c05c8213f0e2d8104d78e0a9ecbb'

function shouldBehaveLikeBasicAMBErc677ToErc677(otherSideMediatorContract, accounts) {
  let bridgeContract
  let mediatorContract
  let erc677Token
  const owner = accounts[0]
  const user = accounts[1]
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
      expect(await contract.mediatorContract()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.erc677token()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.dailyLimit()).to.be.bignumber.equal(ZERO)
      expect(await contract.maxPerTx()).to.be.bignumber.equal(ZERO)
      expect(await contract.minPerTx()).to.be.bignumber.equal(ZERO)
      expect(await contract.executionDailyLimit()).to.be.bignumber.equal(ZERO)
      expect(await contract.executionMaxPerTx()).to.be.bignumber.equal(ZERO)
      expect(await contract.requestGasLimit()).to.be.bignumber.equal(ZERO)
      expect(await contract.owner()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.deployedAtBlock()).to.be.bignumber.equal(ZERO)

      // not valid bridge contract
      await contract
        .initialize(
          ZERO_ADDRESS,
          mediatorContract.address,
          erc677Token.address,
          dailyLimit,
          maxPerTx,
          minPerTx,
          executionDailyLimit,
          executionMaxPerTx,
          maxGasPerTx,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)

      // not valid mediator contract
      await contract
        .initialize(
          bridgeContract.address,
          ZERO_ADDRESS,
          erc677Token.address,
          dailyLimit,
          maxPerTx,
          minPerTx,
          executionDailyLimit,
          executionMaxPerTx,
          maxGasPerTx,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)

      // not valid erc677 contract
      await contract
        .initialize(
          bridgeContract.address,
          mediatorContract.address,
          ZERO_ADDRESS,
          dailyLimit,
          maxPerTx,
          minPerTx,
          executionDailyLimit,
          executionMaxPerTx,
          maxGasPerTx,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)

      // dailyLimit > maxPerTx
      await contract
        .initialize(
          bridgeContract.address,
          mediatorContract.address,
          erc677Token.address,
          maxPerTx,
          maxPerTx,
          minPerTx,
          executionDailyLimit,
          executionMaxPerTx,
          maxGasPerTx,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)

      // maxPerTx > minPerTx
      await contract
        .initialize(
          bridgeContract.address,
          mediatorContract.address,
          erc677Token.address,
          dailyLimit,
          minPerTx,
          minPerTx,
          executionDailyLimit,
          executionMaxPerTx,
          maxGasPerTx,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)

      // executionDailyLimit > executionMaxPerTx
      await contract
        .initialize(
          bridgeContract.address,
          mediatorContract.address,
          erc677Token.address,
          dailyLimit,
          maxPerTx,
          minPerTx,
          executionMaxPerTx,
          executionMaxPerTx,
          maxGasPerTx,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)

      // maxGasPerTx > bridge maxGasPerTx
      await contract
        .initialize(
          bridgeContract.address,
          mediatorContract.address,
          erc677Token.address,
          dailyLimit,
          maxPerTx,
          minPerTx,
          executionDailyLimit,
          executionMaxPerTx,
          dailyLimit,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)

      const { logs } = await contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        dailyLimit,
        maxPerTx,
        minPerTx,
        executionDailyLimit,
        executionMaxPerTx,
        maxGasPerTx,
        owner
      ).should.be.fulfilled

      // already initialized
      await contract
        .initialize(
          bridgeContract.address,
          mediatorContract.address,
          erc677Token.address,
          dailyLimit,
          maxPerTx,
          minPerTx,
          executionDailyLimit,
          executionMaxPerTx,
          maxGasPerTx,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)

      expect(await contract.isInitialized()).to.be.equal(true)
      expect(await contract.bridgeContract()).to.be.equal(bridgeContract.address)
      expect(await contract.mediatorContract()).to.be.equal(mediatorContract.address)
      expect(await contract.erc677token()).to.be.equal(erc677Token.address)
      expect(await contract.dailyLimit()).to.be.bignumber.equal(dailyLimit)
      expect(await contract.maxPerTx()).to.be.bignumber.equal(maxPerTx)
      expect(await contract.minPerTx()).to.be.bignumber.equal(minPerTx)
      expect(await contract.executionDailyLimit()).to.be.bignumber.equal(executionDailyLimit)
      expect(await contract.executionMaxPerTx()).to.be.bignumber.equal(executionMaxPerTx)
      expect(await contract.requestGasLimit()).to.be.bignumber.equal(maxGasPerTx)
      expect(await contract.owner()).to.be.equal(owner)
      expect(await contract.deployedAtBlock()).to.be.bignumber.above(ZERO)

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
        dailyLimit,
        maxPerTx,
        minPerTx,
        executionDailyLimit,
        executionMaxPerTx,
        maxGasPerTx,
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
      const notAContractAddress = accounts[2]

      await contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        dailyLimit,
        maxPerTx,
        minPerTx,
        executionDailyLimit,
        executionMaxPerTx,
        maxGasPerTx,
        owner
      ).should.be.fulfilled

      expect(await contract.bridgeContract()).to.be.equal(bridgeContract.address)

      const newMediatorContract = await otherSideMediatorContract.new()

      await contract.setMediatorContract(newMediatorContract.address, { from: user }).should.be.rejectedWith(ERROR_MSG)
      await contract.setMediatorContract(notAContractAddress, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      await contract.setMediatorContract(newMediatorContract.address, { from: owner }).should.be.fulfilled
      expect(await contract.mediatorContract()).to.be.equal(newMediatorContract.address)
    })
    it('only owner can set request Gas Limit', async function() {
      const contract = this.bridge
      const user = accounts[1]

      await contract.initialize(
        bridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        dailyLimit,
        maxPerTx,
        minPerTx,
        executionDailyLimit,
        executionMaxPerTx,
        maxGasPerTx,
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
        dailyLimit,
        maxPerTx,
        minPerTx,
        executionDailyLimit,
        executionMaxPerTx,
        maxGasPerTx,
        owner
      ).should.be.fulfilled

      const outOfLimitValueData = await contract.contract.methods
        .handleBridgedTokens(user, twoEthers.toString())
        .encodeABI()

      await bridgeContract.executeMessageCall(
        contract.address,
        mediatorContract.address,
        outOfLimitValueData,
        exampleTxHash
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
}

module.exports = {
  shouldBehaveLikeBasicAMBErc677ToErc677
}
