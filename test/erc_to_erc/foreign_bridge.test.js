const ForeignBridge = artifacts.require("ForeignBridgeErcToErc.sol");
const ForeignBridgeV2 = artifacts.require("ForeignBridgeV2.sol");
const BridgeValidators = artifacts.require("BridgeValidators.sol");
const EternalStorageProxy = artifacts.require("EternalStorageProxy.sol");

const ERC677BridgeToken = artifacts.require("ERC677BridgeToken.sol");
const {ERROR_MSG, ZERO_ADDRESS, ERROR_MSG_OPCODE} = require('../setup');
const {createMessage, sign, signatureToVRS, strip0x} = require('../helpers/helpers');
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
contract('ForeignBridge_ERC20_to_ERC20', async (accounts) => {
  let homeContract, validatorContract, authorities, owner, token;
  before(async () => {
    validatorContract = await BridgeValidators.new()
    authorities = [accounts[1], accounts[2]];
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
  })

  describe('#initialize', async () => {
    it('should initialize', async () => {
      token = await ERC677BridgeToken.new("Some ERC20", "RSZT", 18);
      let foreignBridge =  await ForeignBridge.new();

      ZERO_ADDRESS.should.be.equal(await foreignBridge.erc20token());
      ZERO_ADDRESS.should.be.equal(await foreignBridge.validatorContract())
      '0'.should.be.bignumber.equal(await foreignBridge.deployedAtBlock())
      false.should.be.equal(await foreignBridge.isInitialized())
      await foreignBridge.initialize(validatorContract.address, token.address);

      token.address.should.be.equal(await foreignBridge.erc20token());
      true.should.be.equal(await foreignBridge.isInitialized())
      validatorContract.address.should.be.equal(await foreignBridge.validatorContract());
      token.address.should.be.equal(await foreignBridge.erc20token());
      (await foreignBridge.deployedAtBlock()).should.be.bignumber.above(0);
    })
  })
  describe('#executeSignatures', async () => {
    var value = web3.toBigNumber(web3.toWei(0.25, "ether"));
    beforeEach(async () => {
      foreignBridge = await ForeignBridge.new()
      token = await ERC677BridgeToken.new("Some ERC20", "RSZT", 18);
      await foreignBridge.initialize(validatorContract.address, token.address);
      await token.mint(foreignBridge.address,value);
    })
    it('should allow to executeSignatures', async () => {
      var recipientAccount = accounts[3];
      const balanceBeforeBridge = await token.balanceOf(foreignBridge.address)
      const balanceBefore = await token.balanceOf(recipientAccount)
      const totalSupplyBefore = await token.totalSupply()
      var homeGasPrice = web3.toBigNumber(0);

      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(recipientAccount, value, transactionHash);
      var signature = await sign(authorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      const {logs} = await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled
      logs[0].event.should.be.equal("RelayedMessage")
      logs[0].args.recipient.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(value)

      const balanceAfter = await token.balanceOf(recipientAccount);
      const balanceAfterBridge = await token.balanceOf(foreignBridge.address);
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))
      balanceAfterBridge.should.be.bignumber.equal(0)
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
    })
    it('should allow second withdrawal with different transactionHash but same recipient and value', async ()=> {
      var recipientAccount = accounts[3];
      const balanceBefore = await token.balanceOf(recipientAccount)
      // tx 1
      var value = web3.toBigNumber(web3.toWei(0.25, "ether"));
      var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      var message = createMessage(recipientAccount, value, transactionHash);
      var signature = await sign(authorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled
      // tx 2
      await token.mint(foreignBridge.address,value);
      var transactionHash2 = "0x77a496628a776a03d58d7e6059a5937f04bebd8ba4ff89f76dd4bb8ba7e291ee";
      var message2 = createMessage(recipientAccount, value, transactionHash2);
      var signature2 = await sign(authorities[0], message2)
      var vrs2 = signatureToVRS(signature2);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash2))
      const {logs} = await foreignBridge.executeSignatures([vrs2.v], [vrs2.r], [vrs2.s], message2).should.be.fulfilled

      logs[0].event.should.be.equal("RelayedMessage")
      logs[0].args.recipient.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(value)
      const balanceAfter = await token.balanceOf(recipientAccount)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value.mul(2)))
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash2))
    })

    it('should not allow second withdraw (replay attack) with same transactionHash but different recipient', async () => {
      var recipientAccount = accounts[3];
      const balanceBefore = await token.balanceOf(recipientAccount)
      // tx 1
      var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      var message = createMessage(recipientAccount, value, transactionHash);
      var signature = await sign(authorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.fulfilled
      // tx 2
      await token.mint(foreignBridge.address,value);
      var message2 = createMessage(accounts[4], value, transactionHash);
      var signature2 = await sign(authorities[0], message2)
      var vrs = signatureToVRS(signature2);
      true.should.be.equal(await foreignBridge.relayedMessages(transactionHash))
      await foreignBridge.executeSignatures([vrs.v], [vrs.r], [vrs.s], message2).should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('#withdraw with 2 minimum signatures', async () => {
    let multisigValidatorContract, twoAuthorities, ownerOfValidatorContract, foreignBridgeWithMultiSignatures
    var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
    beforeEach(async () => {
      multisigValidatorContract = await BridgeValidators.new()
      token = await ERC677BridgeToken.new("Some ERC20", "RSZT", 18);
      twoAuthorities = [accounts[0], accounts[1]];
      ownerOfValidatorContract = accounts[3]
      const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"));
      await multisigValidatorContract.initialize(2, twoAuthorities, ownerOfValidatorContract, {from: ownerOfValidatorContract})
      foreignBridgeWithMultiSignatures = await ForeignBridge.new()
      const oneEther = web3.toBigNumber(web3.toWei(1, "ether"));
      await foreignBridgeWithMultiSignatures.initialize(multisigValidatorContract.address, token.address, {from: ownerOfValidatorContract});
      await token.mint(foreignBridgeWithMultiSignatures.address,value);
    })
    it('withdraw should fail if not enough signatures are provided', async () => {

      var recipientAccount = accounts[4];
      const balanceBefore = await web3.eth.getBalance(recipientAccount)
      const homeBalanceBefore = await web3.eth.getBalance(foreignBridgeWithMultiSignatures.address)
      // msg 1
      var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      var message = createMessage(recipientAccount, value, transactionHash);
      var signature = await sign(twoAuthorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridgeWithMultiSignatures.relayedMessages(transactionHash))
      await foreignBridgeWithMultiSignatures.executeSignatures([vrs.v], [vrs.r], [vrs.s], message).should.be.rejectedWith(ERROR_MSG)
      // msg 2
      var signature2 = await sign(twoAuthorities[1], message)
      var vrs2 = signatureToVRS(signature2);
      const {logs} = await foreignBridgeWithMultiSignatures.executeSignatures([vrs.v, vrs2.v], [vrs.r, vrs2.r], [vrs.s, vrs2.s], message).should.be.fulfilled;

      logs[0].event.should.be.equal("RelayedMessage")
      logs[0].args.recipient.should.be.equal(recipientAccount)
      logs[0].args.value.should.be.bignumber.equal(value)
      const balanceAfter = await token.balanceOf(recipientAccount)
      true.should.be.equal(await foreignBridgeWithMultiSignatures.relayedMessages(transactionHash))

    })
    it('withdraw should fail if duplicate signature is provided', async () => {
      var recipientAccount = accounts[4];
      const balanceBefore = await web3.eth.getBalance(recipientAccount)
      const homeBalanceBefore = await web3.eth.getBalance(foreignBridgeWithMultiSignatures.address)
      // msg 1
      var transactionHash = "0x35d3818e50234655f6aebb2a1cfbf30f59568d8a4ec72066fac5a25dbe7b8121";
      var message = createMessage(recipientAccount, value, transactionHash);
      var signature = await sign(twoAuthorities[0], message)
      var vrs = signatureToVRS(signature);
      false.should.be.equal(await foreignBridgeWithMultiSignatures.relayedMessages(transactionHash))
      await foreignBridgeWithMultiSignatures.executeSignatures([vrs.v, vrs.v], [vrs.r, vrs.r], [vrs.s, vrs.s], message).should.be.rejectedWith(ERROR_MSG)
    })
  })


  // describe('#onTokenTransfer', async () => {
  //   it('can only be called from token contract', async ()=> {
  //     const owner = accounts[3]
  //     const user = accounts[4]
  //     token = await ERC677BridgeToken.new("Some ERC20", "RSZT", 18, {from: owner});
  //     foreignBridge = await ForeignBridge.new();
  //     await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations);
  //     await token.mint(user, halfEther, {from: owner }).should.be.fulfilled;
  //     await token.transferOwnership(foreignBridge.address, {from: owner});
  //     await foreignBridge.onTokenTransfer(user, halfEther, '0x00', {from: owner}).should.be.rejectedWith(ERROR_MSG);
  //     await token.transferAndCall(foreignBridge.address, halfEther, '0x00', {from: user}).should.be.fulfilled;
  //     '0'.should.be.bignumber.equal(await token.totalSupply());
  //     '0'.should.be.bignumber.equal(await token.balanceOf(user));
  //   })
  //   it('should not allow to burn more than the limit', async () => {
  //     const owner = accounts[3]
  //     const user = accounts[4]
  //     const valueMoreThanLimit = halfEther.add(1);
  //     token = await ERC677BridgeToken.new("Some ERC20", "RSZT", 18, {from: owner});
  //     foreignBridge = await ForeignBridge.new();
  //     await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations);
  //     await token.mint(user, valueMoreThanLimit, {from: owner }).should.be.fulfilled;
  //     await token.transferOwnership(foreignBridge.address, {from: owner});
  //     await token.transferAndCall(foreignBridge.address, valueMoreThanLimit, '0x00', {from: user}).should.be.rejectedWith(ERROR_MSG);
  //     valueMoreThanLimit.should.be.bignumber.equal(await token.totalSupply());
  //     valueMoreThanLimit.should.be.bignumber.equal(await token.balanceOf(user));
  //     const {logs} = await token.transferAndCall(foreignBridge.address, halfEther, '0x00', {from: user}).should.be.fulfilled;
  //     '1'.should.be.bignumber.equal(await token.totalSupply());
  //     '1'.should.be.bignumber.equal(await token.balanceOf(user));
  //     const events = await getEvents(foreignBridge, {event: 'Withdraw'});
  //     events[0].args.should.be.deep.equal({
  //       recipient: user,
  //       value: halfEther
  //     })
  //   })
  //   it('should only let to send within maxPerTx limit', async () => {
  //     const owner = accounts[3]
  //     const user = accounts[4]
  //     const valueMoreThanLimit = halfEther.add(1);
  //     token = await ERC677BridgeToken.new("Some ERC20", "RSZT", 18, {from: owner});
  //     foreignBridge = await ForeignBridge.new();
  //     await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations);
  //     await token.mint(user, oneEther.add(1), {from: owner }).should.be.fulfilled;
  //     await token.transferOwnership(foreignBridge.address, {from: owner});
  //     await token.transferAndCall(foreignBridge.address, valueMoreThanLimit, '0x00', {from: user}).should.be.rejectedWith(ERROR_MSG);
  //     oneEther.add(1).should.be.bignumber.equal(await token.totalSupply());
  //     oneEther.add(1).should.be.bignumber.equal(await token.balanceOf(user));
  //     await token.transferAndCall(foreignBridge.address, halfEther, '0x00', {from: user}).should.be.fulfilled;
  //     valueMoreThanLimit.should.be.bignumber.equal(await token.totalSupply());
  //     valueMoreThanLimit.should.be.bignumber.equal(await token.balanceOf(user));
  //     await token.transferAndCall(foreignBridge.address, halfEther, '0x00', {from: user}).should.be.fulfilled;
  //     '1'.should.be.bignumber.equal(await token.totalSupply());
  //     '1'.should.be.bignumber.equal(await token.balanceOf(user));
  //     await token.transferAndCall(foreignBridge.address, '1', '0x00', {from: user}).should.be.rejectedWith(ERROR_MSG);
  //   })

  //   it('should not let to withdraw less than minPerTx', async () => {
  //     const owner = accounts[3]
  //     const user = accounts[4]
  //     const valueLessThanMinPerTx = minPerTx.sub(1);
  //     token = await ERC677BridgeToken.new("Some ERC20", "RSZT", 18, {from: owner});
  //     foreignBridge = await ForeignBridge.new();
  //     await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations);
  //     await token.mint(user, oneEther, {from: owner }).should.be.fulfilled;
  //     await token.transferOwnership(foreignBridge.address, {from: owner});
  //     await token.transferAndCall(foreignBridge.address, valueLessThanMinPerTx, '0x00', {from: user}).should.be.rejectedWith(ERROR_MSG);
  //     oneEther.should.be.bignumber.equal(await token.totalSupply());
  //     oneEther.should.be.bignumber.equal(await token.balanceOf(user));
  //     await token.transferAndCall(foreignBridge.address, minPerTx, '0x00', {from: user}).should.be.fulfilled;
  //     oneEther.sub(minPerTx).should.be.bignumber.equal(await token.totalSupply());
  //     oneEther.sub(minPerTx).should.be.bignumber.equal(await token.balanceOf(user));
  //   })
  // })

  describe('#upgradeable', async () => {
    it('can be upgraded', async () => {
      const REQUIRED_NUMBER_OF_VALIDATORS = 1
      const VALIDATORS = [accounts[1]]
      const PROXY_OWNER  = accounts[0]
      // Validators Contract
      let validatorsProxy = await EternalStorageProxy.new().should.be.fulfilled;
      const validatorsContractImpl = await BridgeValidators.new().should.be.fulfilled;
      await validatorsProxy.upgradeTo('1', validatorsContractImpl.address).should.be.fulfilled;
      validatorsContractImpl.address.should.be.equal(await validatorsProxy.implementation())

      validatorsProxy = await BridgeValidators.at(validatorsProxy.address);
      await validatorsProxy.initialize(REQUIRED_NUMBER_OF_VALIDATORS, VALIDATORS, PROXY_OWNER).should.be.fulfilled;
      let token = await ERC677BridgeToken.new("Some ERC20", "RSZT", 18);

      // ForeignBridge V1 Contract

      let foreignBridgeProxy = await EternalStorageProxy.new().should.be.fulfilled;
      const foreignBridgeImpl = await ForeignBridge.new().should.be.fulfilled;
      await foreignBridgeProxy.upgradeTo('1', foreignBridgeImpl.address).should.be.fulfilled;

      foreignBridgeProxy = await ForeignBridge.at(foreignBridgeProxy.address);
      await foreignBridgeProxy.initialize(validatorsProxy.address, token.address)

      // Deploy V2
      let foreignImplV2 = await ForeignBridgeV2.new();
      let foreignBridgeProxyUpgrade = await EternalStorageProxy.at(foreignBridgeProxy.address);
      await foreignBridgeProxyUpgrade.upgradeTo('2', foreignImplV2.address).should.be.fulfilled;
      foreignImplV2.address.should.be.equal(await foreignBridgeProxyUpgrade.implementation())

      let foreignBridgeV2Proxy = await ForeignBridgeV2.at(foreignBridgeProxy.address)
      await foreignBridgeV2Proxy.doSomething(accounts[2], {from: accounts[4]}).should.be.rejectedWith(ERROR_MSG)
      await foreignBridgeV2Proxy.doSomething(accounts[2], {from: PROXY_OWNER}).should.be.fulfilled;
      (await foreignBridgeV2Proxy.something()).should.be.equal(accounts[2])
    })
    it('can be deployed via upgradeToAndCall', async () => {
      const fakeTokenAddress = accounts[7]
      const fakeValidatorsAddress = accounts[6]

      let storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      let foreignBridge =  await ForeignBridge.new();
      let data = foreignBridge.initialize.request(
        fakeValidatorsAddress, fakeTokenAddress).params[0].data
      await storageProxy.upgradeToAndCall('1', foreignBridge.address, data).should.be.fulfilled;
      let finalContract = await ForeignBridge.at(storageProxy.address);
      true.should.be.equal(await finalContract.isInitialized());
      fakeValidatorsAddress.should.be.equal(await finalContract.validatorContract())
    })
  })

  describe('#claimTokens', async () => {
    it('can send erc20', async () => {
      const owner = accounts[0];
      token = await ERC677BridgeToken.new("Some ERC20", "RSZT", 18);
      foreignBridge = await ForeignBridge.new();
      await foreignBridge.initialize(validatorContract.address, token.address);

      let tokenSecond = await ERC677BridgeToken.new("Roman Token", "RST", 18);

      await tokenSecond.mint(accounts[0], halfEther).should.be.fulfilled;
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[0]))
      await tokenSecond.transfer(foreignBridge.address, halfEther);
      '0'.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[0]))
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(foreignBridge.address))

      await foreignBridge.claimTokens(tokenSecond.address, accounts[3], {from: owner});
      '0'.should.be.bignumber.equal(await tokenSecond.balanceOf(foreignBridge.address))
      halfEther.should.be.bignumber.equal(await tokenSecond.balanceOf(accounts[3]))

    })
  })
})
