const POSValidatorSet = artifacts.require('POSValidatorSet.sol')

const { expect } = require('chai')
const { ether, expectEventInLogs, createFullAccounts, merkleRoot, generateMerkleProof } = require('./helpers/helpers')
const { ZERO_ADDRESS } = require('./setup')

const newValidatorsRoot = '0x1122334455667788112233445566778811223344556677881122334455667788'

contract('POSValidatorSet', async accounts => {
  const owner = accounts[0]
  const user = accounts[1]
  let posValidatorSet
  let validatorsRoot
  let validators

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
    posValidatorSet = await POSValidatorSet.new()
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

  describe('initialize', () => {
    it('should initialize contract with valid parameters', async () => {
      await posValidatorSet.initialize(validatorsRoot, 0, 100, owner).should.be.rejected
      await posValidatorSet.initialize(validatorsRoot, 3, 100, ZERO_ADDRESS).should.be.rejected
      const { logs } = await posValidatorSet.initialize(validatorsRoot, 3, 100, owner).should.be.fulfilled
      await posValidatorSet.initialize(validatorsRoot, 3, 100, owner).should.be.rejected

      expect(await posValidatorSet.isInitialized()).to.be.equal(true)
      expect(await posValidatorSet.validatorsRoot()).to.be.equal(validatorsRoot)
      expect(await posValidatorSet.expirationTime()).to.be.bignumber.equal('100')
      expect(await posValidatorSet.requiredSignatures()).to.be.bignumber.equal('3')
      expect(await posValidatorSet.owner()).to.be.equal(owner)

      expectEventInLogs(logs, 'NewValidatorSet', { root: validatorsRoot })
    })
  })

  describe('updateValidatorSet', () => {
    const message = web3.eth.abi.encodeParameters(['bytes32', 'uint256', 'uint256'], [newValidatorsRoot, 2, 200])

    beforeEach(async () => {
      await posValidatorSet.initialize(validatorsRoot, 3, 100, owner).should.be.fulfilled

      expect(await posValidatorSet.validatorsRoot()).to.be.equal(validatorsRoot)
      expect(await posValidatorSet.requiredSignatures()).to.be.bignumber.equal('3')
      expect(await posValidatorSet.expirationTime()).to.be.bignumber.equal('100')
    })

    it('should allow owner to update validator set', async () => {
      await posValidatorSet.forceUpdateValidatorSet(newValidatorsRoot, 2, 200, { from: user }).should.be.rejected
      await posValidatorSet.forceUpdateValidatorSet(newValidatorsRoot, 2, 200, { from: owner }).should.be.rejected
      const { logs } = await posValidatorSet.forceUpdateValidatorSet(newValidatorsRoot, 2, '999999999999', {
        from: owner
      }).should.be.fulfilled

      expect(await posValidatorSet.validatorsRoot()).to.be.equal(newValidatorsRoot)
      expect(await posValidatorSet.requiredSignatures()).to.be.bignumber.equal('2')
      expect(await posValidatorSet.expirationTime()).to.be.bignumber.equal('999999999999')

      expectEventInLogs(logs, 'NewValidatorSet', { root: newValidatorsRoot })
    })

    it('should allow anyone to submit new validators root with signatures', async () => {
      let signatures = '0x'
      for (let i = 0; i < 19; i++) {
        if (i < 3) {
          const { v, r, s } = await validators[i].sign(message)
          signatures += v.substr(2) + r.substr(2) + s.substr(2)
        } else {
          signatures += `00${validators[i].address.substr(2)}`
        }
      }

      const { logs } = await posValidatorSet.updateValidatorSet(newValidatorsRoot, 2, 200, signatures, { from: user })
        .should.be.fulfilled

      expectEventInLogs(logs, 'NewValidatorSet', { root: newValidatorsRoot })

      expect(await posValidatorSet.validatorsRoot()).to.be.equal(newValidatorsRoot)
      expect(await posValidatorSet.requiredSignatures()).to.be.bignumber.equal('2')
      expect(await posValidatorSet.expirationTime()).to.be.bignumber.equal('200')
    })

    it('should reject insufficient amount of signatures', async () => {
      let signatures = '0x'
      for (let i = 0; i < validators.length; i++) {
        if (i < 2) {
          const { v, r, s } = await validators[i].sign(message)
          signatures += v.substr(2) + r.substr(2) + s.substr(2)
        } else {
          signatures += `00${validators[i].address.substr(2)}`
        }
      }

      await posValidatorSet.updateValidatorSet(newValidatorsRoot, 2, 200, signatures, { from: user }).should.be.rejected
    })

    it('should reject invalid order of validators', async () => {
      let signatures = '0x'
      for (let i = 0; i < validators.length; i++) {
        if (i < 3) {
          const { v, r, s } = await validators[i].sign(message)
          signatures += v.substr(2) + r.substr(2) + s.substr(2)
        } else {
          signatures += `00${validators[21 - i].address.substr(2)}`
        }
      }

      await posValidatorSet.updateValidatorSet(newValidatorsRoot, 2, 200, signatures, { from: user }).should.be.rejected
    })

    it('should reject invalid signatures', async () => {
      let signatures = '0x'
      for (let i = 0; i < validators.length; i++) {
        if (i < 3) {
          const { v, r, s } = await validators[i].sign(message)
          signatures += v.substr(2) + s.substr(2) + r.substr(2)
        } else {
          signatures += `00${validators[i].address.substr(2)}`
        }
      }

      await posValidatorSet.updateValidatorSet(newValidatorsRoot, 2, 200, signatures, { from: user }).should.be.rejected
    })
  })

  describe('isPOSValidator', () => {
    beforeEach(async () => {
      await posValidatorSet.initialize(validatorsRoot, 3, 100, owner).should.be.fulfilled

      expect(await posValidatorSet.validatorsRoot()).to.be.equal(validatorsRoot)
      expect(await posValidatorSet.requiredSignatures()).to.be.bignumber.equal('3')
      expect(await posValidatorSet.expirationTime()).to.be.bignumber.equal('100')
    })

    it('should return true for current validators', async () => {
      for (let i = 0; i < validators.length; i++) {
        expect(
          await posValidatorSet.isPOSValidator(validators[i].address, generateMerkleProof(validators, i))
        ).to.be.equal(true)
      }
    })

    it('should return false for invalid merkle proof', async () => {
      expect(
        await posValidatorSet.isPOSValidator(validators[0].address, generateMerkleProof(validators, 1))
      ).to.be.equal(false)
      expect(await posValidatorSet.isPOSValidator(owner, generateMerkleProof(validators, 0))).to.be.equal(false)
      expect(await posValidatorSet.isPOSValidator(validators[0].address, [])).to.be.equal(false)
      expect(await posValidatorSet.isPOSValidator(owner, [])).to.be.equal(false)
    })
  })
})
