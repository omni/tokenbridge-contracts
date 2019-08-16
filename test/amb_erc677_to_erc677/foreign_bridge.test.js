const ForeignAMBErc677ToErc677 = artifacts.require('ForeignAMBErc677ToErc677.sol')
const HomeAMBErc677ToErc677 = artifacts.require('HomeAMBErc677ToErc677.sol')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const ForeignAMB = artifacts.require('ForeignAMB.sol')
const BridgeValidators = artifacts.require('BridgeValidators.sol')

const { expect } = require('chai')
const { shouldBehaveLikeBasicAMBErc677ToErc677 } = require('./AMBErc677ToErc677Behavior.test')
const { ether } = require('../helpers/helpers')
const { getEvents } = require('../helpers/helpers')
const { ERROR_MSG, toBN } = require('../setup')

const ZERO = toBN(0)
const halfEther = ether('0.5')
const oneEther = ether('1')
const twoEthers = ether('2')
const maxGasPerTx = oneEther
const dailyLimit = twoEthers
const maxPerTx = oneEther
const minPerTx = ether('0.01')
const executionDailyLimit = dailyLimit
const executionMaxPerTx = maxPerTx

contract('ForeignAMBErc677ToErc677', async accounts => {
  const owner = accounts[0]
  const user = accounts[1]
  let ambBridgeContract
  let mediatorContract
  let erc677Token
  let foreignBridge
  beforeEach(async function() {
    this.bridge = await ForeignAMBErc677ToErc677.new()
  })
  shouldBehaveLikeBasicAMBErc677ToErc677(HomeAMBErc677ToErc677, accounts)
  describe('onTokenTransfer', () => {
    beforeEach(async () => {
      const validatorContract = await BridgeValidators.new()
      const authorities = [accounts[1], accounts[2]]
      await validatorContract.initialize(1, authorities, owner)
      ambBridgeContract = await ForeignAMB.new()
      await ambBridgeContract.initialize(validatorContract.address, maxGasPerTx, '1', '1', owner)
      mediatorContract = await HomeAMBErc677ToErc677.new()
      erc677Token = await ERC677BridgeToken.new('test', 'TST', 18)
      await erc677Token.mint(user, twoEthers, { from: owner }).should.be.fulfilled

      foreignBridge = await ForeignAMBErc677ToErc677.new()
      await foreignBridge.initialize(
        ambBridgeContract.address,
        mediatorContract.address,
        erc677Token.address,
        dailyLimit,
        maxPerTx,
        minPerTx,
        executionDailyLimit,
        executionMaxPerTx,
        maxGasPerTx,
        owner
      ).should.be.fulfilled
    })
    it('should emit UserRequestForAffirmation in AMB bridge', async () => {
      // Given
      const currentDay = await foreignBridge.getCurrentDay()
      expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(ZERO)
      const initialEvents = await getEvents(ambBridgeContract, { event: 'UserRequestForAffirmation' })
      expect(initialEvents.length).to.be.equal(0)

      // only token address can call it
      await foreignBridge.onTokenTransfer(user, halfEther, '0x00', { from: owner }).should.be.rejectedWith(ERROR_MSG)

      // must be within limits
      await erc677Token
        .transferAndCall(foreignBridge.address, twoEthers, '0x00', { from: user })
        .should.be.rejectedWith(ERROR_MSG)

      // When
      await erc677Token.transferAndCall(foreignBridge.address, halfEther, '0x00', { from: user }).should.be.fulfilled

      // Then
      const events = await getEvents(ambBridgeContract, { event: 'UserRequestForAffirmation' })
      expect(events.length).to.be.equal(1)
      expect(await foreignBridge.totalSpentPerDay(currentDay)).to.be.bignumber.equal(halfEther)
    })
  })
})
