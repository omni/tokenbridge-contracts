const RevertFallback = artifacts.require('RevertFallback.sol')
const { expect } = require('chai')
const { ether } = require('../helpers/helpers')
const { ERROR_MSG, toBN } = require('../setup')

const ZERO = toBN(0)
const oneEther = ether('1')
const twoEthers = ether('2')

contract('Address Library', accounts => {
  describe('safeSendValue', () => {
    it('should send value even if receiver does not allow', async () => {
      // Given
      const sender = await RevertFallback.new()
      const receiver = await RevertFallback.new()
      const user = accounts[1]

      await sender.receiveEth({ value: twoEthers })

      expect(toBN(await web3.eth.getBalance(sender.address))).to.be.bignumber.equal(twoEthers)
      expect(toBN(await web3.eth.getBalance(receiver.address))).to.be.bignumber.equal(ZERO)
      // When
      await sender.sendEth(user, oneEther)
      await sender.sendEth(receiver.address, oneEther).should.be.rejectedWith(ERROR_MSG)

      expect(toBN(await web3.eth.getBalance(sender.address))).to.be.bignumber.equal(oneEther)
      expect(toBN(await web3.eth.getBalance(receiver.address))).to.be.bignumber.equal(ZERO)

      await sender.safeSendEth(receiver.address, oneEther)

      // Then
      expect(toBN(await web3.eth.getBalance(sender.address))).to.be.bignumber.equal(ZERO)
      expect(toBN(await web3.eth.getBalance(receiver.address))).to.be.bignumber.equal(oneEther)
    })
  })
})
