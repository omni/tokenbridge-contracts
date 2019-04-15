const Web3Utils = require('web3-utils')
const HomeBridge = artifacts.require('HomeBridgeErcToNative.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')
const BridgeValidators = artifacts.require('BridgeValidators.sol')
const BlockReward = artifacts.require('BlockReward')
const RewardableValidators = artifacts.require("RewardableValidators.sol");
const FeeManagerErcToNative = artifacts.require("FeeManagerErcToNative.sol");
const {ERROR_MSG, ZERO_ADDRESS} = require('../setup');
const {createMessage, sign } = require('../helpers/helpers');
const minPerTx = web3.toBigNumber(web3.toWei(0.01, "ether"));
const requireBlockConfirmations = 8;
const gasPrice = Web3Utils.toWei('1', 'gwei');
const oneEther = web3.toBigNumber(web3.toWei(1, "ether"));
const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"));
const foreignDailyLimit = oneEther
const foreignMaxPerTx = halfEther


contract('HomeBridge_ERC20_to_Native', async (accounts) => {
  let homeContract, validatorContract, blockRewardContract, authorities, owner;
  before(async () => {
    validatorContract = await BridgeValidators.new()
    blockRewardContract = await BlockReward.new()
    authorities = [accounts[1]]
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
  })

  describe('#initialize', async() => {
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
    })
    it('sets variables', async () => {
      ZERO_ADDRESS.should.be.equal(await homeContract.validatorContract())
      '0'.should.be.bignumber.equal(await homeContract.deployedAtBlock())
      '0'.should.be.bignumber.equal(await homeContract.dailyLimit())
      '0'.should.be.bignumber.equal(await homeContract.maxPerTx())
      false.should.be.equal(await homeContract.isInitialized())
      ZERO_ADDRESS.should.be.equal(await homeContract.blockRewardContract())

      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner).should.be.fulfilled

      true.should.be.equal(await homeContract.isInitialized())
      validatorContract.address.should.be.equal(await homeContract.validatorContract())
      blockRewardContract.address.should.be.equal(await homeContract.blockRewardContract());
      (await homeContract.deployedAtBlock()).should.be.bignumber.above(0)
      '3'.should.be.bignumber.equal(await homeContract.dailyLimit())
      '2'.should.be.bignumber.equal(await homeContract.maxPerTx())
      '1'.should.be.bignumber.equal(await homeContract.minPerTx())
      const contractGasPrice = await homeContract.gasPrice()
      contractGasPrice.should.be.bignumber.equal(gasPrice)
      const bridgeMode = '0x18762d46' // 4 bytes of keccak256('erc-to-native-core')
      const mode = await homeContract.getBridgeMode();
      mode.should.be.equal(bridgeMode)
      const [major, minor, patch] = await homeContract.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })

    it('can update block reward contract', async () => {
      ZERO_ADDRESS.should.be.equal(await homeContract.blockRewardContract())

      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner).should.be.fulfilled

      blockRewardContract.address.should.be.equal(await homeContract.blockRewardContract())

      const secondBlockRewardContract = await BlockReward.new()
      await homeContract.setBlockRewardContract(secondBlockRewardContract.address)
      secondBlockRewardContract.address.should.be.equal(await homeContract.blockRewardContract())

      const thirdBlockRewardContract = await BlockReward.new()
      await homeContract.setBlockRewardContract(thirdBlockRewardContract.address, {from: accounts[4]}).should.be.rejectedWith(ERROR_MSG)
      secondBlockRewardContract.address.should.be.equal(await homeContract.blockRewardContract())

      const notAContract = accounts[5]
      await homeContract.setBlockRewardContract(notAContract).should.be.rejectedWith(ERROR_MSG)
      secondBlockRewardContract.address.should.be.equal(await homeContract.blockRewardContract())

      await homeContract.setBlockRewardContract(validatorContract.address).should.be.rejectedWith(ERROR_MSG)
      secondBlockRewardContract.address.should.be.equal(await homeContract.blockRewardContract())
    })

    it('cant set maxPerTx > dailyLimit', async () => {
      false.should.be.equal(await homeContract.isInitialized())

      await homeContract.initialize(validatorContract.address, '1', '2', '1', gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner).should.be.rejectedWith(ERROR_MSG)
      await homeContract.initialize(validatorContract.address, '3', '2', '2', gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner).should.be.rejectedWith(ERROR_MSG)

      false.should.be.equal(await homeContract.isInitialized())
    })

    it('can be deployed via upgradeToAndCall', async () => {
      let storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      let data = homeContract.initialize.request(validatorContract.address, "3", "2", "1", gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner).params[0].data

      await storageProxy.upgradeToAndCall('1', homeContract.address, data).should.be.fulfilled
      let finalContract = await HomeBridge.at(storageProxy.address);

      true.should.be.equal(await finalContract.isInitialized())
      validatorContract.address.should.be.equal(await finalContract.validatorContract())
      blockRewardContract.address.should.be.equal(await finalContract.blockRewardContract())
      "3".should.be.bignumber.equal(await finalContract.dailyLimit())
      "2".should.be.bignumber.equal(await finalContract.maxPerTx())
      "1".should.be.bignumber.equal(await finalContract.minPerTx())
    })
    it('can be upgraded keeping the state', async () => {
      const homeOwner = accounts[8]
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      const proxyOwner = await storageProxy.proxyOwner()
      const data = homeContract.initialize.request(validatorContract.address, "3", "2", "1", gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, homeOwner).params[0].data

      await storageProxy.upgradeToAndCall('1', homeContract.address, data).should.be.fulfilled
      const finalContract = await HomeBridge.at(storageProxy.address);

      true.should.be.equal(await finalContract.isInitialized())
      validatorContract.address.should.be.equal(await finalContract.validatorContract())
      blockRewardContract.address.should.be.equal(await finalContract.blockRewardContract())
      "3".should.be.bignumber.equal(await finalContract.dailyLimit())
      "2".should.be.bignumber.equal(await finalContract.maxPerTx())
      "1".should.be.bignumber.equal(await finalContract.minPerTx())
      const upgradeabilityAdmin =  await finalContract.upgradeabilityAdmin()
      upgradeabilityAdmin.should.be.equal(proxyOwner)

      const homeContractV2 = await HomeBridge.new()
      await storageProxy.upgradeTo('2', homeContractV2.address).should.be.fulfilled
      const finalContractV2 = await HomeBridge.at(storageProxy.address);

      validatorContract.address.should.be.equal(await finalContractV2.validatorContract())
      blockRewardContract.address.should.be.equal(await finalContractV2.blockRewardContract())
      "3".should.be.bignumber.equal(await finalContractV2.dailyLimit())
      "2".should.be.bignumber.equal(await finalContractV2.maxPerTx())
      "1".should.be.bignumber.equal(await finalContractV2.minPerTx())
      const upgradeabilityAdminV2 =  await finalContractV2.upgradeabilityAdmin()
      upgradeabilityAdminV2.should.be.equal(proxyOwner)
    })
    it('cant initialize with invalid arguments', async () => {
      false.should.be.equal(await homeContract.isInitialized())
      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, 0, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(owner, '3', '2', '1', gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(ZERO_ADDRESS, '3', '2', '1', gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, owner, foreignDailyLimit, foreignMaxPerTx, owner).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, blockRewardContract.address, halfEther, oneEther, owner).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner).should.be.fulfilled;
      true.should.be.equal(await homeContract.isInitialized())
    })
  })

  describe('#rewardableInitialize', async() => {
    let feeManager, homeFee, foreignFee
    beforeEach(async () => {
      feeManager = await FeeManagerErcToNative.new()
      homeContract = await HomeBridge.new()
      homeFee = web3.toBigNumber(web3.toWei(0.001, "ether"))
      foreignFee = web3.toBigNumber(web3.toWei(0.002, "ether"))
    })
    it('sets variables', async () => {
      ZERO_ADDRESS.should.be.equal(await homeContract.validatorContract())
      '0'.should.be.bignumber.equal(await homeContract.deployedAtBlock())
      '0'.should.be.bignumber.equal(await homeContract.dailyLimit())
      '0'.should.be.bignumber.equal(await homeContract.maxPerTx())
      false.should.be.equal(await homeContract.isInitialized())
      ZERO_ADDRESS.should.be.equal(await homeContract.blockRewardContract())

      await homeContract.rewardableInitialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner, feeManager.address, homeFee, foreignFee).should.be.fulfilled

      true.should.be.equal(await homeContract.isInitialized())
      validatorContract.address.should.be.equal(await homeContract.validatorContract())
      blockRewardContract.address.should.be.equal(await homeContract.blockRewardContract());
      (await homeContract.deployedAtBlock()).should.be.bignumber.above(0)
      '3'.should.be.bignumber.equal(await homeContract.dailyLimit())
      '2'.should.be.bignumber.equal(await homeContract.maxPerTx())
      '1'.should.be.bignumber.equal(await homeContract.minPerTx())
      const contractGasPrice = await homeContract.gasPrice()
      contractGasPrice.should.be.bignumber.equal(gasPrice)
      const bridgeMode = '0x18762d46' // 4 bytes of keccak256('erc-to-native-core')
      const mode = await homeContract.getBridgeMode();
      mode.should.be.equal(bridgeMode)
      const [major, minor, patch] = await homeContract.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)

      const feeManagerContract = await homeContract.feeManagerContract()
      feeManagerContract.should.be.equals(feeManager.address)
      const bridgeHomeFee = await homeContract.getHomeFee()
      bridgeHomeFee.should.be.bignumber.equal(homeFee)
      const bridgeForeignFee = await homeContract.getForeignFee()
      bridgeForeignFee.should.be.bignumber.equal(foreignFee)
    })

    it('cant initialize with invalid arguments', async () => {
      false.should.be.equal(await homeContract.isInitialized())
      await homeContract.rewardableInitialize(validatorContract.address, '3', '2', '1', gasPrice, 0, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner, feeManager.address, homeFee, foreignFee).should.be.rejectedWith(ERROR_MSG);
      await homeContract.rewardableInitialize(owner, '3', '2', '1', gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner, feeManager.address, homeFee, foreignFee).should.be.rejectedWith(ERROR_MSG);
      await homeContract.rewardableInitialize(ZERO_ADDRESS, '3', '2', '1', gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner, feeManager.address, homeFee, foreignFee).should.be.rejectedWith(ERROR_MSG);
      await homeContract.rewardableInitialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, owner, foreignDailyLimit, foreignMaxPerTx, owner, feeManager.address, homeFee, foreignFee).should.be.rejectedWith(ERROR_MSG);
      await homeContract.rewardableInitialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, blockRewardContract.address, halfEther, oneEther, owner, feeManager.address, homeFee, foreignFee).should.be.rejectedWith(ERROR_MSG);
      await homeContract.rewardableInitialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner, ZERO_ADDRESS, homeFee, foreignFee).should.be.rejectedWith(ERROR_MSG);
      await homeContract.rewardableInitialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner, feeManager.address, homeFee, foreignFee).should.be.fulfilled;
      true.should.be.equal(await homeContract.isInitialized())
    })

    it('can update fee contract', async () => {
      await homeContract.rewardableInitialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner, feeManager.address, homeFee, foreignFee).should.be.fulfilled;

      // Given
      const newFeeManager = await FeeManagerErcToNative.new()

      // When
      await homeContract.setFeeManagerContract(newFeeManager.address, { from: owner }).should.be.fulfilled

      // Then
      const feeManagerContract = await homeContract.feeManagerContract()
      feeManagerContract.should.be.equals(newFeeManager.address)
    })

    it('can update fee', async () => {
      await homeContract.rewardableInitialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner, feeManager.address, homeFee, foreignFee).should.be.fulfilled;

      // Given
      const newHomeFee = web3.toBigNumber(web3.toWei(0.1, "ether"))
      const newForeignFee = web3.toBigNumber(web3.toWei(0.2, "ether"))

      // When
      await homeContract.setHomeFee(newHomeFee, { from: owner }).should.be.fulfilled
      await homeContract.setForeignFee(newForeignFee, { from: owner }).should.be.fulfilled

      // Then
      const bridgeHomeFee = await homeContract.getHomeFee()
      bridgeHomeFee.should.be.bignumber.equal(newHomeFee)
      const bridgeForeignFee = await homeContract.getForeignFee()
      bridgeForeignFee.should.be.bignumber.equal(newForeignFee)
    })
  })

  describe('#fallback', async () => {
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner)
    })

    it('should accept native coins', async () => {
      const currentDay = await homeContract.getCurrentDay()
      '0'.should.be.bignumber.equal(await homeContract.totalSpentPerDay(currentDay))

      await blockRewardContract.addMintedTotallyByBridge(10, homeContract.address)
      const minted = await blockRewardContract.mintedTotallyByBridge(homeContract.address)
      minted.should.be.bignumber.equal(10)

      const {logs} = await homeContract.sendTransaction({ from: accounts[1], value: 1 }).should.be.fulfilled

      logs[0].event.should.be.equal('UserRequestForSignature')
      logs[0].args.should.be.deep.equal({ recipient: accounts[1], value: new web3.BigNumber(1) })
      '1'.should.be.bignumber.equal(await homeContract.totalSpentPerDay(currentDay))
      '1'.should.be.bignumber.equal(await homeContract.totalBurntCoins())
      const homeContractBalance = await web3.eth.getBalance(homeContract.address)
      homeContractBalance.should.be.bignumber.equal('0')
    })

    it('should accumulate burnt coins', async () => {
      await blockRewardContract.addMintedTotallyByBridge(10, homeContract.address)

      const currentDay = await homeContract.getCurrentDay()
      '0'.should.be.bignumber.equal(await homeContract.totalSpentPerDay(currentDay))

      await homeContract.sendTransaction({ from: accounts[1], value: 1 }).should.be.fulfilled
      '1'.should.be.bignumber.equal(await homeContract.totalBurntCoins())

      await homeContract.sendTransaction({ from: accounts[1], value: 1 }).should.be.fulfilled
      '2'.should.be.bignumber.equal(await homeContract.totalBurntCoins())

      await homeContract.sendTransaction({ from: accounts[1], value: 1 }).should.be.fulfilled
      '3'.should.be.bignumber.equal(await homeContract.totalBurntCoins())

      const homeContractBalance = await web3.eth.getBalance(homeContract.address)
      homeContractBalance.should.be.bignumber.equal('0')
    })

    it('doesnt let you send more than daily limit', async () => {
      await blockRewardContract.addMintedTotallyByBridge(10, homeContract.address)

      const currentDay = await homeContract.getCurrentDay()
      '0'.should.be.bignumber.equal(await homeContract.totalSpentPerDay(currentDay))

      await homeContract.sendTransaction({ from: accounts[1], value: 1 }).should.be.fulfilled

      '1'.should.be.bignumber.equal(await homeContract.totalSpentPerDay(currentDay))
      '1'.should.be.bignumber.equal(await homeContract.totalBurntCoins())

      await homeContract.sendTransaction({ from: accounts[1], value: 1 }).should.be.fulfilled;
      '2'.should.be.bignumber.equal(await homeContract.totalSpentPerDay(currentDay))

      await homeContract.sendTransaction({ from: accounts[1], value: 2 }).should.be.rejectedWith(ERROR_MSG);

      await homeContract.setDailyLimit(4).should.be.fulfilled;
      await homeContract.sendTransaction({ from: accounts[1], value: 2 }).should.be.fulfilled;
      '4'.should.be.bignumber.equal(await homeContract.totalSpentPerDay(currentDay))
      '4'.should.be.bignumber.equal(await homeContract.totalBurntCoins())
    })

    it('doesnt let you send more than max amount per tx', async () => {
      await blockRewardContract.addMintedTotallyByBridge(200, homeContract.address)

      await homeContract.sendTransaction({
        from: accounts[1],
        value: 1
      }).should.be.fulfilled
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 3
      }).should.be.rejectedWith(ERROR_MSG)
      await homeContract.setMaxPerTx(100).should.be.rejectedWith(ERROR_MSG);
      await homeContract.setDailyLimit(100).should.be.fulfilled;
      await homeContract.setMaxPerTx(99).should.be.fulfilled;
      //meets max per tx and daily limit
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 99
      }).should.be.fulfilled
      //above daily limit
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 1
      }).should.be.rejectedWith(ERROR_MSG)

    })

    it('should not let to deposit less than minPerTx', async () => {
      const newDailyLimit = 100;
      const newMaxPerTx = 50;
      const newMinPerTx = 20;

      await blockRewardContract.addMintedTotallyByBridge(200, homeContract.address)

      await homeContract.setDailyLimit(newDailyLimit).should.be.fulfilled;
      await homeContract.setMaxPerTx(newMaxPerTx).should.be.fulfilled;
      await homeContract.setMinPerTx(newMinPerTx).should.be.fulfilled;

      await homeContract.sendTransaction({ from: accounts[1], value: newMinPerTx }).should.be.fulfilled
      await homeContract.sendTransaction({ from: accounts[1], value: newMinPerTx - 1 }).should.be.rejectedWith(ERROR_MSG)
    })

    it('should fail if not enough bridged tokens', async () => {

      const initiallyMinted = await blockRewardContract.mintedTotallyByBridge(homeContract.address)
      initiallyMinted.should.be.bignumber.equal(0)

      await homeContract.sendTransaction({ from: accounts[1], value: 1 }).should.be.rejectedWith(ERROR_MSG)

      await blockRewardContract.addMintedTotallyByBridge(2, homeContract.address)

      await homeContract.sendTransaction({ from: accounts[1], value: 1 }).should.be.fulfilled

      await homeContract.sendTransaction({ from: accounts[1], value: 1 }).should.be.fulfilled

      await homeContract.sendTransaction({ from: accounts[1], value: 1 }).should.be.rejectedWith(ERROR_MSG)

      const minted = await blockRewardContract.mintedTotallyByBridge(homeContract.address)
      const burnt = await homeContract.totalBurntCoins()

      minted.should.be.bignumber.equal(2)
      burnt.should.be.bignumber.equal(2)
    })
  })

  describe('#setting limits', async () => {
    let homeContract;
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner)
    })
    it('setMaxPerTx allows to set only to owner and cannot be more than daily limit', async () => {
      await homeContract.setMaxPerTx(2, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG);
      await homeContract.setMaxPerTx(2, {from: owner}).should.be.fulfilled;

      await homeContract.setMaxPerTx(3, {from: owner}).should.be.rejectedWith(ERROR_MSG);
      const maxPerTx = await homeContract.maxPerTx()
      maxPerTx.should.be.bignumber.equal(web3.toBigNumber(2))
    })

    it('setMinPerTx allows to set only to owner and cannot be more than daily limit and should be less than maxPerTx', async () => {
      await homeContract.setMinPerTx(1, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG);
      await homeContract.setMinPerTx(1, {from: owner}).should.be.fulfilled;

      await homeContract.setMinPerTx(2, {from: owner}).should.be.rejectedWith(ERROR_MSG);
      const minPerTx = await homeContract.minPerTx()
      minPerTx.should.be.bignumber.equal(web3.toBigNumber(1))
    })

    it('setExecutionMaxPerTx allows to set only to owner and cannot be more than execution daily limit', async () => {
      const newValue = web3.toBigNumber(web3.toWei(0.3, "ether"));

      const initialExecutionMaxPerTx = await homeContract.executionMaxPerTx()

      initialExecutionMaxPerTx.should.be.bignumber.not.equal(newValue)

      await homeContract.setExecutionMaxPerTx(newValue, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG);
      await homeContract.setExecutionMaxPerTx(newValue, {from: owner}).should.be.fulfilled;

      await homeContract.setExecutionMaxPerTx(oneEther, {from: owner}).should.be.rejectedWith(ERROR_MSG);
      const executionMaxPerTx = await homeContract.executionMaxPerTx()
      executionMaxPerTx.should.be.bignumber.equal(newValue)
    })

    it('executionDailyLimit allows to set only to owner', async () => {
      const newValue = web3.toBigNumber(web3.toWei(1.5, "ether"));

      const initialExecutionDailyLimit= await homeContract.executionDailyLimit()

      initialExecutionDailyLimit.should.be.bignumber.not.equal(newValue)

      await homeContract.setExecutionDailyLimit(newValue, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG);
      await homeContract.setExecutionDailyLimit(newValue, {from: owner}).should.be.fulfilled;

      const executionDailyLimit = await homeContract.executionDailyLimit()
      executionDailyLimit.should.be.bignumber.equal(newValue)
    })
  })

  describe('#executeAffirmation', async () => {
    let homeBridge;
    beforeEach(async () => {
      homeBridge = await HomeBridge.new();
      await homeBridge.initialize(validatorContract.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner);
      await blockRewardContract.sendTransaction({
        from: accounts[2],
        value: oneEther
      }).should.be.fulfilled
    })

    it('should allow validator to executeAffirmation', async () => {
      const recipient = accounts[5];
      const value = halfEther;
      const balanceBefore = await web3.eth.getBalance(recipient)
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const {logs} = await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: authorities[0]})

      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[0].args.should.be.deep.equal({
        signer: authorities[0],
        transactionHash
      });
      logs[1].event.should.be.equal("AffirmationCompleted");
      logs[1].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash
      })
      const balanceAfter = await web3.eth.getBalance(recipient)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))

      const msgHash = Web3Utils.soliditySha3(recipient, value, transactionHash);
      const senderHash = Web3Utils.soliditySha3(authorities[0], msgHash)
      true.should.be.equal(await homeBridge.affirmationsSigned(senderHash))
    })

    it('test with 2 signatures required', async () => {
      const validatorContractWith2Signatures = await BridgeValidators.new()
      const authoritiesThreeAccs = [accounts[1], accounts[2], accounts[3]];
      const ownerOfValidators = accounts[0]
      await validatorContractWith2Signatures.initialize(2, authoritiesThreeAccs, ownerOfValidators)
      const homeBridgeWithTwoSigs = await HomeBridge.new();
      await homeBridgeWithTwoSigs.initialize(validatorContractWith2Signatures.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner);
      const recipient = accounts[5];
      const value = halfEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const balanceBefore = await web3.eth.getBalance(recipient)
      const msgHash = Web3Utils.soliditySha3(recipient, value, transactionHash);

      const { logs } = await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {from: authoritiesThreeAccs[0]}).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[0].args.should.be.deep.equal({ signer: authorities[0], transactionHash });
      const notProcessed = await homeBridgeWithTwoSigs.numAffirmationsSigned(msgHash);
      notProcessed.should.be.bignumber.equal(1);

      await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {from: authoritiesThreeAccs[0]}).should.be.rejectedWith(ERROR_MSG);
      const secondSignature = await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {from: authoritiesThreeAccs[1]}).should.be.fulfilled;

      const balanceAfter = await web3.eth.getBalance(recipient)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))

      secondSignature.logs[1].event.should.be.equal("AffirmationCompleted");
      secondSignature.logs[1].args.should.be.deep.equal({ recipient, value, transactionHash })

      const senderHash = Web3Utils.soliditySha3(authoritiesThreeAccs[0], msgHash)
      true.should.be.equal(await homeBridgeWithTwoSigs.affirmationsSigned(senderHash))

      const senderHash2 = Web3Utils.soliditySha3(authoritiesThreeAccs[1], msgHash);
      true.should.be.equal(await homeBridgeWithTwoSigs.affirmationsSigned(senderHash2))

      const markedAsProcessed = await homeBridgeWithTwoSigs.numAffirmationsSigned(msgHash);
      const processed = new web3.BigNumber(2).pow(255).add(2);
      markedAsProcessed.should.be.bignumber.equal(processed)
    })

    it('should not allow non-validator to execute affirmation', async () => {
      const recipient = accounts[5];
      const value = oneEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: accounts[7]}).should.be.rejectedWith(ERROR_MSG);
    })

    it('should fail if the block reward contract is not set', async () => {
      homeBridge = await HomeBridge.new();
      await homeBridge.initialize(validatorContract.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, ZERO_ADDRESS, foreignDailyLimit, foreignMaxPerTx, owner);

      const recipient = accounts[5];
      const value = halfEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG)
    })
    it('works with 5 validators and 3 required signatures', async () => {
      const recipient = accounts[8]
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      let ownerOfValidators = accounts[0]
      const validatorContractWith3Signatures = await BridgeValidators.new()
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)

      const homeBridgeWithThreeSigs = await HomeBridge.new();
      await homeBridgeWithThreeSigs.initialize(validatorContractWith3Signatures.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner);

      const value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";

      const {logs} = await homeBridgeWithThreeSigs.executeAffirmation(recipient, value, transactionHash, {from: authoritiesFiveAccs[0]}).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[0].args.should.be.deep.equal({
        signer: authorities[0],
        transactionHash
      });

      await homeBridgeWithThreeSigs.executeAffirmation(recipient, value, transactionHash, {from: authoritiesFiveAccs[1]}).should.be.fulfilled;
      const thirdSignature = await homeBridgeWithThreeSigs.executeAffirmation(recipient, value, transactionHash, {from: authoritiesFiveAccs[2]}).should.be.fulfilled;

      thirdSignature.logs[1].event.should.be.equal("AffirmationCompleted");
      thirdSignature.logs[1].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash
      })
    })
    it('should not allow execute affirmation over foreign max tx limit', async () => {
      const recipient = accounts[5];
      const value = oneEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const {logs} = await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: authorities[0]}).should.be.fulfilled;

      logs[0].event.should.be.equal("AmountLimitExceeded");
      logs[0].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash
      });
    })
    it('should fail if txHash already set as above of limits', async () => {
      const recipient = accounts[5];
      const value = oneEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const {logs} = await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: authorities[0]}).should.be.fulfilled;

      logs[0].event.should.be.equal("AmountLimitExceeded");
      logs[0].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash
      });

      await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.executeAffirmation(accounts[6], value, transactionHash, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG)
    })
    it('should not allow execute affirmation over daily foreign limit', async () => {
      await blockRewardContract.sendTransaction({
        from: accounts[2],
        value: oneEther
      }).should.be.fulfilled

      const recipient = accounts[5];
      const value = halfEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: authorities[0]}).should.be.fulfilled;

      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[0].args.should.be.deep.equal({
        signer: authorities[0],
        transactionHash
      });
      logs[1].event.should.be.equal("AffirmationCompleted");
      logs[1].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash
      })

      const transactionHash2 = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      const { logs: logs2 } = await homeBridge.executeAffirmation(recipient, value, transactionHash2, {from: authorities[0]}).should.be.fulfilled;

      logs2[0].event.should.be.equal("SignedForAffirmation");
      logs2[0].args.should.be.deep.equal({
        signer: authorities[0],
        transactionHash: transactionHash2
      });
      logs2[1].event.should.be.equal("AffirmationCompleted");
      logs2[1].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash: transactionHash2
      })

      const transactionHash3 = "0x69debd8fd1923c9cb3cd8ef6461e2740b2d037943b941729d5a47671a2bb8712";
      const { logs: logs3 } = await homeBridge.executeAffirmation(recipient, value, transactionHash3, {from: authorities[0]}).should.be.fulfilled;

      logs3[0].event.should.be.equal("AmountLimitExceeded");
      logs3[0].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash: transactionHash3
      });

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()

      outOfLimitAmount.should.be.bignumber.equal(halfEther)

      const transactionHash4 = "0xc9ffe298d85ec5c515153608924b7bdcf1835539813dcc82cdbcc071170c3196";
      const { logs: logs4 } = await homeBridge.executeAffirmation(recipient, value, transactionHash4, {from: authorities[0]}).should.be.fulfilled;

      logs4[0].event.should.be.equal("AmountLimitExceeded");
      logs4[0].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash: transactionHash4
      });

      const newOutOfLimitAmount = await homeBridge.outOfLimitAmount()
      newOutOfLimitAmount.should.be.bignumber.equal(oneEther)
    })
  })

  describe('#submitSignature', async () => {
    let validatorContractWith2Signatures,authoritiesThreeAccs,ownerOfValidators,homeBridgeWithTwoSigs
    beforeEach(async () => {
      validatorContractWith2Signatures = await BridgeValidators.new()
      authoritiesThreeAccs = [accounts[1], accounts[2], accounts[3]];
      ownerOfValidators = accounts[0]
      await validatorContractWith2Signatures.initialize(2, authoritiesThreeAccs, ownerOfValidators)
      homeBridgeWithTwoSigs = await HomeBridge.new();
      await homeBridgeWithTwoSigs.initialize(validatorContractWith2Signatures.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner);
    })

    it('allows a validator to submit a signature', async () => {
      const recipientAccount = accounts[8]
      const value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      const transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      const message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithTwoSigs.address);

      const signature = await sign(authoritiesThreeAccs[0], message)
      const { logs } = await homeBridgeWithTwoSigs.submitSignature(signature, message, {from: authorities[0]}).should.be.fulfilled;

      logs[0].event.should.be.equal('SignedForUserRequest')
      const { messageHash } = logs[0].args
      const signatureFromContract = await homeBridgeWithTwoSigs.signature(messageHash, 0);
      const messageFromContract = await homeBridgeWithTwoSigs.message(messageHash);
      signature.should.be.equal(signatureFromContract);
      messageFromContract.should.be.equal(messageFromContract);
      const hashMsg = Web3Utils.soliditySha3(message);
      const hashSenderMsg = Web3Utils.soliditySha3(authorities[0], hashMsg)
      true.should.be.equal(await homeBridgeWithTwoSigs.messagesSigned(hashSenderMsg));
    })

    it('when enough requiredSignatures are collected, CollectedSignatures event is emitted', async () => {
      const recipientAccount = accounts[8]
      const value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      const transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      const message = createMessage(recipientAccount, value, transactionHash,  homeBridgeWithTwoSigs.address);

      const signature = await sign(authoritiesThreeAccs[0], message)
      const signature2 = await sign(authoritiesThreeAccs[1], message)
      '2'.should.be.bignumber.equal(await validatorContractWith2Signatures.requiredSignatures());

      await homeBridgeWithTwoSigs.submitSignature(signature, message, {from: authoritiesThreeAccs[0]}).should.be.fulfilled;
      await homeBridgeWithTwoSigs.submitSignature(signature, message, {from: authoritiesThreeAccs[0]}).should.be.rejectedWith(ERROR_MSG);
      await homeBridgeWithTwoSigs.submitSignature(signature, message, {from: authoritiesThreeAccs[1]}).should.be.rejectedWith(ERROR_MSG);
      const { logs } = await homeBridgeWithTwoSigs.submitSignature(signature2, message, {from: authoritiesThreeAccs[1]}).should.be.fulfilled;

      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesThreeAccs[1])
    })
    it('works with 5 validators and 3 required signatures', async () => {
      const recipientAccount = accounts[8]
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const validatorContractWith3Signatures = await BridgeValidators.new()
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)

      const homeBridgeWithThreeSigs = await HomeBridge.new();
      await homeBridgeWithThreeSigs.initialize(validatorContractWith3Signatures.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner);

      const value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      const transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      const message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithThreeSigs.address);
      const signature = await sign(authoritiesFiveAccs[0], message)
      const signature2 = await sign(authoritiesFiveAccs[1], message)
      const signature3 = await sign(authoritiesFiveAccs[2], message)
      '3'.should.be.bignumber.equal(await validatorContractWith3Signatures.requiredSignatures());

      await homeBridgeWithThreeSigs.submitSignature(signature, message, {from: authoritiesFiveAccs[0]}).should.be.fulfilled;
      await homeBridgeWithThreeSigs.submitSignature(signature2, message, {from: authoritiesFiveAccs[1]}).should.be.fulfilled;
      const {logs} = await homeBridgeWithThreeSigs.submitSignature(signature3, message, {from: authoritiesFiveAccs[2]}).should.be.fulfilled;
      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesFiveAccs[2])
    })
    it('attack when increasing requiredSignatures', async () => {
      const recipientAccount = accounts[8]
      const value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      const transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      const message = createMessage(recipientAccount, value, transactionHash,  homeBridgeWithTwoSigs.address);
      const signature = await sign(authoritiesThreeAccs[0], message)
      const signature2 = await sign(authoritiesThreeAccs[1], message)
      const signature3 = await sign(authoritiesThreeAccs[2], message)
      '2'.should.be.bignumber.equal(await validatorContractWith2Signatures.requiredSignatures());

      await homeBridgeWithTwoSigs.submitSignature(signature, message, {from: authoritiesThreeAccs[0]}).should.be.fulfilled;
      await homeBridgeWithTwoSigs.submitSignature(signature, message, {from: authoritiesThreeAccs[0]}).should.be.rejectedWith(ERROR_MSG);
      await homeBridgeWithTwoSigs.submitSignature(signature, message, {from: authoritiesThreeAccs[1]}).should.be.rejectedWith(ERROR_MSG);
      const { logs } = await homeBridgeWithTwoSigs.submitSignature(signature2, message, {from: authoritiesThreeAccs[1]}).should.be.fulfilled;

      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesThreeAccs[1])

      await validatorContractWith2Signatures.setRequiredSignatures(3).should.be.fulfilled;
      '3'.should.be.bignumber.equal(await validatorContractWith2Signatures.requiredSignatures());
      await homeBridgeWithTwoSigs.submitSignature(signature3, message, {from: authoritiesThreeAccs[2]}).should.be.rejectedWith(ERROR_MSG);
    })

    it('attack when decreasing requiredSignatures', async () => {
      const recipientAccount = accounts[8]
      const value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      const transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      const message = createMessage(recipientAccount, value, transactionHash,  homeBridgeWithTwoSigs.address);
      const signature = await sign(authoritiesThreeAccs[0], message)
      const signature2 = await sign(authoritiesThreeAccs[1], message)
      '2'.should.be.bignumber.equal(await validatorContractWith2Signatures.requiredSignatures());

      await homeBridgeWithTwoSigs.submitSignature(signature, message, {from: authoritiesThreeAccs[0]}).should.be.fulfilled;
      await validatorContractWith2Signatures.setRequiredSignatures(1).should.be.fulfilled;
      '1'.should.be.bignumber.equal(await validatorContractWith2Signatures.requiredSignatures());
      const { logs } = await homeBridgeWithTwoSigs.submitSignature(signature2, message, {from: authoritiesThreeAccs[1]}).should.be.fulfilled;

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
      const requiredMessageLength = await homeContract.requiredMessageLength()
      '104'.should.be.bignumber.equal(requiredMessageLength)
    })
  })
  describe('#fixAssetsAboveLimits', async () => {
    let homeBridge;
    const zeroValue = web3.toBigNumber(web3.toWei(0, "ether"))
    beforeEach(async () => {
      const homeBridgeImpl = await HomeBridge.new();
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      homeBridge = await HomeBridge.at(storageProxy.address);
      await homeBridge.initialize(validatorContract.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner);
    })
    it('Should reduce outOfLimitAmount and not emit any event', async () => {
      const recipient = accounts[5];
      const value = oneEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const {logs: affirmationLogs} = await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: authorities[0]}).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal("AmountLimitExceeded");

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()
      outOfLimitAmount.should.be.bignumber.equal(value)

      const { logs } = await homeBridge.fixAssetsAboveLimits(transactionHash, false).should.be.fulfilled

      logs.length.should.be.equal(0)

      const newOutOfLimitAmount = await homeBridge.outOfLimitAmount()
      newOutOfLimitAmount.should.be.bignumber.equal(zeroValue)
    })
    it('Should reduce outOfLimitAmount and emit UserRequestForSignature', async () => {
      const recipient = accounts[5];
      const value = oneEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const {logs: affirmationLogs} = await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: authorities[0]}).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal("AmountLimitExceeded");

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()
      outOfLimitAmount.should.be.bignumber.equal(value)

      const { logs } = await homeBridge.fixAssetsAboveLimits(transactionHash, true).should.be.fulfilled

      logs.length.should.be.equal(1)
      logs[0].event.should.be.equal('UserRequestForSignature')
      logs[0].args.should.be.deep.equal({
        recipient,
        value
      })

      const newOutOfLimitAmount = await homeBridge.outOfLimitAmount()
      newOutOfLimitAmount.should.be.bignumber.equal(zeroValue)
    })
    it('Should not be allow to be called by an already fixed txHash', async () => {
      const recipient = accounts[5];
      const value = oneEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const transactionHash2 = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";

      await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: authorities[0]}).should.be.fulfilled
      await homeBridge.executeAffirmation(recipient, value, transactionHash2, {from: authorities[0]}).should.be.fulfilled

      const outOfLimitAmount = await homeBridge.outOfLimitAmount()
      outOfLimitAmount.should.be.bignumber.equal(value.add(value))

      await homeBridge.fixAssetsAboveLimits(transactionHash, false).should.be.fulfilled

      const newOutOfLimitAmount = await homeBridge.outOfLimitAmount()
      newOutOfLimitAmount.should.be.bignumber.equal(value)

      await homeBridge.fixAssetsAboveLimits(transactionHash, false).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.fixAssetsAboveLimits(transactionHash2, false).should.be.fulfilled

      const updatedOutOfLimitAmount = await homeBridge.outOfLimitAmount()
      updatedOutOfLimitAmount.should.be.bignumber.equal(zeroValue)

      await homeBridge.fixAssetsAboveLimits(transactionHash2, false).should.be.rejectedWith(ERROR_MSG)
    })
    it('Should fail if txHash didnt increase out of limit amount', async () => {
      const recipient = accounts[5];
      const value = oneEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const invalidTxHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";

      const {logs: affirmationLogs} = await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: authorities[0]}).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal("AmountLimitExceeded");

      await homeBridge.fixAssetsAboveLimits(invalidTxHash, true).should.be.rejectedWith(ERROR_MSG)
    })
    it('Should fail if not called by proxyOwner', async () => {
      const recipient = accounts[5];
      const value = oneEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";

      const {logs: affirmationLogs} = await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: authorities[0]}).should.be.fulfilled

      affirmationLogs[0].event.should.be.equal("AmountLimitExceeded");

      await homeBridge.fixAssetsAboveLimits(transactionHash, true, { from: recipient}).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.fixAssetsAboveLimits(transactionHash, true, { from: owner}).should.be.fulfilled
    })
  })
  describe('#OwnedUpgradeability', async () => {

    it('upgradeabilityAdmin should return the proxy owner', async () => {
      const homeBridgeImpl = await HomeBridge.new();
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address);

      const proxyOwner = await storageProxy.proxyOwner()
      const upgradeabilityAdmin = await homeBridge.upgradeabilityAdmin()

      upgradeabilityAdmin.should.be.equal(proxyOwner)
    })
  })

  describe('#feeManager', async () => {
    let homeBridge, rewardableValidators
    let owner = accounts[9]
    let validators = [accounts[1]]
    let rewards = [accounts[2]]
    let requiredSignatures = 1
    beforeEach(async () => {
      rewardableValidators = await RewardableValidators.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      const homeBridgeImpl = await HomeBridge.new();
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      homeBridge = await HomeBridge.at(storageProxy.address);
      await homeBridge.initialize(rewardableValidators.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner).should.be.fulfilled
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
      const homeFee = web3.toBigNumber(web3.toWei(0.1, "ether"))
      const foreignFee = web3.toBigNumber(web3.toWei(0.2, "ether"))
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
  })
  describe('#feeManager_ExecuteAffirmation', async () => {
    it('should distribute fee to validator', async () => {
      // Initialize
      const owner = accounts[9]
      const validators = [accounts[1]]
      const rewards = [accounts[2]]
      const requiredSignatures = 1
      const rewardableValidators = await RewardableValidators.new()
      const homeBridgeImpl = await HomeBridge.new();
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address);
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {from: owner}).should.be.fulfilled
      await homeBridge.initialize(rewardableValidators.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner).should.be.fulfilled
      await blockRewardContract.sendTransaction({
        from: accounts[2],
        value: oneEther
      }).should.be.fulfilled

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = web3.toBigNumber(web3.toWei(fee, "ether"))
      const feeManager = await FeeManagerErcToNative.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setForeignFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = accounts[5];
      const value = halfEther;
      const balanceBefore = await web3.eth.getBalance(recipient)
      const rewardAddressBalanceBefore = await web3.eth.getBalance(rewards[0])
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";

      // When
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: validators[0]}).should.be.fulfilled

      // Then
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[0].args.should.be.deep.equal({
        signer: validators[0],
        transactionHash
      });
      logs[1].event.should.be.equal("FeeDistributedFromAffirmation");
      logs[1].args.should.be.deep.equal({
        feeAmount: value.mul(web3.toBigNumber(fee)),
        transactionHash
      })
      logs[2].event.should.be.equal("AffirmationCompleted");
      logs[2].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash
      })
      const balanceAfter = await web3.eth.getBalance(recipient)
      const rewardAddressBalanceAfter = await web3.eth.getBalance(rewards[0])

      rewardAddressBalanceAfter.should.be.bignumber.equal(rewardAddressBalanceBefore.add(value.mul(web3.toBigNumber(fee))))
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value.mul(web3.toBigNumber(1 - fee))))
    })
    it('should distribute fee to 3 validators', async () => {
      // Initialize
      const owner = accounts[9]
      const validators = [accounts[1], accounts[2], accounts[3]]
      const rewards = [accounts[4], accounts[5], accounts[6]]
      const requiredSignatures = 2
      const rewardableValidators = await RewardableValidators.new()
      const homeBridgeImpl = await HomeBridge.new();
      const blockRewardContract = await BlockReward.new()
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address);
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {from: owner}).should.be.fulfilled
      await homeBridge.initialize(rewardableValidators.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner).should.be.fulfilled
      await blockRewardContract.sendTransaction({
        from: accounts[0],
        value: halfEther
      }).should.be.fulfilled

      // Given
      const initialBlockRewardBalance = await web3.eth.getBalance(blockRewardContract.address)
      initialBlockRewardBalance.should.be.bignumber.equal(halfEther)

      const value = halfEther;
      // 0.1% fee
      const fee = 0.001
      const feeInWei = web3.toBigNumber(web3.toWei(fee, "ether"))
      // totalFee / 3
      const feePerValidator = web3.toBigNumber(166666666666666)
      const feePerValidatorPlusDiff = web3.toBigNumber(166666666666668)
      const feeManager = await FeeManagerErcToNative.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setForeignFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = accounts[8];
      const balanceBefore = await web3.eth.getBalance(recipient)

      const initialBalanceRewardAddress1 = await web3.eth.getBalance(rewards[0])
      const initialBalanceRewardAddress2 = await web3.eth.getBalance(rewards[1])
      const initialBalanceRewardAddress3 = await web3.eth.getBalance(rewards[2])


      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";

      // When
      const { logs: logsValidator1 } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: validators[0]}).should.be.fulfilled
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: validators[1]}).should.be.fulfilled

      // Then
      logsValidator1.length.should.be.equals(1)

      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[0].args.should.be.deep.equal({
        signer: validators[1],
        transactionHash
      });
      logs[1].event.should.be.equal("FeeDistributedFromAffirmation");
      logs[1].args.should.be.deep.equal({
        feeAmount: value.mul(web3.toBigNumber(fee)),
        transactionHash
      })
      logs[2].event.should.be.equal("AffirmationCompleted");
      logs[2].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash
      })
      const balanceAfter = await web3.eth.getBalance(recipient)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value.mul(web3.toBigNumber(1 - fee))))

      const updatedBalanceRewardAddress1 = await web3.eth.getBalance(rewards[0])
      const updatedBalanceRewardAddress2 = await web3.eth.getBalance(rewards[1])
      const updatedBalanceRewardAddress3 = await web3.eth.getBalance(rewards[2])

      expect(
        updatedBalanceRewardAddress1.eq(initialBalanceRewardAddress1.add(feePerValidator))
        || updatedBalanceRewardAddress1.eq(initialBalanceRewardAddress1.add(feePerValidatorPlusDiff))).to.equal(true)
      expect(
        updatedBalanceRewardAddress2.eq(initialBalanceRewardAddress2.add(feePerValidator))
        || updatedBalanceRewardAddress2.eq(initialBalanceRewardAddress2.add(feePerValidatorPlusDiff))).to.equal(true)
      expect(
        updatedBalanceRewardAddress3.eq(initialBalanceRewardAddress3.add(feePerValidator))
        || updatedBalanceRewardAddress3.eq(initialBalanceRewardAddress3.add(feePerValidatorPlusDiff))).to.equal(true)

      const blockRewardBalance = await web3.eth.getBalance(blockRewardContract.address)
      blockRewardBalance.should.be.bignumber.equal('0')
    })
    it('should distribute fee to 5 validators', async () => {
      // Initialize
      const owner = accounts[0]
      const validators = [accounts[0], accounts[1], accounts[2], accounts[3], accounts[4]]
      const rewards = [accounts[5], accounts[6], accounts[7], accounts[8], accounts[9]]
      const requiredSignatures = 5
      const rewardableValidators = await RewardableValidators.new()
      const homeBridgeImpl = await HomeBridge.new();
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address);
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {from: owner}).should.be.fulfilled
      await homeBridge.initialize(rewardableValidators.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner).should.be.fulfilled
      await blockRewardContract.sendTransaction({
        from: accounts[0],
        value: oneEther
      }).should.be.fulfilled

      // Given
      const value = halfEther;
      // 0.1% fee
      const fee = 0.001
      const feeInWei = web3.toBigNumber(web3.toWei(fee, "ether"))
      const feeAmount = value.mul(web3.toBigNumber(fee))
      const feePerValidator = feeAmount.div(web3.toBigNumber(5))
      const feeManager = await FeeManagerErcToNative.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setForeignFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = "0xf4bef13f9f4f2b203faf0c3cbbaabe1afe056955";
      const balanceBefore = await web3.eth.getBalance(recipient)

      const initialBalanceRewardAddress1 = await web3.eth.getBalance(rewards[0])
      const initialBalanceRewardAddress2 = await web3.eth.getBalance(rewards[1])
      const initialBalanceRewardAddress3 = await web3.eth.getBalance(rewards[2])
      const initialBalanceRewardAddress4 = await web3.eth.getBalance(rewards[3])
      const initialBalanceRewardAddress5 = await web3.eth.getBalance(rewards[4])


      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";

      // When
      const { logs: logsValidator1 } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: validators[0]}).should.be.fulfilled
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: validators[1]}).should.be.fulfilled
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: validators[2]}).should.be.fulfilled
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: validators[3]}).should.be.fulfilled
      const { logs } = await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: validators[4]}).should.be.fulfilled

      // Then
      logsValidator1.length.should.be.equals(1)

      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[0].args.should.be.deep.equal({
        signer: validators[4],
        transactionHash
      });
      logs[1].event.should.be.equal("FeeDistributedFromAffirmation");
      logs[1].args.should.be.deep.equal({
        feeAmount: value.mul(web3.toBigNumber(fee)),
        transactionHash
      })
      logs[2].event.should.be.equal("AffirmationCompleted");
      logs[2].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash
      })
      const balanceAfter = await web3.eth.getBalance(recipient)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value.sub(feeAmount)))

      const updatedBalanceRewardAddress1 = await web3.eth.getBalance(rewards[0])
      const updatedBalanceRewardAddress2 = await web3.eth.getBalance(rewards[1])
      const updatedBalanceRewardAddress3 = await web3.eth.getBalance(rewards[2])
      const updatedBalanceRewardAddress4 = await web3.eth.getBalance(rewards[3])
      const updatedBalanceRewardAddress5 = await web3.eth.getBalance(rewards[4])

      updatedBalanceRewardAddress1.should.be.bignumber.equal(initialBalanceRewardAddress1.add(feePerValidator))
      updatedBalanceRewardAddress2.should.be.bignumber.equal(initialBalanceRewardAddress2.add(feePerValidator))
      updatedBalanceRewardAddress3.should.be.bignumber.equal(initialBalanceRewardAddress3.add(feePerValidator))
      updatedBalanceRewardAddress4.should.be.bignumber.equal(initialBalanceRewardAddress4.add(feePerValidator))
      updatedBalanceRewardAddress5.should.be.bignumber.equal(initialBalanceRewardAddress5.add(feePerValidator))
    })
  })
  describe('#feeManager_fallback', function () {
    let homeBridge, rewardableValidators
    let owner = accounts[9]
    let validators = [accounts[1]]
    let rewards = [accounts[2]]
    let requiredSignatures = 1
    beforeEach(async () => {
      rewardableValidators = await RewardableValidators.new()
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner).should.be.fulfilled
      const homeBridgeImpl = await HomeBridge.new();
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      homeBridge = await HomeBridge.at(storageProxy.address);
      await homeBridge.initialize(rewardableValidators.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner).should.be.fulfilled
      await blockRewardContract.addMintedTotallyByBridge(oneEther, homeBridge.address)
    })

    it('should subtract fee from value', async () => {
      // Given
      // 0.1% fee
      const value = halfEther
      const recipient = accounts[8];
      const fee = 0.001
      const feeInWei = web3.toBigNumber(web3.toWei(fee, "ether"))
      const feeManager = await FeeManagerErcToNative.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setHomeFee(feeInWei, { from: owner }).should.be.fulfilled

      // When
      const { logs } = await homeBridge.sendTransaction({ from: recipient, value }).should.be.fulfilled

      // Then
      const finalValue = value.mul(web3.toBigNumber(1 - fee))
      logs[0].event.should.be.equal('UserRequestForSignature')
      logs[0].args.should.be.deep.equal({ recipient: recipient, value: finalValue })
      const currentDay = await homeBridge.getCurrentDay()
      value.should.be.bignumber.equal(await homeBridge.totalSpentPerDay(currentDay))
      finalValue.should.be.bignumber.equal(await homeBridge.totalBurntCoins())
      const homeBridgeBalance = await web3.eth.getBalance(homeBridge.address)
      homeBridgeBalance.should.be.bignumber.equal(value.sub(finalValue))
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
      const homeBridgeImpl = await HomeBridge.new();
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address);
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {from: owner}).should.be.fulfilled
      await homeBridge.initialize(rewardableValidators.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner).should.be.fulfilled
      await blockRewardContract.addMintedTotallyByBridge(oneEther, homeBridge.address)

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = web3.toBigNumber(web3.toWei(fee, "ether"))
      const feeManager = await FeeManagerErcToNative.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setHomeFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = accounts[5];
      const initialValue = halfEther
      const value = halfEther.mul(web3.toBigNumber(1-fee));
      const feeAmount = initialValue.mul(web3.toBigNumber(fee))
      const rewardAddressBalanceBefore = await web3.eth.getBalance(rewards[0])
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";

      const initialBridgeBalance = await web3.eth.getBalance(homeBridge.address)
      initialBridgeBalance.should.be.bignumber.equal('0')

      // When
      await homeBridge.sendTransaction({ from: recipient, value: initialValue }).should.be.fulfilled

      const afterTransferBridgeBalance = await web3.eth.getBalance(homeBridge.address)
      afterTransferBridgeBalance.should.be.bignumber.equal(feeAmount)

      const message = createMessage(recipient, value, transactionHash,  homeBridge.address);

      const signature = await sign(validators[0], message)

      const { logs } = await homeBridge.submitSignature(signature, message, {from: validators[0]}).should.be.fulfilled;

      // Then
      logs.length.should.be.equal(3)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[2].event.should.be.equal('FeeDistributedFromSignatures')

      const finalBridgeBalance = await web3.eth.getBalance(homeBridge.address)
      finalBridgeBalance.should.be.bignumber.equal('0')

      const rewardAddressBalanceAfter = await web3.eth.getBalance(rewards[0])
      rewardAddressBalanceAfter.should.be.bignumber.equal(rewardAddressBalanceBefore.add(feeAmount))
    })
    it('should distribute fee to 3 validators', async () => {
      // Initialize
      const owner = accounts[9]
      const validators = [accounts[1], accounts[2], accounts[3]]
      const rewards = [accounts[4], accounts[5], accounts[6]]
      const requiredSignatures = 3
      const rewardableValidators = await RewardableValidators.new()
      const homeBridgeImpl = await HomeBridge.new();
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address);
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {from: owner}).should.be.fulfilled
      await homeBridge.initialize(rewardableValidators.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner).should.be.fulfilled
      await blockRewardContract.addMintedTotallyByBridge(oneEther, homeBridge.address)

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = web3.toBigNumber(web3.toWei(fee, "ether"))
      const feeManager = await FeeManagerErcToNative.new()
      const feePerValidator = web3.toBigNumber(166666666666666)
      const feePerValidatorPlusDiff = web3.toBigNumber(166666666666668)
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setHomeFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = accounts[7];
      const initialValue = halfEther
      const value = halfEther.mul(web3.toBigNumber(1-fee));
      const feeAmount = initialValue.mul(web3.toBigNumber(fee))
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";

      const initialBridgeBalance = await web3.eth.getBalance(homeBridge.address)
      initialBridgeBalance.should.be.bignumber.equal('0')

      const initialBalanceRewardAddress1 = await web3.eth.getBalance(rewards[0])
      const initialBalanceRewardAddress2 = await web3.eth.getBalance(rewards[1])
      const initialBalanceRewardAddress3 = await web3.eth.getBalance(rewards[2])

      // When
      await homeBridge.sendTransaction({ from: recipient, value: initialValue }).should.be.fulfilled

      const afterTransferBridgeBalance = await web3.eth.getBalance(homeBridge.address)
      afterTransferBridgeBalance.should.be.bignumber.equal(feeAmount)

      const message = createMessage(recipient, value, transactionHash,  homeBridge.address);

      const signature = await sign(validators[0], message)
      const signature2 = await sign(validators[1], message)
      const signature3 = await sign(validators[2], message)

      await homeBridge.submitSignature(signature, message, {from: validators[0]}).should.be.fulfilled;
      await homeBridge.submitSignature(signature2, message, {from: validators[1]}).should.be.fulfilled;
      const { logs } = await homeBridge.submitSignature(signature3, message, {from: validators[2]}).should.be.fulfilled;

      // Then
      logs.length.should.be.equal(3)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[2].event.should.be.equal('FeeDistributedFromSignatures')

      const updatedBalanceRewardAddress1 = await web3.eth.getBalance(rewards[0])
      const updatedBalanceRewardAddress2 = await web3.eth.getBalance(rewards[1])
      const updatedBalanceRewardAddress3 = await web3.eth.getBalance(rewards[2])

      const bridgeBalance = await web3.eth.getBalance(homeBridge.address)
      bridgeBalance.should.be.bignumber.equal('0')

      expect(
        updatedBalanceRewardAddress1.eq(initialBalanceRewardAddress1.add(feePerValidator))
        || updatedBalanceRewardAddress1.eq(initialBalanceRewardAddress1.add(feePerValidatorPlusDiff))).to.equal(true)
      expect(
        updatedBalanceRewardAddress2.eq(initialBalanceRewardAddress2.add(feePerValidator))
        || updatedBalanceRewardAddress2.eq(initialBalanceRewardAddress2.add(feePerValidatorPlusDiff))).to.equal(true)
      expect(
        updatedBalanceRewardAddress3.eq(initialBalanceRewardAddress3.add(feePerValidator))
        || updatedBalanceRewardAddress3.eq(initialBalanceRewardAddress3.add(feePerValidatorPlusDiff))).to.equal(true)
    })
    it('should distribute fee to 5 validators', async () => {
      // Initialize
      const owner = accounts[0]
      const validators = [accounts[0], accounts[1], accounts[2], accounts[3], accounts[4]]
      const rewards = [accounts[5], accounts[6], accounts[7], accounts[8], accounts[9]]
      const requiredSignatures = 5
      const rewardableValidators = await RewardableValidators.new()
      const homeBridgeImpl = await HomeBridge.new();
      const storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      await storageProxy.upgradeTo('1', homeBridgeImpl.address).should.be.fulfilled
      const homeBridge = await HomeBridge.at(storageProxy.address);
      await rewardableValidators.initialize(requiredSignatures, validators, rewards, owner, {from: owner}).should.be.fulfilled
      await homeBridge.initialize(rewardableValidators.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, blockRewardContract.address, foreignDailyLimit, foreignMaxPerTx, owner).should.be.fulfilled
      await blockRewardContract.addMintedTotallyByBridge(oneEther, homeBridge.address)

      // Given
      // 0.1% fee
      const fee = 0.001
      const feeInWei = web3.toBigNumber(web3.toWei(fee, "ether"))
      const feeManager = await FeeManagerErcToNative.new()
      await homeBridge.setFeeManagerContract(feeManager.address, { from: owner }).should.be.fulfilled
      await homeBridge.setHomeFee(feeInWei, { from: owner }).should.be.fulfilled

      const recipient = accounts[0];
      const initialValue = halfEther
      const value = halfEther.mul(web3.toBigNumber(1-fee));
      const feeAmount = initialValue.mul(web3.toBigNumber(fee))
      const feePerValidator = feeAmount.div(web3.toBigNumber(5))
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";

      const initialBridgeBalance = await web3.eth.getBalance(homeBridge.address)
      initialBridgeBalance.should.be.bignumber.equal('0')

      const initialBalanceRewardAddress1 = await web3.eth.getBalance(rewards[0])
      const initialBalanceRewardAddress2 = await web3.eth.getBalance(rewards[1])
      const initialBalanceRewardAddress3 = await web3.eth.getBalance(rewards[2])
      const initialBalanceRewardAddress4 = await web3.eth.getBalance(rewards[3])
      const initialBalanceRewardAddress5 = await web3.eth.getBalance(rewards[4])

      // When
      await homeBridge.sendTransaction({ from: recipient, value: initialValue }).should.be.fulfilled

      const afterTransferBridgeBalance = await web3.eth.getBalance(homeBridge.address)
      afterTransferBridgeBalance.should.be.bignumber.equal(feeAmount)

      const message = createMessage(recipient, value, transactionHash,  homeBridge.address);

      const signature = await sign(validators[0], message)
      const signature2 = await sign(validators[1], message)
      const signature3 = await sign(validators[2], message)
      const signature4 = await sign(validators[3], message)
      const signature5 = await sign(validators[4], message)

      await homeBridge.submitSignature(signature, message, {from: validators[0]}).should.be.fulfilled;
      await homeBridge.submitSignature(signature2, message, {from: validators[1]}).should.be.fulfilled;
      await homeBridge.submitSignature(signature3, message, {from: validators[2]}).should.be.fulfilled;
      await homeBridge.submitSignature(signature4, message, {from: validators[3]}).should.be.fulfilled;
      const { logs } = await homeBridge.submitSignature(signature5, message, {from: validators[4]}).should.be.fulfilled;

      // Then
      logs.length.should.be.equal(3)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[2].event.should.be.equal('FeeDistributedFromSignatures')

      const updatedBalanceRewardAddress1 = await web3.eth.getBalance(rewards[0])
      const updatedBalanceRewardAddress2 = await web3.eth.getBalance(rewards[1])
      const updatedBalanceRewardAddress3 = await web3.eth.getBalance(rewards[2])
      const updatedBalanceRewardAddress4 = await web3.eth.getBalance(rewards[3])
      const updatedBalanceRewardAddress5 = await web3.eth.getBalance(rewards[4])

      updatedBalanceRewardAddress1.should.be.bignumber.equal(initialBalanceRewardAddress1.add(feePerValidator))
      updatedBalanceRewardAddress2.should.be.bignumber.equal(initialBalanceRewardAddress2.add(feePerValidator))
      updatedBalanceRewardAddress3.should.be.bignumber.equal(initialBalanceRewardAddress3.add(feePerValidator))
      updatedBalanceRewardAddress4.should.be.bignumber.equal(initialBalanceRewardAddress4.add(feePerValidator))
      updatedBalanceRewardAddress5.should.be.bignumber.equal(initialBalanceRewardAddress5.add(feePerValidator))
    })
  })
  describe('#FeeManager_random', async () => {
    it('should return value between 0 and 3', async () => {
      // Given
      const feeManager = await FeeManagerErcToNative.new()

      for (let i = 0; i < 10; i++) {
        // send Tx to generate new blocks
        await feeManager.setHomeFee(0).should.be.fulfilled

        // When
        const result = await feeManager.random(3);

        // Then
        result.should.be.bignumber.gte(0);
        result.should.be.bignumber.lt(3);
      }
    })
  })
})
