const HomeBridge = artifacts.require('HomeBridgeErcToErc.sol')
const POSDAOHomeBridge = artifacts.require('HomeBridgeErcToErcPOSDAO.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')
const BridgeValidators = artifacts.require('BridgeValidators.sol')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const ERC677BridgeTokenRewardable = artifacts.require('ERC677BridgeTokenRewardable.sol')
const FeeManagerErcToErcPOSDAO = artifacts.require('FeeManagerErcToErcPOSDAO.sol')
const RewardableValidators = artifacts.require('RewardableValidators.sol')
const BlockReward = artifacts.require('BlockReward')
const OldBlockReward = artifacts.require('OldBlockReward')
const { expect } = require('chai')
const { ERROR_MSG, ZERO_ADDRESS, toBN, BN } = require('../setup')
const { createMessage, sign, getEvents, ether, expectEventInLogs, createAccounts } = require('../helpers/helpers')

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
const markedAsProcessed = toBN(2)
  .pow(toBN(255))
  .add(toBN(1))

contract('BlockRewardContract', async accounts => {
  let homeContract
  let validatorContract
  let authorities
  let owner
  let token
  before(async () => {
    validatorContract = await BridgeValidators.new()
    authorities = [accounts[1]]
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
  })

  describe.only('blockReward', () => {
    let homeFee
    let foreignFee
    let homeBridge
    let rewardableValidators
    let blockRewardContract
    const validators = [accounts[1]]
    const rewards = [accounts[2]]
    const requiredSignatures = 1
    beforeEach(async () => {
      token = await ERC677BridgeTokenRewardable.new('Some ERC20', 'RSZT', 18, 100)
      rewardableValidators = await RewardableValidators.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      homeBridge = await POSDAOHomeBridge.new()
      homeFee = ether('0.002')
      foreignFee = ether('0.002')
      blockRewardContract = await BlockReward.new()
    })

    it('should initialize blockReward correctly', async () => {
      await blockRewardContract.initialize(token.address, homeBridge.address, { from: owner }).should.be.fulfilled

      const tokenAddress = await blockRewardContract.token()
      const bridgeAddress = await blockRewardContract.bridgeContract()
      const totalMinted = await blockRewardContract.totalMinted()
      const isInitialized = await blockRewardContract.isInitialized()
      console.log('tokenAddress: ', tokenAddress)
      console.log('bridgeAddress: ', bridgeAddress)
      console.log('totalMinted: ', totalMinted)
      console.log('isInitialized: ', isInitialized)

      expect(tokenAddress).to.be.eq(token.address)
      expect(bridgeAddress).to.be.eq(homeBridge.address)
      expect(totalMinted).to.bignumber.be.eq(new BN('0'))
      expect(isInitialized).to.be.eq(true)
    })

    it('should initialize blockReward only once', async () => {
      await blockRewardContract.initialize(token.address, homeBridge.address, { from: owner }).should.be.fulfilled

      await blockRewardContract
        .initialize(token.address, homeBridge.address, { from: owner })
        .should.be.rejectedWith(ERROR_MSG)
    })

    it('should initialize blockReward only once', async () => {
      await blockRewardContract.initialize(token.address, homeBridge.address, { from: owner }).should.be.fulfilled

      await blockRewardContract
        .initialize(token.address, homeBridge.address, { from: owner })
        .should.be.rejectedWith(ERROR_MSG)
    })

    it('should not allow zero addresses', async () => {
      //set token to zero address
      await blockRewardContract
        .initialize(ZERO_ADDRESS, homeBridge.address, { from: owner })
        .should.be.rejectedWith(ERROR_MSG)
      //set bridge to zero address
      await blockRewardContract
        .initialize(token.address, ZERO_ADDRESS, { from: owner })
        .should.be.rejectedWith(ERROR_MSG)
    })

    it('should add bridgeToken rewards correctly', async () => {
      const recipient = accounts[9]
      const initialValue = halfEther
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'

      feeManager = await FeeManagerErcToErcPOSDAO.new()

      // initialize home bridge
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        blockRewardContract.address,
        decimalShiftZero
      ).should.be.fulfilled

      //initialize block reward contract
      await blockRewardContract.initialize(token.address, homeBridge.address, { from: owner })

      token.setBlockRewardContract(blockRewardContract.address)
      token.transferOwnership(homeBridge.address)

      // When
      const tx = await homeBridge.executeAffirmation(recipient, initialValue, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled

      const totalMinted = await blockRewardContract.totalMinted()

      const recipientBalanceAfter = await token.balanceOf(recipient)
      const ownerBalanceAfter = await token.balanceOf(owner)
      const blockRewardBalanceAfter = await token.balanceOf(blockRewardContract.address)
      console.log('ownerBalanceAfter: ', ownerBalanceAfter.toString())
      console.log('blockRewardBalanceAfter: ', blockRewardBalanceAfter.toString())
      console.log('recipientBalanceAfter: ', recipientBalanceAfter.toString())

      expect(totalMinted).to.bignumber.be.eq(new BN('1000000000000000'))
      expect(blockRewardBalanceAfter).to.bignumber.be.eq(new BN('1000000000000000'))
      expect(recipientBalanceAfter).to.bignumber.be.eq(new BN('499000000000000000'))
    })

    it('should claim tokens correctly', async () => {
      const recipient = accounts[9]
      const initialValue = halfEther
      const transactionHash = '0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80'

      feeManager = await FeeManagerErcToErcPOSDAO.new()

      // initialize home bridge
      await homeBridge.rewardableInitialize(
        rewardableValidators.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [foreignDailyLimit, foreignMaxPerTx],
        owner,
        feeManager.address,
        [homeFee, foreignFee],
        blockRewardContract.address,
        decimalShiftZero
      ).should.be.fulfilled

      //initialize block reward contract
      await blockRewardContract.initialize(token.address, homeBridge.address, { from: owner })

      token.setBlockRewardContract(blockRewardContract.address)
      token.transferOwnership(homeBridge.address)

      // When
      const { logs } = await homeBridge.executeAffirmation(recipient, initialValue, transactionHash, {
        from: validators[0]
      }).should.be.fulfilled

      await blockRewardContract.claimTokens({ from: owner })
      await blockRewardContract.claimTokens({ from: recipient }).should.be.rejectedWith(ERROR_MSG)

      const recipientBalanceAfter = await token.balanceOf(recipient)
      const ownerBalanceAfter = await token.balanceOf(owner)
      const blockRewardBalanceAfter = await token.balanceOf(blockRewardContract.address)
      console.log('ownerBalanceAfter: ', ownerBalanceAfter.toString())
      console.log('blockRewardBalanceAfter: ', blockRewardBalanceAfter.toString())
      console.log('recipientBalanceAfter: ', recipientBalanceAfter.toString())

      expect(ownerBalanceAfter).to.bignumber.be.eq(new BN('1000000000000000'))
      expect(blockRewardBalanceAfter).to.bignumber.be.eq(new BN('0'))
      expect(recipientBalanceAfter).to.bignumber.be.eq(new BN('499000000000000000'))
    })

    it('should get block Reward contract id correctly', async () => {
      const id = await blockRewardContract.blockRewardContractId()
      console.log('id: ', id)
    })
  })
})
