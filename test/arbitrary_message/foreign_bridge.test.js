const ForeignBridge = artifacts.require('ForeignAMBWithGasTokenMock.sol')
const HomeBridge = artifacts.require('HomeAMB.sol')
const GasToken = artifacts.require('GasTokenMock.sol')
const BridgeValidators = artifacts.require('BridgeValidators.sol')
const Box = artifacts.require('Box.sol')
const ERC677ReceiverTest = artifacts.require('ERC677ReceiverTest.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')

const { expect } = require('chai')
const {
  sign,
  ether,
  expectEventInLogs,
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
const HOME_CHAIN_ID = 1337
const HOME_CHAIN_ID_HEX = `0x${HOME_CHAIN_ID.toString(16).padStart(4, '0')}`
const FOREIGN_CHAIN_ID = 1234567890
const FOREIGN_CHAIN_ID_HEX = `0x${FOREIGN_CHAIN_ID.toString(16).padStart(8, '0')}`

contract('ForeignAMB', async accounts => {
  let validatorContract
  let authorities
  let owner
  let gasTokenContract

  before(async () => {
    validatorContract = await BridgeValidators.new()
    gasTokenContract = await GasToken.new()
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
        FOREIGN_CHAIN_ID_HEX,
        HOME_CHAIN_ID_HEX,
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
        .initialize(
          '0x00',
          HOME_CHAIN_ID_HEX,
          validatorContract.address,
          oneEther,
          gasPrice,
          requiredBlockConfirmations,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .initialize(
          HOME_CHAIN_ID_HEX,
          HOME_CHAIN_ID_HEX,
          validatorContract.address,
          oneEther,
          gasPrice,
          requiredBlockConfirmations,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .initialize(
          FOREIGN_CHAIN_ID_HEX,
          HOME_CHAIN_ID_HEX,
          ZERO_ADDRESS,
          oneEther,
          gasPrice,
          requiredBlockConfirmations,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .initialize(
          FOREIGN_CHAIN_ID_HEX,
          HOME_CHAIN_ID_HEX,
          accounts[0],
          oneEther,
          gasPrice,
          requiredBlockConfirmations,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .initialize(
          FOREIGN_CHAIN_ID_HEX,
          HOME_CHAIN_ID_HEX,
          validatorContract.address,
          oneEther,
          0,
          requiredBlockConfirmations,
          owner
        )
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .initialize(FOREIGN_CHAIN_ID_HEX, HOME_CHAIN_ID_HEX, validatorContract.address, oneEther, gasPrice, 0, owner)
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .initialize(
          FOREIGN_CHAIN_ID_HEX,
          HOME_CHAIN_ID_HEX,
          validatorContract.address,
          oneEther,
          gasPrice,
          requiredBlockConfirmations,
          ZERO_ADDRESS
        )
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge.initialize(
        FOREIGN_CHAIN_ID_HEX,
        HOME_CHAIN_ID_HEX,
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      ).should.be.fulfilled

      expect(await foreignBridge.isInitialized()).to.be.equal(true)
    })
    it('can update variables', async () => {
      const alternativeGasPrice = web3.utils.toWei('2', 'gwei')
      const alternativeBlockConfirmations = 1
      const foreignBridge = await ForeignBridge.new()

      await foreignBridge.initialize(
        FOREIGN_CHAIN_ID_HEX,
        HOME_CHAIN_ID_HEX,
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      ).should.be.fulfilled

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
        FOREIGN_CHAIN_ID_HEX,
        HOME_CHAIN_ID_HEX,
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
        .initialize(
          FOREIGN_CHAIN_ID_HEX,
          HOME_CHAIN_ID_HEX,
          validatorContract.address,
          '1',
          '1',
          requiredBlockConfirmations,
          owner
        )
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
        FOREIGN_CHAIN_ID_HEX,
        HOME_CHAIN_ID_HEX,
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
    let bridgeId
    beforeEach(async () => {
      const foreignBridgeV1 = await ForeignBridge.new()

      // create proxy
      const proxy = await EternalStorageProxy.new()
      await proxy.upgradeTo('1', foreignBridgeV1.address).should.be.fulfilled

      foreignBridge = await ForeignBridge.at(proxy.address)
      await foreignBridge.initialize(
        FOREIGN_CHAIN_ID_HEX,
        HOME_CHAIN_ID_HEX,
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      )
      const paddedChainId = `0x${FOREIGN_CHAIN_ID.toString(16).padStart(64, '0')}`
      bridgeId = web3.utils.soliditySha3(paddedChainId + foreignBridge.address.slice(2)).slice(10, 50)
    })
    it('call requireToPassMessage(address, bytes, uint256)', async () => {
      const tx = await foreignBridge.methods['requireToPassMessage(address,bytes,uint256)'](
        '0xf4BEF13F9f4f2B203FAF0C3cBbaAbe1afE056955',
        '0xb1591967aed668a4b27645ff40c444892d91bf5951b382995d4d4f6ee3a2ce03',
        1535604485,
        { from: accounts[3] }
      )

      tx.receipt.logs.length.should.be.equal(1)
      expect(tx.receipt.logs[0].args.messageId).to.include(`${bridgeId}0000000000000000`)
    })
    it('should generate different message ids', async () => {
      const user = accounts[8]

      const resultPassMessageTx1 = await foreignBridge.requireToPassMessage(accounts[7], '0x11223344', 221254, {
        from: user
      })
      const resultPassMessageTx2 = await foreignBridge.requireToPassMessage(accounts[7], '0x11223344', 221254, {
        from: user
      })
      const resultPassMessageTx3 = await foreignBridge.requireToPassMessage(accounts[7], '0x11223344', 221254, {
        from: user
      })

      const messageId1 = resultPassMessageTx1.logs[0].args.messageId
      const messageId2 = resultPassMessageTx2.logs[0].args.messageId
      const messageId3 = resultPassMessageTx3.logs[0].args.messageId
      expect(messageId1).to.include(`${bridgeId}0000000000000000`)
      expect(messageId2).to.include(`${bridgeId}0000000000000001`)
      expect(messageId3).to.include(`${bridgeId}0000000000000002`)
    })
  })
  describe('executeSignatures', () => {
    let foreignBridge
    let homeBridge
    let setValueData
    let box
    beforeEach(async () => {
      const foreignBridgeV1 = await ForeignBridge.new()
      homeBridge = await HomeBridge.new()

      // create proxy
      const proxy = await EternalStorageProxy.new()
      await proxy.upgradeTo('1', foreignBridgeV1.address).should.be.fulfilled

      foreignBridge = await ForeignBridge.at(proxy.address)
      await foreignBridge.initialize(
        FOREIGN_CHAIN_ID_HEX,
        HOME_CHAIN_ID_HEX,
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      )

      await homeBridge.initialize(
        HOME_CHAIN_ID_HEX,
        FOREIGN_CHAIN_ID_HEX,
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      )

      box = await Box.new()
      // Generate data for method we want to call on Box contract
      setValueData = await box.contract.methods.setValue(3).encodeABI()
    })
    it('should succeed on Subsidized mode', async () => {
      const user = accounts[8]

      const boxInitialValue = await box.value()
      boxInitialValue.should.be.bignumber.equal(ZERO)

      // Use these calls to simulate home bridge on Home network
      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, setValueData, 1221254, {
        from: user
      })

      const { messageId, encodedData: message } = resultPassMessageTx.logs[0].args

      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      const signatures = packSignatures([vrs])

      const { logs } = await foreignBridge.executeSignatures(message, signatures, {
        from: authorities[0]
      }).should.be.fulfilled
      expectEventInLogs(logs, 'RelayedMessage', {
        sender: user,
        executor: box.address,
        messageId,
        status: true
      })

      expect(await foreignBridge.messageCallStatus(messageId)).to.be.equal(true)

      // check Box value
      expect(await box.value()).to.be.bignumber.equal('3')
      expect(await box.lastSender()).to.be.equal(user)
      expect(await box.messageId()).to.be.equal(messageId)
      expect(await box.txHash()).to.be.equal(messageId)
      expect(await box.messageSourceChainId()).to.be.bignumber.equal(HOME_CHAIN_ID.toString())
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
        FOREIGN_CHAIN_ID_HEX,
        HOME_CHAIN_ID_HEX,
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
      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, setValueData, 821254, {
        from: user
      })

      const { messageId, encodedData: message } = resultPassMessageTx.logs[0].args

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
        messageId,
        status: true
      })

      // check Box value
      expect(await box.value()).to.be.bignumber.equal('3')
      expect(await box.lastSender()).to.be.equal(user)
      expect(await box.messageId()).to.be.equal(messageId)
      expect(await box.txHash()).to.be.equal(messageId)
      expect(await box.messageSourceChainId()).to.be.bignumber.equal(HOME_CHAIN_ID.toString())
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
        FOREIGN_CHAIN_ID_HEX,
        HOME_CHAIN_ID_HEX,
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
      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, setValueData, 821254, {
        from: user
      })

      const message = resultPassMessageTx.logs[0].args.encodedData

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
      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, setValueData, 821254, {
        from: user
      })

      const { messageId, encodedData: message } = resultPassMessageTx.logs[0].args

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
        messageId,
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
      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, setValueData, 821254, {
        from: user
      })

      const { messageId, encodedData: message } = resultPassMessageTx.logs[0].args

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
        messageId,
        status: true
      })

      expect(await foreignBridge.messageCallStatus(messageId)).to.be.equal(true)
    })
    it('status of RelayedMessage should be false on contract failed call', async () => {
      const user = accounts[8]

      const methodWillFailData = box.contract.methods.methodWillFail().encodeABI()

      // Use these calls to simulate home bridge on home network
      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, methodWillFailData, 821254, {
        from: user
      })

      const { messageId, encodedData: message } = resultPassMessageTx.logs[0].args

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
        messageId,
        status: false
      })

      expect(await foreignBridge.messageCallStatus(messageId)).to.be.equal(false)
      expect(await foreignBridge.failedMessageDataHash(messageId)).to.be.equal(
        web3.utils.soliditySha3(methodWillFailData)
      )
      expect(await foreignBridge.failedMessageReceiver(messageId)).to.be.equal(box.address)
      expect(await foreignBridge.failedMessageSender(messageId)).to.be.equal(user)

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

      // Use these calls to simulate home bridge on home network
      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, methodOutOfGasData, 1000, {
        from: user
      })

      const { messageId, encodedData: message } = resultPassMessageTx.logs[0].args

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
        messageId,
        status: false
      })

      expect(await foreignBridge.messageCallStatus(messageId)).to.be.equal(false)
      expect(await foreignBridge.failedMessageDataHash(messageId)).to.be.equal(
        web3.utils.soliditySha3(methodOutOfGasData)
      )
      expect(await foreignBridge.failedMessageReceiver(messageId)).to.be.equal(box.address)
      expect(await foreignBridge.failedMessageSender(messageId)).to.be.equal(user)

      await foreignBridge
        .executeSignatures(message, signatures, { from: authorities[0], gasPrice })
        .should.be.rejectedWith(ERROR_MSG)
      await foreignBridge
        .executeSignatures(message, signatures, { from: authorities[1], gasPrice })
        .should.be.rejectedWith(ERROR_MSG)
    })
    it('should not allow to process messages with different version', async () => {
      const user = accounts[8]

      // Use these calls to simulate home bridge on home network
      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, setValueData, 821254, {
        from: user
      })

      const { encodedData } = resultPassMessageTx.logs[0].args
      const message = `0x99${encodedData.slice(4)}`

      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      const signatures = packSignatures([vrs])

      await foreignBridge.executeSignatures(message, signatures, {
        from: user,
        gasPrice
      }).should.be.rejected
    })
    it('should not allow to process messages with different destination chain id', async () => {
      const user = accounts[8]

      // Use these calls to simulate home bridge on home network
      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, setValueData, 821254, {
        from: user
      })

      const message = resultPassMessageTx.logs[0].args.encodedData

      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      const signatures = packSignatures([vrs])

      await foreignBridge.setChainIds(HOME_CHAIN_ID_HEX, FOREIGN_CHAIN_ID_HEX)

      await foreignBridge.executeSignatures(message, signatures, {
        from: authorities[0],
        gasPrice
      }).should.be.rejected
    })
    it('should not allow to pass message back through the bridge', async () => {
      const user = accounts[8]

      const data = await foreignBridge.contract.methods
        .requireToPassMessage(box.address, setValueData, 100000)
        .encodeABI()
      // Use these calls to simulate home bridge on home network
      const resultPassMessageTx = await homeBridge.requireToPassMessage(foreignBridge.address, data, 821254, {
        from: user
      })

      const { encodedData: message, messageId } = resultPassMessageTx.logs[0].args

      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      const signatures = packSignatures([vrs])

      await foreignBridge.executeSignatures(message, signatures, {
        from: authorities[0],
        gasPrice
      }).should.be.fulfilled

      // means that call to requireToPassMessage inside MessageProcessor reverted, since messageId flag was set up
      expect(await foreignBridge.messageCallStatus(messageId)).to.be.equal(false)
    })
    it('should allow to pass message back through the bridge if configured', async () => {
      const user = accounts[8]
      await foreignBridge.setAllowReentrantRequests(true, { from: user }).should.be.rejected
      await foreignBridge.setAllowReentrantRequests(true, { from: owner }).should.be.fulfilled
      expect(await foreignBridge.allowReentrantRequests()).to.be.equal(true)

      const data = await foreignBridge.contract.methods
        .requireToPassMessage(box.address, setValueData, 100000)
        .encodeABI()
      // Use these calls to simulate home bridge on home network
      const resultPassMessageTx = await homeBridge.requireToPassMessage(foreignBridge.address, data, 821254, {
        from: user
      })

      const { encodedData: message, messageId } = resultPassMessageTx.logs[0].args

      const signature = await sign(authorities[0], message)
      const vrs = signatureToVRS(signature)
      const signatures = packSignatures([vrs])

      await foreignBridge.executeSignatures(message, signatures, {
        from: authorities[0],
        gasPrice
      }).should.be.fulfilled

      expect(await foreignBridge.messageCallStatus(messageId)).to.be.equal(true)
    })
  })

  describe('gasToken functionality', async () => {
    const receiver = accounts[1]
    let foreignBridge

    beforeEach(async () => {
      foreignBridge = await ForeignBridge.new()
      await foreignBridge.initialize(
        FOREIGN_CHAIN_ID_HEX,
        HOME_CHAIN_ID_HEX,
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      )
    })

    describe('setGasTokenParameters', async () => {
      it('should initialize gas token', async () => {
        expect(await foreignBridge.gasTokenTargetMintValue()).to.be.bignumber.equal(ZERO)
        expect(await foreignBridge.gasTokenReceiver()).to.be.equal(ZERO_ADDRESS)

        await foreignBridge.setGasTokenParameters(50, receiver).should.be.fulfilled

        expect(await foreignBridge.gasTokenTargetMintValue()).to.be.bignumber.equal('50')
        expect(await foreignBridge.gasTokenReceiver()).to.be.equal(receiver)
      })

      it('should fail if not an owner', async () => {
        await foreignBridge.setGasTokenParameters(50, receiver, { from: accounts[3] }).should.be.rejected
      })
    })

    describe('setGasTokenTargetMintValue', async () => {
      it('should initialize gas token', async () => {
        expect(await foreignBridge.gasTokenTargetMintValue()).to.be.bignumber.equal(ZERO)

        await foreignBridge.setGasTokenTargetMintValue('50').should.be.fulfilled

        expect(await foreignBridge.gasTokenTargetMintValue()).to.be.bignumber.equal('50')
      })

      it('should reset to 0', async () => {
        expect(await foreignBridge.gasTokenTargetMintValue()).to.be.bignumber.equal(ZERO)

        await foreignBridge.setGasTokenTargetMintValue('50').should.be.fulfilled
        await foreignBridge.setGasTokenTargetMintValue('0').should.be.fulfilled

        expect(await foreignBridge.gasTokenTargetMintValue()).to.be.bignumber.equal(ZERO)
      })

      it('should fail if not an owner', async () => {
        await foreignBridge.setGasTokenTargetMintValue('50', { from: accounts[3] }).should.be.rejected
      })
    })

    describe('setGasTokenReceiver', async () => {
      it('should initialize gas token', async () => {
        expect(await foreignBridge.gasTokenReceiver()).to.be.equal(ZERO_ADDRESS)

        await foreignBridge.setGasTokenReceiver(receiver).should.be.fulfilled

        expect(await foreignBridge.gasTokenReceiver()).to.be.equal(receiver)
      })

      it('should reset to zero address', async () => {
        expect(await foreignBridge.gasTokenReceiver()).to.be.equal(ZERO_ADDRESS)

        await foreignBridge.setGasTokenReceiver(receiver).should.be.fulfilled
        await foreignBridge.setGasTokenReceiver(ZERO_ADDRESS).should.be.fulfilled

        expect(await foreignBridge.gasTokenReceiver()).to.be.equal(ZERO_ADDRESS)
      })

      it('should fail if not an owner', async () => {
        await foreignBridge.setGasTokenReceiver(receiver, { from: accounts[3] }).should.be.rejected
      })
    })

    describe('_collectGasTokens', async () => {
      beforeEach(async () => {
        await foreignBridge.setGasTokenParameters(3, receiver)
        await gasTokenContract.freeUpTo('100', { from: receiver })
      })

      it('should mint tokens with zero approval', async () => {
        expect(await gasTokenContract.balanceOf(receiver)).to.be.bignumber.equal(ZERO)
        expect(await foreignBridge.gasTokenTargetMintValue()).to.be.bignumber.equal('3')
        expect(await gasTokenContract.allowance(owner, foreignBridge.address)).to.be.bignumber.equal(ZERO)

        await foreignBridge.collectGasTokens().should.be.fulfilled

        expect(await gasTokenContract.balanceOf(receiver)).to.be.bignumber.equal('3')
        expect(await foreignBridge.gasTokenTargetMintValue()).to.be.bignumber.equal('3')
        expect(await gasTokenContract.allowance(owner, foreignBridge.address)).to.be.bignumber.equal(ZERO)
      })

      it('should mint tokens with partial approval', async () => {
        await gasTokenContract.mint(5)
        await gasTokenContract.approve(foreignBridge.address, 2)

        expect(await gasTokenContract.balanceOf(receiver)).to.be.bignumber.equal(ZERO)
        expect(await foreignBridge.gasTokenTargetMintValue()).to.be.bignumber.equal('3')
        expect(await gasTokenContract.allowance(owner, foreignBridge.address)).to.be.bignumber.equal('2')

        await foreignBridge.collectGasTokens().should.be.fulfilled

        expect(await gasTokenContract.balanceOf(receiver)).to.be.bignumber.equal('3')
        expect(await foreignBridge.gasTokenTargetMintValue()).to.be.bignumber.equal('3')
        expect(await gasTokenContract.allowance(owner, foreignBridge.address)).to.be.bignumber.equal(ZERO)
      })

      it('should transfer all approved tokens', async () => {
        await gasTokenContract.mint(5)
        await gasTokenContract.approve(foreignBridge.address, 3)

        expect(await gasTokenContract.balanceOf(receiver)).to.be.bignumber.equal(ZERO)
        expect(await foreignBridge.gasTokenTargetMintValue()).to.be.bignumber.equal('3')
        expect(await gasTokenContract.allowance(owner, foreignBridge.address)).to.be.bignumber.equal('3')

        await foreignBridge.collectGasTokens().should.be.fulfilled

        expect(await gasTokenContract.balanceOf(receiver)).to.be.bignumber.equal('3')
        expect(await foreignBridge.gasTokenTargetMintValue()).to.be.bignumber.equal('3')
        expect(await gasTokenContract.allowance(owner, foreignBridge.address)).to.be.bignumber.equal(ZERO)
      })

      it('should transfer target approved tokens', async () => {
        await gasTokenContract.mint(5)
        await gasTokenContract.approve(foreignBridge.address, 10)

        expect(await gasTokenContract.balanceOf(receiver)).to.be.bignumber.equal(ZERO)
        expect(await foreignBridge.gasTokenTargetMintValue()).to.be.bignumber.equal('3')
        expect(await gasTokenContract.allowance(owner, foreignBridge.address)).to.be.bignumber.equal('10')

        await foreignBridge.collectGasTokens().should.be.fulfilled

        expect(await gasTokenContract.balanceOf(receiver)).to.be.bignumber.equal('3')
        expect(await foreignBridge.gasTokenTargetMintValue()).to.be.bignumber.equal('3')
        expect(await gasTokenContract.allowance(owner, foreignBridge.address)).to.be.bignumber.equal('7')
      })

      it('should do nothing on zero target', async () => {
        await foreignBridge.setGasTokenTargetMintValue(0)

        expect(await gasTokenContract.balanceOf(receiver)).to.be.bignumber.equal(ZERO)
        expect(await foreignBridge.gasTokenTargetMintValue()).to.be.bignumber.equal(ZERO)

        await foreignBridge.collectGasTokens().should.be.fulfilled

        expect(await gasTokenContract.balanceOf(receiver)).to.be.bignumber.equal(ZERO)
        expect(await foreignBridge.gasTokenTargetMintValue()).to.be.bignumber.equal(ZERO)
      })

      it('should do nothing on empty receiver address', async () => {
        await foreignBridge.setGasTokenReceiver(ZERO_ADDRESS)

        expect(await gasTokenContract.balanceOf(receiver)).to.be.bignumber.equal(ZERO)
        expect(await foreignBridge.gasTokenReceiver()).to.be.equal(ZERO_ADDRESS)

        await foreignBridge.collectGasTokens().should.be.fulfilled

        expect(await gasTokenContract.balanceOf(receiver)).to.be.bignumber.equal(ZERO)
        expect(await foreignBridge.gasTokenReceiver()).to.be.equal(ZERO_ADDRESS)
      })

      it('should call onTokenTransfer', async () => {
        const receiver = await ERC677ReceiverTest.new()

        expect(await gasTokenContract.balanceOf(receiver.address)).to.be.bignumber.equal(ZERO)

        await foreignBridge.setGasTokenReceiver(receiver.address)
        await foreignBridge.collectGasTokens().should.be.fulfilled

        expect(await gasTokenContract.balanceOf(receiver.address)).to.be.bignumber.equal('3')
        expect(await receiver.from()).to.be.equal(foreignBridge.address)
        expect(await receiver.value()).to.be.bignumber.equal('3')
        expect(await receiver.data()).to.be.equal(null)
      })
    })

    describe('requireToPassMessage with gas token', () => {
      let setValueData
      let box
      const user = accounts[8]

      beforeEach(async () => {
        box = await Box.new()
        // Generate data for method we want to call on Box contract
        setValueData = await box.contract.methods.setValue(3).encodeABI()

        await foreignBridge.setGasTokenParameters(5, receiver)
        await gasTokenContract.freeUpTo('100', { from: receiver })
      })

      it('should mint gas tokens on Subsidized mode', async () => {
        // Use these calls to simulate home bridge on Home network
        await foreignBridge.requireToPassMessage(box.address, setValueData, 1221254, {
          from: user
        }).should.be.fulfilled

        expect(await gasTokenContract.balanceOf(receiver)).to.be.bignumber.equal('5')
      })

      it('should spend partial allowance and mint tokens on Subsidized mode', async () => {
        await gasTokenContract.mint(3, { from: user })
        await gasTokenContract.approve(foreignBridge.address, 3, { from: user })
        // Use these calls to simulate home bridge on Home network
        await foreignBridge.requireToPassMessage(box.address, setValueData, 1221254, {
          from: user
        }).should.be.fulfilled

        expect(await gasTokenContract.balanceOf(user)).to.be.bignumber.equal(ZERO)
        expect(await gasTokenContract.balanceOf(receiver)).to.be.bignumber.equal('5')
      })

      it('should spend full allowance on Subsidized mode', async () => {
        await gasTokenContract.mint(5, { from: user })
        await gasTokenContract.approve(foreignBridge.address, 5, { from: user })
        // Use these calls to simulate home bridge on Home network
        await foreignBridge.requireToPassMessage(box.address, setValueData, 1221254, {
          from: user
        }).should.be.fulfilled

        expect(await gasTokenContract.balanceOf(user)).to.be.bignumber.equal(ZERO)
        expect(await gasTokenContract.balanceOf(receiver)).to.be.bignumber.equal('5')
      })

      it('should spend partial allowance on Subsidized mode', async () => {
        await gasTokenContract.mint(7, { from: user })
        await gasTokenContract.approve(foreignBridge.address, 7, { from: user })
        // Use these calls to simulate home bridge on Home network
        await foreignBridge.requireToPassMessage(box.address, setValueData, 1221254, {
          from: user
        }).should.be.fulfilled

        expect(await gasTokenContract.balanceOf(user)).to.be.bignumber.equal('2')
        expect(await gasTokenContract.balanceOf(receiver)).to.be.bignumber.equal('5')
      })
    })
  })
  describe('setChainIds', async () => {
    let foreignContract
    const srcChainIdLengthStorageKey = web3.utils.soliditySha3(
      '0xe504ae1fd6471eea80f18b8532a61a9bb91fba4f5b837f80a1cfb6752350af44' +
        '0000000000000000000000000000000000000000000000000000000000000000'
    )
    const dstChainIdLengthStorageKey = web3.utils.soliditySha3(
      '0xfb792ae4ad11102b93f26a51b3749c2b3667f8b561566a4806d4989692811594' +
        '0000000000000000000000000000000000000000000000000000000000000000'
    )
    beforeEach(async () => {
      foreignContract = await ForeignBridge.new()
      await foreignContract.initialize(
        FOREIGN_CHAIN_ID_HEX,
        HOME_CHAIN_ID_HEX,
        validatorContract.address,
        oneEther,
        gasPrice,
        requiredBlockConfirmations,
        owner
      ).should.be.fulfilled
    })

    it('should allow to set chain id', async () => {
      expect(await foreignContract.sourceChainId()).to.be.bignumber.equal(FOREIGN_CHAIN_ID.toString())
      expect(await web3.eth.getStorageAt(foreignContract.address, srcChainIdLengthStorageKey)).to.be.equal('0x04')
      expect(await foreignContract.destinationChainId()).to.be.bignumber.equal(HOME_CHAIN_ID.toString())
      expect(await web3.eth.getStorageAt(foreignContract.address, dstChainIdLengthStorageKey)).to.be.equal('0x02')

      const newSrcChainId = '0x11000000000000'
      const newDstChainId = '0x22000000000000000000000000'
      await foreignContract.setChainIds(newSrcChainId, newDstChainId, { from: owner }).should.be.fulfilled

      expect((await foreignContract.sourceChainId()).toString(16)).to.be.equal(newSrcChainId.slice(2))
      expect(await web3.eth.getStorageAt(foreignContract.address, srcChainIdLengthStorageKey)).to.be.equal('0x07')
      expect((await foreignContract.destinationChainId()).toString(16)).to.be.equal(newDstChainId.slice(2))
      expect(await web3.eth.getStorageAt(foreignContract.address, dstChainIdLengthStorageKey)).to.be.equal('0x0d')
    })

    it('should not allow to set invalid chain ids', async () => {
      await foreignContract.setChainIds('0x00', '0x01', { from: owner }).should.be.rejected
      await foreignContract.setChainIds('0x1122', '0x00', { from: owner }).should.be.rejected
      await foreignContract.setChainIds('0x01', '0x01', { from: owner }).should.be.rejected
      await foreignContract.setChainIds('0x1122', '0x1122', { from: owner }).should.be.rejected
    })

    it('should not allow to set chain id if not an owner', async () => {
      await foreignContract.setChainIds('0x112233', '0x4455', { from: accounts[1] }).should.be.rejected
    })
  })
})
