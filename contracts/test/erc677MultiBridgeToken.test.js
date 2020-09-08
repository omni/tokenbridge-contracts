const ERC677MultiBridgeToken = artifacts.require('ERC677MultiBridgeToken.sol')
const StubContract = artifacts.require('RevertFallback.sol')

const { expect } = require('chai')
const { ERROR_MSG, ZERO_ADDRESS, F_ADDRESS, BN } = require('./setup')
const { expectEventInLogs } = require('./helpers/helpers')

const MAX_BRIDGES = 50
const ZERO = new BN(0)

contract('ERC677MultiBridgeToken', async accounts => {
  let token
  const owner = accounts[0]
  const contracts = []

  before(async () => {
    for (let i = 0; i < MAX_BRIDGES + 1; i++) {
      contracts.push((await StubContract.new()).address)
    }
  })

  beforeEach(async () => {
    token = await ERC677MultiBridgeToken.new('Test token', 'TEST', 18, 100)
  })

  describe('constructor', async () => {
    it('should initialize contract', async () => {
      expect(await token.symbol()).to.be.equal('TEST')
      expect(await token.decimals()).to.be.bignumber.equal('18')
      expect(await token.name()).to.be.equal('Test token')
      expect(await token.totalSupply()).to.be.bignumber.equal(ZERO)
      expect(await token.bridgeCount()).to.be.bignumber.equal(ZERO)
    })
  })

  describe('#addBridge', async () => {
    it('should add one bridge', async () => {
      expect(await token.isBridge(contracts[0])).to.be.equal(false)
      expect(await token.bridgeCount()).to.be.bignumber.equal('0')
      const { logs } = await token.addBridge(contracts[0], { from: owner }).should.be.fulfilled
      expect(await token.isBridge(contracts[0])).to.be.equal(true)
      expect(await token.bridgeCount()).to.be.bignumber.equal('1')
      expectEventInLogs(logs, 'BridgeAdded', { bridge: contracts[0] })
    })

    it('should add two bridges', async () => {
      expect(await token.isBridge(contracts[0])).to.be.equal(false)
      expect(await token.isBridge(contracts[1])).to.be.equal(false)
      expect(await token.bridgeCount()).to.be.bignumber.equal('0')
      false.should.be.equal(await token.isBridge(contracts[0]))
      await token.addBridge(contracts[0], { from: owner }).should.be.fulfilled
      await token.addBridge(contracts[1], { from: owner }).should.be.fulfilled
      expect(await token.isBridge(contracts[0])).to.be.equal(true)
      expect(await token.isBridge(contracts[1])).to.be.equal(true)
      expect(await token.bridgeCount()).to.be.bignumber.equal('2')
    })

    it('should add max allowed number of bridges', async () => {
      for (let i = 0; i < MAX_BRIDGES; i++) {
        await token.addBridge(contracts[i], { from: owner }).should.be.fulfilled
        expect(await token.isBridge(contracts[i])).to.be.equal(true)
      }
      expect(await token.bridgeCount()).to.be.bignumber.equal(MAX_BRIDGES.toString())
      await token.addBridge(contracts[MAX_BRIDGES], { from: owner }).should.be.rejected
    })

    it('should not allow to add already existing bridge', async () => {
      await token.addBridge(contracts[0], { from: owner }).should.be.fulfilled
      await token.addBridge(contracts[0], { from: owner }).should.be.rejectedWith(ERROR_MSG)
      expect(await token.bridgeCount()).to.be.bignumber.equal('1')
    })

    it('should not allow to add 0xf as bridge address', async () => {
      await token.addBridge(F_ADDRESS, { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })

    it('should not allow to add 0x0 as bridge address', async () => {
      await token.addBridge(ZERO_ADDRESS, { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })

    it('should not allow to add if not an owner', async () => {
      await token.addBridge(contracts[0], { from: accounts[2] }).should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('#removeBridge', async () => {
    it('should remove bridges one by one', async () => {
      await token.addBridge(contracts[0], { from: owner }).should.be.fulfilled
      await token.addBridge(contracts[1], { from: owner }).should.be.fulfilled
      await token.addBridge(contracts[2], { from: owner }).should.be.fulfilled
      await token.addBridge(contracts[3], { from: owner }).should.be.fulfilled
      expect(await token.bridgeCount()).to.be.bignumber.equal('4')
      expect(await token.isBridge(contracts[0])).to.be.equal(true)
      expect(await token.isBridge(contracts[1])).to.be.equal(true)
      expect(await token.isBridge(contracts[2])).to.be.equal(true)
      expect(await token.isBridge(contracts[3])).to.be.equal(true)

      const { logs } = await token.removeBridge(contracts[1], { from: owner }).should.be.fulfilled
      expect(await token.bridgeCount()).to.be.bignumber.equal('3')
      expect(await token.isBridge(contracts[0])).to.be.equal(true)
      expect(await token.isBridge(contracts[1])).to.be.equal(false)
      expect(await token.isBridge(contracts[2])).to.be.equal(true)
      expect(await token.isBridge(contracts[3])).to.be.equal(true)
      expectEventInLogs(logs, 'BridgeRemoved', { bridge: contracts[1] })

      await token.removeBridge(contracts[3], { from: owner }).should.be.fulfilled
      expect(await token.bridgeCount()).to.be.bignumber.equal('2')
      expect(await token.isBridge(contracts[0])).to.be.equal(true)
      expect(await token.isBridge(contracts[1])).to.be.equal(false)
      expect(await token.isBridge(contracts[2])).to.be.equal(true)
      expect(await token.isBridge(contracts[3])).to.be.equal(false)

      await token.removeBridge(contracts[0], { from: owner }).should.be.fulfilled
      expect(await token.bridgeCount()).to.be.bignumber.equal('1')
      expect(await token.isBridge(contracts[0])).to.be.equal(false)
      expect(await token.isBridge(contracts[1])).to.be.equal(false)
      expect(await token.isBridge(contracts[2])).to.be.equal(true)
      expect(await token.isBridge(contracts[3])).to.be.equal(false)

      await token.removeBridge(contracts[2], { from: owner }).should.be.fulfilled
      expect(await token.bridgeCount()).to.be.bignumber.equal('0')
      expect(await token.isBridge(contracts[0])).to.be.equal(false)
      expect(await token.isBridge(contracts[1])).to.be.equal(false)
      expect(await token.isBridge(contracts[2])).to.be.equal(false)
      expect(await token.isBridge(contracts[3])).to.be.equal(false)
    })

    it('should not allow to remove not existing bridge', async () => {
      await token.addBridge(contracts[0], { from: owner }).should.be.fulfilled
      await token.addBridge(contracts[1], { from: owner }).should.be.fulfilled
      expect(await token.bridgeCount()).to.be.bignumber.equal('2')
      expect(await token.isBridge(contracts[0])).to.be.equal(true)
      expect(await token.isBridge(contracts[1])).to.be.equal(true)

      await token.removeBridge(contracts[2], { from: owner }).should.be.rejectedWith(ERROR_MSG)

      await token.removeBridge(contracts[0], { from: owner }).should.be.fulfilled
      await token.removeBridge(contracts[0], { from: owner }).should.be.rejectedWith(ERROR_MSG)

      await token.removeBridge(contracts[1], { from: owner }).should.be.fulfilled
      await token.removeBridge(contracts[1], { from: owner }).should.be.rejectedWith(ERROR_MSG)

      expect(await token.bridgeCount()).to.be.bignumber.equal('0')
      expect(await token.isBridge(contracts[0])).to.be.equal(false)
      expect(await token.isBridge(contracts[1])).to.be.equal(false)
    })

    it('should not allow to remove if not an owner', async () => {
      await token.addBridge(contracts[0], { from: owner }).should.be.fulfilled
      await token.addBridge(contracts[0], { from: accounts[2] }).should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('#bridgeList', async () => {
    it('should return empty bridge list', async () => {
      expect(await token.bridgeList()).to.be.eql([])
    })

    it('should expand bridge list when adding bridges', async () => {
      expect(await token.bridgeList()).to.be.eql([])

      await token.addBridge(contracts[0], { from: owner }).should.be.fulfilled

      expect(await token.bridgeList()).to.be.eql([contracts[0]])

      await token.addBridge(contracts[1], { from: owner }).should.be.fulfilled

      expect(await token.bridgeList()).to.be.eql([contracts[1], contracts[0]])

      await token.addBridge(contracts[2], { from: owner }).should.be.fulfilled

      expect(await token.bridgeList()).to.be.eql([contracts[2], contracts[1], contracts[0]])
    })

    it('should shrink bridge list when removing bridges', async () => {
      await token.addBridge(contracts[0], { from: owner }).should.be.fulfilled
      await token.addBridge(contracts[1], { from: owner }).should.be.fulfilled
      await token.addBridge(contracts[2], { from: owner }).should.be.fulfilled
      await token.addBridge(contracts[3], { from: owner }).should.be.fulfilled
      expect(await token.bridgeList()).to.be.eql([contracts[3], contracts[2], contracts[1], contracts[0]])

      await token.removeBridge(contracts[1], { from: owner }).should.be.fulfilled

      expect(await token.bridgeList()).to.be.eql([contracts[3], contracts[2], contracts[0]])

      await token.removeBridge(contracts[3], { from: owner }).should.be.fulfilled

      expect(await token.bridgeList()).to.be.eql([contracts[2], contracts[0]])

      await token.removeBridge(contracts[0], { from: owner }).should.be.fulfilled

      expect(await token.bridgeList()).to.be.eql([contracts[2]])

      await token.removeBridge(contracts[2], { from: owner }).should.be.fulfilled

      expect(await token.bridgeList()).to.be.eql([])
    })
  })

  describe('#setBridgeContract', async () => {
    it('should always revert', async () => {
      await token.setBridgeContract(contracts[0], { from: owner }).should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('#bridgeContract', async () => {
    it('should always revert', async () => {
      await token.bridgeContract().should.be.rejectedWith(ERROR_MSG)
    })
  })
})
