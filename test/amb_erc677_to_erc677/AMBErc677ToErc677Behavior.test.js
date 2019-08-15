const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const HomeAMB = artifacts.require('HomeAMB.sol')
const BridgeValidators = artifacts.require('BridgeValidators.sol')

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
      const validatorContract = await BridgeValidators.new()
      const authorities = [accounts[1], accounts[2]]
      await validatorContract.initialize(1, authorities, owner)
      bridgeContract = await HomeAMB.new()
      await bridgeContract.initialize(validatorContract.address, maxGasPerTx, '1', '1', owner)
      mediatorContract = await otherSideMediatorContract.new()
      erc677Token = await ERC677BridgeToken.new('test', 'TST', 18)
    })
    it('should initialize', async function() {
      const contract = this.bridge
      expect(await this.bridge.isInitialized()).to.be.equal(false)
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
  })
}

module.exports = {
  shouldBehaveLikeBasicAMBErc677ToErc677
}
