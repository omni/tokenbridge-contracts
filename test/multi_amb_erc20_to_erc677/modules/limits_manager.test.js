const BridgeLimitsManager = artifacts.require('BridgeLimitsManager.sol')
const MultiTokenMediatorMock = artifacts.require('MultiTokenMediatorMock.sol')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')

const { expect } = require('chai')

const { ZERO_ADDRESS, toBN } = require('../../setup')
const { ether, getEvents } = require('../../helpers/helpers')

const minPerTx = ether('0.01')
const maxPerTx = ether('1')
const dailyLimit = ether('10')
const executionMaxPerTx = maxPerTx
const executionDailyLimit = dailyLimit

contract('BridgeLimitsManager', accounts => {
  const owner = accounts[0]
  const user = accounts[1]

  let mediator
  beforeEach(async () => {
    mediator = await MultiTokenMediatorMock.new()
  })

  describe('constructor', () => {
    it('should fail to create with incorrect params', async () => {
      await BridgeLimitsManager.new(
        accounts[1], // not contract
        owner,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx]
      ).should.be.rejected

      await BridgeLimitsManager.new(
        mediator.address,
        owner,
        [dailyLimit, maxPerTx, ether('0')], // zero minPerTx
        [executionDailyLimit, executionMaxPerTx]
      ).should.be.rejected

      await BridgeLimitsManager.new(
        mediator.address,
        owner,
        [dailyLimit, ether('0.001'), minPerTx], // minPerTx > maxPerTx
        [executionDailyLimit, executionMaxPerTx]
      ).should.be.rejected

      await BridgeLimitsManager.new(
        mediator.address,
        owner,
        [ether('0.1'), maxPerTx, minPerTx], // maxPerTx > dailyLimit
        [executionDailyLimit, executionMaxPerTx]
      ).should.be.rejected

      await BridgeLimitsManager.new(
        mediator.address,
        owner,
        [dailyLimit, maxPerTx, minPerTx],
        [ether('0.1'), executionMaxPerTx] // executionMaxPerTx > execcutionDailyLimit
      ).should.be.rejected
    })

    it('should initialize default limits', async () => {
      const manager = await BridgeLimitsManager.new(
        mediator.address,
        owner,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx]
      ).should.be.fulfilled

      expect(await manager.mediator()).to.be.equal(mediator.address)
      expect(await manager.owner()).to.be.equal(owner)
      expect(await manager.minPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(minPerTx)
      expect(await manager.maxPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(maxPerTx)
      expect(await manager.dailyLimit(ZERO_ADDRESS)).to.be.bignumber.equal(dailyLimit)
      expect(await manager.executionMaxPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(executionMaxPerTx)
      expect(await manager.executionDailyLimit(ZERO_ADDRESS)).to.be.bignumber.equal(executionDailyLimit)

      const events1 = await getEvents(manager, { event: 'DailyLimitChanged' })
      expect(events1.length).to.be.equal(1)
      const events2 = await getEvents(manager, { event: 'ExecutionDailyLimitChanged' })
      expect(events2.length).to.be.equal(1)
    })
  })

  describe('using connected manager', () => {
    let manager
    let token
    beforeEach(async () => {
      manager = await BridgeLimitsManager.new(
        mediator.address,
        owner,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx]
      ).should.be.fulfilled
      await mediator.setBridgeLimitsManager(manager.address).should.be.fulfilled
    })

    describe('recordWithdraw', () => {
      for (const decimals of [17, 18, 19]) {
        it(`should recordWithdraws for token with decimals ${decimals}`, async () => {
          const f1 = toBN(`1${'0'.repeat(decimals)}`)
          const f2 = toBN('1000000000000000000')

          token = await ERC677BridgeToken.new('TEST', 'TST', decimals)
          await manager.recordWithdraw(token.address, ether('0.1'), { from: user }).should.be.rejected
          await manager.recordWithdraw(token.address, ether('0.1'), { from: owner }).should.be.rejected
          await mediator.recordWithdraw(token.address, ether('0.1')).should.be.fulfilled

          const events1 = await getEvents(manager, { event: 'DailyLimitChanged' })
          expect(events1.length).to.be.equal(2)
          const events2 = await getEvents(manager, { event: 'ExecutionDailyLimitChanged' })
          expect(events2.length).to.be.equal(2)

          expect(await manager.minPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(minPerTx)
          expect(await manager.maxPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(maxPerTx)
          expect(await manager.dailyLimit(ZERO_ADDRESS)).to.be.bignumber.equal(dailyLimit)
          expect(await manager.executionMaxPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(executionMaxPerTx)
          expect(await manager.executionDailyLimit(ZERO_ADDRESS)).to.be.bignumber.equal(executionDailyLimit)
          expect(await manager.minPerTx(token.address)).to.be.bignumber.equal(minPerTx.mul(f1).div(f2))
          expect(await manager.maxPerTx(token.address)).to.be.bignumber.equal(maxPerTx.mul(f1).div(f2))
          expect(await manager.dailyLimit(token.address)).to.be.bignumber.equal(dailyLimit.mul(f1).div(f2))
          expect(await manager.executionMaxPerTx(token.address)).to.be.bignumber.equal(
            executionMaxPerTx.mul(f1).div(f2)
          )
          expect(await manager.executionDailyLimit(token.address)).to.be.bignumber.equal(
            executionDailyLimit.mul(f1).div(f2)
          )
          const day = await manager.getCurrentDay()
          expect(await manager.totalSpentPerDay(token.address, day)).to.be.bignumber.equal(ether('0'))
          expect(await manager.totalExecutedPerDay(token.address, day)).to.be.bignumber.equal(ether('0.1'))
        })
      }
    })

    describe('recordDeposit', () => {
      for (const decimals of [17, 18, 19]) {
        it(`should recordDeposit for token with decimals ${decimals}`, async () => {
          const f1 = toBN(`1${'0'.repeat(decimals)}`)
          const f2 = toBN('1000000000000000000')

          token = await ERC677BridgeToken.new('TEST', 'TST', decimals)
          await manager.recordDeposit(token.address, ether('0.1'), { from: user }).should.be.rejected
          await manager.recordDeposit(token.address, ether('0.1'), { from: owner }).should.be.rejected
          await mediator.recordDeposit(token.address, ether('0.1')).should.be.fulfilled

          const events1 = await getEvents(manager, { event: 'DailyLimitChanged' })
          expect(events1.length).to.be.equal(2)
          const events2 = await getEvents(manager, { event: 'ExecutionDailyLimitChanged' })
          expect(events2.length).to.be.equal(2)

          expect(await manager.minPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(minPerTx)
          expect(await manager.maxPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(maxPerTx)
          expect(await manager.dailyLimit(ZERO_ADDRESS)).to.be.bignumber.equal(dailyLimit)
          expect(await manager.executionMaxPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(executionMaxPerTx)
          expect(await manager.executionDailyLimit(ZERO_ADDRESS)).to.be.bignumber.equal(executionDailyLimit)
          expect(await manager.minPerTx(token.address)).to.be.bignumber.equal(minPerTx.mul(f1).div(f2))
          expect(await manager.maxPerTx(token.address)).to.be.bignumber.equal(maxPerTx.mul(f1).div(f2))
          expect(await manager.dailyLimit(token.address)).to.be.bignumber.equal(dailyLimit.mul(f1).div(f2))
          expect(await manager.executionMaxPerTx(token.address)).to.be.bignumber.equal(
            executionMaxPerTx.mul(f1).div(f2)
          )
          expect(await manager.executionDailyLimit(token.address)).to.be.bignumber.equal(
            executionDailyLimit.mul(f1).div(f2)
          )
          const day = await manager.getCurrentDay()
          expect(await manager.totalSpentPerDay(token.address, day)).to.be.bignumber.equal(ether('0.1'))
          expect(await manager.totalExecutedPerDay(token.address, day)).to.be.bignumber.equal(ether('0'))
        })
      }
    })

    describe('update default limits', () => {
      it('setMinPerTx', async () => {
        await manager.setMinPerTx(ZERO_ADDRESS, ether('0.02'), { from: user }).should.be.rejected
        await manager.setMinPerTx(ZERO_ADDRESS, ether('0'), { from: owner }).should.be.rejected
        await manager.setMinPerTx(ZERO_ADDRESS, ether('2'), { from: owner }).should.be.rejected
        await manager.setMinPerTx(ZERO_ADDRESS, ether('0.02'), { from: owner }).should.be.fulfilled

        expect(await manager.minPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(ether('0.02'))
      })

      it('setMaxPerTx', async () => {
        await manager.setMaxPerTx(ZERO_ADDRESS, ether('2'), { from: user }).should.be.rejected
        await manager.setMaxPerTx(ZERO_ADDRESS, ether('0.001'), { from: owner }).should.be.rejected
        await manager.setMaxPerTx(ZERO_ADDRESS, ether('20'), { from: owner }).should.be.rejected
        await manager.setMaxPerTx(ZERO_ADDRESS, ether('2'), { from: owner }).should.be.fulfilled

        expect(await manager.maxPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(ether('2'))
      })

      it('setDailyLimit', async () => {
        await manager.setDailyLimit(ZERO_ADDRESS, ether('20'), { from: user }).should.be.rejected
        await manager.setDailyLimit(ZERO_ADDRESS, ether('0.001'), { from: owner }).should.be.rejected
        await manager.setDailyLimit(ZERO_ADDRESS, ether('0.1'), { from: owner }).should.be.rejected
        await manager.setDailyLimit(ZERO_ADDRESS, ether('20'), { from: owner }).should.be.fulfilled

        expect(await manager.dailyLimit(ZERO_ADDRESS)).to.be.bignumber.equal(ether('20'))
      })

      it('setExecutionMaxPerTx', async () => {
        await manager.setExecutionMaxPerTx(ZERO_ADDRESS, ether('2'), { from: user }).should.be.rejected
        await manager.setExecutionMaxPerTx(ZERO_ADDRESS, ether('20'), { from: owner }).should.be.rejected
        await manager.setExecutionMaxPerTx(ZERO_ADDRESS, ether('2'), { from: owner }).should.be.fulfilled

        expect(await manager.executionMaxPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(ether('2'))
      })

      it('setExecutionDailyLimit', async () => {
        await manager.setExecutionDailyLimit(ZERO_ADDRESS, ether('20'), { from: user }).should.be.rejected
        await manager.setExecutionDailyLimit(ZERO_ADDRESS, ether('0.1'), { from: owner }).should.be.rejected
        await manager.setExecutionDailyLimit(ZERO_ADDRESS, ether('20'), { from: owner }).should.be.fulfilled

        expect(await manager.executionDailyLimit(ZERO_ADDRESS)).to.be.bignumber.equal(ether('20'))
      })
    })
  })
})
