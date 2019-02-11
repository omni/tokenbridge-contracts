const POA20 = artifacts.require("ERC677BridgeToken.sol");
const POA20RewardableMock = artifacts.require("./mockContracts/ERC677BridgeTokenRewardableMock");
const ERC677ReceiverTest = artifacts.require("ERC677ReceiverTest.sol")
const BlockRewardTest = artifacts.require("BlockReward.sol")
const ValidatorSetTest = artifacts.require("ValidatorSet.sol")
const { ERROR_MSG, ZERO_ADDRESS} = require('./setup');
const Web3Utils = require('web3-utils');
const HomeErcToErcBridge = artifacts.require("HomeBridgeErcToErc.sol");
const ForeignNativeToErcBridge = artifacts.require("ForeignBridgeNativeToErc.sol");
const BridgeValidators = artifacts.require("BridgeValidators.sol");
const minPerTx = web3.toBigNumber(web3.toWei(0.01, "ether"));
const requireBlockConfirmations = 8;
const gasPrice = Web3Utils.toWei('1', 'gwei');
const oneEther = web3.toBigNumber(web3.toWei(1, "ether"));
const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"));
const executionDailyLimit = oneEther
const executionMaxPerTx = halfEther

async function testERC677BridgeToken(accounts, rewardable) {
  let token
  let owner = accounts[0]
  const user = accounts[1];
  const tokenContract = rewardable ? POA20RewardableMock : POA20;
  beforeEach(async () => {
    token = await tokenContract.new("POA ERC20 Foundation", "POA20", 18);
  })
  it('default values', async () => {

    const symbol = await token.symbol()
    assert.equal(symbol, 'POA20')

    const decimals = await token.decimals()
    assert.equal(decimals, 18)

    const name = await token.name()
    assert.equal(name, "POA ERC20 Foundation")

    const totalSupply = await token.totalSupply();
    assert.equal(totalSupply, 0);

    const mintingFinished = await token.mintingFinished();
    assert.equal(mintingFinished, false);

    const [major, minor, patch] = await token.getTokenInterfacesVersion()
    major.should.be.bignumber.gte(0)
    minor.should.be.bignumber.gte(0)
    patch.should.be.bignumber.gte(0)
  })

  describe('#bridgeContract', async() => {
    it('can set bridge contract', async () => {
      const homeErcToErcContract = await HomeErcToErcBridge.new();
      (await token.bridgeContract()).should.be.equal(ZERO_ADDRESS);

      await token.setBridgeContract(homeErcToErcContract.address).should.be.fulfilled;

      (await token.bridgeContract()).should.be.equal(homeErcToErcContract.address);
    })

    it('only owner can set bridge contract', async () => {
      const homeErcToErcContract = await HomeErcToErcBridge.new();
      (await token.bridgeContract()).should.be.equal(ZERO_ADDRESS);

      await token.setBridgeContract(homeErcToErcContract.address, {from: user }).should.be.rejectedWith(ERROR_MSG);
      (await token.bridgeContract()).should.be.equal(ZERO_ADDRESS);

      await token.setBridgeContract(homeErcToErcContract.address, {from: owner }).should.be.fulfilled;
      (await token.bridgeContract()).should.be.equal(homeErcToErcContract.address);
    })

    it('fail to set invalid bridge contract address', async () => {
      const invalidContractAddress = '0xaaB52d66283F7A1D5978bcFcB55721ACB467384b';
      (await token.bridgeContract()).should.be.equal(ZERO_ADDRESS);

      await token.setBridgeContract(invalidContractAddress).should.be.rejectedWith(ERROR_MSG);
      (await token.bridgeContract()).should.be.equal(ZERO_ADDRESS);

      await token.setBridgeContract(ZERO_ADDRESS).should.be.rejectedWith(ERROR_MSG);
      (await token.bridgeContract()).should.be.equal(ZERO_ADDRESS);
    })
  })

  if (rewardable) {
    describe('#blockRewardContract', async() => {
      it('can set BlockReward contract', async () => {
        const blockRewardContract = await BlockRewardTest.new();
        (await token.blockRewardContract()).should.be.equal(ZERO_ADDRESS);

        await token.setBlockRewardContract(blockRewardContract.address).should.be.fulfilled;

        (await token.blockRewardContract()).should.be.equal(blockRewardContract.address);
      })

      it('only owner can set BlockReward contract', async () => {
        const blockRewardContract = await BlockRewardTest.new();
        (await token.blockRewardContract()).should.be.equal(ZERO_ADDRESS);

        await token.setBlockRewardContract(blockRewardContract.address, {from: user }).should.be.rejectedWith(ERROR_MSG);
        (await token.blockRewardContract()).should.be.equal(ZERO_ADDRESS);

        await token.setBlockRewardContract(blockRewardContract.address, {from: owner }).should.be.fulfilled;
        (await token.blockRewardContract()).should.be.equal(blockRewardContract.address);
      })

      it('fail to set invalid BlockReward contract address', async () => {
        const invalidContractAddress = '0xaaB52d66283F7A1D5978bcFcB55721ACB467384b';
        (await token.blockRewardContract()).should.be.equal(ZERO_ADDRESS);

        await token.setBlockRewardContract(invalidContractAddress).should.be.rejectedWith(ERROR_MSG);
        (await token.blockRewardContract()).should.be.equal(ZERO_ADDRESS);

        await token.setBlockRewardContract(ZERO_ADDRESS).should.be.rejectedWith(ERROR_MSG);
        (await token.blockRewardContract()).should.be.equal(ZERO_ADDRESS);
      })
    })

    describe('#validatorSetContract', async() => {
      it('can set ValidatorSet contract', async () => {
        const validatorSetContract = await ValidatorSetTest.new();
        (await token.validatorSetContract()).should.be.equal(ZERO_ADDRESS);

        await token.setValidatorSetContract(validatorSetContract.address).should.be.fulfilled;

        (await token.validatorSetContract()).should.be.equal(validatorSetContract.address);
      })

      it('only owner can set ValidatorSet contract', async () => {
        const validatorSetContract = await ValidatorSetTest.new();
        (await token.validatorSetContract()).should.be.equal(ZERO_ADDRESS);

        await token.setValidatorSetContract(validatorSetContract.address, {from: user }).should.be.rejectedWith(ERROR_MSG);
        (await token.validatorSetContract()).should.be.equal(ZERO_ADDRESS);

        await token.setValidatorSetContract(validatorSetContract.address, {from: owner }).should.be.fulfilled;
        (await token.validatorSetContract()).should.be.equal(validatorSetContract.address);
      })

      it('fail to set invalid ValidatorSet contract address', async () => {
        const invalidContractAddress = '0xaaB52d66283F7A1D5978bcFcB55721ACB467384b';
        (await token.validatorSetContract()).should.be.equal(ZERO_ADDRESS);

        await token.setValidatorSetContract(invalidContractAddress).should.be.rejectedWith(ERROR_MSG);
        (await token.validatorSetContract()).should.be.equal(ZERO_ADDRESS);

        await token.setValidatorSetContract(ZERO_ADDRESS).should.be.rejectedWith(ERROR_MSG);
        (await token.validatorSetContract()).should.be.equal(ZERO_ADDRESS);
      })
    })

    describe('#mintReward', async() => {
      it('can only be called by BlockReward contract', async () => {
        await token.setBlockRewardContractMock(accounts[2]).should.be.fulfilled;
        await token.mintReward([], [], {from: user }).should.be.rejectedWith(ERROR_MSG);
        await token.mintReward([], [], {from: accounts[2] }).should.be.fulfilled;
      })
      it('should increase totalSupply and balances', async () => {
        const user1 = accounts[1];
        const user2 = accounts[2];
        const user3 = accounts[3];

        assert.equal(await token.totalSupply(), 0);
        (await token.balanceOf(user1)).should.be.bignumber.equal(0);
        (await token.balanceOf(user2)).should.be.bignumber.equal(0);
        (await token.balanceOf(user3)).should.be.bignumber.equal(0);

        await token.setBlockRewardContractMock(accounts[4]).should.be.fulfilled;
        await token.mintReward([user1, user2, user3], [100, 200, 300], {from: accounts[4] }).should.be.fulfilled;
        
        assert.equal(await token.totalSupply(), 600);
        (await token.balanceOf(user1)).should.be.bignumber.equal(100);
        (await token.balanceOf(user2)).should.be.bignumber.equal(200);
        (await token.balanceOf(user3)).should.be.bignumber.equal(300);
      })
    })

    describe('#stake', async() => {
      it('can only be called by ValidatorSet contract', async () => {
        await token.setBlockRewardContractMock(accounts[2]).should.be.fulfilled;
        await token.mintReward([user], [100], {from: accounts[2] }).should.be.fulfilled;
        await token.setValidatorSetContractMock(accounts[3]).should.be.fulfilled;
        await token.stake(user, 100, {from: accounts[4] }).should.be.rejectedWith(ERROR_MSG);
        await token.stake(user, 100, {from: accounts[3] }).should.be.fulfilled;
      })
      it('should revert if user doesn\'t have enough balance', async () => {
        await token.setBlockRewardContractMock(accounts[2]).should.be.fulfilled;
        await token.mintReward([user], [99], {from: accounts[2] }).should.be.fulfilled;
        (await token.balanceOf(user)).should.be.bignumber.equal(99);
        await token.setValidatorSetContractMock(accounts[3]).should.be.fulfilled;
        await token.stake(user, 100, {from: accounts[3] }).should.be.rejectedWith(ERROR_MSG);
      })
      it('should decrease user\'s balance and increase ValidatorSet\'s balance', async () => {
        await token.setBlockRewardContractMock(accounts[2]).should.be.fulfilled;
        await token.mintReward([user], [100], {from: accounts[2] }).should.be.fulfilled;
        (await token.balanceOf(user)).should.be.bignumber.equal(100);
        (await token.balanceOf(accounts[3])).should.be.bignumber.equal(0);
        await token.setValidatorSetContractMock(accounts[3]).should.be.fulfilled;
        await token.stake(user, 100, {from: accounts[3] }).should.be.fulfilled;
        (await token.balanceOf(user)).should.be.bignumber.equal(0);
        (await token.balanceOf(accounts[3])).should.be.bignumber.equal(100);
      })
    })

    describe('#withdraw', async() => {
      it('can only be called by ValidatorSet contract', async () => {
        await token.setBlockRewardContractMock(accounts[2]).should.be.fulfilled;
        await token.mintReward([user], [100], {from: accounts[2] }).should.be.fulfilled;
        await token.setValidatorSetContractMock(accounts[3]).should.be.fulfilled;
        await token.stake(user, 100, {from: accounts[3] }).should.be.fulfilled;
        await token.withdraw(user, 100, {from: accounts[4] }).should.be.rejectedWith(ERROR_MSG);
        await token.withdraw(user, 100, {from: accounts[3] }).should.be.fulfilled;
      })
      it('should revert if ValidatorSet doesn\'t have enough balance', async () => {
        await token.setBlockRewardContractMock(accounts[2]).should.be.fulfilled;
        await token.mintReward([user], [100], {from: accounts[2] }).should.be.fulfilled;
        (await token.balanceOf(user)).should.be.bignumber.equal(100);
        await token.setValidatorSetContractMock(accounts[3]).should.be.fulfilled;
        await token.stake(user, 100, {from: accounts[3] }).should.be.fulfilled;
        await token.withdraw(user, 101, {from: accounts[3] }).should.be.rejectedWith(ERROR_MSG);
        await token.withdraw(user, 100, {from: accounts[3] }).should.be.fulfilled;
      })
      it('should decrease ValidatorSet\'s balance and increase user\'s balance', async () => {
        await token.setBlockRewardContractMock(accounts[2]).should.be.fulfilled;
        await token.mintReward([user], [100], {from: accounts[2] }).should.be.fulfilled;
        (await token.balanceOf(user)).should.be.bignumber.equal(100);
        (await token.balanceOf(accounts[3])).should.be.bignumber.equal(0);
        await token.setValidatorSetContractMock(accounts[3]).should.be.fulfilled;
        await token.stake(user, 100, {from: accounts[3] }).should.be.fulfilled;
        (await token.balanceOf(user)).should.be.bignumber.equal(0);
        (await token.balanceOf(accounts[3])).should.be.bignumber.equal(100);
        await token.withdraw(user, 60, {from: accounts[3] }).should.be.fulfilled;
        (await token.balanceOf(user)).should.be.bignumber.equal(60);
        (await token.balanceOf(accounts[3])).should.be.bignumber.equal(40);
      })
    })
  }

  describe('#mint', async() => {
    it('can mint by owner', async () => {
      (await token.totalSupply()).should.be.bignumber.equal(0);
      await token.mint(user, 1, {from: owner }).should.be.fulfilled;
      (await token.totalSupply()).should.be.bignumber.equal(1);
      (await token.balanceOf(user)).should.be.bignumber.equal(1);
    })

    it('no one can call finishMinting', async () => {
      await token.finishMinting().should.be.rejectedWith(ERROR_MSG)
    })

    it('cannot mint by non-owner', async () => {
      (await token.totalSupply()).should.be.bignumber.equal(0);
      await token.mint(user, 1, {from: user }).should.be.rejectedWith(ERROR_MSG);
      (await token.totalSupply()).should.be.bignumber.equal(0);
      (await token.balanceOf(user)).should.be.bignumber.equal(0);
    })
  })

  describe('#transfer', async() => {
    let homeErcToErcContract, foreignNativeToErcBridge, validatorContract
    beforeEach(async () => {
      validatorContract = await BridgeValidators.new()
      const authorities = [accounts[2]];
      await validatorContract.initialize(1, authorities, owner)
      homeErcToErcContract = await HomeErcToErcBridge.new()
      await homeErcToErcContract.initialize(validatorContract.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, token.address, executionDailyLimit, executionMaxPerTx, owner)
      foreignNativeToErcBridge = await ForeignNativeToErcBridge.new()
      await foreignNativeToErcBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, executionDailyLimit, executionMaxPerTx, owner);
    })
    it('sends tokens to recipient', async () => {
      await token.mint(user, 1, {from: owner }).should.be.fulfilled;
      await token.transfer(user, 1, {from: owner}).should.be.rejectedWith(ERROR_MSG);
      const {logs} = await token.transfer(owner, 1, {from: user}).should.be.fulfilled;
      (await token.balanceOf(owner)).should.be.bignumber.equal(1);
      (await token.balanceOf(user)).should.be.bignumber.equal(0);
      logs[0].event.should.be.equal("Transfer")
      logs[0].args.should.be.deep.equal({
        from: user,
        to: owner,
        value: new web3.BigNumber(1)
      })
    })

    it('sends tokens to bridge contract', async () => {
      await token.setBridgeContract(homeErcToErcContract.address).should.be.fulfilled;
      await token.mint(user, web3.toWei(1, "ether"), {from: owner }).should.be.fulfilled;

      const result = await token.transfer(homeErcToErcContract.address, minPerTx, {from: user}).should.be.fulfilled;
      result.logs[0].event.should.be.equal("Transfer")
      result.logs[0].args.should.be.deep.equal({
        from: user,
        to: homeErcToErcContract.address,
        value: minPerTx
      })

      await token.setBridgeContract(foreignNativeToErcBridge.address).should.be.fulfilled;
      const result2 = await token.transfer(foreignNativeToErcBridge.address, minPerTx, {from: user}).should.be.fulfilled;
      result2.logs[0].event.should.be.equal("Transfer")
      result2.logs[0].args.should.be.deep.equal({
        from: user,
        to: foreignNativeToErcBridge.address,
        value: minPerTx
      })
    })

    it('sends tokens to contract that does not contains onTokenTransfer method', async () => {
      await token.setBridgeContract(homeErcToErcContract.address).should.be.fulfilled;
      await token.mint(user, web3.toWei(1, "ether"), {from: owner }).should.be.fulfilled;

      const result = await token.transfer(validatorContract.address, minPerTx, {from: user}).should.be.fulfilled;
      result.logs[0].event.should.be.equal("Transfer")
      result.logs[0].args.should.be.deep.equal({
        from: user,
        to: validatorContract.address,
        value: minPerTx
      })
      result.logs[1].event.should.be.equal("ContractFallbackCallFailed")
      result.logs[1].args.should.be.deep.equal({
        from: user,
        to: validatorContract.address,
        value: minPerTx
      })
    })

    it('fail to send tokens to bridge contract out of limits', async () => {
      const lessThanMin = web3.toBigNumber(web3.toWei(0.0001, "ether"))
      await token.mint(user, web3.toWei(1, "ether"), {from: owner }).should.be.fulfilled;

      await token.setBridgeContract(homeErcToErcContract.address).should.be.fulfilled;
      await token.transfer(homeErcToErcContract.address, lessThanMin, {from: user}).should.be.rejectedWith(ERROR_MSG);

      await token.setBridgeContract(foreignNativeToErcBridge.address).should.be.fulfilled;
      await token.transfer(foreignNativeToErcBridge.address, lessThanMin, {from: user}).should.be.rejectedWith(ERROR_MSG);
    })

    if (rewardable) {
      it('fail to send tokens to ValidatorSet contract directly', async () => {
        const amount = web3.toWei(1, "ether");
        const validatorSetContractAddress = accounts[2];
        const arbitraryAccountAddress = accounts[3];
        await token.setValidatorSetContractMock(validatorSetContractAddress, {from: owner}).should.be.fulfilled;
        await token.mint(user, amount, {from: owner}).should.be.fulfilled;
        await token.transfer(validatorSetContractAddress, amount, {from: user}).should.be.rejectedWith(ERROR_MSG);
        await token.transfer(arbitraryAccountAddress, amount, {from: user}).should.be.fulfilled;
      });
    }
  })

  if (rewardable) {
    describe('#transferFrom', async() => {
      it('fail to send tokens to ValidatorSet contract directly', async () => {
        const amount = web3.toWei(1, "ether");
        const user2 = accounts[2];
        const validatorSetContractAddress = accounts[3];
        const arbitraryAccountAddress = accounts[4];
        await token.setValidatorSetContractMock(validatorSetContractAddress, {from: owner}).should.be.fulfilled;
        await token.mint(user, amount, {from: owner}).should.be.fulfilled;
        await token.approve(user2, amount, {from: user}).should.be.fulfilled;
        await token.transferFrom(user, validatorSetContractAddress, amount, {from: user2}).should.be.rejectedWith(ERROR_MSG);
        await token.transferFrom(user, arbitraryAccountAddress, amount, {from: user2}).should.be.fulfilled;
      });
    });
  }

  describe("#burn", async () => {
    it('can burn', async() => {
      await token.burn(100, {from: owner}).should.be.rejectedWith(ERROR_MSG);
      await token.mint(user, 1, {from: owner }).should.be.fulfilled;
      await token.burn(1, {from: user}).should.be.fulfilled;
      (await token.totalSupply()).should.be.bignumber.equal(0);
      (await token.balanceOf(user)).should.be.bignumber.equal(0);
    })
  })

  describe('#transferAndCall', () => {
    let homeErcToErcContract, foreignNativeToErcBridge, validatorContract
    beforeEach(async () => {
      validatorContract = await BridgeValidators.new()
      const authorities = [accounts[2]];
      await validatorContract.initialize(1, authorities, owner)
      homeErcToErcContract = await HomeErcToErcBridge.new()
      await homeErcToErcContract.initialize(validatorContract.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, token.address, executionDailyLimit, executionMaxPerTx, owner)
      foreignNativeToErcBridge = await ForeignNativeToErcBridge.new()
      await foreignNativeToErcBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, executionDailyLimit, executionMaxPerTx, owner);
    })
    it('calls contractFallback', async () => {
      const receiver = await ERC677ReceiverTest.new();
      (await receiver.from()).should.be.equal('0x0000000000000000000000000000000000000000');
      (await receiver.value()).should.be.bignumber.equal('0');
      (await receiver.data()).should.be.equal('0x');
      (await receiver.someVar()).should.be.bignumber.equal('0');

      var ERC677ReceiverTestWeb3 = web3.eth.contract(ERC677ReceiverTest.abi);
      var ERC677ReceiverTestWeb3Instance = ERC677ReceiverTestWeb3.at(receiver.address);
      var callDoSomething123 = ERC677ReceiverTestWeb3Instance.doSomething.getData(123);

      await token.mint(user, 1, {from: owner }).should.be.fulfilled;
      await token.transferAndCall(token.address, 1, callDoSomething123, {from: user}).should.be.rejectedWith(ERROR_MSG);
      await token.transferAndCall('0x0000000000000000000000000000000000000000', 1, callDoSomething123, {from: user}).should.be.rejectedWith(ERROR_MSG);
      await token.transferAndCall(receiver.address, 1, callDoSomething123, {from: user}).should.be.fulfilled;
      (await token.balanceOf(receiver.address)).should.be.bignumber.equal(1);
      (await token.balanceOf(user)).should.be.bignumber.equal(0);
      (await receiver.from()).should.be.equal(user);
      (await receiver.value()).should.be.bignumber.equal(1);
      (await receiver.data()).should.be.equal(callDoSomething123);
      (await receiver.someVar()).should.be.bignumber.equal('123');
    })

    it('sends tokens to bridge contract', async () => {
      await token.setBridgeContract(homeErcToErcContract.address).should.be.fulfilled;
      await token.mint(user, web3.toWei(1, "ether"), {from: owner }).should.be.fulfilled;

      const result = await token.transferAndCall(homeErcToErcContract.address, minPerTx, '0x', {from: user}).should.be.fulfilled;
      result.logs[0].event.should.be.equal("Transfer")
      result.logs[0].args.should.be.deep.equal({
        from: user,
        to: homeErcToErcContract.address,
        value: minPerTx
      })

      await token.setBridgeContract(foreignNativeToErcBridge.address).should.be.fulfilled;
      const result2 = await token.transferAndCall(foreignNativeToErcBridge.address, minPerTx, '0x', {from: user}).should.be.fulfilled;
      result2.logs[0].event.should.be.equal("Transfer")
      result2.logs[0].args.should.be.deep.equal({
        from: user,
        to: foreignNativeToErcBridge.address,
        value: minPerTx
      })
    })

    it('fail to sends tokens to contract that does not contains onTokenTransfer method', async () => {
      await token.setBridgeContract(homeErcToErcContract.address).should.be.fulfilled;
      await token.mint(user, web3.toWei(1, "ether"), {from: owner }).should.be.fulfilled;

      await token.transferAndCall(validatorContract.address, minPerTx, '0x', {from: user}).should.be.rejectedWith(ERROR_MSG);
    })

    it('fail to send tokens to bridge contract out of limits', async () => {
      const lessThanMin = web3.toBigNumber(web3.toWei(0.0001, "ether"))
      await token.mint(user, web3.toWei(1, "ether"), {from: owner }).should.be.fulfilled;

      await token.setBridgeContract(homeErcToErcContract.address).should.be.fulfilled;
      await token.transferAndCall(homeErcToErcContract.address, lessThanMin, '0x', {from: user}).should.be.rejectedWith(ERROR_MSG);

      await token.setBridgeContract(foreignNativeToErcBridge.address).should.be.fulfilled;
      await token.transferAndCall(foreignNativeToErcBridge.address, lessThanMin, '0x', {from: user}).should.be.rejectedWith(ERROR_MSG);
    })
  })
  describe('#claimtokens', async () => {
    it('can take send ERC20 tokens', async ()=> {
      const owner = accounts[0];
      const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"));
      let tokenSecond = await tokenContract.new("Roman Token", "RST", 18);

      await tokenSecond.mint(accounts[0], halfEther).should.be.fulfilled;
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[0]))
      await tokenSecond.transfer(token.address, halfEther);
      '0'.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[0]))
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(token.address))

      await token.claimTokens(tokenSecond.address, accounts[3], {from: owner});
      '0'.should.be.bignumber.equal(await tokenSecond.balanceOf(token.address))
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[3]))
    })
  })
  describe('#transfer', async () => {
    it('if transfer called on contract, onTokenTransfer is also invoked', async () => {
      const receiver = await ERC677ReceiverTest.new();
      (await receiver.from()).should.be.equal('0x0000000000000000000000000000000000000000');
      (await receiver.value()).should.be.bignumber.equal('0');
      (await receiver.data()).should.be.equal('0x');
      (await receiver.someVar()).should.be.bignumber.equal('0');

      await token.mint(user, 1, {from: owner }).should.be.fulfilled;
      const {logs} = await token.transfer(receiver.address, 1, {from: user}).should.be.fulfilled;

      (await token.balanceOf(receiver.address)).should.be.bignumber.equal(1);
      (await token.balanceOf(user)).should.be.bignumber.equal(0);
      (await receiver.from()).should.be.equal(user);
      (await receiver.value()).should.be.bignumber.equal(1);
      (await receiver.data()).should.be.equal('0x');
      logs[0].event.should.be.equal("Transfer")
    })
    it('if transfer called on contract, still works even if onTokenTransfer doesnot exist', async () => {
      const someContract = await tokenContract.new("Some", "Token", 18);
      await token.mint(user, 2, {from: owner }).should.be.fulfilled;
      const tokenTransfer = await token.transfer(someContract.address, 1, {from: user}).should.be.fulfilled;
      const tokenTransfer2 = await token.transfer(accounts[0], 1, {from: user}).should.be.fulfilled;
      (await token.balanceOf(someContract.address)).should.be.bignumber.equal(1);
      (await token.balanceOf(user)).should.be.bignumber.equal(0);
      tokenTransfer.logs[0].event.should.be.equal("Transfer")
      tokenTransfer2.logs[0].event.should.be.equal("Transfer")
    })
  })
}

contract('ERC677BridgeToken', async (accounts) => {
  await testERC677BridgeToken(accounts, false);
})

contract('ERC677BridgeTokenRewardable', async (accounts) => {
  await testERC677BridgeToken(accounts, true);
})
