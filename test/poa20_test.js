const POA20 = artifacts.require('ERC677BridgeToken.sol')
const NoReturnTransferTokenMock = artifacts.require('NoReturnTransferTokenMock.sol')
const POA20RewardableMock = artifacts.require('ERC677BridgeTokenRewardableMock')
const ERC677ReceiverTest = artifacts.require('ERC677ReceiverTest.sol')
const BlockRewardTest = artifacts.require('BlockRewardMock.sol')
const StakingTest = artifacts.require('Staking.sol')
const ForeignBridge = artifacts.require('ForeignBridgeErcToNative.sol')
const BridgeValidators = artifacts.require('BridgeValidators.sol')

const { expect } = require('chai')
const { fromRpcSig } = require('ethereumjs-util')

const { ERROR_MSG, ERROR_MSG_OPCODE, ZERO_ADDRESS, BN, toBN } = require('./setup')
const { ether, expectEventInLogs } = require('./helpers/helpers')

async function ethSignTypedData(from, data) {
  const result = await new Promise((res, rej) =>
    web3.currentProvider.send(
      { jsonrpc: '2.0', method: 'eth_signTypedData', params: [from, data], id: 1 },
      (err, sig) => (err ? rej(err) : res(sig))
    )
  )
  const sig = fromRpcSig(result.result)
  return [sig.v, sig.r, sig.s]
}

async function evmIncreaseTime(delta) {
  return new Promise((res, rej) =>
    web3.currentProvider.send({ jsonrpc: '2.0', method: 'evm_increaseTime', params: [delta], id: 1 }, (err, sig) =>
      err ? rej(err) : res(sig)
    )
  )
}

const minPerTx = ether('0.01')
const oneEther = ether('1')
const twoEthers = ether('2')
const ZERO = new BN(0)

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
      args.push(1337)
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
      const bridge = await ForeignBridge.new()
      expect(await isBridge(token, bridge.address)).to.be.equal(false)

      await addBridge(token, bridge.address).should.be.fulfilled
      expect(await isBridge(token, bridge.address)).to.be.equal(true)
    })

    it('only owner can set bridge contract', async () => {
      const bridge = await ForeignBridge.new()
      expect(await isBridge(token, bridge.address)).to.be.equal(false)

      await addBridge(token, bridge.address, { from: user }).should.be.rejectedWith(ERROR_MSG)
      expect(await isBridge(token, bridge.address)).to.be.equal(false)

      await addBridge(token, bridge.address, { from: owner }).should.be.fulfilled
      expect(await isBridge(token, bridge.address)).to.be.equal(true)
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
    let validatorContract
    beforeEach(async () => {
      validatorContract = await BridgeValidators.new()
      const authorities = [accounts[2]]
      await validatorContract.initialize(1, authorities, owner)
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
      const dummyReceiver = await ERC677ReceiverTest.new()
      await token.mint(user, oneEther, { from: owner }).should.be.fulfilled

      await addBridge(token, dummyReceiver.address).should.be.fulfilled
      const { logs } = await token.transfer(dummyReceiver.address, minPerTx, {
        from: user
      }).should.be.fulfilled
      expectEventInLogs(logs, 'Transfer', {
        from: user,
        to: dummyReceiver.address,
        value: minPerTx
      })
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
    let validatorContract
    beforeEach(async () => {
      validatorContract = await BridgeValidators.new()
      const authorities = [accounts[2]]
      await validatorContract.initialize(1, authorities, owner)
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
      const dummyReceiver = await ERC677ReceiverTest.new()
      await token.mint(user, oneEther, { from: owner }).should.be.fulfilled

      await addBridge(token, dummyReceiver.address).should.be.fulfilled
      const { logs } = await token.transferAndCall(dummyReceiver.address, minPerTx, '0x', { from: user }).should.be
        .fulfilled
      expectEventInLogs(logs, 'Transfer', {
        from: user,
        to: dummyReceiver.address,
        value: minPerTx
      })
    })

    it('fail to sends tokens to contract that does not contains onTokenTransfer method', async () => {
      await token.mint(user, oneEther, { from: owner }).should.be.fulfilled

      await token
        .transferAndCall(validatorContract.address, minPerTx, '0x', { from: user })
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
    it('if transfer called on contract, onTokenTransfer is not invoked', async () => {
      const receiver = await ERC677ReceiverTest.new()
      expect(await receiver.from()).to.be.equal(ZERO_ADDRESS)
      expect(await receiver.value()).to.be.bignumber.equal(ZERO)
      expect(await receiver.data()).to.be.equal(null)
      expect(await receiver.someVar()).to.be.bignumber.equal(ZERO)

      await token.mint(user, 1, { from: owner }).should.be.fulfilled
      const { logs } = await token.transfer(receiver.address, '1', { from: user }).should.be.fulfilled

      expect(await token.balanceOf(receiver.address)).to.be.bignumber.equal('1')
      expect(await token.balanceOf(user)).to.be.bignumber.equal(ZERO)
      expect(await receiver.from()).to.be.equal(ZERO_ADDRESS)
      expect(await receiver.value()).to.be.bignumber.equal(ZERO)
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
      const EIP712Domain = [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' }
      ]
      let domain
      let permit
      let permitLegacy

      const makeLegacyMsg = (nonce, expiry, allowed) => ({
        types: {
          EIP712Domain,
          Permit: [
            { name: 'holder', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'nonce', type: 'uint256' },
            { name: 'expiry', type: 'uint256' },
            { name: 'allowed', type: 'bool' }
          ]
        },
        primaryType: 'Permit',
        domain,
        message: {
          holder: owner,
          spender: user,
          nonce,
          expiry,
          allowed
        }
      })
      const makeMsg = (nonce, deadline, value) => ({
        types: {
          EIP712Domain,
          Permit: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'nonce', type: 'uint256' },
            { name: 'deadline', type: 'uint256' }
          ]
        },
        primaryType: 'Permit',
        domain,
        message: {
          owner,
          spender: user,
          value: value || oneEther.toString(),
          nonce,
          deadline
        }
      })

      beforeEach(() => {
        domain = {
          name: 'POA ERC20 Foundation',
          version: '1',
          chainId: 1337,
          verifyingContract: token.address
        }
        permit = token.methods['permit(address,address,uint256,uint256,uint8,bytes32,bytes32)']
        permitLegacy = token.methods['permit(address,address,uint256,uint256,bool,uint8,bytes32,bytes32)']
      })

      describe('legacy permit', () => {
        const INFINITY = new BN('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', 16)

        it('should accept signed message', async () => {
          const expiry = 10000000000
          const sig1 = await ethSignTypedData(owner, makeLegacyMsg(0, 100, true))
          const sig2 = await ethSignTypedData(owner, makeLegacyMsg(1, expiry, true))
          const sig3 = await ethSignTypedData(owner, makeLegacyMsg(0, expiry, true))

          await permitLegacy(owner, user, 0, 100, true, ...sig1).should.be.rejected // too small deadline
          await permitLegacy(owner, user, 0, expiry, true, ...sig2).should.be.rejected // invalid nonce
          await permitLegacy(owner, user, 1, expiry, true, ...sig2).should.be.rejected // not current nonce
          await permitLegacy(owner, user, 0, expiry, true, ...sig3).should.be.fulfilled // valid for nonce == 0
          await permitLegacy(owner, user, 0, expiry, true, ...sig3).should.be.rejected // invalid duplicate, invalid nonce
          await permitLegacy(owner, user, 1, expiry, true, ...sig3).should.be.rejected // invalid nonce
          await permitLegacy(user, user, 1, expiry, true, ...sig2).should.be.rejected // invalid sender
          await permitLegacy(owner, owner, 1, expiry, true, ...sig2).should.be.rejected // invalid receiver
          await permitLegacy(owner, user, 1, expiry + 1, true, ...sig2).should.be.rejected // invalid expiry
          await permitLegacy(owner, user, 1, expiry, false, ...sig2).should.be.rejected // invalid allowed
          await permitLegacy(owner, user, 1, expiry, true, ...sig2).should.be.fulfilled // valid for nonce == 1
          await permitLegacy(owner, user, 1, expiry, true, ...sig2).should.be.rejected // invalid duplicate, invalid nonce

          expect(await token.allowance(owner, user)).to.be.bignumber.equal(INFINITY)
          expect(await token.nonces(owner)).to.be.bignumber.equal('2')
          expect(await token.expirations(owner, user)).to.be.bignumber.equal(toBN(expiry))
        })

        it('should cancel expirations on infinite approval from approve()', async () => {
          const expiry = 10000000000
          const sig = await ethSignTypedData(owner, makeLegacyMsg(0, expiry, true))
          await permitLegacy(owner, user, 0, expiry, true, ...sig).should.be.fulfilled

          expect(await token.allowance(owner, user)).to.be.bignumber.equal(INFINITY)
          expect(await token.expirations(owner, user)).to.be.bignumber.equal(toBN(expiry))

          await token.approve(user, 1).should.be.fulfilled

          expect(await token.allowance(owner, user)).to.be.bignumber.equal('1')
          expect(await token.expirations(owner, user)).to.be.bignumber.equal(toBN(expiry))

          await token.approve(user, INFINITY).should.be.fulfilled

          expect(await token.allowance(owner, user)).to.be.bignumber.equal(INFINITY)
          expect(await token.expirations(owner, user)).to.be.bignumber.equal(ZERO)
        })

        it('should cancel expirations on infinite approval from increaseAllowance()', async () => {
          const expiry = 10000000000
          const sig = await ethSignTypedData(owner, makeLegacyMsg(0, expiry, true))
          await permitLegacy(owner, user, 0, expiry, true, ...sig).should.be.fulfilled

          expect(await token.allowance(owner, user)).to.be.bignumber.equal(INFINITY)
          expect(await token.expirations(owner, user)).to.be.bignumber.equal(toBN(expiry))

          await token.approve(user, 1).should.be.fulfilled

          expect(await token.allowance(owner, user)).to.be.bignumber.equal('1')
          expect(await token.expirations(owner, user)).to.be.bignumber.equal(toBN(expiry))

          await token.increaseAllowance(user, 1).should.be.fulfilled

          expect(await token.allowance(owner, user)).to.be.bignumber.equal('2')
          expect(await token.expirations(owner, user)).to.be.bignumber.equal(toBN(expiry))

          await token.increaseAllowance(user, INFINITY.subn(2)).should.be.fulfilled

          expect(await token.allowance(owner, user)).to.be.bignumber.equal(INFINITY)
          expect(await token.expirations(owner, user)).to.be.bignumber.equal(ZERO)
        })

        it('should cancel expirations on infinite approval from permit()', async () => {
          const expiry = 10000000000
          const sig1 = await ethSignTypedData(owner, makeLegacyMsg(0, expiry, true))
          const sig2 = await ethSignTypedData(owner, makeMsg(1, expiry))
          const sig3 = await ethSignTypedData(owner, makeMsg(2, expiry, INFINITY.toString()))
          await permitLegacy(owner, user, 0, expiry, true, ...sig1).should.be.fulfilled

          expect(await token.allowance(owner, user)).to.be.bignumber.equal(INFINITY)
          expect(await token.expirations(owner, user)).to.be.bignumber.equal(toBN(expiry))

          await permit(owner, user, oneEther, expiry, ...sig2).should.be.fulfilled

          expect(await token.allowance(owner, user)).to.be.bignumber.equal(oneEther)
          expect(await token.expirations(owner, user)).to.be.bignumber.equal(toBN(expiry))

          await permit(owner, user, INFINITY, expiry, ...sig3).should.be.fulfilled

          expect(await token.allowance(owner, user)).to.be.bignumber.equal(INFINITY)
          expect(await token.expirations(owner, user)).to.be.bignumber.equal(ZERO)
        })

        it('should cancel approval when allowed is false', async () => {
          const expiry = 10000000000
          const sig1 = await ethSignTypedData(owner, makeLegacyMsg(0, expiry, true))
          const sig2 = await ethSignTypedData(owner, makeLegacyMsg(1, expiry, false))
          await permitLegacy(owner, user, 0, expiry, true, ...sig1).should.be.fulfilled

          expect(await token.allowance(owner, user)).to.be.bignumber.equal(INFINITY)
          expect(await token.expirations(owner, user)).to.be.bignumber.equal(toBN(expiry))

          await permitLegacy(owner, user, 1, expiry, false, ...sig2).should.be.fulfilled

          expect(await token.allowance(owner, user)).to.be.bignumber.equal(ZERO)
          expect(await token.expirations(owner, user)).to.be.bignumber.equal(ZERO)
        })

        it('should accept infinite approval without deadline', async () => {
          const sig1 = await ethSignTypedData(owner, makeLegacyMsg(0, 0, true))
          const sig2 = await ethSignTypedData(owner, makeLegacyMsg(1, 0, false))
          await permitLegacy(owner, user, 0, 0, true, ...sig1).should.be.fulfilled

          expect(await token.allowance(owner, user)).to.be.bignumber.equal(INFINITY)
          expect(await token.expirations(owner, user)).to.be.bignumber.equal(ZERO)

          await permitLegacy(owner, user, 1, 0, false, ...sig2).should.be.fulfilled

          expect(await token.allowance(owner, user)).to.be.bignumber.equal(ZERO)
          expect(await token.expirations(owner, user)).to.be.bignumber.equal(ZERO)
        })

        it('should allow to use allowance without deadline', async () => {
          await token.mint(owner, ether('10')).should.be.fulfilled
          const sig = await ethSignTypedData(owner, makeLegacyMsg(0, 0, true))
          await permitLegacy(owner, user, 0, 0, true, ...sig).should.be.fulfilled

          await token.transferFrom(owner, user, oneEther, { from: user }).should.be.fulfilled
          expect(await token.allowance(owner, user)).to.be.bignumber.equal(INFINITY)
          expect(await token.balanceOf(user)).to.be.bignumber.equal(oneEther)
          expect(await token.balanceOf(owner)).to.be.bignumber.equal(ether('9'))
        })

        it('should not allow to use approval after deadline', async () => {
          await token.mint(owner, ether('10')).should.be.fulfilled
          const expiry = 10000000000
          const sig = await ethSignTypedData(owner, makeLegacyMsg(0, expiry, true))
          await permitLegacy(owner, user, 0, expiry, true, ...sig).should.be.fulfilled

          await token.transferFrom(owner, user, oneEther, { from: user }).should.be.fulfilled

          expect(await token.allowance(owner, user)).to.be.bignumber.equal(INFINITY)
          expect(await token.balanceOf(user)).to.be.bignumber.equal(oneEther)
          expect(await token.balanceOf(owner)).to.be.bignumber.equal(ether('9'))

          await evmIncreaseTime(expiry)

          await token.transferFrom(owner, user, oneEther, { from: user }).should.be.rejected
          expect(await token.allowance(owner, user)).to.be.bignumber.equal(INFINITY)
          expect(await token.balanceOf(user)).to.be.bignumber.equal(oneEther)
          expect(await token.balanceOf(owner)).to.be.bignumber.equal(ether('9'))
        })
      })

      describe('ERC2612', () => {
        it('should accept signed message', async () => {
          const deadline = 100000000000
          const sig1 = await ethSignTypedData(owner, makeMsg(0, 100))
          const sig2 = await ethSignTypedData(owner, makeMsg(1, deadline))
          const sig3 = await ethSignTypedData(owner, makeMsg(0, deadline))

          await permit(owner, user, oneEther, 100, ...sig1).should.be.rejected // too small deadline
          await permit(owner, user, oneEther, deadline, ...sig2).should.be.rejected // invalid nonce
          await permit(owner, user, oneEther, deadline, ...sig3).should.be.fulfilled // valid for nonce == 0
          await permit(owner, user, oneEther, deadline, ...sig3).should.be.rejected // invalid duplicate, invalid nonce
          await permit(user, user, oneEther, deadline, ...sig2).should.be.rejected // invalid sender
          await permit(owner, owner, oneEther, deadline, ...sig2).should.be.rejected // invalid receiver
          await permit(owner, user, twoEthers, deadline, ...sig2).should.be.rejected // invalud value
          await permit(owner, user, oneEther, deadline + 1, ...sig2).should.be.rejected // invalid deadline
          await permit(owner, user, oneEther, deadline, ...sig2).should.be.fulfilled // valid for nonce == 1
          await permit(owner, user, oneEther, deadline, ...sig2).should.be.rejected // invalid duplicate, invalid nonce
          expect(await token.allowance(owner, user)).to.be.bignumber.equal(oneEther)
          expect(await token.nonces(owner)).to.be.bignumber.equal('2')
          expect(await token.expirations(owner, user)).to.be.bignumber.equal(ZERO)
        })
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
