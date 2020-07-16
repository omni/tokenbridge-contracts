const HomeBridge = artifacts.require('HomeBridgeErcToNative.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')
const BridgeValidators = artifacts.require('BridgeValidators.sol')
const BlockReward = artifacts.require('BlockRewardMock.sol')
const OldBlockReward = artifacts.require('OldBlockReward')
const RewardableValidators = artifacts.require('RewardableValidators.sol')
const FeeManagerErcToNative = artifacts.require('FeeManagerErcToNative.sol')
const FeeManagerErcToNativePOSDAO = artifacts.require('FeeManagerErcToNativePOSDAO')
const FeeManagerMock = artifacts.require('FeeManagerMock')

const { expect } = require('chai')
const { ERROR_MSG, ZERO_ADDRESS, toBN } = require('../setup')
const { createMessage, sign, ether, expectEventInLogs, createAccounts } = require('../helpers/helpers')

const minPerTx = ether('0.01')
const requireBlockConfirmations = 8
const gasPrice = web3.utils.toWei('1', 'gwei')
const quarterEther = ether('0.25')
const oneEther = ether('1')
const halfEther = ether('0.5')
const foreignDailyLimit = oneEther
const foreignMaxPerTx = halfEther
const ZERO = toBN(0)
const MAX_GAS = 8000000
const MAX_VALIDATORS = 50
const decimalShiftZero = 0

contract('HomeBridge_ERC20_to_Native', async accounts => {
  let homeContract
  let validatorContract
  let blockRewardContract
  let authorities
  let owner
  before(async () => {
    validatorContract = await BridgeValidators.new()
    blockRewardContract = await BlockReward.new()
    authorities = [accounts[1]]
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
  })
  describe('#initialize', async () => {
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
    })
    it('sets variables', async () => {
      expect(await homeContract.validatorContract()).to.be.equal(ZERO_ADDRESS)
      expect(await homeContract.deployedAtBlock()).to.be.bignumber.equal(ZERO)
      expect(await homeContract.dailyLimit()).to.be.bignumber.equal(ZERO)
      expect(await homeContract.maxPerTx()).to.be.bignumber.equal(ZERO)
      expect(await homeContract.decimalShift()).to.be.bignumber.equal(ZERO)
      expect(await homeContract.isInitialized()).to.be.equal(false)
      expect(await homeContract.blockRewardContract()).to.be.equal(ZERO_ADDRESS)

      const { logs } = await homeContract.initialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        '9'
      ).should.be.fulfilled

      expect(await homeContract.isInitialized()).to.be.equal(true)
      expect(await homeContract.validatorContract()).to.be.equal(validatorContract.address)
      expect(await homeContract.deployedAtBlock()).to.be.bignumber.above(ZERO)
      expect(await homeContract.dailyLimit()).to.be.bignumber.equal('3')
      expect(await homeContract.maxPerTx()).to.be.bignumber.equal('2')
      expect(await homeContract.minPerTx()).to.be.bignumber.equal('1')
      expect(await homeContract.decimalShift()).to.be.bignumber.equal('9')
      expect(await homeContract.blockRewardContract()).to.be.equal(blockRewardContract.address)
      expect(await homeContract.gasPrice()).to.be.bignumber.equal(gasPrice)
      const bridgeMode = '0x18762d46' // 4 bytes of keccak256('erc-to-native-core')
      expect(await homeContract.getBridgeMode()).to.be.equal(bridgeMode)
      const { major, minor, patch } = await homeContract.getBridgeInterfacesVersion()
      expect(major).to.be.bignumber.gte(ZERO)
      expect(minor).to.be.bignumber.gte(ZERO)
      expect(patch).to.be.bignumber.gte(ZERO)

      expectEventInLogs(logs, 'RequiredBlockConfirmationChanged', {
        requiredBlockConfirmations: toBN(requireBlockConfirmations)
      })
      expectEventInLogs(logs, 'GasPriceChanged', { gasPrice })
      expectEventInLogs(logs, 'ExecutionDailyLimitChanged', { newLimit: foreignDailyLimit })
      expectEventInLogs(logs, 'DailyLimitChanged', { newLimit: '3' })
    })

    it('can update block reward contract', async () => {
      ZERO_ADDRESS.should.be.equal(await homeContract.blockRewardContract())

      await homeContract.initialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled

      blockRewardContract.address.should.be.equal(await homeContract.blockRewardContract())

      const secondBlockRewardContract = await BlockReward.new()
      await homeContract.setBlockRewardContract(secondBlockRewardContract.address)
      secondBlockRewardContract.address.should.be.equal(await homeContract.blockRewardContract())

      const thirdBlockRewardContract = await BlockReward.new()
      await homeContract
        .setBlockRewardContract(thirdBlockRewardContract.address, { from: accounts[4] })
        .should.be.rejectedWith(ERROR_MSG)
      secondBlockRewardContract.address.should.be.equal(await homeContract.blockRewardContract())

      const notAContract = accounts[5]
      await homeContract.setBlockRewardContract(notAContract).should.be.rejectedWith(ERROR_MSG)
      secondBlockRewardContract.address.should.be.equal(await homeContract.blockRewardContract())

      await homeContract.setBlockRewardContract(validatorContract.address).should.be.rejectedWith(ERROR_MSG)
      secondBlockRewardContract.address.should.be.equal(await homeContract.blockRewardContract())

      const oldBlockRewardContract = await OldBlockReward.new()
      await homeContract.setBlockRewardContract(oldBlockRewardContract.address).should.be.fulfilled
      oldBlockRewardContract.address.should.be.equal(await homeContract.blockRewardContract())
    })

    it('cant set maxPerTx > dailyLimit', async () => {
      false.should.be.equal(await homeContract.isInitialized())

      await homeContract
        .initialize(
          validatorContract.address,
          ['1', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          blockRewardContract.address,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract
        .initialize(
          validatorContract.address,
          ['3', '2', '2'],
          gasPrice,
          requireBlockConfirmations,
          blockRewardContract.address,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)

      false.should.be.equal(await homeContract.isInitialized())
    })

    it('can be deployed via upgradeToAndCall', async () => {
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      const data = homeContract.contract.methods
        .initialize(
          validatorContract.address,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          blockRewardContract.address,
          ['3', '2'],
          owner,
          decimalShiftZero
        )
        .encodeABI()

      await storageProxy.upgradeToAndCall('1', homeContract.address, data).should.be.fulfilled
      const finalContract = await HomeBridge.at(storageProxy.address)

      expect(await finalContract.isInitialized()).to.be.equal(true)
      expect(await finalContract.validatorContract()).to.be.equal(validatorContract.address)
      expect(await finalContract.dailyLimit()).to.be.bignumber.equal('3')
      expect(await finalContract.maxPerTx()).to.be.bignumber.equal('2')
      expect(await finalContract.minPerTx()).to.be.bignumber.equal('1')
      expect(await finalContract.blockRewardContract()).to.be.equal(blockRewardContract.address)
    })
    it('can be upgraded keeping the state', async () => {
      const homeOwner = accounts[8]
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      const data = homeContract.contract.methods
        .initialize(
          validatorContract.address,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          blockRewardContract.address,
          ['3', '2'],
          homeOwner,
          decimalShiftZero
        )
        .encodeABI()

      await storageProxy.upgradeToAndCall('1', homeContract.address, data).should.be.fulfilled
      const finalContract = await HomeBridge.at(storageProxy.address)

      expect(await finalContract.isInitialized()).to.be.equal(true)
      expect(await finalContract.validatorContract()).to.be.equal(validatorContract.address)
      expect(await finalContract.dailyLimit()).to.be.bignumber.equal('3')
      expect(await finalContract.maxPerTx()).to.be.bignumber.equal('2')
      expect(await finalContract.minPerTx()).to.be.bignumber.equal('1')
      expect(await finalContract.blockRewardContract()).to.be.equal(blockRewardContract.address)

      const homeContractV2 = await HomeBridge.new()
      await storageProxy.upgradeTo('2', homeContractV2.address).should.be.fulfilled
      const finalContractV2 = await HomeBridge.at(storageProxy.address)

      expect(await finalContractV2.isInitialized()).to.be.equal(true)
      expect(await finalContractV2.validatorContract()).to.be.equal(validatorContract.address)
      expect(await finalContractV2.dailyLimit()).to.be.bignumber.equal('3')
      expect(await finalContractV2.maxPerTx()).to.be.bignumber.equal('2')
      expect(await finalContractV2.minPerTx()).to.be.bignumber.equal('1')
      expect(await finalContractV2.blockRewardContract()).to.be.equal(blockRewardContract.address)
    })
    it('cant initialize with invalid arguments', async () => {
      false.should.be.equal(await homeContract.isInitialized())
      await homeContract
        .initialize(
          validatorContract.address,
          ['3', '2', '1'],
          gasPrice,
          0,
          blockRewardContract.address,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract
        .initialize(
          owner,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          blockRewardContract.address,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract
        .initialize(
          ZERO_ADDRESS,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          blockRewardContract.address,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract
        .initialize(
          validatorContract.address,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          owner,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract
        .initialize(
          validatorContract.address,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          blockRewardContract.address,
          [halfEther, oneEther],
          owner,
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)

      // not valid decimal shift
      await homeContract.initialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        '100'
      ).should.be.rejected

      await homeContract.initialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      true.should.be.equal(await homeContract.isInitialized())
    })
  })
  describe('#rewardableInitialize', async () => {
    let feeManager
    let homeFee
    let foreignFee
    beforeEach(async () => {
      feeManager = await FeeManagerErcToNative.new()
      homeContract = await HomeBridge.new()
      homeFee = ether('0.001')
      foreignFee = ether('0.002')
    })
    it('sets variables', async () => {
      expect(await homeContract.validatorContract()).to.be.equal(ZERO_ADDRESS)
      expect(await homeContract.deployedAtBlock()).to.be.bignumber.equal(ZERO)
      expect(await homeContract.dailyLimit()).to.be.bignumber.equal(ZERO)
      expect(await homeContract.maxPerTx()).to.be.bignumber.equal(ZERO)
      expect(await homeContract.decimalShift()).to.be.bignumber.equal(ZERO)
      expect(await homeContract.isInitialized()).to.be.equal(false)
      expect(await homeContract.blockRewardContract()).to.be.equal(ZERO_ADDRESS)

      await homeContract.rewardableInitialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        '9'
      ).should.be.fulfilled

      expect(await homeContract.isInitialized()).to.be.equal(true)
      expect(await homeContract.validatorContract()).to.be.equal(validatorContract.address)
      expect(await homeContract.deployedAtBlock()).to.be.bignumber.above(ZERO)
      expect(await homeContract.dailyLimit()).to.be.bignumber.equal('3')
      expect(await homeContract.maxPerTx()).to.be.bignumber.equal('2')
      expect(await homeContract.minPerTx()).to.be.bignumber.equal('1')
      expect(await homeContract.decimalShift()).to.be.bignumber.equal('9')
      expect(await homeContract.blockRewardContract()).to.be.equal(blockRewardContract.address)
      expect(await homeContract.gasPrice()).to.be.bignumber.equal(gasPrice)
      const bridgeMode = '0x18762d46' // 4 bytes of keccak256('erc-to-native-core')
      expect(await homeContract.getBridgeMode()).to.be.equal(bridgeMode)
      const { major, minor, patch } = await homeContract.getBridgeInterfacesVersion()
      expect(major).to.be.bignumber.gte(ZERO)
      expect(minor).to.be.bignumber.gte(ZERO)
      expect(patch).to.be.bignumber.gte(ZERO)

      const feeManagerContract = await homeContract.feeManagerContract()
      feeManagerContract.should.be.equals(feeManager.address)
      const bridgeHomeFee = await homeContract.getHomeFee()
      bridgeHomeFee.should.be.bignumber.equal(homeFee)
      const bridgeForeignFee = await homeContract.getForeignFee()
      bridgeForeignFee.should.be.bignumber.equal(foreignFee)
    })

    it('cant initialize with invalid arguments', async () => {
      false.should.be.equal(await homeContract.isInitialized())
      await homeContract
        .rewardableInitialize(
          validatorContract.address,
          ['3', '2', '1'],
          gasPrice,
          0,
          blockRewardContract.address,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          feeManager.address,
          [homeFee, foreignFee],
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract
        .rewardableInitialize(
          owner,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          blockRewardContract.address,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          feeManager.address,
          [homeFee, foreignFee],
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract
        .rewardableInitialize(
          ZERO_ADDRESS,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          blockRewardContract.address,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          feeManager.address,
          [homeFee, foreignFee],
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract
        .rewardableInitialize(
          validatorContract.address,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          owner,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          feeManager.address,
          [homeFee, foreignFee],
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract
        .rewardableInitialize(
          validatorContract.address,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          blockRewardContract.address,
          [halfEther, oneEther],
          owner,
          feeManager.address,
          [homeFee, foreignFee],
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract
        .rewardableInitialize(
          validatorContract.address,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          blockRewardContract.address,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          ZERO_ADDRESS,
          [homeFee, foreignFee],
          decimalShiftZero
        )
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract.rewardableInitialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        decimalShiftZero
      ).should.be.fulfilled
      true.should.be.equal(await homeContract.isInitialized())
    })

    it('can update fee contract', async () => {
      await homeContract.rewardableInitialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        decimalShiftZero
      ).should.be.fulfilled

      // Given
      const newFeeManager = await FeeManagerErcToNative.new()

      // When
      await homeContract.setFeeManagerContract(newFeeManager.address, { from: owner }).should.be.fulfilled

      // Then
      const feeManagerContract = await homeContract.feeManagerContract()
      feeManagerContract.should.be.equals(newFeeManager.address)
    })

    it('can update fee', async () => {
      await homeContract.rewardableInitialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        decimalShiftZero
      ).should.be.fulfilled

      // Given
      const newHomeFee = ether('0.1')
      const newForeignFee = ether('0.2')

      // When
      await homeContract.setHomeFee(newHomeFee, { from: owner }).should.be.fulfilled
      await homeContract.setForeignFee(newForeignFee, { from: owner }).should.be.fulfilled

      // Then
      const bridgeHomeFee = await homeContract.getHomeFee()
      bridgeHomeFee.should.be.bignumber.equal(newHomeFee)
      const bridgeForeignFee = await homeContract.getForeignFee()
      bridgeForeignFee.should.be.bignumber.equal(newForeignFee)
    })
    it('fee should be less than 100%', async () => {
      await homeContract.rewardableInitialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        decimalShiftZero
      ).should.be.fulfilled

      const invalidFee = ether('1')
      const invalidBigFee = ether('2')

      await homeContract.setHomeFee(invalidFee, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      await homeContract.setForeignFee(invalidFee, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      await homeContract.setHomeFee(invalidBigFee, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      await homeContract.setForeignFee(invalidBigFee, { from: owner }).should.be.rejectedWith(ERROR_MSG)

      const newHomeFee = ether('0.99')
      const newForeignFee = ether('0.99')

      await homeContract.setHomeFee(newHomeFee, { from: owner }).should.be.fulfilled
      await homeContract.setForeignFee(newForeignFee, { from: owner }).should.be.fulfilled

      expect(await homeContract.getHomeFee()).to.be.bignumber.equals(newHomeFee)
      expect(await homeContract.getForeignFee()).to.be.bignumber.equals(newForeignFee)
    })
  })
  describe('#fallback', async () => {
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
      await homeContract.initialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )
    })

    it('should accept native coins', async () => {
      const currentDay = await homeContract.getCurrentDay()
      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      await blockRewardContract.addMintedTotallyByBridge(10, homeContract.address)
      const minted = await blockRewardContract.mintedTotallyByBridge(homeContract.address)
      minted.should.be.bignumber.equal('10')

      const { logs } = await homeContract.sendTransaction({ from: accounts[1], value: 1 }).should.be.fulfilled

      expectEventInLogs(logs, 'UserRequestForSignature', { recipient: accounts[1], value: toBN(1) })
      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal('1')
      expect(await homeContract.totalBurntCoins()).to.be.bignumber.equal('1')

      const homeContractBalance = toBN(await web3.eth.getBalance(homeContract.address))
      homeContractBalance.should.be.bignumber.equal(ZERO)
    })

    it('should accumulate burnt coins', async () => {
      await blockRewardContract.addMintedTotallyByBridge(10, homeContract.address)

      const currentDay = await homeContract.getCurrentDay()
      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      await homeContract.sendTransaction({ from: accounts[1], value: 1 }).should.be.fulfilled
      expect(await homeContract.totalBurntCoins()).to.be.bignumber.equal('1')

      await homeContract.sendTransaction({ from: accounts[1], value: 1 }).should.be.fulfilled
      expect(await homeContract.totalBurntCoins()).to.be.bignumber.equal('2')

      await homeContract.sendTransaction({ from: accounts[1], value: 1 }).should.be.fulfilled
      expect(await homeContract.totalBurntCoins()).to.be.bignumber.equal('3')

      const homeContractBalance = toBN(await web3.eth.getBalance(homeContract.address))
      homeContractBalance.should.be.bignumber.equal(ZERO)
    })

    it('doesnt let you send more than daily limit', async () => {
      await blockRewardContract.addMintedTotallyByBridge(10, homeContract.address)

      const currentDay = await homeContract.getCurrentDay()
      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      await homeContract.sendTransaction({ from: accounts[1], value: 1 }).should.be.fulfilled

      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal('1')
      expect(await homeContract.totalBurntCoins()).to.be.bignumber.equal('1')

      await homeContract.sendTransaction({ from: accounts[1], value: 1 }).should.be.fulfilled
      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal('2')

      await homeContract.sendTransaction({ from: accounts[1], value: 2 }).should.be.rejectedWith(ERROR_MSG)

      await homeContract.setDailyLimit(4).should.be.fulfilled
      await homeContract.sendTransaction({ from: accounts[1], value: 2 }).should.be.fulfilled
      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal('4')
      expect(await homeContract.totalBurntCoins()).to.be.bignumber.equal('4')
    })

    it('doesnt let you send more than max amount per tx', async () => {
      await blockRewardContract.addMintedTotallyByBridge(200, homeContract.address)

      await homeContract.sendTransaction({
        from: accounts[1],
        value: 1
      }).should.be.fulfilled
      await homeContract
        .sendTransaction({
          from: accounts[1],
          value: 3
        })
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract.setMaxPerTx(100).should.be.rejectedWith(ERROR_MSG)
      await homeContract.setDailyLimit(100).should.be.fulfilled
      await homeContract.setMaxPerTx(99).should.be.fulfilled
      // meets max per tx and daily limit
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 99
      }).should.be.fulfilled
      // above daily limit
      await homeContract
        .sendTransaction({
          from: accounts[1],
          value: 1
        })
        .should.be.rejectedWith(ERROR_MSG)
    })

    it('should not let to deposit less than minPerTx', async () => {
      const newDailyLimit = 100
      const newMaxPerTx = 50
      const newMinPerTx = 20

      await blockRewardContract.addMintedTotallyByBridge(200, homeContract.address)

      await homeContract.setDailyLimit(newDailyLimit).should.be.fulfilled
      await homeContract.setMaxPerTx(newMaxPerTx).should.be.fulfilled
      await homeContract.setMinPerTx(newMinPerTx).should.be.fulfilled

      await homeContract.sendTransaction({ from: accounts[1], value: newMinPerTx }).should.be.fulfilled
      await homeContract
        .sendTransaction({ from: accounts[1], value: newMinPerTx - 1 })
        .should.be.rejectedWith(ERROR_MSG)
    })

    it('should fail if not enough bridged tokens', async () => {
      const initiallyMinted = await blockRewardContract.mintedTotallyByBridge(homeContract.address)
      initiallyMinted.should.be.bignumber.equal(ZERO)

      await homeContract.sendTransaction({ from: accounts[1], value: 1 }).should.be.rejectedWith(ERROR_MSG)

      await blockRewardContract.addMintedTotallyByBridge(2, homeContract.address)

      await homeContract.sendTransaction({ from: accounts[1], value: 1 }).should.be.fulfilled

      await homeContract.sendTransaction({ from: accounts[1], value: 1 }).should.be.fulfilled

      await homeContract.sendTransaction({ from: accounts[1], value: 1 }).should.be.rejectedWith(ERROR_MSG)

      const minted = await blockRewardContract.mintedTotallyByBridge(homeContract.address)
      const burnt = await homeContract.totalBurntCoins()

      minted.should.be.bignumber.equal('2')
      burnt.should.be.bignumber.equal('2')
    })
  })
  describe('#relayTokens', () => {
    const recipient = accounts[7]
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
      await homeContract.initialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )
    })
    it('should accept native coins and alternative receiver', async () => {
      const currentDay = await homeContract.getCurrentDay()
      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      await blockRewardContract.addMintedTotallyByBridge(10, homeContract.address)
      const minted = await blockRewardContract.mintedTotallyByBridge(homeContract.address)
      minted.should.be.bignumber.equal('10')

      const { logs } = await homeContract.relayTokens(recipient, { from: accounts[1], value: 1 }).should.be.fulfilled

      expectEventInLogs(logs, 'UserRequestForSignature', { recipient, value: toBN(1) })
      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal('1')
      expect(await homeContract.totalBurntCoins()).to.be.bignumber.equal('1')

      const homeContractBalance = toBN(await web3.eth.getBalance(homeContract.address))
      homeContractBalance.should.be.bignumber.equal(ZERO)
    })
    it('should accumulate burnt coins', async () => {
      await blockRewardContract.addMintedTotallyByBridge(10, homeContract.address)

      const currentDay = await homeContract.getCurrentDay()
      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      await homeContract.relayTokens(recipient, { from: accounts[1], value: 1 }).should.be.fulfilled
      expect(await homeContract.totalBurntCoins()).to.be.bignumber.equal('1')

      await homeContract.relayTokens(recipient, { from: accounts[1], value: 1 }).should.be.fulfilled
      expect(await homeContract.totalBurntCoins()).to.be.bignumber.equal('2')

      await homeContract.relayTokens(recipient, { from: accounts[1], value: 1 }).should.be.fulfilled
      expect(await homeContract.totalBurntCoins()).to.be.bignumber.equal('3')

      const homeContractBalance = toBN(await web3.eth.getBalance(homeContract.address))
      homeContractBalance.should.be.bignumber.equal(ZERO)
    })
    it('doesnt let you send more than daily limit', async () => {
      await blockRewardContract.addMintedTotallyByBridge(10, homeContract.address)

      const currentDay = await homeContract.getCurrentDay()
      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

      await homeContract.relayTokens(recipient, { from: accounts[1], value: 1 }).should.be.fulfilled

      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal('1')
      expect(await homeContract.totalBurntCoins()).to.be.bignumber.equal('1')

      await homeContract.relayTokens(recipient, { from: accounts[1], value: 1 }).should.be.fulfilled
      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal('2')

      await homeContract.relayTokens(recipient, { from: accounts[1], value: 2 }).should.be.rejectedWith(ERROR_MSG)

      await homeContract.setDailyLimit(4).should.be.fulfilled
      await homeContract.relayTokens(recipient, { from: accounts[1], value: 2 }).should.be.fulfilled
      expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal('4')
      expect(await homeContract.totalBurntCoins()).to.be.bignumber.equal('4')
    })
    it('doesnt let you send more than max amount per tx', async () => {
      await blockRewardContract.addMintedTotallyByBridge(200, homeContract.address)

      await homeContract.relayTokens(recipient, {
        from: accounts[1],
        value: 1
      }).should.be.fulfilled
      await homeContract
        .relayTokens(recipient, {
          from: accounts[1],
          value: 3
        })
        .should.be.rejectedWith(ERROR_MSG)
      await homeContract.setMaxPerTx(100).should.be.rejectedWith(ERROR_MSG)
      await homeContract.setDailyLimit(100).should.be.fulfilled
      await homeContract.setMaxPerTx(99).should.be.fulfilled
      // meets max per tx and daily limit
      await homeContract.relayTokens(recipient, {
        from: accounts[1],
        value: 99
      }).should.be.fulfilled
      // above daily limit
      await homeContract
        .relayTokens(recipient, {
          from: accounts[1],
          value: 1
        })
        .should.be.rejectedWith(ERROR_MSG)
    })
    it('should not let to deposit less than minPerTx', async () => {
      const newDailyLimit = 100
      const newMaxPerTx = 50
      const newMinPerTx = 20

      await blockRewardContract.addMintedTotallyByBridge(200, homeContract.address)

      await homeContract.setDailyLimit(newDailyLimit).should.be.fulfilled
      await homeContract.setMaxPerTx(newMaxPerTx).should.be.fulfilled
      await homeContract.setMinPerTx(newMinPerTx).should.be.fulfilled

      await homeContract.relayTokens(recipient, { from: accounts[1], value: newMinPerTx }).should.be.fulfilled
      await homeContract
        .relayTokens(recipient, { from: accounts[1], value: newMinPerTx - 1 })
        .should.be.rejectedWith(ERROR_MSG)
    })
    it('should fail if not enough bridged tokens', async () => {
      const initiallyMinted = await blockRewardContract.mintedTotallyByBridge(homeContract.address)
      initiallyMinted.should.be.bignumber.equal(ZERO)

      await homeContract.relayTokens(recipient, { from: accounts[1], value: 1 }).should.be.rejectedWith(ERROR_MSG)

      await blockRewardContract.addMintedTotallyByBridge(2, homeContract.address)

      await homeContract.relayTokens(recipient, { from: accounts[1], value: 1 }).should.be.fulfilled

      await homeContract.relayTokens(recipient, { from: accounts[1], value: 1 }).should.be.fulfilled

      await homeContract.relayTokens(recipient, { from: accounts[1], value: 1 }).should.be.rejectedWith(ERROR_MSG)

      const minted = await blockRewardContract.mintedTotallyByBridge(homeContract.address)
      const burnt = await homeContract.totalBurntCoins()

      minted.should.be.bignumber.equal('2')
      burnt.should.be.bignumber.equal('2')
    })
  })
  describe('#setting limits', async () => {
    let homeContract
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
      await homeContract.initialize(
        validatorContract.address,
        ['3', '2', '1'],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )
    })
    it('setMaxPerTx allows to set only to owner and cannot be more than daily limit', async () => {
      await homeContract.setMaxPerTx(2, { from: authorities[0] }).should.be.rejectedWith(ERROR_MSG)
      await homeContract.setMaxPerTx(2, { from: owner }).should.be.fulfilled

      await homeContract.setMaxPerTx(3, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      const maxPerTx = await homeContract.maxPerTx()
      maxPerTx.should.be.bignumber.equal(toBN(2))
    })

    it('setMinPerTx allows to set only to owner and cannot be more than daily limit and should be less than maxPerTx', async () => {
      await homeContract.setMinPerTx(1, { from: authorities[0] }).should.be.rejectedWith(ERROR_MSG)
      await homeContract.setMinPerTx(1, { from: owner }).should.be.fulfilled

      await homeContract.setMinPerTx(2, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      const minPerTx = await homeContract.minPerTx()
      minPerTx.should.be.bignumber.equal(toBN(1))
    })

    it('setMaxPerTx allows to set limit to zero', async () => {
      await homeContract.setMaxPerTx(0, { from: owner }).should.be.fulfilled

      const maxPerTx = await homeContract.maxPerTx()
      maxPerTx.should.be.bignumber.equal(ZERO)
    })

    it('setExecutionMaxPerTx allows to set only to owner and cannot be more than execution daily limit', async () => {
      const newValue = ether('0.3')

      const initialExecutionMaxPerTx = await homeContract.executionMaxPerTx()

      initialExecutionMaxPerTx.should.be.bignumber.not.equal(newValue)

      await homeContract.setExecutionMaxPerTx(newValue, { from: authorities[0] }).should.be.rejectedWith(ERROR_MSG)
      await homeContract.setExecutionMaxPerTx(newValue, { from: owner }).should.be.fulfilled

      await homeContract.setExecutionMaxPerTx(oneEther, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      const executionMaxPerTx = await homeContract.executionMaxPerTx()
      executionMaxPerTx.should.be.bignumber.equal(newValue)
    })

    it('executionDailyLimit allows to set only to owner', async () => {
      const newValue = ether('1.5')

      const initialExecutionDailyLimit = await homeContract.executionDailyLimit()

      initialExecutionDailyLimit.should.be.bignumber.not.equal(newValue)

      await homeContract.setExecutionDailyLimit(newValue, { from: authorities[0] }).should.be.rejectedWith(ERROR_MSG)
      await homeContract.setExecutionDailyLimit('2', { from: owner }).should.be.rejectedWith(ERROR_MSG)

      await homeContract.setExecutionDailyLimit(newValue, { from: owner }).should.be.fulfilled
      expect(await homeContract.executionDailyLimit()).to.be.bignumber.equal(newValue)

      await homeContract.setExecutionDailyLimit(0, { from: owner }).should.be.fulfilled
      expect(await homeContract.executionDailyLimit()).to.be.bignumber.equal(ZERO)

      await homeContract.setExecutionDailyLimit(newValue, { from: owner }).should.be.fulfilled
      expect(await homeContract.executionDailyLimit()).to.be.bignumber.equal(newValue)
    })
  })
  describe('#executeAffirmation', async () => {
    let homeBridge
    beforeEach(async () => {
      homeBridge = await HomeBridge.new()
      await homeBridge.initialize(
        validatorContract.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )
      await blockRewardContract.sendTransaction({
        from: accounts[2],
        value: oneEther
      }).should.be.fulfilled
    })

    it('should allow validator to executeAffirmation', async () => {
      const recipient = accounts[5]
      const value = halfEther
      const balanceBefore = await web3.eth.getBalance(recipient)
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      })

      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: authorities[0],
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })
      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.bignumber.equal(toBN(balanceBefore).add(value))

      const msgHash = web3.utils.soliditySha3(recipient, value, transactionHash)
      const senderHash = web3.utils.soliditySha3(authorities[0], msgHash)
      true.should.be.equal(await homeBridge.affirmationsSigned(senderHash))
    })

    it('should allow validator to executeAffirmation with zero value', async () => {
      const recipient = accounts[5]
      const value = ZERO
      const balanceBefore = await web3.eth.getBalance(recipient)
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      })

      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: authorities[0],
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.bignumber.equal(toBN(balanceBefore).add(value))

      const msgHash = web3.utils.soliditySha3(recipient, value, transactionHash)
      const senderHash = web3.utils.soliditySha3(authorities[0], msgHash)
      true.should.be.equal(await homeBridge.affirmationsSigned(senderHash))
    })

    it('test with 2 signatures required', async () => {
      const validatorContractWith2Signatures = await BridgeValidators.new()
      const authoritiesThreeAccs = [accounts[1], accounts[2], accounts[3]]
      const ownerOfValidators = accounts[0]
      await validatorContractWith2Signatures.initialize(2, authoritiesThreeAccs, ownerOfValidators)
      const homeBridgeWithTwoSigs = await HomeBridge.new()
      await homeBridgeWithTwoSigs.initialize(
        validatorContractWith2Signatures.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )
      const recipient = accounts[5]
      const value = halfEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))
      const msgHash = web3.utils.soliditySha3(recipient, value, transactionHash)

      const { logs } = await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesThreeAccs[0]
      }).should.be.fulfilled
      expectEventInLogs(logs, 'SignedForAffirmation', { signer: authorities[0], transactionHash })

      const notProcessed = await homeBridgeWithTwoSigs.numAffirmationsSigned(msgHash)
      notProcessed.should.be.bignumber.equal('1')

      await homeBridgeWithTwoSigs
        .executeAffirmation(recipient, value, transactionHash, { from: authoritiesThreeAccs[0] })
        .should.be.rejectedWith(ERROR_MSG)
      const secondSignature = await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesThreeAccs[1]
      }).should.be.fulfilled

      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))

      expectEventInLogs(secondSignature.logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const senderHash = web3.utils.soliditySha3(authoritiesThreeAccs[0], msgHash)
      true.should.be.equal(await homeBridgeWithTwoSigs.affirmationsSigned(senderHash))

      const senderHash2 = web3.utils.soliditySha3(authoritiesThreeAccs[1], msgHash)
      true.should.be.equal(await homeBridgeWithTwoSigs.affirmationsSigned(senderHash2))

      const markedAsProcessed = await homeBridgeWithTwoSigs.numAffirmationsSigned(msgHash)
      const processed = toBN(2)
        .pow(toBN(255))
        .add(toBN(2))
      markedAsProcessed.should.be.bignumber.equal(processed)
    })

    it('should not allow non-validator to execute affirmation', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      await homeBridge
        .executeAffirmation(recipient, value, transactionHash, { from: accounts[7] })
        .should.be.rejectedWith(ERROR_MSG)
    })

    it('should fail if the block reward contract is not set', async () => {
      homeBridge = await HomeBridge.new()
      await homeBridge.initialize(
        validatorContract.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        ZERO_ADDRESS,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )

      const recipient = accounts[5]
      const value = halfEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      await homeBridge
        .executeAffirmation(recipient, value, transactionHash, { from: authorities[0] })
        .should.be.rejectedWith(ERROR_MSG)
    })
    it('works with 5 validators and 3 required signatures', async () => {
      const recipient = accounts[8]
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const ownerOfValidators = accounts[0]
      const validatorContractWith3Signatures = await BridgeValidators.new()
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)

      const homeBridgeWithThreeSigs = await HomeBridge.new()
      await homeBridgeWithThreeSigs.initialize(
        validatorContractWith3Signatures.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )

      const value = halfEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      const { logs } = await homeBridgeWithThreeSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesFiveAccs[0]
      }).should.be.fulfilled

      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: authorities[0],
        transactionHash
      })

      await homeBridgeWithThreeSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesFiveAccs[1]
      }).should.be.fulfilled
      const thirdSignature = await homeBridgeWithThreeSigs.executeAffirmation(recipient, value, transactionHash, {
        from: authoritiesFiveAccs[2]
      }).should.be.fulfilled

      expectEventInLogs(thirdSignature.logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })
    })
    it('should not allow execute affirmation over foreign max tx limit', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      expectEventInLogs(logs, 'AmountLimitExceeded', {
        recipient,
        value,
        transactionHash
      })
    })
    it('should fail if txHash already set as above of limits', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      expectEventInLogs(logs, 'AmountLimitExceeded', {
        recipient,
        value,
        transactionHash
      })

      await homeBridge
        .executeAffirmation(recipient, value, transactionHash, { from: authorities[0] })
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridge
        .executeAffirmation(accounts[6], value, transactionHash, { from: authorities[0] })
        .should.be.rejectedWith(ERROR_MSG)
    })
    it('should not allow execute affirmation over daily foreign limit', async () => {
      await blockRewardContract.sendTransaction({
        from: accounts[2],
        value: oneEther
      }).should.be.fulfilled

      const recipient = accounts[5]
      const value = halfEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: authorities[0],
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const transactionHash2 = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
      const { logs: logs2 } = await homeBridge.executeAffirmation(recipient, value, transactionHash2, {
        from: authorities[0]
      }).should.be.fulfilled

      expectEventInLogs(logs2, 'SignedForAffirmation', {
        signer: authorities[0],
        transactionHash: transactionHash2
      })
      expectEventInLogs(logs2, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash: transactionHash2
      })

      const transactionHash3 = '0x69debd8fd1923c9cb3cd8ef6461e2740b2d037943b941729d5a47671a2bb8712'
      const { logs: logs3 } = await homeBridge.executeAffirmation(recipient, value, transactionHash3, {
        from: authorities[0]
      }).should.be.fulfilled

      expectEventInLogs(logs3, 'AmountLimitExceeded', {
        recipient,
        value,
        transactionHash: transactionHash3
      })

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()

      outOfLimitAmount.should.be.bignumber.equal(halfEther)

      const transactionHash4 = '0xc9ffe298d85ec5c515153608924b7bdcf1835539813dcc82cdbcc071170c3196'
      const { logs: logs4 } = await homeBridge.executeAffirmation(recipient, value, transactionHash4, {
        from: authorities[0]
      }).should.be.fulfilled

      expectEventInLogs(logs4, 'AmountLimitExceeded', {
        recipient,
        value,
        transactionHash: transactionHash4
      })

      const newOutOfLimitAmount = await homeBridge.outOfLimitAmount()
      newOutOfLimitAmount.should.be.bignumber.equal(oneEther)
    })
  })
  describe('#submitSignature', async () => {
    let validatorContractWith2Signatures
    let authoritiesThreeAccs
    let ownerOfValidators
    let homeBridgeWithTwoSigs
    beforeEach(async () => {
      validatorContractWith2Signatures = await BridgeValidators.new()
      authoritiesThreeAccs = [accounts[1], accounts[2], accounts[3]]
      ownerOfValidators = accounts[0]
      await validatorContractWith2Signatures.initialize(2, authoritiesThreeAccs, ownerOfValidators)
      homeBridgeWithTwoSigs = await HomeBridge.new()
      await homeBridgeWithTwoSigs.initialize(
        validatorContractWith2Signatures.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )
    })

    it('allows a validator to submit a signature', async () => {
      const recipientAccount = accounts[8]
      const value = halfEther
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithTwoSigs.address)

      const signature = await sign(authoritiesThreeAccs[0], message)
      const { logs } = await homeBridgeWithTwoSigs.submitSignature(signature, message, {
        from: authorities[0]
      }).should.be.fulfilled

      logs[0].event.should.be.equal('SignedForUserRequest')
      const { messageHash } = logs[0].args
      const signatureFromContract = await homeBridgeWithTwoSigs.signature(messageHash, 0)
      const messageFromContract = await homeBridgeWithTwoSigs.message(messageHash)
      signature.should.be.equal(signatureFromContract)
      messageFromContract.should.be.equal(messageFromContract)
      const hashMsg = web3.utils.soliditySha3(message)
      const hashSenderMsg = web3.utils.soliditySha3(authorities[0], hashMsg)
      true.should.be.equal(await homeBridgeWithTwoSigs.messagesSigned(hashSenderMsg))
    })

    it('when enough requiredSignatures are collected, CollectedSignatures event is emitted', async () => {
      const recipientAccount = accounts[8]
      const value = halfEther
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithTwoSigs.address)

      const signature = await sign(authoritiesThreeAccs[0], message)
      const signature2 = await sign(authoritiesThreeAccs[1], message)
      expect(await validatorContractWith2Signatures.requiredSignatures()).to.be.bignumber.equal('2')

      await homeBridgeWithTwoSigs.submitSignature(signature, message, {
        from: authoritiesThreeAccs[0]
      }).should.be.fulfilled
      await homeBridgeWithTwoSigs
        .submitSignature(signature, message, { from: authoritiesThreeAccs[0] })
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridgeWithTwoSigs
        .submitSignature(signature, message, { from: authoritiesThreeAccs[1] })
        .should.be.rejectedWith(ERROR_MSG)
      const { logs } = await homeBridgeWithTwoSigs.submitSignature(signature2, message, {
        from: authoritiesThreeAccs[1]
      }).should.be.fulfilled

      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesThreeAccs[1])
    })
    it('works with 5 validators and 3 required signatures', async () => {
      const recipientAccount = accounts[8]
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const validatorContractWith3Signatures = await BridgeValidators.new()
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)

      const homeBridgeWithThreeSigs = await HomeBridge.new()
      await homeBridgeWithThreeSigs.initialize(
        validatorContractWith3Signatures.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )

      const value = halfEther
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithThreeSigs.address)
      const signature = await sign(authoritiesFiveAccs[0], message)
      const signature2 = await sign(authoritiesFiveAccs[1], message)
      const signature3 = await sign(authoritiesFiveAccs[2], message)
      expect(await validatorContractWith3Signatures.requiredSignatures()).to.be.bignumber.equal('3')

      await homeBridgeWithThreeSigs.submitSignature(signature, message, {
        from: authoritiesFiveAccs[0]
      }).should.be.fulfilled
      await homeBridgeWithThreeSigs.submitSignature(signature2, message, {
        from: authoritiesFiveAccs[1]
      }).should.be.fulfilled
      const { logs } = await homeBridgeWithThreeSigs.submitSignature(signature3, message, {
        from: authoritiesFiveAccs[2]
      }).should.be.fulfilled
      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesFiveAccs[2])
    })
    it('attack when increasing requiredSignatures', async () => {
      const recipientAccount = accounts[8]
      const value = halfEther
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithTwoSigs.address)
      const signature = await sign(authoritiesThreeAccs[0], message)
      const signature2 = await sign(authoritiesThreeAccs[1], message)
      const signature3 = await sign(authoritiesThreeAccs[2], message)
      expect(await validatorContractWith2Signatures.requiredSignatures()).to.be.bignumber.equal('2')

      await homeBridgeWithTwoSigs.submitSignature(signature, message, {
        from: authoritiesThreeAccs[0]
      }).should.be.fulfilled
      await homeBridgeWithTwoSigs
        .submitSignature(signature, message, { from: authoritiesThreeAccs[0] })
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridgeWithTwoSigs
        .submitSignature(signature, message, { from: authoritiesThreeAccs[1] })
        .should.be.rejectedWith(ERROR_MSG)
      const { logs } = await homeBridgeWithTwoSigs.submitSignature(signature2, message, {
        from: authoritiesThreeAccs[1]
      }).should.be.fulfilled

      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesThreeAccs[1])

      await validatorContractWith2Signatures.setRequiredSignatures(3).should.be.fulfilled
      expect(await validatorContractWith2Signatures.requiredSignatures()).to.be.bignumber.equal('3')
      await homeBridgeWithTwoSigs
        .submitSignature(signature3, message, { from: authoritiesThreeAccs[2] })
        .should.be.rejectedWith(ERROR_MSG)
    })

    it('attack when decreasing requiredSignatures', async () => {
      const recipientAccount = accounts[8]
      const value = halfEther
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
      const message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithTwoSigs.address)
      const signature = await sign(authoritiesThreeAccs[0], message)
      const signature2 = await sign(authoritiesThreeAccs[1], message)
      expect(await validatorContractWith2Signatures.requiredSignatures()).to.be.bignumber.equal('2')

      await homeBridgeWithTwoSigs.submitSignature(signature, message, {
        from: authoritiesThreeAccs[0]
      }).should.be.fulfilled
      await validatorContractWith2Signatures.setRequiredSignatures(1).should.be.fulfilled
      expect(await validatorContractWith2Signatures.requiredSignatures()).to.be.bignumber.equal('1')
      const { logs } = await homeBridgeWithTwoSigs.submitSignature(signature2, message, {
        from: authoritiesThreeAccs[1]
      }).should.be.fulfilled

      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesThreeAccs[1])
    })
  })
  describe('#requiredMessageLength', async () => {
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
    })

    it('should return the required message length', async () => {
      expect(await homeContract.requiredMessageLength()).to.be.bignumber.equal('104')
    })
  })
  describe('#fixAssetsAboveLimits', async () => {
    let homeBridge
    beforeEach(async () => {
      const homeBridgeImpl = await HomeBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      homeBridge = await HomeBridge.at(storageProxy.address)
      await homeBridge.initialize(
        validatorContract.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      )
    })
    it('Should revert if value to unlock is bigger than max per transaction', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const { logs: affirmationLogs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal('AmountLimitExceeded')

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()
      outOfLimitAmount.should.be.bignumber.equal(value)

      await homeBridge.fixAssetsAboveLimits(transactionHash, false, value).should.be.rejectedWith(ERROR_MSG)
    })
    it('Should allow to partially reduce outOfLimitAmount and not emit UserRequestForSignature', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const { logs: affirmationLogs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal('AmountLimitExceeded')

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()
      outOfLimitAmount.should.be.bignumber.equal(value)

      const { logs } = await homeBridge.fixAssetsAboveLimits(transactionHash, false, halfEther).should.be.fulfilled

      logs.length.should.be.equal(1)
      expectEventInLogs(logs, 'AssetAboveLimitsFixed', {
        transactionHash,
        value: halfEther,
        remaining: halfEther
      })
      expect(await homeBridge.outOfLimitAmount()).to.be.bignumber.equal(halfEther)

      const { logs: logsSecondTx } = await homeBridge.fixAssetsAboveLimits(transactionHash, false, halfEther).should.be
        .fulfilled

      logsSecondTx.length.should.be.equal(1)
      expectEventInLogs(logsSecondTx, 'AssetAboveLimitsFixed', {
        transactionHash,
        value: halfEther,
        remaining: ZERO
      })
      expect(await homeBridge.outOfLimitAmount()).to.be.bignumber.equal(ZERO)
    })
    it('Should allow to partially reduce outOfLimitAmount and emit UserRequestForSignature', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const { logs: affirmationLogs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal('AmountLimitExceeded')

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()
      outOfLimitAmount.should.be.bignumber.equal(value)

      const { logs } = await homeBridge.fixAssetsAboveLimits(transactionHash, true, halfEther).should.be.fulfilled

      logs.length.should.be.equal(2)
      expectEventInLogs(logs, 'AssetAboveLimitsFixed', {
        transactionHash,
        value: halfEther,
        remaining: halfEther
      })
      expectEventInLogs(logs, 'UserRequestForSignature', {
        recipient,
        value: halfEther
      })

      expect(await homeBridge.outOfLimitAmount()).to.be.bignumber.equal(halfEther)

      const { logs: logsSecondTx } = await homeBridge.fixAssetsAboveLimits(transactionHash, true, halfEther).should.be
        .fulfilled

      logsSecondTx.length.should.be.equal(2)
      expectEventInLogs(logsSecondTx, 'AssetAboveLimitsFixed', {
        transactionHash,
        value: halfEther,
        remaining: ZERO
      })
      expectEventInLogs(logsSecondTx, 'UserRequestForSignature', {
        recipient,
        value: halfEther
      })

      expect(await homeBridge.outOfLimitAmount()).to.be.bignumber.equal(ZERO)
    })
    it('Should revert if try to unlock more than available', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const { logs: affirmationLogs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal('AmountLimitExceeded')

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()
      outOfLimitAmount.should.be.bignumber.equal(value)

      const { logs } = await homeBridge.fixAssetsAboveLimits(transactionHash, true, halfEther).should.be.fulfilled

      logs.length.should.be.equal(2)
      expectEventInLogs(logs, 'AssetAboveLimitsFixed', {
        transactionHash,
        value: halfEther,
        remaining: halfEther
      })
      expectEventInLogs(logs, 'UserRequestForSignature', {
        recipient,
        value: halfEther
      })

      expect(await homeBridge.outOfLimitAmount()).to.be.bignumber.equal(halfEther)

      const { logs: logsSecondTx } = await homeBridge.fixAssetsAboveLimits(transactionHash, true, quarterEther).should
        .be.fulfilled

      logsSecondTx.length.should.be.equal(2)
      expectEventInLogs(logsSecondTx, 'AssetAboveLimitsFixed', {
        transactionHash,
        value: quarterEther,
        remaining: quarterEther
      })
      expectEventInLogs(logsSecondTx, 'UserRequestForSignature', {
        recipient,
        value: quarterEther
      })

      expect(await homeBridge.outOfLimitAmount()).to.be.bignumber.equal(quarterEther)

      await homeBridge.fixAssetsAboveLimits(transactionHash, true, halfEther).should.be.rejectedWith(ERROR_MSG)
      const { logs: logsThirdTx } = await homeBridge.fixAssetsAboveLimits(transactionHash, true, quarterEther).should.be
        .fulfilled
      expectEventInLogs(logsThirdTx, 'AssetAboveLimitsFixed', {
        transactionHash,
        value: quarterEther,
        remaining: ZERO
      })
      expectEventInLogs(logsThirdTx, 'UserRequestForSignature', {
        recipient,
        value: quarterEther
      })

      expect(await homeBridge.outOfLimitAmount()).to.be.bignumber.equal(ZERO)
    })
    it('Should not be allow to be called by an already fixed txHash', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const transactionHash2 = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'

      await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled
      await homeBridge.executeAffirmation(recipient, value, transactionHash2, {
        from: authorities[0]
      }).should.be.fulfilled

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()
      outOfLimitAmount.should.be.bignumber.equal(value.add(value))

      await homeBridge.fixAssetsAboveLimits(transactionHash, false, halfEther).should.be.fulfilled
      await homeBridge.fixAssetsAboveLimits(transactionHash, false, halfEther).should.be.fulfilled

      const newOutOfLimitAmount = await homeBridge.outOfLimitAmount()
      newOutOfLimitAmount.should.be.bignumber.equal(value)

      await homeBridge.fixAssetsAboveLimits(transactionHash, false, halfEther).should.be.rejectedWith(ERROR_MSG)

      await homeBridge.fixAssetsAboveLimits(transactionHash2, false, halfEther).should.be.fulfilled
      await homeBridge.fixAssetsAboveLimits(transactionHash2, false, halfEther).should.be.fulfilled

      expect(await homeBridge.outOfLimitAmount()).to.be.bignumber.equal(ZERO)

      await homeBridge.fixAssetsAboveLimits(transactionHash2, false, halfEther).should.be.rejectedWith(ERROR_MSG)
    })
    it('Should fail if txHash didnt increase out of limit amount', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
      const invalidTxHash = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'

      const { logs: affirmationLogs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal('AmountLimitExceeded')

      await homeBridge.fixAssetsAboveLimits(invalidTxHash, true, halfEther).should.be.rejectedWith(ERROR_MSG)
    })
    it('Should fail if not called by proxyOwner', async () => {
      const recipient = accounts[5]
      const value = oneEther
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      const { logs: affirmationLogs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: authorities[0]
      }).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal('AmountLimitExceeded')

      await homeBridge
        .fixAssetsAboveLimits(transactionHash, true, halfEther, { from: recipient })
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridge.fixAssetsAboveLimits(transactionHash, true, halfEther, { from: owner }).should.be.fulfilled
    })
    it('Should emit UserRequestForSignature with value reduced by fee', async () => {
      // Initialize
      const owner = accounts[9]
      const validators = [accounts[1]]
      const rewards = [accounts[2]]
      const requiredSignatures = 1
      const rewardableValidators = await RewardableValidators.new()
      const homeBridgeImpl = await HomeBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address)
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.sendTransaction({
        from: accounts[2],
        value: oneEther
      }).should.be.fulfilled

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const feeManager = await FeeManagerErcToNative.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setHomeFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = accounts[5]
      const value = oneEther
      const valueCalc = 0.5 * (1 - fee)
      const finalValue = ether(valueCalc.toString())
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      // When
      const { logs: affirmationLogs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled

      expectEventInLogs(affirmationLogs, 'AmountLimitExceeded', {
        recipient,
        value,
        transactionHash
      })

      const { logs } = await homeBridge.fixAssetsAboveLimits(transactionHash, true, halfEther).should.be.fulfilled

      // Then
      logs.length.should.be.equal(2)
      expectEventInLogs(logs, 'AssetAboveLimitsFixed', {
        transactionHash,
        value: halfEther,
        remaining: halfEther
      })
      expectEventInLogs(logs, 'UserRequestForSignature', {
        recipient,
        value: finalValue
      })
    })
  })
  describe('#feeManager', async () => {
    let homeBridge
    let rewardableValidators
    const owner = accounts[9]
    const validators = [accounts[1]]
    const rewards = [accounts[2]]
    const requiredSignatures = 1
    beforeEach(async () => {
      rewardableValidators = await RewardableValidators.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      const homeBridgeImpl = await HomeBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      homeBridge = await HomeBridge.at(storageProxy.address)
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.sendTransaction({
        from: accounts[2],
        value: oneEther
      }).should.be.fulfilled
    })
    it('should be able to set and get fee manager contract', async () => {
      // Given
      const feeManager = await FeeManagerErcToNative.new()

      // When
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled

      // Then
      const feeManagerContract = await homeBridge.feeManagerContract()
      feeManagerContract.should.be.equals(feeManager.address)
    })
    it('should be able to set and get fees', async () => {
      // Given
      // 10% fee
      const homeFee = ether('0.1')
      const foreignFee = ether('0.2')
      const feeManager = await FeeManagerErcToNative.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled

      // When
      await homeBridge.setHomeFee(homeFee, { from: owner }).should.be.fulfilled
      await homeBridge.setForeignFee(foreignFee, { from: owner }).should.be.fulfilled

      // Then
      const bridgeHomeFee = await homeBridge.getHomeFee()
      bridgeHomeFee.should.be.bignumber.equal(homeFee)
      const bridgeForeignFee = await homeBridge.getForeignFee()
      bridgeForeignFee.should.be.bignumber.equal(foreignFee)
    })
    it('should be able to get fee manager mode', async () => {
      // Given
      const feeManager = await FeeManagerErcToNative.new()
      const bothDirectionsModeHash = '0xd7de965f'

      // When
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled

      // Then
      const feeManagerMode = await homeBridge.getFeeManagerMode()
      feeManagerMode.should.be.equals(bothDirectionsModeHash)
    })
    it('should be able to get fee manager mode from POSDAO fee manager', async () => {
      // Given
      const feeManager = await FeeManagerErcToNativePOSDAO.new()
      const bothDirectionsModeHash = '0xd7de965f'

      // When
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled

      // Then
      const feeManagerMode = await homeBridge.getFeeManagerMode()
      feeManagerMode.should.be.equals(bothDirectionsModeHash)
    })
  })
  describe('#feeManager_ExecuteAffirmation', async () => {
    it('should distribute fee to validator', async () => {
      // Initialize
      const owner = accounts[9]
      const validators = [accounts[1]]
      const rewards = [accounts[2]]
      const requiredSignatures = 1
      const rewardableValidators = await RewardableValidators.new()
      const homeBridgeImpl = await HomeBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address)
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.sendTransaction({
        from: accounts[2],
        value: oneEther
      }).should.be.fulfilled

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const feeManager = await FeeManagerErcToNative.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setForeignFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = accounts[5]
      const value = halfEther
      const valueCalc = 0.5 * (1 - fee)
      const finalValue = ether(valueCalc.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))
      const rewardAddressBalanceBefore = toBN(await web3.eth.getBalance(rewards[0]))
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      // When
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled

      // Then
      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: validators[0],
        transactionHash
      })
      expectEventInLogs(logs, 'FeeDistributedFromAffirmation', {
        feeAmount,
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      const rewardAddressBalanceAfter = toBN(await web3.eth.getBalance(rewards[0]))

      rewardAddressBalanceAfter.should.be.bignumber.equal(rewardAddressBalanceBefore.add(feeAmount))
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(finalValue))
    })
    it('should distribute fee to 3 validators', async () => {
      // Initialize
      const owner = accounts[9]
      const validators = [accounts[1], accounts[2], accounts[3]]
      const rewards = [accounts[4], accounts[5], accounts[6]]
      const requiredSignatures = 2
      const rewardableValidators = await RewardableValidators.new()
      const homeBridgeImpl = await HomeBridge.new()
      const blockRewardContract = await BlockReward.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address)
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.sendTransaction({
        from: accounts[0],
        value: halfEther
      }).should.be.fulfilled

      // Given
      const initialBlockRewardBalance = toBN(await web3.eth.getBalance(blockRewardContract.address))
      initialBlockRewardBalance.should.be.bignumber.equal(halfEther)

      const value = halfEther
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const valueCalc = 0.5 * (1 - fee)
      const finalValue = ether(valueCalc.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())
      // totalFee / 3
      const feePerValidator = toBN(166666666666666)
      const feePerValidatorPlusDiff = toBN(166666666666668)
      const feeManager = await FeeManagerErcToNative.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setForeignFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = accounts[8]
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))

      const initialBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewards[0]))
      const initialBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewards[1]))
      const initialBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewards[2]))

      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      // When
      const { logs: logsValidator1 } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[1]
      }).should.be.fulfilled

      // Then
      logsValidator1.length.should.be.equals(1)

      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: validators[1],
        transactionHash
      })
      expectEventInLogs(logs, 'FeeDistributedFromAffirmation', {
        feeAmount,
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(finalValue))

      const updatedBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewards[0]))
      const updatedBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewards[1]))
      const updatedBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewards[2]))

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

      const blockRewardBalance = toBN(await web3.eth.getBalance(blockRewardContract.address))
      blockRewardBalance.should.be.bignumber.equal(ZERO)
    })
    it('should distribute fee to 5 validators', async () => {
      // Initialize
      const owner = accounts[0]
      const validators = [accounts[0], accounts[1], accounts[2], accounts[3], accounts[4]]
      const rewards = [accounts[5], accounts[6], accounts[7], accounts[8], accounts[9]]
      const requiredSignatures = 5
      const rewardableValidators = await RewardableValidators.new()
      const homeBridgeImpl = await HomeBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address)
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.sendTransaction({
        from: accounts[0],
        value: oneEther
      }).should.be.fulfilled

      // Given
      const value = halfEther
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())
      const feePerValidator = feeAmount.div(toBN(5))
      const feeManager = await FeeManagerErcToNative.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setForeignFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = '0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955'
      const balanceBefore = toBN(await web3.eth.getBalance(recipient))

      const initialBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewards[0]))
      const initialBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewards[1]))
      const initialBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewards[2]))
      const initialBalanceRewardAddress4 = toBN(await web3.eth.getBalance(rewards[3]))
      const initialBalanceRewardAddress5 = toBN(await web3.eth.getBalance(rewards[4]))

      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      // When
      const { logs: logsValidator1 } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[1]
      }).should.be.fulfilled
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[2]
      }).should.be.fulfilled
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[3]
      }).should.be.fulfilled
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[4]
      }).should.be.fulfilled

      // Then
      logsValidator1.length.should.be.equals(1)

      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: validators[4],
        transactionHash
      })
      expectEventInLogs(logs, 'FeeDistributedFromAffirmation', {
        feeAmount,
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const balanceAfter = toBN(await web3.eth.getBalance(recipient))
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value.sub(feeAmount)))

      const updatedBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewards[0]))
      const updatedBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewards[1]))
      const updatedBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewards[2]))
      const updatedBalanceRewardAddress4 = toBN(await web3.eth.getBalance(rewards[3]))
      const updatedBalanceRewardAddress5 = toBN(await web3.eth.getBalance(rewards[4]))

      updatedBalanceRewardAddress1.should.be.bignumber.equal(initialBalanceRewardAddress1.add(feePerValidator))
      updatedBalanceRewardAddress2.should.be.bignumber.equal(initialBalanceRewardAddress2.add(feePerValidator))
      updatedBalanceRewardAddress3.should.be.bignumber.equal(initialBalanceRewardAddress3.add(feePerValidator))
      updatedBalanceRewardAddress4.should.be.bignumber.equal(initialBalanceRewardAddress4.add(feePerValidator))
      updatedBalanceRewardAddress5.should.be.bignumber.equal(initialBalanceRewardAddress5.add(feePerValidator))
    })

    it('should distribute fee to max allowed number of validators', async () => {
      // Initialize
      const owner = accounts[0]
      const validators = createAccounts(web3, MAX_VALIDATORS)
      validators[0] = accounts[2]
      const rewards = createAccounts(web3, MAX_VALIDATORS)
      const requiredSignatures = 1
      const rewardableValidators = await RewardableValidators.new()
      const homeBridge = await HomeBridge.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.sendTransaction({
        from: owner,
        value: oneEther
      }).should.be.fulfilled

      // Given
      const value = halfEther
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const feeManager = await FeeManagerErcToNative.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setForeignFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = '0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955'

      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      // When
      const { receipt } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[0]
      })
      expect(receipt.gasUsed).to.be.lte(MAX_GAS)
    })
  })
  describe('#feeManager_fallback', async () => {
    let homeBridge
    let rewardableValidators
    const owner = accounts[9]
    const validators = [accounts[1]]
    const rewards = [accounts[2]]
    const requiredSignatures = 1
    beforeEach(async () => {
      rewardableValidators = await RewardableValidators.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      const homeBridgeImpl = await HomeBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      homeBridge = await HomeBridge.at(storageProxy.address)
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.addMintedTotallyByBridge(oneEther, homeBridge.address)
    })

    it('should subtract fee from value', async () => {
      // Given
      // 0.1% fee
      const value = halfEther
      const recipient = accounts[8]
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const valueCalc = 0.5 * (1 - fee)
      const finalValue = ether(valueCalc.toString())
      const feeManager = await FeeManagerErcToNative.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setHomeFee(feeInWei, { from: owner }).should.be.fulfilled

      // When
      const { logs } = await homeBridge.sendTransaction({ from: recipient, value }).should.be.fulfilled

      // Then
      expectEventInLogs(logs, 'UserRequestForSignature', {
        recipient,
        value: finalValue
      })
      const currentDay = await homeBridge.getCurrentDay()
      value.should.be.bignumber.equal(await homeBridge.totalSpentPerDay(currentDay))
      finalValue.should.be.bignumber.equal(await homeBridge.totalBurntCoins())
      const homeBridgeBalance = await web3.eth.getBalance(homeBridge.address)
      expect(toBN(homeBridgeBalance)).to.be.bignumber.equal(value.sub(finalValue))
    })
  })
  describe('#feeManager_relayTokens', async () => {
    let homeBridge
    let rewardableValidators
    const owner = accounts[9]
    const validators = [accounts[1]]
    const rewards = [accounts[2]]
    const requiredSignatures = 1
    beforeEach(async () => {
      rewardableValidators = await RewardableValidators.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      const homeBridgeImpl = await HomeBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      homeBridge = await HomeBridge.at(storageProxy.address)
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.addMintedTotallyByBridge(oneEther, homeBridge.address)
    })

    it('should subtract fee from value', async () => {
      // Given
      // 0.1% fee
      const value = halfEther
      const recipient = accounts[8]
      const sender = accounts[7]
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const valueCalc = 0.5 * (1 - fee)
      const finalValue = ether(valueCalc.toString())
      const feeManager = await FeeManagerErcToNative.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setHomeFee(feeInWei, { from: owner }).should.be.fulfilled

      // When
      const { logs } = await homeBridge.relayTokens(recipient, { from: sender, value }).should.be.fulfilled

      // Then
      expectEventInLogs(logs, 'UserRequestForSignature', {
        recipient,
        value: finalValue
      })
      const currentDay = await homeBridge.getCurrentDay()
      value.should.be.bignumber.equal(await homeBridge.totalSpentPerDay(currentDay))
      finalValue.should.be.bignumber.equal(await homeBridge.totalBurntCoins())
      const homeBridgeBalance = await web3.eth.getBalance(homeBridge.address)
      expect(toBN(homeBridgeBalance)).to.be.bignumber.equal(value.sub(finalValue))
    })
  })
  describe('#feeManager_submitSignature', async () => {
    it('should distribute fee to validator', async () => {
      // Initialize
      const owner = accounts[9]
      const validators = [accounts[1]]
      const rewards = [accounts[2]]
      const requiredSignatures = 1
      const rewardableValidators = await RewardableValidators.new()
      const homeBridgeImpl = await HomeBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address)
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.addMintedTotallyByBridge(oneEther, homeBridge.address)

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const feeManager = await FeeManagerErcToNative.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setHomeFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = accounts[5]
      const initialValue = halfEther
      const valueCalc = 0.5 * (1 - fee)
      const value = ether(valueCalc.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())
      const rewardAddressBalanceBefore = toBN(await web3.eth.getBalance(rewards[0]))
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      const initialBridgeBalance = await web3.eth.getBalance(homeBridge.address)
      expect(toBN(initialBridgeBalance)).to.be.bignumber.equal(ZERO)

      // When
      await homeBridge.sendTransaction({ from: recipient, value: initialValue }).should.be.fulfilled

      const afterTransferBridgeBalance = toBN(await web3.eth.getBalance(homeBridge.address))
      afterTransferBridgeBalance.should.be.bignumber.equal(feeAmount)

      const message = createMessage(recipient, value, transactionHash, homeBridge.address)

      const signature = await sign(validators[0], message)

      const { logs } = await homeBridge.submitSignature(signature, message, { from: validators[0] }).should.be.fulfilled

      // Then
      logs.length.should.be.equal(3)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[2].event.should.be.equal('FeeDistributedFromSignatures')

      const finalBridgeBalance = await web3.eth.getBalance(homeBridge.address)
      expect(toBN(finalBridgeBalance)).to.be.bignumber.equal(ZERO)

      const rewardAddressBalanceAfter = await web3.eth.getBalance(rewards[0])
      expect(toBN(rewardAddressBalanceAfter)).to.be.bignumber.equal(toBN(rewardAddressBalanceBefore).add(feeAmount))
    })
    it('should distribute fee to 3 validators', async () => {
      // Initialize
      const owner = accounts[9]
      const validators = [accounts[1], accounts[2], accounts[3]]
      const rewards = [accounts[4], accounts[5], accounts[6]]
      const requiredSignatures = 3
      const rewardableValidators = await RewardableValidators.new()
      const homeBridgeImpl = await HomeBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address)
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.addMintedTotallyByBridge(oneEther, homeBridge.address)

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const feeManager = await FeeManagerErcToNative.new()
      const feePerValidator = toBN(166666666666666)
      const feePerValidatorPlusDiff = toBN(166666666666668)
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setHomeFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = accounts[7]
      const initialValue = halfEther
      const valueCalc = 0.5 * (1 - fee)
      const value = ether(valueCalc.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      const initialBridgeBalance = toBN(await web3.eth.getBalance(homeBridge.address))
      initialBridgeBalance.should.be.bignumber.equal(ZERO)

      const initialBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewards[0]))
      const initialBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewards[1]))
      const initialBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewards[2]))

      // When
      await homeBridge.sendTransaction({ from: recipient, value: initialValue }).should.be.fulfilled

      const afterTransferBridgeBalance = toBN(await web3.eth.getBalance(homeBridge.address))
      afterTransferBridgeBalance.should.be.bignumber.equal(feeAmount)

      const message = createMessage(recipient, value, transactionHash, homeBridge.address)

      const signature = await sign(validators[0], message)
      const signature2 = await sign(validators[1], message)
      const signature3 = await sign(validators[2], message)

      await homeBridge.submitSignature(signature, message, { from: validators[0] }).should.be.fulfilled
      await homeBridge.submitSignature(signature2, message, { from: validators[1] }).should.be.fulfilled
      const { logs } = await homeBridge.submitSignature(signature3, message, {
        from: validators[2]
      }).should.be.fulfilled

      // Then
      logs.length.should.be.equal(3)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[2].event.should.be.equal('FeeDistributedFromSignatures')

      const updatedBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewards[0]))
      const updatedBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewards[1]))
      const updatedBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewards[2]))

      const bridgeBalance = toBN(await web3.eth.getBalance(homeBridge.address))
      bridgeBalance.should.be.bignumber.equal(ZERO)

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
    })
    it('should distribute fee to 5 validators', async () => {
      // Initialize
      const owner = accounts[0]
      const validators = [accounts[0], accounts[1], accounts[2], accounts[3], accounts[4]]
      const rewards = [accounts[5], accounts[6], accounts[7], accounts[8], accounts[9]]
      const requiredSignatures = 5
      const rewardableValidators = await RewardableValidators.new()
      const homeBridgeImpl = await HomeBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address)
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.addMintedTotallyByBridge(oneEther, homeBridge.address)

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const feeManager = await FeeManagerErcToNative.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setHomeFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = accounts[0]
      const initialValue = halfEther
      const valueCalc = 0.5 * (1 - fee)
      const value = ether(valueCalc.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())
      const feePerValidator = feeAmount.div(toBN(5))
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      const initialBridgeBalance = toBN(await web3.eth.getBalance(homeBridge.address))
      initialBridgeBalance.should.be.bignumber.equal(ZERO)

      const initialBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewards[0]))
      const initialBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewards[1]))
      const initialBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewards[2]))
      const initialBalanceRewardAddress4 = toBN(await web3.eth.getBalance(rewards[3]))
      const initialBalanceRewardAddress5 = toBN(await web3.eth.getBalance(rewards[4]))

      // When
      await homeBridge.sendTransaction({ from: recipient, value: initialValue }).should.be.fulfilled

      const afterTransferBridgeBalance = toBN(await web3.eth.getBalance(homeBridge.address))
      afterTransferBridgeBalance.should.be.bignumber.equal(feeAmount)

      const message = createMessage(recipient, value, transactionHash, homeBridge.address)

      const signature = await sign(validators[0], message)
      const signature2 = await sign(validators[1], message)
      const signature3 = await sign(validators[2], message)
      const signature4 = await sign(validators[3], message)
      const signature5 = await sign(validators[4], message)

      await homeBridge.submitSignature(signature, message, { from: validators[0] }).should.be.fulfilled
      await homeBridge.submitSignature(signature2, message, { from: validators[1] }).should.be.fulfilled
      await homeBridge.submitSignature(signature3, message, { from: validators[2] }).should.be.fulfilled
      await homeBridge.submitSignature(signature4, message, { from: validators[3] }).should.be.fulfilled
      const { logs } = await homeBridge.submitSignature(signature5, message, {
        from: validators[4]
      }).should.be.fulfilled

      // Then
      logs.length.should.be.equal(3)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[2].event.should.be.equal('FeeDistributedFromSignatures')

      const updatedBalanceRewardAddress1 = toBN(await web3.eth.getBalance(rewards[0]))
      const updatedBalanceRewardAddress2 = toBN(await web3.eth.getBalance(rewards[1]))
      const updatedBalanceRewardAddress3 = toBN(await web3.eth.getBalance(rewards[2]))
      const updatedBalanceRewardAddress4 = toBN(await web3.eth.getBalance(rewards[3]))
      const updatedBalanceRewardAddress5 = toBN(await web3.eth.getBalance(rewards[4]))

      updatedBalanceRewardAddress1.should.be.bignumber.equal(initialBalanceRewardAddress1.add(feePerValidator))
      updatedBalanceRewardAddress2.should.be.bignumber.equal(initialBalanceRewardAddress2.add(feePerValidator))
      updatedBalanceRewardAddress3.should.be.bignumber.equal(initialBalanceRewardAddress3.add(feePerValidator))
      updatedBalanceRewardAddress4.should.be.bignumber.equal(initialBalanceRewardAddress4.add(feePerValidator))
      updatedBalanceRewardAddress5.should.be.bignumber.equal(initialBalanceRewardAddress5.add(feePerValidator))
    })
    it('should distribute fee to max allowed number of validators', async () => {
      // Initialize
      const owner = accounts[0]
      const validators = createAccounts(web3, MAX_VALIDATORS)
      validators[0] = accounts[2]
      const rewards = createAccounts(web3, MAX_VALIDATORS)
      const requiredSignatures = 1
      const rewardableValidators = await RewardableValidators.new()
      const homeBridge = await HomeBridge.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.addMintedTotallyByBridge(oneEther, homeBridge.address)

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const feeManager = await FeeManagerErcToNative.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setHomeFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = accounts[0]
      const initialValue = halfEther
      const valueCalc = 0.5 * (1 - fee)
      const value = ether(valueCalc.toString())
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      // When
      await homeBridge.sendTransaction({ from: recipient, value: initialValue }).should.be.fulfilled

      const message = createMessage(recipient, value, transactionHash, homeBridge.address)

      const signature = await sign(validators[0], message)

      const { receipt } = await homeBridge.submitSignature(signature, message, {
        from: validators[0]
      }).should.be.fulfilled
      expect(receipt.gasUsed).to.be.lte(MAX_GAS)
    })
  })
  describe('#FeeManager_random', async () => {
    it('should return value between 0 and 3', async () => {
      // Given
      const feeManager = await FeeManagerMock.new()

      for (let i = 0; i < 10; i++) {
        // send Tx to generate new blocks
        await feeManager.setHomeFee(0).should.be.fulfilled

        // When
        const result = await feeManager.randomTest(3)

        // Then
        expect(result).to.be.bignumber.gte(ZERO)
        expect(result).to.be.bignumber.lt('3')
      }
    })
  })
  describe('#feeManager_ExecuteAffirmation_POSDAO', async () => {
    it('should distribute fee to validator', async () => {
      // Initialize
      const owner = accounts[9]
      const validators = [accounts[1]]
      const rewards = [accounts[2]]
      const requiredSignatures = 1
      const rewardableValidators = await RewardableValidators.new()
      const homeBridgeImpl = await HomeBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address)
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled

      await blockRewardContract.setValidatorsRewards(rewards)
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.sendTransaction({
        from: accounts[2],
        value: oneEther
      }).should.be.fulfilled

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const feeManager = await FeeManagerErcToNativePOSDAO.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setForeignFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = accounts[5]
      const value = halfEther
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())
      const valueCalc = 0.5 * (1 - fee)
      const finalValue = ether(valueCalc.toString())
      const balanceBefore = await web3.eth.getBalance(recipient)
      const rewardAddressBalanceBefore = await web3.eth.getBalance(rewards[0])
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      // When
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled

      // Then
      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: validators[0],
        transactionHash
      })
      expectEventInLogs(logs, 'FeeDistributedFromAffirmation', {
        feeAmount,
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })
      const balanceAfter = await web3.eth.getBalance(recipient)
      const rewardAddressBalanceAfter = await web3.eth.getBalance(rewards[0])

      expect(toBN(rewardAddressBalanceAfter)).to.be.bignumber.equal(toBN(rewardAddressBalanceBefore).add(feeAmount))
      expect(toBN(balanceAfter)).to.be.bignumber.equal(toBN(balanceBefore).add(finalValue))

      const feeAmountBlockReward = await blockRewardContract.feeAmount()
      feeAmountBlockReward.should.be.bignumber.equal(feeAmount)
    })
    it('should distribute fee to 3 validators', async () => {
      // Initialize
      const owner = accounts[9]
      const validators = [accounts[1], accounts[2], accounts[3]]
      const rewards = [accounts[4], accounts[5], accounts[6]]
      const requiredSignatures = 2
      const rewardableValidators = await RewardableValidators.new()
      const homeBridgeImpl = await HomeBridge.new()
      const blockRewardContract = await BlockReward.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address)
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await blockRewardContract.setValidatorsRewards(rewards)
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.sendTransaction({
        from: accounts[0],
        value: halfEther
      }).should.be.fulfilled

      // Given
      const initialBlockRewardBalance = await web3.eth.getBalance(blockRewardContract.address)
      expect(toBN(initialBlockRewardBalance)).to.be.bignumber.equal(halfEther)

      const value = halfEther
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const valueCalc = 0.5 * (1 - fee)
      const finalValue = ether(valueCalc.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())
      // totalFee / 3
      const feePerValidator = toBN(166666666666666)
      const feePerValidatorPlusDiff = toBN(166666666666668)
      const feeManager = await FeeManagerErcToNativePOSDAO.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setForeignFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = accounts[8]
      const balanceBefore = await web3.eth.getBalance(recipient)

      const initialBalanceRewardAddress1 = await web3.eth.getBalance(rewards[0])
      const initialBalanceRewardAddress2 = await web3.eth.getBalance(rewards[1])
      const initialBalanceRewardAddress3 = await web3.eth.getBalance(rewards[2])

      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      // When
      const { logs: logsValidator1 } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[1]
      }).should.be.fulfilled

      // Then
      logsValidator1.length.should.be.equals(1)

      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: validators[1],
        transactionHash
      })
      expectEventInLogs(logs, 'FeeDistributedFromAffirmation', {
        feeAmount,
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const balanceAfter = await web3.eth.getBalance(recipient)
      expect(toBN(balanceAfter)).to.be.bignumber.equal(toBN(balanceBefore).add(finalValue))

      const updatedBalanceRewardAddress1 = await web3.eth.getBalance(rewards[0])
      const updatedBalanceRewardAddress2 = await web3.eth.getBalance(rewards[1])
      const updatedBalanceRewardAddress3 = await web3.eth.getBalance(rewards[2])

      expect(
        toBN(updatedBalanceRewardAddress1).eq(toBN(initialBalanceRewardAddress1).add(feePerValidator)) ||
          toBN(updatedBalanceRewardAddress1).eq(toBN(initialBalanceRewardAddress1).add(feePerValidatorPlusDiff))
      ).to.equal(true)
      expect(
        toBN(updatedBalanceRewardAddress2).eq(toBN(initialBalanceRewardAddress2).add(feePerValidator)) ||
          toBN(updatedBalanceRewardAddress2).eq(toBN(initialBalanceRewardAddress2).add(feePerValidatorPlusDiff))
      ).to.equal(true)
      expect(
        toBN(updatedBalanceRewardAddress3).eq(toBN(initialBalanceRewardAddress3).add(feePerValidator)) ||
          toBN(updatedBalanceRewardAddress3).eq(toBN(initialBalanceRewardAddress3).add(feePerValidatorPlusDiff))
      ).to.equal(true)

      const feeAmountBlockReward = await blockRewardContract.feeAmount()
      expect(toBN(feeAmountBlockReward)).to.be.bignumber.equal(feeAmount)

      const blockRewardBalance = await web3.eth.getBalance(blockRewardContract.address)
      expect(toBN(blockRewardBalance)).to.be.bignumber.equal(ZERO)
    })
    it('should distribute fee to 5 validators', async () => {
      // Initialize
      const owner = accounts[0]
      const validators = [accounts[0], accounts[1], accounts[2], accounts[3], accounts[4]]
      const rewards = [accounts[5], accounts[6], accounts[7], accounts[8], accounts[9]]
      const requiredSignatures = 5
      const rewardableValidators = await RewardableValidators.new()
      const homeBridgeImpl = await HomeBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address)
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await blockRewardContract.setValidatorsRewards(rewards)
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.sendTransaction({
        from: accounts[0],
        value: oneEther
      }).should.be.fulfilled

      // Given
      const value = halfEther
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())
      const feePerValidator = feeAmount.div(toBN(5))
      const feeManager = await FeeManagerErcToNativePOSDAO.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setForeignFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = '0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955'
      const balanceBefore = await web3.eth.getBalance(recipient)

      const initialBalanceRewardAddress1 = await web3.eth.getBalance(rewards[0])
      const initialBalanceRewardAddress2 = await web3.eth.getBalance(rewards[1])
      const initialBalanceRewardAddress3 = await web3.eth.getBalance(rewards[2])
      const initialBalanceRewardAddress4 = await web3.eth.getBalance(rewards[3])
      const initialBalanceRewardAddress5 = await web3.eth.getBalance(rewards[4])

      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      // When
      const { logs: logsValidator1 } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[1]
      }).should.be.fulfilled
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[2]
      }).should.be.fulfilled
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[3]
      }).should.be.fulfilled
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[4]
      }).should.be.fulfilled

      // Then
      logsValidator1.length.should.be.equals(1)

      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: validators[4],
        transactionHash
      })
      expectEventInLogs(logs, 'FeeDistributedFromAffirmation', {
        feeAmount,
        transactionHash
      })
      expectEventInLogs(logs, 'AffirmationCompleted', {
        recipient,
        value,
        transactionHash
      })

      const balanceAfter = await web3.eth.getBalance(recipient)
      expect(toBN(balanceAfter)).to.be.bignumber.equal(toBN(balanceBefore).add(value.sub(feeAmount)))

      const updatedBalanceRewardAddress1 = await web3.eth.getBalance(rewards[0])
      const updatedBalanceRewardAddress2 = await web3.eth.getBalance(rewards[1])
      const updatedBalanceRewardAddress3 = await web3.eth.getBalance(rewards[2])
      const updatedBalanceRewardAddress4 = await web3.eth.getBalance(rewards[3])
      const updatedBalanceRewardAddress5 = await web3.eth.getBalance(rewards[4])

      expect(toBN(updatedBalanceRewardAddress1)).to.be.bignumber.equal(
        toBN(initialBalanceRewardAddress1).add(feePerValidator)
      )
      expect(toBN(updatedBalanceRewardAddress2)).to.be.bignumber.equal(
        toBN(initialBalanceRewardAddress2).add(feePerValidator)
      )
      expect(toBN(updatedBalanceRewardAddress3)).to.be.bignumber.equal(
        toBN(initialBalanceRewardAddress3).add(feePerValidator)
      )
      expect(toBN(updatedBalanceRewardAddress4)).to.be.bignumber.equal(
        toBN(initialBalanceRewardAddress4).add(feePerValidator)
      )
      expect(toBN(updatedBalanceRewardAddress5)).to.be.bignumber.equal(
        toBN(initialBalanceRewardAddress5).add(feePerValidator)
      )

      const feeAmountBlockReward = await blockRewardContract.feeAmount()
      expect(toBN(feeAmountBlockReward)).to.be.bignumber.equal(feeAmount)
    })
    it('should distribute fee to max allowed number of validators', async () => {
      // Initialize
      const owner = accounts[0]
      const validators = createAccounts(web3, MAX_VALIDATORS)
      validators[0] = accounts[2]
      const rewards = createAccounts(web3, MAX_VALIDATORS)
      const requiredSignatures = 1
      const rewardableValidators = await RewardableValidators.new()
      const homeBridge = await HomeBridge.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await blockRewardContract.setValidatorsRewards(rewards)
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.sendTransaction({
        from: accounts[0],
        value: oneEther
      }).should.be.fulfilled

      // Given
      const value = halfEther
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const feeManager = await FeeManagerErcToNativePOSDAO.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setForeignFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = '0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955'

      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      // When
      const { receipt } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled
      expect(receipt.gasUsed).to.be.lte(MAX_GAS)
    })
  })
  describe('#feeManager_fallback_POSDAO', async () => {
    let homeBridge
    let rewardableValidators
    const owner = accounts[9]
    const validators = [accounts[1]]
    const rewards = [accounts[2]]
    const requiredSignatures = 1
    beforeEach(async () => {
      rewardableValidators = await RewardableValidators.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      const homeBridgeImpl = await HomeBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      homeBridge = await HomeBridge.at(storageProxy.address)
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.addMintedTotallyByBridge(oneEther, homeBridge.address)
    })

    it('should subtract fee from value', async () => {
      // Given
      // 0.1% fee
      const value = halfEther
      const recipient = accounts[8]
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const feeManager = await FeeManagerErcToNativePOSDAO.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setHomeFee(feeInWei, { from: owner }).should.be.fulfilled

      // When
      const { logs } = await homeBridge.sendTransaction({ from: recipient, value }).should.be.fulfilled

      // Then
      const valueCalc = 0.5 * (1 - fee)
      const finalValue = ether(valueCalc.toString())
      expectEventInLogs(logs, 'UserRequestForSignature', {
        recipient,
        value: finalValue
      })
      const currentDay = await homeBridge.getCurrentDay()
      value.should.be.bignumber.equal(await homeBridge.totalSpentPerDay(currentDay))
      value.should.be.bignumber.equal(await homeBridge.totalBurntCoins())
      const homeBridgeBalance = await web3.eth.getBalance(homeBridge.address)
      expect(toBN(homeBridgeBalance)).to.be.bignumber.equal(ZERO)
    })
  })
  describe('#feeManager_relayTokens_POSDAO', async () => {
    let homeBridge
    let rewardableValidators
    const owner = accounts[9]
    const validators = [accounts[1]]
    const rewards = [accounts[2]]
    const requiredSignatures = 1
    beforeEach(async () => {
      rewardableValidators = await RewardableValidators.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      const homeBridgeImpl = await HomeBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      homeBridge = await HomeBridge.at(storageProxy.address)
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.addMintedTotallyByBridge(oneEther, homeBridge.address)
    })

    it('should subtract fee from value', async () => {
      // Given
      // 0.1% fee
      const value = halfEther
      const recipient = accounts[8]
      const sender = accounts[7]
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const feeManager = await FeeManagerErcToNativePOSDAO.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setHomeFee(feeInWei, { from: owner }).should.be.fulfilled

      // When
      const { logs } = await homeBridge.relayTokens(recipient, { from: sender, value }).should.be.fulfilled

      // Then
      const valueCalc = 0.5 * (1 - fee)
      const finalValue = ether(valueCalc.toString())
      expectEventInLogs(logs, 'UserRequestForSignature', {
        recipient,
        value: finalValue
      })
      const currentDay = await homeBridge.getCurrentDay()
      value.should.be.bignumber.equal(await homeBridge.totalSpentPerDay(currentDay))
      value.should.be.bignumber.equal(await homeBridge.totalBurntCoins())
      const homeBridgeBalance = await web3.eth.getBalance(homeBridge.address)
      expect(toBN(homeBridgeBalance)).to.be.bignumber.equal(ZERO)
    })
  })
  describe('#feeManager_submitSignature_POSDAO', async () => {
    it('should distribute fee to validator', async () => {
      // Initialize
      const owner = accounts[9]
      const validators = [accounts[1]]
      const rewards = [accounts[2]]
      const requiredSignatures = 1
      const rewardableValidators = await RewardableValidators.new()
      const homeBridgeImpl = await HomeBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address)
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await blockRewardContract.setValidatorsRewards(rewards)
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.addMintedTotallyByBridge(oneEther, homeBridge.address)

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const feeManager = await FeeManagerErcToNativePOSDAO.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setHomeFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = accounts[5]
      const initialValue = halfEther
      const valueCalc = 0.5 * (1 - fee)
      const value = ether(valueCalc.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())
      const rewardAddressBalanceBefore = await web3.eth.getBalance(rewards[0])
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      const initialBridgeBalance = await web3.eth.getBalance(homeBridge.address)
      expect(toBN(initialBridgeBalance)).to.be.bignumber.equal(ZERO)

      // When
      await homeBridge.sendTransaction({ from: recipient, value: initialValue }).should.be.fulfilled

      const afterTransferBridgeBalance = await web3.eth.getBalance(homeBridge.address)
      expect(toBN(afterTransferBridgeBalance)).to.be.bignumber.equal(ZERO)

      const message = createMessage(recipient, value, transactionHash, homeBridge.address)

      const signature = await sign(validators[0], message)

      const { logs } = await homeBridge.submitSignature(signature, message, { from: validators[0] }).should.be.fulfilled

      // Then
      logs.length.should.be.equal(3)
      logs[1].event.should.be.equal('CollectedSignatures')
      expectEventInLogs(logs, 'FeeDistributedFromSignatures', {
        feeAmount,
        transactionHash
      })

      const finalBridgeBalance = await web3.eth.getBalance(homeBridge.address)
      expect(toBN(finalBridgeBalance)).to.be.bignumber.equal(ZERO)

      const rewardAddressBalanceAfter = await web3.eth.getBalance(rewards[0])
      expect(toBN(rewardAddressBalanceAfter)).to.be.bignumber.equal(toBN(rewardAddressBalanceBefore).add(feeAmount))

      const feeAmountBlockReward = await blockRewardContract.feeAmount()
      expect(toBN(feeAmountBlockReward)).to.be.bignumber.equal(feeAmount)
    })
    it('should distribute fee to 3 validators', async () => {
      // Initialize
      const owner = accounts[9]
      const validators = [accounts[1], accounts[2], accounts[3]]
      const rewards = [accounts[4], accounts[5], accounts[6]]
      const requiredSignatures = 3
      const rewardableValidators = await RewardableValidators.new()
      const homeBridgeImpl = await HomeBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address)
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await blockRewardContract.setValidatorsRewards(rewards)
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.addMintedTotallyByBridge(oneEther, homeBridge.address)

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const feeManager = await FeeManagerErcToNativePOSDAO.new()
      const feePerValidator = toBN(166666666666666)
      const feePerValidatorPlusDiff = toBN(166666666666668)
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setHomeFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = accounts[7]
      const initialValue = halfEther
      const valueCalc = 0.5 * (1 - fee)
      const value = ether(valueCalc.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      const initialBridgeBalance = await web3.eth.getBalance(homeBridge.address)
      expect(toBN(initialBridgeBalance)).to.be.bignumber.equal(ZERO)

      const initialBalanceRewardAddress1 = await web3.eth.getBalance(rewards[0])
      const initialBalanceRewardAddress2 = await web3.eth.getBalance(rewards[1])
      const initialBalanceRewardAddress3 = await web3.eth.getBalance(rewards[2])

      // When
      await homeBridge.sendTransaction({ from: recipient, value: initialValue }).should.be.fulfilled

      const afterTransferBridgeBalance = await web3.eth.getBalance(homeBridge.address)
      expect(toBN(afterTransferBridgeBalance)).to.be.bignumber.equal(ZERO)

      const message = createMessage(recipient, value, transactionHash, homeBridge.address)

      const signature = await sign(validators[0], message)
      const signature2 = await sign(validators[1], message)
      const signature3 = await sign(validators[2], message)

      await homeBridge.submitSignature(signature, message, { from: validators[0] }).should.be.fulfilled
      await homeBridge.submitSignature(signature2, message, { from: validators[1] }).should.be.fulfilled
      const { logs } = await homeBridge.submitSignature(signature3, message, {
        from: validators[2]
      }).should.be.fulfilled

      // Then
      logs.length.should.be.equal(3)
      logs[1].event.should.be.equal('CollectedSignatures')
      expectEventInLogs(logs, 'FeeDistributedFromSignatures', {
        feeAmount,
        transactionHash
      })

      const updatedBalanceRewardAddress1 = await web3.eth.getBalance(rewards[0])
      const updatedBalanceRewardAddress2 = await web3.eth.getBalance(rewards[1])
      const updatedBalanceRewardAddress3 = await web3.eth.getBalance(rewards[2])

      const bridgeBalance = await web3.eth.getBalance(homeBridge.address)
      expect(toBN(bridgeBalance)).to.be.bignumber.equal(ZERO)

      expect(
        toBN(updatedBalanceRewardAddress1).eq(toBN(initialBalanceRewardAddress1).add(feePerValidator)) ||
          toBN(updatedBalanceRewardAddress1).eq(toBN(initialBalanceRewardAddress1).add(feePerValidatorPlusDiff))
      ).to.equal(true)
      expect(
        toBN(updatedBalanceRewardAddress2).eq(toBN(initialBalanceRewardAddress2).add(feePerValidator)) ||
          toBN(updatedBalanceRewardAddress2).eq(toBN(initialBalanceRewardAddress2).add(feePerValidatorPlusDiff))
      ).to.equal(true)
      expect(
        toBN(updatedBalanceRewardAddress3).eq(toBN(initialBalanceRewardAddress3).add(feePerValidator)) ||
          toBN(updatedBalanceRewardAddress3).eq(toBN(initialBalanceRewardAddress3).add(feePerValidatorPlusDiff))
      ).to.equal(true)

      const feeAmountBlockReward = await blockRewardContract.feeAmount()
      expect(toBN(feeAmountBlockReward)).to.be.bignumber.equal(feeAmount)
    })
    it('should distribute fee to 5 validators', async () => {
      // Initialize
      const owner = accounts[0]
      const validators = [accounts[0], accounts[1], accounts[2], accounts[3], accounts[4]]
      const rewards = [accounts[5], accounts[6], accounts[7], accounts[8], accounts[9]]
      const requiredSignatures = 5
      const rewardableValidators = await RewardableValidators.new()
      const homeBridgeImpl = await HomeBridge.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address)
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await blockRewardContract.setValidatorsRewards(rewards)
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.addMintedTotallyByBridge(oneEther, homeBridge.address)

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const feeManager = await FeeManagerErcToNativePOSDAO.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setHomeFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = accounts[0]
      const initialValue = halfEther
      const valueCalc = 0.5 * (1 - fee)
      const value = ether(valueCalc.toString())
      const feeAmountCalc = 0.5 * fee
      const feeAmount = ether(feeAmountCalc.toString())
      const feePerValidator = feeAmount.div(toBN(5))
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      const initialBridgeBalance = await web3.eth.getBalance(homeBridge.address)
      expect(toBN(initialBridgeBalance)).to.be.bignumber.equal(ZERO)

      const initialBalanceRewardAddress1 = await web3.eth.getBalance(rewards[0])
      const initialBalanceRewardAddress2 = await web3.eth.getBalance(rewards[1])
      const initialBalanceRewardAddress3 = await web3.eth.getBalance(rewards[2])
      const initialBalanceRewardAddress4 = await web3.eth.getBalance(rewards[3])
      const initialBalanceRewardAddress5 = await web3.eth.getBalance(rewards[4])

      // When
      await homeBridge.sendTransaction({ from: recipient, value: initialValue }).should.be.fulfilled

      const afterTransferBridgeBalance = await web3.eth.getBalance(homeBridge.address)
      expect(toBN(afterTransferBridgeBalance)).to.be.bignumber.equal(ZERO)

      const message = createMessage(recipient, value, transactionHash, homeBridge.address)

      const signature = await sign(validators[0], message)
      const signature2 = await sign(validators[1], message)
      const signature3 = await sign(validators[2], message)
      const signature4 = await sign(validators[3], message)
      const signature5 = await sign(validators[4], message)

      await homeBridge.submitSignature(signature, message, { from: validators[0] }).should.be.fulfilled
      await homeBridge.submitSignature(signature2, message, { from: validators[1] }).should.be.fulfilled
      await homeBridge.submitSignature(signature3, message, { from: validators[2] }).should.be.fulfilled
      await homeBridge.submitSignature(signature4, message, { from: validators[3] }).should.be.fulfilled
      const { logs } = await homeBridge.submitSignature(signature5, message, {
        from: validators[4]
      }).should.be.fulfilled

      // Then
      logs.length.should.be.equal(3)
      logs[1].event.should.be.equal('CollectedSignatures')
      expectEventInLogs(logs, 'FeeDistributedFromSignatures', {
        feeAmount,
        transactionHash
      })

      const updatedBalanceRewardAddress1 = await web3.eth.getBalance(rewards[0])
      const updatedBalanceRewardAddress2 = await web3.eth.getBalance(rewards[1])
      const updatedBalanceRewardAddress3 = await web3.eth.getBalance(rewards[2])
      const updatedBalanceRewardAddress4 = await web3.eth.getBalance(rewards[3])
      const updatedBalanceRewardAddress5 = await web3.eth.getBalance(rewards[4])

      expect(toBN(updatedBalanceRewardAddress1)).to.be.bignumber.equal(
        toBN(initialBalanceRewardAddress1).add(feePerValidator)
      )
      expect(toBN(updatedBalanceRewardAddress2)).to.be.bignumber.equal(
        toBN(initialBalanceRewardAddress2).add(feePerValidator)
      )
      expect(toBN(updatedBalanceRewardAddress3)).to.be.bignumber.equal(
        toBN(initialBalanceRewardAddress3).add(feePerValidator)
      )
      expect(toBN(updatedBalanceRewardAddress4)).to.be.bignumber.equal(
        toBN(initialBalanceRewardAddress4).add(feePerValidator)
      )
      expect(toBN(updatedBalanceRewardAddress5)).to.be.bignumber.equal(
        toBN(initialBalanceRewardAddress5).add(feePerValidator)
      )

      const feeAmountBlockReward = await blockRewardContract.feeAmount()
      feeAmountBlockReward.should.be.bignumber.equal(feeAmount)
    })
    it('should distribute fee to max allowed number of validators', async () => {
      // Initialize
      const owner = accounts[0]
      const validators = createAccounts(web3, MAX_VALIDATORS)
      validators[0] = accounts[2]
      const rewards = createAccounts(web3, MAX_VALIDATORS)
      const requiredSignatures = 1
      const rewardableValidators = await RewardableValidators.new()
      const homeBridge = await HomeBridge.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {
        from: owner
      }).should.be.fulfilled
      await blockRewardContract.setValidatorsRewards(rewards)
      await homeBridge.initialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        blockRewardContract.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        decimalShiftZero
      ).should.be.fulfilled
      await blockRewardContract.addMintedTotallyByBridge(oneEther, homeBridge.address)

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = ether(fee.toString())
      const feeManager = await FeeManagerErcToNativePOSDAO.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setHomeFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = accounts[0]
      const initialValue = halfEther
      const valueCalc = 0.5 * (1 - fee)
      const value = ether(valueCalc.toString())
      const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'

      // When
      await homeBridge.sendTransaction({ from: recipient, value: initialValue }).should.be.fulfilled

      const message = createMessage(recipient, value, transactionHash, homeBridge.address)

      const signature = await sign(validators[0], message)

      const { receipt } = await homeBridge.submitSignature(signature, message, {
        from: validators[0]
      }).should.be.fulfilled
      expect(receipt.gasUsed).to.be.lte(MAX_GAS)
    })
  })
  describe('#decimals Shift', async () => {
    for (const decimalShift of [2, -1]) {
      it(`Foreign to Home: test with 2 signatures required and decimal shift ${decimalShift}`, async () => {
        await blockRewardContract.sendTransaction({
          from: accounts[2],
          value: oneEther
        }).should.be.fulfilled
        const recipient = accounts[5]
        const valueOnHome = halfEther

        const valueOnForeign = toBN(valueOnHome / 10 ** decimalShift)

        const validatorContractWith2Signatures = await BridgeValidators.new()
        const authoritiesThreeAccs = [accounts[1], accounts[2], accounts[3]]
        const ownerOfValidators = accounts[0]
        await validatorContractWith2Signatures.initialize(2, authoritiesThreeAccs, ownerOfValidators)
        const homeBridgeWithTwoSigs = await HomeBridge.new()
        const currentDay = await homeBridgeWithTwoSigs.getCurrentDay()

        await homeBridgeWithTwoSigs.initialize(
          validatorContractWith2Signatures.address,
          [oneEther, halfEther, minPerTx],
          gasPrice,
          requireBlockConfirmations,
          blockRewardContract.address,
          [ether('100'), ether('10')],
          owner,
          decimalShift
        )
        const transactionHash = '0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415'
        const balanceBefore = toBN(await web3.eth.getBalance(recipient))
        const totalExecutedPerDayBefore = await homeBridgeWithTwoSigs.totalExecutedPerDay(currentDay)
        const msgHash = web3.utils.soliditySha3(recipient, valueOnForeign, transactionHash)

        const { logs } = await homeBridgeWithTwoSigs.executeAffirmation(recipient, valueOnForeign, transactionHash, {
          from: authoritiesThreeAccs[0]
        }).should.be.fulfilled

        expectEventInLogs(logs, 'SignedForAffirmation', { signer: authorities[0], transactionHash })

        const notProcessed = await homeBridgeWithTwoSigs.numAffirmationsSigned(msgHash)
        notProcessed.should.be.bignumber.equal('1')

        await homeBridgeWithTwoSigs
          .executeAffirmation(recipient, valueOnForeign, transactionHash, { from: authoritiesThreeAccs[0] })
          .should.be.rejectedWith(ERROR_MSG)

        const secondSignature = await homeBridgeWithTwoSigs.executeAffirmation(
          recipient,
          valueOnForeign,
          transactionHash,
          { from: authoritiesThreeAccs[1] }
        ).should.be.fulfilled
        const balanceAfter = toBN(await web3.eth.getBalance(recipient))
        balanceAfter.should.be.bignumber.equal(balanceBefore.add(valueOnHome))

        const totalExecutedPerDayAfter = await homeBridgeWithTwoSigs.totalExecutedPerDay(currentDay)
        totalExecutedPerDayAfter.should.be.bignumber.equal(totalExecutedPerDayBefore.add(valueOnForeign))

        expectEventInLogs(secondSignature.logs, 'AffirmationCompleted', {
          recipient,
          value: valueOnForeign,
          transactionHash
        })

        const senderHash = web3.utils.soliditySha3(authoritiesThreeAccs[0], msgHash)
        true.should.be.equal(await homeBridgeWithTwoSigs.affirmationsSigned(senderHash))

        const senderHash2 = web3.utils.soliditySha3(authoritiesThreeAccs[1], msgHash)
        true.should.be.equal(await homeBridgeWithTwoSigs.affirmationsSigned(senderHash2))

        const markedAsProcessed = await homeBridgeWithTwoSigs.numAffirmationsSigned(msgHash)
        const processed = toBN(2)
          .pow(toBN(255))
          .add(toBN(2))
        markedAsProcessed.should.be.bignumber.equal(processed)
      })

      it(`Home to Foreign: test decimal shift ${decimalShift}, no impact on UserRequestForSignature value`, async () => {
        homeContract = await HomeBridge.new()
        await homeContract.initialize(
          validatorContract.address,
          ['3', '2', '1'],
          gasPrice,
          requireBlockConfirmations,
          blockRewardContract.address,
          [foreignDailyLimit, foreignMaxPerTx],
          owner,
          decimalShift
        )

        const currentDay = await homeContract.getCurrentDay()
        expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)

        await blockRewardContract.addMintedTotallyByBridge(10, homeContract.address)
        const minted = await blockRewardContract.mintedTotallyByBridge(homeContract.address)
        minted.should.be.bignumber.equal('10')

        const recipientAccount = accounts[1]

        const { logs } = await homeContract.sendTransaction({ from: recipientAccount, value: 1 }).should.be.fulfilled

        expectEventInLogs(logs, 'UserRequestForSignature', { recipient: recipientAccount, value: toBN(1) })
        expect(await homeContract.totalSpentPerDay(currentDay)).to.be.bignumber.equal('1')
        expect(await homeContract.totalBurntCoins()).to.be.bignumber.equal('1')

        const homeContractBalance = toBN(await web3.eth.getBalance(homeContract.address))
        homeContractBalance.should.be.bignumber.equal(ZERO)

        const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'
        const message = createMessage(recipientAccount, 1, transactionHash, homeContract.address)

        const signature = await sign(authorities[0], message)

        expect(await validatorContract.requiredSignatures()).to.be.bignumber.equal('1')

        const { logs: logsSubmitSignature } = await homeContract.submitSignature(signature, message, {
          from: authorities[0]
        }).should.be.fulfilled

        logsSubmitSignature.length.should.be.equal(2)
        logsSubmitSignature[1].event.should.be.equal('CollectedSignatures')
      })
    }
  })
})
