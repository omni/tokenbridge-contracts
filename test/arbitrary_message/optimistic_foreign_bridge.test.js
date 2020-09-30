const BridgeValidators = artifacts.require('BridgeValidators.sol')
const POSValidatorSet = artifacts.require('POSValidatorSet.sol')
const OptimisticForeignAMB = artifacts.require('OptimisticForeignAMB.sol')
const OptimisticHomeAMB = artifacts.require('OptimisticHomeAMB.sol')
const Box = artifacts.require('Box')

const { expect } = require('chai')
const { ether, expectEventInLogs, createFullAccounts, merkleRoot, generateMerkleProof } = require('../helpers/helpers')
const { toBN, ZERO_ADDRESS } = require('../setup')

const ZERO = toBN(0)
const newValidatorsRoot = '0x1122334455667788112233445566778811223344556677881122334455667788'
const requiredBlockConfirmations = 8
const gasPrice = web3.utils.toWei('1', 'gwei')
const HOME_CHAIN_ID = 1337
const HOME_CHAIN_ID_HEX = `0x${HOME_CHAIN_ID.toString(16).padStart(4, '0')}`
const FOREIGN_CHAIN_ID = 1234567890
const FOREIGN_CHAIN_ID_HEX = `0x${FOREIGN_CHAIN_ID.toString(16).padStart(8, '0')}`

contract('OptimisticForeignAMB', async accounts => {
  const owner = accounts[0]
  const user = accounts[1]
  let validatorContract
  let posValidatorSet
  let validatorsRoot
  let validators
  let foreignBridge
  let authorities
  let box
  let homeBridge

  before(async () => {
    validators = createFullAccounts(web3, 19).sort((a, b) => a.address.toLowerCase() > b.address.toLowerCase())
    for (let i = 0; i < validators.length; i++) {
      web3.eth.accounts.wallet.add(validators[i])
      await web3.eth.sendTransaction({
        from: owner,
        to: validators[i].address,
        value: ether('1')
      })
    }
    validatorsRoot = merkleRoot(validators)

    validatorContract = await BridgeValidators.new()
    authorities = [accounts[1], accounts[2]]
    await validatorContract.initialize(1, authorities, owner)

    homeBridge = await OptimisticHomeAMB.new()
    await homeBridge.initialize(
      HOME_CHAIN_ID_HEX,
      FOREIGN_CHAIN_ID_HEX,
      validatorContract.address,
      ether('1'),
      gasPrice,
      requiredBlockConfirmations,
      owner
    ).should.be.fulfilled
  })

  beforeEach(async () => {
    posValidatorSet = await POSValidatorSet.new()
    await posValidatorSet.initialize(validatorsRoot, 3, 100, owner).should.be.fulfilled

    foreignBridge = await OptimisticForeignAMB.new()

    box = await Box.new()
  })

  describe('initialize', () => {
    it('should initialize bridge with valid parameters', async () => {
      await foreignBridge.initialize(
        FOREIGN_CHAIN_ID_HEX,
        HOME_CHAIN_ID_HEX,
        validatorContract.address,
        ether('1'),
        gasPrice,
        requiredBlockConfirmations,
        owner,
        posValidatorSet.address,
        ether('1')
      ).should.be.fulfilled

      expect(await foreignBridge.deployedAtBlock()).to.be.bignumber.above(ZERO)
      expect(await foreignBridge.validatorContract()).to.be.equal(validatorContract.address)
      expect(await foreignBridge.maxGasPerTx()).to.be.bignumber.equal(ether('1'))
      expect(await foreignBridge.gasPrice()).to.be.bignumber.equal(gasPrice)
      expect(await foreignBridge.requiredBlockConfirmations()).to.be.bignumber.equal(toBN(requiredBlockConfirmations))
      expect(await foreignBridge.owner()).to.be.equal(owner)
      expect(await foreignBridge.posValidatorSetContract()).to.be.equal(posValidatorSet.address)
      expect(await foreignBridge.minimalBondForOptimisticExecution()).to.be.bignumber.equal(ether('1'))
      expect(await foreignBridge.isOptimisticBridgeEnabled()).to.be.equal(true)
      expect(await foreignBridge.isInitialized()).to.be.equal(true)
    })

    it('should not allow invalid parameters', async () => {
      await foreignBridge.initialize(
        FOREIGN_CHAIN_ID_HEX,
        HOME_CHAIN_ID_HEX,
        validatorContract.address,
        ether('1'),
        gasPrice,
        requiredBlockConfirmations,
        owner,
        ZERO_ADDRESS,
        ether('1')
      ).should.be.rejected
    })
  })

  describe('set params', () => {
    beforeEach(async () => {
      await foreignBridge.initialize(
        FOREIGN_CHAIN_ID_HEX,
        HOME_CHAIN_ID_HEX,
        validatorContract.address,
        ether('1'),
        gasPrice,
        requiredBlockConfirmations,
        owner,
        posValidatorSet.address,
        ether('1')
      ).should.be.fulfilled
    })

    it('should update minimal bond for optimistic execution', async () => {
      await foreignBridge.setMinimalBondForOptimisticExecution(ether('2'), { from: user }).should.be.rejected
      const { logs } = await foreignBridge.setMinimalBondForOptimisticExecution(ether('2'), { from: owner }).should.be
        .fulfilled

      expect(await foreignBridge.minimalBondForOptimisticExecution()).to.be.bignumber.equal(ether('2'))
      expectEventInLogs(logs, 'MinimalBondForOptimisticExecutionUpdated')
    })

    it('should update pos validator set contract', async () => {
      await foreignBridge.setPosValidatorSetContract(validatorContract.address, { from: user }).should.be.rejected
      const { logs } = await foreignBridge.setPosValidatorSetContract(validatorContract.address, { from: owner }).should
        .be.fulfilled

      expect(await foreignBridge.posValidatorSetContract()).to.be.equal(validatorContract.address)
      expectEventInLogs(logs, 'ValidatorSetContractUpdated')
    })

    it('should disable/enable optimistic bridge', async () => {
      await foreignBridge.emergencyShutdownOptimisticBridge(true, { from: user }).should.be.rejected
      const { logs } = await foreignBridge.emergencyShutdownOptimisticBridge(true, { from: owner }).should.be.fulfilled

      expect(await foreignBridge.isOptimisticBridgeEnabled()).to.be.equal(false)
      expectEventInLogs(logs, 'OptimisticBridgeShutdowned')

      await foreignBridge.emergencyShutdownOptimisticBridge(false, { from: user }).should.be.rejected
      const { logs: logs2 } = await foreignBridge.emergencyShutdownOptimisticBridge(false, { from: owner }).should.be
        .fulfilled

      expect(await foreignBridge.isOptimisticBridgeEnabled()).to.be.equal(true)
      expectEventInLogs(logs2, 'OptimisticBridgeShutdowned')
    })
  })

  describe('requestToExecuteMessage', () => {
    beforeEach(async () => {
      await foreignBridge.initialize(
        FOREIGN_CHAIN_ID_HEX,
        HOME_CHAIN_ID_HEX,
        validatorContract.address,
        ether('1'),
        gasPrice,
        requiredBlockConfirmations,
        owner,
        posValidatorSet.address,
        ether('1')
      ).should.be.fulfilled
    })

    it('should accept valid message', async () => {
      const setValueData = await box.contract.methods.setValue(3).encodeABI()
      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, setValueData, 100000, {
        from: user
      })

      const { messageId, encodedData: message } = resultPassMessageTx.logs[0].args

      await foreignBridge.requestToExecuteMessage(message, { from: user, value: ether('0.9') }).should.be.rejected
      const { logs } = await foreignBridge.requestToExecuteMessage(message, { from: user, value: ether('1') }).should.be
        .fulfilled
      await foreignBridge.requestToExecuteMessage(message, { from: user, value: ether('1') }).should.be.rejected

      expect(await foreignBridge.optimisticMessageRejectsCount(messageId)).to.be.bignumber.equal('0')
      expect(await foreignBridge.optimisticMessageSubmissionTime(messageId)).to.be.bignumber.gt('0')
      expect(await foreignBridge.optimisticMessageExecutionTime(messageId)).to.be.bignumber.gt('0')
      expect(await foreignBridge.optimisticMessageSender(messageId)).to.be.equal(user)
      expect(await foreignBridge.optimisticMessageData(messageId)).to.be.equal(message)

      expectEventInLogs(logs, 'OptimisticMessageSubmitted', {
        messageId,
        messageHash: web3.utils.soliditySha3(message)
      })
    })

    it('should not accept invalid message', async () => {
      const setValueData = await box.contract.methods.setValue(3).encodeABI()
      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, setValueData, 100000, {
        from: user
      })

      const message = resultPassMessageTx.logs[0].args.encodedData
      const invalidMessage1 = `0x00000000${message.substr(10)}`
      const foreignTx = await foreignBridge.requireToPassMessage(box.address, setValueData, 100000, {
        from: user
      })
      const invalidMessage2 = foreignTx.logs[0].args.encodedData

      await foreignBridge.requestToExecuteMessage(invalidMessage1, { from: user, value: ether('1') }).should.be.rejected
      await foreignBridge.requestToExecuteMessage(invalidMessage2, { from: user, value: ether('1') }).should.be.rejected

      await foreignBridge.emergencyShutdownOptimisticBridge(true, { from: owner }).should.be.fulfilled

      await foreignBridge.requestToExecuteMessage(message, { from: user, value: ether('1') }).should.be.rejected

      await foreignBridge.emergencyShutdownOptimisticBridge(false, { from: owner }).should.be.fulfilled

      await foreignBridge.requestToExecuteMessage(message, { from: user, value: ether('1') }).should.be.fulfilled
    })

    it('should also update validator set', async () => {
      const setValueData = await box.contract.methods.setValue(3).encodeABI()
      const resultPassMessageTx = await homeBridge.requireToPassMessage(box.address, setValueData, 100000, {
        from: user
      })

      const { messageId, encodedData: message } = resultPassMessageTx.logs[0].args

      let signatures = '0x'
      const validatorsMessage = web3.eth.abi.encodeParameters(
        ['bytes32', 'uint256', 'uint256'],
        [newValidatorsRoot, 2, 200]
      )
      for (let i = 0; i < 19; i++) {
        if (i < 3) {
          const { v, r, s } = await validators[i].sign(validatorsMessage)
          signatures += v.substr(2) + r.substr(2) + s.substr(2)
        } else {
          signatures += `00${validators[i].address.substr(2)}`
        }
      }

      const { logs } = await foreignBridge.requestToExecuteMessageWithValidatorSet(
        message,
        newValidatorsRoot,
        2,
        200,
        signatures,
        { from: user, value: ether('1') }
      ).should.be.fulfilled

      expect(await foreignBridge.optimisticMessageRejectsCount(messageId)).to.be.bignumber.equal('0')
      expect(await foreignBridge.optimisticMessageSubmissionTime(messageId)).to.be.bignumber.gt('0')
      expect(await foreignBridge.optimisticMessageExecutionTime(messageId)).to.be.bignumber.gt('0')
      expect(await foreignBridge.optimisticMessageSender(messageId)).to.be.equal(user)
      expect(await foreignBridge.optimisticMessageData(messageId)).to.be.equal(message)
      expect(await posValidatorSet.validatorsRoot()).to.be.equal(newValidatorsRoot)

      expectEventInLogs(logs, 'OptimisticMessageSubmitted', {
        messageId,
        messageHash: web3.utils.soliditySha3(message)
      })
    })
  })
})
