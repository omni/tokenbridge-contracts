const HomeMultiAMBErc20ToErc677 = artifacts.require('HomeMultiAMBErc20ToErc677.sol')
const ForeignMultiAMBErc20ToErc677 = artifacts.require('ForeignMultiAMBErc20ToErc677.sol')
const EternalStorageProxy = artifacts.require('EternalStorageProxy.sol')
const AMBMock = artifacts.require('AMBMock.sol')
const ERC677BridgeToken = artifacts.require('ERC677BridgeToken.sol')
const PermittableToken = artifacts.require('PermittableToken.sol')
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
const deployMessageId = '0x87b0c56ed7052872cd6ac5ad2e4d23b3e9bc7637837d099f083dae24aae5b2f2'
const failedMessageId = '0x2ebc2ccc755acc8eaf9252e19573af708d644ab63a39619adb080a3500a4ff2e'

contract('HomeMultiAMBErc20ToErc677', async accounts => {
  let contract
  let token
  let ambBridgeContract
  let otherSideAMBBridgeContract
  let otherSideMediator
  let currentDay
  let tokenImage
  let homeToken
  const owner = accounts[0]
  const user = accounts[1]
  const user2 = accounts[2]
  const value = oneEther
  beforeEach(async () => {
    contract = await HomeMultiAMBErc20ToErc677.new()
    ambBridgeContract = await AMBMock.new()
    otherSideAMBBridgeContract = await AMBMock.new()
    await ambBridgeContract.setMaxGasPerTx(maxGasPerTx)
    await otherSideAMBBridgeContract.setMaxGasPerTx(maxGasPerTx)
    otherSideMediator = await ForeignMultiAMBErc20ToErc677.new()
    await otherSideMediator.initialize(
      otherSideAMBBridgeContract.address,
      contract.address,
      [dailyLimit, maxPerTx, minPerTx],
      [executionDailyLimit, executionMaxPerTx],
      maxGasPerTx,
      owner
    )
    token = await ERC677BridgeToken.new('TEST', 'TST', 18)
    tokenImage = await PermittableToken.new('TEST', 'TST', 18, 1337)
    currentDay = await contract.getCurrentDay()
  })

  const sendFunctions = [
    async function simpleTransfer() {
      await homeToken.transfer(contract.address, value, { from: user }).should.be.fulfilled
      return user
    },
    async function emptyAlternativeReceiver() {
      await homeToken.transferAndCall(contract.address, value, '0x', { from: user }).should.be.fulfilled
      return user
    },
    async function sameAlternativeReceiver() {
      await homeToken.transferAndCall(contract.address, value, user, { from: user }).should.be.fulfilled
      return user
    },
    async function differentAlternativeReceiver() {
      await homeToken.transferAndCall(contract.address, value, user2, { from: user }).should.be.fulfilled
      return user2
    },
    async function simpleRelayTokens1() {
      await homeToken.approve(contract.address, value, { from: user }).should.be.fulfilled
      await contract.methods['relayTokens(address,uint256)'](homeToken.address, value, { from: user }).should.be
        .fulfilled
      return user
    },
    async function simpleRelayTokens2() {
      await homeToken.approve(contract.address, value, { from: user }).should.be.fulfilled
      await contract.methods['relayTokens(address,address,uint256)'](homeToken.address, user, value, { from: user })
        .should.be.fulfilled
      return user
    },
    async function relayTokensWithAlternativeReceiver1() {
      await homeToken.approve(contract.address, value, { from: user }).should.be.fulfilled
      await contract.methods['relayTokens(address,address,uint256)'](homeToken.address, user2, value, { from: user })
        .should.be.fulfilled
      return user2
    },
    async function relayTokensWithAlternativeReceiver2() {
      await homeToken.approve(contract.address, value, { from: user }).should.be.fulfilled
      await contract.methods['relayTokens(address,address,address,uint256)'](homeToken.address, user, user2, value, {
        from: user
      }).should.be.fulfilled
      return user2
    },
    async function relayTokensForOtherUser() {
      await homeToken.approve(contract.address, value, { from: user }).should.be.fulfilled
      await contract.methods['relayTokens(address,address,address,uint256)'](homeToken.address, user, user, value, {
        from: user2
      }).should.be.fulfilled
      return user
    }
  ]

  async function bridgeToken(token, value = oneEther, forceFail = false) {
    await token.mint(user, value).should.be.fulfilled
    const { receipt } = await token.transfer(otherSideMediator.address, value, { from: user }).should.be.fulfilled
    const encodedData = strip0x(
      web3.eth.abi.decodeParameters(
        ['bytes'],
        receipt.rawLogs.find(log => log.address === otherSideAMBBridgeContract.address).data
      )[0]
    )
    const data = `0x${encodedData.slice(2 * (4 + 20 + 8 + 20 + 20 + 4 + 1 + 1 + 1 + 2 + 2))}` // remove AMB header
    await ambBridgeContract.executeMessageCall(
      contract.address,
      otherSideMediator.address,
      data,
      deployMessageId,
      forceFail ? 100 : 2000000
    ).should.be.fulfilled

    expect(await ambBridgeContract.messageCallStatus(deployMessageId)).to.be.equal(!forceFail)

    if (forceFail) return null

    const events = await getEvents(contract, { event: 'NewTokenRegistered' })
    expect(events.length).to.be.equal(1)
    expect(events[0].returnValues.foreignToken).to.be.equal(token.address)
    const homeToken = await PermittableToken.at(events[0].returnValues.homeToken)
    const fee = await contract.getFee(await contract.FOREIGN_TO_HOME_FEE(), ZERO_ADDRESS)
    const rewardAccounts = (await contract.rewardAddressCount()).toNumber()
    const bridgedValue =
      rewardAccounts > 0
        ? toBN(value)
            .mul(oneEther.sub(fee))
            .div(oneEther)
        : value
    expect(await homeToken.balanceOf(user)).to.be.bignumber.equal(bridgedValue)
    return homeToken
  }

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
      expect(await contract.tokenImage()).to.be.equal(ZERO_ADDRESS)

      // When
      // not valid bridge address
      await contract.initialize(
        ZERO_ADDRESS,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        owner,
        tokenImage.address,
        [],
        [ZERO, ZERO]
      ).should.be.rejected

      // dailyLimit > maxPerTx
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [maxPerTx, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        owner,
        tokenImage.address,
        [],
        [ZERO, ZERO]
      ).should.be.rejected

      // maxPerTx > minPerTx
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, minPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        owner,
        tokenImage.address,
        [],
        [ZERO, ZERO]
      ).should.be.rejected

      // executionDailyLimit > executionMaxPerTx
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionDailyLimit],
        maxGasPerTx,
        owner,
        tokenImage.address,
        [],
        [ZERO, ZERO]
      ).should.be.rejected

      // maxGasPerTx > bridge maxGasPerTx
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        twoEthers,
        owner,
        tokenImage.address,
        [],
        [ZERO, ZERO]
      ).should.be.rejected

      // not valid owner
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        ZERO_ADDRESS,
        tokenImage.address,
        [],
        [ZERO, ZERO]
      ).should.be.rejected

      // token image is not a contract
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        owner,
        owner,
        [],
        [ZERO, ZERO]
      ).should.be.rejected

      const { logs } = await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        owner,
        tokenImage.address,
        [],
        [ZERO, ZERO]
      ).should.be.fulfilled

      // already initialized
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        owner,
        tokenImage.address,
        [],
        [ZERO, ZERO]
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
      expect(await contract.tokenImage()).to.be.equal(tokenImage.address)

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
      contract = await HomeMultiAMBErc20ToErc677.at(storageProxy.address)
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        owner,
        tokenImage.address,
        [user2],
        [ether('0.1'), ZERO]
      ).should.be.fulfilled
    })

    it('should only work with unknown token', async () => {
      const homeToken = await bridgeToken(token)

      await contract.claimTokens(homeToken.address, accounts[3], { from: user }).should.be.rejected
      await contract.claimTokens(homeToken.address, accounts[3], { from: owner }).should.be.rejected

      token = await ERC677BridgeToken.new('Test', 'TST', 18)

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
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        owner,
        tokenImage.address,
        [],
        [ZERO, ZERO]
      ).should.be.fulfilled

      const initialEvents = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(initialEvents.length).to.be.equal(0)
    })

    describe('deploy and register new token', () => {
      it('can be called only by mediator from the other side', async () => {
        await contract.deployAndHandleBridgedTokens(token.address, 'TOKEN', 'TOK', 18, user, value, { from: owner })
          .should.be.rejected
        const data = await contract.contract.methods
          .deployAndHandleBridgedTokens(token.address, 'TOKEN', 'TOK', 18, user, value.toString())
          .encodeABI()
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
      })

      it('should register new token in deployAndHandleBridgedTokens', async () => {
        const homeToken = await bridgeToken(token)

        expect(await homeToken.name()).to.be.equal('TEST on xDai')
        expect(await homeToken.symbol()).to.be.equal('TST')
        expect(await homeToken.decimals()).to.be.bignumber.equal('18')
        expect(await homeToken.version()).to.be.equal('1')
        expect(await homeToken.owner()).to.be.equal(contract.address)
        expect(await homeToken.bridgeContract()).to.be.equal(contract.address)
        expect(await homeToken.totalSupply()).to.be.bignumber.equal(value)
        expect(await homeToken.balanceOf(user)).to.be.bignumber.equal(value)
        expect(await contract.homeTokenAddress(token.address)).to.be.equal(homeToken.address)
        expect(await contract.foreignTokenAddress(homeToken.address)).to.be.equal(token.address)
      })

      it('should register new token with empty name', async () => {
        token = await ERC677BridgeToken.new('', 'TST', 18)
        const homeToken = await bridgeToken(token)

        expect(await homeToken.name()).to.be.equal('TST on xDai')
        expect(await homeToken.symbol()).to.be.equal('TST')
        expect(await homeToken.decimals()).to.be.bignumber.equal('18')
      })

      it('should register new token with empty symbol', async () => {
        token = await ERC677BridgeToken.new('TEST', '', 18)
        const homeToken = await bridgeToken(token)

        expect(await homeToken.name()).to.be.equal('TEST on xDai')
        expect(await homeToken.symbol()).to.be.equal('TEST')
        expect(await homeToken.decimals()).to.be.bignumber.equal('18')
      })

      for (const decimals of [3, 18, 20]) {
        it(`should initialize limits according to decimals = ${decimals}`, async () => {
          const f1 = toBN(`1${'0'.repeat(decimals)}`)
          const f2 = toBN('1000000000000000000')

          token = await ERC677BridgeToken.new('TEST', 'TST', decimals)
          token = await bridgeToken(token, value.mul(f1).div(f2))

          expect(await token.decimals()).to.be.bignumber.equal(decimals.toString())
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
        token = await bridgeToken(token, '1')

        expect(await token.decimals()).to.be.bignumber.equal('0')
        expect(await contract.dailyLimit(token.address)).to.be.bignumber.equal('10000')
        expect(await contract.maxPerTx(token.address)).to.be.bignumber.equal('100')
        expect(await contract.minPerTx(token.address)).to.be.bignumber.equal('1')
        expect(await contract.executionDailyLimit(token.address)).to.be.bignumber.equal('10000')
        expect(await contract.executionMaxPerTx(token.address)).to.be.bignumber.equal('100')
      })

      it('should initialize fees', async () => {
        const HOME_TO_FOREIGN_FEE = await contract.HOME_TO_FOREIGN_FEE()
        const FOREIGN_TO_HOME_FEE = await contract.FOREIGN_TO_HOME_FEE()
        await contract.setFee(HOME_TO_FOREIGN_FEE, ZERO_ADDRESS, ether('0.01'))
        await contract.setFee(FOREIGN_TO_HOME_FEE, ZERO_ADDRESS, ether('0.02'))

        expect(await contract.getFee(HOME_TO_FOREIGN_FEE, ZERO_ADDRESS)).to.be.bignumber.equal(ether('0.01'))
        expect(await contract.getFee(FOREIGN_TO_HOME_FEE, ZERO_ADDRESS)).to.be.bignumber.equal(ether('0.02'))
        expect(await contract.getFee(HOME_TO_FOREIGN_FEE, token.address)).to.be.bignumber.equal(ZERO)
        expect(await contract.getFee(FOREIGN_TO_HOME_FEE, token.address)).to.be.bignumber.equal(ZERO)

        const homeToken = await bridgeToken(token)

        expect(await contract.getFee(HOME_TO_FOREIGN_FEE, ZERO_ADDRESS)).to.be.bignumber.equal(ether('0.01'))
        expect(await contract.getFee(FOREIGN_TO_HOME_FEE, ZERO_ADDRESS)).to.be.bignumber.equal(ether('0.02'))
        expect(await contract.getFee(HOME_TO_FOREIGN_FEE, homeToken.address)).to.be.bignumber.equal(ether('0.01'))
        expect(await contract.getFee(FOREIGN_TO_HOME_FEE, homeToken.address)).to.be.bignumber.equal(ether('0.02'))
      })
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

          token = await bridgeToken(token)

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

      describe('tokenImage', () => {
        it('should allow to change token image', async () => {
          expect(await contract.tokenImage()).to.be.equal(tokenImage.address)
          await contract.setTokenImage(token.address, { from: user }).should.be.rejected
          await contract.setTokenImage(owner, { from: owner }).should.be.rejected
          await contract.setTokenImage(token.address, { from: owner }).should.be.fulfilled
          expect(await contract.tokenImage()).to.be.equal(token.address)
        })
      })
    })

    describe('onTokenTransfer', () => {
      beforeEach(async () => {
        homeToken = await bridgeToken(token)
        expect(await contract.isTokenRegistered(token.address)).to.be.equal(false)
        expect(await contract.isTokenRegistered(homeToken.address)).to.be.equal(true)
      })

      it('should call AMB bridge and burn tokens', async () => {
        // only token address can call it
        await contract.onTokenTransfer(user, halfEther, '0x', { from: owner }).should.be.rejected

        // must be within limits
        await homeToken.transferAndCall(contract.address, ether('0.001'), '0x', { from: user }).should.be.rejected

        // When
        await homeToken.transferAndCall(contract.address, halfEther, '0x', { from: user }).should.be.fulfilled

        // Then
        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        expect(events[0].returnValues.encodedData.includes(strip0x(token.address).toLowerCase())).to.be.equal(true)
        expect(events[0].returnValues.encodedData.includes(strip0x(user).toLowerCase())).to.be.equal(true)
        expect(await contract.totalSpentPerDay(homeToken.address, currentDay)).to.be.bignumber.equal(halfEther)
        expect(await homeToken.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
      })

      it('should respect global shutdown', async () => {
        await contract.setDailyLimit(ZERO_ADDRESS, ZERO).should.be.fulfilled
        await homeToken.transferAndCall(contract.address, halfEther, '0x', { from: user }).should.be.rejected
        await contract.setDailyLimit(ZERO_ADDRESS, dailyLimit).should.be.fulfilled
        await homeToken.transferAndCall(contract.address, halfEther, '0x', { from: user }).should.be.fulfilled
      })

      it('should be able to specify a different receiver', async () => {
        // must be a valid address param
        await homeToken.transferAndCall(contract.address, halfEther, '0x00', { from: user }).should.be.rejected

        // When
        await homeToken.transferAndCall(contract.address, halfEther, user2, { from: user }).should.be.fulfilled

        // Then
        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        expect(events[0].returnValues.encodedData.includes(strip0x(token.address).toLowerCase())).to.be.equal(true)
        expect(events[0].returnValues.encodedData.includes(strip0x(user2).toLowerCase())).to.be.equal(true)
        expect(await contract.totalSpentPerDay(homeToken.address, currentDay)).to.be.bignumber.equal(halfEther)
        expect(await homeToken.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
      })
    })

    describe('relayTokens', () => {
      beforeEach(async () => {
        homeToken = await bridgeToken(token)
        expect(await contract.isTokenRegistered(token.address)).to.be.equal(false)
        expect(await contract.isTokenRegistered(homeToken.address)).to.be.equal(true)
      })

      it('should allow to bridge tokens using approve and relayTokens', async () => {
        // Given
        await homeToken.approve(contract.address, value, { from: user }).should.be.fulfilled
        expect(await homeToken.allowance(user, contract.address)).to.be.bignumber.equal(value)

        // When
        await contract.methods['relayTokens(address,address,uint256)'](homeToken.address, user, value, { from: user })
          .should.be.fulfilled

        // Then
        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        expect(events[0].returnValues.encodedData.includes(strip0x(token.address).toLowerCase())).to.be.equal(true)
        expect(events[0].returnValues.encodedData.includes(strip0x(user).toLowerCase())).to.be.equal(true)
        expect(await contract.totalSpentPerDay(homeToken.address, currentDay)).to.be.bignumber.equal(value)
        expect(await homeToken.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
      })

      it('should allow user to specify a itself as receiver', async () => {
        // Given
        await homeToken.approve(contract.address, value, { from: user }).should.be.fulfilled
        expect(await homeToken.allowance(user, contract.address)).to.be.bignumber.equal(value)

        // When
        await contract.methods['relayTokens(address,address,address,uint256)'](homeToken.address, user, user, value, {
          from: user
        }).should.be.fulfilled

        // Then
        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        expect(events[0].returnValues.encodedData.includes(strip0x(token.address).toLowerCase())).to.be.equal(true)
        expect(events[0].returnValues.encodedData.includes(strip0x(user).toLowerCase())).to.be.equal(true)
        expect(await contract.totalSpentPerDay(homeToken.address, currentDay)).to.be.bignumber.equal(value)
        expect(await homeToken.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
      })

      it('should allow to specify a different receiver', async () => {
        // Given
        await homeToken.approve(contract.address, value, { from: user }).should.be.fulfilled
        expect(await homeToken.allowance(user, contract.address)).to.be.bignumber.equal(value)

        // When
        await contract.methods['relayTokens(address,address,address,uint256)'](homeToken.address, user, user2, value, {
          from: user
        }).should.be.fulfilled

        // Then
        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        expect(events[0].returnValues.encodedData.includes(strip0x(token.address).toLowerCase())).to.be.equal(true)
        expect(events[0].returnValues.encodedData.includes(strip0x(user2).toLowerCase())).to.be.equal(true)
        expect(await contract.totalSpentPerDay(homeToken.address, currentDay)).to.be.bignumber.equal(value)
        expect(await homeToken.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
      })

      it('should allow to specify a different receiver without specifying sender', async () => {
        // Given
        await homeToken.approve(contract.address, value, { from: user }).should.be.fulfilled
        expect(await homeToken.allowance(user, contract.address)).to.be.bignumber.equal(value)

        // When
        await contract.methods['relayTokens(address,address,uint256)'](homeToken.address, user2, value, { from: user })
          .should.be.fulfilled

        // Then
        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        expect(events[0].returnValues.encodedData.includes(strip0x(token.address).toLowerCase())).to.be.equal(true)
        expect(events[0].returnValues.encodedData.includes(strip0x(user2).toLowerCase())).to.be.equal(true)
        expect(await contract.totalSpentPerDay(homeToken.address, currentDay)).to.be.bignumber.equal(value)
        expect(await homeToken.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
      })

      it('should allow to specify no receiver and no sender', async () => {
        // Given
        await homeToken.approve(contract.address, value, { from: user }).should.be.fulfilled
        expect(await homeToken.allowance(user, contract.address)).to.be.bignumber.equal(value)

        // When
        await contract.methods['relayTokens(address,uint256)'](homeToken.address, value, { from: user }).should.be
          .fulfilled

        // Then
        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        expect(events[0].returnValues.encodedData.includes(strip0x(token.address).toLowerCase())).to.be.equal(true)
        expect(events[0].returnValues.encodedData.includes(strip0x(user).toLowerCase())).to.be.equal(true)
        expect(await contract.totalSpentPerDay(homeToken.address, currentDay)).to.be.bignumber.equal(value)
        expect(await homeToken.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
      })

      it('should allow to complete a transfer approved by other user', async () => {
        // Given
        await homeToken.approve(contract.address, value, { from: user }).should.be.fulfilled
        expect(await homeToken.allowance(user, contract.address)).to.be.bignumber.equal(value)

        // When
        await contract.methods['relayTokens(address,address,address,uint256)'](homeToken.address, user, user2, value, {
          from: user2
        }).should.be.rejected
        await contract.methods['relayTokens(address,address,address,uint256)'](homeToken.address, user, user, value, {
          from: user2
        }).should.be.fulfilled

        // Then
        const events = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
        expect(events.length).to.be.equal(1)
        expect(events[0].returnValues.encodedData.includes(strip0x(token.address).toLowerCase())).to.be.equal(true)
        expect(events[0].returnValues.encodedData.includes(strip0x(user).toLowerCase())).to.be.equal(true)
        expect(await contract.totalSpentPerDay(homeToken.address, currentDay)).to.be.bignumber.equal(value)
        expect(await homeToken.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
      })

      it('should fail if user did not approve the transfer', async () => {
        await contract.methods['relayTokens(address,address,uint256)'](homeToken.address, user, value, { from: user })
          .should.be.rejected
      })

      it('should fail if value is not within limits', async () => {
        await homeToken.approve(contract.address, twoEthers, { from: user }).should.be.fulfilled
        expect(await homeToken.allowance(user, contract.address)).to.be.bignumber.equal(twoEthers)

        await contract.methods['relayTokens(address,address,uint256)'](homeToken.address, user, ether('0.0001'), {
          from: user
        }).should.be.rejected
      })
    })

    describe('handleBridgedTokens', () => {
      beforeEach(async () => {
        homeToken = await bridgeToken(token)
      })

      it('should mint tokens on message from amb', async () => {
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
        expect(await contract.totalExecutedPerDay(homeToken.address, currentDay)).to.be.bignumber.equal(twoEthers)
        expect(await homeToken.balanceOf(user)).to.be.bignumber.equal(twoEthers)
        expect(await homeToken.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)

        const event = await getEvents(contract, { event: 'TokensBridged' })
        expect(event.length).to.be.equal(2)
        expect(event[1].returnValues.token).to.be.equal(homeToken.address)
        expect(event[1].returnValues.recipient).to.be.equal(user)
        expect(event[1].returnValues.value).to.be.equal(value.toString())
        expect(event[1].returnValues.messageId).to.be.equal(exampleMessageId)
      })

      it('should not allow to operate when global shutdown is enabled', async () => {
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

      it('should not allow to use unregistered tokens', async () => {
        const data = await contract.contract.methods
          .handleBridgedTokens(homeToken.address, user, value.toString())
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
    })

    describe('requestFailedMessageFix for token registration', () => {
      it('should allow to request fix of first bridge operation for some token', async () => {
        await bridgeToken(token, value, true)

        await contract.requestFailedMessageFix(deployMessageId).should.be.fulfilled
      })
    })

    describe('requestFailedMessageFix', () => {
      beforeEach(async () => {
        await bridgeToken(token)
      })

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

      beforeEach(async () => {
        homeToken = await bridgeToken(token)
      })

      for (const send of sendFunctions) {
        it(`should fix tokens burnt via ${send.name}`, async () => {
          expect(await homeToken.balanceOf(user)).to.be.bignumber.equal(value)
          // User transfer tokens
          await send()

          expect(await homeToken.balanceOf(user)).to.be.bignumber.equal(ZERO)

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
          expect(await homeToken.balanceOf(user)).to.be.bignumber.equal(value)
          expect(await contract.messageFixed(transferMessageId)).to.be.equal(true)

          const event = await getEvents(contract, { event: 'FailedMessageFixed' })
          expect(event.length).to.be.equal(1)
          expect(event[0].returnValues.messageId).to.be.equal(transferMessageId)
          expect(event[0].returnValues.token).to.be.equal(homeToken.address)
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
          expect(await homeToken.balanceOf(user)).to.be.bignumber.equal(value)
        })
      }
    })
  })

  describe('fees management', () => {
    beforeEach(async () => {
      await contract.initialize(
        ambBridgeContract.address,
        otherSideMediator.address,
        [dailyLimit, maxPerTx, minPerTx],
        [executionDailyLimit, executionMaxPerTx],
        maxGasPerTx,
        owner,
        tokenImage.address,
        [owner],
        [ether('0.02'), ether('0.01')]
      ).should.be.fulfilled

      const initialEvents = await getEvents(ambBridgeContract, { event: 'MockedEvent' })
      expect(initialEvents.length).to.be.equal(0)
    })

    it('change reward addresses', async () => {
      await contract.addRewardAddress(accounts[8], { from: user }).should.be.rejected
      await contract.addRewardAddress(owner).should.be.rejected
      await contract.addRewardAddress(accounts[8]).should.be.fulfilled

      expect(await contract.rewardAddressList()).to.be.eql([accounts[8], owner])
      expect(await contract.rewardAddressCount()).to.be.bignumber.equal('2')
      expect(await contract.isRewardAddress(owner)).to.be.equal(true)
      expect(await contract.isRewardAddress(accounts[8])).to.be.equal(true)

      await contract.addRewardAddress(accounts[9]).should.be.fulfilled
      expect(await contract.rewardAddressList()).to.be.eql([accounts[9], accounts[8], owner])
      expect(await contract.rewardAddressCount()).to.be.bignumber.equal('3')

      await contract.removeRewardAddress(owner, { from: user }).should.be.rejected
      await contract.removeRewardAddress(accounts[7]).should.be.rejected
      await contract.removeRewardAddress(accounts[8]).should.be.fulfilled
      await contract.removeRewardAddress(accounts[8]).should.be.rejected

      expect(await contract.rewardAddressList()).to.be.eql([accounts[9], owner])
      expect(await contract.rewardAddressCount()).to.be.bignumber.equal('2')
      expect(await contract.isRewardAddress(accounts[8])).to.be.equal(false)

      await contract.removeRewardAddress(owner).should.be.fulfilled
      expect(await contract.rewardAddressList()).to.be.eql([accounts[9]])
      expect(await contract.rewardAddressCount()).to.be.bignumber.equal('1')
      expect(await contract.isRewardAddress(owner)).to.be.equal(false)

      await contract.removeRewardAddress(accounts[9]).should.be.fulfilled
      expect(await contract.rewardAddressList()).to.be.eql([])
      expect(await contract.rewardAddressCount()).to.be.bignumber.equal('0')
      expect(await contract.isRewardAddress(accounts[9])).to.be.equal(false)
    })

    describe('update fee parameters', () => {
      it('should update default fee value', async () => {
        const feeType = await contract.HOME_TO_FOREIGN_FEE()
        await contract.setFee(feeType, ZERO_ADDRESS, ether('0.1'), { from: user }).should.be.rejected
        await contract.setFee(feeType, ZERO_ADDRESS, ether('1.1'), { from: owner }).should.be.rejected
        const { logs } = await contract.setFee(feeType, ZERO_ADDRESS, ether('0.1'), { from: owner }).should.be.fulfilled

        expectEventInLogs(logs, 'FeeUpdated')
        expect(await contract.getFee(feeType, ZERO_ADDRESS)).to.be.bignumber.equal(ether('0.1'))
        expect(await contract.getFee(await contract.FOREIGN_TO_HOME_FEE(), ZERO_ADDRESS)).to.be.bignumber.equal(
          ether('0.01')
        )
      })

      it('should update default opposite direction fee value', async () => {
        const feeType = await contract.FOREIGN_TO_HOME_FEE()
        await contract.setFee(feeType, ZERO_ADDRESS, ether('0.1'), { from: user }).should.be.rejected
        await contract.setFee(feeType, ZERO_ADDRESS, ether('1.1'), { from: owner }).should.be.rejected
        const { logs } = await contract.setFee(feeType, ZERO_ADDRESS, ether('0.1'), { from: owner }).should.be.fulfilled

        expectEventInLogs(logs, 'FeeUpdated')
        expect(await contract.getFee(feeType, ZERO_ADDRESS)).to.be.bignumber.equal(ether('0.1'))
        expect(await contract.getFee(await contract.HOME_TO_FOREIGN_FEE(), ZERO_ADDRESS)).to.be.bignumber.equal(
          ether('0.02')
        )
      })

      it('should update fee value for registered token', async () => {
        const feeType = await contract.HOME_TO_FOREIGN_FEE()
        await token.mint(user, twoEthers, { from: owner }).should.be.fulfilled

        await contract.setFee(feeType, token.address, ether('0.1'), { from: user }).should.be.rejected
        await contract.setFee(feeType, token.address, ether('1.1'), { from: owner }).should.be.rejected
        await contract.setFee(feeType, token.address, ether('0.1'), { from: owner }).should.be.rejected

        token = await bridgeToken(token)

        await contract.setFee(feeType, token.address, ether('0.1'), { from: user }).should.be.rejected
        await contract.setFee(feeType, token.address, ether('1.1'), { from: owner }).should.be.rejected
        const { logs } = await contract.setFee(feeType, token.address, ether('0.1'), { from: owner }).should.be
          .fulfilled

        expectEventInLogs(logs, 'FeeUpdated')
        expect(await contract.getFee(feeType, token.address)).to.be.bignumber.equal(ether('0.1'))
        expect(await contract.getFee(await contract.FOREIGN_TO_HOME_FEE(), token.address)).to.be.bignumber.equal(
          ether('0.01')
        )
      })

      it('should update opposite direction fee value for registered token', async () => {
        const feeType = await contract.FOREIGN_TO_HOME_FEE()
        await token.mint(user, twoEthers, { from: owner }).should.be.fulfilled

        await contract.setFee(feeType, token.address, ether('0.1'), { from: user }).should.be.rejected
        await contract.setFee(feeType, token.address, ether('1.1'), { from: owner }).should.be.rejected
        await contract.setFee(feeType, token.address, ether('0.1'), { from: owner }).should.be.rejected
        token = await bridgeToken(token)
        await contract.setFee(feeType, token.address, ether('0.1'), { from: user }).should.be.rejected
        await contract.setFee(feeType, token.address, ether('1.1'), { from: owner }).should.be.rejected
        const { logs } = await contract.setFee(feeType, token.address, ether('0.1'), { from: owner }).should.be
          .fulfilled

        expectEventInLogs(logs, 'FeeUpdated')
        expect(await contract.getFee(feeType, token.address)).to.be.bignumber.equal(ether('0.1'))
        expect(await contract.getFee(await contract.HOME_TO_FOREIGN_FEE(), token.address)).to.be.bignumber.equal(
          ether('0.02')
        )
      })
    })

    describe('distribute fee for foreign => home direction', async () => {
      beforeEach(async () => {
        await token.mint(user, twoEthers, { from: owner }).should.be.fulfilled
        expect(await token.balanceOf(user)).to.be.bignumber.equal(twoEthers)
      })

      it('should collect and distribute 0% fee', async () => {
        await contract.setFee(await contract.FOREIGN_TO_HOME_FEE(), ZERO_ADDRESS, ZERO).should.be.fulfilled
        const homeToken = await bridgeToken(token)

        let event = await getEvents(contract, { event: 'TokensBridged' })
        expect(event.length).to.be.equal(1)
        expect(event[0].returnValues.token).to.be.equal(homeToken.address)
        expect(event[0].returnValues.recipient).to.be.equal(user)
        expect(event[0].returnValues.value).to.be.equal(value.toString())
        expect(event[0].returnValues.messageId).to.be.equal(deployMessageId)

        let feeEvents = await getEvents(contract, { event: 'FeeDistributed' })
        expect(feeEvents.length).to.be.equal(0)

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
        expect(await contract.totalExecutedPerDay(homeToken.address, currentDay)).to.be.bignumber.equal(twoEthers)

        event = await getEvents(contract, { event: 'TokensBridged' })
        expect(event.length).to.be.equal(2)
        expect(event[1].returnValues.token).to.be.equal(homeToken.address)
        expect(event[1].returnValues.recipient).to.be.equal(user)
        expect(event[1].returnValues.value).to.be.equal(value.toString())
        expect(event[1].returnValues.messageId).to.be.equal(exampleMessageId)

        feeEvents = await getEvents(contract, { event: 'FeeDistributed' })
        expect(feeEvents.length).to.be.equal(0)

        expect(await homeToken.balanceOf(user)).to.be.bignumber.equal(twoEthers)
        expect(await homeToken.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
        expect(await homeToken.balanceOf(owner)).to.be.bignumber.equal(ZERO)
      })

      it('should collect and distribute 1% fee', async () => {
        const homeToken = await bridgeToken(token)

        let event = await getEvents(contract, { event: 'TokensBridged' })
        expect(event.length).to.be.equal(1)
        expect(event[0].returnValues.token).to.be.equal(homeToken.address)
        expect(event[0].returnValues.recipient).to.be.equal(user)
        expect(event[0].returnValues.value).to.be.equal(ether('0.99').toString())
        expect(event[0].returnValues.messageId).to.be.equal(deployMessageId)

        let feeEvents = await getEvents(contract, { event: 'FeeDistributed' })
        expect(feeEvents.length).to.be.equal(1)

        expect(await homeToken.balanceOf(user)).to.be.bignumber.equal(ether('0.99'))
        expect(await homeToken.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
        expect(await homeToken.balanceOf(owner)).to.be.bignumber.equal(ether('0.01'))

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
        expect(await contract.totalExecutedPerDay(homeToken.address, currentDay)).to.be.bignumber.equal(twoEthers)

        event = await getEvents(contract, { event: 'TokensBridged' })
        expect(event.length).to.be.equal(2)
        expect(event[1].returnValues.token).to.be.equal(homeToken.address)
        expect(event[1].returnValues.recipient).to.be.equal(user)
        expect(event[1].returnValues.value).to.be.equal(ether('0.99').toString())
        expect(event[1].returnValues.messageId).to.be.equal(exampleMessageId)

        feeEvents = await getEvents(contract, { event: 'FeeDistributed' })
        expect(feeEvents.length).to.be.equal(2)

        expect(await homeToken.balanceOf(user)).to.be.bignumber.equal(ether('1.98'))
        expect(await homeToken.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
        expect(await homeToken.balanceOf(owner)).to.be.bignumber.equal(ether('0.02'))
      })

      it('should collect and distribute 1% fee between two reward addresses', async () => {
        await contract.addRewardAddress(accounts[9]).should.be.fulfilled
        expect(await contract.rewardAddressCount()).to.be.bignumber.equal('2')
        const homeToken = await bridgeToken(token, ether('0.200000000000000100'))

        let event = await getEvents(contract, { event: 'TokensBridged' })
        expect(event.length).to.be.equal(1)

        let feeEvents = await getEvents(contract, { event: 'FeeDistributed' })
        expect(feeEvents.length).to.be.equal(1)

        expect(await homeToken.balanceOf(user)).to.be.bignumber.equal(ether('0.198000000000000099'))
        expect(await homeToken.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
        const balance1 = (await homeToken.balanceOf(owner)).toString()
        const balance2 = (await homeToken.balanceOf(accounts[9])).toString()
        expect(
          (balance1 === '1000000000000001' && balance2 === '1000000000000000') ||
            (balance1 === '1000000000000000' && balance2 === '1000000000000001')
        ).to.be.equal(true)

        const data = await contract.contract.methods
          .handleBridgedTokens(token.address, user, ether('0.200000000000000100').toString(10))
          .encodeABI()

        await ambBridgeContract.executeMessageCall(
          contract.address,
          otherSideMediator.address,
          data,
          exampleMessageId,
          1000000
        ).should.be.fulfilled

        expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)
        expect(await contract.totalExecutedPerDay(homeToken.address, currentDay)).to.be.bignumber.equal(
          ether('0.400000000000000200')
        )

        event = await getEvents(contract, { event: 'TokensBridged' })
        expect(event.length).to.be.equal(2)

        feeEvents = await getEvents(contract, { event: 'FeeDistributed' })
        expect(feeEvents.length).to.be.equal(2)
      })
    })

    describe('distribute fee for home => foreign direction', async () => {
      beforeEach(async () => {
        await contract.setFee(await contract.FOREIGN_TO_HOME_FEE(), ZERO_ADDRESS, ZERO).should.be.fulfilled
        const homeToken = await bridgeToken(token)

        const data = await contract.contract.methods
          .handleBridgedTokens(token.address, user, value.toString(10))
          .encodeABI()

        await ambBridgeContract.executeMessageCall(
          contract.address,
          otherSideMediator.address,
          data,
          exampleMessageId,
          1000000
        ).should.be.fulfilled
        expect(await ambBridgeContract.messageCallStatus(exampleMessageId)).to.be.equal(true)

        token = homeToken
      })

      it('should collect and distribute 0% fee', async () => {
        await contract.setFee(await contract.HOME_TO_FOREIGN_FEE(), token.address, ZERO).should.be.fulfilled

        expect(await contract.totalSpentPerDay(token.address, currentDay)).to.be.bignumber.equal(ZERO)
        await token.transfer(contract.address, value, { from: user })
        expect(await contract.totalSpentPerDay(token.address, currentDay)).to.be.bignumber.equal(value)
        expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
        await token.transfer(contract.address, value, { from: user })
        expect(await contract.totalSpentPerDay(token.address, currentDay)).to.be.bignumber.equal(twoEthers)
        expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)

        const feeEvents = await getEvents(contract, { event: 'FeeDistributed' })
        expect(feeEvents.length).to.be.equal(0)
      })

      it('should collect and distribute 2% fee', async () => {
        expect(await contract.totalSpentPerDay(token.address, currentDay)).to.be.bignumber.equal(ZERO)
        await token.transfer(contract.address, value, { from: user })
        expect(await contract.totalSpentPerDay(token.address, currentDay)).to.be.bignumber.equal(value)
        expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
        expect(await token.balanceOf(owner)).to.be.bignumber.equal(ether('0.02'))
        await token.transfer(contract.address, value, { from: user })
        expect(await contract.totalSpentPerDay(token.address, currentDay)).to.be.bignumber.equal(twoEthers)
        expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)
        expect(await token.balanceOf(owner)).to.be.bignumber.equal(ether('0.04'))

        const feeEvents = await getEvents(contract, { event: 'FeeDistributed' })
        expect(feeEvents.length).to.be.equal(2)
      })

      it('should collect and distribute 2% fee between two reward addresses', async () => {
        await contract.addRewardAddress(accounts[9]).should.be.fulfilled
        expect(await contract.rewardAddressCount()).to.be.bignumber.equal('2')

        expect(await contract.totalSpentPerDay(token.address, currentDay)).to.be.bignumber.equal(ZERO)
        await token.transfer(contract.address, ether('0.100000000000000050'), { from: user })
        expect(await contract.totalSpentPerDay(token.address, currentDay)).to.be.bignumber.equal(
          ether('0.100000000000000050')
        )
        expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)

        const balance1 = (await token.balanceOf(owner)).toString()
        const balance2 = (await token.balanceOf(accounts[9])).toString()
        expect(
          (balance1 === '1000000000000001' && balance2 === '1000000000000000') ||
            (balance1 === '1000000000000000' && balance2 === '1000000000000001')
        ).to.be.equal(true)

        await token.transfer(contract.address, value, { from: user }).should.be.fulfilled
        expect(await contract.totalSpentPerDay(token.address, currentDay)).to.be.bignumber.equal(
          ether('1.100000000000000050')
        )
        expect(await token.balanceOf(contract.address)).to.be.bignumber.equal(ZERO)

        const feeEvents = await getEvents(contract, { event: 'FeeDistributed' })
        expect(feeEvents.length).to.be.equal(2)
      })
    })
  })
})
