const HomeAMB = artifacts.require('HomeAMB.sol')
const BridgeValidators = artifacts.require('BridgeValidators.sol')
const Box = artifacts.require('Box.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')

const { expect } = require('chai')
const { ERROR_MSG, ZERO_ADDRESS, toBN } = require('../setup')
const { sign, ether, expectEventInLogs, addTxHashToAMBData } = require('../helpers/helpers')

const requiredBlockConfirmations = 8
const gasPrice = web3.utils.toWei('1', 'gwei')
const oneEther = ether('1')
const twoEther = ether('2')
const ZERO = toBN(0)

contract('HomeAMB', async accounts => {
  let validatorContract
  let authorities
  let owner
  let validatorsRequiredSignatures
  before(async () => {
    validatorContract = await BridgeValidators.new()
    authorities = [accounts[1], accounts[2]]
    owner = accounts[0]
    validatorsRequiredSignatures = 1
    await validatorContract.initialize(validatorsRequiredSignatures, authorities, owner)
  })
  describe('getBridgeMode', () => {
    it('should return arbitrary message bridging mode and interface', async () => {
      const homeContract = await HomeAMB.new()
      const bridgeModeHash = '0x2544fbb9' // 4 bytes of keccak256('arbitrary-message-bridge-core')
      const bridgeMode = await homeContract.getBridgeMode()
      bridgeMode.should.be.equal(bridgeModeHash)

      const { major, minor, patch } = await homeContract.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(ZERO)
      minor.should.be.bignumber.gte(ZERO)
      patch.should.be.bignumber.gte(ZERO)
    })
  })
  describe('initialize', () => {
    it('sets variables', async () => {
      const homeBridge = await HomeAMB.new()

      expect(await homeBridge.deployedAtBlock()).to.be.bignumber.equal(ZERO)
      expect(await homeBridge.validatorContract()).to.be.equal(ZERO_ADDRESS)
      expect(await homeBridge.maxGasPerTx()).to.be.bignumber.equal(ZERO)
      expect(await homeBridge.gasPrice()).to.be.bignumber.equal(ZERO)
      expect(await homeBridge.requiredBlockConfirmations()).to.be.bignumber.equal(ZERO)
      expect(await homeBridge.owner()).to.be.equal(ZERO_ADDRESS)
      expect(await homeBridge.isInitialized()).to.be.equal(false)

      const { logs } = await homeBridge.initialize(
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      ).should.be.fulfilled

      expect(await homeBridge.deployedAtBlock()).to.be.bignumber.above(ZERO)
      expect(await homeBridge.validatorContract()).to.be.equal(validatorContract.address)
      expect(await homeBridge.maxGasPerTx()).to.be.bignumber.equal(oneEther)
      expect(await homeBridge.gasPrice()).to.be.bignumber.equal(gasPrice)
      expect(await homeBridge.requiredBlockConfirmations()).to.be.bignumber.equal(toBN(requiredBlockConfirmations))
      expect(await homeBridge.owner()).to.be.equal(owner)
      expect(await homeBridge.isInitialized()).to.be.equal(true)

      expectEventInLogs(logs, 'RequiredBlockConfirmationChanged', {
        requiredBlockConfirmations: toBN(requiredBlockConfirmations)
      })
      expectEventInLogs(logs, 'GasPriceChanged', { gasPrice })
    })
    it('should fail with invalid arguments', async () => {
      const homeBridge = await HomeAMB.new()

      expect(await homeBridge.isInitialized()).to.be.equal(false)

      await homeBridge
        .initialize(ZERO_ADDRESS, oneEther, gasPrice, requiredBlockConfirmations, owner)
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridge
        .initialize(accounts[0], oneEther, gasPrice, requiredBlockConfirmations, owner)
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridge
        .initialize(validatorContract.address, oneEther, 0, requiredBlockConfirmations, owner)
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridge
        .initialize(validatorContract.address, oneEther, gasPrice, 0, owner)
        .should.be.rejectedWith(ERROR_MSG)
      await homeBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner)
        .should.be.fulfilled

      expect(await homeBridge.isInitialized()).to.be.equal(true)
    })
    it('can update variables', async () => {
      const alternativeGasPrice = web3.utils.toWei('2', 'gwei')
      const alternativeBlockConfirmations = 1
      const homeBridge = await HomeAMB.new()

      await homeBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner)
        .should.be.fulfilled

      expect(await homeBridge.maxGasPerTx()).to.be.bignumber.equal(oneEther)
      expect(await homeBridge.gasPrice()).to.be.bignumber.equal(gasPrice)
      expect(await homeBridge.requiredBlockConfirmations()).to.be.bignumber.equal(toBN(requiredBlockConfirmations))

      await homeBridge.setGasPrice(0).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.setRequiredBlockConfirmations(0).should.be.rejectedWith(ERROR_MSG)

      await homeBridge.setMaxGasPerTx(twoEther).should.be.fulfilled
      await homeBridge.setGasPrice(alternativeGasPrice).should.be.fulfilled
      await homeBridge.setRequiredBlockConfirmations(alternativeBlockConfirmations).should.be.fulfilled

      expect(await homeBridge.maxGasPerTx()).to.be.bignumber.equal(twoEther)
      expect(await homeBridge.gasPrice()).to.be.bignumber.equal(alternativeGasPrice)
      expect(await homeBridge.requiredBlockConfirmations()).to.be.bignumber.equal(toBN(alternativeBlockConfirmations))

      await homeBridge.setMaxGasPerTx(0).should.be.fulfilled
      expect(await homeBridge.maxGasPerTx()).to.be.bignumber.equal(ZERO)
    })
  })
  describe('upgradeable', async () => {
    it('can be upgraded', async () => {
      // homeBridge V1 Contract
      const homeBridgeV1 = await HomeAMB.new()

      // create proxy
      const proxy = await EternalStorageProxy.new()
      await proxy.upgradeTo('1', homeBridgeV1.address).should.be.fulfilled

      const homeBridgeProxy = await HomeAMB.at(proxy.address)
      await homeBridgeProxy.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner)
        .should.be.fulfilled

      // Deploy V2
      const homeBridgeV2 = await HomeAMB.new()
      await proxy.upgradeTo('2', homeBridgeV2.address).should.be.fulfilled

      homeBridgeV2.address.should.be.equal(await proxy.implementation())
    })
    it('can be deployed via upgradeToAndCall', async () => {
      const homeBridgeV1 = await HomeAMB.new()
      const proxy = await EternalStorageProxy.new()

      const data = homeBridgeV1.contract.methods
        .initialize(validatorContract.address, '1', '1', requiredBlockConfirmations, owner)
        .encodeABI()
      await proxy.upgradeToAndCall('1', homeBridgeV1.address, data).should.be.fulfilled

      const homeBridgeProxy = await HomeAMB.at(proxy.address)
      expect(await homeBridgeProxy.isInitialized()).to.be.equal(true)
    })
    it('can transfer ownership', async () => {
      // homeBridge V1 Contract
      const homeBridgeV1 = await HomeAMB.new()

      // create proxy
      const proxy = await EternalStorageProxy.new()
      await proxy.upgradeTo('1', homeBridgeV1.address).should.be.fulfilled

      const homeBridgeProxy = await HomeAMB.at(proxy.address)
      await homeBridgeProxy.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner)
        .should.be.fulfilled
      expect(await proxy.upgradeabilityOwner()).to.be.equal(owner)

      const newOwner = accounts[1]
      await proxy.transferProxyOwnership(newOwner).should.be.fulfilled
      expect(await proxy.upgradeabilityOwner()).to.be.equal(newOwner)
    })
  })
  describe('requireToPassMessage', () => {
    let homeBridge
    beforeEach(async () => {
      // create proxy
      const homeBridgeV1 = await HomeAMB.new()
      const proxy = await EternalStorageProxy.new()
      await proxy.upgradeTo('1', homeBridgeV1.address).should.be.fulfilled

      homeBridge = await HomeAMB.at(proxy.address)
      await homeBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner)
    })
    it('call requireToPassMessage(address, bytes, uint256)', async () => {
      const tx = await homeBridge.methods['requireToPassMessage(address,bytes,uint256)'](
        '0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955',
        '0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03',
        1535604485,
        { from: accounts[3] }
      )

      tx.receipt.logs.length.should.be.equal(1)
    })
    it('call requireToPassMessage(address, bytes, uint256) should fail', async () => {
      // Should fail because gas < minimumGasUsage
      await homeBridge.methods['requireToPassMessage(address,bytes,uint256)'](
        '0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955',
        '0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03',
        10,
        { from: accounts[3] }
      ).should.be.rejectedWith(ERROR_MSG)

      // Should fail because gas > maxGasPerTx
      await homeBridge.methods['requireToPassMessage(address,bytes,uint256)'](
        '0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955',
        '0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03',
        twoEther,
        { from: accounts[3] }
      ).should.be.rejectedWith(ERROR_MSG)

      await homeBridge.setMaxGasPerTx(ZERO).should.be.fulfilled
      expect(await homeBridge.maxGasPerTx()).to.be.bignumber.equal(ZERO)

      // Should fail because maxGasPerTx = 0 so gas > maxGasPerTx
      await homeBridge.methods['requireToPassMessage(address,bytes,uint256)'](
        '0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955',
        '0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03',
        oneEther,
        { from: accounts[3] }
      ).should.be.rejectedWith(ERROR_MSG)

      await homeBridge.setMaxGasPerTx(oneEther).should.be.fulfilled
      expect(await homeBridge.maxGasPerTx()).to.be.bignumber.equal(oneEther)

      await homeBridge.methods['requireToPassMessage(address,bytes,uint256)'](
        '0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955',
        '0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03',
        oneEther,
        { from: accounts[3] }
      ).should.be.fulfilled
    })
  })
  describe('executeAffirmation', () => {
    let homeBridge
    let setValueData
    let box
    beforeEach(async () => {
      // create proxy
      const homeBridgeV1 = await HomeAMB.new()
      const proxy = await EternalStorageProxy.new()
      await proxy.upgradeTo('1', homeBridgeV1.address).should.be.fulfilled

      homeBridge = await HomeAMB.at(proxy.address)
      await homeBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner)

      box = await Box.new()
      // Generate data for method we want to call on Box contract
      setValueData = await box.contract.methods.setValue(3).encodeABI()
    })
    it('should succeed on Subsidized mode', async () => {
      const user = accounts[8]

      const boxInitialValue = await box.value()
      boxInitialValue.should.be.bignumber.equal(ZERO)

      // Use these calls to simulate foreign bridge on Foreign network
      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, setValueData, 221254, {
        from: user
      })

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = addTxHashToAMBData(encodedData, resultPassMessageTx.tx)

      const { logs } = await homeBridge.executeAffirmation(message, { from: authorities[0] }).should.be.fulfilled
      logs[0].event.should.be.equal('SignedForAffirmation')
      expectEventInLogs(logs, 'AffirmationCompleted', {
        sender: user,
        executor: box.address,
        transactionHash: resultPassMessageTx.tx,
        status: true
      })

      expect(await homeBridge.messageCallStatus(resultPassMessageTx.tx)).to.be.equal(true)

      // check Box value
      expect(await box.value()).to.be.bignumber.equal('3')
      expect(await box.lastSender()).to.be.equal(user)
      expect(await box.txHash()).to.be.equal(resultPassMessageTx.tx)
      expect(await homeBridge.messageSender()).to.be.equal(ZERO_ADDRESS)
    })
    it('test with 3 signatures required', async () => {
      // set validator
      const validatorContractWith3Signatures = await BridgeValidators.new()
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const ownerOfValidators = accounts[0]
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)

      // set bridge
      const homeBridgeWithThreeSigs = await HomeAMB.new()
      await homeBridgeWithThreeSigs.initialize(
        validatorContractWith3Signatures.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      )

      const user = accounts[8]

      const boxInitialValue = await box.value()
      boxInitialValue.should.be.bignumber.equal(ZERO)

      // Use these calls to simulate foreign bridge on Foreign network
      const resultPassMessageTx = await homeBridgeWithThreeSigs.requireToPassMessage(
        box.address,
        setValueData,
        821254,
        { from: user }
      )

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = addTxHashToAMBData(encodedData, resultPassMessageTx.tx)
      const msgHash = web3.utils.soliditySha3(message)

      const { logs } = await homeBridgeWithThreeSigs.executeAffirmation(message, {
        from: authoritiesFiveAccs[0],
        gasPrice
      }).should.be.fulfilled
      expectEventInLogs(logs, 'SignedForAffirmation', {
        signer: authoritiesFiveAccs[0],
        messageHash: msgHash
      })

      const notProcessed = await homeBridgeWithThreeSigs.numAffirmationsSigned(msgHash)
      notProcessed.should.be.bignumber.equal('1')

      await homeBridgeWithThreeSigs
        .executeAffirmation(message, { from: authoritiesFiveAccs[0] })
        .should.be.rejectedWith(ERROR_MSG)
      const secondSignature = await homeBridgeWithThreeSigs.executeAffirmation(message, {
        from: authoritiesFiveAccs[1],
        gasPrice
      }).should.be.fulfilled

      expectEventInLogs(secondSignature.logs, 'SignedForAffirmation', {
        signer: authoritiesFiveAccs[1],
        messageHash: msgHash
      })

      const thirdSignature = await homeBridgeWithThreeSigs.executeAffirmation(message, {
        from: authoritiesFiveAccs[2],
        gasPrice
      }).should.be.fulfilled

      expectEventInLogs(thirdSignature.logs, 'AffirmationCompleted', {
        sender: user,
        executor: box.address,
        transactionHash: resultPassMessageTx.tx,
        status: true
      })

      const senderHash = web3.utils.soliditySha3(authoritiesFiveAccs[0], msgHash)
      true.should.be.equal(await homeBridgeWithThreeSigs.affirmationsSigned(senderHash))

      const senderHash2 = web3.utils.soliditySha3(authoritiesFiveAccs[1], msgHash)
      true.should.be.equal(await homeBridgeWithThreeSigs.affirmationsSigned(senderHash2))

      const senderHash3 = web3.utils.soliditySha3(authoritiesFiveAccs[2], msgHash)
      true.should.be.equal(await homeBridgeWithThreeSigs.affirmationsSigned(senderHash3))

      // check Box value
      expect(await box.value()).to.be.bignumber.equal('3')
      expect(await box.lastSender()).to.be.equal(user)
      expect(await box.txHash()).to.be.equal(resultPassMessageTx.tx)
      expect(await homeBridge.messageSender()).to.be.equal(ZERO_ADDRESS)
    })
    it('should not allow to double execute', async () => {
      const user = accounts[8]

      // Use these calls to simulate foreign bridge on Foreign network
      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, setValueData, 821254, {
        from: user
      })

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = addTxHashToAMBData(encodedData, resultPassMessageTx.tx)

      const { logs } = await homeBridge.executeAffirmation(message, { from: authorities[0], gasPrice }).should.be
        .fulfilled
      logs[0].event.should.be.equal('SignedForAffirmation')
      expectEventInLogs(logs, 'AffirmationCompleted', {
        sender: user,
        executor: box.address,
        transactionHash: resultPassMessageTx.tx,
        status: true
      })

      await homeBridge.executeAffirmation(message, { from: authorities[0], gasPrice }).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.executeAffirmation(message, { from: authorities[1], gasPrice }).should.be.rejectedWith(ERROR_MSG)
    })
    it('should not allow non-authorities to execute affirmation', async () => {
      const user = accounts[8]

      // Use these calls to simulate foreign bridge on Foreign network
      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, setValueData, 821254, {
        from: user
      })

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = addTxHashToAMBData(encodedData, resultPassMessageTx.tx)

      await homeBridge.executeAffirmation(message, { from: user, gasPrice }).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.executeAffirmation(message, { from: accounts[7], gasPrice }).should.be.rejectedWith(ERROR_MSG)

      const { logs } = await homeBridge.executeAffirmation(message, { from: authorities[0], gasPrice }).should.be
        .fulfilled
      logs[0].event.should.be.equal('SignedForAffirmation')
      logs[1].event.should.be.equal('AffirmationCompleted')
    })
    it('status of AffirmationCompleted should be false on contract failed call', async () => {
      const user = accounts[8]

      const methodWillFailData = box.contract.methods.methodWillFail().encodeABI()
      const messageDataHash = web3.utils.soliditySha3(methodWillFailData)

      // Use these calls to simulate foreign bridge on Foreign network
      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, methodWillFailData, 141647, {
        from: user
      })

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = addTxHashToAMBData(encodedData, resultPassMessageTx.tx)

      const { logs } = await homeBridge.executeAffirmation(message, { from: authorities[0], gasPrice }).should.be
        .fulfilled
      logs[0].event.should.be.equal('SignedForAffirmation')
      expectEventInLogs(logs, 'AffirmationCompleted', {
        sender: user,
        executor: box.address,
        transactionHash: resultPassMessageTx.tx,
        status: false
      })

      expect(await homeBridge.messageCallStatus(resultPassMessageTx.tx)).to.be.equal(false)
      expect(await homeBridge.failedMessageDataHash(resultPassMessageTx.tx)).to.be.equal(messageDataHash)
      expect(await homeBridge.failedMessageReceiver(resultPassMessageTx.tx)).to.be.equal(box.address)
      expect(await homeBridge.failedMessageSender(resultPassMessageTx.tx)).to.be.equal(user)

      await homeBridge.executeAffirmation(message, { from: authorities[0], gasPrice }).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.executeAffirmation(message, { from: authorities[1], gasPrice }).should.be.rejectedWith(ERROR_MSG)
    })
    it('status of AffirmationCompleted should be false on contract out of gas call', async () => {
      const user = accounts[8]

      const methodOutOfGasData = box.contract.methods.methodOutOfGas().encodeABI()
      const messageDataHash = web3.utils.soliditySha3(methodOutOfGasData)

      // Use these calls to simulate foreign bridge on Foreign network
      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, methodOutOfGasData, 1000, {
        from: user
      })

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = addTxHashToAMBData(encodedData, resultPassMessageTx.tx)

      const { logs } = await homeBridge.executeAffirmation(message, { from: authorities[0], gasPrice }).should.be
        .fulfilled
      logs[0].event.should.be.equal('SignedForAffirmation')
      expectEventInLogs(logs, 'AffirmationCompleted', {
        sender: user,
        executor: box.address,
        transactionHash: resultPassMessageTx.tx,
        status: false
      })

      expect(await homeBridge.messageCallStatus(resultPassMessageTx.tx)).to.be.equal(false)
      expect(await homeBridge.failedMessageDataHash(resultPassMessageTx.tx)).to.be.equal(messageDataHash)
      expect(await homeBridge.failedMessageReceiver(resultPassMessageTx.tx)).to.be.equal(box.address)
      expect(await homeBridge.failedMessageSender(resultPassMessageTx.tx)).to.be.equal(user)

      await homeBridge.executeAffirmation(message, { from: authorities[0], gasPrice }).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.executeAffirmation(message, { from: authorities[1], gasPrice }).should.be.rejectedWith(ERROR_MSG)
    })
  })
  describe('submitSignature', () => {
    let homeBridge
    let setValueData
    let box
    beforeEach(async () => {
      // create proxy
      const homeBridgeV1 = await HomeAMB.new()
      const proxy = await EternalStorageProxy.new()
      await proxy.upgradeTo('1', homeBridgeV1.address).should.be.fulfilled

      homeBridge = await HomeAMB.at(proxy.address)
      await homeBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner)

      box = await Box.new()
      // Generate data for method we want to call on Box contract
      setValueData = await box.contract.methods.setValue(3).encodeABI()
    })
    it('allows a validator to submit a signature', async () => {
      const user = accounts[8]

      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, setValueData, 821254, {
        from: user
      })

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = addTxHashToAMBData(encodedData, resultPassMessageTx.tx)
      const signature = await sign(authorities[0], message)
      const msgHash = web3.utils.soliditySha3(message)

      const { logs } = await homeBridge.submitSignature(signature, message, { from: authorities[0] }).should.be
        .fulfilled
      expectEventInLogs(logs, 'SignedForUserRequest', {
        signer: authorities[0],
        messageHash: msgHash
      })

      const signatureFromContract = await homeBridge.signature(msgHash, 0)
      const messageFromContract = await homeBridge.message(msgHash)
      signature.should.be.equal(signatureFromContract)
      messageFromContract.should.be.equal(message)

      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authorities[0])
      logs[1].args.messageHash.should.be.equal(msgHash)
      logs[1].args.NumberOfCollectedSignatures.should.be.bignumber.equal(toBN(validatorsRequiredSignatures))

      const hashMsg = web3.utils.soliditySha3(message)
      const hashSenderMsg = web3.utils.soliditySha3(authorities[0], hashMsg)
      true.should.be.equal(await homeBridge.messagesSigned(hashSenderMsg))
    })
    it('test with 3 signatures required', async () => {
      // set validator
      const validatorContractWith3Signatures = await BridgeValidators.new()
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const ownerOfValidators = accounts[0]
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)

      // set bridge
      const homeBridgeWithThreeSigs = await HomeAMB.new()
      await homeBridgeWithThreeSigs.initialize(
        validatorContractWith3Signatures.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      )

      const user = accounts[8]

      const resultPassMessageTx = await homeBridgeWithThreeSigs.requireToPassMessage(
        box.address,
        setValueData,
        821254,
        { from: user }
      )

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = addTxHashToAMBData(encodedData, resultPassMessageTx.tx)
      const signature1 = await sign(authoritiesFiveAccs[0], message)
      const signature2 = await sign(authoritiesFiveAccs[1], message)
      const signature3 = await sign(authoritiesFiveAccs[2], message)
      const msgHash = web3.utils.soliditySha3(message)

      const { logs } = await homeBridgeWithThreeSigs.submitSignature(signature1, message, {
        from: authoritiesFiveAccs[0]
      }).should.be.fulfilled
      expectEventInLogs(logs, 'SignedForUserRequest', {
        signer: authoritiesFiveAccs[0],
        messageHash: msgHash
      })

      const secondSignature = await homeBridgeWithThreeSigs.submitSignature(signature2, message, {
        from: authoritiesFiveAccs[1]
      }).should.be.fulfilled
      expectEventInLogs(secondSignature.logs, 'SignedForUserRequest', {
        signer: authoritiesFiveAccs[1],
        messageHash: msgHash
      })

      const thirdSignature = await homeBridgeWithThreeSigs.submitSignature(signature3, message, {
        from: authoritiesFiveAccs[2]
      }).should.be.fulfilled
      expectEventInLogs(thirdSignature.logs, 'SignedForUserRequest', {
        signer: authoritiesFiveAccs[2],
        messageHash: msgHash
      })

      const messageFromContract = await homeBridgeWithThreeSigs.message(msgHash)
      messageFromContract.should.be.equal(message)

      const signature1FromContract = await homeBridgeWithThreeSigs.signature(msgHash, 0)
      signature1.should.be.equal(signature1FromContract)

      const signature2FromContract = await homeBridgeWithThreeSigs.signature(msgHash, 1)
      signature2.should.be.equal(signature2FromContract)

      const signature3FromContract = await homeBridgeWithThreeSigs.signature(msgHash, 2)
      signature3.should.be.equal(signature3FromContract)

      thirdSignature.logs[1].event.should.be.equal('CollectedSignatures')
      thirdSignature.logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesFiveAccs[2])
      thirdSignature.logs[1].args.messageHash.should.be.equal(msgHash)
      thirdSignature.logs[1].args.NumberOfCollectedSignatures.should.be.bignumber.equal('3')
    })
    it('should not allow to double submit', async () => {
      const user = accounts[8]

      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, setValueData, 821254, {
        from: user
      })

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = addTxHashToAMBData(encodedData, resultPassMessageTx.tx)
      const signature = await sign(authorities[0], message)
      const signature2 = await sign(authorities[1], message)

      // can't submit signature with other validator signature
      await homeBridge.submitSignature(signature2, message, { from: authorities[0] }).should.be.rejectedWith(ERROR_MSG)

      const { logs } = await homeBridge.submitSignature(signature, message, { from: authorities[0] }).should.be
        .fulfilled
      logs[0].event.should.be.equal('SignedForUserRequest')
      logs[1].event.should.be.equal('CollectedSignatures')

      await homeBridge.submitSignature(signature, message, { from: authorities[0] }).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.submitSignature(signature2, message, { from: authorities[1] }).should.be.rejectedWith(ERROR_MSG)
    })

    it('should not allow non-authorities to submit signatures', async () => {
      const user = accounts[8]

      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, setValueData, 821254, {
        from: user
      })

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = addTxHashToAMBData(encodedData, resultPassMessageTx.tx)

      const signature = await sign(authorities[0], message)
      const userSignature = await sign(user, message)
      const user2Signature = await sign(accounts[7], message)

      await homeBridge.submitSignature(userSignature, message, { from: user }).should.be.rejectedWith(ERROR_MSG)
      await homeBridge.submitSignature(user2Signature, message, { from: accounts[7] }).should.be.rejectedWith(ERROR_MSG)

      const { logs } = await homeBridge.submitSignature(signature, message, { from: authorities[0] }).should.be
        .fulfilled
      logs[0].event.should.be.equal('SignedForUserRequest')
      logs[1].event.should.be.equal('CollectedSignatures')
    })
  })
})
