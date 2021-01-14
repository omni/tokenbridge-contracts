const ForeignStakeTokenMediator = artifacts.require('ForeignStakeTokenMediator.sol')
const HomeStakeTokenMediator = artifacts.require('HomeStakeTokenMediator.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')
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
const exampleMessageId = '0xf308b922ab9f8a7128d9d7bc9bce22cd88b2c05c8213f0e2d8104d78e0a9ecbb'
const otherMessageId = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
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

  describe('getBridgeMode', () => {
    it('should return stake bridging mode and interface', async function() {
      const bridgeModeHash = '0x16ea01e9' // 4 bytes of keccak256('stake-erc-to-erc-amb')
      expect(await foreignMediator.getBridgeMode()).to.be.equal(bridgeModeHash)

      const { major, minor, patch } = await foreignMediator.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(ZERO)
      minor.should.be.bignumber.gte(ZERO)
      patch.should.be.bignumber.gte(ZERO)
    })
  })

  describe('bridge tokens to mainnet', async () => {
    it('should use tokens from bridge balance', async () => {
      await token.mint(foreignMediator.address, twoEthers)
      await token.transferOwnership(foreignMediator.address)

      expect(await token.totalSupply()).to.be.bignumber.equal(twoEthers)

      const data = foreignMediator.contract.methods.handleBridgedTokens(user, halfEther.toString(10)).encodeABI()
      await foreignBridge.executeMessageCall(
        foreignMediator.address,
        homeMediator.address,
        data,
        exampleMessageId,
        1000000
      ).should.be.fulfilled

      expect(await token.totalSupply()).to.be.bignumber.equal(twoEthers)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)
      expect(await token.balanceOf(foreignMediator.address)).to.be.bignumber.equal(twoEthers.sub(halfEther))

      const events = await getEvents(foreignMediator, { event: 'TokensBridged' })
      expect(events.length).to.be.equal(1)
      expect(events[0].returnValues.recipient).to.be.equal(user)
      expect(events[0].returnValues.value).to.be.equal(halfEther.toString())
      expect(events[0].returnValues.messageId).to.be.equal(exampleMessageId)
    })

    it('should use all tokens from bridge balance', async () => {
      await token.mint(foreignMediator.address, halfEther)
      await token.transferOwnership(foreignMediator.address)

      expect(await token.totalSupply()).to.be.bignumber.equal(halfEther)

      const data = foreignMediator.contract.methods.handleBridgedTokens(user, halfEther.toString(10)).encodeABI()
      await foreignBridge.executeMessageCall(
        foreignMediator.address,
        homeMediator.address,
        data,
        exampleMessageId,
        1000000
      ).should.be.fulfilled

      expect(await token.totalSupply()).to.be.bignumber.equal(halfEther)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)
      expect(await token.balanceOf(foreignMediator.address)).to.be.bignumber.equal(ZERO)

      const events = await getEvents(foreignMediator, { event: 'TokensBridged' })
      expect(events.length).to.be.equal(1)
      expect(events[0].returnValues.recipient).to.be.equal(user)
      expect(events[0].returnValues.value).to.be.equal(halfEther.toString())
      expect(events[0].returnValues.messageId).to.be.equal(exampleMessageId)
    })

    it('should mint lacking tokens', async () => {
      await token.mint(foreignMediator.address, halfEther)
      await token.transferOwnership(foreignMediator.address)

      expect(await token.totalSupply()).to.be.bignumber.equal(halfEther)

      const data = foreignMediator.contract.methods.handleBridgedTokens(user, ether('0.6').toString(10)).encodeABI()
      await foreignBridge.executeMessageCall(
        foreignMediator.address,
        homeMediator.address,
        data,
        exampleMessageId,
        1000000
      ).should.be.fulfilled

      expect(await token.totalSupply()).to.be.bignumber.equal(ether('0.6'))
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ether('0.6'))
      expect(await token.balanceOf(foreignMediator.address)).to.be.bignumber.equal(ZERO)

      const events = await getEvents(foreignMediator, { event: 'TokensBridged' })
      expect(events.length).to.be.equal(1)
      expect(events[0].returnValues.recipient).to.be.equal(user)
      expect(events[0].returnValues.value).to.be.equal(ether('0.6').toString())
      expect(events[0].returnValues.messageId).to.be.equal(exampleMessageId)
    })

    it('should mint lacking tokens, zero initial balance', async () => {
      await token.transferOwnership(foreignMediator.address)

      expect(await token.totalSupply()).to.be.bignumber.equal(ZERO)

      const data = foreignMediator.contract.methods.handleBridgedTokens(user, halfEther.toString(10)).encodeABI()
      await foreignBridge.executeMessageCall(
        foreignMediator.address,
        homeMediator.address,
        data,
        exampleMessageId,
        1000000
      ).should.be.fulfilled

      expect(await token.totalSupply()).to.be.bignumber.equal(halfEther)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)
      expect(await token.balanceOf(foreignMediator.address)).to.be.bignumber.equal(ZERO)

      const events = await getEvents(foreignMediator, { event: 'TokensBridged' })
      expect(events.length).to.be.equal(1)
      expect(events[0].returnValues.recipient).to.be.equal(user)
      expect(events[0].returnValues.value).to.be.equal(halfEther.toString())
      expect(events[0].returnValues.messageId).to.be.equal(exampleMessageId)
    })
  })

  describe('return fixed tokens', async () => {
    beforeEach(async () => {
      await token.mint(user, oneEther)
      await token.transferOwnership(foreignMediator.address)

      expect(await token.totalSupply()).to.be.bignumber.equal(oneEther)
    })

    it('should free fixed tokens, without minting new tokens', async () => {
      await token.transferAndCall(foreignMediator.address, halfEther, '0x', { from: user }).should.be.fulfilled

      const events = await getEvents(foreignBridge, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      const transferMessageId = events[0].returnValues.messageId
      expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)

      const data = foreignMediator.contract.methods.fixFailedMessage(transferMessageId).encodeABI()
      await foreignBridge.executeMessageCall(
        foreignMediator.address,
        homeMediator.address,
        data,
        exampleMessageId,
        1000000
      ).should.be.fulfilled

      expect(await token.totalSupply()).to.be.bignumber.equal(oneEther)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(oneEther)
      expect(await token.balanceOf(foreignMediator.address)).to.be.bignumber.equal(ZERO)
    })

    it('should free fixed tokens, with minting new tokens', async () => {
      await token.transferAndCall(foreignMediator.address, halfEther, '0x', { from: user }).should.be.fulfilled

      const events = await getEvents(foreignBridge, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      const transferMessageId = events[0].returnValues.messageId
      expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)

      const data1 = foreignMediator.contract.methods.handleBridgedTokens(user, halfEther.toString(10)).encodeABI()
      await foreignBridge.executeMessageCall(
        foreignMediator.address,
        homeMediator.address,
        data1,
        exampleMessageId,
        1000000
      ).should.be.fulfilled

      expect(await token.totalSupply()).to.be.bignumber.equal(oneEther)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(oneEther)
      expect(await token.balanceOf(foreignMediator.address)).to.be.bignumber.equal(ZERO)

      const data2 = foreignMediator.contract.methods.fixFailedMessage(transferMessageId).encodeABI()
      await foreignBridge.executeMessageCall(
        foreignMediator.address,
        homeMediator.address,
        data2,
        otherMessageId,
        1000000
      ).should.be.fulfilled

      expect(await token.totalSupply()).to.be.bignumber.equal(ether('1.5'))
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ether('1.5'))
      expect(await token.balanceOf(foreignMediator.address)).to.be.bignumber.equal(ZERO)
    })
  })

  describe('bridge tokens from mainnet', async () => {
    beforeEach(async () => {
      await token.mint(user, oneEther)
      await token.transferOwnership(foreignMediator.address)

      expect(await token.totalSupply()).to.be.bignumber.equal(oneEther)
    })

    it('should accept tokens within limits', async () => {
      await token.transferAndCall(foreignMediator.address, halfEther, '0x', { from: user }).should.be.fulfilled

      const events = await getEvents(foreignBridge, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      const message = events[0].returnValues.encodedData
      const sender = `0x${message.slice(message.length - 104, message.length - 64)}`
      const bridgedValue = toBN(message.slice(message.length - 64))
      expect(sender).to.be.equal(user.toLowerCase())
      expect(bridgedValue).to.be.bignumber.equal(halfEther)
      expect(await token.totalSupply()).to.be.bignumber.equal(oneEther)
      expect(await token.balanceOf(foreignMediator.address)).to.be.bignumber.equal(halfEther)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)
    })

    it('should not accept zero tokens', async () => {
      await token.transferAndCall(foreignMediator.address, ZERO, '0x', { from: user }).should.be.rejected
      await token.transferAndCall(foreignMediator.address, halfEther, '0x', { from: user }).should.be.fulfilled
    })

    it('should not accept tokens if receiver is a mediator on the other side', async () => {
      await token.transferAndCall(foreignMediator.address, halfEther, homeMediator.address, { from: user }).should.be
        .rejected
      await token.transferAndCall(foreignMediator.address, halfEther, user, { from: user }).should.be.fulfilled
    })
  })

  describe('claimTokens', () => {
    it('should not allow to claim bridged token', async () => {
      const storageProxy = await EternalStorageProxy.new()
      await storageProxy.upgradeTo('1', foreignMediator.address).should.be.fulfilled
      foreignMediator = await ForeignStakeTokenMediator.at(storageProxy.address)
      token = await ERC677BridgeToken.new('test', 'TST', 18)
      await token.mint(foreignMediator.address, twoEthers, { from: owner }).should.be.fulfilled

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

      await foreignMediator.claimTokens(token.address, accounts[3], { from: accounts[3] }).should.be.rejected
      await foreignMediator.claimTokens(token.address, accounts[3], { from: owner }).should.be.rejected
    })
  })
})
