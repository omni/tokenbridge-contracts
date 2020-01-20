const ForeignBridge = artifacts.require('ForeignAMB.sol')
const BridgeValidators = artifacts.require('BridgeValidators.sol')
const Box = artifacts.require('Box.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')

const { expect } = require('chai')
const {
  sign,
  ether,
  expectEventInLogs,
  addTxHashToAMBData,
  signatureToVRS,
  packSignatures,
  createFullAccounts
} = require('../helpers/helpers')
const { ERROR_MSG, ZERO_ADDRESS, toBN } = require('../setup')

const requiredBlockConfirmations = 8
const gasPrice = web3.utils.toWei('1', 'gwei')
const oneEther = ether('1')
const twoEther = ether('2')
const ZERO = toBN(0)
const MAX_VALIDATORS = 50
const MAX_SIGNATURES = MAX_VALIDATORS
const MAX_GAS = 8000000

contract('ForeignAMB', async accounts => {
  let validatorContract
  let authorities
  let owner

  before(async () => {
    validatorContract = await BridgeValidators.new()
    authorities = [accounts[1], accounts[2]]
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
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

      expect(await foreignBridge.deployedAtBlock()).to.be.bignumber.equal(ZERO)
      expect(await foreignBridge.validatorContract()).to.be.equal(ZERO_ADDRESS)
      expect(await foreignBridge.maxGasPerTx()).to.be.bignumber.equal(ZERO)
      expect(await foreignBridge.gasPrice()).to.be.bignumber.equal(ZERO)
      expect(await foreignBridge.requiredBlockConfirmations()).to.be.bignumber.equal(ZERO)
      expect(await foreignBridge.owner()).to.be.equal(ZERO_ADDRESS)
      expect(await foreignBridge.isInitialized()).to.be.equal(false)

      const { logs } = await foreignBridge.initialize(
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      ).should.be.fulfilled

      expect(await foreignBridge.deployedAtBlock()).to.be.bignumber.above(ZERO)
      expect(await foreignBridge.validatorContract()).to.be.equal(validatorContract.address)
      expect(await foreignBridge.maxGasPerTx()).to.be.bignumber.equal(oneEther)
      expect(await foreignBridge.gasPrice()).to.be.bignumber.equal(gasPrice)
      expect(await foreignBridge.requiredBlockConfirmations()).to.be.bignumber.equal(toBN(requiredBlockConfirmations))
      expect(await foreignBridge.owner()).to.be.equal(owner)
      expect(await foreignBridge.isInitialized()).to.be.equal(true)

      expectEventInLogs(logs, 'RequiredBlockConfirmationChanged', {
        requiredBlockConfirmations: toBN(requiredBlockConfirmations)
      })
      expectEventInLogs(logs, 'GasPriceChanged', { gasPrice })
    })
    it('should fail with invalid arguments', async () => {
      const foreignBridge = await ForeignBridge.new()

      expect(await foreignBridge.isInitialized()).to.be.equal(false)

      await foreignBridge
        .initialize(ZERO_ADDRESS, oneEther, gasPrice, requiredBlockConfirmations, owner)
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .initialize(accounts[0], oneEther, gasPrice, requiredBlockConfirmations, owner)
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .initialize(validatorContract.address, oneEther, 0, requiredBlockConfirmations, owner)
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .initialize(validatorContract.address, oneEther, gasPrice, 0, owner)
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner)
        .should.be.fulfilled

      expect(await foreignBridge.isInitialized()).to.be.equal(true)
    })
    it('can update variables', async () => {
      const alternativeGasPrice = web3.utils.toWei('2', 'gwei')
      const alternativeBlockConfirmations = 1
      const foreignBridge = await ForeignBridge.new()

      await foreignBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner)
        .should.be.fulfilled

      expect(await foreignBridge.maxGasPerTx()).to.be.bignumber.equal(oneEther)
      expect(await foreignBridge.gasPrice()).to.be.bignumber.equal(gasPrice)
      expect(await foreignBridge.requiredBlockConfirmations()).to.be.bignumber.equal(toBN(requiredBlockConfirmations))

      await foreignBridge.setGasPrice(0).should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.setRequiredBlockConfirmations(0).should.be.rejectedWith(ERROR_MSG)

      await foreignBridge.setMaxGasPerTx(twoEther).should.be.fulfilled
      await foreignBridge.setGasPrice(alternativeGasPrice).should.be.fulfilled
      await foreignBridge.setRequiredBlockConfirmations(alternativeBlockConfirmations).should.be.fulfilled

      expect(await foreignBridge.maxGasPerTx()).to.be.bignumber.equal(twoEther)
      expect(await foreignBridge.gasPrice()).to.be.bignumber.equal(alternativeGasPrice)
      expect(await foreignBridge.requiredBlockConfirmations()).to.be.bignumber.equal(
        toBN(alternativeBlockConfirmations)
      )
      await foreignBridge.setMaxGasPerTx(0).should.be.fulfilled
      expect(await foreignBridge.maxGasPerTx()).to.be.bignumber.equal(ZERO)
    })
  })
  describe('upgradeable', async () => {
    it('can be upgraded', async () => {
      // foreignBridge V1 Contract
      const foreignBridgeV1 = await ForeignBridge.new()

      // create proxy
      const proxy = await EternalStorageProxy.new()
      await proxy.upgradeTo('1', foreignBridgeV1.address).should.be.fulfilled

      const foreignBridgeProxy = await ForeignBridge.at(proxy.address)
      await foreignBridgeProxy.initialize(
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      ).should.be.fulfilled

      // Deploy V2
      const foreignBridgeV2 = await ForeignBridge.new()
      await proxy.upgradeTo('2', foreignBridgeV2.address).should.be.fulfilled

      foreignBridgeV2.address.should.be.equal(await proxy.implementation())
    })
    it('can be deployed via upgradeToAndCall', async () => {
      const foreignBridgeV1 = await ForeignBridge.new()

      const proxy = await EternalStorageProxy.new()

      const data = foreignBridgeV1.contract.methods
        .initialize(validatorContract.address, '1', '1', requiredBlockConfirmations, owner)
        .encodeABI()
      await proxy.upgradeToAndCall('1', foreignBridgeV1.address, data).should.be.fulfilled

      const foreignBridgeProxy = await ForeignBridge.at(proxy.address)
      expect(await foreignBridgeProxy.isInitialized()).to.be.equal(true)
    })
    it('can transfer ownership', async () => {
      // foreignBridge V1 Contract
      const foreignBridgeV1 = await ForeignBridge.new()

      // create proxy
      const proxy = await EternalStorageProxy.new()
      await proxy.upgradeTo('1', foreignBridgeV1.address).should.be.fulfilled

      const foreignBridgeProxy = await ForeignBridge.at(proxy.address)
      await foreignBridgeProxy.initialize(
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      ).should.be.fulfilled
      expect(await proxy.upgradeabilityOwner()).to.be.equal(owner)

      const newOwner = accounts[1]
      await proxy.transferProxyOwnership(newOwner).should.be.fulfilled
      expect(await proxy.upgradeabilityOwner()).to.be.equal(newOwner)
    })
  })
  describe('requireToPassMessage', () => {
    let foreignBridge
    beforeEach(async () => {
      const foreignBridgeV1 = await ForeignBridge.new()

      // create proxy
      const proxy = await EternalStorageProxy.new()
      await proxy.upgradeTo('1', foreignBridgeV1.address).should.be.fulfilled

      foreignBridge = await ForeignBridge.at(proxy.address)
      await foreignBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner)
    })
    it('call requireToPassMessage(address, bytes, uint256)', async () => {
      const tx = await foreignBridge.methods['requireToPassMessage(address,bytes,uint256)'](
        '0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955',
        '0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03',
        1535604485,
        { from: accounts[3] }
      )

      tx.receipt.logs.length.should.be.equal(1)
    })
  })
  describe('executeSignatures', () => {
    let foreignBridge
    let setValueData
    let box
    beforeEach(async () => {
      const foreignBridgeV1 = await ForeignBridge.new()

      // create proxy
      const proxy = await EternalStorageProxy.new()
      await proxy.upgradeTo('1', foreignBridgeV1.address).should.be.fulfilled

      foreignBridge = await ForeignBridge.at(proxy.address)
      await foreignBridge.initialize(validatorContract.address, oneEther, gasPrice, requiredBlockConfirmations, owner)

      box = await Box.new()
      // Generate data for method we want to call on Box contract
      setValueData = await box.contract.methods.setValue(3).encodeABI()
    })
    it('should succeed on Subsidized mode', async () => {
      const user = accounts[8]

      const boxInitialValue = await box.value()
      boxInitialValue.should.be.bignumber.equal(ZERO)

      // Use these calls to simulate home bridge on Home network
      const resultPassMessageTx = await foreignBridge.requireToPassMessage(box.address, setValueData, 1221254, {
        from: user
      })

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = addTxHashToAMBData(encodedData, resultPassMessageTx.tx)

      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      const signatures = packSignatures([vrs])

      const { logs } = await foreignBridge.executeSignatures(message, signatures, {
        from: authorities[0]
      }).should.be.fulfilled
      expectEventInLogs(logs, 'RelayedMessage', {
        sender: user,
        executor: box.address,
        transactionHash: resultPassMessageTx.tx,
        status: true
      })

      expect(await foreignBridge.messageCallStatus(resultPassMessageTx.tx)).to.be.equal(true)

      // check Box value
      expect(await box.value()).to.be.bignumber.equal('3')
      expect(await box.lastSender()).to.be.equal(user)
      expect(await box.txHash()).to.be.equal(resultPassMessageTx.tx)
      expect(await foreignBridge.messageSender()).to.be.equal(ZERO_ADDRESS)
    })
    it('test with 3 signatures required', async () => {
      // set validator
      const validatorContractWith3Signatures = await BridgeValidators.new()
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const ownerOfValidators = accounts[0]
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)

      // set bridge
      const foreignBridgeWithThreeSigs = await ForeignBridge.new()
      await foreignBridgeWithThreeSigs.initialize(
        validatorContractWith3Signatures.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      )

      const user = accounts[8]

      const boxInitialValue = await box.value()
      boxInitialValue.should.be.bignumber.equal(ZERO)

      // Use these calls to simulate home bridge on home network
      const resultPassMessageTx = await foreignBridgeWithThreeSigs.requireToPassMessage(
        box.address,
        setValueData,
        821254,
        { from: user }
      )

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = addTxHashToAMBData(encodedData, resultPassMessageTx.tx)

      const signature1 = await sign(authoritiesFiveAccs[0], message)
      const vrs = signatureToVRS(signature1)

      const signature2 = await sign(authoritiesFiveAccs[1], message)
      const vrs2 = signatureToVRS(signature2)

      const signature3 = await sign(authoritiesFiveAccs[2], message)
      const vrs3 = signatureToVRS(signature3)
      const oneSignature = packSignatures([vrs])
      const twoSignatures = packSignatures([vrs, vrs2])
      const threeSignatures = packSignatures([vrs, vrs2, vrs3])

      await foreignBridgeWithThreeSigs
        .executeSignatures(message, oneSignature, { from: authoritiesFiveAccs[2], gasPrice })
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridgeWithThreeSigs
        .executeSignatures(message, twoSignatures, {
          from: authoritiesFiveAccs[2],
          gasPrice
        })
        .should.be.rejectedWith(ERROR_MSG)

      const { logs } = await foreignBridgeWithThreeSigs.executeSignatures(message, threeSignatures, {
        from: authoritiesFiveAccs[2],
        gasPrice
      }).should.be.fulfilled
      expectEventInLogs(logs, 'RelayedMessage', {
        sender: user,
        executor: box.address,
        transactionHash: resultPassMessageTx.tx,
        status: true
      })

      // check Box value
      expect(await box.value()).to.be.bignumber.equal('3')
      expect(await box.lastSender()).to.be.equal(user)
      expect(await box.txHash()).to.be.equal(resultPassMessageTx.tx)
      expect(await foreignBridge.messageSender()).to.be.equal(ZERO_ADDRESS)
    })
    it('test with max allowed number of signatures required', async () => {
      // set validator
      const validatorContract = await BridgeValidators.new()
      const authorities = createFullAccounts(web3, MAX_VALIDATORS)
      const addresses = authorities.map(account => account.address)
      const ownerOfValidators = accounts[0]
      await validatorContract.initialize(MAX_SIGNATURES, addresses, ownerOfValidators)

      // set bridge
      const foreignBridgeWithMaxSigs = await ForeignBridge.new()
      await foreignBridgeWithMaxSigs.initialize(
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      )

      const user = accounts[8]

      const boxInitialValue = await box.value()
      boxInitialValue.should.be.bignumber.equal(ZERO)

      // Use these calls to simulate home bridge on home network
      const resultPassMessageTx = await foreignBridgeWithMaxSigs.requireToPassMessage(
        box.address,
        setValueData,
        821254,
        { from: user }
      )

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = addTxHashToAMBData(encodedData, resultPassMessageTx.tx)

      const vrsList = []
      for (let i = 0; i < MAX_SIGNATURES; i++) {
        const { signature } = await authorities[i].sign(message)
        vrsList[i] = signatureToVRS(signature)
      }

      const signatures = packSignatures(vrsList)

      const { receipt } = await foreignBridgeWithMaxSigs.executeSignatures(message, signatures, {
        from: accounts[0],
        gasPrice
      }).should.be.fulfilled
      expect(receipt.gasUsed).to.be.lte(MAX_GAS)
    })
    it('should not allow to double execute signatures', async () => {
      const user = accounts[8]

      // Use these calls to simulate home bridge on home network
      const resultPassMessageTx = await foreignBridge.requireToPassMessage(box.address, setValueData, 821254, {
        from: user
      })

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = addTxHashToAMBData(encodedData, resultPassMessageTx.tx)

      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      const signatures = packSignatures([vrs])

      const { logs } = await foreignBridge.executeSignatures(message, signatures, {
        from: authorities[0],
        gasPrice
      }).should.be.fulfilled
      expectEventInLogs(logs, 'RelayedMessage', {
        sender: user,
        executor: box.address,
        transactionHash: resultPassMessageTx.tx,
        status: true
      })

      await foreignBridge
        .executeSignatures(message, signatures, { from: authorities[0], gasPrice })
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .executeSignatures(message, signatures, { from: authorities[1], gasPrice })
        .should.be.rejectedWith(ERROR_MSG)
    })
    it('should allow non-authorities to execute signatures', async () => {
      const user = accounts[8]

      // Use these calls to simulate home bridge on home network
      const resultPassMessageTx = await foreignBridge.requireToPassMessage(box.address, setValueData, 821254, {
        from: user
      })

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = addTxHashToAMBData(encodedData, resultPassMessageTx.tx)

      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      const signatures = packSignatures([vrs])

      const { logs } = await foreignBridge.executeSignatures(message, signatures, {
        from: user,
        gasPrice
      }).should.be.fulfilled

      expectEventInLogs(logs, 'RelayedMessage', {
        sender: user,
        executor: box.address,
        transactionHash: resultPassMessageTx.tx,
        status: true
      })

      expect(await foreignBridge.messageCallStatus(resultPassMessageTx.tx)).to.be.equal(true)
    })
    it('status of RelayedMessage should be false on contract failed call', async () => {
      const user = accounts[8]

      const methodWillFailData = box.contract.methods.methodWillFail().encodeABI()
      const messageDataHash = web3.utils.soliditySha3(methodWillFailData)

      // Use these calls to simulate home bridge on home network
      const resultPassMessageTx = await foreignBridge.requireToPassMessage(box.address, methodWillFailData, 821254, {
        from: user
      })

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = addTxHashToAMBData(encodedData, resultPassMessageTx.tx)

      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      const signatures = packSignatures([vrs])

      const { logs } = await foreignBridge.executeSignatures(message, signatures, {
        from: authorities[0],
        gasPrice
      }).should.be.fulfilled
      expectEventInLogs(logs, 'RelayedMessage', {
        sender: user,
        executor: box.address,
        transactionHash: resultPassMessageTx.tx,
        status: false
      })

      expect(await foreignBridge.messageCallStatus(resultPassMessageTx.tx)).to.be.equal(false)
      expect(await foreignBridge.failedMessageDataHash(resultPassMessageTx.tx)).to.be.equal(messageDataHash)
      expect(await foreignBridge.failedMessageReceiver(resultPassMessageTx.tx)).to.be.equal(box.address)
      expect(await foreignBridge.failedMessageSender(resultPassMessageTx.tx)).to.be.equal(user)

      await foreignBridge
        .executeSignatures(message, signatures, { from: authorities[0], gasPrice })
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .executeSignatures(message, signatures, { from: authorities[1], gasPrice })
        .should.be.rejectedWith(ERROR_MSG)
    })
    it('status of RelayedMessage should be false on contract out of gas call', async () => {
      const user = accounts[8]

      const methodOutOfGasData = box.contract.methods.methodOutOfGas().encodeABI()
      const messageDataHash = web3.utils.soliditySha3(methodOutOfGasData)

      // Use these calls to simulate home bridge on home network
      const resultPassMessageTx = await foreignBridge.requireToPassMessage(box.address, methodOutOfGasData, 1000, {
        from: user
      })

      // Validator on token-bridge add txHash to message
      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = addTxHashToAMBData(encodedData, resultPassMessageTx.tx)

      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      const signatures = packSignatures([vrs])

      const { logs } = await foreignBridge.executeSignatures(message, signatures, {
        from: authorities[0],
        gasPrice
      }).should.be.fulfilled
      expectEventInLogs(logs, 'RelayedMessage', {
        sender: user,
        executor: box.address,
        transactionHash: resultPassMessageTx.tx,
        status: false
      })

      expect(await foreignBridge.messageCallStatus(resultPassMessageTx.tx)).to.be.equal(false)
      expect(await foreignBridge.failedMessageDataHash(resultPassMessageTx.tx)).to.be.equal(messageDataHash)
      expect(await foreignBridge.failedMessageReceiver(resultPassMessageTx.tx)).to.be.equal(box.address)
      expect(await foreignBridge.failedMessageSender(resultPassMessageTx.tx)).to.be.equal(user)

      await foreignBridge
        .executeSignatures(message, signatures, { from: authorities[0], gasPrice })
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .executeSignatures(message, signatures, { from: authorities[1], gasPrice })
        .should.be.rejectedWith(ERROR_MSG)
    })
  })
})
