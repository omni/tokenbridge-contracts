const POA20 = artifacts.require('ERC677BridgeToken.sol')
const NoReturnTransferTokenMock = artifacts.require('NoReturnTransferTokenMock.sol')
const POA20RewardableMock = artifacts.require('ERC677BridgeTokenRewardableMock')
const ERC677ReceiverTest = artifacts.require('ERC677ReceiverTest.sol')
const BlockRewardTest = artifacts.require('BlockRewardMock.sol')
const StakingTest = artifacts.require('Staking.sol')
const HomeErcToErcBridge = artifacts.require('HomeBridgeErcToErc.sol')
const ForeignNativeToErcBridge = artifacts.require('ForeignBridgeNativeToErc.sol')
const BridgeValidators = artifacts.require('BridgeValidators.sol')
const TokenProxy = artifacts.require('TokenProxy.sol')
const PermittableTokenMock = artifacts.require('PermittableTokenMock.sol')

const { expect } = require('chai')
const ethUtil = require('ethereumjs-util')

const { ERROR_MSG, ERROR_MSG_OPCODE, ZERO_ADDRESS, BN } = require('./setup')
const { ether, expectEventInLogs } = require('./helpers/helpers')
const permitSign = require('./helpers/eip712.sign.permit')

const minPerTx = ether('0.01')
const requireBlockConfirmations = 8
const gasPrice = web3.utils.toWei('1', 'gwei')
const oneEther = ether('1')
const halfEther = ether('0.5')
const executionDailyLimit = oneEther
const executionMaxPerTx = halfEther
const ZERO = new BN(0)
const decimalShiftZero = 0

function testERC677BridgeToken(accounts, rewardable, permittable, createToken) {
  let token
  const owner = accounts[0]
  const user = accounts[1]

  async function addBridge(token, bridge, options = { from: owner }) {
    if (rewardable) {
      return token.addBridge(bridge, options)
    }
    return token.setBridgeContract(bridge, options)
  }

  async function isBridge(token, bridge) {
    if (rewardable) {
      return token.isBridge(bridge)
    }
    return bridge === (await token.bridgeContract())
  }

  beforeEach(async () => {
    const args = ['POA ERC20 Foundation', 'POA20', 18]
    if (permittable) {
      args.push(100)
    }
    token = await createToken(args)
  })
  it('default values', async () => {
    expect(await token.symbol()).to.be.equal('POA20')
    expect(await token.decimals()).to.be.bignumber.equal('18')
    expect(await token.name()).to.be.equal('POA ERC20 Foundation')
    expect(await token.totalSupply()).to.be.bignumber.equal(ZERO)
    expect(await token.mintingFinished()).to.be.equal(false)

    const { major, minor, patch } = await token.getTokenInterfacesVersion()
    expect(major).to.be.bignumber.gte(ZERO)
    expect(minor).to.be.bignumber.gte(ZERO)
    expect(patch).to.be.bignumber.gte(ZERO)
  })

  describe('#bridgeContract', async () => {
    it('can set bridge contract', async () => {
      const homeErcToErcContract = await HomeErcToErcBridge.new()
      expect(await isBridge(token, homeErcToErcContract.address)).to.be.equal(false)

      await addBridge(token, homeErcToErcContract.address).should.be.fulfilled
      expect(await isBridge(token, homeErcToErcContract.address)).to.be.equal(true)
    })

    it('only owner can set bridge contract', async () => {
      const homeErcToErcContract = await HomeErcToErcBridge.new()
      expect(await isBridge(token, homeErcToErcContract.address)).to.be.equal(false)

      await addBridge(token, homeErcToErcContract.address, { from: user }).should.be.rejectedWith(ERROR_MSG)
      expect(await isBridge(token, homeErcToErcContract.address)).to.be.equal(false)

      await addBridge(token, homeErcToErcContract.address, { from: owner }).should.be.fulfilled
      expect(await isBridge(token, homeErcToErcContract.address)).to.be.equal(true)
    })

    it('fail to set invalid bridge contract address', async () => {
      const invalidContractAddress = '0xaaB52d66283F7A1D5978bcFcB55721ACB467384b'
      expect(await isBridge(token, invalidContractAddress)).to.be.equal(false)

      await addBridge(token, invalidContractAddress).should.be.rejectedWith(ERROR_MSG)
      expect(await isBridge(token, invalidContractAddress)).to.be.equal(false)

      await addBridge(token, ZERO_ADDRESS).should.be.rejectedWith(ERROR_MSG)
      expect(await isBridge(token, invalidContractAddress)).to.be.equal(false)
    })
  })

  if (rewardable) {
    describe('#blockRewardContract', async () => {
      it('can set BlockReward contract', async () => {
        const blockRewardContract = await BlockRewardTest.new()
        ;(await token.blockRewardContract()).should.be.equal(ZERO_ADDRESS)

        await token.setBlockRewardContract(blockRewardContract.address).should.be.fulfilled
        ;(await token.blockRewardContract()).should.be.equal(blockRewardContract.address)
      })

      it('only owner can set BlockReward contract', async () => {
        const blockRewardContract = await BlockRewardTest.new()
        ;(await token.blockRewardContract()).should.be.equal(ZERO_ADDRESS)

        await token
          .setBlockRewardContract(blockRewardContract.address, { from: user })
          .should.be.rejectedWith(ERROR_MSG)
        ;(await token.blockRewardContract()).should.be.equal(ZERO_ADDRESS)

        await token.setBlockRewardContract(blockRewardContract.address, { from: owner }).should.be.fulfilled
        ;(await token.blockRewardContract()).should.be.equal(blockRewardContract.address)
      })

      it('fail to set invalid BlockReward contract address', async () => {
        const invalidContractAddress = '0xaaB52d66283F7A1D5978bcFcB55721ACB467384b'
        ;(await token.blockRewardContract()).should.be.equal(ZERO_ADDRESS)

        await token.setBlockRewardContract(invalidContractAddress).should.be.rejectedWith(ERROR_MSG)
        ;(await token.blockRewardContract()).should.be.equal(ZERO_ADDRESS)

        await token.setBlockRewardContract(ZERO_ADDRESS).should.be.rejectedWith(ERROR_MSG)
        ;(await token.blockRewardContract()).should.be.equal(ZERO_ADDRESS)
      })
    })

    describe('#stakingContract', async () => {
      it('can set Staking contract', async () => {
        const stakingContract = await StakingTest.new()
        ;(await token.stakingContract()).should.be.equal(ZERO_ADDRESS)

        await token.setStakingContract(stakingContract.address).should.be.fulfilled
        ;(await token.stakingContract()).should.be.equal(stakingContract.address)
      })

      it('only owner can set Staking contract', async () => {
        const stakingContract = await StakingTest.new()
        ;(await token.stakingContract()).should.be.equal(ZERO_ADDRESS)

        await token.setStakingContract(stakingContract.address, { from: user }).should.be.rejectedWith(ERROR_MSG)
        ;(await token.stakingContract()).should.be.equal(ZERO_ADDRESS)

        await token.setStakingContract(stakingContract.address, { from: owner }).should.be.fulfilled
        ;(await token.stakingContract()).should.be.equal(stakingContract.address)
      })

      it('fail to set invalid Staking contract address', async () => {
        const invalidContractAddress = '0xaaB52d66283F7A1D5978bcFcB55721ACB467384b'
        ;(await token.stakingContract()).should.be.equal(ZERO_ADDRESS)

        await token.setStakingContract(invalidContractAddress).should.be.rejectedWith(ERROR_MSG)
        ;(await token.stakingContract()).should.be.equal(ZERO_ADDRESS)

        await token.setStakingContract(ZERO_ADDRESS).should.be.rejectedWith(ERROR_MSG)
        ;(await token.stakingContract()).should.be.equal(ZERO_ADDRESS)
      })

      it('fail to set Staking contract address with non-zero balance', async () => {
        const stakingContract = await StakingTest.new()
        ;(await token.stakingContract()).should.be.equal(ZERO_ADDRESS)

        await token.mint(user, 1, { from: owner }).should.be.fulfilled
        await token.transfer(stakingContract.address, 1, { from: user }).should.be.fulfilled

        await token.setStakingContract(stakingContract.address).should.be.rejectedWith(ERROR_MSG)
        ;(await token.stakingContract()).should.be.equal(ZERO_ADDRESS)
      })
    })

    describe('#mintReward', async () => {
      it('can only be called by BlockReward contract', async () => {
        await token.setBlockRewardContractMock(accounts[2]).should.be.fulfilled
        await token.mintReward(1, { from: user }).should.be.rejectedWith(ERROR_MSG)
        await token.mintReward(1, { from: accounts[2] }).should.be.fulfilled
      })
      it('should increase totalSupply and balance', async () => {
        expect(await token.totalSupply()).to.be.bignumber.equal(ZERO)
        expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)

        await token.setBlockRewardContractMock(user).should.be.fulfilled
        await token.mintReward(100, { from: user }).should.be.fulfilled

        expect(await token.totalSupply()).to.be.bignumber.equal('100')
        expect(await token.balanceOf(user)).to.be.bignumber.equal('100')
      })
    })

    describe('#stake', async () => {
      it('can only be called by Staking contract', async () => {
        await token.setBlockRewardContractMock(user).should.be.fulfilled
        await token.mintReward('100', { from: user }).should.be.fulfilled
        await token.setStakingContractMock(accounts[4]).should.be.fulfilled
        await token.stake(user, '100', { from: accounts[3] }).should.be.rejectedWith(ERROR_MSG)
        await token.stake(user, '100', { from: accounts[4] }).should.be.fulfilled
      })
      it("should revert if user doesn't have enough balance", async () => {
        await token.setBlockRewardContractMock(user).should.be.fulfilled
        await token.mintReward('99', { from: user }).should.be.fulfilled
        expect(await token.balanceOf(user)).to.be.bignumber.equal('99')
        await token.setStakingContractMock(accounts[3]).should.be.fulfilled
        await token.stake(user, '100', { from: accounts[3] }).should.be.rejectedWith(ERROR_MSG_OPCODE)
      })
      it("should decrease user's balance and increase Staking's balance", async () => {
        await token.setBlockRewardContractMock(user).should.be.fulfilled
        await token.mintReward('100', { from: user }).should.be.fulfilled
        expect(await token.balanceOf(user)).to.be.bignumber.equal('100')
        expect(await token.balanceOf(accounts[3])).to.be.bignumber.equal(ZERO)
        await token.setStakingContractMock(accounts[3]).should.be.fulfilled
        await token.stake(user, '100', { from: accounts[3] }).should.be.fulfilled
        expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
        expect(await token.balanceOf(accounts[3])).to.be.bignumber.equal('100')
      })
    })
  }

  describe('#mint', async () => {
    it('can mint by owner', async () => {
      expect(await token.totalSupply()).to.be.bignumber.equal(ZERO)
      await token.mint(user, 1, { from: owner }).should.be.fulfilled
      expect(await token.totalSupply()).to.be.bignumber.equal('1')
      expect(await token.balanceOf(user)).to.be.bignumber.equal('1')
    })

    it('no one can call finishMinting', async () => {
      await token.finishMinting().should.be.rejectedWith(ERROR_MSG)
    })

    it('cannot mint by non-owner', async () => {
      expect(await token.totalSupply()).to.be.bignumber.equal(ZERO)
      await token.mint(user, 1, { from: user }).should.be.rejectedWith(ERROR_MSG)
      expect(await token.totalSupply()).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
    })
  })

  describe('#transfer', async () => {
    let homeErcToErcContract
    let foreignNativeToErcBridge
    let validatorContract
    beforeEach(async () => {
      validatorContract = await BridgeValidators.new()
      const authorities = [accounts[2]]
      await validatorContract.initialize(1, authorities, owner)
      homeErcToErcContract = await HomeErcToErcBridge.new()
      await homeErcToErcContract.initialize(
        validatorContract.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [executionDailyLimit, executionMaxPerTx],
        owner,
        decimalShiftZero
      )
      foreignNativeToErcBridge = await ForeignNativeToErcBridge.new()
      await foreignNativeToErcBridge.initialize(
        validatorContract.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [executionDailyLimit, executionMaxPerTx],
        owner,
        decimalShiftZero,
        homeErcToErcContract.address
      )
    })
    it('sends tokens to recipient', async () => {
      await token.mint(user, '1', { from: owner }).should.be.fulfilled
      await token.transfer(user, 1, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      const { logs } = await token.transfer(owner, 1, { from: user }).should.be.fulfilled
      expect(await token.balanceOf(owner)).to.be.bignumber.equal('1')
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
      expectEventInLogs(logs, 'Transfer', {
        from: user,
        to: owner,
        value: new BN(1)
      })
    })

    it('sends tokens to bridge contract', async () => {
      await addBridge(token, homeErcToErcContract.address).should.be.fulfilled
      await token.mint(user, oneEther, { from: owner }).should.be.fulfilled

      const result = await token.transfer(homeErcToErcContract.address, minPerTx, { from: user }).should.be.fulfilled
      expectEventInLogs(result.logs, 'Transfer', {
        from: user,
        to: homeErcToErcContract.address,
        value: minPerTx
      })

      await addBridge(token, foreignNativeToErcBridge.address).should.be.fulfilled
      const result2 = await token.transfer(foreignNativeToErcBridge.address, minPerTx, {
        from: user
      }).should.be.fulfilled
      expectEventInLogs(result2.logs, 'Transfer', {
        from: user,
        to: foreignNativeToErcBridge.address,
        value: minPerTx
      })
    })

    it('sends tokens to contract that does not contains onTokenTransfer method', async () => {
      await addBridge(token, homeErcToErcContract.address).should.be.fulfilled
      await token.mint(user, oneEther, { from: owner }).should.be.fulfilled

      const result = await token.transfer(validatorContract.address, minPerTx, { from: user }).should.be.fulfilled
      expectEventInLogs(result.logs, 'Transfer', {
        from: user,
        to: validatorContract.address,
        value: minPerTx
      })
      expectEventInLogs(result.logs, 'ContractFallbackCallFailed', {
        from: user,
        to: validatorContract.address,
        value: minPerTx
      })
    })

    it('fail to send tokens to bridge contract out of limits', async () => {
      const lessThanMin = ether('0.0001')
      await token.mint(user, oneEther, { from: owner }).should.be.fulfilled

      await addBridge(token, homeErcToErcContract.address).should.be.fulfilled
      await token.transfer(homeErcToErcContract.address, lessThanMin, { from: user }).should.be.rejectedWith(ERROR_MSG)

      await addBridge(token, foreignNativeToErcBridge.address).should.be.fulfilled
      await token
        .transfer(foreignNativeToErcBridge.address, lessThanMin, { from: user })
        .should.be.rejectedWith(ERROR_MSG)
    })

    if (rewardable) {
      it('fail to send tokens to BlockReward contract directly', async () => {
        const amount = ether('1')
        const blockRewardContractAddress = accounts[2]
        const arbitraryAccountAddress = accounts[3]
        await token.setBlockRewardContractMock(blockRewardContractAddress, { from: owner }).should.be.fulfilled
        await token.mint(user, amount, { from: owner }).should.be.fulfilled
        await token.transfer(blockRewardContractAddress, amount, { from: user }).should.be.rejectedWith(ERROR_MSG)
        await token.transfer(arbitraryAccountAddress, amount, { from: user }).should.be.fulfilled
      })
      it('fail to send tokens to Staking contract directly', async () => {
        const amount = ether('1')
        const stakingContractAddress = accounts[2]
        const arbitraryAccountAddress = accounts[3]
        await token.setStakingContractMock(stakingContractAddress, { from: owner }).should.be.fulfilled
        await token.mint(user, amount, { from: owner }).should.be.fulfilled
        await token.transfer(stakingContractAddress, amount, { from: user }).should.be.rejectedWith(ERROR_MSG)
        await token.transfer(arbitraryAccountAddress, amount, { from: user }).should.be.fulfilled
      })
    }
  })
  describe('#transferFrom', async () => {
    it('should call onTokenTransfer', async () => {
      const receiver = await ERC677ReceiverTest.new()
      const amount = ether('1')
      const user2 = accounts[2]

      await addBridge(token, receiver.address).should.be.fulfilled

      expect(await receiver.from()).to.be.equal(ZERO_ADDRESS)
      expect(await receiver.value()).to.be.bignumber.equal(ZERO)
      expect(await receiver.data()).to.be.equal(null)

      await token.mint(user, amount, { from: owner }).should.be.fulfilled
      await token.approve(user2, amount, { from: user }).should.be.fulfilled
      await token.transferFrom(user, receiver.address, amount, { from: user2 }).should.be.fulfilled

      expect(await receiver.from()).to.be.equal(user)
      expect(await receiver.value()).to.be.bignumber.equal(amount)
      expect(await receiver.data()).to.be.equal(null)
    })
    if (rewardable) {
      it('fail to send tokens to BlockReward contract directly', async () => {
        const amount = ether('1')
        const user2 = accounts[2]
        const blockRewardContractAddress = accounts[3]
        const arbitraryAccountAddress = accounts[4]
        await token.setBlockRewardContractMock(blockRewardContractAddress, { from: owner }).should.be.fulfilled
        await token.mint(user, amount, { from: owner }).should.be.fulfilled
        await token.approve(user2, amount, { from: user }).should.be.fulfilled
        await token
          .transferFrom(user, blockRewardContractAddress, amount, { from: user2 })
          .should.be.rejectedWith(ERROR_MSG)
        await token.transferFrom(user, arbitraryAccountAddress, amount, { from: user2 }).should.be.fulfilled
      })
      it('fail to send tokens to Staking contract directly', async () => {
        const amount = ether('1')
        const user2 = accounts[2]
        const stakingContractAddress = accounts[3]
        const arbitraryAccountAddress = accounts[4]
        await token.setStakingContractMock(stakingContractAddress, { from: owner }).should.be.fulfilled
        await token.mint(user, amount, { from: owner }).should.be.fulfilled
        await token.approve(user2, amount, { from: user }).should.be.fulfilled
        await token
          .transferFrom(user, stakingContractAddress, amount, { from: user2 })
          .should.be.rejectedWith(ERROR_MSG)
        await token.transferFrom(user, arbitraryAccountAddress, amount, { from: user2 }).should.be.fulfilled
      })
    }
  })

  describe('#increaseAllowance', async () => {
    it('can increase allowance', async () => {
      const twoEther = ether('2')
      const user2 = accounts[2]

      await token.mint(user, oneEther, { from: owner }).should.be.fulfilled
      await token.approve(user2, oneEther, { from: user }).should.be.fulfilled
      await token.increaseAllowance(user2, oneEther, { from: user }).should.be.fulfilled

      expect(await token.allowance(user, user2)).to.be.bignumber.equal(twoEther)
    })
  })

  describe('#decreaseAllowance', async () => {
    it('can decrease allowance', async () => {
      const twoEther = ether('2')
      const user2 = accounts[2]

      await token.mint(user, twoEther, { from: owner }).should.be.fulfilled
      await token.approve(user2, twoEther, { from: user }).should.be.fulfilled
      await token.decreaseAllowance(user2, oneEther, { from: user }).should.be.fulfilled

      expect(await token.allowance(user, user2)).to.be.bignumber.equal(oneEther)
    })
  })

  describe('#burn', async () => {
    it('can burn', async () => {
      await token.burn(100, { from: owner }).should.be.rejectedWith(ERROR_MSG)
      await token.mint(user, 1, { from: owner }).should.be.fulfilled
      await token.burn(1, { from: user }).should.be.fulfilled
      expect(await token.totalSupply()).to.be.bignumber.equal(ZERO)
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
    })
  })

  describe('#transferAndCall', () => {
    let homeErcToErcContract
    let foreignNativeToErcBridge
    let validatorContract
    beforeEach(async () => {
      validatorContract = await BridgeValidators.new()
      const authorities = [accounts[2]]
      await validatorContract.initialize(1, authorities, owner)
      homeErcToErcContract = await HomeErcToErcBridge.new()
      await homeErcToErcContract.initialize(
        validatorContract.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        token.address,
        [executionDailyLimit, executionMaxPerTx],
        owner,
        decimalShiftZero
      )
      foreignNativeToErcBridge = await ForeignNativeToErcBridge.new()
      await foreignNativeToErcBridge.initialize(
        validatorContract.address,
        token.address,
        [oneEther, halfEther, minPerTx],
        gasPrice,
        requireBlockConfirmations,
        [executionDailyLimit, executionMaxPerTx],
        owner,
        decimalShiftZero,
        homeErcToErcContract.address
      )
    })
    it('calls contractFallback', async () => {
      const receiver = await ERC677ReceiverTest.new()
      expect(await receiver.from()).to.be.equal(ZERO_ADDRESS)
      expect(await receiver.value()).to.be.bignumber.equal(ZERO)
      expect(await receiver.data()).to.be.equal(null)
      expect(await receiver.someVar()).to.be.bignumber.equal(ZERO)

      const callDoSomething123 = receiver.contract.methods.doSomething(123).encodeABI()
      await token.mint(user, '1', { from: owner }).should.be.fulfilled
      await token
        .transferAndCall(token.address, '1', callDoSomething123, { from: user })
        .should.be.rejectedWith(ERROR_MSG)
      await token
        .transferAndCall(ZERO_ADDRESS, '1', callDoSomething123, { from: user })
        .should.be.rejectedWith(ERROR_MSG)
      await token.transferAndCall(receiver.address, '1', callDoSomething123, { from: user }).should.be.fulfilled
      expect(await token.balanceOf(receiver.address)).to.be.bignumber.equal('1')
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
      expect(await receiver.from()).to.be.equal(user)
      expect(await receiver.value()).to.be.bignumber.equal('1')
      expect(await receiver.data()).to.be.equal(callDoSomething123)
      expect(await receiver.someVar()).to.be.bignumber.equal('123')
    })

    it('sends tokens to bridge contract', async () => {
      await addBridge(token, homeErcToErcContract.address).should.be.fulfilled
      await token.mint(user, oneEther, { from: owner }).should.be.fulfilled

      const result = await token.transferAndCall(homeErcToErcContract.address, minPerTx, '0x', {
        from: user
      }).should.be.fulfilled
      expectEventInLogs(result.logs, 'Transfer', {
        from: user,
        to: homeErcToErcContract.address,
        value: minPerTx
      })

      await addBridge(token, foreignNativeToErcBridge.address).should.be.fulfilled
      const result2 = await token.transferAndCall(foreignNativeToErcBridge.address, minPerTx, '0x', { from: user })
        .should.be.fulfilled
      expectEventInLogs(result2.logs, 'Transfer', {
        from: user,
        to: foreignNativeToErcBridge.address,
        value: minPerTx
      })
    })

    it('fail to sends tokens to contract that does not contains onTokenTransfer method', async () => {
      await addBridge(token, homeErcToErcContract.address).should.be.fulfilled
      await token.mint(user, oneEther, { from: owner }).should.be.fulfilled

      await token
        .transferAndCall(validatorContract.address, minPerTx, '0x', { from: user })
        .should.be.rejectedWith(ERROR_MSG)
    })

    it('fail to send tokens to bridge contract out of limits', async () => {
      const lessThanMin = ether('0.0001')
      await token.mint(user, oneEther, { from: owner }).should.be.fulfilled

      await addBridge(token, homeErcToErcContract.address).should.be.fulfilled
      await token
        .transferAndCall(homeErcToErcContract.address, lessThanMin, '0x', { from: user })
        .should.be.rejectedWith(ERROR_MSG)

      await addBridge(token, foreignNativeToErcBridge.address).should.be.fulfilled
      await token
        .transferAndCall(foreignNativeToErcBridge.address, lessThanMin, '0x', { from: user })
        .should.be.rejectedWith(ERROR_MSG)
    })
  })
  describe('#claimtokens', async () => {
    it('can take send ERC20 tokens', async () => {
      const owner = accounts[0]
      const halfEther = ether('0.5')

      const args = ['Roman Token', 'RST', 18]
      if (permittable) {
        args.push(100)
      }
      const tokenSecond = await createToken(args)

      await tokenSecond.mint(accounts[0], halfEther).should.be.fulfilled
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[0]))
      await tokenSecond.transfer(token.address, halfEther)
      expect(await tokenSecond.balanceOf(accounts[0])).to.be.bignumber.equal(ZERO)
      expect(await tokenSecond.balanceOf(token.address)).to.be.bignumber.equal(halfEther)

      await token.claimTokens(tokenSecond.address, accounts[3], { from: owner })
      expect(await tokenSecond.balanceOf(token.address)).to.be.bignumber.equal(ZERO)
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[3]))
    })
    it('works with token that not return on transfer', async () => {
      const owner = accounts[0]
      const halfEther = ether('0.5')
      const tokenMock = await NoReturnTransferTokenMock.new()

      await tokenMock.mint(accounts[0], halfEther).should.be.fulfilled
      expect(await tokenMock.balanceOf(accounts[0])).to.be.bignumber.equal(halfEther)

      await tokenMock.transfer(token.address, halfEther).should.be.fulfilled
      expect(await tokenMock.balanceOf(accounts[0])).to.be.bignumber.equal(ZERO)
      expect(await tokenMock.balanceOf(token.address)).to.be.bignumber.equal(halfEther)

      await token.claimTokens(tokenMock.address, accounts[3], { from: owner }).should.be.fulfilled
      expect(await tokenMock.balanceOf(token.address)).to.be.bignumber.equal(ZERO)
      expect(await tokenMock.balanceOf(accounts[3])).to.be.bignumber.equal(halfEther)
    })
  })
  describe('#transfer', async () => {
    it('if transfer called on contract, onTokenTransfer is also invoked', async () => {
      const receiver = await ERC677ReceiverTest.new()
      expect(await receiver.from()).to.be.equal(ZERO_ADDRESS)
      expect(await receiver.value()).to.be.bignumber.equal(ZERO)
      expect(await receiver.data()).to.be.equal(null)
      expect(await receiver.someVar()).to.be.bignumber.equal(ZERO)

      await token.mint(user, 1, { from: owner }).should.be.fulfilled
      const { logs } = await token.transfer(receiver.address, '1', { from: user }).should.be.fulfilled

      expect(await token.balanceOf(receiver.address)).to.be.bignumber.equal('1')
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
      expect(await receiver.from()).to.be.equal(user)
      expect(await receiver.value()).to.be.bignumber.equal('1')
      expect(await receiver.data()).to.be.equal(null)
      expect(logs[0].event).to.be.equal('Transfer')
    })
    it('if transfer called on contract, still works even if onTokenTransfer doesnot exist', async () => {
      const args = ['Some', 'Token', 18]
      if (permittable) {
        args.push(100)
      }
      const someContract = await createToken(args)
      await token.mint(user, '2', { from: owner }).should.be.fulfilled
      const tokenTransfer = await token.transfer(someContract.address, '1', { from: user }).should.be.fulfilled
      const tokenTransfer2 = await token.transfer(accounts[0], '1', { from: user }).should.be.fulfilled
      expect(await token.balanceOf(someContract.address)).to.be.bignumber.equal('1')
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
      tokenTransfer.logs[0].event.should.be.equal('Transfer')
      tokenTransfer2.logs[0].event.should.be.equal('Transfer')
    })
  })
  describe('#renounceOwnership', () => {
    it('should not be able to renounce ownership', async () => {
      await token.renounceOwnership({ from: user }).should.be.rejectedWith(ERROR_MSG)
      await token.renounceOwnership().should.be.rejectedWith(ERROR_MSG)
    })
  })
  if (permittable) {
    describe('permit', () => {
      const privateKey = '0x2bdd21761a483f71054e14f5b827213567971c676928d9a1808cbfa4b7501210'
      const infinite = new BN('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 16)
      let holder
      let spender
      let nonce
      let expiry
      let allowed

      beforeEach(async () => {
        holder = '0x040b798028e9abded00Bfc65e7CF01484013db17'
        spender = accounts[9]
        nonce = await token.nonces.call(holder)
        expiry = 0
        allowed = true

        holder.toLowerCase().should.be.equal(ethUtil.bufferToHex(ethUtil.privateToAddress(privateKey)).toLowerCase()) // make sure privateKey is holder's key

        // Mint some extra tokens for the `holder`
        await token.mint(holder, '10000', { from: owner }).should.be.fulfilled
        ;(await token.balanceOf.call(holder)).should.be.bignumber.equal(new BN('10000'))
      })
      it('should permit', async () => {
        // Holder signs the `permit` params with their privateKey
        const signature = permitSign(
          {
            name: await token.name.call(),
            version: await token.version.call(),
            chainId: '100',
            verifyingContract: token.address
          },
          {
            holder,
            spender,
            nonce,
            expiry,
            allowed
          },
          privateKey
        )

        ;(await token.allowance.call(holder, spender)).should.be.bignumber.equal(new BN('0'))

        // An arbitrary address calls the `permit` function
        const { logs } = await token.permit(
          holder,
          spender,
          nonce,
          expiry,
          allowed,
          signature.v,
          signature.r,
          signature.s
        ).should.be.fulfilled

        logs[0].event.should.be.equal('Approval')
        logs[0].args.owner.should.be.equal(holder)
        logs[0].args.spender.should.be.equal(spender)
        logs[0].args.value.should.be.bignumber.equal(infinite)

        // Now allowance is infinite
        ;(await token.allowance.call(holder, spender)).should.be.bignumber.equal(infinite)

        // The caller of `permit` can't spend holder's funds
        await token.transferFrom(holder, accounts[9], '10000').should.be.rejected
        ;(await token.balanceOf.call(holder)).should.be.bignumber.equal(new BN('10000'))

        // Spender can transfer all holder's funds
        await token.transferFrom(holder, accounts[9], '10000', { from: spender }).should.be.fulfilled
        ;(await token.balanceOf.call(holder)).should.be.bignumber.equal(new BN('0'))
        ;(await token.balanceOf.call(accounts[9])).should.be.bignumber.equal(new BN('10000'))
        ;(await token.nonces.call(holder)).should.be.bignumber.equal(nonce.add(new BN('1')))

        // The allowance is still infinite after transfer
        ;(await token.allowance.call(holder, spender)).should.be.bignumber.equal(infinite)
      })
      it('should fail when invalid expiry', async () => {
        expiry = 900

        const signature = permitSign(
          {
            name: await token.name.call(),
            version: await token.version.call(),
            chainId: '100',
            verifyingContract: token.address
          },
          {
            holder,
            spender,
            nonce,
            expiry,
            allowed
          },
          privateKey
        )

        await token.setNow(1000).should.be.fulfilled
        await token
          .permit(holder, spender, nonce, expiry, allowed, signature.v, signature.r, signature.s)
          .should.be.rejectedWith(ERROR_MSG)

        await token.setNow(800).should.be.fulfilled
        await token.permit(holder, spender, nonce, expiry, allowed, signature.v, signature.r, signature.s).should.be
          .fulfilled
      })
      it('should consider expiry', async () => {
        expiry = 900

        const signature = permitSign(
          {
            name: await token.name.call(),
            version: await token.version.call(),
            chainId: '100',
            verifyingContract: token.address
          },
          {
            holder,
            spender,
            nonce,
            expiry,
            allowed
          },
          privateKey
        )

        await token.setNow(800).should.be.fulfilled
        await token.permit(holder, spender, nonce, expiry, allowed, signature.v, signature.r, signature.s).should.be
          .fulfilled
        ;(await token.expirations.call(holder, spender)).should.be.bignumber.equal(new BN(expiry))

        // Spender can transfer holder's funds
        await token.setNow(899).should.be.fulfilled
        await token.transferFrom(holder, accounts[9], '6000', { from: spender }).should.be.fulfilled
        ;(await token.balanceOf.call(holder)).should.be.bignumber.equal(new BN('4000'))
        ;(await token.balanceOf.call(accounts[9])).should.be.bignumber.equal(new BN('6000'))

        // Spender can't transfer the remaining holder's funds because of expiry
        await token.setNow(901).should.be.fulfilled
        await token.transferFrom(holder, accounts[9], '4000', { from: spender }).should.be.rejectedWith(ERROR_MSG)
      })
      it('should disallow unlimited allowance', async () => {
        expiry = 900
        await token.setNow(800).should.be.fulfilled

        let signature = permitSign(
          {
            name: await token.name.call(),
            version: await token.version.call(),
            chainId: '100',
            verifyingContract: token.address
          },
          {
            holder,
            spender,
            nonce,
            expiry,
            allowed
          },
          privateKey
        )

        await token.permit(holder, spender, nonce, expiry, allowed, signature.v, signature.r, signature.s).should.be
          .fulfilled
        ;(await token.allowance.call(holder, spender)).should.be.bignumber.equal(infinite)
        ;(await token.expirations.call(holder, spender)).should.be.bignumber.equal(new BN(expiry))

        // Spender can transfer holder's funds
        await token.transferFrom(holder, accounts[9], '6000', { from: spender }).should.be.fulfilled
        ;(await token.balanceOf.call(holder)).should.be.bignumber.equal(new BN('4000'))
        ;(await token.balanceOf.call(accounts[9])).should.be.bignumber.equal(new BN('6000'))

        nonce = nonce - 0 + 1
        allowed = false

        signature = permitSign(
          {
            name: await token.name.call(),
            version: await token.version.call(),
            chainId: '100',
            verifyingContract: token.address
          },
          {
            holder,
            spender,
            nonce,
            expiry,
            allowed
          },
          privateKey
        )

        await token.permit(holder, spender, nonce, expiry, allowed, signature.v, signature.r, signature.s).should.be
          .fulfilled
        ;(await token.allowance.call(holder, spender)).should.be.bignumber.equal(new BN('0'))
        ;(await token.expirations.call(holder, spender)).should.be.bignumber.equal(new BN('0'))

        // Spender can't transfer the remaining holder's funds because of zero allowance
        await token.transferFrom(holder, accounts[9], '4000', { from: spender }).should.be.rejected
      })
      it('should fail when invalid signature or parameters', async () => {
        let signature = permitSign(
          {
            name: await token.name.call(),
            version: await token.version.call(),
            chainId: '100',
            verifyingContract: token.address
          },
          {
            holder,
            spender,
            nonce,
            expiry,
            allowed
          },
          privateKey
        )

        allowed = !allowed

        await token
          .permit(holder, spender, nonce, expiry, allowed, signature.v, signature.r, signature.s)
          .should.be.rejectedWith(ERROR_MSG)

        allowed = !allowed

        await token
          .permit(
            holder,
            spender,
            nonce,
            expiry,
            allowed,
            signature.v,
            signature.s, // here should be `signature.r` in a correct case
            signature.r // here should be `signature.s` in a correct case
          )
          .should.be.rejectedWith(ERROR_MSG)

        signature = permitSign(
          {
            name: await token.name.call(),
            version: await token.version.call(),
            chainId: '100',
            verifyingContract: token.address
          },
          {
            holder,
            spender,
            nonce: nonce - 0 + 1,
            expiry,
            allowed
          },
          privateKey
        )

        await token
          .permit(holder, spender, nonce - 0 + 1, expiry, allowed, signature.v, signature.r, signature.s)
          .should.be.rejectedWith(ERROR_MSG)

        signature = permitSign(
          {
            name: await token.name.call(),
            version: await token.version.call(),
            chainId: '100',
            verifyingContract: token.address
          },
          {
            holder,
            spender,
            nonce,
            expiry,
            allowed
          },
          privateKey
        )

        await token.permit(holder, spender, nonce, expiry, allowed, signature.v, signature.r, signature.s).should.be
          .fulfilled
      })
    })
  }
}

contract('ERC677BridgeToken', accounts => {
  testERC677BridgeToken(accounts, false, false, args => POA20.new(...args))
})

contract('ERC677BridgeTokenRewardable', accounts => {
  testERC677BridgeToken(accounts, true, true, args => POA20RewardableMock.new(...args))
})

contract('TokenProxy', accounts => {
  const createToken = async args => {
    const impl = await PermittableTokenMock.new(...args)
    const proxy = await TokenProxy.new(impl.address, ...args)
    return PermittableTokenMock.at(proxy.address)
  }

  testERC677BridgeToken(accounts, false, true, createToken)

  describe('constants', () => {
    let token
    beforeEach(async () => {
      token = await createToken(['POA ERC20 Foundation', 'POA20', 18, 100])
    })

    it('should return version', async () => {
      expect(await token.version()).to.be.equal('1')
    })

    it('should return PERMIT_TYPEHASH', async () => {
      expect(await token.PERMIT_TYPEHASH()).to.be.equal(
        '0xea2aa0a1be11a07ed86d755c93467f4f82362b452371d1ba94d1715123511acb'
      )
    })
  })
})
