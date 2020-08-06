const ForeignAMBENSMirror = artifacts.require('ForeignAMBENSMirror.sol')
const HomeAMBENSMirror = artifacts.require('HomeAMBENSMirror.sol')
const AMBMock = artifacts.require('AMBMock.sol')
const ENSMock = artifacts.require('ENSMock.sol')
const truffleContract = require('@truffle/contract')
const PublicResolver = truffleContract(require('@ensdomains/resolver/build/contracts/PublicResolver.json'))

const { expect } = require('chai')
const { ether, strip0x } = require('../helpers/helpers')
const { ZERO_ADDRESS, toBN } = require('../setup')

const ZERO = toBN(0)
const maxGasPerTx = ether('1')

const namehash = '0xe2a7126166fa5a6bef227712b773ab8ff63540a3b062b25629c2c4ad856e2293'
const exampleMessageId = '0xf308b922ab9f8a7128d9d7bc9bce22cd88b2c05c8213f0e2d8104d78e0a9ecbb'

contract('HomeAMBENSMirror', async accounts => {
  let contract
  let ambBridgeContract
  let otherSideAMBBridgeContract
  let otherSideMediator
  let ens
  let resolver
  let otherSideResolver
  const owner = accounts[0]
  const user = accounts[1]
  const user2 = accounts[2]
  beforeEach(async () => {
    contract = await HomeAMBENSMirror.new()
    ambBridgeContract = await AMBMock.new()
    await ambBridgeContract.setMaxGasPerTx(maxGasPerTx)
    otherSideAMBBridgeContract = await AMBMock.new()
    await otherSideAMBBridgeContract.setMaxGasPerTx(maxGasPerTx)
    otherSideMediator = await ForeignAMBENSMirror.new()
    ens = await ENSMock.new()
    PublicResolver.setProvider(web3.currentProvider)
    PublicResolver.defaults({ from: owner })
    resolver = await PublicResolver.new(contract.address)
    otherSideResolver = await PublicResolver.new(ens.address)
    await otherSideMediator.initialize(
      otherSideAMBBridgeContract.address,
      contract.address,
      maxGasPerTx,
      owner,
      ens.address
    )
  })

  async function bridgeENSNode(namehash) {
    const { receipt } = await otherSideMediator.bridgeENSNode(namehash).should.be.fulfilled
    const encodedData = strip0x(
      web3.eth.abi.decodeParameters(
        ['bytes'],
        receipt.rawLogs.find(log => log.address === otherSideAMBBridgeContract.address).data
      )[0]
    )
    const data = `0x${encodedData.slice(2 * (4 + 20 + 8 + 20 + 20 + 4 + 1 + 1 + 1 + 2 + 2))}` // remove AMB header
    const res = await ambBridgeContract.executeMessageCall(
      contract.address,
      otherSideMediator.address,
      data,
      exampleMessageId,
      2000000
    ).should.be.fulfilled

    expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)
    return res
  }

  describe('initialize', () => {
    it('should initialize parameters', async () => {
      // Given
      expect(await contract.isInitialized()).to.be.equal(false)
      expect(await contract.bridgeContract()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.mediatorContractOnOtherSide()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.owner()).to.be.equal(ZERO_ADDRESS)

      // When
      // not valid bridge address
      await contract.initialize(ZERO_ADDRESS, otherSideMediator.address, owner, resolver.address).should.be.rejected

      // not valid owner
      await contract.initialize(ambBridgeContract.address, otherSideMediator.address, ZERO_ADDRESS, resolver.address)
        .should.be.rejected

      // not valid ens registry
      await contract.initialize(ambBridgeContract.address, otherSideMediator.address, owner, owner).should.be.rejected

      await contract.initialize(ambBridgeContract.address, otherSideMediator.address, owner, resolver.address).should.be
        .fulfilled

      // already initialized
      await contract.initialize(ambBridgeContract.address, otherSideMediator.address, owner, resolver.address).should.be
        .rejected

      // Then
      expect(await contract.isInitialized()).to.be.equal(true)
      expect(await contract.bridgeContract()).to.be.equal(ambBridgeContract.address)
      expect(await contract.mediatorContractOnOtherSide()).to.be.equal(otherSideMediator.address)
      expect(await contract.owner()).to.be.equal(owner)
    })
  })

  describe('getBridgeMode', () => {
    it('should return mediator mode and interface', async function() {
      const bridgeModeHash = '0xa10d4bc8' // 4 bytes of keccak256('ens-mirror-amb')
      expect(await contract.getBridgeMode()).to.be.equal(bridgeModeHash)

      const { major, minor, patch } = await contract.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(ZERO)
      minor.should.be.bignumber.gte(ZERO)
      patch.should.be.bignumber.gte(ZERO)
    })
  })

  describe('updateENSNode', () => {
    beforeEach(async () => {
      await contract.initialize(ambBridgeContract.address, otherSideMediator.address, owner, resolver.address).should.be
        .fulfilled
    })

    it('should bridge a new record', async () => {
      await ens.setRecord(namehash, user, otherSideResolver.address, 100).should.be.fulfilled
      await otherSideResolver.methods['setAddr(bytes32,address)'](namehash, user2, { from: user }).should.be.fulfilled

      const { receipt } = await bridgeENSNode(namehash)

      expect(await contract.recordExists(namehash)).to.be.equal(true)
      expect(await contract.owner(namehash)).to.be.equal(user)
      expect(await contract.resolver(namehash)).to.be.equal(resolver.address)
      expect(await resolver.addr(namehash)).to.be.equal(user2)
      expect(await contract.ttl(namehash)).to.be.bignumber.equal('100')

      const log = receipt.rawLogs.find(
        log => log.topics[0] === '0x83ced268742277db095b8ecd5e26e9debf1cf75808df747d282285a5abfaac11'
      )
      expect(log.topics[1]).to.be.equal(namehash)
      expect(log.data.includes(strip0x(user).toLowerCase())).to.be.equal(true)
    })

    it('should update existing record', async () => {
      await ens.setRecord(namehash, user, otherSideResolver.address, 100).should.be.fulfilled
      await otherSideResolver.methods['setAddr(bytes32,address)'](namehash, user2, { from: user }).should.be.fulfilled

      await bridgeENSNode(namehash)

      expect(await contract.recordExists(namehash)).to.be.equal(true)
      expect(await contract.owner(namehash)).to.be.equal(user)
      expect(await contract.resolver(namehash)).to.be.equal(resolver.address)
      expect(await resolver.addr(namehash)).to.be.equal(user2)
      expect(await contract.ttl(namehash)).to.be.bignumber.equal('100')

      await ens.setOwner(namehash, owner).should.be.fulfilled
      await ens.setTTL(namehash, 200).should.be.fulfilled
      await otherSideResolver.methods['setAddr(bytes32,address)'](namehash, user, { from: owner }).should.be.fulfilled

      const { receipt } = await bridgeENSNode(namehash)

      expect(await contract.recordExists(namehash)).to.be.equal(true)
      expect(await contract.owner(namehash)).to.be.equal(owner)
      expect(await contract.resolver(namehash)).to.be.equal(resolver.address)
      expect(await resolver.addr(namehash)).to.be.equal(user2)
      expect(await contract.ttl(namehash)).to.be.bignumber.equal('100')

      const log = receipt.rawLogs.find(
        log => log.topics[0] === '0x83ced268742277db095b8ecd5e26e9debf1cf75808df747d282285a5abfaac11'
      )
      expect(log.topics[1]).to.be.equal(namehash)
      expect(log.data.includes(strip0x(owner).toLowerCase())).to.be.equal(true)
    })

    it('should allow to be called only by the mediator', async () => {
      await contract.updateENSNode(namehash, user, user2, 100).should.be.rejected
      await ens.setRecord(namehash, user, otherSideResolver.address, 100).should.be.fulfilled
      const { receipt } = await otherSideMediator.bridgeENSNode(namehash).should.be.fulfilled
      const encodedData = strip0x(
        web3.eth.abi.decodeParameters(
          ['bytes'],
          receipt.rawLogs.find(log => log.address === otherSideAMBBridgeContract.address).data
        )[0]
      )
      const data = `0x${encodedData.slice(2 * (4 + 20 + 8 + 20 + 20 + 4 + 1 + 1 + 1 + 2 + 2))}` // remove AMB header
      await ambBridgeContract.executeMessageCall(contract.address, resolver.address, data, exampleMessageId, 2000000)
        .should.be.fulfilled

      expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(false)
    })
  })

  describe('ENSBridgeRegistry', () => {
    beforeEach(async () => {
      await contract.initialize(ambBridgeContract.address, otherSideMediator.address, owner, resolver.address).should.be
        .fulfilled
    })

    it('should return correct values for unknown node', async () => {
      expect(await contract.owner(namehash)).to.be.equal(ZERO_ADDRESS)
      expect(await contract.resolver(namehash)).to.be.equal(ZERO_ADDRESS)
      expect(await contract.ttl(namehash)).to.be.bignumber.equal('0')
    })

    it('should allow to change resolver', async () => {
      await ens.setRecord(namehash, user, otherSideResolver.address, 100).should.be.fulfilled
      await bridgeENSNode(namehash)

      expect(await contract.resolver(namehash)).to.be.equal(resolver.address)

      await contract.setResolver(namehash, otherSideResolver.address, { from: user2 }).should.be.rejected
      await contract.setResolver(namehash, otherSideResolver.address, { from: owner }).should.be.rejected
      await contract.setResolver(namehash, owner, { from: user }).should.be.rejected
      await contract.setResolver(namehash, otherSideResolver.address, { from: user }).should.be.fulfilled

      expect(await contract.resolver(namehash)).to.be.equal(otherSideResolver.address)

      await contract.setResolver(namehash, ZERO_ADDRESS, { from: user }).should.be.fulfilled

      expect(await contract.resolver(namehash)).to.be.equal(ZERO_ADDRESS)
    })

    it('should allow to change ttl', async () => {
      await ens.setRecord(namehash, user, otherSideResolver.address, 100).should.be.fulfilled
      await bridgeENSNode(namehash)

      expect(await contract.ttl(namehash)).to.be.bignumber.equal('100')

      await contract.setTTL(namehash, '200', { from: user2 }).should.be.rejected
      await contract.setTTL(namehash, '200', { from: owner }).should.be.rejected
      await contract.setTTL(namehash, '200', { from: user }).should.be.fulfilled

      expect(await contract.ttl(namehash)).to.be.bignumber.equal('200')
    })

    it('should allow to set operator', async () => {
      expect(await contract.isApprovedForAll(owner, user)).to.be.equal(false)
      expect(await contract.isApprovedForAll(owner, user2)).to.be.equal(false)

      await contract.setApprovalForAll(user, true).should.be.fulfilled

      expect(await contract.isApprovedForAll(owner, user)).to.be.equal(true)
      expect(await contract.isApprovedForAll(owner, user2)).to.be.equal(false)

      await contract.setApprovalForAll(user2, true).should.be.fulfilled

      expect(await contract.isApprovedForAll(owner, user)).to.be.equal(true)
      expect(await contract.isApprovedForAll(owner, user2)).to.be.equal(true)

      await contract.setApprovalForAll(user, false).should.be.fulfilled

      expect(await contract.isApprovedForAll(owner, user)).to.be.equal(false)
      expect(await contract.isApprovedForAll(owner, user2)).to.be.equal(true)

      await contract.setApprovalForAll(user2, false).should.be.fulfilled

      expect(await contract.isApprovedForAll(owner, user)).to.be.equal(false)
      expect(await contract.isApprovedForAll(owner, user2)).to.be.equal(false)
    })

    it('should allow to change values by operator', async () => {
      await ens.setRecord(namehash, user, otherSideResolver.address, 100).should.be.fulfilled
      await bridgeENSNode(namehash)

      expect(await contract.resolver(namehash)).to.be.equal(resolver.address)
      expect(await contract.ttl(namehash)).to.be.bignumber.equal('100')

      await contract.setResolver(namehash, otherSideResolver.address).should.be.rejected
      await contract.setTTL(namehash, 200).should.be.rejected

      await contract.setApprovalForAll(owner, true, { from: user }).should.be.fulfilled

      await contract.setResolver(namehash, otherSideResolver.address).should.be.fulfilled
      await contract.setTTL(namehash, 200).should.be.fulfilled

      expect(await contract.resolver(namehash)).to.be.equal(otherSideResolver.address)
      expect(await contract.ttl(namehash)).to.be.bignumber.equal('200')
    })
  })
})
