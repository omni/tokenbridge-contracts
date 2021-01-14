const HomeAMBNativeToErc20 = artifacts.require('HomeAMBNativeToErc20.sol')
const ForeignAMBNativeToErc20 = artifacts.require('ForeignAMBNativeToErc20.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const NoReturnTransferTokenMock = artifacts.require('NoReturnTransferTokenMock.sol')
const HomeFeeManagerAMBNativeToErc20 = artifacts.require('HomeFeeManagerAMBNativeToErc20.sol')
const AMBMock = artifacts.require('AMBMock.sol')
const Sacrifice = artifacts.require('Sacrifice.sol')

const { expect } = require('chai')
const { getEvents, expectEventInLogs, ether, strip0x, createAccounts } = require('../helpers/helpers')
const { ZERO_ADDRESS, ERROR_MSG, toBN } = require('../setup')

const ZERO = toBN(0)
const halfEther = ether('0.5')
const oneEther = ether('1')
const twoEthers = ether('2')
const threeEthers = ether('3')
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
// 0.1% fee
const fee = ether('0.001')

contract('HomeAMBNativeToErc20', async accounts => {
  let contract
  let ambBridgeContract
  let otherSideMediatorContract
  const owner = accounts[0]
  const user = accounts[1]
  const user2 = accounts[2]
  const rewardAccount = accounts[3]
  const rewardAccount2 = accounts[4]
  const rewardAccount3 = accounts[5]
  const rewardAccountList = [rewardAccount, rewardAccount2, rewardAccount3]
  beforeEach(async () => {
    contract = await HomeAMBNativeToErc20.new()
    ambBridgeContract = await AMBMock.new()
    await ambBridgeContract.setMaxGasPerTx(maxGasPerTx)
    otherSideMediatorContract = await ForeignAMBNativeToErc20.new()
  })
  describe('initialize', () => {
    let feeManager
    beforeEach(async () => {
      feeManager = await HomeFeeManagerAMBNativeToErc20.new(owner, fee, rewardAccountList, contract.address)
    })
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
      expect(await contract.feeManagerContract()).to.be.equal(ZERO_ADDRESS)

      // When
      // not valid bridge address
      await contract
        .initialize(
          ZERO_ADDRESS,
          otherSideMediatorContract.address,
          [dailyLimit, maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          owner,
          feeManager.address
        )
        .should.be.rejectedWith(ERROR_MSG)

      // dailyLimit > maxPerTx
      await contract
        .initialize(
          ambBridgeContract.address,
          otherSideMediatorContract.address,
          [maxPerTx, maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          owner,
          feeManager.address
        )
        .should.be.rejectedWith(ERROR_MSG)

      // maxPerTx > minPerTx
      await contract
        .initialize(
          ambBridgeContract.address,
          otherSideMediatorContract.address,
          [dailyLimit, minPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          owner,
          feeManager.address
        )
        .should.be.rejectedWith(ERROR_MSG)

      // executionDailyLimit > executionMaxPerTx
      await contract
        .initialize(
          ambBridgeContract.address,
          otherSideMediatorContract.address,
          [dailyLimit, maxPerTx, minPerTx],
          [executionDailyLimit, executionDailyLimit],
          maxGasPerTx,
          decimalShiftZero,
          owner,
          feeManager.address
        )
        .should.be.rejectedWith(ERROR_MSG)

      // maxGasPerTx > bridge maxGasPerTx
      await contract
        .initialize(
          ambBridgeContract.address,
          otherSideMediatorContract.address,
          [dailyLimit, maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          twoEthers,
          decimalShiftZero,
          owner,
          feeManager.address
        )
        .should.be.rejectedWith(ERROR_MSG)

      // not valid owner
      await contract
        .initialize(
          ambBridgeContract.address,
          otherSideMediatorContract.address,
          [dailyLimit, maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          ZERO_ADDRESS,
          feeManager.address
        )
        .should.be.rejectedWith(ERROR_MSG)

      // not valid fee manager address
      await contract
        .initialize(
          ambBridgeContract.address,
          otherSideMediatorContract.address,
          [dailyLimit, maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          owner,
          user
        )
        .should.be.rejectedWith(ERROR_MSG)

      // not valid decimal shift
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        100,
        owner,
        feeManager.address
      ).should.be.rejected

      const { logs } = await contract.initialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        feeManager.address
      ).should.be.fulfilled

      // already initialized
      await contract
        .initialize(
          ambBridgeContract.address,
          otherSideMediatorContract.address,
          [dailyLimit, maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          owner,
          feeManager.address
        )
        .should.be.rejectedWith(ERROR_MSG)

      // Then
      expect(await contract.isInitialized()).to.be.equal(true)
      expect(await contract.bridgeContract()).to.be.equal(ambBridgeContract.address)
      expect(await contract.mediatorContractOnOtherSide()).to.be.equal(otherSideMediatorContract.address)
      expect(await contract.dailyLimit()).to.be.bignumber.equal(dailyLimit)
      expect(await contract.maxPerTx()).to.be.bignumber.equal(maxPerTx)
      expect(await contract.minPerTx()).to.be.bignumber.equal(minPerTx)
      expect(await contract.executionDailyLimit()).to.be.bignumber.equal(executionDailyLimit)
      expect(await contract.executionMaxPerTx()).to.be.bignumber.equal(executionMaxPerTx)
      expect(await contract.requestGasLimit()).to.be.bignumber.equal(maxGasPerTx)
      expect(await contract.decimalShift()).to.be.bignumber.equal(ZERO)
      expect(await contract.owner()).to.be.equal(owner)
      expect(await contract.feeManagerContract()).to.be.equal(feeManager.address)

      expectEventInLogs(logs, 'ExecutionDailyLimitChanged', { newLimit: executionDailyLimit })
      expectEventInLogs(logs, 'DailyLimitChanged', { newLimit: dailyLimit })
    })
    it('should initialize with zero fee manager address', async () => {
      // Given
      expect(await contract.feeManagerContract()).to.be.equal(ZERO_ADDRESS)

      // When
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        ZERO_ADDRESS
      ).should.be.fulfilled

      // Then
      expect(await contract.isInitialized()).to.be.equal(true)
      expect(await contract.feeManagerContract()).to.be.equal(ZERO_ADDRESS)
    })
  })
  describe('set amb bridge params', () => {
    beforeEach(async () => {
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        ZERO_ADDRESS
      ).should.be.fulfilled
    })
    it('only owner can set bridge contract', async () => {
      const notAContractAddress = accounts[2]

      expect(await contract.bridgeContract()).to.be.equal(ambBridgeContract.address)

      const newBridgeContract = await AMBMock.new()

      await contract.setBridgeContract(newBridgeContract.address, { from: user }).should.be.rejectedWith(ERROR_MSG)
      await contract.setBridgeContract(notAContractAddress, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      await contract.setBridgeContract(newBridgeContract.address, { from: owner }).should.be.fulfilled
      expect(await contract.bridgeContract()).to.be.equal(newBridgeContract.address)
    })
    it('only owner can set mediator contract', async () => {
      const user = accounts[1]

      expect(await contract.mediatorContractOnOtherSide()).to.be.equal(otherSideMediatorContract.address)

      const newMediatorContract = await ForeignAMBNativeToErc20.new()

      await contract
        .setMediatorContractOnOtherSide(newMediatorContract.address, { from: user })
        .should.be.rejectedWith(ERROR_MSG)

      await contract.setMediatorContractOnOtherSide(newMediatorContract.address, { from: owner }).should.be.fulfilled
      expect(await contract.mediatorContractOnOtherSide()).to.be.equal(newMediatorContract.address)
    })
    it('only owner can set request Gas Limit', async () => {
      const user = accounts[1]

      expect(await contract.requestGasLimit()).to.be.bignumber.equal(maxGasPerTx)

      const newMaxGasPerTx = ether('0.5')
      const invalidMaxGasPerTx = ether('1.5')

      await contract.setRequestGasLimit(newMaxGasPerTx, { from: user }).should.be.rejectedWith(ERROR_MSG)

      // invalidMaxGasPerTx > ambBridgeContract.maxGasPerTx
      await contract.setRequestGasLimit(invalidMaxGasPerTx, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      await contract.setRequestGasLimit(newMaxGasPerTx, { from: owner }).should.be.fulfilled
      expect(await contract.requestGasLimit()).to.be.bignumber.equal(newMaxGasPerTx)
    })
  })
  describe('set limits', () => {
    const user = accounts[1]
    beforeEach(async () => {
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [3, 2, 1],
        [3, 2],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        ZERO_ADDRESS
      ).should.be.fulfilled
    })
    it('setMaxPerTx allows to set only to owner and cannot be more than daily limit', async () => {
      await contract.setMaxPerTx(2, { from: user }).should.be.rejectedWith(ERROR_MSG)
      await contract.setMaxPerTx(2, { from: owner }).should.be.fulfilled
      expect(await contract.maxPerTx()).to.be.bignumber.equal('2')

      await contract.setMaxPerTx(3, { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })
    it('setMinPerTx allows to set only to owner and cannot be more than daily limit and should be less than maxPerTx', async () => {
      await contract.setMinPerTx(1, { from: user }).should.be.rejectedWith(ERROR_MSG)
      await contract.setMinPerTx(1, { from: owner }).should.be.fulfilled
      expect(await contract.minPerTx()).to.be.bignumber.equal('1')

      await contract.setMinPerTx(2, { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })
    it('setDailyLimit allow to set by owner and should be greater than maxPerTx or zero', async () => {
      await contract.setDailyLimit(4, { from: user }).should.be.rejectedWith(ERROR_MSG)
      await contract.setDailyLimit(2, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      await contract.setDailyLimit(4, { from: owner }).should.be.fulfilled
      expect(await contract.dailyLimit()).to.be.bignumber.equal('4')

      await contract.setDailyLimit(0, { from: owner }).should.be.fulfilled
      expect(await contract.dailyLimit()).to.be.bignumber.equal(ZERO)

      await contract.setDailyLimit(4, { from: owner }).should.be.fulfilled
      expect(await contract.dailyLimit()).to.be.bignumber.equal('4')
    })
    it('setExecutionMaxPerTx allows to set only to owner and cannot be more than daily limit', async () => {
      await contract.setExecutionMaxPerTx(2, { from: user }).should.be.rejectedWith(ERROR_MSG)
      await contract.setExecutionMaxPerTx(2, { from: owner }).should.be.fulfilled
      expect(await contract.executionMaxPerTx()).to.be.bignumber.equal('2')

      await contract.setExecutionMaxPerTx(3, { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })
    it('setExecutionDailyLimit allow to set by owner and should be greater than maxPerTx or zero', async () => {
      await contract.setExecutionDailyLimit(4, { from: user }).should.be.rejectedWith(ERROR_MSG)
      await contract.setExecutionDailyLimit(2, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      await contract.setExecutionDailyLimit(4, { from: owner }).should.be.fulfilled
      expect(await contract.executionDailyLimit()).to.be.bignumber.equal('4')

      await contract.setExecutionDailyLimit(0, { from: owner }).should.be.fulfilled
      expect(await contract.executionDailyLimit()).to.be.bignumber.equal(ZERO)

      await contract.setExecutionDailyLimit(4, { from: owner }).should.be.fulfilled
      expect(await contract.executionDailyLimit()).to.be.bignumber.equal('4')
    })
  })
  describe('getBridgeMode', () => {
    it('should return mediator mode and interface', async function() {
      const bridgeModeHash = '0x582ed8fd' // 4 bytes of keccak256('native-to-erc-amb')
      expect(await contract.getBridgeMode()).to.be.equal(bridgeModeHash)

      const { major, minor, patch } = await contract.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(ZERO)
      minor.should.be.bignumber.gte(ZERO)
      patch.should.be.bignumber.gte(ZERO)
    })
  })
  describe('fallback', () => {
    beforeEach(async () => {
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        ZERO_ADDRESS
      ).should.be.fulfilled
    })
    it('should accept native tokens', async () => {
      // Given
      const currentDay = await contract.getCurrentDay()
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      // When
      await contract.sendTransaction({
        from: user,
        value: oneEther
      }).should.be.fulfilled

      // Then
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(oneEther)

      const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      // Inlcude user address
      expect(events[0].returnValues.encodedData.includes(strip0x(user).toLowerCase())).to.be.equal(true)
      // Include mediator address
      expect(
        events[0].returnValues.encodedData.includes(strip0x(otherSideMediatorContract.address).toLowerCase())
      ).to.be.equal(true)
      // Include handleBridgedTokens method selector
      expect(events[0].returnValues.encodedData.includes('8b6c0354')).to.be.equal(true)
    })
    it('native token amount should be inside limits ', async () => {
      // Given
      const currentDay = await contract.getCurrentDay()
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      // When

      // value > maxPerTx
      await contract
        .sendTransaction({
          from: user,
          value: twoEthers
        })
        .should.be.rejectedWith(ERROR_MSG)

      // value < minPerTx
      await contract
        .sendTransaction({
          from: user,
          value: ether('0.00001')
        })
        .should.be.rejectedWith(ERROR_MSG)

      await contract.sendTransaction({
        from: user,
        value: oneEther
      }).should.be.fulfilled

      await contract.sendTransaction({
        from: user,
        value: oneEther
      }).should.be.fulfilled

      // Total value > dailyLimit
      await contract
        .sendTransaction({
          from: user,
          value: oneEther
        })
        .should.be.rejectedWith(ERROR_MSG)
    })
  })
  describe('relayTokens', () => {
    beforeEach(async () => {
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        ZERO_ADDRESS
      ).should.be.fulfilled
    })
    it('should accept native tokens and a different receiver', async () => {
      // Given
      const currentDay = await contract.getCurrentDay()
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      // When
      await contract.relayTokens(user2, {
        from: user,
        value: oneEther
      }).should.be.fulfilled

      // Then
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(oneEther)

      const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      // Inlcude user2 address
      expect(events[0].returnValues.encodedData.includes(strip0x(user2).toLowerCase())).to.be.equal(true)
      // Include mediator address
      expect(
        events[0].returnValues.encodedData.includes(strip0x(otherSideMediatorContract.address).toLowerCase())
      ).to.be.equal(true)
      // Include handleBridgedTokens method selector
      expect(events[0].returnValues.encodedData.includes('8b6c0354')).to.be.equal(true)
    })
    it('native token amount should be inside limits ', async () => {
      // Given
      const currentDay = await contract.getCurrentDay()
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      // When

      // value > maxPerTx
      await contract
        .relayTokens(user2, {
          from: user,
          value: twoEthers
        })
        .should.be.rejectedWith(ERROR_MSG)

      // value < minPerTx
      await contract
        .relayTokens(user2, {
          from: user,
          value: ether('0.00001')
        })
        .should.be.rejectedWith(ERROR_MSG)

      await contract.relayTokens(user2, {
        from: user,
        value: oneEther
      }).should.be.fulfilled

      await contract.relayTokens(user2, {
        from: user,
        value: oneEther
      }).should.be.fulfilled

      // Total value > dailyLimit
      await contract
        .relayTokens(user2, {
          from: user,
          value: oneEther
        })
        .should.be.rejectedWith(ERROR_MSG)
    })
  })
  describe('handleBridgedTokens', () => {
    beforeEach(async () => {
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        ZERO_ADDRESS
      ).should.be.fulfilled
    })
    it('should unlock native tokens on message from amb', async () => {
      // Given

      // send native tokens to the contract
      await contract.sendTransaction({
        from: user2,
        value: oneEther
      }).should.be.fulfilled

      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(oneEther)

      const currentDay = await contract.getCurrentDay()
      expect(await contract.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      // When
      // can't be called by user
      await contract.handleBridgedTokens(user, oneEther, { from: user }).should.be.rejectedWith(ERROR_MSG)
      // can't be called by owner
      await contract.handleBridgedTokens(user, oneEther, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      const data = await contract.contract.methods.handleBridgedTokens(user, oneEther.toString()).encodeABI()

      // message must be generated by mediator contract on the other network, here owner is the sender
      await ambBridgeContract.executeMessageCall(contract.address, owner, data, failedMessageId, '1000000').should.be
        .fulfilled

      expect(await ambBridgeContract.messageCallStatus(failedMessageId)).to.be.equal(false)

      const balanceUserBefore = toBN(await web3.eth.getBalance(user))

      await ambBridgeContract.executeMessageCall(
        contract.address,
        otherSideMediatorContract.address,
        data,
        exampleMessageId,
        '1000000'
      ).should.be.fulfilled

      expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)

      // Then
      expect(await contract.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(oneEther)
      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(ZERO)
      expect(toBN(await web3.eth.getBalance(user))).to.be.bignumber.equal(balanceUserBefore.add(oneEther))

      const event = await getEvents(contract, { event: 'TokensBridged' })
      expect(event.length).to.be.equal(1)
      expect(event[0].returnValues.recipient).to.be.equal(user)
      expect(event[0].returnValues.value).to.be.equal(oneEther.toString())
      expect(event[0].returnValues.messageId).to.be.equal(exampleMessageId)
    })
    for (const decimalShift of [2, -1]) {
      it(`should unlock native tokens on message from amb with decimal shift of ${decimalShift}`, async () => {
        // Given
        contract = await HomeAMBNativeToErc20.new()

        await contract.initialize(
          ambBridgeContract.address,
          otherSideMediatorContract.address,
          [dailyLimit, maxPerTx, ether('0.001')],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShift,
          owner,
          ZERO_ADDRESS
        ).should.be.fulfilled

        const valueOnForeign = ether('0.01')
        const valueOnHome = toBN(valueOnForeign * 10 ** decimalShift)

        // send native tokens to the contract
        await contract.sendTransaction({
          from: user2,
          value: valueOnHome
        }).should.be.fulfilled

        expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(valueOnHome)

        const currentDay = await contract.getCurrentDay()
        expect(await contract.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(ZERO)

        // When
        // can't be called by user
        await contract.handleBridgedTokens(user, valueOnForeign, { from: user }).should.be.rejectedWith(ERROR_MSG)
        // can't be called by owner
        await contract.handleBridgedTokens(user, valueOnForeign, { from: owner }).should.be.rejectedWith(ERROR_MSG)

        const data = await contract.contract.methods.handleBridgedTokens(user, valueOnForeign.toString()).encodeABI()

        // message must be generated by mediator contract on the other network, here owner is the sender
        await ambBridgeContract.executeMessageCall(contract.address, owner, data, failedMessageId, '1000000').should.be
          .fulfilled

        expect(await ambBridgeContract.messageCallStatus(failedMessageId)).to.be.equal(false)

        const balanceUserBefore = toBN(await web3.eth.getBalance(user))

        await ambBridgeContract.executeMessageCall(
          contract.address,
          otherSideMediatorContract.address,
          data,
          exampleMessageId,
          '1000000'
        ).should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)

        // Then
        expect(await contract.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(valueOnForeign)
        expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(ZERO)
        expect(toBN(await web3.eth.getBalance(user))).to.be.bignumber.equal(balanceUserBefore.add(valueOnHome))

        const event = await getEvents(contract, { event: 'TokensBridged' })
        expect(event.length).to.be.equal(1)
        expect(event[0].returnValues.recipient).to.be.equal(user)
        expect(event[0].returnValues.value).to.be.equal(valueOnHome.toString())
        expect(event[0].returnValues.messageId).to.be.equal(exampleMessageId)
      })
    }
    it('should revert when out of execution limits on message from amb', async () => {
      // Given
      // send native tokens to the contract
      await contract.sendTransaction({
        from: user2,
        value: oneEther
      }).should.be.fulfilled

      await contract.sendTransaction({
        from: user2,
        value: oneEther
      }).should.be.fulfilled

      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(twoEthers)

      const currentDay = await contract.getCurrentDay()
      expect(await contract.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      // When
      const data = await contract.contract.methods.handleBridgedTokens(user, twoEthers.toString()).encodeABI()

      const balanceUserBefore = toBN(await web3.eth.getBalance(user))

      await ambBridgeContract.executeMessageCall(
        contract.address,
        otherSideMediatorContract.address,
        data,
        exampleMessageId,
        '1000000'
      ).should.be.fulfilled

      expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(false)

      // Then
      expect(await contract.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(ZERO)
      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(twoEthers)
      expect(toBN(await web3.eth.getBalance(user))).to.be.bignumber.equal(balanceUserBefore)
    })
  })
  describe('requestFailedMessageFix', () => {
    beforeEach(async () => {
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        ZERO_ADDRESS
      ).should.be.fulfilled
    })
    it('should allow to request a failed message fix', async () => {
      // Given
      const data = await contract.contract.methods.handleBridgedTokens(user, oneEther.toString()).encodeABI()

      await ambBridgeContract.executeMessageCall(
        contract.address,
        otherSideMediatorContract.address,
        data,
        exampleMessageId,
        100
      ).should.be.fulfilled

      expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(false)

      // When
      await contract.requestFailedMessageFix(exampleMessageId).should.be.fulfilled

      // Then
      const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      expect(events[0].returnValues.encodedData.includes(strip0x(exampleMessageId))).to.be.equal(true)
    })
    it('should be a failed transaction', async () => {
      // Given
      // send native tokens to the contract
      await contract.sendTransaction({
        from: user2,
        value: oneEther
      }).should.be.fulfilled

      const data = await contract.contract.methods.handleBridgedTokens(user, oneEther.toString()).encodeABI()

      await ambBridgeContract.executeMessageCall(
        contract.address,
        otherSideMediatorContract.address,
        data,
        exampleMessageId,
        1000000
      ).should.be.fulfilled

      expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)

      // When
      await contract.requestFailedMessageFix(exampleMessageId).should.be.rejectedWith(ERROR_MSG)
    })
    it('should be the receiver of the failed transaction', async () => {
      // Given
      const data = await contract.contract.methods.handleBridgedTokens(user, oneEther.toString()).encodeABI()

      await ambBridgeContract.executeMessageCall(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        data,
        exampleMessageId,
        100000
      ).should.be.fulfilled

      expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(false)

      // When
      await contract.requestFailedMessageFix(exampleMessageId).should.be.rejectedWith(ERROR_MSG)
    })
    it('message sender should be mediator from other side', async () => {
      // Given
      const data = await contract.contract.methods.handleBridgedTokens(user, oneEther.toString()).encodeABI()

      await ambBridgeContract.executeMessageCall(contract.address, contract.address, data, exampleMessageId, 100).should
        .be.fulfilled

      expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(false)

      // When
      await contract.requestFailedMessageFix(exampleMessageId).should.be.rejectedWith(ERROR_MSG)
    })
    it('should allow to request a fix multiple times', async () => {
      // Given
      const data = await contract.contract.methods.handleBridgedTokens(user, oneEther.toString()).encodeABI()

      await ambBridgeContract.executeMessageCall(
        contract.address,
        otherSideMediatorContract.address,
        data,
        exampleMessageId,
        100
      ).should.be.fulfilled

      expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(false)

      await contract.requestFailedMessageFix(exampleMessageId).should.be.fulfilled

      const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      expect(events[0].returnValues.encodedData.includes(strip0x(exampleMessageId))).to.be.equal(true)

      // When
      await contract.requestFailedMessageFix(exampleMessageId).should.be.fulfilled

      // Then
      const allEvents = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(allEvents.length).to.be.equal(2)
      expect(allEvents[0].returnValues.encodedData.includes(strip0x(exampleMessageId))).to.be.equal(true)
      expect(allEvents[1].returnValues.encodedData.includes(strip0x(exampleMessageId))).to.be.equal(true)
    })
  })
  describe('fixFailedMessage', () => {
    let transferMessageId
    beforeEach(async () => {
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        ZERO_ADDRESS
      ).should.be.fulfilled

      // User transfer native tokens
      await contract.sendTransaction({
        from: user,
        value: oneEther
      }).should.be.fulfilled

      const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      transferMessageId = events[0].returnValues.messageId
    })
    it('should fix locked tokens', async () => {
      // Given
      expect(await contract.messageFixed(transferMessageId)).to.be.equal(false)

      const balanceUserBefore = toBN(await web3.eth.getBalance(user))
      // When
      const fixData = await contract.contract.methods.fixFailedMessage(transferMessageId).encodeABI()

      // Should be called by mediator from other side so it will fail
      await ambBridgeContract.executeMessageCall(contract.address, contract.address, fixData, otherMessageId, 1000000)
        .should.be.fulfilled

      expect(await ambBridgeContract.messageCallStatus(otherMessageId)).to.be.equal(false)
      expect(await contract.messageFixed(transferMessageId)).to.be.equal(false)
      expect(await contract.mediatorBalance()).to.be.bignumber.equal(oneEther)

      await ambBridgeContract.executeMessageCall(
        contract.address,
        otherSideMediatorContract.address,
        fixData,
        exampleMessageId,
        1000000
      ).should.be.fulfilled

      // Then

      expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)
      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(ZERO)
      expect(await contract.mediatorBalance()).to.be.bignumber.equal(ZERO)
      expect(toBN(await web3.eth.getBalance(user))).to.be.bignumber.equal(balanceUserBefore.add(oneEther))
      expect(await contract.messageFixed(transferMessageId)).to.be.equal(true)

      const event = await getEvents(contract, { event: 'FailedMessageFixed' })
      expect(event.length).to.be.equal(1)
      expect(event[0].returnValues.messageId).to.be.equal(transferMessageId)
      expect(event[0].returnValues.recipient).to.be.equal(user)
      expect(event[0].returnValues.value).to.be.equal(oneEther.toString())

      // Second transfer from a different user so next try to fix an already fixed transaction doesn't fail because of
      // lack of funds
      await contract.sendTransaction({
        from: user2,
        value: oneEther
      }).should.be.fulfilled

      // can only fix it one time
      await ambBridgeContract.executeMessageCall(
        contract.address,
        otherSideMediatorContract.address,
        fixData,
        otherMessageId,
        1000000
      ).should.be.fulfilled

      expect(await ambBridgeContract.messageCallStatus(otherMessageId)).to.be.equal(false)
      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(oneEther)
      expect(toBN(await web3.eth.getBalance(user))).to.be.bignumber.equal(balanceUserBefore.add(oneEther))
    })
    it('should be called by amb bridge', async () => {
      await contract.fixFailedMessage(transferMessageId, { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })
  })
  describe('fixFailedMessage for alternative receiver', () => {
    let transferMessageId
    beforeEach(async () => {
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        ZERO_ADDRESS
      ).should.be.fulfilled

      // User transfer native tokens
      await contract.relayTokens(user2, {
        from: user,
        value: oneEther
      }).should.be.fulfilled

      const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      transferMessageId = events[0].returnValues.messageId
    })
    it('should fix locked tokens', async () => {
      // Given
      expect(await contract.messageFixed(transferMessageId)).to.be.equal(false)

      const balanceUserBefore = toBN(await web3.eth.getBalance(user))
      // When
      const fixData = await contract.contract.methods.fixFailedMessage(transferMessageId).encodeABI()

      // Should be called by mediator from other side so it will fail
      await ambBridgeContract.executeMessageCall(contract.address, contract.address, fixData, otherMessageId, 1000000)
        .should.be.fulfilled

      expect(await ambBridgeContract.messageCallStatus(otherMessageId)).to.be.equal(false)
      expect(await contract.messageFixed(transferMessageId)).to.be.equal(false)

      await ambBridgeContract.executeMessageCall(
        contract.address,
        otherSideMediatorContract.address,
        fixData,
        exampleMessageId,
        1000000
      ).should.be.fulfilled

      // Then

      expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)
      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(ZERO)
      expect(toBN(await web3.eth.getBalance(user))).to.be.bignumber.equal(balanceUserBefore.add(oneEther))
      expect(await contract.messageFixed(transferMessageId)).to.be.equal(true)

      const event = await getEvents(contract, { event: 'FailedMessageFixed' })
      expect(event.length).to.be.equal(1)
      expect(event[0].returnValues.messageId).to.be.equal(transferMessageId)
      expect(event[0].returnValues.recipient).to.be.equal(user)
      expect(event[0].returnValues.value).to.be.equal(oneEther.toString())

      // Second transfer from a different user so next try to fix an already fixed transaction doesn't fail because of
      // lack of funds
      await contract.sendTransaction({
        from: user2,
        value: oneEther
      }).should.be.fulfilled

      // can only fix it one time
      await ambBridgeContract.executeMessageCall(
        contract.address,
        otherSideMediatorContract.address,
        fixData,
        otherMessageId,
        1000000
      ).should.be.fulfilled

      expect(await ambBridgeContract.messageCallStatus(otherMessageId)).to.be.equal(false)
      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(oneEther)
      expect(toBN(await web3.eth.getBalance(user))).to.be.bignumber.equal(balanceUserBefore.add(oneEther))
    })
    it('should be called by amb bridge', async () => {
      await contract.fixFailedMessage(transferMessageId, { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })
  })
  describe('claimTokens', () => {
    beforeEach(async () => {
      const storageProxy = await EternalStorageProxy.new()
      await storageProxy.upgradeTo('1', contract.address).should.be.fulfilled
      contract = await HomeAMBNativeToErc20.at(storageProxy.address)
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        ZERO_ADDRESS
      ).should.be.fulfilled
    })
    it('should work with token that return bool on transfer', async () => {
      const token = await ERC677BridgeToken.new('Test', 'TST', 18)

      await token.mint(user, oneEther).should.be.fulfilled
      expect(await token.balanceOf(user)).to.be.bignumber.equal(oneEther)

      await token.transfer(contract.address, oneEther, { from: user }).should.be.fulfilled
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(oneEther)

      await contract.claimTokens(token.address, accounts[3], { from: owner }).should.be.fulfilled
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(accounts[3])).to.be.bignumber.equal(oneEther)
    })
    it('should works with token that not return on transfer', async () => {
      const token = await NoReturnTransferTokenMock.new()

      await token.mint(user, oneEther).should.be.fulfilled
      expect(await token.balanceOf(user)).to.be.bignumber.equal(oneEther)

      await token.transfer(contract.address, oneEther, { from: user }).should.be.fulfilled
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(oneEther)

      await contract.claimTokens(token.address, accounts[3], { from: owner }).should.be.fulfilled
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(accounts[3])).to.be.bignumber.equal(oneEther)
    })
    it('should not work for native coins for this type of mediator', async () => {
      await contract.sendTransaction({ from: user2, value: oneEther }).should.be.fulfilled
      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(oneEther)

      await contract.claimTokens(ZERO_ADDRESS, accounts[3], { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })
  })
  describe('feeManager', () => {
    let feeManager
    beforeEach(async () => {
      feeManager = await HomeFeeManagerAMBNativeToErc20.new(owner, fee, rewardAccountList, contract.address)
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        feeManager.address
      ).should.be.fulfilled
    })
    it('should allow to get and set the feeManager', async () => {
      // Given
      expect(await contract.feeManagerContract()).to.be.equal(feeManager.address)

      const newFeeManager = await HomeFeeManagerAMBNativeToErc20.new(owner, fee, rewardAccountList, contract.address)
      // When
      // Only owner can set feeManager
      await contract.setFeeManagerContract(newFeeManager.address, { from: user }).should.be.rejectedWith(ERROR_MSG)

      // should be a valid feeManager
      await contract.setFeeManagerContract(accounts[3], { from: owner }).should.be.rejectedWith(ERROR_MSG)

      await contract.setFeeManagerContract(newFeeManager.address, { from: owner }).should.be.fulfilled

      // Then
      expect(await contract.feeManagerContract()).to.be.equal(newFeeManager.address)

      // Also zero address can be set
      await contract.setFeeManagerContract(ZERO_ADDRESS, { from: owner }).should.be.fulfilled
      expect(await contract.feeManagerContract()).to.be.equal(ZERO_ADDRESS)
    })
    describe('HomeFeeManagerAMBNativeToErc20', () => {
      let mediator
      before(async () => {
        mediator = await HomeAMBNativeToErc20.new()
      })
      describe('constructor', () => {
        it('should validate parameters', async () => {
          // invalid owner
          await HomeFeeManagerAMBNativeToErc20.new(
            ZERO_ADDRESS,
            fee,
            rewardAccountList,
            mediator.address
          ).should.be.rejectedWith(ERROR_MSG)
          // invalid fee value
          await HomeFeeManagerAMBNativeToErc20.new(
            owner,
            twoEthers,
            rewardAccountList,
            mediator.address
          ).should.be.rejectedWith(ERROR_MSG)
          const bigRewardAccountList = createAccounts(web3, 50 + 1)
          // invalid account list
          await HomeFeeManagerAMBNativeToErc20.new(
            owner,
            twoEthers,
            bigRewardAccountList,
            mediator.address
          ).should.be.rejectedWith(ERROR_MSG)
          // invalid account list
          await HomeFeeManagerAMBNativeToErc20.new(owner, fee, [], mediator.address).should.be.rejectedWith(ERROR_MSG)
          // invalid account list
          await HomeFeeManagerAMBNativeToErc20.new(
            owner,
            fee,
            [...rewardAccountList, ZERO_ADDRESS],
            mediator.address
          ).should.be.rejectedWith(ERROR_MSG)
          // invalid account list
          await HomeFeeManagerAMBNativeToErc20.new(
            owner,
            fee,
            [...rewardAccountList, mediator.address],
            mediator.address
          ).should.be.rejectedWith(ERROR_MSG)
          // invalid mediator contract
          await HomeFeeManagerAMBNativeToErc20.new(owner, fee, rewardAccountList, ZERO_ADDRESS).should.be.rejectedWith(
            ERROR_MSG
          )
          await HomeFeeManagerAMBNativeToErc20.new(owner, fee, rewardAccountList, mediator.address)
        })
      })
      describe('rewardAccounts', () => {
        beforeEach(async () => {
          contract = await HomeFeeManagerAMBNativeToErc20.new(owner, fee, rewardAccountList, mediator.address)
        })
        it('should allow to add accounts', async () => {
          // Given
          const rewardAccountsBefore = await contract.rewardAccountsList()
          expect(rewardAccountsBefore.length).to.be.equal(3)
          expect(rewardAccountsBefore[0]).to.be.equal(rewardAccountList[0])
          expect(rewardAccountsBefore[1]).to.be.equal(rewardAccountList[1])
          expect(rewardAccountsBefore[2]).to.be.equal(rewardAccountList[2])

          const newAccount = accounts[6]

          // When
          // only owner can add new accounts
          await contract.addRewardAccount(newAccount, { from: user }).should.be.rejectedWith(ERROR_MSG)

          // can't add mediator address as reward account
          await contract.addRewardAccount(mediator.address, { from: owner }).should.be.rejectedWith(ERROR_MSG)

          // can't add zero address
          await contract.addRewardAccount(ZERO_ADDRESS, { from: owner }).should.be.rejectedWith(ERROR_MSG)

          await contract.addRewardAccount(newAccount, { from: owner }).should.be.fulfilled

          // Can't add an account that already is part of the list
          await contract.addRewardAccount(newAccount, { from: owner }).should.be.rejectedWith(ERROR_MSG)

          // Then
          const rewardAccounts = await contract.rewardAccountsList()
          expect(rewardAccounts.length).to.be.equal(4)
          expect(rewardAccounts[0]).to.be.equal(rewardAccountList[0])
          expect(rewardAccounts[1]).to.be.equal(rewardAccountList[1])
          expect(rewardAccounts[2]).to.be.equal(rewardAccountList[2])
          expect(rewardAccounts[3]).to.be.equal(newAccount)
        })
        it('should allow to remove an existing account', async () => {
          // Given
          const rewardAccountsBefore = await contract.rewardAccountsList()
          expect(rewardAccountsBefore.length).to.be.equal(3)
          expect(rewardAccountsBefore[0]).to.be.equal(rewardAccountList[0])
          expect(rewardAccountsBefore[1]).to.be.equal(rewardAccountList[1])
          expect(rewardAccountsBefore[2]).to.be.equal(rewardAccountList[2])

          const accountToRemove = rewardAccountList[1]
          // When
          // only owner can revomve accounts
          await contract.removeRewardAccount(accountToRemove, { from: user }).should.be.rejectedWith(ERROR_MSG)

          // Onlye accounts that are in the list can be removed
          await contract.removeRewardAccount(accounts[7], { from: owner }).should.be.rejectedWith(ERROR_MSG)

          await contract.removeRewardAccount(accountToRemove, { from: owner }).should.be.fulfilled

          // not in the list anymore
          await contract.removeRewardAccount(accountToRemove, { from: owner }).should.be.rejectedWith(ERROR_MSG)

          // Then
          const rewardAccounts = await contract.rewardAccountsList()
          expect(rewardAccounts.length).to.be.equal(2)
          expect(rewardAccounts[0]).to.be.equal(rewardAccountList[0])
          expect(rewardAccounts[1]).to.be.equal(rewardAccountList[2])
        })
      })
      describe('fee', () => {
        beforeEach(async () => {
          contract = await HomeFeeManagerAMBNativeToErc20.new(owner, fee, rewardAccountList, mediator.address)
        })
        it('should allow to get and set the fee', async () => {
          // Given
          expect(await contract.fee()).to.be.bignumber.equal(fee)

          const newFee = ether('0.02')
          const bigFee = twoEthers

          // When
          // Only owner can set fee
          await contract.setFee(newFee, { from: user }).should.be.rejectedWith(ERROR_MSG)

          // should be a valid fee
          await contract.setFee(bigFee, { from: owner }).should.be.rejectedWith(ERROR_MSG)

          await contract.setFee(newFee, { from: owner }).should.be.fulfilled

          // Then
          expect(await contract.fee()).to.be.bignumber.equal(newFee)
        })
      })
      describe('owner', () => {
        beforeEach(async () => {
          contract = await HomeFeeManagerAMBNativeToErc20.new(owner, fee, rewardAccountList, mediator.address)
        })
        it('should transfer ownership', async () => {
          // Given
          expect(await contract.owner()).to.be.equal(owner)

          // When
          const newOwner = accounts[7]

          await contract.transferOwnership(newOwner, { from: accounts[2] }).should.be.rejectedWith(ERROR_MSG)
          await contract.transferOwnership(ZERO_ADDRESS, { from: owner }).should.be.rejectedWith(ERROR_MSG)
          const { logs } = await contract.transferOwnership(newOwner, { from: owner }).should.be.fulfilled

          // Then
          expect(await contract.owner()).to.be.equal(newOwner)
          expectEventInLogs(logs, 'OwnershipTransferred', { previousOwner: owner, newOwner })
        })
      })
      describe('fallback', () => {
        beforeEach(async () => {
          contract = await HomeFeeManagerAMBNativeToErc20.new(owner, fee, rewardAccountList, mediator.address)
        })
        it('should accept native tokens', async () => {
          // Given
          expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(ZERO)

          // When
          const value = oneEther
          await contract.sendTransaction({
            from: user,
            value
          }).should.be.fulfilled

          // Then
          expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(value)
        })
      })
    })
  })
  describe('owner', () => {
    beforeEach(async () => {
      const feeManager = await HomeFeeManagerAMBNativeToErc20.new(owner, fee, rewardAccountList, contract.address)
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        feeManager.address
      ).should.be.fulfilled
    })
    it('should transfer ownership', async () => {
      // Given
      expect(await contract.owner()).to.be.equal(owner)

      // When
      const newOwner = accounts[7]

      await contract.transferOwnership(newOwner, { from: accounts[2] }).should.be.rejectedWith(ERROR_MSG)
      await contract.transferOwnership(ZERO_ADDRESS, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      const { logs } = await contract.transferOwnership(newOwner, { from: owner }).should.be.fulfilled

      // Then
      expect(await contract.owner()).to.be.equal(newOwner)
      expectEventInLogs(logs, 'OwnershipTransferred', { previousOwner: owner, newOwner })
    })
  })
  describe('handleBridgedTokens with fees', () => {
    beforeEach(async () => {
      const feeManager = await HomeFeeManagerAMBNativeToErc20.new(owner, fee, rewardAccountList, contract.address)
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        feeManager.address
      ).should.be.fulfilled
    })
    it('should unlock native tokens and distribute fees on message from amb', async () => {
      // Given
      const value = halfEther
      const relativeValue = 0.5
      // send native tokens to the contract
      await contract.sendTransaction({
        from: user2,
        value
      }).should.be.fulfilled

      // 0.1% fee
      const fee = 0.001
      const feePerValidator = toBN(166666666666666)
      const feePerValidatorPlusDiff = toBN(166666666666668)
      const valueCalc = relativeValue * (1 - fee)
      const finalUserValue = ether(valueCalc.toString())
      const feeAmountCalc = relativeValue * fee
      const feeAmount = ether(feeAmountCalc.toString())

      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(value)

      const currentDay = await contract.getCurrentDay()
      expect(await contract.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      // When
      const data = await contract.contract.methods.handleBridgedTokens(user, value.toString()).encodeABI()

      const failedMessageId = '0x2ebc2ccc755acc8eaf9252e19573af708d644ab63a39619adb080a3500a4ff2e'

      // message must be generated by mediator contract on the other network, here owner is the sender
      await ambBridgeContract.executeMessageCall(contract.address, owner, data, failedMessageId, '1000000').should.be
        .fulfilled

      expect(await ambBridgeContract.messageCallStatus(failedMessageId)).to.be.equal(false)

      const balanceUserBefore = toBN(await web3.eth.getBalance(user))
      const initialBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewardAccountList[0]))
      const initialBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewardAccountList[1]))
      const initialBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewardAccountList[2]))

      await ambBridgeContract.executeMessageCall(
        contract.address,
        otherSideMediatorContract.address,
        data,
        exampleMessageId,
        '1000000'
      ).should.be.fulfilled

      expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)

      // Then
      const updatedBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewardAccountList[0]))
      const updatedBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewardAccountList[1]))
      const updatedBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewardAccountList[2]))

      expect(await contract.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(value)
      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(ZERO)
      expect(toBN(await web3.eth.getBalance(user))).to.be.bignumber.equal(balanceUserBefore.add(finalUserValue))

      expect(
        updatedBalanceRewardAddress1.eq(initialBalanceRewardAddress1.add(feePerValidator)) ||
          updatedBalanceRewardAddress1.eq(initialBalanceRewardAddress1.add(feePerValidatorPlusDiff))
      ).to.equal(true)
      expect(
        updatedBalanceRewardAddress2.eq(initialBalanceRewardAddress2.add(feePerValidator)) ||
          updatedBalanceRewardAddress2.eq(initialBalanceRewardAddress2.add(feePerValidatorPlusDiff))
      ).to.equal(true)
      expect(
        updatedBalanceRewardAddress3.eq(initialBalanceRewardAddress3.add(feePerValidator)) ||
          updatedBalanceRewardAddress3.eq(initialBalanceRewardAddress3.add(feePerValidatorPlusDiff))
      ).to.equal(true)

      const events = await getEvents(contract, { event: 'FeeDistributed' })
      expect(events.length).to.be.equal(1)
      expect(toBN(events[0].returnValues.feeAmount)).to.be.bignumber.equal(feeAmount)
      expect(events[0].returnValues.messageId).to.be.equal(exampleMessageId)

      const event = await getEvents(contract, { event: 'TokensBridged' })
      expect(event.length).to.be.equal(1)
      expect(event[0].returnValues.recipient).to.be.equal(user)
      expect(event[0].returnValues.value).to.be.equal(finalUserValue.toString())
      expect(event[0].returnValues.messageId).to.be.equal(exampleMessageId)
    })
  })
  describe('fixMediatorBalance', async () => {
    beforeEach(async () => {
      const storageProxy = await EternalStorageProxy.new()
      await storageProxy.upgradeTo('1', contract.address).should.be.fulfilled
      contract = await HomeAMBNativeToErc20.at(storageProxy.address)
    })
    it('should fix mediator imbalance', async () => {
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [ether('5'), threeEthers, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        ZERO_ADDRESS
      ).should.be.fulfilled

      // Given

      // send some native tokens to the contract
      await contract.sendTransaction({
        from: user,
        value: oneEther
      }).should.be.fulfilled

      await contract.sendTransaction({
        from: user,
        value: oneEther
      }).should.be.fulfilled

      await contract.sendTransaction({
        from: user,
        value: oneEther
      }).should.be.fulfilled

      const currentDay = await contract.getCurrentDay()
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(threeEthers)

      // remove some native tokens from the contract
      const data = await contract.contract.methods.handleBridgedTokens(user, oneEther.toString()).encodeABI()
      await ambBridgeContract.executeMessageCall(
        contract.address,
        otherSideMediatorContract.address,
        data,
        exampleMessageId,
        '1000000'
      ).should.be.fulfilled
      expect(await contract.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(oneEther)
      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(twoEthers)

      // force some native tokens to the contract without calling the fallback method
      await Sacrifice.new(contract.address, { value: oneEther }).catch(() => {})
      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(threeEthers)
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(threeEthers)
      expect(toBN(await contract.mediatorBalance())).to.be.bignumber.equal(twoEthers)

      // When
      // only owner can call the method
      await contract.fixMediatorBalance(user, { from: user }).should.be.rejectedWith(ERROR_MSG)

      await contract.fixMediatorBalance(ZERO_ADDRESS, { from: owner }).should.be.rejected

      await contract.fixMediatorBalance(user, { from: owner }).should.be.fulfilled

      // imbalance was already fixed
      await contract.fixMediatorBalance(user, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      // Then
      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(threeEthers)

      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ether('4'))
      expect(toBN(await contract.mediatorBalance())).to.be.bignumber.equal(threeEthers)

      const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(4)
      // Inlcude user address
      expect(events[3].returnValues.encodedData.includes(strip0x(user).toLowerCase())).to.be.equal(true)
      // Include mediator address
      expect(
        events[3].returnValues.encodedData.includes(strip0x(otherSideMediatorContract.address).toLowerCase())
      ).to.be.equal(true)
      // Include handleBridgedTokens method selector
      expect(events[3].returnValues.encodedData.includes('8b6c0354')).to.be.equal(true)
    })
    it('should fix mediator imbalance with respect to limits', async () => {
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [ether('4.5'), maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        ZERO_ADDRESS
      ).should.be.fulfilled

      // Given

      // send some native tokens to the contract
      await contract.sendTransaction({
        from: user,
        value: oneEther
      }).should.be.fulfilled

      await contract.sendTransaction({
        from: user,
        value: oneEther
      }).should.be.fulfilled

      await contract.sendTransaction({
        from: user,
        value: oneEther
      }).should.be.fulfilled

      const currentDay = await contract.getCurrentDay()
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(threeEthers)

      // remove some native tokens from the contract
      const data = await contract.contract.methods.handleBridgedTokens(user, oneEther.toString()).encodeABI()
      await ambBridgeContract.executeMessageCall(
        contract.address,
        otherSideMediatorContract.address,
        data,
        exampleMessageId,
        '1000000'
      ).should.be.fulfilled
      expect(await contract.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(oneEther)
      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(twoEthers)

      // force some native tokens to the contract without calling the fallback method
      await Sacrifice.new(contract.address, { value: ether('2.5') }).catch(() => {})
      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(ether('4.5'))
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(threeEthers)
      expect(await contract.mediatorBalance()).to.be.bignumber.equal(twoEthers)

      // When
      // only owner can call the method
      await contract.fixMediatorBalance(user, { from: user }).should.be.rejectedWith(ERROR_MSG)

      await contract.fixMediatorBalance(user, { from: owner }).should.be.fulfilled

      // Then
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ether('4'))
      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(ether('4.5'))
      expect(await contract.mediatorBalance()).to.be.bignumber.equal(threeEthers)

      await contract.fixMediatorBalance(user, { from: owner }).should.be.fulfilled

      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ether('4.5'))
      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(ether('4.5'))
      expect(await contract.mediatorBalance()).to.be.bignumber.equal(ether('3.5'))

      // reached daily quota limit
      await contract.fixMediatorBalance(user, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(5)
      // Inlcude user address
      expect(events[3].returnValues.encodedData.includes(strip0x(user).toLowerCase())).to.be.equal(true)
      // Include mediator address
      expect(
        events[3].returnValues.encodedData.includes(strip0x(otherSideMediatorContract.address).toLowerCase())
      ).to.be.equal(true)
      // Include handleBridgedTokens method selector
      expect(events[3].returnValues.encodedData.includes('8b6c0354')).to.be.equal(true)
    })
    it('should fix mediator imbalance correctly with fees', async () => {
      const feeManager = await HomeFeeManagerAMBNativeToErc20.new(owner, fee, rewardAccountList, contract.address)

      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [ether('5'), maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        feeManager.address
      ).should.be.fulfilled

      // Given

      // send some native tokens to the contract
      await contract.sendTransaction({
        from: user,
        value: oneEther
      }).should.be.fulfilled

      await contract.sendTransaction({
        from: user,
        value: oneEther
      }).should.be.fulfilled

      await contract.sendTransaction({
        from: user,
        value: oneEther
      }).should.be.fulfilled

      const currentDay = await contract.getCurrentDay()
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(threeEthers)

      // remove some native tokens from the contract
      const data = await contract.contract.methods.handleBridgedTokens(user, oneEther.toString()).encodeABI()
      await ambBridgeContract.executeMessageCall(
        contract.address,
        otherSideMediatorContract.address,
        data,
        exampleMessageId,
        '1000000'
      ).should.be.fulfilled
      expect(await contract.totalExecutedPerDay(currentDay)).to.be.bignumber.equal(oneEther)
      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(twoEthers)

      // force some native tokens to the contract without calling the fallback method
      await Sacrifice.new(contract.address, { value: oneEther }).catch(() => {})
      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(threeEthers)
      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(threeEthers)
      expect(toBN(await contract.mediatorBalance())).to.be.bignumber.equal(twoEthers)

      // When
      // only owner can call the method
      await contract.fixMediatorBalance(user, { from: user }).should.be.rejectedWith(ERROR_MSG)

      await contract.fixMediatorBalance(user, { from: owner }).should.be.fulfilled

      // imbalance was already fixed
      await contract.fixMediatorBalance(user, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      // Then
      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(threeEthers)

      expect(await contract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ether('4'))
      expect(toBN(await contract.mediatorBalance())).to.be.bignumber.equal(threeEthers)

      const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(4)
      // Inlcude user address
      expect(events[3].returnValues.encodedData.includes(strip0x(user).toLowerCase())).to.be.equal(true)
      // Include mediator address
      expect(
        events[3].returnValues.encodedData.includes(strip0x(otherSideMediatorContract.address).toLowerCase())
      ).to.be.equal(true)
      // Include handleBridgedTokens method selector
      expect(events[3].returnValues.encodedData.includes('8b6c0354')).to.be.equal(true)
    })
  })
})
