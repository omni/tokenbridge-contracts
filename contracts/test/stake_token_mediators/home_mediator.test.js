const ForeignStakeTokenMediator = artifacts.require('ForeignStakeTokenMediator.sol')
const HomeStakeTokenMediator = artifacts.require('HomeStakeTokenMediator.sol')
const ERC677BridgeTokenRewardable = artifacts.require('ERC677BridgeTokenRewardable.sol')
const AMBMock = artifacts.require('AMBMock.sol')
const BlockReward = artifacts.require('BlockRewardMock.sol')
const MintHandlerMock = artifacts.require('MintHandlerMock.sol')

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
const homeFee = ether('0.01')
const executionDailyLimit = dailyLimit
const executionMaxPerTx = maxPerTx
const exampleMessageId = '0xf308b922ab9f8a7128d9d7bc9bce22cd88b2c05c8213f0e2d8104d78e0a9ecbb'
const decimalShiftZero = 0

contract('HomeStakeTokenMediator', async accounts => {
  const owner = accounts[0]
  const user = accounts[1]
  const authorities = [accounts[2], accounts[3]]
  let homeBridge
  let homeMediator
  let foreignMediator
  let token
  let blockReward
  beforeEach(async () => {
    homeBridge = await AMBMock.new()
    await homeBridge.setMaxGasPerTx(maxGasPerTx)
    token = await ERC677BridgeTokenRewardable.new('Test token', 'TST', 18, 100)
    blockReward = await BlockReward.new()
    await blockReward.setValidatorsRewards(authorities)
    await blockReward.setToken(token.address)
    await token.setBlockRewardContract(blockReward.address)
    homeMediator = await HomeStakeTokenMediator.new()
    foreignMediator = await ForeignStakeTokenMediator.new()
  })

  describe('rewardableInitialize', async () => {
    it('should initialize', async () => {
      expect(await homeMediator.isInitialized()).to.be.equal(false)
      expect(await homeMediator.bridgeContract()).to.be.equal(ZERO_ADDRESS)
      expect(await homeMediator.mediatorContractOnOtherSide()).to.be.equal(ZERO_ADDRESS)
      expect(await homeMediator.erc677token()).to.be.equal(ZERO_ADDRESS)
      expect(await homeMediator.dailyLimit()).to.be.bignumber.equal(ZERO)
      expect(await homeMediator.maxPerTx()).to.be.bignumber.equal(ZERO)
      expect(await homeMediator.minPerTx()).to.be.bignumber.equal(ZERO)
      expect(await homeMediator.executionDailyLimit()).to.be.bignumber.equal(ZERO)
      expect(await homeMediator.executionMaxPerTx()).to.be.bignumber.equal(ZERO)
      expect(await homeMediator.requestGasLimit()).to.be.bignumber.equal(ZERO)
      expect(await homeMediator.owner()).to.be.equal(ZERO_ADDRESS)
      expect(await homeMediator.getFee()).to.be.bignumber.equal(ZERO)
      expect(await homeMediator.blockRewardContract()).to.be.equal(ZERO_ADDRESS)

      const { logs } = await homeMediator.rewardableInitialize(
        homeBridge.address,
        foreignMediator.address,
        token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        blockReward.address,
        homeFee
      ).should.be.fulfilled

      // already initialized
      await homeMediator.rewardableInitialize(
        homeBridge.address,
        foreignMediator.address,
        token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        blockReward.address,
        homeFee
      ).should.be.rejected

      expect(await homeMediator.isInitialized()).to.be.equal(true)
      expect(await homeMediator.bridgeContract()).to.be.equal(homeBridge.address)
      expect(await homeMediator.mediatorContractOnOtherSide()).to.be.equal(foreignMediator.address)
      expect(await homeMediator.erc677token()).to.be.equal(token.address)
      expect(await homeMediator.dailyLimit()).to.be.bignumber.equal(dailyLimit)
      expect(await homeMediator.maxPerTx()).to.be.bignumber.equal(maxPerTx)
      expect(await homeMediator.minPerTx()).to.be.bignumber.equal(minPerTx)
      expect(await homeMediator.executionDailyLimit()).to.be.bignumber.equal(executionDailyLimit)
      expect(await homeMediator.executionMaxPerTx()).to.be.bignumber.equal(executionMaxPerTx)
      expect(await homeMediator.requestGasLimit()).to.be.bignumber.equal(maxGasPerTx)
      expect(await homeMediator.owner()).to.be.equal(owner)
      expect(await homeMediator.getFee()).to.be.bignumber.equal(homeFee)
      expect(await homeMediator.blockRewardContract()).to.be.equal(blockReward.address)

      expectEventInLogs(logs, 'ExecutionDailyLimitChanged', { newLimit: executionDailyLimit })
      expectEventInLogs(logs, 'DailyLimitChanged', { newLimit: dailyLimit })
      expectEventInLogs(logs, 'FeeUpdated', { fee: homeFee })
    })

    it('should not accept invalid blockReward', async () => {
      // invalid block reward
      await homeMediator.rewardableInitialize(
        homeBridge.address,
        foreignMediator.address,
        token.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        foreignMediator.address,
        homeFee
      ).should.be.rejected
    })
  })

  describe('getBridgeMode', () => {
    it('should return stake bridging mode and interface', async function() {
      const bridgeModeHash = '0x16ea01e9' // 4 bytes of keccak256('stake-erc-to-erc-amb')
      expect(await homeMediator.getBridgeMode()).to.be.equal(bridgeModeHash)

      const { major, minor, patch } = await homeMediator.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(ZERO)
      minor.should.be.bignumber.gte(ZERO)
      patch.should.be.bignumber.gte(ZERO)
    })
  })

  describe('after initialization', async () => {
    beforeEach(async () => {
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

        const blockReward2 = await BlockReward.new()
        await homeMediator.setBlockRewardContract(blockReward2.address, { from: owner }).should.be.fulfilled

        expect(await homeMediator.blockRewardContract()).to.be.equal(blockReward2.address)
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

    describe('isFeeCollectingActivated', async () => {
      it('should return false when no block reward and no fee', async () => {
        expect(await homeMediator.isFeeCollectingActivated()).to.be.equal(false)
      })

      it('should return false when block reward is configured but no fee', async () => {
        await homeMediator.setBlockRewardContract(blockReward.address)

        expect(await homeMediator.isFeeCollectingActivated()).to.be.equal(false)
      })

      it('should return false when no block reward but fee is set', async () => {
        await homeMediator.setFee(ether('0.05'), { from: owner }).should.be.fulfilled

        expect(await homeMediator.isFeeCollectingActivated()).to.be.equal(false)
      })

      it('should return true when both block reward and fee are configured', async () => {
        await homeMediator.setFee(ether('0.05'), { from: owner }).should.be.fulfilled
        await homeMediator.setBlockRewardContract(blockReward.address)

        expect(await homeMediator.isFeeCollectingActivated()).to.be.equal(true)
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

      it('should accept tokens, no fee', async () => {
        await homeMediator.setBlockRewardContract(blockReward.address)
        await token.transferAndCall(homeMediator.address, halfEther, '0x', { from: user }).should.be.fulfilled

        const events = await getEvents(homeBridge, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        const message = events[0].returnValues.encodedData
        const bridgedValue = toBN(message.slice(message.length - 64))
        expect(bridgedValue).to.be.bignumber.equal(halfEther)
        expect(await token.totalSupply()).to.be.bignumber.equal(halfEther)
        expect(await token.balanceOf(homeMediator.address)).to.be.bignumber.equal(ZERO)
        expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)
        expect(await token.balanceOf(blockReward.address)).to.be.bignumber.equal(ZERO)
      })

      it('should accept tokens, configured fee', async () => {
        await homeMediator.setBlockRewardContract(blockReward.address)
        await homeMediator.setFee(ether('0.1')).should.be.fulfilled

        await token.transferAndCall(homeMediator.address, halfEther, '0x', { from: user }).should.be.fulfilled

        const events = await getEvents(homeBridge, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        const message = events[0].returnValues.encodedData
        const bridgedValue = toBN(message.slice(message.length - 64))

        expect(bridgedValue).to.be.bignumber.equal(ether('0.45'))
        expect(await token.totalSupply()).to.be.bignumber.equal(ether('0.55'))
        expect(await token.balanceOf(homeMediator.address)).to.be.bignumber.equal(ZERO)
        expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)
        expect(await token.balanceOf(blockReward.address)).to.be.bignumber.equal(ether('0.05'))
      })

      it('should accept tokens, block reward contract is not configured', async () => {
        await homeMediator.setFee(ether('0.1')).should.be.fulfilled

        await token.transferAndCall(homeMediator.address, halfEther, '0x', { from: user }).should.be.fulfilled

        const events = await getEvents(homeBridge, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        const message = events[0].returnValues.encodedData
        const bridgedValue = toBN(message.slice(message.length - 64))

        expect(bridgedValue).to.be.bignumber.equal(halfEther)
        expect(await token.totalSupply()).to.be.bignumber.equal(halfEther)
        expect(await token.balanceOf(homeMediator.address)).to.be.bignumber.equal(ZERO)
        expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)
        expect(await token.balanceOf(blockReward.address)).to.be.bignumber.equal(ZERO)
      })

      it('should not accept zero tokens', async () => {
        await token.transferAndCall(homeMediator.address, ZERO, '0x', { from: user }).should.be.rejected
        await token.transferAndCall(homeMediator.address, halfEther, '0x', { from: user }).should.be.fulfilled
      })

      it('should not accept tokens if receiver is a mediator on the other side', async () => {
        await token.transferAndCall(homeMediator.address, halfEther, foreignMediator.address, { from: user }).should.be
          .rejected
        await token.transferAndCall(homeMediator.address, halfEther, user, { from: user }).should.be.fulfilled
      })
    })

    describe('bridge tokens to xDai chain', async () => {
      it('should mint new tokens ', async () => {
        await token.transferOwnership(homeMediator.address)

        expect(await token.totalSupply()).to.be.bignumber.equal(ZERO)

        const data = homeMediator.contract.methods.handleBridgedTokens(user, halfEther.toString(10)).encodeABI()
        await homeBridge.executeMessageCall(
          homeMediator.address,
          foreignMediator.address,
          data,
          exampleMessageId,
          1000000
        ).should.be.fulfilled

        expect(await token.totalSupply()).to.be.bignumber.equal(halfEther)
        expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)
        expect(await token.balanceOf(homeMediator.address)).to.be.bignumber.equal(ZERO)

        const events = await getEvents(homeMediator, { event: 'TokensBridged' })
        expect(events.length).to.be.equal(1)
        expect(events[0].returnValues.recipient).to.be.equal(user)
        expect(events[0].returnValues.value).to.be.equal(halfEther.toString())
        expect(events[0].returnValues.messageId).to.be.equal(exampleMessageId)
      })
    })

    describe('return fixed tokens', async () => {
      it('should mint fixed tokens,', async () => {
        await token.mint(user, oneEther)
        await token.transferOwnership(homeMediator.address)

        expect(await token.totalSupply()).to.be.bignumber.equal(oneEther)

        await token.transferAndCall(homeMediator.address, halfEther, '0x', { from: user }).should.be.fulfilled

        const events = await getEvents(homeBridge, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        const transferMessageId = events[0].returnValues.messageId
        expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)
        expect(await token.totalSupply()).to.be.bignumber.equal(halfEther)

        const data = homeMediator.contract.methods.fixFailedMessage(transferMessageId).encodeABI()
        await homeBridge.executeMessageCall(
          homeMediator.address,
          foreignMediator.address,
          data,
          exampleMessageId,
          1000000
        ).should.be.fulfilled

        expect(await token.totalSupply()).to.be.bignumber.equal(oneEther)
        expect(await token.balanceOf(user)).to.be.bignumber.equal(oneEther)
        expect(await token.balanceOf(homeMediator.address)).to.be.bignumber.equal(ZERO)
      })
    })

    describe('transferTokenOwnership', async () => {
      it('should transfer token ownership to different contract', async () => {
        await token.transferOwnership(homeMediator.address)

        expect(await token.owner()).to.be.equal(homeMediator.address)

        await homeMediator.transferTokenOwnership(accounts[2]).should.be.fulfilled

        expect(await token.owner()).to.be.equal(accounts[2])
      })

      it('should fail if not an owner', async () => {
        await token.transferOwnership(homeMediator.address)

        await homeMediator.transferTokenOwnership(accounts[2], { from: user }).should.be.rejected
      })

      it('should fail if not a current token owner', async () => {
        await homeMediator.transferTokenOwnership(accounts[2], { from: owner }).should.be.rejected
      })
    })

    describe('mintHandler', async () => {
      let mintHandler

      beforeEach(async () => {
        mintHandler = await MintHandlerMock.new(token.address)
        await mintHandler.addBridge(homeMediator.address)
      })

      it('should allow to set different mint handler', async () => {
        expect(await homeMediator.getMintHandler()).to.be.equal(token.address)

        await homeMediator.setMintHandler(mintHandler.address, { from: owner }).should.be.fulfilled

        expect(await homeMediator.getMintHandler()).to.be.equal(mintHandler.address)
      })

      it('should fail if not an owner', async () => {
        await homeMediator.setMintHandler(mintHandler.address, { from: accounts[1] }).should.be.rejected
      })

      it('should fail if not a contract', async () => {
        await homeMediator.setMintHandler(accounts[2], { from: owner }).should.be.rejected
      })

      it('should process bridge tokens through mint handler', async () => {
        await homeMediator.setMintHandler(mintHandler.address, { from: owner }).should.be.fulfilled
        await token.transferOwnership(mintHandler.address)

        expect(await token.totalSupply()).to.be.bignumber.equal(ZERO)

        const data = homeMediator.contract.methods.handleBridgedTokens(user, halfEther.toString(10)).encodeABI()
        await homeBridge.executeMessageCall(
          homeMediator.address,
          foreignMediator.address,
          data,
          exampleMessageId,
          1000000
        ).should.be.fulfilled

        expect(await token.totalSupply()).to.be.bignumber.equal(halfEther)
        expect(await token.balanceOf(user)).to.be.bignumber.equal(halfEther)
        expect(await token.balanceOf(homeMediator.address)).to.be.bignumber.equal(ZERO)
      })
    })
  })
})
