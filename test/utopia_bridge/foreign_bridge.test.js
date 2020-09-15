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

  function merkleRoot(arr) {
    const tree = arr.map(acc => `0x${'00'.repeat(12)}${acc.address.substr(2).toLowerCase()}`)
    for (let i = 1; i < arr.length; i *= 2) {
      for (let j = 0; i + j < arr.length; j += i * 2) {
        if (tree[j] < tree[j + i]) {
          tree[j] = web3.utils.soliditySha3(tree[j] + tree[j + i].substr(2))
        } else {
          tree[j] = web3.utils.soliditySha3(tree[j + i] + tree[j].substr(2))
        }
      }
    }
    return tree[0]
  }

  function generateMerkleProof(arr, validatorIndex) {
    const tree = arr.map(acc => `0x${'00'.repeat(12)}${acc.address.substr(2).toLowerCase()}`)
    const proof = []
    for (let i = 1; i < arr.length; i *= 2) {
      for (let j = 0; i + j < arr.length; j += i * 2) {
        if (validatorIndex >= j && validatorIndex < j + i * 2) {
          proof.push(tree[j + (validatorIndex < j + i ? i : 0)])
        }
        if (tree[j] < tree[j + i]) {
          tree[j] = web3.utils.soliditySha3(tree[j] + tree[j + i].substr(2))
        } else {
          tree[j] = web3.utils.soliditySha3(tree[j + i] + tree[j].substr(2))
        }
      }
    }
    return proof
  }

  async function sendReject(messageId, validatorIndex, sender = validators[validatorIndex].address) {
    const data = await foreignBridge.contract.methods
      .reject(messageId, generateMerkleProof(validators, validatorIndex))
      .encodeABI()
    return web3.eth.sendTransaction({
      from: sender,
      to: foreignBridge.address,
      data,
      gas: 100000
    })
  }

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
  })

  beforeEach(async () => {
    foreignBridge = await ForeignUtopiaBridge.new()
  })

  describe('merkle helpers', () => {
    it('should generate valid merkle tree for 4 validators', async () => {
      const validators = [
        { address: '0x0000000000000000000000000000000000000001' },
        { address: '0x0000000000000000000000000000000000000002' },
        { address: '0x0000000000000000000000000000000000000003' },
        { address: '0x0000000000000000000000000000000000000004' }
      ]
      const validatorsRoot = merkleRoot(validators)
      const hash1 = web3.utils.soliditySha3(
        '0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000002'
      )
      const hash2 = web3.utils.soliditySha3(
        '0x00000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000004'
      )
      expect(validatorsRoot).to.be.equal(web3.utils.soliditySha3(hash2 + hash1.substr(2)))

      const proof1 = generateMerkleProof(validators, 0)
      expect(proof1).to.be.eql(['0x0000000000000000000000000000000000000000000000000000000000000002', hash2])
      const proof2 = generateMerkleProof(validators, 1)
      expect(proof2).to.be.eql(['0x0000000000000000000000000000000000000000000000000000000000000001', hash2])
      const proof3 = generateMerkleProof(validators, 2)
      expect(proof3).to.be.eql(['0x0000000000000000000000000000000000000000000000000000000000000004', hash1])
      const proof4 = generateMerkleProof(validators, 3)
      expect(proof4).to.be.eql(['0x0000000000000000000000000000000000000000000000000000000000000003', hash1])
    })

    it('should generate valid merkle tree for 3 validators', async () => {
      const validators = [
        { address: '0x0000000000000000000000000000000000000001' },
        { address: '0x0000000000000000000000000000000000000002' },
        { address: '0x0000000000000000000000000000000000000003' }
      ]
      const validatorsRoot = merkleRoot(validators)
      const hash1 = web3.utils.soliditySha3(
        '0x00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000002'
      )
      expect(validatorsRoot).to.be.equal(
        web3.utils.soliditySha3(`0x0000000000000000000000000000000000000000000000000000000000000003${hash1.substr(2)}`)
      )

      const proof1 = generateMerkleProof(validators, 0)
      expect(proof1).to.be.eql([
        '0x0000000000000000000000000000000000000000000000000000000000000002',
        '0x0000000000000000000000000000000000000000000000000000000000000003'
      ])
      const proof2 = generateMerkleProof(validators, 1)
      expect(proof2).to.be.eql([
        '0x0000000000000000000000000000000000000000000000000000000000000001',
        '0x0000000000000000000000000000000000000000000000000000000000000003'
      ])
      const proof3 = generateMerkleProof(validators, 2)
      expect(proof3).to.be.eql([hash1])
    })
  })

  describe('set params', () => {
    it('should initialize bridge with valid parameters', async () => {
      await foreignBridge.initialize(validatorsRoot, 200, 0, 10, owner).should.be.rejected
      await foreignBridge.initialize(validatorsRoot, 200, 50, 10, owner).should.be.rejected
      await foreignBridge.initialize(validatorsRoot, 200, 2, 10, ZERO_ADDRESS).should.be.rejected
      await foreignBridge.initialize(validatorsRoot, 0, 2, 10, owner).should.be.rejected
      const { logs } = await foreignBridge.initialize(validatorsRoot, 200, 2, 10, owner).should.be.fulfilled
      await foreignBridge.initialize(validatorsRoot, 200, 2, 10, owner).should.be.rejected

      expect(await foreignBridge.isInitialized()).to.be.equal(true)
      expect(await foreignBridge.getValidatorsRoot()).to.be.equal(validatorsRoot)
      expect(await foreignBridge.getCommitsDailyLimit()).to.be.bignumber.equal('10')
      expect(await foreignBridge.getCommitRejectsThreshold()).to.be.bignumber.equal('2')
      expect(await foreignBridge.owner()).to.be.equal(owner)
      expect(await foreignBridge.getValidatorsUpdateTime()).to.be.bignumber.gt(ZERO)
      expectEventInLogs(logs, 'UpdateValidatorsRoot', { root: validatorsRoot })
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
    const opts = { from: user, value: ether('1') }

    beforeEach(async () => {
      await foreignBridge.initialize(validatorsRoot, ether('1'), 2, 2, owner).should.be.fulfilled
    })

    it('should process valid commit', async () => {
      expect(await foreignBridge.getTodayCommits()).to.be.bignumber.equal(ZERO)

      const { logs } = await foreignBridge.commit(messageId1, accounts[2], '0x11223344', opts).should.be.fulfilled

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

      await foreignBridge.commit(messageId1, accounts[2], '0x11223344', opts).should.be.fulfilled

      expect(await foreignBridge.getTodayCommits()).to.be.bignumber.equal('1')

      await foreignBridge.commit(messageId2, accounts[2], '0x11223344', opts).should.be.fulfilled

      expect(await foreignBridge.getTodayCommits()).to.be.bignumber.equal('2')

      await foreignBridge.commit(messageId3, accounts[2], '0x11223344', opts).should.be.rejected

      await increaseTime(web3, 25 * 60 * 60)

      await foreignBridge.commit(messageId3, accounts[2], '0x11223344', opts).should.be.fulfilled

      expect(await foreignBridge.getTodayCommits()).to.be.bignumber.equal('1')
    })

    it('should reject commit with insufficient bond', async () => {
      await foreignBridge.commit(messageId1, accounts[2], '0x11223344', { from: user, value: ether('0.5') }).should.be
        .rejected
    })
  })

  describe('execute', () => {
    const opts = { from: user, value: ether('1') }
    let box

    beforeEach(async () => {
      await foreignBridge.initialize(validatorsRoot, 200, 2, 2, owner).should.be.fulfilled

      box = await Box.new()
    })

    it('should execute only after timeout', async () => {
      const data = await box.contract.methods.setValue(3).encodeABI()
      await foreignBridge.commit(messageId1, box.address, data, opts).should.be.fulfilled
      const balance = toBN(await web3.eth.getBalance(user))

      await foreignBridge.execute(messageId1, 100000).should.be.rejected

      await increaseTime(web3, 25 * 60 * 60)

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
      await foreignBridge.commit(messageId1, box.address, data, opts).should.be.fulfilled

      await increaseTime(web3, 25 * 60 * 60)

      const { logs } = await foreignBridge.execute(messageId1, 100000).should.be.fulfilled

      expectEventInLogs(logs, 'Execute', { messageId: messageId1, status: false })
    })

    it('should handle out of gas', async () => {
      const data = await box.contract.methods.methodOutOfGas().encodeABI()
      await foreignBridge.commit(messageId1, box.address, data, opts).should.be.fulfilled

      await increaseTime(web3, 25 * 60 * 60)

      const { logs } = await foreignBridge.execute(messageId1, 1000).should.be.fulfilled

      expectEventInLogs(logs, 'Execute', { messageId: messageId1, status: false })
    })
  })

  describe('reject', () => {
    beforeEach(async () => {
      await foreignBridge.initialize(validatorsRoot, 200, 2, 2, owner).should.be.fulfilled
      await foreignBridge.commit(messageId1, accounts[2], '0x11223344', { from: user, value: ether('1') }).should.be
        .fulfilled
    })

    it('should accept single reject', async () => {
      expect(await foreignBridge.getCommitRejectsCount(messageId1)).to.be.bignumber.equal(ZERO)

      await sendReject(messageId1, 0).should.be.fulfilled

      expect(await foreignBridge.getCommitRejectsCount(messageId1)).to.be.bignumber.equal('1')
      const events = await getEvents(foreignBridge, { event: 'Reject' })
      expect(events.length).to.be.equal(1)
    })

    it('should accept several rejects', async () => {
      await sendReject(messageId1, 18).should.be.fulfilled
      await sendReject(messageId1, 17).should.be.fulfilled
      await sendReject(messageId1, 16).should.be.rejected

      expect(await foreignBridge.getCommitRejectsCount(messageId1)).to.be.bignumber.equal('2')
      const events = await getEvents(foreignBridge, { event: 'Reject' })
      expect(events.length).to.be.equal(2)
    })

    it('should not accept rejects from the same person', async () => {
      await sendReject(messageId1, 18).should.be.fulfilled
      await sendReject(messageId1, 18).should.be.rejected
    })

    it('should not accept rejects from the same person', async () => {
      await sendReject(messageId1, 18).should.be.fulfilled
      await sendReject(messageId1, 18).should.be.rejected
    })

    it('should not accept invalid merkle proof', async () => {
      await sendReject(messageId1, 0, owner).should.be.rejected
      await sendReject(messageId1, 0, validators[0].address).should.be.fulfilled
    })
  })

  describe('slash', () => {
    beforeEach(async () => {
      await foreignBridge.initialize(validatorsRoot, 200, 2, 2, owner).should.be.fulfilled
      await foreignBridge.commit(messageId1, accounts[2], '0x11223344', { from: user, value: ether('1') }).should.be
        .fulfilled
      await sendReject(messageId1, 0).should.be.fulfilled
    })

    it('should split rejected message bond between parties', async () => {
      await sendReject(messageId1, 1).should.be.fulfilled

      const initialBalances = await Promise.all([
        web3.eth.getBalance(validators[0].address).then(toBN),
        web3.eth.getBalance(validators[1].address).then(toBN),
        web3.eth.getBalance(owner).then(toBN)
      ])

      const { logs } = await foreignBridge.slash(messageId1, [validators[0].address, validators[1].address]).should.be
        .fulfilled

      const balances = await Promise.all([
        web3.eth.getBalance(validators[0].address).then(toBN),
        web3.eth.getBalance(validators[1].address).then(toBN),
        web3.eth.getBalance(owner).then(toBN)
      ])

      expect(balances[0]).to.be.bignumber.equal(initialBalances[0].add(ether('0.5')))
      expect(balances[1]).to.be.bignumber.equal(initialBalances[1].add(ether('0.25')))
      expect(balances[2]).to.be.bignumber.gt(initialBalances[2].add(ether('0.24')))
      expectEventInLogs(logs, 'Slash', { messageId: messageId1 })
    })

    it('should not allow to claim bond for non-rejected message', async () => {
      await foreignBridge.slash(messageId1, [validators[0].address]).should.be.rejected
      await foreignBridge.slash(messageId2, [validators[0].address]).should.be.rejected
    })

    it('should not allow to claim bond with for invalid parties', async () => {
      await sendReject(messageId1, 1).should.be.fulfilled

      await foreignBridge.slash(messageId1, [validators[0].address, owner]).should.be.rejected
      await foreignBridge.slash(messageId1, [owner, validators[1].address]).should.be.rejected
      await foreignBridge.slash(messageId1, [validators[0].address, validators[1].address]).should.be.fulfilled
    })

    it('should not allow to claim bond with for the already processed message', async () => {
      await foreignBridge.slash(messageId1, [validators[0].address]).should.be.rejected

      await increaseTime(web3, 40 * 60 * 60)

      await foreignBridge.slash(messageId1, [validators[0].address, validators[1].address]).should.be.rejected

      await foreignBridge.execute(messageId1, 1000).should.be.fulfilled

      await foreignBridge.slash(messageId1, [validators[0].address, validators[1].address]).should.be.rejected
    })

    it('should not allow to claim already slashed bond', async () => {
      await sendReject(messageId1, 1).should.be.fulfilled

      await foreignBridge.slash(messageId1, [validators[0].address, validators[1].address]).should.be.fulfilled
      await foreignBridge.slash(messageId1, [validators[0].address, validators[1].address]).should.be.rejected
    })
  })
})
