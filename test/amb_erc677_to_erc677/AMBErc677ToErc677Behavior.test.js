const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const AMBMock = artifacts.require('AMBMock.sol')

const { expect } = require('chai')
const { ZERO_ADDRESS, toBN, ERROR_MSG } = require('../setup')
const { expectEventInLogs, ether } = require('../helpers/helpers')

const ZERO = toBN(0)
const maxGasPerTx = ether('1')
const dailyLimit = ether('2')
const maxPerTx = ether('1')
const minPerTx = ether('0.01')
const executionDailyLimit = dailyLimit
const executionMaxPerTx = maxPerTx

function shouldBehaveLikeBasicAMBErc677ToErc677(otherSideMediatorContract, accounts) {
  const owner = accounts[0]
  describe('initialize', () => {
    let bridgeContract
    let mediatorContract
    let erc677Token
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
}

module.exports = {
  shouldBehaveLikeBasicAMBErc677ToErc677
}
