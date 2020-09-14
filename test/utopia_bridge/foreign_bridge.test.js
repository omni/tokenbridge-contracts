const ForeignUtopiaBridge = artifacts.require('ForeignUtopiaBridge.sol')

const { expect } = require('chai')
const { ether, expectEventInLogs, getEvents, createFullAccounts, delay } = require('../helpers/helpers')
const { toBN, ZERO_ADDRESS } = require('../setup')

const ZERO = toBN(0)
const newValidatorsRoot = '0x1122334455667788112233445566778811223344556677881122334455667788'

contract('ForeignUtopiaBridge', async accounts => {
    const owner = accounts[0]
    const user = accounts[1]
    let foreignBridge
    let validatorsRoot
    let validators

    function merkleRoot(arr, start = 0, end = 32) {
        if (start + 1 == end) {
            const addr = start < arr.length ? arr[start].address : ZERO_ADDRESS
            return '0x' + '00'.repeat(12) + addr.substr(2).toLowerCase()
        }
        const len = end - start
        const left = merkleRoot(arr, start, end - len / 2)
        const right = merkleRoot(arr, start + len / 2, end)
        if (left < right) {
            return web3.utils.soliditySha3(left + right.substr(2))
        }
        return web3.utils.soliditySha3(right + left.substr(2))
    }

    before(async () => {
        validators = createFullAccounts(web3, 19).sort((a, b) => a.address.toLowerCase() > b.address.toLowerCase())

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

    describe('update validators root', () => {
        let signatures

        beforeEach(async () => {
            signatures = '0x'
            await foreignBridge.initialize(validatorsRoot, 200, 2, 10, owner).should.be.fulfilled
        })

        it('should accept valid signatures', async () => {
            for (let i = 0; i < validators.length; i++) {
                if (i % 2 == 0) {
                    const { v, r, s } = await validators[i].sign(newValidatorsRoot)
                    signatures += v.substr(2) + r.substr(2) + s.substr(2)
                } else {
                    signatures += '00' + validators[i].address.substr(2)
                }
            }

            await delay(1500)
            const prevTimestamp = await foreignBridge.getValidatorsUpdateTime()
            const res = await foreignBridge.submitValidatorsRoot(newValidatorsRoot, signatures).should.be.fulfilled

            expect(await foreignBridge.getValidatorsRoot()).to.be.equal(newValidatorsRoot)
            expect(await foreignBridge.getValidatorsUpdateTime()).to.be.bignumber.gt(prevTimestamp)
        })

        it('should reject insufficient number of signatures', async () => {
            for (let i = 0; i < validators.length; i++) {
                if (i % 2 == 1) {
                    const { v, r, s } = await validators[i].sign(newValidatorsRoot)
                    signatures += v.substr(2) + r.substr(2) + s.substr(2)
                } else {
                    signatures += '00' + validators[i].address.substr(2)
                }
            }

            await foreignBridge.submitValidatorsRoot(newValidatorsRoot, signatures).should.be.rejected
        })

        it('should reject incorrect root', async () => {
            for (let i = 0; i < validators.length; i++) {
                if (i % 2 == 0) {
                    const { v, r, s } = await validators[i].sign(newValidatorsRoot)
                    signatures += v.substr(2) + r.substr(2) + s.substr(2)
                } else {
                    signatures += '00' + validators[i].address.substr(2)
                }
            }

            await foreignBridge.submitValidatorsRoot(validatorsRoot, signatures).should.be.rejected
        })

        it('should reject incorrect signatures', async () => {
            for (let i = 0; i < validators.reverse().length; i++) {
                if (i % 2 == 0) {
                    const { v, r, s } = await validators[i].sign(newValidatorsRoot)
                    signatures += v.substr(2) + r.substr(2) + s.substr(2)
                } else {
                    signatures += '00' + validators[i].address.substr(2)
                }
            }

            await foreignBridge.submitValidatorsRoot(newValidatorsRoot, signatures).should.be.rejected
        })
    })
})
