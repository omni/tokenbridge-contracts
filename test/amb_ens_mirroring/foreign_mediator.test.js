const ForeignAMBENSMirror = artifacts.require('ForeignAMBENSMirror.sol')
const HomeAMBENSMirror = artifacts.require('HomeAMBENSMirror.sol')
const AMBMock = artifacts.require('AMBMock.sol')
const ENSMock = artifacts.require('ENSMock.sol')
const truffleContract = require('@truffle/contract')
const PublicResolver = truffleContract(require('@ensdomains/resolver/build/contracts/PublicResolver.json'))

const { expect } = require('chai')
const { getEvents, expectEventInLogs, ether, strip0x } = require('../helpers/helpers')
const { ZERO_ADDRESS, toBN } = require('../setup')

const ZERO = toBN(0)
const maxGasPerTx = ether('1')

const namehash = '0xe2a7126166fa5a6bef227712b773ab8ff63540a3b062b25629c2c4ad856e2293'

contract('ForeignAMBENSMirror', async accounts => {
  let contract
  let ambBridgeContract
  let otherSideMediator
  let ens
  let resolver
  const owner = accounts[0]
  const user = accounts[1]
  const user2 = accounts[2]
  beforeEach(async () => {
    contract = await ForeignAMBENSMirror.new()
    ambBridgeContract = await AMBMock.new()
    await ambBridgeContract.setMaxGasPerTx(maxGasPerTx)
    otherSideMediator = await HomeAMBENSMirror.new()
    ens = await ENSMock.new()
    PublicResolver.setProvider(web3.currentProvider)
    PublicResolver.defaults({ from: owner })
    resolver = await PublicResolver.new(ens.address)
  })

  describe('initialize', () => {
    it('should initialize parameters', async () => {
      // Given
      expect(await contract.isInitialized()).to.be.equal(false)
      expect(await contract.bridgeContract()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.mediatorContractOnOtherSide()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.requestGasLimit()).to.be.bignumber.equal(ZERO)
      expect(await contract.owner()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.ensRegistry()).to.be.equal(ZERO_ADDRESS)

      // When
      // not valid bridge address
      await contract.initialize(ZERO_ADDRESS, otherSideMediator.address, maxGasPerTx, owner, ens.address).should.be
        .rejected

      // maxGasPerTx > bridge maxGasPerTx
      await contract.initialize(ambBridgeContract.address, otherSideMediator.address, ether('2'), owner, ens.address)
        .should.be.rejected

      // not valid owner
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        maxGasPerTx,
        ZERO_ADDRESS,
        ens.address
      ).should.be.rejected

      // not valid ens registry
      await contract.initialize(ambBridgeContract.address, otherSideMediator.address, maxGasPerTx, owner, owner).should
        .be.rejected

      await contract.initialize(ambBridgeContract.address, otherSideMediator.address, maxGasPerTx, owner, ens.address)
        .should.be.fulfilled

      // already initialized
      await contract.initialize(ambBridgeContract.address, otherSideMediator.address, maxGasPerTx, owner, ens.address)
        .should.be.rejected

      // Then
      expect(await contract.isInitialized()).to.be.equal(true)
      expect(await contract.bridgeContract()).to.be.equal(ambBridgeContract.address)
      expect(await contract.mediatorContractOnOtherSide()).to.be.equal(otherSideMediator.address)
      expect(await contract.requestGasLimit()).to.be.bignumber.equal(maxGasPerTx)
      expect(await contract.owner()).to.be.equal(owner)
      expect(await contract.ensRegistry()).to.be.equal(ens.address)
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

  describe('bridgeENSNode', () => {
    beforeEach(async () => {
      await contract.initialize(ambBridgeContract.address, otherSideMediator.address, maxGasPerTx, owner, ens.address)
        .should.be.fulfilled
    })

    it('should make a bridge request for existing record', async () => {
      await ens.setRecord(namehash, user, resolver.address, 100).should.be.fulfilled
      await resolver.methods['setAddr(bytes32,address)'](namehash, user2, { from: user }).should.be.fulfilled

      expect(await ens.owner(namehash)).to.be.equal(user)
      expect(await ens.resolver(namehash)).to.be.equal(resolver.address)
      expect(await resolver.addr(namehash)).to.be.equal(user2)
      expect(await ens.ttl(namehash)).to.be.bignumber.equal('100')

      const { logs } = await contract.bridgeENSNode(namehash).should.be.fulfilled
      const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      const encodedData = strip0x(events[0].returnValues.encodedData)
      const calldata = encodedData.slice(2 * (4 + 20 + 8 + 20 + 20 + 4 + 1 + 1 + 1 + 2 + 2)) // remove AMB header
      expect(calldata.slice(0, 8)).to.be.equal('e2a8b775')
      const args = web3.eth.abi.decodeParameters(['bytes32', 'address', 'address', 'uint64'], calldata.slice(8))
      expect(args[0]).to.be.equal(namehash)
      expect(args[1]).to.be.equal(user)
      expect(args[2]).to.be.equal(user2)
      expect(args[3]).to.be.equal('100')

      expectEventInLogs(logs, 'BridgeENSNode', { node: namehash, owner: user })
    })

    it('should not make a bridge request for unknown record', async () => {
      await contract.bridgeENSNode(namehash).should.be.rejected
    })

    it('should make a bridge request for existing record without address', async () => {
      await ens.setRecord(namehash, user, resolver.address, 0).should.be.fulfilled

      expect(await ens.owner(namehash)).to.be.equal(user)
      expect(await ens.resolver(namehash)).to.be.equal(resolver.address)
      expect(await resolver.addr(namehash)).to.be.equal(ZERO_ADDRESS)
      expect(await ens.ttl(namehash)).to.be.bignumber.equal('0')

      const { logs } = await contract.bridgeENSNode(namehash).should.be.fulfilled
      const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      const encodedData = strip0x(events[0].returnValues.encodedData)
      const calldata = encodedData.slice(2 * (4 + 20 + 8 + 20 + 20 + 4 + 1 + 1 + 1 + 2 + 2)) // remove AMB header
      expect(calldata.slice(0, 8)).to.be.equal('e2a8b775')
      const args = web3.eth.abi.decodeParameters(['bytes32', 'address', 'address', 'uint64'], calldata.slice(8))
      expect(args[0]).to.be.equal(namehash)
      expect(args[1]).to.be.equal(user)
      expect(args[2]).to.be.equal(ZERO_ADDRESS)
      expect(args[3]).to.be.equal('0')

      expectEventInLogs(logs, 'BridgeENSNode', { node: namehash, owner: user })
    })

    it('should make a bridge request for existing record without resolver', async () => {
      await ens.setOwner(namehash, user).should.be.fulfilled

      expect(await ens.owner(namehash)).to.be.equal(user)
      expect(await ens.resolver(namehash)).to.be.equal(ZERO_ADDRESS)
      expect(await ens.ttl(namehash)).to.be.bignumber.equal('0')

      const { logs } = await contract.bridgeENSNode(namehash).should.be.fulfilled
      const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)
      const encodedData = strip0x(events[0].returnValues.encodedData)
      const calldata = encodedData.slice(2 * (4 + 20 + 8 + 20 + 20 + 4 + 1 + 1 + 1 + 2 + 2)) // remove AMB header
      expect(calldata.slice(0, 8)).to.be.equal('e2a8b775')
      const args = web3.eth.abi.decodeParameters(['bytes32', 'address', 'address', 'uint64'], calldata.slice(8))
      expect(args[0]).to.be.equal(namehash)
      expect(args[1]).to.be.equal(user)
      expect(args[2]).to.be.equal(ZERO_ADDRESS)
      expect(args[3]).to.be.equal('0')

      expectEventInLogs(logs, 'BridgeENSNode', { node: namehash, owner: user })
    })
  })
})
