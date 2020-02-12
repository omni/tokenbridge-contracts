const HomeAMBNativeToErc20 = artifacts.require('HomeAMBNativeToErc20.sol')
const ForeignAMBNativeToErc20 = artifacts.require('ForeignAMBNativeToErc20.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const NoReturnTransferTokenMock = artifacts.require('NoReturnTransferTokenMock.sol')
const ForeignFeeManagerAMBNativeToErc20 = artifacts.require('ForeignFeeManagerAMBNativeToErc20.sol')
const AMBMock = artifacts.require('AMBMock.sol')
const Sacrifice = artifacts.require('Sacrifice.sol')

const { expect } = require('chai')
const { getEvents, expectEventInLogs, ether, strip0x } = require('../helpers/helpers')
const { ZERO_ADDRESS, ERROR_MSG, toBN } = require('../setup')

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
const exampleTxHash = '0xf308b922ab9f8a7128d9d7bc9bce22cd88b2c05c8213f0e2d8104d78e0a9ecbb'
const nonce = '0x96b6af865cdaa107ede916e237afbedffa5ed36bea84c0e77a33cc28fc2e9c01'
// 0.1% fee
const fee = ether('0.001')

contract('ForeignAMBNativeToErc20', async accounts => {
  let contract
  let token
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
    contract = await ForeignAMBNativeToErc20.new()
    ambBridgeContract = await AMBMock.new()
    await ambBridgeContract.setMaxGasPerTx(maxGasPerTx)
    otherSideMediatorContract = await HomeAMBNativeToErc20.new()
    token = await ERC677BridgeToken.new('TEST', 'TST', 18)
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
      expect(await contract.erc677token()).to.be.equal(ZERO_ADDRESS)

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
          token.address
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
          token.address
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
          token.address
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
          token.address
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
          token.address
        )
        .should.be.rejectedWith(ERROR_MSG)

      // invalid address
      await contract
        .initialize(
          ambBridgeContract.address,
          otherSideMediatorContract.address,
          [dailyLimit, maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          owner,
          ZERO_ADDRESS
        )
        .should.be.rejectedWith(ERROR_MSG)

      const { logs } = await contract.initialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        token.address
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
          token.address
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
      expect(await contract.erc677token()).to.be.equal(token.address)

      expectEventInLogs(logs, 'ExecutionDailyLimitChanged', { newLimit: executionDailyLimit })
      expectEventInLogs(logs, 'DailyLimitChanged', { newLimit: dailyLimit })
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
        token.address
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
        token.address
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
  describe('claimTokens', () => {
    beforeEach(async () => {
      const storageProxy = await EternalStorageProxy.new()
      await storageProxy.upgradeTo('1', contract.address).should.be.fulfilled
      contract = await ForeignAMBNativeToErc20.at(storageProxy.address)
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        token.address
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
  describe('rewardableInitialize', () => {
    let feeManager
    beforeEach(async () => {
      feeManager = await ForeignFeeManagerAMBNativeToErc20.new()
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
      expect(await contract.erc677token()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.feeManagerContract()).to.be.equal(ZERO_ADDRESS)

      // When
      // not valid bridge address
      await contract
        .rewardableInitialize(
          ZERO_ADDRESS,
          otherSideMediatorContract.address,
          [dailyLimit, maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          owner,
          token.address,
          feeManager.address,
          fee,
          rewardAccountList
        )
        .should.be.rejectedWith(ERROR_MSG)

      // dailyLimit > maxPerTx
      await contract
        .rewardableInitialize(
          ambBridgeContract.address,
          otherSideMediatorContract.address,
          [maxPerTx, maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          owner,
          token.address,
          feeManager.address,
          fee,
          rewardAccountList
        )
        .should.be.rejectedWith(ERROR_MSG)

      // maxPerTx > minPerTx
      await contract
        .rewardableInitialize(
          ambBridgeContract.address,
          otherSideMediatorContract.address,
          [dailyLimit, minPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          owner,
          token.address,
          feeManager.address,
          fee,
          rewardAccountList
        )
        .should.be.rejectedWith(ERROR_MSG)

      // executionDailyLimit > executionMaxPerTx
      await contract
        .rewardableInitialize(
          ambBridgeContract.address,
          otherSideMediatorContract.address,
          [dailyLimit, maxPerTx, minPerTx],
          [executionDailyLimit, executionDailyLimit],
          maxGasPerTx,
          decimalShiftZero,
          owner,
          token.address,
          feeManager.address,
          fee,
          rewardAccountList
        )
        .should.be.rejectedWith(ERROR_MSG)

      // maxGasPerTx > bridge maxGasPerTx
      await contract
        .rewardableInitialize(
          ambBridgeContract.address,
          otherSideMediatorContract.address,
          [dailyLimit, maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          twoEthers,
          decimalShiftZero,
          owner,
          token.address,
          feeManager.address,
          fee,
          rewardAccountList
        )
        .should.be.rejectedWith(ERROR_MSG)

      // not a valid token address
      await contract
        .rewardableInitialize(
          ambBridgeContract.address,
          otherSideMediatorContract.address,
          [dailyLimit, maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          owner,
          ZERO_ADDRESS,
          feeManager.address,
          fee,
          rewardAccountList
        )
        .should.be.rejectedWith(ERROR_MSG)

      // not a valid fee manager address
      await contract
        .rewardableInitialize(
          ambBridgeContract.address,
          otherSideMediatorContract.address,
          [dailyLimit, maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          owner,
          token.address,
          ZERO_ADDRESS,
          fee,
          rewardAccountList
        )
        .should.be.rejectedWith(ERROR_MSG)

      // not a valid fee. Fee > max fee
      await contract
        .rewardableInitialize(
          ambBridgeContract.address,
          otherSideMediatorContract.address,
          [dailyLimit, maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          owner,
          token.address,
          feeManager.address,
          twoEthers,
          rewardAccountList
        )
        .should.be.rejectedWith(ERROR_MSG)

      // not a valid reward account list
      await contract
        .rewardableInitialize(
          ambBridgeContract.address,
          otherSideMediatorContract.address,
          [dailyLimit, maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          owner,
          token.address,
          feeManager.address,
          fee,
          []
        )
        .should.be.rejectedWith(ERROR_MSG)

      const { logs } = await contract.rewardableInitialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        token.address,
        feeManager.address,
        fee,
        rewardAccountList
      ).should.be.fulfilled

      // already initialized
      await contract
        .rewardableInitialize(
          ambBridgeContract.address,
          otherSideMediatorContract.address,
          [dailyLimit, maxPerTx, minPerTx],
          [executionDailyLimit, executionMaxPerTx],
          maxGasPerTx,
          decimalShiftZero,
          owner,
          token.address,
          feeManager.address,
          fee,
          rewardAccountList
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
      expect(await contract.erc677token()).to.be.equal(token.address)
      expect(await contract.feeManagerContract()).to.be.equal(feeManager.address)
      expect(await contract.getFee()).to.be.bignumber.equal(fee)
      const rewardAccounts = await contract.rewardAccounts()
      expect(rewardAccounts.length).to.be.equal(3)
      expect(rewardAccounts[0]).to.be.equal(rewardAccountList[0])
      expect(rewardAccounts[1]).to.be.equal(rewardAccountList[1])
      expect(rewardAccounts[2]).to.be.equal(rewardAccountList[2])

      expectEventInLogs(logs, 'ExecutionDailyLimitChanged', { newLimit: executionDailyLimit })
      expectEventInLogs(logs, 'DailyLimitChanged', { newLimit: dailyLimit })
      const feeManagerAtMediatorAddress = await ForeignFeeManagerAMBNativeToErc20.at(contract.address)
      const events = await getEvents(feeManagerAtMediatorAddress, { event: 'FeeUpdated' })
      expect(events.length).to.be.equal(1)
      expect(toBN(events[0].returnValues.fee)).to.be.bignumber.equal(fee)
    })
  })
  describe('rewardAccounts', () => {
    beforeEach(async () => {
      const feeManager = await ForeignFeeManagerAMBNativeToErc20.new()
      await contract.rewardableInitialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        token.address,
        feeManager.address,
        fee,
        rewardAccountList
      ).should.be.fulfilled
    })
    it('should allow to add accounts', async () => {
      // Given
      const rewardAccountsBefore = await contract.rewardAccounts()
      expect(rewardAccountsBefore.length).to.be.equal(3)
      expect(rewardAccountsBefore[0]).to.be.equal(rewardAccountList[0])
      expect(rewardAccountsBefore[1]).to.be.equal(rewardAccountList[1])
      expect(rewardAccountsBefore[2]).to.be.equal(rewardAccountList[2])

      const newAccount = accounts[6]

      // When
      // only owner can add new accounts
      await contract.addRewardAccount(newAccount, { from: user }).should.be.rejectedWith(ERROR_MSG)

      await contract.addRewardAccount(newAccount, { from: owner }).should.be.fulfilled

      // Can't add an account that already is part of the list
      await contract.addRewardAccount(newAccount, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      // Then
      const rewardAccounts = await contract.rewardAccounts()
      expect(rewardAccounts.length).to.be.equal(4)
      expect(rewardAccounts[0]).to.be.equal(newAccount)
      expect(rewardAccounts[1]).to.be.equal(rewardAccountList[0])
      expect(rewardAccounts[2]).to.be.equal(rewardAccountList[1])
      expect(rewardAccounts[3]).to.be.equal(rewardAccountList[2])
    })
    it('should allow to remove an existing account', async () => {
      // Given
      const rewardAccountsBefore = await contract.rewardAccounts()
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
      const rewardAccounts = await contract.rewardAccounts()
      expect(rewardAccounts.length).to.be.equal(2)
      expect(rewardAccounts[0]).to.be.equal(rewardAccountList[0])
      expect(rewardAccounts[1]).to.be.equal(rewardAccountList[2])
    })
  })
  describe('fee', () => {
    beforeEach(async () => {
      const feeManager = await ForeignFeeManagerAMBNativeToErc20.new()
      await contract.rewardableInitialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        token.address,
        feeManager.address,
        fee,
        rewardAccountList
      ).should.be.fulfilled
    })
    it('should allow to get and set the fee', async () => {
      // Given
      expect(await contract.getFee()).to.be.bignumber.equal(fee)

      const newFee = ether('0.02')
      const bigFee = twoEthers

      // When
      // Only owner can set fee
      await contract.setFee(newFee, { from: user }).should.be.rejectedWith(ERROR_MSG)

      // should be a valid fee
      await contract.setFee(bigFee, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      await contract.setFee(newFee, { from: owner }).should.be.fulfilled

      // Then
      expect(await contract.getFee()).to.be.bignumber.equal(newFee)
    })
  })
  describe('feeManager', () => {
    let feeManager
    beforeEach(async () => {
      feeManager = await ForeignFeeManagerAMBNativeToErc20.new()
      await contract.rewardableInitialize(
        ambBridgeContract.address,
        otherSideMediatorContract.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        decimalShiftZero,
        owner,
        token.address,
        feeManager.address,
        fee,
        rewardAccountList
      ).should.be.fulfilled
    })
    it('should allow to get and set the feeManager', async () => {
      // Given
      expect(await contract.feeManagerContract()).to.be.equal(feeManager.address)

      const newFeeManager = await ForeignFeeManagerAMBNativeToErc20.new()
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
  })
})
