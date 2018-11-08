const Web3Utils = require('web3-utils');
const ForeignBridge = artifacts.require("ForeignAMB.sol");
const BridgeValidators = artifacts.require("BridgeValidators.sol");
const Box = artifacts.require("Box.sol");
const requiredBlockConfirmations = 8;
const gasPrice = Web3Utils.toWei('1', 'gwei');
const oneEther = web3.toBigNumber(web3.toWei(1, "ether"));
const { sign, signatureToVRS, strip0x } = require('../helpers/helpers');

const {ERROR_MSG, ZERO_ADDRESS} = require('../setup');

contract('ForeignAMB', async (accounts) => {
  let validatorContract, boxContract, authorities, owner;

  before(async () => {
    validatorContract = await BridgeValidators.new()
    boxContract = await Box.new()
    authorities = [accounts[1], accounts[2]];
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
  })

  describe('balance', () => {
    it('should start with zero balance', async () => {
      const foreignBridge = await ForeignBridge.new()
      const balance = await foreignBridge.balanceOf(boxContract.address)
      '0'.should.be.bignumber.equal(balance)
    })

    it('should receive balance for a contract', async () => {
      const foreignBridge = await ForeignBridge.new()
      await foreignBridge.depositForContractSender(boxContract.address, {
        from: accounts[1],
        value: 1
      })
      const deposit = await foreignBridge.balanceOf(boxContract.address)
      const balance = await web3.eth.getBalance(foreignBridge.address)
      '1'.should.be.bignumber.equal(deposit)
      '1'.should.be.bignumber.equal(balance)
    })

    it('should revert for address 0', async () => {
      const foreignBridge = await ForeignBridge.new()
      await foreignBridge.depositForContractSender(ZERO_ADDRESS, {
        from: accounts[1],
        value: 1
      }).should.be.rejectedWith(ERROR_MSG)
    })

    it('user should be able to withdraw balance', async () => {
      const user = accounts[8]

      const foreignBridge = await ForeignBridge.new()
      await foreignBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations)

      await foreignBridge.depositForContractSender(user, {
        from: user,
        value: oneEther
      })

      const userBalanceOnBridgeAfterDeposit = await foreignBridge.balanceOf(user)
      const userBalanceAfterDeposit = await web3.eth.getBalance(user)
      userBalanceOnBridgeAfterDeposit.should.be.bignumber.equal(oneEther)

      const result = await boxContract.getWithdrawFromDepositData(user)
      const withdrawFromDepositData = result.logs[0].args.selectorData

      // Use these calls to simulate home bridge on Foreign network
      const resultPassMessageTx = await foreignBridge.requireToPassMessage(
        foreignBridge.address,
        withdrawFromDepositData,
        821254,
        1, { from: user })

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.tx) + encodedData.slice(82)

      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature);

      const { logs } = await foreignBridge.executeSignatures(message, [vrs.v], [vrs.r], [vrs.s], { from: authorities[0] }).should.be.fulfilled;
      logs[0].event.should.be.equal("RelayedMessage");

      const userBalanceOnBridgeAfterWithdraw = await foreignBridge.balanceOf(user)
      const userBalanceAfterWithdraw = await web3.eth.getBalance(user)
      userBalanceOnBridgeAfterWithdraw.should.be.bignumber.equal(0)
      userBalanceAfterWithdraw.should.be.bignumber.gt(userBalanceAfterDeposit)
    })
  })

  describe('getBridgeMode', () => {
    it('should return arbitrary message bridging mode', async () => {
      const foreignContract = await ForeignBridge.new()
      const bridgeModeHash = '0x2544fbb9' // 4 bytes of keccak256('arbitrary-message-bridge-core')
      const bridgeMode = await foreignContract.getBridgeMode()
      bridgeMode.should.be.equal(bridgeModeHash)
    })
  })
  describe('initialize', () => {
    it('sets variables', async () => {
      const foreignBridge = await ForeignBridge.new()
      '0'.should.be.bignumber.equal(await foreignBridge.deployedAtBlock())
      '0'.should.be.bignumber.equal(await foreignBridge.maxPerTx())
      false.should.be.equal(await foreignBridge.isInitialized())

      await foreignBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations).should.be.fulfilled;

      (await foreignBridge.deployedAtBlock()).should.be.bignumber.above(0);
      (await foreignBridge.validatorContract()).should.be.equal(validatorContract.address);
      (await foreignBridge.maxPerTx()).should.be.bignumber.equal(oneEther);
      (await foreignBridge.gasPrice()).should.be.bignumber.equal(gasPrice);
      (await foreignBridge.requiredBlockConfirmations()).should.be.bignumber.equal(requiredBlockConfirmations);
    })
    it('should fail with invalid arguments', async () => {
      const foreignBridge = await ForeignBridge.new()
      false.should.be.equal(await foreignBridge.isInitialized())
      await foreignBridge.initialize(ZERO_ADDRESS, oneEther, gasPrice, requiredBlockConfirmations).should.be.rejectedWith(ERROR_MSG);
      await foreignBridge.initialize(accounts[0], oneEther, gasPrice, requiredBlockConfirmations).should.be.rejectedWith(ERROR_MSG);
      await foreignBridge.initialize(validatorContract.address, 0, gasPrice, requiredBlockConfirmations).should.be.rejectedWith(ERROR_MSG);
      await foreignBridge.initialize(validatorContract.address, oneEther, 0, requiredBlockConfirmations).should.be.rejectedWith(ERROR_MSG);
      await foreignBridge.initialize(validatorContract.address, oneEther, gasPrice, 0).should.be.rejectedWith(ERROR_MSG);
      await foreignBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations).should.be.fulfilled;
      true.should.be.equal(await foreignBridge.isInitialized())
    })
  })
  describe('requireToPassMessage', () => {
    let foreignBridge
    beforeEach(async () => {
      foreignBridge = await ForeignBridge.new()
      await foreignBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations)
    })
    it('call requireToPassMessage(address, bytes, uint256, bytes1)', async () => {
      const { logs } = await foreignBridge.requireToPassMessage(
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        1535604485,
        1)
      logs.length.should.be.equal(1)
      logs[0].event.should.be.equal('UserRequestForAffirmation')
    })
    it('call requireToPassMessage(address, bytes, uint256)', async () => {
      await foreignBridge.setSubsidizedModeForForeignToHome().should.be.fulfilled;
      const tx = await foreignBridge.contract.requireToPassMessage['address,bytes,uint256'](
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        1535604485,
        { from: accounts[3] })
      const { logs } = await web3.eth.getTransactionReceipt(tx)
      logs.length.should.be.equal(1)
    })
    it('call requireToPassMessage(address, bytes, uint256, uint256)', async () => {
      const tx = await foreignBridge.contract.requireToPassMessage['address,bytes,uint256,uint256'](
        "0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955",
        "0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03",
        1535604485,
        1000000000
        , { from: accounts[3] })
      const { logs } = await web3.eth.getTransactionReceipt(tx)
      logs.length.should.be.equal(1)
    })
  })
  describe('executeSignatures', () => {
    let foreignBridge, setValueData, box
    beforeEach(async () => {
      foreignBridge = await ForeignBridge.new()
      await foreignBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations)

      box = await Box.new()
      // Generate data for method we want to call on Box contract
      const result = await box.getSetValueData(3)
      setValueData = result.logs[0].args.selectorData
    })
    it('should succeed on Subsidized mode', async () => {
      // set foreign bridge on subsidized mode
      await foreignBridge.setSubsidizedModeForHomeToForeign().should.be.fulfilled;

      const user = accounts[8]

      const boxInitialValue = await box.value()
      boxInitialValue.should.be.bignumber.equal(0)

      // Use these calls to simulate home bridge on Home network
      await foreignBridge.setSubsidizedModeForForeignToHome().should.be.fulfilled;
      const resultPassMessageTx = await foreignBridge.requireToPassMessage(
        box.address,
        setValueData,
        1221254,
        1, { from: user })

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.tx) + encodedData.slice(82)

      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature);

      const { logs } = await foreignBridge.executeSignatures(message, [vrs.v], [vrs.r], [vrs.s], {from: authorities[0]}).should.be.fulfilled;
      logs[0].event.should.be.equal("RelayedMessage");
      logs[0].args.should.be.deep.equal({
        sender: user,
        executor: box.address,
        transactionHash: resultPassMessageTx.tx
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
      await foreignBridge.depositForContractSender(user, {
        from: user,
        value: oneEther
      })

      // Use these calls to simulate home bridge on home network
      const resultPassMessageTx = await foreignBridge.requireToPassMessage(
        box.address,
        setValueData,
        821254,
        1, {from: user})

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.tx) + encodedData.slice(82)

      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature);

      const {logs} = await foreignBridge.executeSignatures(message, [vrs.v], [vrs.r], [vrs.s], {from: authorities[0]}).should.be.fulfilled;
      logs[0].event.should.be.equal("RelayedMessage");
      logs[0].args.should.be.deep.equal({
        sender: user,
        executor: box.address,
        transactionHash: resultPassMessageTx.tx
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
      await foreignBridge.depositForContractSender(user, {
        from: user,
        value: oneEther
      })

      // Use these calls to simulate foreign bridge on Foreign network
      const tx = await foreignBridge.contract.requireToPassMessage['address,bytes,uint256,uint256'](
        box.address,
        setValueData,
        821254,
        4000000000, { from: user })
      const resultPassMessageTx = await web3.eth.getTransactionReceipt(tx)
      const { data } = resultPassMessageTx.logs[0]
      const encodedData = data.slice(0,2) + data.slice(130, data.length - 38)

      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.transactionHash) + encodedData.slice(82)

      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature);

      // should fail because a different gas price was used
      await foreignBridge.executeSignatures(message, [vrs.v], [vrs.r], [vrs.s], {from: authorities[0], gasPrice: "3000000000"}).should.be.rejectedWith(ERROR_MSG);

      const {logs} = await foreignBridge.executeSignatures(message, [vrs.v], [vrs.r], [vrs.s], {from: authorities[0], gasPrice: "4000000000"}).should.be.fulfilled;
      logs[0].event.should.be.equal("RelayedMessage");
      logs[0].args.should.be.deep.equal({
        sender: user,
        executor: box.address,
        transactionHash: resultPassMessageTx.transactionHash
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
      const foreignBridgeWithThreeSigs = await ForeignBridge.new()
      await foreignBridgeWithThreeSigs.initialize(validatorContractWith3Signatures.address, oneEther, gasPrice, requiredBlockConfirmations)

      const user = accounts[8]

      const boxInitialValue = await box.value()
      boxInitialValue.should.be.bignumber.equal(0)

      // Deposit for user
      await foreignBridgeWithThreeSigs.depositForContractSender(user, {
        from: user,
        value: oneEther
      })

      // Use these calls to simulate home bridge on home network
      const resultPassMessageTx = await foreignBridgeWithThreeSigs.requireToPassMessage(
        box.address,
        setValueData,
        821254,
        1, {from: user})

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.tx) + encodedData.slice(82)

      const signature1 = await sign(authoritiesFiveAccs[0], message)
      const vrs = signatureToVRS(signature1);

      const signature2 = await sign(authoritiesFiveAccs[1], message)
      const vrs2 = signatureToVRS(signature2);

      const signature3 = await sign(authoritiesFiveAccs[2], message)
      const vrs3 = signatureToVRS(signature3);

      await foreignBridgeWithThreeSigs.executeSignatures(message, [vrs.v], [vrs.r], [vrs.s], {from: authoritiesFiveAccs[2]}).should.be.rejectedWith(ERROR_MSG);
      await foreignBridgeWithThreeSigs.executeSignatures(message, [vrs.v, vrs2.v], [vrs.r, vrs2.r], [vrs.s, vrs2.s], {from: authoritiesFiveAccs[2]}).should.be.rejectedWith(ERROR_MSG);

      const {logs} = await foreignBridgeWithThreeSigs.executeSignatures(message, [vrs.v, vrs2.v, vrs3.v], [vrs.r, vrs2.r, vrs3.r], [vrs.s, vrs2.s, vrs3.s], {from: authoritiesFiveAccs[2]}).should.be.fulfilled;
      logs[0].event.should.be.equal("RelayedMessage");
      logs[0].args.should.be.deep.equal({
        sender: user,
        executor: box.address,
        transactionHash: resultPassMessageTx.tx
      })

      //check Box value
      const boxValue = await box.value()
      boxValue.should.be.bignumber.equal(3)
    })
    it('should not allow to double execute signatures', async () => {
      const user = accounts[8]

      // Deposit for user
      await foreignBridge.depositForContractSender(user, {
        from: user,
        value: oneEther
      })

      // Use these calls to simulate home bridge on home network
      const resultPassMessageTx = await foreignBridge.requireToPassMessage(
        box.address,
        setValueData,
        821254,
        1, {from: user})

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.tx) + encodedData.slice(82)

      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature);

      const {logs} = await foreignBridge.executeSignatures(message, [vrs.v], [vrs.r], [vrs.s], {from: authorities[0]}).should.be.fulfilled;
      logs[0].event.should.be.equal("RelayedMessage");
      logs[0].args.should.be.deep.equal({
        sender: user,
        executor: box.address,
        transactionHash: resultPassMessageTx.tx
      })

      await foreignBridge.executeSignatures(message, [vrs.v], [vrs.r], [vrs.s], {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG);
      await foreignBridge.executeSignatures(message, [vrs.v], [vrs.r], [vrs.s], {from: authorities[1]}).should.be.rejectedWith(ERROR_MSG);
    })
    it('should not allow non-authorities to execute signatures', async () => {
      const user = accounts[8]

      // Deposit for user
      await foreignBridge.depositForContractSender(user, {
        from: user,
        value: oneEther
      })

      // Use these calls to simulate home bridge on home network
      const resultPassMessageTx = await foreignBridge.requireToPassMessage(
        box.address,
        setValueData,
        821254,
        1, {from: user})

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = encodedData.slice(0, 82) + strip0x(resultPassMessageTx.tx) + encodedData.slice(82)

      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature);

      await foreignBridge.executeSignatures(message, [vrs.v], [vrs.r], [vrs.s], {from: user}).should.be.rejectedWith(ERROR_MSG);
      await foreignBridge.executeSignatures(message, [vrs.v], [vrs.r], [vrs.s], {from: accounts[7]}).should.be.rejectedWith(ERROR_MSG);

      const {logs} = await foreignBridge.executeSignatures(message, [vrs.v], [vrs.r], [vrs.s], {from: authorities[0]}).should.be.fulfilled;
      logs[0].event.should.be.equal("RelayedMessage");
      logs[0].args.should.be.deep.equal({
        sender: user,
        executor: box.address,
        transactionHash: resultPassMessageTx.tx
      })

    })
  })
})
