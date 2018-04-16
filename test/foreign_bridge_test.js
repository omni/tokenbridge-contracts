const ForeignBridge = artifacts.require("ForeignBridge.sol");
const ForeignBridgeV2 = artifacts.require("ForeignBridgeV2.sol");
const BridgeValidators = artifacts.require("BridgeValidators.sol");
const EternalStorageProxy = artifacts.require("EternalStorageProxy.sol");

const POA20 = artifacts.require("POA20.sol");
const {ERROR_MSG, ZERO_ADDRESS} = require('./setup');
const {createMessage, sign, signatureToVRS} = require('./helpers/helpers');
const oneEther = web3.toBigNumber(web3.toWei(1, "ether"));
const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"));
const minPerTx = web3.toBigNumber(web3.toWei(0.01, "ether"));

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
      '0'.should.be.bignumber.equal(await foreignBridge.foreignDailyLimit())
      '0'.should.be.bignumber.equal(await foreignBridge.maxPerTx())
      false.should.be.equal(await foreignBridge.isInitialized())
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx);

      true.should.be.equal(await foreignBridge.isInitialized())
      validatorContract.address.should.be.equal(await foreignBridge.validatorContract());
      (await foreignBridge.deployedAtBlock()).should.be.bignumber.above(0);
      oneEther.should.be.bignumber.equal(await foreignBridge.foreignDailyLimit())
      halfEther.should.be.bignumber.equal(await foreignBridge.maxPerTx())
      minPerTx.should.be.bignumber.equal(await foreignBridge.minPerTx())
    })
  })

  describe('#deposit', async () => {
    let foreignBridge;
    beforeEach(async () => {
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18);
      foreignBridge = await ForeignBridge.new();
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx);
      await token.transferOwnership(foreignBridge.address)
    })
    it('should allow validator to deposit', async () => {
      const recipient = accounts[5];
      const value = oneEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const {logs} = await foreignBridge.deposit(recipient, value, transactionHash, {from: authorities[0]})
      logs[0].event.should.be.equal("SignedForDeposit");
      logs[0].args.should.be.deep.equal({
        signer: authorities[0],
        transactionHash
      });
      logs[1].event.should.be.equal("Deposit");
      logs[1].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash
      })
      oneEther.should.be.bignumber.equal(await token.totalSupply());
      oneEther.should.be.bignumber.equal(await token.balanceOf(recipient));
    })
    it('test with 2 signatures required', async () => {
      let validatorContractWith2Signatures = await BridgeValidators.new()
      let authoritiesTwoAccs = [accounts[1], accounts[2], accounts[3]];
      let ownerOfValidators = accounts[0]
      await validatorContractWith2Signatures.initialize(2, authoritiesTwoAccs, ownerOfValidators)
      let tokenPOA20 = await POA20.new("POA ERC20 Foundation", "POA20", 18);
      let foreignBridgeWithTwoSigs = await ForeignBridge.new();
      await foreignBridgeWithTwoSigs.initialize(validatorContractWith2Signatures.address, tokenPOA20.address, oneEther, halfEther, minPerTx);
      await tokenPOA20.transferOwnership(foreignBridgeWithTwoSigs.address)

      const recipient = accounts[5];
      const value = oneEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const {logs} = await foreignBridgeWithTwoSigs.deposit(recipient, value, transactionHash, {from: authoritiesTwoAccs[0]}).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForDeposit");
      logs[0].args.should.be.deep.equal({
        signer: authorities[0],
        transactionHash
      });
      '0'.should.be.bignumber.equal(await tokenPOA20.totalSupply());
      '0'.should.be.bignumber.equal(await tokenPOA20.balanceOf(recipient));
      const secondDeposit = await foreignBridgeWithTwoSigs.deposit(recipient, value, transactionHash, {from: authoritiesTwoAccs[1]}).should.be.fulfilled;
      oneEther.should.be.bignumber.equal(await tokenPOA20.totalSupply());
      oneEther.should.be.bignumber.equal(await tokenPOA20.balanceOf(recipient));
      secondDeposit.logs[1].event.should.be.equal("Deposit");
      secondDeposit.logs[1].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash
      })
      const thirdDeposit = await foreignBridgeWithTwoSigs.deposit(recipient, value, transactionHash, {from: authoritiesTwoAccs[2]}).should.be.fulfilled;
      oneEther.should.be.bignumber.equal(await tokenPOA20.totalSupply());
      oneEther.should.be.bignumber.equal(await tokenPOA20.balanceOf(recipient));
    })
    it('should not allow to double submit', async () => {
      const recipient = accounts[5];
      const value = oneEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      await foreignBridge.deposit(recipient, value, transactionHash, {from: authorities[0]}).should.be.fulfilled;
      await foreignBridge.deposit(recipient, value, transactionHash, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG);

    })
    it('should not allow non-authorities to execute deposit', async () => {
      const recipient = accounts[5];
      const value = oneEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      await foreignBridge.deposit(recipient, value, transactionHash, {from: accounts[7]}).should.be.rejectedWith(ERROR_MSG);
    })
  })

  describe('#onTokenTransfer', async () => {
    it('can only be called from token contract', async ()=> {
      const owner = accounts[3]
      const user = accounts[4]
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18, {from: owner});
      foreignBridge = await ForeignBridge.new();
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx);
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
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx);
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
        value: halfEther,
        homeGasPrice: web3.toBigNumber(web3.toWei(1, "gwei"))
      })
    })
    it('should only let to send within maxPerTx limit', async () => {
      const owner = accounts[3]
      const user = accounts[4]
      const valueMoreThanLimit = halfEther.add(1);
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18, {from: owner});
      foreignBridge = await ForeignBridge.new();
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx);
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
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx);
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

  describe('#submitSignature', async () => {
    let validatorContractWith2Signatures,authoritiesTwoAccs,ownerOfValidators,tokenPOA20,foreignBridgeWithTwoSigs
    beforeEach(async () => {
      validatorContractWith2Signatures = await BridgeValidators.new()
      authoritiesTwoAccs = [accounts[1], accounts[2], accounts[3]];
      ownerOfValidators = accounts[0]
      await validatorContractWith2Signatures.initialize(2, authoritiesTwoAccs, ownerOfValidators)
      tokenPOA20 = await POA20.new("POA ERC20 Foundation", "POA20", 18);
      foreignBridgeWithTwoSigs = await ForeignBridge.new();
      await foreignBridgeWithTwoSigs.initialize(validatorContractWith2Signatures.address, tokenPOA20.address, oneEther, halfEther, minPerTx);
      await tokenPOA20.transferOwnership(foreignBridgeWithTwoSigs.address)

    })
    it('allows a validator to submit a signature', async () => {
      var recipientAccount = accounts[8]
      var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      var homeGasPrice = web3.toBigNumber(0);
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(recipientAccount, value, transactionHash, homeGasPrice);
      var signature = await sign(authoritiesTwoAccs[0], message)
      const {logs} = await foreignBridgeWithTwoSigs.submitSignature(signature, message, {from: authorities[0]}).should.be.fulfilled;
      logs[0].event.should.be.equal('SignedForWithdraw')
      const msgHashFromLog = logs[0].args.messageHash
      const signatureFromContract = await foreignBridgeWithTwoSigs.signature(msgHashFromLog, 0);
      const messageFromContract = await foreignBridgeWithTwoSigs.message(msgHashFromLog);
      signature.should.be.equal(signatureFromContract);
      messageFromContract.should.be.equal(messageFromContract);

    })
    it('when enough requiredSignatures are collected, CollectedSignatures event is emitted', async () => {
      var recipientAccount = accounts[8]
      var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      var homeGasPrice = web3.toBigNumber(0);
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(recipientAccount, value, transactionHash, homeGasPrice);
      var signature = await sign(authoritiesTwoAccs[0], message)
      var signature2 = await sign(authoritiesTwoAccs[1], message)
      '2'.should.be.bignumber.equal(await validatorContractWith2Signatures.requiredSignatures());
      await foreignBridgeWithTwoSigs.submitSignature(signature, message, {from: authorities[0]}).should.be.fulfilled;
      await foreignBridgeWithTwoSigs.submitSignature(signature, message, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG);
      await foreignBridgeWithTwoSigs.submitSignature(signature, message, {from: authorities[1]}).should.be.rejectedWith(ERROR_MSG);
      const {logs} = await foreignBridgeWithTwoSigs.submitSignature(signature2, message, {from: authorities[1]}).should.be.fulfilled;
      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authorities[1])
    })
  })

  describe('#setting limits', async () => {
    let foreignBridge;
    beforeEach(async () => {
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18);
      foreignBridge = await ForeignBridge.new();
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther, halfEther, minPerTx);
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
    it.only('can be upgraded', async () => {
      const REQUIRED_NUMBER_OF_VALIDATORS = 1
      const VALIDATORS = [accounts[1]]
      const PROXY_OWNER  = accounts[0]
      const FOREIGN_DAILY_LIMIT = oneEther;
      const FOREIGN_MAX_AMOUNT_PER_TX = halfEther;
      const FOREIGN_MIN_AMOUNT_PER_TX = minPerTx;
      // Validators Contract
      let validatorsProxy = await EternalStorageProxy.new().should.be.fulfilled;
      const validatorsContractImpl = await BridgeValidators.new().should.be.fulfilled;
      await validatorsProxy.upgradeTo('0', validatorsContractImpl.address).should.be.fulfilled;
      validatorsContractImpl.address.should.be.equal(await validatorsProxy.implementation())

      validatorsProxy = await BridgeValidators.at(validatorsProxy.address);
      await validatorsProxy.initialize(REQUIRED_NUMBER_OF_VALIDATORS, VALIDATORS, PROXY_OWNER).should.be.fulfilled;
      // POA20
      let token = await POA20.new("POA ERC20 Foundation", "POA20", 18);

      // ForeignBridge V1 Contract

      let foreignBridgeProxy = await EternalStorageProxy.new().should.be.fulfilled;
      const foreignBridgeImpl = await ForeignBridge.new().should.be.fulfilled;
      await foreignBridgeProxy.upgradeTo('0', foreignBridgeImpl.address).should.be.fulfilled;

      foreignBridgeProxy = await ForeignBridge.at(foreignBridgeProxy.address);
      await foreignBridgeProxy.initialize(validatorsProxy.address, token.address, FOREIGN_DAILY_LIMIT, FOREIGN_MAX_AMOUNT_PER_TX, FOREIGN_MIN_AMOUNT_PER_TX)
      await token.transferOwnership(foreignBridgeProxy.address).should.be.fulfilled;

      foreignBridgeProxy.address.should.be.equal(await token.owner());

      // Deploy V2
      let foreignImplV2 = await ForeignBridgeV2.new();
      let foreignBridgeProxyUpgrade = await EternalStorageProxy.at(foreignBridgeProxy.address);
      await foreignBridgeProxyUpgrade.upgradeTo('1', foreignImplV2.address).should.be.fulfilled;
      foreignImplV2.address.should.be.equal(await foreignBridgeProxyUpgrade.implementation())

      let foreignBridgeV2Proxy = await ForeignBridgeV2.at(foreignBridgeProxy.address)
      await foreignBridgeV2Proxy.changeTokenOwnership(accounts[2], {from: accounts[4]}).should.be.rejectedWith(ERROR_MSG)
      await foreignBridgeV2Proxy.changeTokenOwnership(accounts[2], {from: PROXY_OWNER}).should.be.fulfilled;
      await token.transferOwnership(foreignBridgeProxy.address, {from: accounts[2]}).should.be.fulfilled;
    })
  })
})
