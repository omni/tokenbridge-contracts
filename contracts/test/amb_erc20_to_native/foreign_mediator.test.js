const HomeAMBErc20ToNative = artifacts.require('HomeAMBErc20ToNative.sol')
const ForeignAMBErc20ToNative = artifacts.require('ForeignAMBErc20ToNative.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const AMBMock = artifacts.require('AMBMock.sol')
const Sacrifice = artifacts.require('Sacrifice.sol')

const { expect } = require('chai')
const { getEvents, expectEventInLogs, ether, strip0x } = require('../helpers/helpers')
const { ZERO_ADDRESS, toBN } = require('../setup')

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
const exampleMessageId = '0xf308b922ab9f8a7128d9d7bc9bce22cd88b2c05c8213f0e2d8104d78e0a9ecbb'
const otherMessageId = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
const failedMessageId = '0x2ebc2ccc755acc8eaf9252e19573af708d644ab63a39619adb080a3500a4ff2e'

contract('ForeignAMBErc20ToNative', async accounts => {
  let contract
  let token
  let ambBridgeContract
  let otherSideMediator
  const owner = accounts[0]
  const user = accounts[1]
  const user2 = accounts[2]
  beforeEach(async () => {
    contract = await ForeignAMBErc20ToNative.new()
    ambBridgeContract = await AMBMock.new()
    await ambBridgeContract.setMaxGasPerTx(maxGasPerTx)
    otherSideMediator = await HomeAMBErc20ToNative.new()
    token = await ERC677BridgeToken.new('TEST', 'TST', 18)
    await token.setBridgeContract(contract.address)
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
      expect(await contract.erc20token()).to.be.equal(ZERO_ADDRESS)

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
        token.address
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
        token.address
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
        token.address
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
        token.address
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
        token.address
      ).should.be.rejected

      // invalid address
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

      // not valid owner
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        ZERO_ADDRESS,
        token.address
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
        token.address
      ).should.be.rejected

      const { logs } = await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        token.address
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
        token.address
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
      expect(await contract.erc20token()).to.be.equal(token.address)

      expectEventInLogs(logs, 'ExecutionDailyLimitChanged', { newLimit: executionDailyLimit })
      expectEventInLogs(logs, 'DailyLimitChanged', { newLimit: dailyLimit })
    })
  })

  describe('getBridgeMode', () => {
    it('should return mediator mode and interface', async function() {
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
      contract = await ForeignAMBErc20ToNative.at(storageProxy.address)
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        token.address
      ).should.be.fulfilled
    })

    it('should work with token different from bridged token', async () => {
      await token.mint(user, oneEther).should.be.fulfilled
      expect(await token.balanceOf(user)).to.be.bignumber.equal(oneEther)

      await token.transfer(contract.address, oneEther, { from: user }).should.be.fulfilled
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(oneEther)

      await contract.claimTokens(token.address, accounts[3], { from: owner }).should.be.rejected

      token = await ERC677BridgeToken.new('Test', 'TST', 18)

      await token.mint(user, oneEther).should.be.fulfilled
      expect(await token.balanceOf(user)).to.be.bignumber.equal(oneEther)

      await token.transfer(contract.address, oneEther, { from: user }).should.be.fulfilled
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(oneEther)

      await contract.claimTokens(token.address, accounts[3], { from: owner }).should.be.fulfilled
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(accounts[3])).to.be.bignumber.equal(oneEther)
    })

    it('should also work for native coins', async () => {
      // Contract doesn't have a fallback method to accept native tokens so it transfers using a self destruct contract
      await Sacrifice.new(contract.address, { value: oneEther }).catch(() => {})
      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(oneEther)
      const balanceBefore = toBN(await web3.eth.getBalance(accounts[3]))

      await contract.claimTokens(ZERO_ADDRESS, accounts[3], { from: owner }).should.be.fulfilled

      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(ZERO)
      expect(toBN(await web3.eth.getBalance(accounts[3]))).to.be.bignumber.equal(balanceBefore.add(oneEther))
    })
  })

  describe('afterInitialization', () => {
    const value = oneEther
    let currentDay
    beforeEach(async () => {
      await token.mint(user, twoEthers, { from: owner }).should.be.fulfilled

      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        token.address
      ).should.be.fulfilled

      currentDay = await contract.getCurrentDay()
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)
      const initialEvents = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(initialEvents.length).to.be.equal(0)
    })

    describe('onTokenTransfer', () => {
      afterEach(async () => {
        // Total supply remains the same
        expect(await token.totalSupply()).to.be.bignumber.equal(twoEthers)
      })

      it('should call AMB bridge and burnt tokens', async () => {
        // only token address can call it
        await contract.onTokenTransfer(user, halfEther, '0x', { from: owner }).should.be.rejected

        // must be within limits
        await token.transferAndCall(contract.address, twoEthers, '0x', { from: user }).should.be.rejected

        // When
        await token.transferAndCall(contract.address, halfEther, '0x', { from: user }).should.be.fulfilled

        // Then
        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        expect(events[0].returnValues.encodedData.includes(strip0x(user).toLowerCase())).to.be.equal(true)
        expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(halfEther)
        expect(await contract.mediatorBalance()).to.be.bignumber.equal(halfEther)
      })

      it('should be able to specify a different receiver', async () => {
        // must be a valid address param
        await token.transferAndCall(contract.address, halfEther, '0x00', { from: user }).should.be.rejected

        // When
        await token.transferAndCall(contract.address, halfEther, user2, { from: user }).should.be.fulfilled

        // Then
        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        expect(events[0].returnValues.encodedData.includes(strip0x(user2).toLowerCase())).to.be.equal(true)
        expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(halfEther)
        expect(await contract.mediatorBalance()).to.be.bignumber.equal(halfEther)
      })
    })
    describe('relayTokens', () => {
      afterEach(async () => {
        // Total supply remains the same
        expect(await token.totalSupply()).to.be.bignumber.equal(twoEthers)
      })

      it('should allow to bridge tokens using approve and transferFrom', async () => {
        // Given
        await token.approve(contract.address, value, { from: user }).should.be.fulfilled
        expect(await token.allowance(user, contract.address)).to.be.bignumber.equal(value)

        // When
        await contract.relayTokens(user, value, { from: user }).should.be.fulfilled

        // Then
        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(value)
      })

      it('should allow to specify a different receiver without specifying sender', async () => {
        // Given
        await token.approve(contract.address, value, { from: user }).should.be.fulfilled
        expect(await token.allowance(user, contract.address)).to.be.bignumber.equal(value)

        // When
        await contract.relayTokens(user2, value, { from: user }).should.be.fulfilled

        // Then
        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        expect(events[0].returnValues.encodedData.includes(strip0x(user2).toLowerCase())).to.be.equal(true)
        expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(value)
      })

      it('should fail if user did not approve the transfer', async () => {
        await contract.relayTokens(user, value, { from: user }).should.be.rejected
      })

      it('should fail if value is not within limits', async () => {
        await token.approve(contract.address, twoEthers, { from: user }).should.be.fulfilled
        expect(await token.allowance(user, contract.address)).to.be.bignumber.equal(twoEthers)

        await contract.relayTokens(user, twoEthers, { from: user }).should.be.rejected
      })
    })

    describe('handleBridgedTokens', () => {
      it('should unlock tokens on message from amb', async () => {
        await token.transfer(contract.address, value, { from: user }).should.be.fulfilled
        await token.transfer(contract.address, value, { from: user }).should.be.fulfilled
        expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(twoEthers)
        expect(await contract.mediatorBalance()).to.be.bignumber.equal(twoEthers)

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
        expect(await contract.mediatorBalance()).to.be.bignumber.equal(value)
        expect(await token.balanceOf(user)).to.be.bignumber.equal(value)
        expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(value)

        const event = await getEvents(contract, { event: 'TokensBridged' })
        expect(event.length).to.be.equal(1)
        expect(event[0].returnValues.recipient).to.be.equal(user)
        expect(event[0].returnValues.value).to.be.equal(value.toString())
        expect(event[0].returnValues.messageId).to.be.equal(exampleMessageId)
      })

      for (const decimalShift of [2, -1]) {
        it(`should unlock tokens on message from amb with decimal shift of ${decimalShift}`, async () => {
          // Given

          contract = await ForeignAMBErc20ToNative.new()
          await contract.initialize(
            ambBridgeContract.address,
            otherSideMediator.address,
            [dailyLimit, maxPerTx, minPerTx],
            [executionDailyLimit, executionMaxPerTx],
            maxGasPerTx,
            decimalShift,
            owner,
            token.address
          ).should.be.fulfilled
          await token.transfer(contract.address, value, { from: user }).should.be.fulfilled
          await token.transfer(contract.address, value, { from: user }).should.be.fulfilled
          expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(twoEthers)
          expect(await contract.mediatorBalance()).to.be.bignumber.equal(twoEthers)

          const valueOnForeign = toBN('1000')
          const valueOnHome = toBN(valueOnForeign * 10 ** decimalShift)

          const data = await contract.contract.methods.handleBridgedTokens(user, valueOnHome.toString()).encodeABI()

          await ambBridgeContract.executeMessageCall(
            contract.address,
            otherSideMediator.address,
            data,
            exampleMessageId,
            1000000
          ).should.be.fulfilled

          expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)

          // Then
          expect(await contract.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(valueOnHome)
          expect(await token.balanceOf(user)).to.be.bignumber.equal(valueOnForeign)
          expect(await contract.mediatorBalance()).to.be.bignumber.equal(twoEthers.sub(valueOnForeign))

          const event = await getEvents(contract, { event: 'TokensBridged' })
          expect(event.length).to.be.equal(1)
          expect(event[0].returnValues.recipient).to.be.equal(user)
          expect(event[0].returnValues.value).to.be.equal(valueOnForeign.toString())
          expect(event[0].returnValues.messageId).to.be.equal(exampleMessageId)
        })

        it('should revert when out of execution limits on message from amb', async () => {
          await token.transfer(contract.address, value, { from: user }).should.be.fulfilled
          await token.transfer(contract.address, value, { from: user }).should.be.fulfilled
          expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(twoEthers)
          expect(await contract.mediatorBalance()).to.be.bignumber.equal(twoEthers)

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
          expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
        })
      }
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
        await token.transfer(contract.address, value, { from: user }).should.be.fulfilled
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

    describe('fixFailedMessage', () => {
      let transferMessageId
      beforeEach(async function() {
        // User transfer tokens
        await token.transferAndCall(contract.address, value, '0x', { from: user }).should.be.fulfilled
        expect(await contract.mediatorBalance()).to.be.bignumber.equal(value)

        expect(await token.balanceOf(user)).to.be.bignumber.equal(value)

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
        expect(await token.balanceOf(user)).to.be.bignumber.equal(twoEthers)
        expect(await contract.mediatorBalance()).to.be.bignumber.equal(ZERO)
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
        expect(await token.balanceOf(user)).to.be.bignumber.equal(twoEthers)
        expect(await contract.mediatorBalance()).to.be.bignumber.equal(ZERO)
      })

      it('should be called by amb bridge', async () => {
        await contract.fixFailedMessage(transferMessageId, { from: owner }).should.be.rejected
      })
    })

    describe('fixFailedMessage with alternative receiver', () => {
      let transferMessageId
      beforeEach(async function() {
        // User transfer tokens
        await token.transferAndCall(contract.address, value, user2, { from: user }).should.be.fulfilled
        expect(await contract.mediatorBalance()).to.be.bignumber.equal(value)

        expect(await token.balanceOf(user)).to.be.bignumber.equal(value)

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
        expect(await token.balanceOf(user)).to.be.bignumber.equal(twoEthers)
        expect(await contract.mediatorBalance()).to.be.bignumber.equal(ZERO)
        expect(await contract.messageFixed(transferMessageId)).to.be.equal(true)

        const event = await getEvents(contract, { event: 'FailedMessageFixed' })
        expect(event.length).to.be.equal(1)
        expect(event[0].returnValues.messageId).to.be.equal(transferMessageId)
        expect(event[0].returnValues.recipient).to.be.equal(user)
        expect(event[0].returnValues.value).to.be.equal(value.toString())
      })
    })
  })
  describe('fixMediatorBalance', () => {
    let currentDay
    beforeEach(async () => {
      const storageProxy = await EternalStorageProxy.new()
      await storageProxy.upgradeTo('1', contract.address).should.be.fulfilled
      contract = await ForeignAMBErc20ToNative.at(storageProxy.address)

      await token.mint(user, twoEthers, { from: owner }).should.be.fulfilled
      await token.mint(contract.address, twoEthers, { from: owner }).should.be.fulfilled

      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        token.address
      ).should.be.fulfilled

      currentDay = await contract.getCurrentDay()
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)
      const initialEvents = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(initialEvents.length).to.be.equal(0)
    })

    it('should allow to fix extra mediator balance', async () => {
      expect(await contract.mediatorBalance()).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(twoEthers)

      await token.transferAndCall(contract.address, halfEther, '0x', { from: user }).should.be.fulfilled
      await contract.setDailyLimit(ether('3')).should.be.fulfilled
      await contract.setMaxPerTx(twoEthers).should.be.fulfilled

      expect(await contract.mediatorBalance()).to.be.bignumber.equal(halfEther)
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(twoEthers.add(halfEther))
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(halfEther)
      let events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)

      await contract.fixMediatorBalance(owner, { from: user }).should.be.rejected
      await contract.fixMediatorBalance(owner, { from: owner }).should.be.fulfilled
      await contract.fixMediatorBalance(owner, { from: owner }).should.be.rejected

      expect(await contract.mediatorBalance()).to.be.bignumber.equal(twoEthers.add(halfEther))
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(twoEthers.add(halfEther))

      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(twoEthers.add(halfEther))
      events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(2)
    })

    it('should allow to fix extra mediator balance with respect to limits', async () => {
      expect(await contract.mediatorBalance()).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(twoEthers)

      await token.transferAndCall(contract.address, halfEther, '0x', { from: user }).should.be.fulfilled
      await contract.setMinPerTx('1').should.be.fulfilled
      await contract.setMaxPerTx(halfEther).should.be.fulfilled
      await contract.setDailyLimit(ether('1.25')).should.be.fulfilled

      expect(await contract.mediatorBalance()).to.be.bignumber.equal(halfEther)
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(twoEthers.add(halfEther))
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(halfEther)
      let events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)

      await contract.fixMediatorBalance(owner, { from: user }).should.be.rejected
      // should fix 0.5 ether
      await contract.fixMediatorBalance(owner, { from: owner }).should.be.fulfilled

      expect(await contract.mediatorBalance()).to.be.bignumber.equal(oneEther)
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(oneEther)

      // should fix 0.25 ether
      await contract.fixMediatorBalance(owner, { from: owner }).should.be.fulfilled
      // no remaining daily quota
      await contract.fixMediatorBalance(owner, { from: owner }).should.be.rejected

      await contract.setDailyLimit(oneEther).should.be.fulfilled

      // no remaining daily quota
      await contract.fixMediatorBalance(owner, { from: owner }).should.be.rejected

      expect(await contract.mediatorBalance()).to.be.bignumber.equal(ether('1.25'))
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ether('1.25'))

      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(twoEthers.add(halfEther))
      events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(3)
    })
  })
})
