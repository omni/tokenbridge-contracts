const HomeMultiAMBErc20ToErc677 = artifacts.require('HomeMultiAMBErc20ToErc677.sol')
const ForeignMultiAMBErc20ToErc677 = artifacts.require('ForeignMultiAMBErc20ToErc677.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')
const AMBMock = artifacts.require('AMBMock.sol')
const ERC20Mock = artifacts.require('ERC20Mock.sol')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const Sacrifice = artifacts.require('Sacrifice.sol')

const { expect } = require('chai')
const { getEvents, expectEventInLogs, ether, strip0x } = require('../helpers/helpers')
const { ZERO_ADDRESS, toBN } = require('../setup')

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
const exampleMessageId = '0xf308b922ab9f8a7128d9d7bc9bce22cd88b2c05c8213f0e2d8104d78e0a9ecbb'
const otherMessageId = '0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121'
const failedMessageId = '0x2ebc2ccc755acc8eaf9252e19573af708d644ab63a39619adb080a3500a4ff2e'

contract('ForeignMultiAMBErc20ToErc677', async accounts => {
  let contract
  let token
  let ambBridgeContract
  let otherSideMediator
  let currentDay
  const owner = accounts[0]
  const user = accounts[1]
  const user2 = accounts[2]
  const value = oneEther
  beforeEach(async () => {
    contract = await ForeignMultiAMBErc20ToErc677.new()
    ambBridgeContract = await AMBMock.new()
    await ambBridgeContract.setMaxGasPerTx(maxGasPerTx)
    otherSideMediator = await HomeMultiAMBErc20ToErc677.new()
    token = await ERC677BridgeToken.new('TEST', 'TST', 18)
    currentDay = await contract.getCurrentDay()
  })

  const sendFunctions = [
    async function simpleTransfer() {
      await token.transfer(contract.address, value, { from: user }).should.be.fulfilled
      return user
    },
    async function emptyAlternativeReceiver() {
      await token.transferAndCall(contract.address, value, '0x', { from: user }).should.be.fulfilled
      return user
    },
    async function sameAlternativeReceiver() {
      await token.transferAndCall(contract.address, value, user, { from: user }).should.be.fulfilled
      return user
    },
    async function differentAlternativeReceiver() {
      await token.transferAndCall(contract.address, value, user2, { from: user }).should.be.fulfilled
      return user2
    },
    async function simpleRelayTokens1() {
      await token.approve(contract.address, value, { from: user }).should.be.fulfilled
      await contract.methods['relayTokens(address,uint256)'](token.address, value, { from: user }).should.be.fulfilled
      return user
    },
    async function simpleRelayTokens2() {
      await token.approve(contract.address, value, { from: user }).should.be.fulfilled
      await contract.methods['relayTokens(address,address,uint256)'](token.address, user, value, { from: user }).should
        .be.fulfilled
      return user
    },
    async function relayTokensWithAlternativeReceiver1() {
      await token.approve(contract.address, value, { from: user }).should.be.fulfilled
      await contract.methods['relayTokens(address,address,uint256)'](token.address, user2, value, { from: user }).should
        .be.fulfilled
      return user2
    }
  ]

  describe('initialize', () => {
    it('should initialize parameters', async () => {
      // Given
      expect(await contract.isInitialized()).to.be.equal(false)
      expect(await contract.bridgeContract()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.mediatorContractOnOtherSide()).to.be.equal(ZERO_ADDRESS)
      expect(await contract.dailyLimit(ZERO_ADDRESS)).to.be.bignumber.equal(ZERO)
      expect(await contract.maxPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(ZERO)
      expect(await contract.minPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(ZERO)
      expect(await contract.executionDailyLimit(ZERO_ADDRESS)).to.be.bignumber.equal(ZERO)
      expect(await contract.executionMaxPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(ZERO)
      expect(await contract.requestGasLimit()).to.be.bignumber.equal(ZERO)
      expect(await contract.owner()).to.be.equal(ZERO_ADDRESS)

      // When
      // not valid bridge address
      await contract.initialize(
        ZERO_ADDRESS,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        owner
      ).should.be.rejected

      // dailyLimit > maxPerTx
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [maxPerTx, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        owner
      ).should.be.rejected

      // maxPerTx > minPerTx
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, minPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        owner
      ).should.be.rejected

      // executionDailyLimit > executionMaxPerTx
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionDailyLimit],
        maxGasPerTx,
        owner
      ).should.be.rejected

      // maxGasPerTx > bridge maxGasPerTx
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        twoEthers,
        owner
      ).should.be.rejected

      // not valid owner
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        ZERO_ADDRESS
      ).should.be.rejected

      const { logs } = await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        owner
      ).should.be.fulfilled

      // already initialized
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        owner
      ).should.be.rejected

      // Then
      expect(await contract.isInitialized()).to.be.equal(true)
      expect(await contract.bridgeContract()).to.be.equal(ambBridgeContract.address)
      expect(await contract.mediatorContractOnOtherSide()).to.be.equal(otherSideMediator.address)
      expect(await contract.dailyLimit(ZERO_ADDRESS)).to.be.bignumber.equal(dailyLimit)
      expect(await contract.maxPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(maxPerTx)
      expect(await contract.minPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(minPerTx)
      expect(await contract.executionDailyLimit(ZERO_ADDRESS)).to.be.bignumber.equal(executionDailyLimit)
      expect(await contract.executionMaxPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(executionMaxPerTx)
      expect(await contract.requestGasLimit()).to.be.bignumber.equal(maxGasPerTx)
      expect(await contract.owner()).to.be.equal(owner)

      expectEventInLogs(logs, 'ExecutionDailyLimitChanged', { token: ZERO_ADDRESS, newLimit: executionDailyLimit })
      expectEventInLogs(logs, 'DailyLimitChanged', { token: ZERO_ADDRESS, newLimit: dailyLimit })
    })
  })

  describe('getBridgeMode', () => {
    it('should return mediator mode and interface', async function() {
      const bridgeModeHash = '0xb1516c26' // 4 bytes of keccak256('multi-erc-to-erc-amb')
      expect(await contract.getBridgeMode()).to.be.equal(bridgeModeHash)

      const { major, minor, patch } = await contract.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(ZERO)
      minor.should.be.bignumber.gte(ZERO)
      patch.should.be.bignumber.gte(ZERO)
    })
  })

  describe('claimTokens', () => {
    beforeEach(async () => {
      const storageProxy = await EternalStorageProxy.new()
      await storageProxy.upgradeTo('1', contract.address).should.be.fulfilled
      contract = await ForeignMultiAMBErc20ToErc677.at(storageProxy.address)
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        owner
      ).should.be.fulfilled
    })

    it('should only work with unknown token', async () => {
      await token.mint(user, oneEther).should.be.fulfilled
      expect(await token.balanceOf(user)).to.be.bignumber.equal(oneEther)

      await token.transfer(contract.address, oneEther, { from: user }).should.be.fulfilled
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(oneEther)

      await contract.claimTokens(token.address, accounts[3], { from: user }).should.be.rejected
      await contract.claimTokens(token.address, accounts[3], { from: owner }).should.be.rejected

      token = await ERC20Mock.new('Test', 'TST', 18)

      await token.mint(user, oneEther).should.be.fulfilled
      expect(await token.balanceOf(user)).to.be.bignumber.equal(oneEther)

      await token.transfer(contract.address, oneEther, { from: user }).should.be.fulfilled
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(oneEther)

      await contract.claimTokens(token.address, accounts[3], { from: user }).should.be.rejected
      await contract.claimTokens(token.address, accounts[3], { from: owner }).should.be.fulfilled
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(accounts[3])).to.be.bignumber.equal(oneEther)
    })

    it('should also work for native coins', async () => {
      await Sacrifice.new(contract.address, { value: oneEther }).catch(() => {})
      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(oneEther)
      const balanceBefore = toBN(await web3.eth.getBalance(accounts[3]))

      await contract.claimTokens(ZERO_ADDRESS, accounts[3], { from: user }).should.be.rejected
      await contract.claimTokens(ZERO_ADDRESS, accounts[3], { from: owner }).should.be.fulfilled

      expect(toBN(await web3.eth.getBalance(contract.address))).to.be.bignumber.equal(ZERO)
      expect(toBN(await web3.eth.getBalance(accounts[3]))).to.be.bignumber.equal(balanceBefore.add(oneEther))
    })
  })

  describe('afterInitialization', () => {
    beforeEach(async () => {
      await token.mint(user, twoEthers, { from: owner }).should.be.fulfilled

      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        owner
      ).should.be.fulfilled

      const initialEvents = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(initialEvents.length).to.be.equal(0)
    })

    describe('update mediator parameters', () => {
      describe('limits', () => {
        it('should allow to update default daily limits', async () => {
          await contract.setDailyLimit(ZERO_ADDRESS, ether('5'), { from: user }).should.be.rejected
          await contract.setExecutionDailyLimit(ZERO_ADDRESS, ether('5'), { from: user }).should.be.rejected
          await contract.setDailyLimit(ZERO_ADDRESS, ether('0.5'), { from: owner }).should.be.rejected
          await contract.setExecutionDailyLimit(ZERO_ADDRESS, ether('0.5'), { from: owner }).should.be.rejected
          await contract.setDailyLimit(ZERO_ADDRESS, ether('5'), { from: owner }).should.be.fulfilled
          await contract.setExecutionDailyLimit(ZERO_ADDRESS, ether('5'), { from: owner }).should.be.fulfilled

          expect(await contract.dailyLimit(ZERO_ADDRESS)).to.be.bignumber.equal(ether('5'))
          expect(await contract.executionDailyLimit(ZERO_ADDRESS)).to.be.bignumber.equal(ether('5'))

          await contract.setDailyLimit(ZERO_ADDRESS, ZERO, { from: owner }).should.be.fulfilled
          await contract.setExecutionDailyLimit(ZERO_ADDRESS, ZERO, { from: owner }).should.be.fulfilled

          expect(await contract.dailyLimit(ZERO_ADDRESS)).to.be.bignumber.equal(ZERO)
          expect(await contract.executionDailyLimit(ZERO_ADDRESS)).to.be.bignumber.equal(ZERO)
        })

        it('should allow to update default max per tx limits', async () => {
          await contract.setMaxPerTx(ZERO_ADDRESS, ether('1.5'), { from: user }).should.be.rejected
          await contract.setExecutionMaxPerTx(ZERO_ADDRESS, ether('1.5'), { from: user }).should.be.rejected
          await contract.setMaxPerTx(ZERO_ADDRESS, ether('5'), { from: owner }).should.be.rejected
          await contract.setExecutionMaxPerTx(ZERO_ADDRESS, ether('5'), { from: owner }).should.be.rejected
          await contract.setMaxPerTx(ZERO_ADDRESS, ether('0.001'), { from: owner }).should.be.rejected
          await contract.setMaxPerTx(ZERO_ADDRESS, ether('1.5'), { from: owner }).should.be.fulfilled
          await contract.setExecutionMaxPerTx(ZERO_ADDRESS, ether('1.5'), { from: owner }).should.be.fulfilled

          expect(await contract.maxPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(ether('1.5'))
          expect(await contract.executionMaxPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(ether('1.5'))

          await contract.setMaxPerTx(ZERO_ADDRESS, ZERO, { from: owner }).should.be.fulfilled
          await contract.setExecutionMaxPerTx(ZERO_ADDRESS, ZERO, { from: owner }).should.be.fulfilled

          expect(await contract.maxPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(ZERO)
          expect(await contract.executionMaxPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(ZERO)
        })

        it('should allow to update default min per tx limit', async () => {
          await contract.setMinPerTx(ZERO_ADDRESS, ether('0.1'), { from: user }).should.be.rejected
          await contract.setMinPerTx(ZERO_ADDRESS, ZERO, { from: owner }).should.be.rejected
          await contract.setMinPerTx(ZERO_ADDRESS, ether('0.1'), { from: owner }).should.be.fulfilled

          expect(await contract.minPerTx(ZERO_ADDRESS)).to.be.bignumber.equal(ether('0.1'))

          await contract.setMinPerTx(ZERO_ADDRESS, ZERO, { from: owner }).should.be.rejected
        })

        it('should only allow to update parameters for known tokens', async () => {
          await contract.setDailyLimit(token.address, ether('5'), { from: owner }).should.be.rejected
          await contract.setMaxPerTx(token.address, ether('1.5'), { from: owner }).should.be.rejected
          await contract.setMinPerTx(token.address, ether('0.02'), { from: owner }).should.be.rejected
          await contract.setExecutionDailyLimit(token.address, ether('5'), { from: owner }).should.be.rejected
          await contract.setExecutionMaxPerTx(token.address, ether('1.5'), { from: owner }).should.be.rejected

          await token.transfer(contract.address, value, { from: user })

          await contract.setDailyLimit(token.address, ether('5'), { from: owner }).should.be.fulfilled
          await contract.setMaxPerTx(token.address, ether('1.5'), { from: owner }).should.be.fulfilled
          await contract.setMinPerTx(token.address, ether('0.02'), { from: owner }).should.be.fulfilled
          await contract.setExecutionDailyLimit(token.address, ether('6'), { from: owner }).should.be.fulfilled
          await contract.setExecutionMaxPerTx(token.address, ether('1.6'), { from: owner }).should.be.fulfilled

          expect(await contract.dailyLimit(token.address)).to.be.bignumber.equal(ether('5'))
          expect(await contract.maxPerTx(token.address)).to.be.bignumber.equal(ether('1.5'))
          expect(await contract.minPerTx(token.address)).to.be.bignumber.equal(ether('0.02'))
          expect(await contract.executionDailyLimit(token.address)).to.be.bignumber.equal(ether('6'))
          expect(await contract.executionMaxPerTx(token.address)).to.be.bignumber.equal(ether('1.6'))
        })
      })
    })

    describe('onTokenTransfer', () => {
      afterEach(async () => {
        // Total supply remains the same
        expect(await token.totalSupply()).to.be.bignumber.equal(twoEthers)
      })

      it('should call AMB bridge and lock tokens', async () => {
        expect(await contract.isTokenRegistered(token.address)).to.be.equal(false)
        // only token address can call it
        await contract.onTokenTransfer(user, halfEther, '0x', { from: owner }).should.be.rejected

        // must be within limits
        await token.transferAndCall(contract.address, twoEthers, '0x', { from: user }).should.be.rejected

        // When
        await token.transferAndCall(contract.address, halfEther, '0x', { from: user }).should.be.fulfilled

        // Then
        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        expect(events[0].returnValues.encodedData.includes(strip0x(user).toLowerCase())).to.be.equal(true)
        expect(await contract.totalSpentPerDay(token.address, currentDay)).to.be.bignumber.equal(halfEther)
        expect(await contract.mediatorBalance(token.address)).to.be.bignumber.equal(halfEther)
        expect(await contract.isTokenRegistered(token.address)).to.be.equal(true)
        expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(halfEther)
      })

      it('should respect global shutdown', async () => {
        await contract.setDailyLimit(ZERO_ADDRESS, ZERO).should.be.fulfilled
        await token.transferAndCall(contract.address, halfEther, '0x', { from: user }).should.be.rejected
        await contract.setDailyLimit(ZERO_ADDRESS, dailyLimit).should.be.fulfilled
        await token.transferAndCall(contract.address, halfEther, '0x', { from: user }).should.be.fulfilled
      })

      it('should be able to specify a different receiver', async () => {
        expect(await contract.isTokenRegistered(token.address)).to.be.equal(false)
        // must be a valid address param
        await token.transferAndCall(contract.address, halfEther, '0x00', { from: user }).should.be.rejected

        // When
        await token.transferAndCall(contract.address, halfEther, user2, { from: user }).should.be.fulfilled

        // Then
        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        expect(events[0].returnValues.encodedData.includes(strip0x(user2).toLowerCase())).to.be.equal(true)
        expect(await contract.totalSpentPerDay(token.address, currentDay)).to.be.bignumber.equal(halfEther)
        expect(await contract.mediatorBalance(token.address)).to.be.bignumber.equal(halfEther)
        expect(await contract.isTokenRegistered(token.address)).to.be.equal(true)
        expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(halfEther)
      })
    })

    describe('relayTokens', () => {
      afterEach(async () => {
        // Total supply remains the same
        expect(await token.totalSupply()).to.be.bignumber.equal(twoEthers)
      })

      it('should allow to bridge tokens using approve and relayTokens', async () => {
        // Given
        await token.approve(contract.address, value, { from: user }).should.be.fulfilled
        expect(await token.allowance(user, contract.address)).to.be.bignumber.equal(value)

        // When
        await contract.methods['relayTokens(address,address,uint256)'](token.address, user, value, { from: user })
          .should.be.fulfilled

        // Then
        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        expect(events[0].returnValues.encodedData.includes(strip0x(user).toLowerCase())).to.be.equal(true)
        expect(await contract.totalSpentPerDay(token.address, currentDay)).to.be.bignumber.equal(value)
        expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(value)
      })

      it('should allow to specify a different receiver without specifying sender', async () => {
        // Given
        await token.approve(contract.address, value, { from: user }).should.be.fulfilled
        expect(await token.allowance(user, contract.address)).to.be.bignumber.equal(value)

        // When
        await contract.methods['relayTokens(address,address,uint256)'](token.address, user2, value, { from: user })
          .should.be.fulfilled

        // Then
        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        expect(events[0].returnValues.encodedData.includes(strip0x(user2).toLowerCase())).to.be.equal(true)
        expect(await contract.totalSpentPerDay(token.address, currentDay)).to.be.bignumber.equal(value)
        expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(value)
      })

      it('should allow to specify no receiver and no sender', async () => {
        // Given
        await token.approve(contract.address, value, { from: user }).should.be.fulfilled
        expect(await token.allowance(user, contract.address)).to.be.bignumber.equal(value)

        // When
        await contract.methods['relayTokens(address,uint256)'](token.address, value, { from: user }).should.be.fulfilled

        // Then
        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        expect(events[0].returnValues.encodedData.includes(strip0x(user).toLowerCase())).to.be.equal(true)
        expect(await contract.totalSpentPerDay(token.address, currentDay)).to.be.bignumber.equal(value)
        expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(value)
      })

      it('should fail if user did not approve the transfer', async () => {
        await contract.methods['relayTokens(address,address,uint256)'](token.address, user, value, { from: user })
          .should.be.rejected
      })

      it('should fail if value is not within limits', async () => {
        await token.approve(contract.address, twoEthers, { from: user }).should.be.fulfilled
        expect(await token.allowance(user, contract.address)).to.be.bignumber.equal(twoEthers)

        await contract.methods['relayTokens(address,address,uint256)'](token.address, user, twoEthers, { from: user })
          .should.be.rejected
      })
    })

    describe('token registration', () => {
      for (const send of sendFunctions) {
        it(`should make subsequent calls deployAndHandleBridgedTokens handleBridgedTokens to when using ${send.name}`, async () => {
          const receiver = await send()

          let events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
          expect(events.length).to.be.equal(1)
          let encodedData = strip0x(events[0].returnValues.encodedData)
          const { messageId } = events[0].returnValues
          let calldata = encodedData.slice(2 * (4 + 20 + 8 + 20 + 20 + 4 + 1 + 1 + 1 + 2 + 2)) // remove AMB header
          expect(calldata.slice(0, 8)).to.be.equal('2ae87cdd')
          let args = web3.eth.abi.decodeParameters(
            ['address', 'string', 'string', 'uint8', 'address', 'uint256'],
            calldata.slice(8)
          )
          expect(args[0]).to.be.equal(token.address)
          expect(args[1]).to.be.equal(await token.name())
          expect(args[2]).to.be.equal(await token.symbol())
          expect(args[3]).to.be.equal((await token.decimals()).toString())
          expect(args[4]).to.be.equal(receiver)
          expect(args[5]).to.be.equal(value.toString())
          expect(await contract.tokenRegistrationMessageId(token.address)).to.be.equal(messageId)

          await send()

          events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
          expect(events.length).to.be.equal(2)
          encodedData = strip0x(events[1].returnValues.encodedData)
          calldata = encodedData.slice(2 * (4 + 20 + 8 + 20 + 20 + 4 + 1 + 1 + 1 + 2 + 2)) // remove AMB header
          expect(calldata.slice(0, 8)).to.be.equal('125e4cfb')
          args = web3.eth.abi.decodeParameters(['address', 'address', 'uint256'], calldata.slice(8))
          expect(args[0]).to.be.equal(token.address)
          expect(args[1]).to.be.equal(receiver)
          expect(args[2]).to.be.equal(value.toString())
        })
      }

      for (const decimals of [3, 18, 20]) {
        it(`should initialize limits according to decimals = ${decimals}`, async () => {
          const f1 = toBN(`1${'0'.repeat(decimals)}`)
          const f2 = toBN('1000000000000000000')

          token = await ERC677BridgeToken.new('TEST', 'TST', decimals)
          await token.mint(user, value.mul(f1).div(f2)).should.be.fulfilled
          await token.transfer(contract.address, value.mul(f1).div(f2), { from: user }).should.be.fulfilled

          expect(await contract.dailyLimit(token.address)).to.be.bignumber.equal(dailyLimit.mul(f1).div(f2))
          expect(await contract.maxPerTx(token.address)).to.be.bignumber.equal(maxPerTx.mul(f1).div(f2))
          expect(await contract.minPerTx(token.address)).to.be.bignumber.equal(minPerTx.mul(f1).div(f2))
          expect(await contract.executionDailyLimit(token.address)).to.be.bignumber.equal(
            executionDailyLimit.mul(f1).div(f2)
          )
          expect(await contract.executionMaxPerTx(token.address)).to.be.bignumber.equal(
            executionMaxPerTx.mul(f1).div(f2)
          )
        })
      }

      it(`should initialize limits according to decimals = 0`, async () => {
        token = await ERC677BridgeToken.new('TEST', 'TST', 0)
        await token.mint(user, '1').should.be.fulfilled
        await token.transfer(contract.address, '1', { from: user }).should.be.fulfilled

        expect(await contract.dailyLimit(token.address)).to.be.bignumber.equal('10000')
        expect(await contract.maxPerTx(token.address)).to.be.bignumber.equal('100')
        expect(await contract.minPerTx(token.address)).to.be.bignumber.equal('1')
        expect(await contract.executionDailyLimit(token.address)).to.be.bignumber.equal('10000')
        expect(await contract.executionMaxPerTx(token.address)).to.be.bignumber.equal('100')
      })
    })

    describe('handleBridgedTokens', () => {
      it('should unlock tokens on message from amb', async () => {
        await token.transfer(contract.address, value, { from: user }).should.be.fulfilled
        await token.transfer(contract.address, value, { from: user }).should.be.fulfilled
        expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(twoEthers)
        expect(await contract.mediatorBalance(token.address)).to.be.bignumber.equal(twoEthers)

        // can't be called by user
        await contract.handleBridgedTokens(token.address, user, value, { from: user }).should.be.rejected
        // can't be called by owner
        await contract.handleBridgedTokens(token.address, user, value, { from: owner }).should.be.rejected

        const data = await contract.contract.methods
          .handleBridgedTokens(token.address, user, value.toString())
          .encodeABI()

        // message must be generated by mediator contract on the other network
        await ambBridgeContract.executeMessageCall(contract.address, owner, data, failedMessageId, 1000000).should.be
          .fulfilled

        expect(await ambBridgeContract.messageCallStatus(failedMessageId)).to.be.equal(false)

        await ambBridgeContract.executeMessageCall(
          contract.address,
          otherSideMediator.address,
          data,
          exampleMessageId,
          1000000
        ).should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)

        // Then
        expect(await contract.totalExecutedPerDay(token.address, currentDay)).to.be.bignumber.equal(value)
        expect(await contract.mediatorBalance(token.address)).to.be.bignumber.equal(value)
        expect(await token.balanceOf(user)).to.be.bignumber.equal(value)
        expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(value)

        const event = await getEvents(contract, { event: 'TokensBridged' })
        expect(event.length).to.be.equal(1)
        expect(event[0].returnValues.token).to.be.equal(token.address)
        expect(event[0].returnValues.recipient).to.be.equal(user)
        expect(event[0].returnValues.value).to.be.equal(value.toString())
        expect(event[0].returnValues.messageId).to.be.equal(exampleMessageId)
      })

      it('should not allow to use unregistered tokens', async () => {
        const otherToken = await ERC20Mock.new('Test', 'TST', 18)
        await otherToken.mint(contract.address, value)
        const data = await contract.contract.methods
          .handleBridgedTokens(otherToken.address, user, value.toString())
          .encodeABI()

        await ambBridgeContract.executeMessageCall(
          contract.address,
          otherSideMediator.address,
          data,
          failedMessageId,
          1000000
        ).should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(failedMessageId)).to.be.equal(false)
      })

      it('should not allow to operate when global shutdown is enabled', async () => {
        await token.transfer(contract.address, value, { from: user }).should.be.fulfilled
        await token.transfer(contract.address, value, { from: user }).should.be.fulfilled

        const data = await contract.contract.methods
          .handleBridgedTokens(token.address, user, value.toString())
          .encodeABI()

        await contract.setExecutionDailyLimit(ZERO_ADDRESS, ZERO).should.be.fulfilled
        await ambBridgeContract.executeMessageCall(
          contract.address,
          otherSideMediator.address,
          data,
          exampleMessageId,
          1000000
        ).should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(false)
        await contract.setExecutionDailyLimit(ZERO_ADDRESS, executionDailyLimit).should.be.fulfilled
        await ambBridgeContract.executeMessageCall(
          contract.address,
          otherSideMediator.address,
          data,
          otherMessageId,
          1000000
        ).should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(otherMessageId)).to.be.equal(true)
      })
    })

    describe('requestFailedMessageFix', () => {
      it('should allow to request a failed message fix', async () => {
        // Given
        const data = await contract.contract.methods
          .handleBridgedTokens(token.address, user, value.toString())
          .encodeABI()

        await ambBridgeContract.executeMessageCall(
          contract.address,
          otherSideMediator.address,
          data,
          failedMessageId,
          100
        ).should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(failedMessageId)).to.be.equal(false)

        // When
        await contract.requestFailedMessageFix(failedMessageId).should.be.fulfilled

        // Then
        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        expect(events[0].returnValues.encodedData.includes(strip0x(failedMessageId))).to.be.equal(true)
      })

      it('should be a failed transaction', async () => {
        await token.transfer(contract.address, value, { from: user }).should.be.fulfilled
        // Given
        const data = await contract.contract.methods
          .handleBridgedTokens(token.address, user, value.toString())
          .encodeABI()

        await ambBridgeContract.executeMessageCall(
          contract.address,
          otherSideMediator.address,
          data,
          exampleMessageId,
          1000000
        ).should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)

        // When
        await contract.requestFailedMessageFix(exampleMessageId).should.be.rejected
      })

      it('should be the receiver of the failed transaction', async () => {
        // Given
        const data = await contract.contract.methods
          .handleBridgedTokens(token.address, user, value.toString())
          .encodeABI()

        await ambBridgeContract.executeMessageCall(
          ambBridgeContract.address,
          otherSideMediator.address,
          data,
          failedMessageId,
          100
        ).should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(failedMessageId)).to.be.equal(false)

        // When
        await contract.requestFailedMessageFix(failedMessageId).should.be.rejected
      })

      it('message sender should be mediator from other side', async () => {
        // Given
        const data = await contract.contract.methods
          .handleBridgedTokens(token.address, user, value.toString())
          .encodeABI()

        await ambBridgeContract.executeMessageCall(contract.address, contract.address, data, failedMessageId, 100)
          .should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(failedMessageId)).to.be.equal(false)

        // When
        await contract.requestFailedMessageFix(failedMessageId).should.be.rejected
      })

      it('should allow to request a fix multiple times', async () => {
        // Given
        const data = await contract.contract.methods
          .handleBridgedTokens(token.address, user, value.toString())
          .encodeABI()

        await ambBridgeContract.executeMessageCall(
          contract.address,
          otherSideMediator.address,
          data,
          failedMessageId,
          100
        ).should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(failedMessageId)).to.be.equal(false)

        await contract.requestFailedMessageFix(failedMessageId).should.be.fulfilled

        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        expect(events[0].returnValues.encodedData.includes(strip0x(failedMessageId))).to.be.equal(true)

        // When
        await contract.requestFailedMessageFix(failedMessageId).should.be.fulfilled

        // Then
        const allEvents = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(allEvents.length).to.be.equal(2)
        expect(allEvents[0].returnValues.encodedData.includes(strip0x(failedMessageId))).to.be.equal(true)
        expect(allEvents[1].returnValues.encodedData.includes(strip0x(failedMessageId))).to.be.equal(true)
      })
    })

    describe('fixFailedMessage', () => {
      let transferMessageId
      for (const send of sendFunctions) {
        it(`should fix tokens locked via ${send.name}`, async () => {
          expect(await token.balanceOf(user)).to.be.bignumber.equal(twoEthers)
          // User transfer tokens
          await send()
          expect(await contract.mediatorBalance(token.address)).to.be.bignumber.equal(value)

          expect(await token.balanceOf(user)).to.be.bignumber.equal(value)

          const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
          expect(events.length).to.be.equal(1)
          transferMessageId = events[0].returnValues.messageId
          // Given
          expect(await contract.messageFixed(transferMessageId)).to.be.equal(false)

          // When
          await contract.fixFailedMessage(transferMessageId, { from: user }).should.be.rejected
          await contract.fixFailedMessage(transferMessageId, { from: owner }).should.be.rejected
          const fixData = await contract.contract.methods.fixFailedMessage(transferMessageId).encodeABI()

          // Should be called by mediator from other side so it will fail
          await ambBridgeContract.executeMessageCall(
            contract.address,
            contract.address,
            fixData,
            failedMessageId,
            1000000
          ).should.be.fulfilled

          expect(await ambBridgeContract.messageCallStatus(failedMessageId)).to.be.equal(false)
          expect(await contract.messageFixed(transferMessageId)).to.be.equal(false)

          await ambBridgeContract.executeMessageCall(
            contract.address,
            otherSideMediator.address,
            fixData,
            exampleMessageId,
            1000000
          ).should.be.fulfilled

          // Then
          expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)
          expect(await token.balanceOf(user)).to.be.bignumber.equal(twoEthers)
          expect(await contract.mediatorBalance(token.address)).to.be.bignumber.equal(ZERO)
          expect(await contract.messageFixed(transferMessageId)).to.be.equal(true)
          expect(await contract.tokenRegistrationMessageId(token.address)).to.be.equal(
            '0x0000000000000000000000000000000000000000000000000000000000000000'
          )
          expect(await contract.minPerTx(token.address)).to.be.bignumber.equal('0')
          expect(await contract.maxPerTx(token.address)).to.be.bignumber.equal('0')
          expect(await contract.dailyLimit(token.address)).to.be.bignumber.equal('0')
          expect(await contract.executionMaxPerTx(token.address)).to.be.bignumber.equal('0')
          expect(await contract.executionDailyLimit(token.address)).to.be.bignumber.equal('0')

          const event = await getEvents(contract, { event: 'FailedMessageFixed' })
          expect(event.length).to.be.equal(1)
          expect(event[0].returnValues.messageId).to.be.equal(transferMessageId)
          expect(event[0].returnValues.token).to.be.equal(token.address)
          expect(event[0].returnValues.recipient).to.be.equal(user)
          expect(event[0].returnValues.value).to.be.equal(value.toString())

          // can only fix it one time
          await ambBridgeContract.executeMessageCall(
            contract.address,
            otherSideMediator.address,
            fixData,
            otherMessageId,
            1000000
          ).should.be.fulfilled

          expect(await ambBridgeContract.messageCallStatus(otherMessageId)).to.be.equal(false)
          expect(await token.balanceOf(user)).to.be.bignumber.equal(twoEthers)
          expect(await contract.mediatorBalance(token.address)).to.be.bignumber.equal(ZERO)
        })
      }
    })
  })

  describe('fixMediatorBalance', () => {
    beforeEach(async () => {
      const storageProxy = await EternalStorageProxy.new()
      await storageProxy.upgradeTo('1', contract.address).should.be.fulfilled
      contract = await ForeignMultiAMBErc20ToErc677.at(storageProxy.address)

      await token.mint(user, twoEthers, { from: owner }).should.be.fulfilled
      await token.mint(contract.address, twoEthers, { from: owner }).should.be.fulfilled

      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        owner
      ).should.be.fulfilled

      expect(await contract.totalSpentPerDay(token.address, currentDay)).to.be.bignumber.equal(ZERO)
      const initialEvents = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(initialEvents.length).to.be.equal(0)
    })

    it('should allow to fix extra mediator balance', async () => {
      expect(await contract.mediatorBalance(token.address)).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(twoEthers)

      await token.transfer(contract.address, halfEther, { from: user }).should.be.fulfilled
      await contract.setDailyLimit(token.address, ether('5')).should.be.fulfilled
      await contract.setMaxPerTx(token.address, ether('2')).should.be.fulfilled

      expect(await contract.mediatorBalance(token.address)).to.be.bignumber.equal(halfEther)
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(twoEthers.add(halfEther))
      expect(await contract.totalSpentPerDay(token.address, currentDay)).to.be.bignumber.equal(halfEther)
      let events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)

      await contract.fixMediatorBalance(token.address, owner, { from: user }).should.be.rejected
      await contract.fixMediatorBalance(ZERO_ADDRESS, owner, { from: owner }).should.be.rejected
      await contract.fixMediatorBalance(token.address, owner, { from: owner }).should.be.fulfilled
      await contract.fixMediatorBalance(token.address, owner, { from: owner }).should.be.rejected

      expect(await contract.mediatorBalance(token.address)).to.be.bignumber.equal(twoEthers.add(halfEther))
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(twoEthers.add(halfEther))

      expect(await contract.totalSpentPerDay(token.address, currentDay)).to.be.bignumber.equal(twoEthers.add(halfEther))
      events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(2)
    })

    it('should allow to fix extra mediator balance with respect to limits', async () => {
      expect(await contract.mediatorBalance(token.address)).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(twoEthers)

      await token.transfer(contract.address, halfEther, { from: user }).should.be.fulfilled

      expect(await contract.mediatorBalance(token.address)).to.be.bignumber.equal(halfEther)
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(twoEthers.add(halfEther))
      expect(await contract.totalSpentPerDay(token.address, currentDay)).to.be.bignumber.equal(halfEther)
      let events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(1)

      await contract.fixMediatorBalance(token.address, owner, { from: user }).should.be.rejected
      await contract.fixMediatorBalance(ZERO_ADDRESS, owner, { from: owner }).should.be.rejected
      await contract.fixMediatorBalance(token.address, owner, { from: owner }).should.be.fulfilled

      expect(await contract.mediatorBalance(token.address)).to.be.bignumber.equal(ether('1.5'))
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(ether('2.5'))
      expect(await contract.totalSpentPerDay(token.address, currentDay)).to.be.bignumber.equal(ether('1.5'))

      await contract.fixMediatorBalance(token.address, owner, { from: owner }).should.be.fulfilled

      expect(await contract.mediatorBalance(token.address)).to.be.bignumber.equal(twoEthers)
      expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(ether('2.5'))
      expect(await contract.totalSpentPerDay(token.address, currentDay)).to.be.bignumber.equal(twoEthers)

      await contract.fixMediatorBalance(token.address, owner, { from: owner }).should.be.rejected
      await contract.setDailyLimit(token.address, ether('1.5')).should.be.fulfilled
      await contract.fixMediatorBalance(token.address, owner, { from: owner }).should.be.rejected

      events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(events.length).to.be.equal(3)
    })
  })
})
