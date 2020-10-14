const HomeAMBErc20ToNative = artifacts.require('HomeAMBErc20ToNative.sol')
const BlockReward = artifacts.require('BlockRewardWithoutSystem.sol')
const ForeignAMBErc20ToNative = artifacts.require('ForeignAMBErc20ToNative.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const AMBMock = artifacts.require('AMBMock.sol')
const Sacrifice = artifacts.require('Sacrifice.sol')

const { expect } = require('chai')
const { getEvents, expectEventInLogs, ether, strip0x } = require('../helpers/helpers')
const { ZERO_ADDRESS, toBN } = require('../setup')

const ZERO = toBN(0)
const oneEther = ether('1')
const twoEthers = ether('2')
const maxGasPerTx = oneEther
const dailyLimit = twoEthers
const maxPerTx = oneEther
const minPerTx = ether('0.01')
const executionDailyLimit = dailyLimit
const executionMaxPerTx = maxPerTx
const decimalShiftZero = 0
const exampleMessageId = '0xf308b922ab9f8a7128d9d7bc9bce22cd88b2c05c8213f0e2d8104d78e0a9ecbb'
const otherMessageId = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
const failedMessageId = '0x2ebc2ccc755acc8eaf9252e19573af708d644ab63a39619adb080a3500a4ff2e'

contract('HomeAMBErc20ToNative', async accounts => {
  let contract
  let blockReward
  let ambBridgeContract
  let otherSideMediator
  const owner = accounts[0]
  const user = accounts[1]
  const user2 = accounts[2]
  beforeEach(async () => {
    contract = await HomeAMBErc20ToNative.new()
    blockReward = await BlockReward.new()
    ambBridgeContract = await AMBMock.new()
    await ambBridgeContract.setMaxGasPerTx(maxGasPerTx)
    otherSideMediator = await ForeignAMBErc20ToNative.new()
  })

  describe('initialize', () => {
    it('should initialize parameters', async () => {
      // Given
      expect(await contract.isInitialized()).to.be.equal(false)
      expect(await contract.bridgeContract()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.mediatorContractOnOtherSide()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.dailyLimit()).to.be.bignumber.equal(ZERO)
      expect(await contract.maxPerTx()).to.be.bignumber.equal(ZERO)
      expect(await contract.minPerTx()).to.be.bignumber.equal(ZERO)
      expect(await contract.executionDailyLimit()).to.be.bignumber.equal(ZERO)
      expect(await contract.executionMaxPerTx()).to.be.bignumber.equal(ZERO)
      expect(await contract.requestGasLimit()).to.be.bignumber.equal(ZERO)
      expect(await contract.decimalShift()).to.be.bignumber.equal(ZERO)
      expect(await contract.owner()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.blockRewardContract()).to.be.equal(ZERO_ADDRESS)

      // When
      // not valid bridge address
      await contract.initialize(
        ZERO_ADDRESS,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        blockReward.address
      ).should.be.rejected

      // dailyLimit > maxPerTx
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [maxPerTx, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        blockReward.address
      ).should.be.rejected

      // maxPerTx > minPerTx
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, minPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        blockReward.address
      ).should.be.rejected

      // executionDailyLimit > executionMaxPerTx
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionDailyLimit],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        blockReward.address
      ).should.be.rejected

      // maxGasPerTx > bridge maxGasPerTx
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        twoEthers,
        decimalShiftZero,
        owner,
        blockReward.address
      ).should.be.rejected

      // invalid block reward address
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        ZERO_ADDRESS
      ).should.be.rejected

      // invalid block reward address
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        ambBridgeContract.address
      ).should.be.rejected

      // not valid owner
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        ZERO_ADDRESS,
        blockReward.address
      ).should.be.rejected

      // not valid decimal shift
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        100,
        owner,
        blockReward.address
      ).should.be.rejected

      const { logs } = await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        blockReward.address
      ).should.be.fulfilled

      // already initialized
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        blockReward.address
      ).should.be.rejected

      // Then
      expect(await contract.isInitialized()).to.be.equal(true)
      expect(await contract.bridgeContract()).to.be.equal(ambBridgeContract.address)
      expect(await contract.mediatorContractOnOtherSide()).to.be.equal(otherSideMediator.address)
      expect(await contract.dailyLimit()).to.be.bignumber.equal(dailyLimit)
      expect(await contract.maxPerTx()).to.be.bignumber.equal(maxPerTx)
      expect(await contract.minPerTx()).to.be.bignumber.equal(minPerTx)
      expect(await contract.executionDailyLimit()).to.be.bignumber.equal(executionDailyLimit)
      expect(await contract.executionMaxPerTx()).to.be.bignumber.equal(executionMaxPerTx)
      expect(await contract.requestGasLimit()).to.be.bignumber.equal(maxGasPerTx)
      expect(await contract.decimalShift()).to.be.bignumber.equal(ZERO)
      expect(await contract.owner()).to.be.equal(owner)
      expect(await contract.blockRewardContract()).to.be.equal(blockReward.address)

      expectEventInLogs(logs, 'ExecutionDailyLimitChanged', { newLimit: executionDailyLimit })
      expectEventInLogs(logs, 'DailyLimitChanged', { newLimit: dailyLimit })
    })
  })

  describe('rewardableInitialize', () => {
    it('should initialize parameters for rewardable mediator', async () => {
      // Given
      expect(await contract.isInitialized()).to.be.equal(false)
      expect(await contract.bridgeContract()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.mediatorContractOnOtherSide()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.dailyLimit()).to.be.bignumber.equal(ZERO)
      expect(await contract.maxPerTx()).to.be.bignumber.equal(ZERO)
      expect(await contract.minPerTx()).to.be.bignumber.equal(ZERO)
      expect(await contract.executionDailyLimit()).to.be.bignumber.equal(ZERO)
      expect(await contract.executionMaxPerTx()).to.be.bignumber.equal(ZERO)
      expect(await contract.requestGasLimit()).to.be.bignumber.equal(ZERO)
      expect(await contract.decimalShift()).to.be.bignumber.equal(ZERO)
      expect(await contract.owner()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.blockRewardContract()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.getFee(await contract.HOME_TO_FOREIGN_FEE())).to.be.bignumber.equal(ZERO)
      expect(await contract.getFee(await contract.FOREIGN_TO_HOME_FEE())).to.be.bignumber.equal(ZERO)
      expect(await contract.rewardAddressCount()).to.be.bignumber.equal('0')
      expect(await contract.isRewardAddress(owner)).to.be.equal(false)
      await contract.getFee(exampleMessageId).should.be.rejected

      // empty reward list
      await contract.rewardableInitialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        blockReward.address,
        [],
        [ether('0.01'), ether('0.02')]
      ).should.be.rejected

      // too high fee
      await contract.rewardableInitialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        blockReward.address,
        [owner],
        [ether('1.01'), ether('0.02')]
      ).should.be.rejected

      // too high fee
      await contract.rewardableInitialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        blockReward.address,
        [owner],
        [ether('0.01'), ether('1')]
      ).should.be.rejected

      // invalid fees list
      await contract.rewardableInitialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        blockReward.address,
        [owner],
        [ether('0.01')]
      ).should.be.rejected

      const { logs } = await contract.rewardableInitialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        blockReward.address,
        [owner],
        [ether('0.01'), ether('0.02')]
      ).should.be.fulfilled

      // already initialized
      await contract.rewardableInitialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        blockReward.address,
        [owner],
        [ether('0.01'), ether('0.02')]
      ).should.be.rejected

      // already initialized
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        blockReward.address
      ).should.be.rejected

      // Then
      expect(await contract.isInitialized()).to.be.equal(true)
      expect(await contract.bridgeContract()).to.be.equal(ambBridgeContract.address)
      expect(await contract.mediatorContractOnOtherSide()).to.be.equal(otherSideMediator.address)
      expect(await contract.dailyLimit()).to.be.bignumber.equal(dailyLimit)
      expect(await contract.maxPerTx()).to.be.bignumber.equal(maxPerTx)
      expect(await contract.minPerTx()).to.be.bignumber.equal(minPerTx)
      expect(await contract.executionDailyLimit()).to.be.bignumber.equal(executionDailyLimit)
      expect(await contract.executionMaxPerTx()).to.be.bignumber.equal(executionMaxPerTx)
      expect(await contract.requestGasLimit()).to.be.bignumber.equal(maxGasPerTx)
      expect(await contract.decimalShift()).to.be.bignumber.equal(ZERO)
      expect(await contract.owner()).to.be.equal(owner)
      expect(await contract.blockRewardContract()).to.be.equal(blockReward.address)
      expect(await contract.getFee(await contract.HOME_TO_FOREIGN_FEE())).to.be.bignumber.equal(ether('0.01'))
      expect(await contract.getFee(await contract.FOREIGN_TO_HOME_FEE())).to.be.bignumber.equal(ether('0.02'))
      expect(await contract.rewardAddressList()).to.be.eql([owner])
      expect(await contract.rewardAddressCount()).to.be.bignumber.equal('1')
      expect(await contract.isRewardAddress(owner)).to.be.equal(true)

      expectEventInLogs(logs, 'ExecutionDailyLimitChanged', { newLimit: executionDailyLimit })
      expectEventInLogs(logs, 'DailyLimitChanged', { newLimit: dailyLimit })
    })
  })

  describe('getBridgeMode', () => {
    it('should return mediator mode and interface', async () => {
      const bridgeModeHash = '0xe177c00f' // 4 bytes of keccak256('erc-to-native-amb')
      expect(await contract.getBridgeMode()).to.be.equal(bridgeModeHash)

      const { major, minor, patch } = await contract.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(ZERO)
      minor.should.be.bignumber.gte(ZERO)
      patch.should.be.bignumber.gte(ZERO)
    })
  })

  describe('claimTokens', () => {
    beforeEach(async () => {
      const storageProxy = await EternalStorageProxy.new()
      await storageProxy.upgradeTo('1', contract.address).should.be.fulfilled
      contract = await HomeAMBErc20ToNative.at(storageProxy.address)
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        blockReward.address
      ).should.be.fulfilled
    })

    it('should work with token different from bridged token', async () => {
      const token = await ERC677BridgeToken.new('TEST', 'TST', 18)
      await token.mint(user, oneEther).should.be.fulfilled
      expect(await token.balanceOf(user)).to.be.bignumber.equal(oneEther)

      await token.transfer(contract.address, oneEther, { from: user }).should.be.fulfilled
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(oneEther)

      await contract.claimTokens(token.address, accounts[3], { from: owner }).should.be.fulfilled
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(accounts[3])).to.be.bignumber.equal(oneEther)
    })

    it('should not work for native coins', async () => {
      // Contract doesn't have a fallback method to accept native coins so it transfers using a self destruct contract
      await Sacrifice.new(contract.address, { value: oneEther }).catch(() => {})
      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(oneEther)

      await contract.claimTokens(ZERO_ADDRESS, accounts[3], { from: owner }).should.be.rejected
    })
  })

  describe('afterInitialization', () => {
    const value = oneEther
    let currentDay
    beforeEach(async () => {
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        blockReward.address
      ).should.be.fulfilled

      currentDay = await contract.getCurrentDay()
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)
      const initialEvents = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(initialEvents.length).to.be.equal(0)

      await blockReward.setBridgeContractAddress(contract.address).should.be.fulfilled
    })

    describe('setBlockRewardContract', () => {
      it('should set block reward contract', async () => {
        expect(await contract.blockRewardContract()).to.be.equal(blockReward.address)

        const blockReward2 = await BlockReward.new()
        await contract.setBlockRewardContract(blockReward2.address, { from: owner }).should.be.fulfilled

        expect(await contract.blockRewardContract()).to.be.equal(blockReward2.address)
      })

      it('should fail if not a block reward contract', async () => {
        await contract.setBlockRewardContract(ambBridgeContract.address, { from: owner }).should.be.rejected
      })

      it('should fail if not an owner', async () => {
        const blockReward2 = await BlockReward.new()
        await contract.setBlockRewardContract(blockReward2.address, { from: user }).should.be.rejected
      })
    })

    describe('handle deposited coins', () => {
      beforeEach(async () => {
        await contract.setExecutionDailyLimit(ether('100')).should.be.fulfilled
        await contract.setExecutionMaxPerTx(ether('10')).should.be.fulfilled
        const data = await contract.contract.methods.handleBridgedTokens(user, ether('10').toString()).encodeABI()
        await ambBridgeContract.executeMessageCall(
          contract.address,
          otherSideMediator.address,
          data,
          exampleMessageId,
          1000000
        ).should.be.fulfilled
        expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)

        await blockReward.reward([], []).should.be.fulfilled

        await contract.setExecutionMaxPerTx(maxPerTx).should.be.fulfilled
        await contract.setExecutionDailyLimit(dailyLimit).should.be.fulfilled

        expect(await blockReward.mintedTotallyByBridge(contract.address)).to.be.bignumber.equal(ether('10'))
      })

      describe('fallback', async () => {
        it('should accept native coins', async () => {
          // When
          await contract.sendTransaction({
            from: user,
            value
          }).should.be.fulfilled

          // Then
          expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(value)

          const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
          expect(events.length).to.be.equal(1)
          // Inlcude user address
          expect(events[0].returnValues.encodedData.includes(strip0x(user).toLowerCase())).to.be.equal(true)
          // Include mediator address
          expect(
            events[0].returnValues.encodedData.includes(strip0x(otherSideMediator.address).toLowerCase())
          ).to.be.equal(true)
          // Include handleBridgedTokens method selector
          expect(events[0].returnValues.encodedData.includes('8b6c0354')).to.be.equal(true)
          expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(ZERO)
          expect(await contract.totalBurntCoins()).to.be.bignumber.equal(ether('1'))
        })

        it('native coins amount should be inside limits ', async () => {
          // value > maxPerTx
          await contract.sendTransaction({
            from: user,
            value: twoEthers
          }).should.be.rejected

          // value < minPerTx
          await contract.sendTransaction({
            from: user,
            value: ether('0.00001')
          }).should.be.rejected

          await contract.sendTransaction({
            from: user,
            value
          }).should.be.fulfilled

          await contract.sendTransaction({
            from: user,
            value
          }).should.be.fulfilled

          // Total value > dailyLimit
          await contract.sendTransaction({
            from: user,
            value
          }).should.be.rejected

          expect(await contract.totalBurntCoins()).to.be.bignumber.equal(ether('2'))
        })
      })

      describe('relayTokens', async () => {
        it('should accept native coins and a different receiver', async () => {
          // When
          await contract.relayTokens(user2, {
            from: user,
            value
          }).should.be.fulfilled

          // Then
          expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(value)

          const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
          expect(events.length).to.be.equal(1)
          // Inlcude user2 address
          expect(events[0].returnValues.encodedData.includes(strip0x(user2).toLowerCase())).to.be.equal(true)
          // Include mediator address
          expect(
            events[0].returnValues.encodedData.includes(strip0x(otherSideMediator.address).toLowerCase())
          ).to.be.equal(true)
          // Include handleBridgedTokens method selector
          expect(events[0].returnValues.encodedData.includes('8b6c0354')).to.be.equal(true)
          expect(await contract.totalBurntCoins()).to.be.bignumber.equal(ether('1'))
        })
        it('native coins amount should be inside limits ', async () => {
          // value > maxPerTx
          await contract.relayTokens(user2, {
            from: user,
            value: twoEthers
          }).should.be.rejected

          // value < minPerTx
          await contract.relayTokens(user2, {
            from: user,
            value: ether('0.00001')
          }).should.be.rejected

          await contract.relayTokens(user2, {
            from: user,
            value
          }).should.be.fulfilled

          expect(await contract.totalBurntCoins()).to.be.bignumber.equal(ether('1'))

          await contract.relayTokens(user2, {
            from: user,
            value
          }).should.be.fulfilled

          // Total value > dailyLimit
          await contract.relayTokens(user2, {
            from: user,
            value
          }).should.be.rejected

          expect(await contract.totalBurntCoins()).to.be.bignumber.equal(ether('2'))
        })
      })

      describe('fixFailedMessage', () => {
        let transferMessageId
        beforeEach(async () => {
          // User transfer coins
          await contract.sendTransaction({
            from: user,
            value
          }).should.be.fulfilled

          const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
          expect(events.length).to.be.equal(1)
          transferMessageId = events[0].returnValues.messageId
        })

        it('should fix locked tokens', async () => {
          // Given
          expect(await contract.messageFixed(transferMessageId)).to.be.equal(false)

          // When
          const fixData = await contract.contract.methods.fixFailedMessage(transferMessageId).encodeABI()

          // Should be called by mediator from other side so it will fail
          await ambBridgeContract.executeMessageCall(
            contract.address,
            contract.address,
            fixData,
            failedMessageId,
            1000000
          ).should.be.fulfilled

          expect(await ambBridgeContract.messageCallStatus(failedMessageId)).to.be.equal(false)
          expect(await contract.messageFixed(transferMessageId)).to.be.equal(false)

          await ambBridgeContract.executeMessageCall(
            contract.address,
            otherSideMediator.address,
            fixData,
            exampleMessageId,
            1000000
          ).should.be.fulfilled

          // Then
          expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)
          expect(await blockReward.bridgeAmount(contract.address)).to.be.bignumber.equal(value)
          expect(await blockReward.extraReceiversLength()).to.be.bignumber.equal('1')
          expect(await blockReward.extraReceiverByIndex(0)).to.be.equal(user)
          expect(await blockReward.extraReceiverAmount(user)).to.be.bignumber.equal(value)

          const { receipt } = await blockReward.reward([], []).should.be.fulfilled

          expect(await blockReward.extraReceiversLength()).to.be.bignumber.equal('0')
          expect(await blockReward.extraReceiverAmount(user)).to.be.bignumber.equal(ZERO)
          expect(await blockReward.mintedForAccountInBlock(user, receipt.blockNumber)).to.be.bignumber.equal(value)
          expect(await contract.messageFixed(transferMessageId)).to.be.equal(true)

          const event = await getEvents(contract, { event: 'FailedMessageFixed' })
          expect(event.length).to.be.equal(1)
          expect(event[0].returnValues.messageId).to.be.equal(transferMessageId)
          expect(event[0].returnValues.recipient).to.be.equal(user)
          expect(event[0].returnValues.value).to.be.equal(value.toString())

          // can only fix it one time
          await ambBridgeContract.executeMessageCall(
            contract.address,
            otherSideMediator.address,
            fixData,
            otherMessageId,
            1000000
          ).should.be.fulfilled

          expect(await ambBridgeContract.messageCallStatus(otherMessageId)).to.be.equal(false)
        })

        it('should be called by amb bridge', async () => {
          await contract.fixFailedMessage(transferMessageId, { from: owner }).should.be.rejected
        })
      })

      describe('fixFailedMessage with alternative receiver', () => {
        let transferMessageId
        beforeEach(async () => {
          // User transfer tokens
          await contract.relayTokens(user2, {
            from: user,
            value
          }).should.be.fulfilled

          const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
          expect(events.length).to.be.equal(1)
          transferMessageId = events[0].returnValues.messageId
        })

        it('should fix burnt tokens', async () => {
          // Given
          expect(await contract.messageFixed(transferMessageId)).to.be.equal(false)

          // When
          const fixData = await contract.contract.methods.fixFailedMessage(transferMessageId).encodeABI()

          await ambBridgeContract.executeMessageCall(
            contract.address,
            otherSideMediator.address,
            fixData,
            exampleMessageId,
            1000000
          ).should.be.fulfilled

          // Then
          expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)
          expect(await blockReward.bridgeAmount(contract.address)).to.be.bignumber.equal(value)
          expect(await blockReward.extraReceiversLength()).to.be.bignumber.equal('1')
          expect(await blockReward.extraReceiverByIndex(0)).to.be.equal(user)
          expect(await blockReward.extraReceiverAmount(user)).to.be.bignumber.equal(value)

          const { receipt } = await blockReward.reward([], []).should.be.fulfilled

          expect(await blockReward.extraReceiversLength()).to.be.bignumber.equal('0')
          expect(await blockReward.extraReceiverAmount(user)).to.be.bignumber.equal(ZERO)
          expect(await blockReward.mintedForAccountInBlock(user, receipt.blockNumber)).to.be.bignumber.equal(value)
          expect(await contract.messageFixed(transferMessageId)).to.be.equal(true)

          const event = await getEvents(contract, { event: 'FailedMessageFixed' })
          expect(event.length).to.be.equal(1)
          expect(event[0].returnValues.messageId).to.be.equal(transferMessageId)
          expect(event[0].returnValues.recipient).to.be.equal(user)
          expect(event[0].returnValues.value).to.be.equal(value.toString())
        })
      })
    })

    describe('handleBridgedTokens', () => {
      it('should add extra receiver tokens on message from amb', async () => {
        // can't be called by user
        await contract.handleBridgedTokens(user, value, { from: user }).should.be.rejected
        // can't be called by owner
        await contract.handleBridgedTokens(user, value, { from: owner }).should.be.rejected

        const data = await contract.contract.methods.handleBridgedTokens(user, value.toString()).encodeABI()

        // message must be generated by mediator contract on the other network
        await ambBridgeContract.executeMessageCall(contract.address, owner, data, failedMessageId, 1000000).should.be
          .fulfilled

        expect(await ambBridgeContract.messageCallStatus(failedMessageId)).to.be.equal(false)

        await ambBridgeContract.executeMessageCall(
          contract.address,
          otherSideMediator.address,
          data,
          exampleMessageId,
          1000000
        ).should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)

        // Then
        expect(await contract.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(value)
        expect(await blockReward.bridgeAmount(contract.address)).to.be.bignumber.equal(value)
        expect(await blockReward.extraReceiversLength()).to.be.bignumber.equal('1')
        expect(await blockReward.extraReceiverByIndex(0)).to.be.equal(user)
        expect(await blockReward.extraReceiverAmount(user)).to.be.bignumber.equal(value)
        expect(await blockReward.mintedTotallyByBridge(contract.address)).to.be.bignumber.equal(ZERO)

        const { receipt } = await blockReward.reward([], []).should.be.fulfilled

        expect(await blockReward.extraReceiversLength()).to.be.bignumber.equal('0')
        expect(await blockReward.extraReceiverAmount(user)).to.be.bignumber.equal(ZERO)
        expect(await blockReward.mintedTotallyByBridge(contract.address)).to.be.bignumber.equal(value)
        expect(await blockReward.mintedTotally()).to.be.bignumber.equal(value)
        expect(await blockReward.mintedForAccount(user)).to.be.bignumber.equal(value)
        expect(await blockReward.mintedInBlock(receipt.blockNumber)).to.be.bignumber.equal(value)
        expect(await blockReward.mintedForAccountInBlock(user, receipt.blockNumber)).to.be.bignumber.equal(value)

        const event = await getEvents(contract, { event: 'TokensBridged' })
        expect(event.length).to.be.equal(1)
        expect(event[0].returnValues.recipient).to.be.equal(user)
        expect(event[0].returnValues.value).to.be.equal(value.toString())
        expect(event[0].returnValues.messageId).to.be.equal(exampleMessageId)
      })

      for (const decimalShift of [2, -1]) {
        it(`should unlock tokens on message from amb with decimal shift of ${decimalShift}`, async () => {
          // Given
          contract = await HomeAMBErc20ToNative.new()
          await contract.initialize(
            ambBridgeContract.address,
            otherSideMediator.address,
            [dailyLimit, maxPerTx, minPerTx],
            [executionDailyLimit, executionMaxPerTx],
            maxGasPerTx,
            decimalShift,
            owner,
            blockReward.address
          ).should.be.fulfilled
          await blockReward.setBridgeContractAddress(contract.address)

          const valueOnForeign = toBN('1000')
          const valueOnHome = toBN(valueOnForeign * 10 ** decimalShift)

          const data = await contract.contract.methods.handleBridgedTokens(user, valueOnForeign.toString()).encodeABI()

          await ambBridgeContract.executeMessageCall(
            contract.address,
            otherSideMediator.address,
            data,
            exampleMessageId,
            1000000
          ).should.be.fulfilled

          expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)

          // Then
          expect(await contract.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(valueOnForeign)

          const event = await getEvents(contract, { event: 'TokensBridged' })
          expect(event.length).to.be.equal(1)
          expect(event[0].returnValues.recipient).to.be.equal(user)
          expect(event[0].returnValues.value).to.be.equal(valueOnHome.toString())
          expect(event[0].returnValues.messageId).to.be.equal(exampleMessageId)
        })
      }

      it('should revert when out of execution limits on message from amb', async () => {
        // Given
        const outOfLimitValueData = await contract.contract.methods
          .handleBridgedTokens(user, twoEthers.toString())
          .encodeABI()

        // when
        await ambBridgeContract.executeMessageCall(
          contract.address,
          otherSideMediator.address,
          outOfLimitValueData,
          failedMessageId,
          1000000
        ).should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(failedMessageId)).to.be.equal(false)

        // Then
        expect(await contract.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(ZERO)
      })
    })

    describe('requestFailedMessageFix', () => {
      it('should allow to request a failed message fix', async () => {
        // Given
        const data = await contract.contract.methods.handleBridgedTokens(user, value.toString()).encodeABI()

        await ambBridgeContract.executeMessageCall(
          contract.address,
          otherSideMediator.address,
          data,
          failedMessageId,
          100
        ).should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(failedMessageId)).to.be.equal(false)

        // When
        await contract.requestFailedMessageFix(failedMessageId).should.be.fulfilled

        // Then
        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        expect(events[0].returnValues.encodedData.includes(strip0x(failedMessageId))).to.be.equal(true)
      })

      it('should be a failed transaction', async () => {
        // Given
        const data = await contract.contract.methods.handleBridgedTokens(user, value.toString()).encodeABI()

        await ambBridgeContract.executeMessageCall(
          contract.address,
          otherSideMediator.address,
          data,
          exampleMessageId,
          1000000
        ).should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)

        // When
        await contract.requestFailedMessageFix(exampleMessageId).should.be.rejected
      })

      it('should be the receiver of the failed transaction', async () => {
        // Given
        const data = await contract.contract.methods.handleBridgedTokens(user, value.toString()).encodeABI()

        await ambBridgeContract.executeMessageCall(
          ambBridgeContract.address,
          otherSideMediator.address,
          data,
          failedMessageId,
          100
        ).should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(failedMessageId)).to.be.equal(false)

        // When
        await contract.requestFailedMessageFix(failedMessageId).should.be.rejected
      })

      it('message sender should be mediator from other side', async () => {
        // Given
        const data = await contract.contract.methods.handleBridgedTokens(user, value.toString()).encodeABI()

        await ambBridgeContract.executeMessageCall(contract.address, contract.address, data, failedMessageId, 100)
          .should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(failedMessageId)).to.be.equal(false)

        // When
        await contract.requestFailedMessageFix(failedMessageId).should.be.rejected
      })

      it('should allow to request a fix multiple times', async () => {
        // Given
        const data = await contract.contract.methods.handleBridgedTokens(user, value.toString()).encodeABI()

        await ambBridgeContract.executeMessageCall(
          contract.address,
          otherSideMediator.address,
          data,
          failedMessageId,
          100
        ).should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(failedMessageId)).to.be.equal(false)

        await contract.requestFailedMessageFix(failedMessageId).should.be.fulfilled

        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        expect(events[0].returnValues.encodedData.includes(strip0x(failedMessageId))).to.be.equal(true)

        // When
        await contract.requestFailedMessageFix(failedMessageId).should.be.fulfilled

        // Then
        const allEvents = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(allEvents.length).to.be.equal(2)
        expect(allEvents[0].returnValues.encodedData.includes(strip0x(failedMessageId))).to.be.equal(true)
        expect(allEvents[1].returnValues.encodedData.includes(strip0x(failedMessageId))).to.be.equal(true)
      })
    })

    describe('fixMediatorBalance', () => {
      beforeEach(async () => {
        const storageProxy = await EternalStorageProxy.new()
        await storageProxy.upgradeTo('1', contract.address).should.be.fulfilled
        contract = await HomeAMBErc20ToNative.at(storageProxy.address)

        await contract.initialize(
          ambBridgeContract.address,
          otherSideMediator.address,
          [ether('5'), maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          owner,
          blockReward.address
        ).should.be.fulfilled

        await blockReward.setBridgeContractAddress(contract.address).should.be.fulfilled

        const data = await contract.contract.methods.handleBridgedTokens(user, value.toString()).encodeABI()

        await ambBridgeContract.executeMessageCall(
          contract.address,
          otherSideMediator.address,
          data,
          exampleMessageId,
          1000000
        ).should.be.fulfilled

        expect(await contract.totalBurntCoins()).to.be.bignumber.equal(ZERO)
      })
      it('should fix mediator imbalance', async () => {
        // force some native tokens to the contract without calling the fallback method
        await Sacrifice.new(contract.address, { value: ether('0.1') }).catch(() => {})
        expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(ether('0.1'))
        expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

        // When
        // only owner can call the method
        await contract.fixMediatorBalance(user, { from: user }).should.be.rejected

        await contract.fixMediatorBalance(ZERO_ADDRESS, { from: owner }).should.be.rejected

        await contract.fixMediatorBalance(user, { from: owner }).should.be.fulfilled

        expect(await contract.totalBurntCoins()).to.be.bignumber.equal(ether('0.1'))

        // imbalance was already fixed
        await contract.fixMediatorBalance(user, { from: owner }).should.be.rejected

        // Then
        expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(ZERO)
        expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ether('0.1'))

        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        // Include user address
        expect(events[0].returnValues.encodedData.includes(strip0x(user).toLowerCase())).to.be.equal(true)
        // Include mediator address
        expect(
          events[0].returnValues.encodedData.includes(strip0x(otherSideMediator.address).toLowerCase())
        ).to.be.equal(true)
        // Include handleBridgedTokens method selector
        expect(events[0].returnValues.encodedData.includes('8b6c0354')).to.be.equal(true)
      })

      it('should fix mediator imbalance with respect to limits', async () => {
        // force some native tokens to the contract without calling the fallback method
        await Sacrifice.new(contract.address, { value: oneEther }).catch(() => {})
        expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(oneEther)
        expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

        await contract.setMinPerTx('1').should.be.fulfilled
        await contract.setMaxPerTx(ether('0.5')).should.be.fulfilled

        // When
        // only owner can call the method
        await contract.fixMediatorBalance(user, { from: user }).should.be.rejected

        await contract.fixMediatorBalance(user, { from: owner }).should.be.fulfilled

        expect(await contract.totalBurntCoins()).to.be.bignumber.equal(ether('0.5'))

        await contract.setDailyLimit(ether('0.75')).should.be.fulfilled

        await contract.fixMediatorBalance(user, { from: owner }).should.be.fulfilled

        expect(await contract.totalBurntCoins()).to.be.bignumber.equal(ether('0.75'))

        // daily limit quota reached
        await contract.fixMediatorBalance(user, { from: owner }).should.be.rejected

        await contract.setDailyLimit(ether('0.6')).should.be.fulfilled

        // daily limit quota reached
        await contract.fixMediatorBalance(user, { from: owner }).should.be.rejected

        // Then
        expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(ether('0.25'))
        expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ether('0.75'))

        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(2)
        // Include user address
        expect(events[0].returnValues.encodedData.includes(strip0x(user).toLowerCase())).to.be.equal(true)
        // Include mediator address
        expect(
          events[0].returnValues.encodedData.includes(strip0x(otherSideMediator.address).toLowerCase())
        ).to.be.equal(true)
        // Include handleBridgedTokens method selector
        expect(events[0].returnValues.encodedData.includes('8b6c0354')).to.be.equal(true)
      })
    })
  })

  describe('fee management', () => {
    const value = oneEther
    let currentDay

    beforeEach(async () => {
      await contract.rewardableInitialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        blockReward.address,
        [owner],
        [ether('0.01'), ether('0.02')]
      ).should.be.fulfilled
      await blockReward.setBridgeContractAddress(contract.address).should.be.fulfilled

      currentDay = await contract.getCurrentDay()
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)
      const initialEvents = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(initialEvents.length).to.be.equal(0)
    })

    it('change reward addresses', async () => {
      await contract.addRewardAddress(accounts[8], { from: user }).should.be.rejected
      await contract.addRewardAddress(owner).should.be.rejected
      await contract.addRewardAddress(accounts[8]).should.be.fulfilled

      expect(await contract.rewardAddressList()).to.be.eql([accounts[8], owner])
      expect(await contract.rewardAddressCount()).to.be.bignumber.equal('2')
      expect(await contract.isRewardAddress(owner)).to.be.equal(true)
      expect(await contract.isRewardAddress(accounts[8])).to.be.equal(true)

      await contract.addRewardAddress(accounts[9]).should.be.fulfilled
      expect(await contract.rewardAddressList()).to.be.eql([accounts[9], accounts[8], owner])
      expect(await contract.rewardAddressCount()).to.be.bignumber.equal('3')

      await contract.removeRewardAddress(owner, { from: user }).should.be.rejected
      await contract.removeRewardAddress(accounts[7]).should.be.rejected
      await contract.removeRewardAddress(accounts[8]).should.be.fulfilled
      await contract.removeRewardAddress(accounts[8]).should.be.rejected

      expect(await contract.rewardAddressList()).to.be.eql([accounts[9], owner])
      expect(await contract.rewardAddressCount()).to.be.bignumber.equal('2')
      expect(await contract.isRewardAddress(accounts[8])).to.be.equal(false)

      await contract.removeRewardAddress(owner).should.be.fulfilled
      expect(await contract.rewardAddressList()).to.be.eql([accounts[9]])
      expect(await contract.rewardAddressCount()).to.be.bignumber.equal('1')
      expect(await contract.isRewardAddress(owner)).to.be.equal(false)

      await contract.removeRewardAddress(accounts[9]).should.be.fulfilled
      expect(await contract.rewardAddressList()).to.be.eql([])
      expect(await contract.rewardAddressCount()).to.be.bignumber.equal('0')
      expect(await contract.isRewardAddress(accounts[9])).to.be.equal(false)
    })

    describe('update fee parameters', () => {
      it('should update fee value', async () => {
        const feeType = await contract.HOME_TO_FOREIGN_FEE()
        await contract.setFee(feeType, ether('0.1'), { from: user }).should.be.rejected
        await contract.setFee(feeType, ether('1.1'), { from: owner }).should.be.rejected
        const { logs } = await contract.setFee(feeType, ether('0.1'), { from: owner }).should.be.fulfilled

        expectEventInLogs(logs, 'FeeUpdated')
        expect(await contract.getFee(feeType)).to.be.bignumber.equal(ether('0.1'))
        expect(await contract.getFee(await contract.FOREIGN_TO_HOME_FEE())).to.be.bignumber.equal(ether('0.02'))
      })

      it('should update opposite direction fee value', async () => {
        const feeType = await contract.FOREIGN_TO_HOME_FEE()

        await contract.setFee(feeType, ether('0.1'), { from: user }).should.be.rejected
        await contract.setFee(feeType, ether('1.1'), { from: owner }).should.be.rejected
        const { logs } = await contract.setFee(feeType, ether('0.1'), { from: owner }).should.be.fulfilled

        expectEventInLogs(logs, 'FeeUpdated')
        expect(await contract.getFee(feeType)).to.be.bignumber.equal(ether('0.1'))
        expect(await contract.getFee(await contract.HOME_TO_FOREIGN_FEE())).to.be.bignumber.equal(ether('0.01'))
      })
    })

    describe('distribute fee for foreign => home direction', async () => {
      it('should collect and distribute 0% fee', async () => {
        await contract.setFee(await contract.FOREIGN_TO_HOME_FEE(), ZERO).should.be.fulfilled

        const data = await contract.contract.methods.handleBridgedTokens(user, value.toString()).encodeABI()

        await ambBridgeContract.executeMessageCall(
          contract.address,
          otherSideMediator.address,
          data,
          exampleMessageId,
          1000000
        ).should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)
        expect(await contract.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(value)
        expect(await blockReward.extraReceiversLength()).to.be.bignumber.equal('1')
        expect(await blockReward.extraReceiverByIndex(0)).to.be.equal(user)
        expect(await blockReward.extraReceiverAmount(user)).to.be.bignumber.equal(value)
        expect(await contract.totalBurntCoins()).to.be.bignumber.equal(ZERO)

        const event = await getEvents(contract, { event: 'TokensBridged' })
        expect(event.length).to.be.equal(1)
        expect(event[0].returnValues.recipient).to.be.equal(user)
        expect(event[0].returnValues.value).to.be.equal(value.toString())
        expect(event[0].returnValues.messageId).to.be.equal(exampleMessageId)

        const feeEvents = await getEvents(contract, { event: 'FeeDistributed' })
        expect(feeEvents.length).to.be.equal(0)
      })

      it('should collect and distribute 2% fee', async () => {
        const data = await contract.contract.methods.handleBridgedTokens(user, value.toString()).encodeABI()

        await ambBridgeContract.executeMessageCall(
          contract.address,
          otherSideMediator.address,
          data,
          exampleMessageId,
          1000000
        ).should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)
        expect(await contract.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(value)
        expect(await blockReward.extraReceiversLength()).to.be.bignumber.equal('2')
        expect(await blockReward.extraReceiverByIndex(1)).to.be.equal(user)
        expect(await blockReward.extraReceiverByIndex(0)).to.be.equal(owner)
        expect(await blockReward.extraReceiverAmount(user)).to.be.bignumber.equal(ether('0.98'))
        expect(await blockReward.extraReceiverAmount(owner)).to.be.bignumber.equal(ether('0.02'))
        expect(await blockReward.mintedTotallyByBridge(contract.address)).to.be.bignumber.equal(ZERO)

        const { receipt } = await blockReward.reward([], []).should.be.fulfilled

        expect(await blockReward.extraReceiversLength()).to.be.bignumber.equal('0')
        expect(await blockReward.extraReceiverAmount(user)).to.be.bignumber.equal(ZERO)
        expect(await blockReward.mintedTotallyByBridge(contract.address)).to.be.bignumber.equal(value)
        expect(await blockReward.mintedTotally()).to.be.bignumber.equal(value)
        expect(await blockReward.mintedForAccount(user)).to.be.bignumber.equal(ether('0.98'))
        expect(await blockReward.mintedInBlock(receipt.blockNumber)).to.be.bignumber.equal(value)
        expect(await blockReward.mintedForAccountInBlock(user, receipt.blockNumber)).to.be.bignumber.equal(
          ether('0.98')
        )
        expect(await contract.totalBurntCoins()).to.be.bignumber.equal(ZERO)

        const event = await getEvents(contract, { event: 'TokensBridged' })
        expect(event.length).to.be.equal(1)
        expect(event[0].returnValues.recipient).to.be.equal(user)
        expect(event[0].returnValues.value).to.be.equal(ether('0.98').toString())
        expect(event[0].returnValues.messageId).to.be.equal(exampleMessageId)

        const feeEvents = await getEvents(contract, { event: 'FeeDistributed' })
        expect(feeEvents.length).to.be.equal(1)
      })

      it('should collect and distribute 2% fee between two reward addresses', async () => {
        await contract.addRewardAddress(accounts[9]).should.be.fulfilled
        expect(await contract.rewardAddressCount()).to.be.bignumber.equal('2')

        const data = await contract.contract.methods
          .handleBridgedTokens(user, ether('0.100000000000000100').toString(10))
          .encodeABI()

        await ambBridgeContract.executeMessageCall(
          contract.address,
          otherSideMediator.address,
          data,
          exampleMessageId,
          1000000
        ).should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)
        expect(await contract.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(ether('0.100000000000000100'))
        expect(await blockReward.extraReceiversLength()).to.be.bignumber.equal('3')
        expect(await blockReward.extraReceiverByIndex(0)).to.be.equal(accounts[9])
        expect(await blockReward.extraReceiverByIndex(1)).to.be.equal(owner)
        expect(await blockReward.extraReceiverByIndex(2)).to.be.equal(user)
        const amount1 = await blockReward.extraReceiverAmount(owner)
        const amount2 = await blockReward.extraReceiverAmount(accounts[9])
        expect(amount1.eq(ether('0.001')) || amount1.eq(ether('0.001000000000000001'))).to.be.equal(true)
        expect(amount2.eq(ether('0.001')) || amount2.eq(ether('0.001000000000000001'))).to.be.equal(true)
        expect(await blockReward.mintedTotallyByBridge(contract.address)).to.be.bignumber.equal(ZERO)

        await blockReward.reward([], []).should.be.fulfilled

        const event = await getEvents(contract, { event: 'TokensBridged' })
        expect(event.length).to.be.equal(1)

        const feeEvents = await getEvents(contract, { event: 'FeeDistributed' })
        expect(feeEvents.length).to.be.equal(1)
      })
    })

    describe('distribute fee for home => foreign direction', async () => {
      beforeEach(async () => {
        await contract.setFee(await contract.FOREIGN_TO_HOME_FEE(), ZERO).should.be.fulfilled

        const data = await contract.contract.methods.handleBridgedTokens(user, value.toString()).encodeABI()

        await ambBridgeContract.executeMessageCall(
          contract.address,
          otherSideMediator.address,
          data,
          exampleMessageId,
          1000000
        ).should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)
        await blockReward.reward([], []).should.be.fulfilled
      })

      it('should collect and distribute 0% fee', async () => {
        await contract.setFee(await contract.HOME_TO_FOREIGN_FEE(), ZERO).should.be.fulfilled

        const initialRewardBalance = toBN(await web3.eth.getBalance(owner))

        await contract.sendTransaction({
          from: user,
          value
        })

        expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(value)

        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })

        expect(events[0].returnValues.encodedData.includes('8b6c0354')).to.be.equal(true)
        expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(ZERO)
        expect(toBN(await web3.eth.getBalance(owner))).to.be.bignumber.equal(initialRewardBalance)
        expect(await contract.totalBurntCoins()).to.be.bignumber.equal(value)

        const feeEvents = await getEvents(contract, { event: 'FeeDistributed' })
        expect(feeEvents.length).to.be.equal(0)
      })

      it('should collect and distribute 1% fee', async () => {
        const initialRewardBalance = toBN(await web3.eth.getBalance(owner))

        await contract.sendTransaction({
          from: user,
          value
        })

        expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(value)

        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })

        expect(events[0].returnValues.encodedData.includes('8b6c0354')).to.be.equal(true)
        expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(ZERO)
        expect(toBN(await web3.eth.getBalance(owner))).to.be.bignumber.equal(initialRewardBalance.add(ether('0.01')))
        expect(await contract.totalBurntCoins()).to.be.bignumber.equal(ether('0.99'))

        const feeEvents = await getEvents(contract, { event: 'FeeDistributed' })
        expect(feeEvents.length).to.be.equal(1)
      })

      it('should collect and distribute 1% fee between two reward addresses', async () => {
        await contract.addRewardAddress(accounts[9]).should.be.fulfilled
        expect(await contract.rewardAddressCount()).to.be.bignumber.equal('2')

        const initialBalance1 = toBN(await web3.eth.getBalance(owner))
        const initialBalance2 = toBN(await web3.eth.getBalance(accounts[9]))

        await contract.sendTransaction({
          from: user,
          value: ether('0.200000000000000100')
        })

        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })

        expect(events[0].returnValues.encodedData.includes('8b6c0354')).to.be.equal(true)
        expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(ZERO)

        const balance1 = toBN(await web3.eth.getBalance(owner))
        const balance2 = toBN(await web3.eth.getBalance(accounts[9]))
        expect(
          balance1.eq(initialBalance1.add(ether('0.001'))) ||
            balance1.eq(initialBalance1.add(ether('0.001000000000000001')))
        ).to.be.equal(true)
        expect(
          balance2.eq(initialBalance2.add(ether('0.001'))) ||
            balance2.eq(initialBalance2.add(ether('0.001000000000000001')))
        ).to.be.equal(true)

        const feeEvents = await getEvents(contract, { event: 'FeeDistributed' })
        expect(feeEvents.length).to.be.equal(1)
      })
    })
  })
})
