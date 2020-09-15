const ForeignUtopiaBridge = artifacts.require('ForeignUtopiaBridge.sol')
const Box = artifacts.require('UtopiaBox.sol')

const { expect } = require('chai')
const { ether, expectEventInLogs, getEvents, createFullAccounts, increaseTime } = require('../helpers/helpers')
const { toBN, ZERO_ADDRESS } = require('../setup')

const ZERO = toBN(0)
const newValidatorsRoot = '0x1122334455667788112233445566778811223344556677881122334455667788'
const messageId1 = '0xf308b922ab9f8a7128d9d7bc9bce22cd88b2c05c8213f0e2d8104d78e0a9ecbb'
const messageId2 = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
const messageId3 = '0x2ebc2ccc755acc8eaf9252e19573af708d644ab63a39619adb080a3500a4ff2e'

contract('ForeignUtopiaBridge', async accounts => {
  const owner = accounts[0]
  const user = accounts[1]
  let foreignBridge
  let validatorsRoot
  let validators

  function merkleRoot(arr, start = 0, end = 32) {
    if (start + 1 === end) {
      if (start < arr.length) {
        return `0x${'00'.repeat(12)}${arr[start].address.substr(2).toLowerCase()}`
      }
      return null
    }
    const len = end - start
    const left = merkleRoot(arr, start, end - len / 2)
    const right = merkleRoot(arr, start + len / 2, end)
    if (right === null) {
      return left
    }
    if (left < right) {
      return web3.utils.soliditySha3(left + right.substr(2))
    }
    return web3.utils.soliditySha3(right + left.substr(2))
  }

  before(async () => {
    validators = createFullAccounts(web3, 16).sort((a, b) => a.address.toLowerCase() > b.address.toLowerCase())
    validatorsRoot = merkleRoot(validators)
  })

  beforeEach(async () => {
    foreignBridge = await ForeignUtopiaBridge.new()
  })

  describe('set params', () => {
    it('should initialize bridge with valid parameters', async () => {
      await foreignBridge.initialize(validatorsRoot, 200, 0, 10, owner).should.be.rejected
      await foreignBridge.initialize(validatorsRoot, 200, 50, 10, owner).should.be.rejected
      await foreignBridge.initialize(validatorsRoot, 200, 2, 10, ZERO_ADDRESS).should.be.rejected
      await foreignBridge.initialize(validatorsRoot, 0, 2, 10, owner).should.be.rejected
      await foreignBridge.initialize(validatorsRoot, 200, 2, 10, owner).should.be.fulfilled
      await foreignBridge.initialize(validatorsRoot, 200, 2, 10, owner).should.be.rejected

      expect(await foreignBridge.isInitialized()).to.be.equal(true)
      expect(await foreignBridge.getValidatorsRoot()).to.be.equal(validatorsRoot)
      expect(await foreignBridge.getCommitsDailyLimit()).to.be.bignumber.equal('10')
      expect(await foreignBridge.getCommitRejectsThreshold()).to.be.bignumber.equal('2')
      expect(await foreignBridge.owner()).to.be.equal(owner)
      expect(await foreignBridge.getValidatorsUpdateTime()).to.be.bignumber.gt(ZERO)
    })

    it('setCommitsDailyLimit', async () => {
      await foreignBridge.initialize(validatorsRoot, 200, 2, 10, owner).should.be.fulfilled

      await foreignBridge.setCommitsDailyLimit(20, { from: user }).should.be.rejected
      await foreignBridge.setCommitsDailyLimit(20, { from: owner }).should.be.fulfilled
      expect(await foreignBridge.getCommitsDailyLimit()).to.be.bignumber.equal('20')
    })

    it('setCommitRejectsThreshold', async () => {
      await foreignBridge.initialize(validatorsRoot, 200, 2, 10, owner).should.be.fulfilled

      await foreignBridge.setCommitRejectsThreshold(1, { from: user }).should.be.rejected
      await foreignBridge.setCommitRejectsThreshold(0, { from: owner }).should.be.rejected
      await foreignBridge.setCommitRejectsThreshold(50, { from: owner }).should.be.rejected
      await foreignBridge.setCommitRejectsThreshold(1, { from: owner }).should.be.fulfilled
      expect(await foreignBridge.getCommitRejectsThreshold()).to.be.bignumber.equal('1')
    })

    it('setCommitMinimalBond', async () => {
      await foreignBridge.initialize(validatorsRoot, 200, 2, 10, owner).should.be.fulfilled

      await foreignBridge.setCommitMinimalBond(100, { from: user }).should.be.rejected
      await foreignBridge.setCommitMinimalBond(0, { from: owner }).should.be.rejected
      await foreignBridge.setCommitMinimalBond(100, { from: owner }).should.be.fulfilled
      expect(await foreignBridge.getCommitMinimalBond()).to.be.bignumber.equal('100')
    })
  })

  describe('submitValidatorsRoot', () => {
    let signatures

    beforeEach(async () => {
      signatures = '0x'
      await foreignBridge.initialize(validatorsRoot, 200, 2, 10, owner).should.be.fulfilled
    })

    for (let i = 1; i <= 19; i++) {
      it(`should accept valid signatures for ${i} validators`, async () => {
        const validators = createFullAccounts(web3, i).sort((a, b) => a.address.toLowerCase() > b.address.toLowerCase())
        const validatorsRoot = merkleRoot(validators)
        const foreignBridge = await ForeignUtopiaBridge.new()
        await foreignBridge.initialize(validatorsRoot, 200, 2, 10, owner).should.be.fulfilled

        for (let i = 0; i < validators.length; i++) {
          if (i % 2 === 0 || (validators.length % 2 === 0 && i === validators.length - 1)) {
            const { v, r, s } = await validators[i].sign(newValidatorsRoot)
            signatures += v.substr(2) + r.substr(2) + s.substr(2)
          } else {
            signatures += `00${validators[i].address.substr(2)}`
          }
        }

        await increaseTime(web3, 1)
        const prevTimestamp = await foreignBridge.getValidatorsUpdateTime()
        await foreignBridge.submitValidatorsRoot(newValidatorsRoot, signatures).should.be.fulfilled

        expect(await foreignBridge.getValidatorsRoot()).to.be.equal(newValidatorsRoot)
        expect(await foreignBridge.getValidatorsUpdateTime()).to.be.bignumber.gt(prevTimestamp)
      })
    }

    it('should reject insufficient number of signatures', async () => {
      for (let i = 0; i < validators.length; i++) {
        if (i % 2 === 1) {
          const { v, r, s } = await validators[i].sign(newValidatorsRoot)
          signatures += v.substr(2) + r.substr(2) + s.substr(2)
        } else {
          signatures += `00${validators[i].address.substr(2)}`
        }
      }

      await foreignBridge.submitValidatorsRoot(newValidatorsRoot, signatures).should.be.rejected
    })

    it('should reject incorrect root', async () => {
      for (let i = 0; i < validators.length; i++) {
        if (i % 2 === 0 || (validators.length % 2 === 0 && i === validators.length - 1)) {
          const { v, r, s } = await validators[i].sign(newValidatorsRoot)
          signatures += v.substr(2) + r.substr(2) + s.substr(2)
        } else {
          signatures += `00${validators[i].address.substr(2)}`
        }
      }

      await foreignBridge.submitValidatorsRoot(validatorsRoot, signatures).should.be.rejected
    })

    it('should reject incorrect signatures', async () => {
      for (let i = 0; i < validators.reverse().length; i++) {
        if (i % 2 === 0 || (validators.length % 2 === 0 && i === validators.length - 1)) {
          const { v, r, s } = await validators[i].sign(newValidatorsRoot)
          signatures += v.substr(2) + r.substr(2) + s.substr(2)
        } else {
          signatures += `00${validators[i].address.substr(2)}`
        }
      }

      await foreignBridge.submitValidatorsRoot(newValidatorsRoot, signatures).should.be.rejected
    })
  })

  describe('commit', () => {
    beforeEach(async () => {
      await foreignBridge.initialize(validatorsRoot, 200, 2, 2, owner).should.be.fulfilled
    })

    it('should process valid commit', async () => {
      expect(await foreignBridge.getTodayCommits()).to.be.bignumber.equal(ZERO)

      const { logs } = await foreignBridge.commit(messageId1, accounts[2], '0x11223344', { from: user, value: ether('1') }).should.be.fulfilled

      expect(await foreignBridge.getTodayCommits()).to.be.bignumber.equal('1')
      expect(await foreignBridge.getCommitTime(messageId1)).to.be.bignumber.gt(ZERO)
      expect((await foreignBridge.getCommitSenderAndBond(messageId1))[0]).to.be.equal(user)
      expect((await foreignBridge.getCommitSenderAndBond(messageId1))[1]).to.be.bignumber.equal(ether('1'))
      expect(await foreignBridge.getCommitExecutor(messageId1)).to.be.equal(accounts[2])
      expect(await foreignBridge.getCommitCalldata(messageId1)).to.be.equal('0x11223344')
      expectEventInLogs(logs, 'Commit', { messageId: messageId1 })
    })

    it('should respect daily commits limit', async () => {
      expect(await foreignBridge.getTodayCommits()).to.be.bignumber.equal(ZERO)

      await foreignBridge.commit(messageId1, accounts[2], '0x11223344', { from: user, value: ether('1') }).should.be.fulfilled

      expect(await foreignBridge.getTodayCommits()).to.be.bignumber.equal('1')
      
      await foreignBridge.commit(messageId2, accounts[2], '0x11223344', { from: user, value: ether('1') }).should.be.fulfilled

      expect(await foreignBridge.getTodayCommits()).to.be.bignumber.equal('2')
      
      await foreignBridge.commit(messageId3, accounts[2], '0x11223344', { from: user, value: ether('1') }).should.be.rejected

      await increaseTime(web3, 24 * 60 * 60)

      await foreignBridge.commit(messageId3, accounts[2], '0x11223344', { from: user, value: ether('1') }).should.be.fulfilled

      expect(await foreignBridge.getTodayCommits()).to.be.bignumber.equal('1')
    })
  })

  describe('execute', () => {
    let box

    beforeEach(async () => {
      await foreignBridge.initialize(validatorsRoot, 200, 2, 2, owner).should.be.fulfilled

      box = await Box.new()
    })

    it('should execute only after timeout', async () => {
      const data = await box.contract.methods.setValue(3).encodeABI()
      await foreignBridge.commit(messageId1, box.address, data, { from: user, value: ether('1') }).should.be.fulfilled
      const balance = toBN(await web3.eth.getBalance(user))

      await foreignBridge.execute(messageId1, 100000).should.be.rejected

      await increaseTime(web3, 24 * 60 * 60)

      const { logs } = await foreignBridge.execute(messageId1, 100000).should.be.fulfilled

      expect(await foreignBridge.getCommitTime(messageId1)).to.be.bignumber.equal(ZERO)
      expect((await foreignBridge.getCommitSenderAndBond(messageId1))[0]).to.be.equal(ZERO_ADDRESS)
      expect((await foreignBridge.getCommitSenderAndBond(messageId1))[1]).to.be.bignumber.equal(ZERO)
      expect(await foreignBridge.getCommitExecutor(messageId1)).to.be.equal(ZERO_ADDRESS)
      expect(await foreignBridge.getCommitCalldata(messageId1)).to.be.equal(null)
      expect(toBN(await web3.eth.getBalance(user))).to.be.bignumber.equal(balance.add(ether('1')))
      expectEventInLogs(logs, 'Execute', { messageId: messageId1, status: true })

      await foreignBridge.execute(messageId1, 100000).should.be.rejected
    })

    it('should handle failed call', async () => {
      const data = await box.contract.methods.methodWillFail().encodeABI()
      await foreignBridge.commit(messageId1, box.address, data, { from: user, value: ether('1') }).should.be.fulfilled

      await increaseTime(web3, 24 * 60 * 60)

      const { logs } = await foreignBridge.execute(messageId1, 100000).should.be.fulfilled

      expectEventInLogs(logs, 'Execute', { messageId: messageId1, status: false })
    })

    it('should handle out of gas', async () => {
      const data = await box.contract.methods.methodOutOfGas().encodeABI()
      await foreignBridge.commit(messageId1, box.address, data, { from: user, value: ether('1') }).should.be.fulfilled

      await increaseTime(web3, 24 * 60 * 60)

      const { logs } = await foreignBridge.execute(messageId1, 1000).should.be.fulfilled

      expectEventInLogs(logs, 'Execute', { messageId: messageId1, status: false })
    })
  })
})
