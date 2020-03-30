const ForeignStakeTokenMediator = artifacts.require('ForeignStakeTokenMediator.sol')
const HomeStakeTokenMediator = artifacts.require('HomeStakeTokenMediator.sol')
const ERC677BridgeTokenRewardable = artifacts.require('ERC677BridgeTokenRewardable.sol')
const BridgeValidators = artifacts.require('BridgeValidators.sol')
const AMBMock = artifacts.require('AMBMock.sol')
const BlockReward = artifacts.require('BlockReward.sol')

const { expect } = require('chai')
const { ether, expectEventInLogs, getEvents } = require('../helpers/helpers')
const { toBN, ZERO_ADDRESS } = require('../setup')

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
const decimalShiftZero = 0

contract('HomeStakeTokenMediator', async accounts => {
  const owner = accounts[0]
  const user = accounts[1]
  const authorities = [accounts[2], accounts[3]]
  let homeBridge
  let homeMediator
  let foreignMediator
  let validatorContract
  let token
  let blockReward
  beforeEach(async function() {
    homeBridge = await AMBMock.new()
    await homeBridge.setMaxGasPerTx(maxGasPerTx)
    validatorContract = await BridgeValidators.new()
    await validatorContract.initialize(1, authorities, owner)
    token = await ERC677BridgeTokenRewardable.new('Test token', 'TST', 18)
    blockReward = await BlockReward.new()
    await blockReward.setValidatorsRewards(authorities)
    await blockReward.setToken(token.address)
    await token.setBlockRewardContract(blockReward.address)
    homeMediator = await HomeStakeTokenMediator.new()
    foreignMediator = await ForeignStakeTokenMediator.new()
    await homeMediator.initialize(
      homeBridge.address,
      foreignMediator.address,
      token.address,
      [dailyLimit, maxPerTx, minPerTx],
      [executionDailyLimit, executionMaxPerTx],
      maxGasPerTx,
      decimalShiftZero,
      owner
    ).should.be.fulfilled
  })

  describe('setBlockRewardContract', async () => {
    it('should set block reward contract', async () => {
      expect(await homeMediator.blockRewardContract()).to.be.equal(ZERO_ADDRESS)

      await homeMediator.setBlockRewardContract(blockReward.address, { from: owner }).should.be.fulfilled

      expect(await homeMediator.blockRewardContract()).to.be.equal(blockReward.address)
    })

    it('should fail if not a block reward contract', async () => {
      await homeMediator.setBlockRewardContract(foreignMediator.address, { from: owner }).should.be.rejected
    })

    it('should fail if not an owner', async () => {
      await homeMediator.setBlockRewardContract(blockReward.address, { from: user }).should.be.rejected
    })
  })

  describe('setFee', async () => {
    it('should set fee', async () => {
      const { logs } = await homeMediator.setFee(ether('0.05'), { from: owner }).should.be.fulfilled

      expectEventInLogs(logs, 'FeeUpdated', { fee: ether('0.05') })
    })

    it('should fail if fee is too high', async () => {
      await homeMediator.setFee(ether('1.05'), { from: owner }).should.be.rejected
      await homeMediator.setFee(ether('1'), { from: owner }).should.be.rejected
      await homeMediator.setFee(ether('0.99'), { from: owner }).should.be.fulfilled
    })

    it('should fail if not an owner', async () => {
      await homeMediator.setFee(ether('0.05'), { from: user }).should.be.rejected
    })
  })

  describe('getFee', async () => {
    it('should get actual fee', async () => {
      await homeMediator.setFee(ether('0.05'), { from: owner }).should.be.fulfilled

      expect(await homeMediator.getFee()).to.be.bignumber.equal(ether('0.05'))
    })
  })

  describe('calculateFee', async () => {
    it('should calculate fee for given value', async () => {
      expect(await homeMediator.calculateFee(ether('0'))).to.be.bignumber.equal(ZERO)
      expect(await homeMediator.calculateFee(ether('1'))).to.be.bignumber.equal(ZERO)
      expect(await homeMediator.calculateFee(ether('2'))).to.be.bignumber.equal(ZERO)
      expect(await homeMediator.calculateFee('21')).to.be.bignumber.equal(ZERO)
      expect(await homeMediator.calculateFee('20')).to.be.bignumber.equal(ZERO)
      expect(await homeMediator.calculateFee('19')).to.be.bignumber.equal(ZERO)

      await homeMediator.setFee(ether('0.05'), { from: owner }).should.be.fulfilled

      expect(await homeMediator.calculateFee(ether('0'))).to.be.bignumber.equal(ether('0'))
      expect(await homeMediator.calculateFee(ether('1'))).to.be.bignumber.equal(ether('0.05'))
      expect(await homeMediator.calculateFee(ether('2'))).to.be.bignumber.equal(ether('0.1'))
      expect(await homeMediator.calculateFee('21')).to.be.bignumber.equal('1')
      expect(await homeMediator.calculateFee('20')).to.be.bignumber.equal('1')
      expect(await homeMediator.calculateFee('19')).to.be.bignumber.equal('0')
    })
  })

  describe('bridge tokens from xDai chain', async () => {
    beforeEach(async () => {
      await token.mint(user, oneEther)
      await token.transferOwnership(homeMediator.address)

      expect(await token.totalSupply()).to.be.bignumber.equal(oneEther)
    })
    it('should accept tokens, no block reward, no fee', async () => {
      await token.transferAndCall(homeMediator.address, halfEther, '0x', { from: user }).should.be.fulfilled

      const events = await getEvents(homeBridge, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      const bridgedValue = toBN(events[0].returnValues.encodedData.slice(148 + 72, 148 + 136))

      expect(bridgedValue).to.be.bignumber.equal(halfEther)
      expect(await token.totalSupply()).to.be.bignumber.equal(halfEther)
      expect(await token.balanceOf(homeMediator.address)).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)
    })

    it('should accept tokens, no block reward, configured fee', async () => {
      await homeMediator.setFee(ether('0.05')).should.be.fulfilled

      await token.transferAndCall(homeMediator.address, halfEther, '0x', { from: user }).should.be.fulfilled

      const events = await getEvents(homeBridge, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      const bridgedValue = toBN(events[0].returnValues.encodedData.slice(148 + 72, 148 + 136))

      expect(bridgedValue).to.be.bignumber.equal(halfEther)
      expect(await token.totalSupply()).to.be.bignumber.equal(halfEther)
      expect(await token.balanceOf(homeMediator.address)).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)
    })

    it('should accept tokens, configured block reward, no fee', async () => {
      await homeMediator.setBlockRewardContract(blockReward.address).should.be.fulfilled

      await token.transferAndCall(homeMediator.address, halfEther, '0x', { from: user }).should.be.fulfilled

      const events = await getEvents(homeBridge, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      const bridgedValue = toBN(events[0].returnValues.encodedData.slice(148 + 72, 148 + 136))

      expect(bridgedValue).to.be.bignumber.equal(halfEther)
      expect(await token.totalSupply()).to.be.bignumber.equal(halfEther)
      expect(await token.balanceOf(homeMediator.address)).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)
      expect(await token.balanceOf(blockReward.address)).to.be.bignumber.equal(ZERO)
    })

    it('should accept tokens, configured block reward, configured fee', async () => {
      await homeMediator.setFee(ether('0.1')).should.be.fulfilled
      await homeMediator.setBlockRewardContract(blockReward.address).should.be.fulfilled

      await token.transferAndCall(homeMediator.address, halfEther, '0x', { from: user }).should.be.fulfilled

      const events = await getEvents(homeBridge, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      const bridgedValue = toBN(events[0].returnValues.encodedData.slice(148 + 72, 148 + 136))

      expect(bridgedValue).to.be.bignumber.equal(ether('0.45'))
      expect(await token.totalSupply()).to.be.bignumber.equal(ether('0.55'))
      expect(await token.balanceOf(homeMediator.address)).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)
      expect(await token.balanceOf(blockReward.address)).to.be.bignumber.equal(ether('0.05'))
    })
  })
})
