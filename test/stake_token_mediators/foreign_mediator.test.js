const ForeignStakeTokenMediator = artifacts.require('ForeignStakeTokenMediator.sol')
const HomeStakeTokenMediator = artifacts.require('HomeStakeTokenMediator.sol')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const AMBMock = artifacts.require('AMBMock.sol')

const { expect } = require('chai')
const { ether, getEvents } = require('../helpers/helpers')
const { toBN } = require('../setup')

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

contract('ForeignStakeTokenMediator', async accounts => {
  const owner = accounts[0]
  const user = accounts[1]
  let foreignBridge
  let homeMediator
  let foreignMediator
  let token
  beforeEach(async function() {
    foreignBridge = await AMBMock.new()
    await foreignBridge.setMaxGasPerTx(maxGasPerTx)
    token = await ERC677BridgeToken.new('Test token', 'TST', 18)
    homeMediator = await HomeStakeTokenMediator.new()
    foreignMediator = await ForeignStakeTokenMediator.new()
    await foreignMediator.initialize(
      foreignBridge.address,
      homeMediator.address,
      token.address,
      [dailyLimit, maxPerTx, minPerTx],
      [executionDailyLimit, executionMaxPerTx],
      maxGasPerTx,
      decimalShiftZero,
      owner
    ).should.be.fulfilled
  })

  describe('bridge tokens to mainnet', async () => {
    it('should use tokens from bridge balance', async () => {
      await token.mint(foreignMediator.address, twoEthers)
      await token.transferOwnership(foreignMediator.address)

      expect(await token.totalSupply()).to.be.bignumber.equal(twoEthers)

      const data = foreignMediator.contract.methods
        .handleBridgedTokens(user, halfEther.toString(10), exampleTxHash)
        .encodeABI()
      await foreignBridge.executeMessageCall(
        foreignMediator.address,
        homeMediator.address,
        data,
        exampleTxHash,
        1000000
      ).should.be.fulfilled

      expect(await token.totalSupply()).to.be.bignumber.equal(twoEthers)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)
      expect(await token.balanceOf(foreignMediator.address)).to.be.bignumber.equal(twoEthers.sub(halfEther))
    })

    it('should use all tokens from bridge balance', async () => {
      await token.mint(foreignMediator.address, halfEther)
      await token.transferOwnership(foreignMediator.address)

      expect(await token.totalSupply()).to.be.bignumber.equal(halfEther)

      const data = foreignMediator.contract.methods
        .handleBridgedTokens(user, halfEther.toString(10), exampleTxHash)
        .encodeABI()
      await foreignBridge.executeMessageCall(
        foreignMediator.address,
        homeMediator.address,
        data,
        exampleTxHash,
        1000000
      ).should.be.fulfilled

      expect(await token.totalSupply()).to.be.bignumber.equal(halfEther)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)
      expect(await token.balanceOf(foreignMediator.address)).to.be.bignumber.equal(ZERO)
    })

    it('should mint lacking tokens', async () => {
      await token.mint(foreignMediator.address, halfEther)
      await token.transferOwnership(foreignMediator.address)

      expect(await token.totalSupply()).to.be.bignumber.equal(halfEther)

      const data = foreignMediator.contract.methods
        .handleBridgedTokens(user, ether('0.6').toString(10), exampleTxHash)
        .encodeABI()
      await foreignBridge.executeMessageCall(
        foreignMediator.address,
        homeMediator.address,
        data,
        exampleTxHash,
        1000000
      ).should.be.fulfilled

      expect(await token.totalSupply()).to.be.bignumber.equal(ether('0.6'))
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ether('0.6'))
      expect(await token.balanceOf(foreignMediator.address)).to.be.bignumber.equal(ZERO)
    })

    it('should mint lacking tokens, zero initial balance', async () => {
      await token.transferOwnership(foreignMediator.address)

      expect(await token.totalSupply()).to.be.bignumber.equal(ZERO)

      const data = foreignMediator.contract.methods
        .handleBridgedTokens(user, halfEther.toString(10), exampleTxHash)
        .encodeABI()
      await foreignBridge.executeMessageCall(
        foreignMediator.address,
        homeMediator.address,
        data,
        exampleTxHash,
        1000000
      ).should.be.fulfilled

      expect(await token.totalSupply()).to.be.bignumber.equal(halfEther)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)
      expect(await token.balanceOf(foreignMediator.address)).to.be.bignumber.equal(ZERO)
    })
  })

  describe('return fixed tokens', async () => {
    it('should free fixed tokens, without minting new tokens', async () => {
      await token.mint(user, oneEther)
      await token.transferOwnership(foreignMediator.address)

      expect(await token.totalSupply()).to.be.bignumber.equal(oneEther)

      await token.transferAndCall(foreignMediator.address, halfEther, '0x', { from: user }).should.be.fulfilled

      const events = await getEvents(foreignBridge, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      const dataHash = web3.utils.soliditySha3(`0x${events[0].returnValues.encodedData.slice(148)}`)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)

      const data = foreignMediator.contract.methods.fixFailedMessage(dataHash).encodeABI()
      await foreignBridge.executeMessageCall(
        foreignMediator.address,
        homeMediator.address,
        data,
        exampleTxHash,
        1000000
      ).should.be.fulfilled

      expect(await token.totalSupply()).to.be.bignumber.equal(oneEther)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(oneEther)
      expect(await token.balanceOf(foreignMediator.address)).to.be.bignumber.equal(ZERO)
    })

    it('should free fixed tokens, with minting new tokens', async () => {
      await token.mint(user, oneEther)
      await token.transferOwnership(foreignMediator.address)

      expect(await token.totalSupply()).to.be.bignumber.equal(oneEther)

      await token.transferAndCall(foreignMediator.address, halfEther, '0x', { from: user }).should.be.fulfilled

      const events = await getEvents(foreignBridge, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      const dataHash = web3.utils.soliditySha3(
        `0x${events[0].returnValues.encodedData.substr(148, events[0].returnValues.encodedData.length - 148)}`
      )
      expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)

      const data1 = foreignMediator.contract.methods
        .handleBridgedTokens(user, halfEther.toString(10), exampleTxHash)
        .encodeABI()
      await foreignBridge.executeMessageCall(
        foreignMediator.address,
        homeMediator.address,
        data1,
        exampleTxHash,
        1000000
      ).should.be.fulfilled

      expect(await token.totalSupply()).to.be.bignumber.equal(oneEther)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(oneEther)
      expect(await token.balanceOf(foreignMediator.address)).to.be.bignumber.equal(ZERO)

      const data2 = foreignMediator.contract.methods.fixFailedMessage(dataHash).encodeABI()
      await foreignBridge.executeMessageCall(
        foreignMediator.address,
        homeMediator.address,
        data2,
        exampleTxHash,
        1000000
      ).should.be.fulfilled

      expect(await token.totalSupply()).to.be.bignumber.equal(ether('1.5'))
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ether('1.5'))
      expect(await token.balanceOf(foreignMediator.address)).to.be.bignumber.equal(ZERO)
    })
  })

  describe('bridge tokens from mainnet', async () => {
    it('should accept tokens within limits', async () => {
      await token.mint(user, oneEther)
      await token.transferOwnership(foreignMediator.address)

      expect(await token.totalSupply()).to.be.bignumber.equal(oneEther)

      await token.transferAndCall(foreignMediator.address, halfEther, '0x', { from: user }).should.be.fulfilled

      const events = await getEvents(foreignBridge, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      const sender = `0x${events[0].returnValues.encodedData.slice(148 + 32, 148 + 72)}`
      const bridgedValue = toBN(events[0].returnValues.encodedData.slice(148 + 72, 148 + 136))

      expect(sender).to.be.equal(user.toLowerCase())
      expect(bridgedValue).to.be.bignumber.equal(halfEther)
      expect(await token.totalSupply()).to.be.bignumber.equal(oneEther)
      expect(await token.balanceOf(foreignMediator.address)).to.be.bignumber.equal(halfEther)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)
    })
  })
})
