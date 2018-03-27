const ForeignBridge = artifacts.require("ForeignBridge.sol");
const BridgeValidators = artifacts.require("BridgeValidators.sol");
const POA20 = artifacts.require("POA20.sol");
const {ERROR_MSG, ZERO_ADDRESS} = require('./setup');
const {createMessage, sign, signatureToVRS} = require('./helpers/helpers');
const oneEther = web3.toBigNumber(web3.toWei(1, "ether"));

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
      false.should.be.equal(await foreignBridge.isInitialized())
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther);

      true.should.be.equal(await foreignBridge.isInitialized())
      validatorContract.address.should.be.equal(await foreignBridge.validatorContract());
      (await foreignBridge.deployedAtBlock()).should.be.bignumber.above(0);
      oneEther.should.be.bignumber.equal(await foreignBridge.foreignDailyLimit())
    })
  })

  describe('#deposit', async () => {
    let foreignBridge;
    beforeEach(async () => {
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18);
      foreignBridge = await ForeignBridge.new();
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther);
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
      await foreignBridgeWithTwoSigs.initialize(validatorContractWith2Signatures.address, tokenPOA20.address, oneEther);
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
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther);
      await token.mint(user, oneEther, {from: owner }).should.be.fulfilled;
      await token.transferOwnership(foreignBridge.address, {from: owner});
      await foreignBridge.onTokenTransfer(user, oneEther, '0x00', {from: owner}).should.be.rejectedWith(ERROR_MSG);
      await token.transferAndCall(foreignBridge.address, oneEther, '0x00', {from: user}).should.be.fulfilled;
      '0'.should.be.bignumber.equal(await token.totalSupply());
      '0'.should.be.bignumber.equal(await token.balanceOf(user));
    })
    it('should not allow to burn more than the limit', async () => {
      const owner = accounts[3]
      const user = accounts[4]
      const valueMoreThanLimit = oneEther.add(1);
      token = await POA20.new("POA ERC20 Foundation", "POA20", 18, {from: owner});
      foreignBridge = await ForeignBridge.new();
      await foreignBridge.initialize(validatorContract.address, token.address, oneEther);
      await token.mint(user, valueMoreThanLimit, {from: owner }).should.be.fulfilled;
      await token.transferOwnership(foreignBridge.address, {from: owner});
      await token.transferAndCall(foreignBridge.address, valueMoreThanLimit, '0x00', {from: user}).should.be.rejectedWith(ERROR_MSG);
      valueMoreThanLimit.should.be.bignumber.equal(await token.totalSupply());
      valueMoreThanLimit.should.be.bignumber.equal(await token.balanceOf(user));
      const {logs} = await token.transferAndCall(foreignBridge.address, oneEther, '0x00', {from: user}).should.be.fulfilled;
      '1'.should.be.bignumber.equal(await token.totalSupply());
      '1'.should.be.bignumber.equal(await token.balanceOf(user));
      const events = await getEvents(foreignBridge, {event: 'Withdraw'});
      events[0].args.should.be.deep.equal({
        recipient: user,
        value: oneEther,
        homeGasPrice: web3.toBigNumber(web3.toWei(1, "gwei"))
      })
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
      await foreignBridgeWithTwoSigs.initialize(validatorContractWith2Signatures.address, tokenPOA20.address, oneEther);
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
})
