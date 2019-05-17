const Web3Utils = require('web3-utils');
const HomeAMB = artifacts.require("HomeAMB.sol");
const BridgeValidators = artifacts.require("BridgeValidators.sol");
const Box = artifacts.require("Box.sol");
const EternalStorageProxy = artifacts.require("EternalStorageProxy.sol");
const requiredBlockConfirmations = 8;
const gasPrice = Web3Utils.toWei('1', 'gwei');
const oneEther = web3.toBigNumber(web3.toWei(1, "ether"));
const { ERROR_MSG, ZERO_ADDRESS } = require('../setup');
const { strip0x, sign } = require('../helpers/helpers');


contract('HomeAMB', async (accounts) => {
  let validatorContract, authorities, owner, validatorsRequiredSignatures;
  before(async () => {
    validatorContract = await BridgeValidators.new()
    authorities = [accounts[1], accounts[2]];
    owner = accounts[0]
    validatorsRequiredSignatures = 1
    await validatorContract.initialize(validatorsRequiredSignatures, authorities, owner)
  })
  describe('balance', () => {
    let boxContract
    before(async () => {
      boxContract = await Box.new()
    })
    it('should start with zero balance', async () => {
      const homeBridge = await HomeAMB.new()
      const balance = await homeBridge.balanceOf(boxContract.address)
      '0'.should.be.bignumber.equal(balance)
    })

    it('should receive balance for a contract', async () => {
      const homeBridge = await HomeAMB.new()
      await homeBridge.depositForContractSender(boxContract.address, {
        from: accounts[1],
        value: 1
      })
      const deposit = await homeBridge.balanceOf(boxContract.address)
      const balance = await web3.eth.getBalance(homeBridge.address)
      '1'.should.be.bignumber.equal(deposit)
      '1'.should.be.bignumber.equal(balance)
    })

    it('should revert for address 0', async () => {
      const homeBridge = await HomeAMB.new()
      await homeBridge.depositForContractSender(ZERO_ADDRESS, {
        from: accounts[1],
        value: 1
      }).should.be.rejectedWith(ERROR_MSG)
    })

    it('user should be able to withdraw balance', async () => {
      const user = accounts[8]

      const homeBridge = await HomeAMB.new()
      await homeBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner)

      await homeBridge.depositForContractSender(user, {
        from: user,
        value: oneEther
      })

      const userBalanceOnBridgeAfterDeposit = await homeBridge.balanceOf(user)
      const userBalanceAfterDeposit = await web3.eth.getBalance(user)
      userBalanceOnBridgeAfterDeposit.should.be.bignumber.equal(oneEther)

      const result = await boxContract.getWithdrawFromDepositData(user)
      const withdrawFromDepositData = result.logs[0].args.selectorData

      // Use these calls to simulate foreign bridge on Foreign network
      const resultPassMessageTx = await homeBridge.requireToPassMessage(
        homeBridge.address,
        withdrawFromDepositData,
        821254,
        1, { from: user })

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.tx) + encodedData.slice(82)

      const { logs } = await homeBridge.executeAffirmation(message, { from: authorities[0] }).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[1].event.should.be.equal("AffirmationCompleted");

      const userBalanceOnBridgeAfterWithdraw = await homeBridge.balanceOf(user)
      const userBalanceAfterWithdraw = await web3.eth.getBalance(user)
      userBalanceOnBridgeAfterWithdraw.should.be.bignumber.equal(0)
      userBalanceAfterWithdraw.should.be.bignumber.gt(userBalanceAfterDeposit)
    })
  })
  describe('getBridgeMode', () => {
    it('should return arbitrary message bridging mode and interface', async () => {
      const homeContract = await HomeAMB.new()
      const bridgeModeHash = '0x2544fbb9' // 4 bytes of keccak256('arbitrary-message-bridge-core')
      const bridgeMode = await homeContract.getBridgeMode()
      bridgeMode.should.be.equal(bridgeModeHash)

      const [major, minor, patch] = await homeContract.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)

    })
  })
  describe('compensation mode', () => {
    it('should return homeToForeignMode', async () => {
      const homeBridge = await HomeAMB.new()
      await homeBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner).should.be.fulfilled;

      const defrayalHash = Web3Utils.toHex('AMB-defrayal-mode')
      const subsidizedHash = Web3Utils.toHex('AMB-subsidized-mode')

      const defrayalMode = await homeBridge.homeToForeignMode()
      defrayalMode.should.be.equal(defrayalHash)

      await homeBridge.setSubsidizedModeForHomeToForeign().should.be.fulfilled;

      const subsidizedMode = await homeBridge.homeToForeignMode()
      subsidizedMode.should.be.equal(subsidizedHash)
    })
    it('should return foreignToHomeMode', async () => {
      const homeBridge = await HomeAMB.new()
      await homeBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner).should.be.fulfilled;

      const defrayalHash = Web3Utils.toHex('AMB-defrayal-mode')
      const subsidizedHash = Web3Utils.toHex('AMB-subsidized-mode')

      const defrayalMode = await homeBridge.foreignToHomeMode()
      defrayalMode.should.be.equal(defrayalHash)

      await homeBridge.setSubsidizedModeForForeignToHome().should.be.fulfilled;

      const subsidizedMode = await homeBridge.foreignToHomeMode()
      subsidizedMode.should.be.equal(subsidizedHash)
    })
  })
  describe('initialize', () => {
    it('sets variables', async () => {
      const homeBridge = await HomeAMB.new()
      '0'.should.be.bignumber.equal(await homeBridge.deployedAtBlock())
      '0'.should.be.bignumber.equal(await homeBridge.maxPerTx())
      false.should.be.equal(await homeBridge.isInitialized())

      await homeBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner).should.be.fulfilled;

      (await homeBridge.deployedAtBlock()).should.be.bignumber.above(0);
      (await homeBridge.validatorContract()).should.be.equal(validatorContract.address);
      (await homeBridge.maxGasPerTx()).should.be.bignumber.equal(oneEther);
      (await homeBridge.gasPrice()).should.be.bignumber.equal(gasPrice);
      (await homeBridge.requiredBlockConfirmations()).should.be.bignumber.equal(requiredBlockConfirmations);
    })
    it('should fail with invalid arguments', async () => {
      const homeBridge = await HomeAMB.new()
      false.should.be.equal(await homeBridge.isInitialized())
      await homeBridge.initialize(ZERO_ADDRESS, oneEther, gasPrice, requiredBlockConfirmations, owner).should.be.rejectedWith(ERROR_MSG);
      await homeBridge.initialize(accounts[0], oneEther, gasPrice, requiredBlockConfirmations, owner).should.be.rejectedWith(ERROR_MSG);
      await homeBridge.initialize(validatorContract.address, 0, gasPrice, requiredBlockConfirmations, owner).should.be.rejectedWith(ERROR_MSG);
      await homeBridge.initialize(validatorContract.address, oneEther, 0, requiredBlockConfirmations, owner).should.be.rejectedWith(ERROR_MSG);
      await homeBridge.initialize(validatorContract.address, oneEther, gasPrice, 0, owner).should.be.rejectedWith(ERROR_MSG);
      await homeBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner).should.be.fulfilled;
      true.should.be.equal(await homeBridge.isInitialized())
    })
    it('can update variables', async () => {
      const twoEther = web3.toBigNumber(web3.toWei(2, "ether"));
      const alternativeGasPrice = Web3Utils.toWei('2', 'gwei');
      const alternativeBlockConfirmations = 1
      const homeBridge = await HomeAMB.new()
      await homeBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner).should.be.fulfilled;

      (await homeBridge.maxGasPerTx()).should.be.bignumber.equal(oneEther);
      (await homeBridge.gasPrice()).should.be.bignumber.equal(gasPrice);
      (await homeBridge.requiredBlockConfirmations()).should.be.bignumber.equal(requiredBlockConfirmations);

      await homeBridge.setMaxGasPerTx(0).should.be.rejectedWith(ERROR_MSG);
      await homeBridge.setGasPrice(0).should.be.rejectedWith(ERROR_MSG);
      await homeBridge.setRequiredBlockConfirmations(0).should.be.rejectedWith(ERROR_MSG);

      await homeBridge.setMaxGasPerTx(twoEther).should.be.fulfilled;
      await homeBridge.setGasPrice(alternativeGasPrice).should.be.fulfilled;
      await homeBridge.setRequiredBlockConfirmations(alternativeBlockConfirmations).should.be.fulfilled;

      (await homeBridge.maxGasPerTx()).should.be.bignumber.equal(twoEther);
      (await homeBridge.gasPrice()).should.be.bignumber.equal(alternativeGasPrice);
      (await homeBridge.requiredBlockConfirmations()).should.be.bignumber.equal(alternativeBlockConfirmations);
    })
  })
  describe('upgradeable', async () => {
    it('can be upgraded', async () => {

      // homeBridge V1 Contract
      const homeBridgeV1 = await HomeAMB.new()

      // create proxy
      const proxy = await EternalStorageProxy.new();
      await proxy.upgradeTo('1', homeBridgeV1.address).should.be.fulfilled;

      const homeBridgeProxy = await HomeAMB.at(proxy.address);
      await homeBridgeProxy.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner).should.be.fulfilled;

      // Deploy V2
      const homeBridgeV2 = await HomeAMB.new()
      await proxy.upgradeTo('2', homeBridgeV2.address).should.be.fulfilled;

      homeBridgeV2.address.should.be.equal(await proxy.implementation())
    })

    it('can be deployed via upgradeToAndCall', async () => {

      const homeBridgeV1 = await HomeAMB.new()

      const proxy = await EternalStorageProxy.new();

      const data = homeBridgeV1.initialize.request(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner).params[0].data;
      await proxy.upgradeToAndCall('1', homeBridgeV1.address, data).should.be.fulfilled;

      const homeBridgeProxy = await HomeAMB.at(proxy.address);
      true.should.be.equal(await homeBridgeProxy.isInitialized());
    })
    it('can transfer ownership', async () => {

      // homeBridge V1 Contract
      const homeBridgeV1 = await HomeAMB.new()

      // create proxy
      const proxy = await EternalStorageProxy.new();
      await proxy.upgradeTo('1', homeBridgeV1.address).should.be.fulfilled;

      const homeBridgeProxy = await HomeAMB.at(proxy.address);
      await homeBridgeProxy.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner).should.be.fulfilled;
      (await proxy.proxyOwner()).should.be.equal(owner)

      const newOwner = accounts[1]
      await proxy.transferProxyOwnership(newOwner).should.be.fulfilled;
      (await proxy.proxyOwner()).should.be.equal(newOwner)
    })
  })
  describe('requireToPassMessage', () => {
    let homeBridge
    beforeEach(async () => {
      // create proxy
      const homeBridgeV1 = await HomeAMB.new()
      const proxy = await EternalStorageProxy.new();
      await proxy.upgradeTo('1', homeBridgeV1.address).should.be.fulfilled;

      homeBridge = await HomeAMB.at(proxy.address);
      await homeBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner)
    })
    it('call requireToPassMessage(address, bytes, uint256)', async () => {
      await homeBridge.setSubsidizedModeForHomeToForeign().should.be.fulfilled;

      const tx = await homeBridge.contract.requireToPassMessage['address,bytes,uint256'](
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        1535604485,
        { from: accounts[3] })
      const { logs } = await web3.eth.getTransactionReceipt(tx)
      logs.length.should.be.equal(1)
    })
    it('call requireToPassMessage(address, bytes, uint256) should fail', async () => {
      try {
        // Should fail because subsidized mode not set by default
        await homeBridge.contract.requireToPassMessage['address,bytes,uint256'](
          "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
          "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
          1535604485,
          { from: accounts[3] })
        throw new Error("Method should have failed.")
      } catch (e) {
        e.message.should.be.equal(ERROR_MSG)
      }

      await homeBridge.setSubsidizedModeForHomeToForeign().should.be.fulfilled;

      try {
        // Should fail because gas < minimumGasUsage
        await homeBridge.contract.requireToPassMessage['address,bytes,uint256'](
          "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
          "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
          10,
          { from: accounts[3] })
        throw new Error("Method should have failed.")
      } catch (e) {
        e.message.should.be.equal(ERROR_MSG)
      }

      try {
        const twoEther = web3.toBigNumber(web3.toWei(2, "ether"));

        // Should fail because gas > maxGasPerTx
        await homeBridge.contract.requireToPassMessage['address,bytes,uint256'](
          "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
          "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
          twoEther,
          { from: accounts[3] })
        throw new Error("Method should have failed.")
      } catch (e) {
        e.message.should.be.equal(ERROR_MSG)
      }
    })
    it('call requireToPassMessage(address, bytes, uint256, uint256)', async () => {
      const tx = await homeBridge.contract.requireToPassMessage['address,bytes,uint256,uint256'](
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        1535604485,
        1000000000
        , { from: accounts[3] })
      const { logs } = await web3.eth.getTransactionReceipt(tx)
      logs.length.should.be.equal(1)
    })
    it('call requireToPassMessage(address, bytes, uint256, uint256) on subsidized mode', async () => {
      await homeBridge.setSubsidizedModeForHomeToForeign().should.be.fulfilled;
      const tx = await homeBridge.contract.requireToPassMessage['address,bytes,uint256,uint256'](
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        1535604485,
        1000000000
        , { from: accounts[3] })
      const { logs } = await web3.eth.getTransactionReceipt(tx)
      logs.length.should.be.equal(1)
    })
    it('call requireToPassMessage(address, bytes, uint256, uint256) should fail', async () => {
      try {
        // Should fail because gas < minimumGasUsage
        await homeBridge.contract.requireToPassMessage['address,bytes,uint256,uint256'](
          "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
          "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
          10,
          1000000000,
          { from: accounts[3] })
        throw new Error("Method should have failed.")
      } catch (e) {
        e.message.should.be.equal(ERROR_MSG)
      }

      try {
        const twoEther = web3.toBigNumber(web3.toWei(2, "ether"));

        // Should fail because gas > maxGasPerTx
        await homeBridge.contract.requireToPassMessage['address,bytes,uint256,uint256'](
          "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
          "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
          twoEther,
          1000000000,
          { from: accounts[3] })
        throw new Error("Method should have failed.")
      } catch (e) {
        e.message.should.be.equal(ERROR_MSG)
      }
    })
    it('call requireToPassMessage(address, bytes, uint256, bytes1)', async () => {
      const { logs } = await homeBridge.requireToPassMessage(
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        1535604485,
        1)
      logs.length.should.be.equal(1)
      logs[0].event.should.be.equal('UserRequestForSignature')
    })
    it('call requireToPassMessage(address, bytes, uint256, bytes1) on subsidized mode', async () => {
      await homeBridge.setSubsidizedModeForHomeToForeign().should.be.fulfilled;
      const { logs } = await homeBridge.requireToPassMessage(
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        1535604485,
        1)
      logs.length.should.be.equal(1)
      logs[0].event.should.be.equal('UserRequestForSignature')
    })
    it('call requireToPassMessage(address, bytes, uint256, bytes1) should fail', async () => {
      const twoEther = web3.toBigNumber(web3.toWei(2, "ether"));

      // Should fail because gas < minimumGasUsage
      await homeBridge.requireToPassMessage(
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        10,
        1).should.be.rejectedWith(ERROR_MSG)

      // Should fail because gas > maxGasPerTx
      await homeBridge.requireToPassMessage(
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        twoEther,
        1).should.be.rejectedWith(ERROR_MSG)
    })
  })
  describe('executeAffirmation', () => {
    let homeBridge, setValueData, box
    beforeEach(async () => {
      // create proxy
      const homeBridgeV1 = await HomeAMB.new()
      const proxy = await EternalStorageProxy.new();
      await proxy.upgradeTo('1', homeBridgeV1.address).should.be.fulfilled;

      homeBridge = await HomeAMB.at(proxy.address);
      await homeBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner)

      box = await Box.new()
      // Generate data for method we want to call on Box contract
      const result = await box.getSetValueData(3)
      setValueData = result.logs[0].args.selectorData
    })
    it('should succeed on Subsidized mode', async () => {
      // set Home bridge on subsidized mode
      await homeBridge.setSubsidizedModeForForeignToHome().should.be.fulfilled;

      const user = accounts[8]

      const boxInitialValue = await box.value()
      boxInitialValue.should.be.bignumber.equal(0)

      // Use these calls to simulate foreign bridge on Foreign network
      await homeBridge.setSubsidizedModeForHomeToForeign().should.be.fulfilled;
      const resultPassMessageTx = await homeBridge.requireToPassMessage(
        box.address,
        setValueData,
        221254,
        1, {from: user})

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.tx) + encodedData.slice(82)

      const {logs} = await homeBridge.executeAffirmation(message, { from: authorities[0] }).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[1].event.should.be.equal("AffirmationCompleted");
      logs[1].args.should.be.deep.equal({
        sender: user,
        executor: box.address,
        txHash: resultPassMessageTx.tx
      })

      //check Box value
      const boxValue = await box.value()
      boxValue.should.be.bignumber.equal(3)
    })
    it('should succeed on defrayal mode', async () => {
      const user = accounts[8]

      const boxInitialValue = await box.value()
      boxInitialValue.should.be.bignumber.equal(0)

      // Deposit for user
      await homeBridge.depositForContractSender(user, {
        from: user,
        value: oneEther
      })

      // Use these calls to simulate foreign bridge on Foreign network
      const resultPassMessageTx = await homeBridge.requireToPassMessage(
        box.address,
        setValueData,
        821254,
        1, {from: user})

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.tx) + encodedData.slice(82)

      const {logs} = await homeBridge.executeAffirmation(message, { from: authorities[0] }).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[1].event.should.be.equal("AffirmationCompleted");
      logs[1].args.should.be.deep.equal({
        sender: user,
        executor: box.address,
        txHash: resultPassMessageTx.tx
      })

      //check Box value
      const boxValue = await box.value()
      boxValue.should.be.bignumber.equal(3)
    })
    it('should succeed on defrayal mode using message with gas price parameter', async () => {
      const user = accounts[8]

      const boxInitialValue = await box.value()
      boxInitialValue.should.be.bignumber.equal(0)

      // Deposit for user
      await homeBridge.depositForContractSender(user, {
        from: user,
        value: oneEther
      })

      // Use these calls to simulate foreign bridge on Foreign network
      const tx = await homeBridge.contract.requireToPassMessage['address,bytes,uint256,uint256'](
        box.address,
        setValueData,
        821254,
        4000000000, { from: user })
      const resultPassMessageTx = await web3.eth.getTransactionReceipt(tx)
      const { data } = resultPassMessageTx.logs[0]
      const encodedData = data.slice(0,2) + data.slice(130, data.length - 38)

      // Validator on token-bridge add txHash to message
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.transactionHash) + encodedData.slice(82)

      // should fail because a different gas price was used
      await homeBridge.executeAffirmation(message, { from: authorities[0], gasPrice: "3000000000" }).should.be.rejectedWith(ERROR_MSG);

      const {logs} = await homeBridge.executeAffirmation(message, { from: authorities[0], gasPrice: "4000000000" }).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[1].event.should.be.equal("AffirmationCompleted");
      logs[1].args.should.be.deep.equal({
        sender: user,
        executor: box.address,
        txHash: resultPassMessageTx.transactionHash
      })

      //check Box value
      const boxValue = await box.value()
      boxValue.should.be.bignumber.equal(3)
    })
    it('test with 3 signatures required', async () => {
      // set validator
      const validatorContractWith3Signatures = await BridgeValidators.new()
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const ownerOfValidators = accounts[0]
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)

      // set bridge
      const homeBridgeWithThreeSigs = await HomeAMB.new()
      await homeBridgeWithThreeSigs.initialize(validatorContractWith3Signatures.address, oneEther, gasPrice, requiredBlockConfirmations, owner)

      const user = accounts[8]

      const boxInitialValue = await box.value()
      boxInitialValue.should.be.bignumber.equal(0)

      // Deposit for user
      await homeBridgeWithThreeSigs.depositForContractSender(user, {
        from: user,
        value: oneEther
      })

      // Use these calls to simulate foreign bridge on Foreign network
      const resultPassMessageTx = await homeBridgeWithThreeSigs.requireToPassMessage(
        box.address,
        setValueData,
        821254,
        1, {from: user})

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.tx) + encodedData.slice(82)
      const msgHash = Web3Utils.soliditySha3(message);

      const {logs} = await homeBridgeWithThreeSigs.executeAffirmation(message, {from: authoritiesFiveAccs[0]}).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[0].args.should.be.deep.equal({
        signer: authoritiesFiveAccs[0],
        messageHash: msgHash
      });

      const notProcessed = await homeBridgeWithThreeSigs.numAffirmationsSigned(msgHash);
      notProcessed.should.be.bignumber.equal(1);

      await homeBridgeWithThreeSigs.executeAffirmation(message, {from: authoritiesFiveAccs[0]}).should.be.rejectedWith(ERROR_MSG);
      const secondSignature = await homeBridgeWithThreeSigs.executeAffirmation(message, {from: authoritiesFiveAccs[1]}).should.be.fulfilled;

      secondSignature.logs[0].event.should.be.equal("SignedForAffirmation");
      secondSignature.logs[0].args.should.be.deep.equal({
        signer: authoritiesFiveAccs[1],
        messageHash: msgHash
      })

      const thirdSignature = await homeBridgeWithThreeSigs.executeAffirmation(message, {from: authoritiesFiveAccs[2]}).should.be.fulfilled;

      thirdSignature.logs[1].event.should.be.equal("AffirmationCompleted");
      thirdSignature.logs[1].args.should.be.deep.equal({
        sender: user,
        executor: box.address,
        txHash: resultPassMessageTx.tx
      })

      const senderHash = Web3Utils.soliditySha3(authoritiesFiveAccs[0], msgHash)
      true.should.be.equal(await homeBridgeWithThreeSigs.affirmationsSigned(senderHash))

      const senderHash2 = Web3Utils.soliditySha3(authoritiesFiveAccs[1], msgHash);
      true.should.be.equal(await homeBridgeWithThreeSigs.affirmationsSigned(senderHash2))

      const senderHash3 = Web3Utils.soliditySha3(authoritiesFiveAccs[2], msgHash);
      true.should.be.equal(await homeBridgeWithThreeSigs.affirmationsSigned(senderHash3))

      //check Box value
      const boxValue = await box.value()
      boxValue.should.be.bignumber.equal(3)
    })
    it('should not allow to double execute', async () => {
      const user = accounts[8]

      // Deposit for user
      await homeBridge.depositForContractSender(user, {
        from: user,
        value: oneEther
      })

      // Use these calls to simulate foreign bridge on Foreign network
      const resultPassMessageTx = await homeBridge.requireToPassMessage(
        box.address,
        setValueData,
        821254,
        1, {from: user})

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.tx) + encodedData.slice(82)

      const {logs} = await homeBridge.executeAffirmation(message, { from: authorities[0] }).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[1].event.should.be.equal("AffirmationCompleted");
      logs[1].args.should.be.deep.equal({
        sender: user,
        executor: box.address,
        txHash: resultPassMessageTx.tx
      })

      await homeBridge.executeAffirmation(message, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG);
      await homeBridge.executeAffirmation(message, {from: authorities[1]}).should.be.rejectedWith(ERROR_MSG);
    })

    it('should not allow non-authorities to execute affirmation', async () => {
      const user = accounts[8]

      // Deposit for user
      await homeBridge.depositForContractSender(user, {
        from: user,
        value: oneEther
      })

      // Use these calls to simulate foreign bridge on Foreign network
      const resultPassMessageTx = await homeBridge.requireToPassMessage(
        box.address,
        setValueData,
        821254,
        1, {from: user})

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.tx) + encodedData.slice(82)

      await homeBridge.executeAffirmation(message, {from: user}).should.be.rejectedWith(ERROR_MSG);
      await homeBridge.executeAffirmation(message, {from: accounts[7]}).should.be.rejectedWith(ERROR_MSG);

      const {logs} = await homeBridge.executeAffirmation(message, { from: authorities[0] }).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[1].event.should.be.equal("AffirmationCompleted");
    })
  })
  describe('submitSignature', () => {
    let homeBridge, setValueData, box
    beforeEach(async () => {
      // create proxy
      const homeBridgeV1 = await HomeAMB.new()
      const proxy = await EternalStorageProxy.new();
      await proxy.upgradeTo('1', homeBridgeV1.address).should.be.fulfilled;

      homeBridge = await HomeAMB.at(proxy.address);
      await homeBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner)

      box = await Box.new()
      // Generate data for method we want to call on Box contract
      const result = await box.getSetValueData(3)
      setValueData = result.logs[0].args.selectorData
    })
    it('allows a validator to submit a signature', async () => {
      const user = accounts[8]

      const resultPassMessageTx = await homeBridge.requireToPassMessage(
        box.address,
        setValueData,
        821254,
        1, {from: user})

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.tx) + encodedData.slice(82)
      const signature = await sign(authorities[0], message)
      const msgHash = Web3Utils.soliditySha3(message);

      const {logs} = await homeBridge.submitSignature(signature, message, { from: authorities[0] }).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForUserRequest");
      logs[0].args.should.be.deep.equal({
        signer: authorities[0],
        messageHash: msgHash
      })

      const signatureFromContract = await homeBridge.signature(msgHash, 0);
      const messageFromContract = await homeBridge.message(msgHash);
      signature.should.be.equal(signatureFromContract);
      messageFromContract.should.be.equal(message);

      logs[1].event.should.be.equal("CollectedSignatures");
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authorities[0])
      logs[1].args.messageHash.should.be.equal(msgHash)
      logs[1].args.NumberOfCollectedSignatures.should.be.bignumber.equal(validatorsRequiredSignatures)

      const hashMsg = Web3Utils.soliditySha3(message);
      const hashSenderMsg = Web3Utils.soliditySha3(authorities[0], hashMsg)
      true.should.be.equal(await homeBridge.messagesSigned(hashSenderMsg));
    })
    it('test with 3 signatures required', async () => {
      // set validator
      const validatorContractWith3Signatures = await BridgeValidators.new()
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const ownerOfValidators = accounts[0]
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)

      // set bridge
      const homeBridgeWithThreeSigs = await HomeAMB.new()
      await homeBridgeWithThreeSigs.initialize(validatorContractWith3Signatures.address, oneEther, gasPrice, requiredBlockConfirmations, owner)

      const user = accounts[8]

      const resultPassMessageTx = await homeBridgeWithThreeSigs.requireToPassMessage(
        box.address,
        setValueData,
        821254,
        1, {from: user})

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.tx) + encodedData.slice(82)
      const signature1 = await sign(authoritiesFiveAccs[0], message)
      const signature2 = await sign(authoritiesFiveAccs[1], message)
      const signature3 = await sign(authoritiesFiveAccs[2], message)
      const msgHash = Web3Utils.soliditySha3(message);

      const {logs} = await homeBridgeWithThreeSigs.submitSignature(signature1, message, { from: authoritiesFiveAccs[0] }).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForUserRequest");
      logs[0].args.should.be.deep.equal({
        signer: authoritiesFiveAccs[0],
        messageHash: msgHash
      })

      const secondSignature = await homeBridgeWithThreeSigs.submitSignature(signature2, message, { from: authoritiesFiveAccs[1] }).should.be.fulfilled;
      secondSignature.logs[0].event.should.be.equal("SignedForUserRequest");
      secondSignature.logs[0].args.should.be.deep.equal({
        signer: authoritiesFiveAccs[1],
        messageHash: msgHash
      })

      const thirdSignature = await homeBridgeWithThreeSigs.submitSignature(signature3, message, { from: authoritiesFiveAccs[2] }).should.be.fulfilled;
      thirdSignature.logs[0].event.should.be.equal("SignedForUserRequest");
      thirdSignature.logs[0].args.should.be.deep.equal({
        signer: authoritiesFiveAccs[2],
        messageHash: msgHash
      })

      const messageFromContract = await homeBridgeWithThreeSigs.message(msgHash);
      messageFromContract.should.be.equal(message);

      const signature1FromContract = await homeBridgeWithThreeSigs.signature(msgHash, 0);
      signature1.should.be.equal(signature1FromContract);

      const signature2FromContract = await homeBridgeWithThreeSigs.signature(msgHash, 1);
      signature2.should.be.equal(signature2FromContract);

      const signature3FromContract = await homeBridgeWithThreeSigs.signature(msgHash, 2);
      signature3.should.be.equal(signature3FromContract);

      thirdSignature.logs[1].event.should.be.equal("CollectedSignatures");
      thirdSignature.logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesFiveAccs[2])
      thirdSignature.logs[1].args.messageHash.should.be.equal(msgHash)
      thirdSignature.logs[1].args.NumberOfCollectedSignatures.should.be.bignumber.equal(3)
    })
    it('should not allow to double submit', async () => {
      const user = accounts[8]

      const resultPassMessageTx = await homeBridge.requireToPassMessage(
        box.address,
        setValueData,
        821254,
        1, {from: user})

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.tx) + encodedData.slice(82)
      const signature = await sign(authorities[0], message)
      const signature2 = await sign(authorities[1], message)

      // can't submit signature with other validator signature
      await homeBridge.submitSignature(signature2, message, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG);

      const {logs} = await homeBridge.submitSignature(signature, message, { from: authorities[0] }).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForUserRequest");
      logs[1].event.should.be.equal("CollectedSignatures");

      await homeBridge.submitSignature(signature, message, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG);
      await homeBridge.submitSignature(signature2, message, {from: authorities[1]}).should.be.rejectedWith(ERROR_MSG);
    })

    it('should not allow non-authorities to submit signatures', async () => {
      const user = accounts[8]

      const resultPassMessageTx = await homeBridge.requireToPassMessage(
        box.address,
        setValueData,
        821254,
        1, {from: user})

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.tx) + encodedData.slice(82)

      const signature = await sign(authorities[0], message)
      const userSignature = await sign(user, message)
      const user2Signature = await sign(accounts[7], message)

      await homeBridge.submitSignature(userSignature, message, {from: user}).should.be.rejectedWith(ERROR_MSG);
      await homeBridge.submitSignature(user2Signature, message, {from: accounts[7]}).should.be.rejectedWith(ERROR_MSG);

      const {logs} = await homeBridge.submitSignature(signature, message, { from: authorities[0] }).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForUserRequest");
      logs[1].event.should.be.equal("CollectedSignatures");
    })
  })
})
