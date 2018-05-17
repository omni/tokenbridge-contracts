const ForeignBridge = artifacts.require("ForeignBridge.sol");
const ForeignBridgeV2 = artifacts.require("ForeignBridgeV2.sol");
const BridgeValidators = artifacts.require("BridgeValidators.sol");
const EternalStorageProxy = artifacts.require("EternalStorageProxy.sol");

const POA20 = artifacts.require("POA20.sol");
const {ERROR_MSG, ZERO_ADDRESS, ERROR_MSG_OPCODE} = require('./setup');
const {createMessage, sign, signatureToVRS, strip0x} = require('./helpers/helpers');
const oneEther = web3.toBigNumber(web3.toWei(1, "ether"));
const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"));
const minPerTx = web3.toBigNumber(web3.toWei(0.01, "ether"));
const Web3Utils = require('web3-utils');
const requireBlockConfirmations = 8;
const gasPrice = Web3Utils.toWei('1', 'gwei');

const getEvents = function(contract, filter) {
  return new Promise((resolve, reject) => {
      var event = contract[filter.event]();
      event.watch();
      event.get((error, logs) => {
        if(logs.length > 0){
          resolve(logs);
        } else {
          throw Error("Failed to find filtered event for " + filter.event);
        }
      });
      event.stopWatching();
  });
}
contract('ForeignBridge', async (accounts) => {
  let homeContract, validatorContract, authorities, owner, token;
  before(async () => {
    validatorContract = await BridgeValidators.new()
    authorities = [accounts[1], accounts[2]];
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
  })

  describe('#initialize', async () => {
    it('should initialize', async () => {
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18);
      let foreignBridge =  await ForeignBridge.new();

      ZERO_ADDRESS.should.be.equal(await foreignBridge.validatorContract())
      '0'.should.be.bignumber.equal(await foreignBridge.deployedAtBlock())
      '0'.should.be.bignumber.equal(await foreignBridge.dailyLimit())
      '0'.should.be.bignumber.equal(await foreignBridge.maxPerTx())
      false.should.be.equal(await foreignBridge.isInitialized())
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations);

      true.should.be.equal(await foreignBridge.isInitialized())
      validatorContract.address.should.be.equal(await foreignBridge.validatorContract());
      (await foreignBridge.deployedAtBlock()).should.be.bignumber.above(0);
      oneEther.should.be.bignumber.equal(await foreignBridge.dailyLimit())
      halfEther.should.be.bignumber.equal(await foreignBridge.maxPerTx())
      minPerTx.should.be.bignumber.equal(await foreignBridge.minPerTx())
    })
  })
  describe('#deposit', async () => {
    beforeEach(async () => {
      foreignBridge = await ForeignBridge.new()
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18);
      const oneEther = web3.toBigNumber(web3.toWei(1, "ether"));
      const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"));
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations);
      oneEther.should.be.bignumber.equal(await foreignBridge.dailyLimit());
      await token.transferOwnership(foreignBridge.address);
    })
    it('should allow to deposit', async () => {
      var recipientAccount = accounts[3];
      const balanceBefore = await token.balanceOf(recipientAccount)
      const totalSupplyBefore = await token.totalSupply()
      var homeGasPrice = web3.toBigNumber(0);
      var value = web3.toBigNumber(web3.toWei(0.25, "ether"));
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(recipientAccount, value, transactionHash, homeGasPrice);
      var signature = await sign(authorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridge.deposits(transactionHash))
      const {logs} = await foreignBridge.deposit([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled
      logs[0].event.should.be.equal("Deposit")
      logs[0].args.recipient.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(value)
      logs[0].args.transactionHash.should.be.equal(transactionHash);

      const balanceAfter = await token.balanceOf(recipientAccount);
      const totalSupplyAfter = await token.totalSupply();
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))
      totalSupplyAfter.should.be.bignumber.equal(totalSupplyBefore.add(value))
      true.should.be.equal(await foreignBridge.deposits(transactionHash))
    })
    it('should allow second deposit with different transactionHash but same recipient and value', async ()=> {
      var recipientAccount = accounts[3];
      const balanceBefore = await token.balanceOf(recipientAccount)
      // tx 1
      var value = web3.toBigNumber(web3.toWei(0.25, "ether"));
      var homeGasPrice = web3.toBigNumber(0);
      var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      var message = createMessage(recipientAccount, value, transactionHash, homeGasPrice);
      var signature = await sign(authorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridge.deposits(transactionHash))
      await foreignBridge.deposit([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled
      // tx 2
      var transactionHash2 = "0x77a496628a776a03d58d7e6059a5937f04bebd8ba4ff89f76dd4bb8ba7e291ee";
      var message2 = createMessage(recipientAccount, value, transactionHash2, homeGasPrice);
      var signature2 = await sign(authorities[0], message2)
      var vrs2 = signatureToVRS(signature2);
      false.should.be.equal(await foreignBridge.deposits(transactionHash2))
      const {logs} = await foreignBridge.deposit([vrs2.v], [vrs2.r], [vrs2.s], message2).should.be.fulfilled

      logs[0].event.should.be.equal("Deposit")
      logs[0].args.recipient.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(value)
      logs[0].args.transactionHash.should.be.equal(transactionHash2);
      const totalSupply = await token.totalSupply()
      const balanceAfter = await token.balanceOf(recipientAccount)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value.mul(2)))
      totalSupply.should.be.bignumber.equal(value.mul(2))
      true.should.be.equal(await foreignBridge.deposits(transactionHash))
      true.should.be.equal(await foreignBridge.deposits(transactionHash2))
    })

    it('should not allow second deposit (replay attack) with same transactionHash but different recipient', async () => {
      var recipientAccount = accounts[3];
      const balanceBefore = await token.balanceOf(recipientAccount)
      // tx 1
      var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      var homeGasPrice = web3.toBigNumber(0);
      var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      var message = createMessage(recipientAccount, value, transactionHash, homeGasPrice);
      var signature = await sign(authorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridge.deposits(transactionHash))
      await foreignBridge.deposit([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled
      // tx 2
      var message2 = createMessage(accounts[4], value, transactionHash, homeGasPrice);
      var signature2 = await sign(authorities[0], message2)
      var vrs = signatureToVRS(signature2);
      true.should.be.equal(await foreignBridge.deposits(transactionHash))
      await foreignBridge.deposit([vrs.v], [vrs.r], [vrs.s], message2).should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('#deposit with 2 minimum signatures', async () => {
    let multisigValidatorContract, twoAuthorities, ownerOfValidatorContract, foreignBridgeWithMultiSignatures
    beforeEach(async () => {
      multisigValidatorContract = await BridgeValidators.new()
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18);
      twoAuthorities = [accounts[0], accounts[1]];
      ownerOfValidatorContract = accounts[3]
      const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"));
      await multisigValidatorContract.initialize(2, twoAuthorities, ownerOfValidatorContract, {from: ownerOfValidatorContract})
      foreignBridgeWithMultiSignatures = await ForeignBridge.new()
      const oneEther = web3.toBigNumber(web3.toWei(1, "ether"));
      await foreignBridgeWithMultiSignatures.initialize(multisigValidatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations, {from: ownerOfValidatorContract});
      await token.transferOwnership(foreignBridgeWithMultiSignatures.address);
    })
    it('deposit should fail if not enough signatures are provided', async () => {

      var recipientAccount = accounts[4];
      const balanceBefore = await web3.eth.getBalance(recipientAccount)
      const homeBalanceBefore = await web3.eth.getBalance(foreignBridgeWithMultiSignatures.address)
      // msg 1
      var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      var homeGasPrice = web3.toBigNumber(0);
      var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      var message = createMessage(recipientAccount, value, transactionHash, homeGasPrice);
      var signature = await sign(twoAuthorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridgeWithMultiSignatures.deposits(transactionHash))
      await foreignBridgeWithMultiSignatures.deposit([vrs.v], [vrs.r], [vrs.s], message).should.be.rejectedWith(ERROR_MSG)
      // msg 2
      var signature2 = await sign(twoAuthorities[1], message)
      var vrs2 = signatureToVRS(signature2);
      const {logs} = await foreignBridgeWithMultiSignatures.deposit([vrs.v, vrs2.v], [vrs.r, vrs2.r], [vrs.s, vrs2.s], message).should.be.fulfilled;

      logs[0].event.should.be.equal("Deposit")
      logs[0].args.recipient.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(value)
      logs[0].args.transactionHash.should.be.equal(transactionHash);
      const balanceAfter = await token.balanceOf(recipientAccount)
      true.should.be.equal(await foreignBridgeWithMultiSignatures.deposits(transactionHash))

    })
    it('deposit should fail if duplicate signature is provided', async () => {
      var recipientAccount = accounts[4];
      const balanceBefore = await web3.eth.getBalance(recipientAccount)
      const homeBalanceBefore = await web3.eth.getBalance(foreignBridgeWithMultiSignatures.address)
      // msg 1
      var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      var homeGasPrice = web3.toBigNumber(0);
      var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      var message = createMessage(recipientAccount, value, transactionHash, homeGasPrice);
      var signature = await sign(twoAuthorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridgeWithMultiSignatures.deposits(transactionHash))
      await foreignBridgeWithMultiSignatures.deposit([vrs.v, vrs.v], [vrs.r, vrs.r], [vrs.s, vrs.s], message).should.be.rejectedWith(ERROR_MSG)
    })
  })


  describe('#onTokenTransfer', async () => {
    it('can only be called from token contract', async ()=> {
      const owner = accounts[3]
      const user = accounts[4]
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18, {from: owner});
      foreignBridge = await ForeignBridge.new();
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations);
      await token.mint(user, halfEther, {from: owner }).should.be.fulfilled;
      await token.transferOwnership(foreignBridge.address, {from: owner});
      await foreignBridge.onTokenTransfer(user, halfEther, '0x00', {from: owner}).should.be.rejectedWith(ERROR_MSG);
      await token.transferAndCall(foreignBridge.address, halfEther, '0x00', {from: user}).should.be.fulfilled;
      '0'.should.be.bignumber.equal(await token.totalSupply());
      '0'.should.be.bignumber.equal(await token.balanceOf(user));
    })
    it('should not allow to burn more than the limit', async () => {
      const owner = accounts[3]
      const user = accounts[4]
      const valueMoreThanLimit = halfEther.add(1);
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18, {from: owner});
      foreignBridge = await ForeignBridge.new();
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations);
      await token.mint(user, valueMoreThanLimit, {from: owner }).should.be.fulfilled;
      await token.transferOwnership(foreignBridge.address, {from: owner});
      await token.transferAndCall(foreignBridge.address, valueMoreThanLimit, '0x00', {from: user}).should.be.rejectedWith(ERROR_MSG);
      valueMoreThanLimit.should.be.bignumber.equal(await token.totalSupply());
      valueMoreThanLimit.should.be.bignumber.equal(await token.balanceOf(user));
      const {logs} = await token.transferAndCall(foreignBridge.address, halfEther, '0x00', {from: user}).should.be.fulfilled;
      '1'.should.be.bignumber.equal(await token.totalSupply());
      '1'.should.be.bignumber.equal(await token.balanceOf(user));
      const events = await getEvents(foreignBridge, {event: 'Withdraw'});
      events[0].args.should.be.deep.equal({
        recipient: user,
        value: halfEther
      })
    })
    it('should only let to send within maxPerTx limit', async () => {
      const owner = accounts[3]
      const user = accounts[4]
      const valueMoreThanLimit = halfEther.add(1);
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18, {from: owner});
      foreignBridge = await ForeignBridge.new();
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations);
      await token.mint(user, oneEther.add(1), {from: owner }).should.be.fulfilled;
      await token.transferOwnership(foreignBridge.address, {from: owner});
      await token.transferAndCall(foreignBridge.address, valueMoreThanLimit, '0x00', {from: user}).should.be.rejectedWith(ERROR_MSG);
      oneEther.add(1).should.be.bignumber.equal(await token.totalSupply());
      oneEther.add(1).should.be.bignumber.equal(await token.balanceOf(user));
      await token.transferAndCall(foreignBridge.address, halfEther, '0x00', {from: user}).should.be.fulfilled;
      valueMoreThanLimit.should.be.bignumber.equal(await token.totalSupply());
      valueMoreThanLimit.should.be.bignumber.equal(await token.balanceOf(user));
      await token.transferAndCall(foreignBridge.address, halfEther, '0x00', {from: user}).should.be.fulfilled;
      '1'.should.be.bignumber.equal(await token.totalSupply());
      '1'.should.be.bignumber.equal(await token.balanceOf(user));
      await token.transferAndCall(foreignBridge.address, '1', '0x00', {from: user}).should.be.rejectedWith(ERROR_MSG);
    })

    it('should not let to withdraw less than minPerTx', async () => {
      const owner = accounts[3]
      const user = accounts[4]
      const valueLessThanMinPerTx = minPerTx.sub(1);
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18, {from: owner});
      foreignBridge = await ForeignBridge.new();
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations);
      await token.mint(user, oneEther, {from: owner }).should.be.fulfilled;
      await token.transferOwnership(foreignBridge.address, {from: owner});
      await token.transferAndCall(foreignBridge.address, valueLessThanMinPerTx, '0x00', {from: user}).should.be.rejectedWith(ERROR_MSG);
      oneEther.should.be.bignumber.equal(await token.totalSupply());
      oneEther.should.be.bignumber.equal(await token.balanceOf(user));
      await token.transferAndCall(foreignBridge.address, minPerTx, '0x00', {from: user}).should.be.fulfilled;
      oneEther.sub(minPerTx).should.be.bignumber.equal(await token.totalSupply());
      oneEther.sub(minPerTx).should.be.bignumber.equal(await token.balanceOf(user));
    })
  })

  describe('#setting limits', async () => {
    let foreignBridge;
    beforeEach(async () => {
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18);
      foreignBridge = await ForeignBridge.new();
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations);
      await token.transferOwnership(foreignBridge.address)
    })
    it('#setMaxPerTx allows to set only to owner and cannot be more than daily limit', async () => {
      await foreignBridge.setMaxPerTx(halfEther, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG);
      await foreignBridge.setMaxPerTx(halfEther, {from: owner}).should.be.fulfilled;

      await foreignBridge.setMaxPerTx(oneEther, {from: owner}).should.be.rejectedWith(ERROR_MSG);
    })

    it('#setMinPerTx allows to set only to owner and cannot be more than daily limit and should be less than maxPerTx', async () => {
      await foreignBridge.setMinPerTx(minPerTx, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG);
      await foreignBridge.setMinPerTx(minPerTx, {from: owner}).should.be.fulfilled;

      await foreignBridge.setMinPerTx(oneEther, {from: owner}).should.be.rejectedWith(ERROR_MSG);
    })
  })

  describe('#upgradeable', async () => {
    it('can be upgraded', async () => {
      const REQUIRED_NUMBER_OF_VALIDATORS = 1
      const VALIDATORS = [accounts[1]]
      const PROXY_OWNER  = accounts[0]
      const FOREIGN_DAILY_LIMIT = oneEther;
      const FOREIGN_MAX_AMOUNT_PER_TX = halfEther;
      const FOREIGN_MIN_AMOUNT_PER_TX = minPerTx;
      // Validators Contract
      let validatorsProxy = await EternalStorageProxy.new().should.be.fulfilled;
      const validatorsContractImpl = await BridgeValidators.new().should.be.fulfilled;
      await validatorsProxy.upgradeTo('1', validatorsContractImpl.address).should.be.fulfilled;
      validatorsContractImpl.address.should.be.equal(await validatorsProxy.implementation())

      validatorsProxy = await BridgeValidators.at(validatorsProxy.address);
      await validatorsProxy.initialize(REQUIRED_NUMBER_OF_VALIDATORS, VALIDATORS, PROXY_OWNER).should.be.fulfilled;
      // POA20
      let token = await POA20.new("POA ERC20 Foundation", "POA20", 18);

      // ForeignBridge V1 Contract

      let foreignBridgeProxy = await EternalStorageProxy.new().should.be.fulfilled;
      const foreignBridgeImpl = await ForeignBridge.new().should.be.fulfilled;
      await foreignBridgeProxy.upgradeTo('1', foreignBridgeImpl.address).should.be.fulfilled;

      foreignBridgeProxy = await ForeignBridge.at(foreignBridgeProxy.address);
      await foreignBridgeProxy.initialize(validatorsProxy.address, token.address, FOREIGN_DAILY_LIMIT, FOREIGN_MAX_AMOUNT_PER_TX, FOREIGN_MIN_AMOUNT_PER_TX, gasPrice, requireBlockConfirmations)
      await token.transferOwnership(foreignBridgeProxy.address).should.be.fulfilled;

      foreignBridgeProxy.address.should.be.equal(await token.owner());

      // Deploy V2
      let foreignImplV2 = await ForeignBridgeV2.new();
      let foreignBridgeProxyUpgrade = await EternalStorageProxy.at(foreignBridgeProxy.address);
      await foreignBridgeProxyUpgrade.upgradeTo('2', foreignImplV2.address).should.be.fulfilled;
      foreignImplV2.address.should.be.equal(await foreignBridgeProxyUpgrade.implementation())

      let foreignBridgeV2Proxy = await ForeignBridgeV2.at(foreignBridgeProxy.address)
      await foreignBridgeV2Proxy.changeTokenOwnership(accounts[2], {from: accounts[4]}).should.be.rejectedWith(ERROR_MSG)
      await foreignBridgeV2Proxy.changeTokenOwnership(accounts[2], {from: PROXY_OWNER}).should.be.fulfilled;
      await token.transferOwnership(foreignBridgeProxy.address, {from: accounts[2]}).should.be.fulfilled;
    })
    it('can be deployed via upgradeToAndCall', async () => {
      const fakeTokenAddress = accounts[7]
      const fakeValidatorsAddress = accounts[6]
      const FOREIGN_DAILY_LIMIT = oneEther;
      const FOREIGN_MAX_AMOUNT_PER_TX = halfEther;
      const FOREIGN_MIN_AMOUNT_PER_TX = minPerTx;

      let storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      let foreignBridge =  await ForeignBridge.new();
      let data = foreignBridge.initialize.request(
        fakeValidatorsAddress, fakeTokenAddress, FOREIGN_DAILY_LIMIT, FOREIGN_MAX_AMOUNT_PER_TX, FOREIGN_MIN_AMOUNT_PER_TX, gasPrice, requireBlockConfirmations).params[0].data
      await storageProxy.upgradeToAndCall('1', foreignBridge.address, data).should.be.fulfilled;
      let finalContract = await ForeignBridge.at(storageProxy.address);
      true.should.be.equal(await finalContract.isInitialized());
      fakeValidatorsAddress.should.be.equal(await finalContract.validatorContract())
      FOREIGN_DAILY_LIMIT.should.be.bignumber.equal(await finalContract.dailyLimit())
      FOREIGN_MAX_AMOUNT_PER_TX.should.be.bignumber.equal(await finalContract.maxPerTx())
      FOREIGN_MIN_AMOUNT_PER_TX.should.be.bignumber.equal(await finalContract.minPerTx())
    })
  })

  describe('#claimTokens', async () => {
    it('can send erc20', async () => {
      const owner = accounts[0];
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18);
      foreignBridge = await ForeignBridge.new();
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations);
      await token.transferOwnership(foreignBridge.address)

      let tokenSecond = await POA20.new("Roman Token", "RST", 18);

      await tokenSecond.mint(accounts[0], halfEther).should.be.fulfilled;
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[0]))
      await tokenSecond.transfer(foreignBridge.address, halfEther);
      '0'.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[0]))
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(foreignBridge.address))

      await foreignBridge.claimTokens(tokenSecond.address, accounts[3], {from: owner});
      '0'.should.be.bignumber.equal(await tokenSecond.balanceOf(foreignBridge.address))
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[3]))

    })
    it('also calls claimTokens on tokenAddress', async () => {
      const owner = accounts[0];
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18);
      foreignBridge = await ForeignBridge.new();
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations);
      await token.transferOwnership(foreignBridge.address)

      let tokenSecond = await POA20.new("Roman Token", "RST", 18);

      await tokenSecond.mint(accounts[0], 150).should.be.fulfilled;
      '150'.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[0]))
      await tokenSecond.transfer(token.address, '150');
      '0'.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[0]))
      '150'.should.be.bignumber.equal(await tokenSecond.balanceOf(token.address))

      await foreignBridge.claimTokensFromErc677(tokenSecond.address, accounts[3], {from: owner});
      '0'.should.be.bignumber.equal(await tokenSecond.balanceOf(foreignBridge.address))
      '150'.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[3]))
    })
  })
})
