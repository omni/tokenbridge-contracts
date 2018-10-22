const Web3Utils = require('web3-utils');
const HomeBridge = artifacts.require("HomeBridgeNativeToErc.sol");
const EternalStorageProxy = artifacts.require("EternalStorageProxy.sol");
const BridgeValidators = artifacts.require("BridgeValidators.sol");
const RevertFallback = artifacts.require("RevertFallback.sol");
const {ERROR_MSG, ZERO_ADDRESS} = require('../setup');
const {createMessage, sign, signatureToVRS} = require('../helpers/helpers');
const minPerTx = web3.toBigNumber(web3.toWei(0.01, "ether"));
const requireBlockConfirmations = 8;
const gasPrice = Web3Utils.toWei('1', 'gwei');
const oneEther = web3.toBigNumber(web3.toWei(1, "ether"));
const halfEther = web3.toBigNumber(web3.toWei(0.5, "ether"));

contract('HomeBridge', async (accounts) => {
  let homeContract, validatorContract, authorities, owner;
  before(async () => {
    validatorContract = await BridgeValidators.new()
    authorities = [accounts[1]];
    owner = accounts[0]
    await validatorContract.initialize(1, authorities, owner)
  })
  describe('#initialize', async() => {
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
    })
    it('sets variables', async () => {
      ZERO_ADDRESS.should.be.equal(await homeContract.validatorContract())
      '0'.should.be.bignumber.equal(await homeContract.deployedAtBlock())
      '0'.should.be.bignumber.equal(await homeContract.dailyLimit())
      '0'.should.be.bignumber.equal(await homeContract.maxPerTx())
      false.should.be.equal(await homeContract.isInitialized())
      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations).should.be.fulfilled;
      true.should.be.equal(await homeContract.isInitialized())
      validatorContract.address.should.be.equal(await homeContract.validatorContract());
      (await homeContract.deployedAtBlock()).should.be.bignumber.above(0);
      '3'.should.be.bignumber.equal(await homeContract.dailyLimit())
      '2'.should.be.bignumber.equal(await homeContract.maxPerTx())
      '1'.should.be.bignumber.equal(await homeContract.minPerTx())
      const bridgeMode = '0x92a8d7fe' // 4 bytes of keccak256('native-to-erc-core')
      const mode = await homeContract.getBridgeMode();
      mode.should.be.equal(bridgeMode)
      const [major, minor, patch] = await homeContract.getBridgeInterfacesVersion()
      major.should.be.bignumber.gte(0)
      minor.should.be.bignumber.gte(0)
      patch.should.be.bignumber.gte(0)
    })
    it('cant set maxPerTx > dailyLimit', async () => {
      false.should.be.equal(await homeContract.isInitialized())
      await homeContract.initialize(validatorContract.address, '1', '2', '1', gasPrice, requireBlockConfirmations).should.be.rejectedWith(ERROR_MSG);
      await homeContract.initialize(validatorContract.address, '3', '2', '2', gasPrice, requireBlockConfirmations).should.be.rejectedWith(ERROR_MSG);
      false.should.be.equal(await homeContract.isInitialized())
    })

    it('can be deployed via upgradeToAndCall', async () => {
      let storageProxy = await EternalStorageProxy.new().should.be.fulfilled;
      let data = homeContract.initialize.request(validatorContract.address, "3", "2", "1", gasPrice, requireBlockConfirmations).params[0].data
      await storageProxy.upgradeToAndCall('1', homeContract.address, data).should.be.fulfilled;
      let finalContract = await HomeBridge.at(storageProxy.address);
      true.should.be.equal(await finalContract.isInitialized());
      validatorContract.address.should.be.equal(await finalContract.validatorContract())
      "3".should.be.bignumber.equal(await finalContract.dailyLimit())
      "2".should.be.bignumber.equal(await finalContract.maxPerTx())
      "1".should.be.bignumber.equal(await finalContract.minPerTx())
    })
  })

  describe('#fallback', async () => {
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations)
    })
    it('should accept POA', async () => {
      const currentDay = await homeContract.getCurrentDay()
      '0'.should.be.bignumber.equal(await homeContract.totalSpentPerDay(currentDay))
      const {logs} = await homeContract.sendTransaction({
        from: accounts[1],
        value: 1
      }).should.be.fulfilled
      '1'.should.be.bignumber.equal(await homeContract.totalSpentPerDay(currentDay))
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 3
      }).should.be.rejectedWith(ERROR_MSG);
      logs[0].event.should.be.equal('UserRequestForSignature')
      logs[0].args.should.be.deep.equal({
        recipient: accounts[1],
        value: new web3.BigNumber(1)
      })
      await homeContract.setDailyLimit(4).should.be.fulfilled;
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 1
      }).should.be.fulfilled
      '2'.should.be.bignumber.equal(await homeContract.totalSpentPerDay(currentDay))
    })

    it('doesnt let you send more than max amount per tx', async () => {
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 1
      }).should.be.fulfilled
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 3
      }).should.be.rejectedWith(ERROR_MSG)
      await homeContract.setMaxPerTx(100).should.be.rejectedWith(ERROR_MSG);
      await homeContract.setDailyLimit(100).should.be.fulfilled;
      await homeContract.setMaxPerTx(99).should.be.fulfilled;
      //meets max per tx and daily limit
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 99
      }).should.be.fulfilled
      //above daily limit
      await homeContract.sendTransaction({
        from: accounts[1],
        value: 1
      }).should.be.rejectedWith(ERROR_MSG)

    })

    it('should not let to deposit less than minPerTx', async () => {
      const newDailyLimit = 100;
      const newMaxPerTx = 50;
      const newMinPerTx = 20;
      await homeContract.setDailyLimit(newDailyLimit).should.be.fulfilled;
      await homeContract.setMaxPerTx(newMaxPerTx).should.be.fulfilled;
      await homeContract.setMinPerTx(newMinPerTx).should.be.fulfilled;

      await homeContract.sendTransaction({
        from: accounts[1],
        value: newMinPerTx
      }).should.be.fulfilled
      await homeContract.sendTransaction({
        from: accounts[1],
        value: newMinPerTx - 1
      }).should.be.rejectedWith(ERROR_MSG)
    })
  })

  describe('#setting limits', async () => {
    let homeContract;
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
      await homeContract.initialize(validatorContract.address, '3', '2', '1', gasPrice, requireBlockConfirmations)
    })
    it('#setMaxPerTx allows to set only to owner and cannot be more than daily limit', async () => {
      await homeContract.setMaxPerTx(2, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG);
      await homeContract.setMaxPerTx(2, {from: owner}).should.be.fulfilled;

      await homeContract.setMaxPerTx(3, {from: owner}).should.be.rejectedWith(ERROR_MSG);
    })

    it('#setMinPerTx allows to set only to owner and cannot be more than daily limit and should be less than maxPerTx', async () => {
      await homeContract.setMinPerTx(1, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG);
      await homeContract.setMinPerTx(1, {from: owner}).should.be.fulfilled;

      await homeContract.setMinPerTx(2, {from: owner}).should.be.rejectedWith(ERROR_MSG);
    })
  })

  describe('#executeAffirmation', async () => {
    let homeBridge;
    beforeEach(async () => {
      homeBridge = await HomeBridge.new();
      await homeBridge.initialize(validatorContract.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations);
      const {logs} = await homeBridge.sendTransaction({
        from: accounts[2],
        value: halfEther
      }).should.be.fulfilled
    })
    it('should allow validator to executeAffirmation', async () => {
      const recipient = accounts[5];
      const value = halfEther;
      const balanceBefore = await web3.eth.getBalance(recipient)
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const {logs} = await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: authorities[0]})
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[0].args.should.be.deep.equal({
        signer: authorities[0],
        transactionHash
      });
      logs[1].event.should.be.equal("AffirmationCompleted");
      logs[1].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash
      })
      const homeBalanceAfter = await web3.eth.getBalance(homeBridge.address)
      const balanceAfter = await web3.eth.getBalance(recipient)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))
      homeBalanceAfter.should.be.bignumber.equal(0)

      const msgHash = Web3Utils.soliditySha3(recipient, value, transactionHash);
      const senderHash = Web3Utils.soliditySha3(authorities[0], msgHash)
      true.should.be.equal(await homeBridge.affirmationsSigned(senderHash))
    })

    it('test with 2 signatures required', async () => {
      let validatorContractWith2Signatures = await BridgeValidators.new()
      let authoritiesTwoAccs = [accounts[1], accounts[2], accounts[3]];
      let ownerOfValidators = accounts[0]
      await validatorContractWith2Signatures.initialize(2, authoritiesTwoAccs, ownerOfValidators)
      let homeBridgeWithTwoSigs = await HomeBridge.new();
      await homeBridgeWithTwoSigs.initialize(validatorContractWith2Signatures.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations);

      await homeBridgeWithTwoSigs.sendTransaction({
        from: accounts[2],
        value: halfEther
      }).should.be.fulfilled
      const homeBalanceBefore = await web3.eth.getBalance(homeBridgeWithTwoSigs.address)
      homeBalanceBefore.should.be.bignumber.equal(halfEther)

      const recipient = accounts[5];
      const value = halfEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const balanceBefore = await web3.eth.getBalance(recipient)
      const msgHash = Web3Utils.soliditySha3(recipient, value, transactionHash);

      const {logs} = await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {from: authoritiesTwoAccs[0]}).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[0].args.should.be.deep.equal({
        signer: authorities[0],
        transactionHash
      });
      halfEther.should.be.bignumber.equal(await web3.eth.getBalance(homeBridgeWithTwoSigs.address))
      const notProcessed = await homeBridgeWithTwoSigs.numAffirmationsSigned(msgHash);
      notProcessed.should.be.bignumber.equal(1);

      await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {from: authoritiesTwoAccs[0]}).should.be.rejectedWith(ERROR_MSG);
      const secondSignature = await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {from: authoritiesTwoAccs[1]}).should.be.fulfilled;

      const balanceAfter = await web3.eth.getBalance(recipient)
      balanceAfter.should.be.bignumber.equal(balanceBefore.add(value))
      '0'.should.be.bignumber.equal(await web3.eth.getBalance(homeBridgeWithTwoSigs.address))

      secondSignature.logs[1].event.should.be.equal("AffirmationCompleted");
      secondSignature.logs[1].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash
      })

      const senderHash = Web3Utils.soliditySha3(authoritiesTwoAccs[0], msgHash)
      true.should.be.equal(await homeBridgeWithTwoSigs.affirmationsSigned(senderHash))

      const senderHash2 = Web3Utils.soliditySha3(authoritiesTwoAccs[1], msgHash);
      true.should.be.equal(await homeBridgeWithTwoSigs.affirmationsSigned(senderHash2))

      const markedAsProcessed = await homeBridgeWithTwoSigs.numAffirmationsSigned(msgHash);
      const processed = new web3.BigNumber(2).pow(255).add(2);
      markedAsProcessed.should.be.bignumber.equal(processed)
    })
    it('should not allow to double submit', async () => {
      const recipient = accounts[5];
      const value = '1';
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: authorities[0]}).should.be.fulfilled;
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: authorities[0]}).should.be.rejectedWith(ERROR_MSG);
    })

    it('should not allow non-authorities to execute withdraw', async () => {
      const recipient = accounts[5];
      const value = oneEther;
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      await homeBridge.executeAffirmation(recipient, value, transactionHash, {from: accounts[7]}).should.be.rejectedWith(ERROR_MSG);
    })

    it('doesnt allow to withdraw if requiredSignatures has changed', async () => {
      let validatorContractWith2Signatures = await BridgeValidators.new()
      let authoritiesTwoAccs = [accounts[1], accounts[2], accounts[3]];
      let ownerOfValidators = accounts[0]
      await validatorContractWith2Signatures.initialize(2, authoritiesTwoAccs, ownerOfValidators)
      let homeBridgeWithTwoSigs = await HomeBridge.new();
      await homeBridgeWithTwoSigs.initialize(validatorContractWith2Signatures.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations);

      await homeBridgeWithTwoSigs.sendTransaction({
        from: accounts[2],
        value: halfEther
      }).should.be.fulfilled
      const homeBalanceBefore = await web3.eth.getBalance(homeBridgeWithTwoSigs.address)
      homeBalanceBefore.should.be.bignumber.equal(halfEther)

      const recipient = accounts[5];
      const value = halfEther.div(2);
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const balanceBefore = await web3.eth.getBalance(recipient)
      const msgHash = Web3Utils.soliditySha3(recipient, value, transactionHash);

      await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {from: authoritiesTwoAccs[0]}).should.be.fulfilled;
      await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {from: authoritiesTwoAccs[1]}).should.be.fulfilled;
      balanceBefore.add(value).should.be.bignumber.equal(await web3.eth.getBalance(recipient))
      await validatorContractWith2Signatures.setRequiredSignatures(3).should.be.fulfilled;
      await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {from: authoritiesTwoAccs[2]}).should.be.rejectedWith(ERROR_MSG);
      await validatorContractWith2Signatures.setRequiredSignatures(1).should.be.fulfilled;
      await homeBridgeWithTwoSigs.executeAffirmation(recipient, value, transactionHash, {from: authoritiesTwoAccs[2]}).should.be.rejectedWith(ERROR_MSG);
      balanceBefore.add(value).should.be.bignumber.equal(await web3.eth.getBalance(recipient))

    })

    it('force withdraw if the recepient has fallback to revert', async () => {
      const revertFallbackContract = await RevertFallback.new();
      await revertFallbackContract.receiveEth({from: accounts[0], value: halfEther})
      await web3.eth.getBalance(revertFallbackContract.address).should.be.bignumber.equal(halfEther)

      const transactionHash = "0x106335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";
      const {logs} = await homeBridge.executeAffirmation(revertFallbackContract.address, halfEther, transactionHash, {from: authorities[0]})
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[0].args.should.be.deep.equal({
        signer: authorities[0],
        transactionHash
      });
      logs[1].event.should.be.equal("AffirmationCompleted");
      logs[1].args.should.be.deep.equal({
        recipient: revertFallbackContract.address,
        value: halfEther,
        transactionHash
      })
      const homeBalanceAfter = await web3.eth.getBalance(homeBridge.address)
      const balanceAfter = await web3.eth.getBalance(revertFallbackContract.address)
      balanceAfter.should.be.bignumber.equal(halfEther.add(halfEther))
      homeBalanceAfter.should.be.bignumber.equal(0)

    })
    it('works with 5 validators and 3 required signatures', async () => {
      const recipient = accounts[8]
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      let ownerOfValidators = accounts[0]
      const validatorContractWith3Signatures = await BridgeValidators.new()
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)

      const homeBridgeWithThreeSigs = await HomeBridge.new();
      await homeBridgeWithThreeSigs.initialize(validatorContractWith3Signatures.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations);

      const value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      const transactionHash = "0x806335163828a8eda675cff9c84fa6e6c7cf06bb44cc6ec832e42fe789d01415";

      await homeBridgeWithThreeSigs.sendTransaction({
        from: recipient,
        value: halfEther
      }).should.be.fulfilled

      const {logs} = await homeBridgeWithThreeSigs.executeAffirmation(recipient, value, transactionHash, {from: authoritiesFiveAccs[0]}).should.be.fulfilled;
      logs[0].event.should.be.equal("SignedForAffirmation");
      logs[0].args.should.be.deep.equal({
        signer: authorities[0],
        transactionHash
      });

      await homeBridgeWithThreeSigs.executeAffirmation(recipient, value, transactionHash, {from: authoritiesFiveAccs[1]}).should.be.fulfilled;
      const thirdSignature = await homeBridgeWithThreeSigs.executeAffirmation(recipient, value, transactionHash, {from: authoritiesFiveAccs[2]}).should.be.fulfilled;

      thirdSignature.logs[1].event.should.be.equal("AffirmationCompleted");
      thirdSignature.logs[1].args.should.be.deep.equal({
        recipient,
        value,
        transactionHash
      })
    })
  })
  describe('#isAlreadyProcessed', async () => {
    it('returns ', async () => {
      homeBridge = await HomeBridge.new();
      const bn = new web3.BigNumber(2).pow(255);
      const processedNumbers = [bn.add(1).toString(10), bn.add(100).toString(10)];
      true.should.be.equal(await homeBridge.isAlreadyProcessed(processedNumbers[0]));
      true.should.be.equal(await homeBridge.isAlreadyProcessed(processedNumbers[1]));
      false.should.be.equal(await homeBridge.isAlreadyProcessed(10));
    })
  })

  describe('#submitSignature', async () => {
    let validatorContractWith2Signatures,authoritiesTwoAccs,ownerOfValidators,tokenPOA20,homeBridgeWithTwoSigs
    beforeEach(async () => {
      validatorContractWith2Signatures = await BridgeValidators.new()
      authoritiesTwoAccs = [accounts[1], accounts[2], accounts[3]];
      ownerOfValidators = accounts[0]
      await validatorContractWith2Signatures.initialize(2, authoritiesTwoAccs, ownerOfValidators)
      homeBridgeWithTwoSigs = await HomeBridge.new();
      await homeBridgeWithTwoSigs.initialize(validatorContractWith2Signatures.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations);
    })
    it('allows a validator to submit a signature', async () => {
      var recipientAccount = accounts[8]
      var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithTwoSigs.address);
      var signature = await sign(authoritiesTwoAccs[0], message)
      const {logs} = await homeBridgeWithTwoSigs.submitSignature(signature, message, {from: authorities[0]}).should.be.fulfilled;
      logs[0].event.should.be.equal('SignedForUserRequest')
      const msgHashFromLog = logs[0].args.messageHash
      const signatureFromContract = await homeBridgeWithTwoSigs.signature(msgHashFromLog, 0);
      const messageFromContract = await homeBridgeWithTwoSigs.message(msgHashFromLog);
      signature.should.be.equal(signatureFromContract);
      messageFromContract.should.be.equal(messageFromContract);
      const hashMsg = Web3Utils.soliditySha3(message);
      const hashSenderMsg = Web3Utils.soliditySha3(authorities[0], hashMsg)
      true.should.be.equal(await homeBridgeWithTwoSigs.messagesSigned(hashSenderMsg));
    })
    it('when enough requiredSignatures are collected, CollectedSignatures event is emitted', async () => {
      var recipientAccount = accounts[8]
      var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      var homeGasPrice = web3.toBigNumber(0);
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(recipientAccount, value, transactionHash,  homeBridgeWithTwoSigs.address);
      var signature = await sign(authoritiesTwoAccs[0], message)
      var signature2 = await sign(authoritiesTwoAccs[1], message)
      '2'.should.be.bignumber.equal(await validatorContractWith2Signatures.requiredSignatures());
      await homeBridgeWithTwoSigs.submitSignature(signature, message, {from: authoritiesTwoAccs[0]}).should.be.fulfilled;
      await homeBridgeWithTwoSigs.submitSignature(signature, message, {from: authoritiesTwoAccs[0]}).should.be.rejectedWith(ERROR_MSG);
      await homeBridgeWithTwoSigs.submitSignature(signature, message, {from: authoritiesTwoAccs[1]}).should.be.rejectedWith(ERROR_MSG);
      const {logs} = await homeBridgeWithTwoSigs.submitSignature(signature2, message, {from: authoritiesTwoAccs[1]}).should.be.fulfilled;
      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesTwoAccs[1])
    })
    it('works with 5 validators and 3 required signatures', async () => {
      const recipientAccount = accounts[8]
      const authoritiesFiveAccs = [accounts[1], accounts[2], accounts[3], accounts[4], accounts[5]]
      const validatorContractWith3Signatures = await BridgeValidators.new()
      await validatorContractWith3Signatures.initialize(3, authoritiesFiveAccs, ownerOfValidators)

      const homeBridgeWithThreeSigs = await HomeBridge.new();
      await homeBridgeWithThreeSigs.initialize(validatorContractWith3Signatures.address, oneEther, halfEther, minPerTx, gasPrice, requireBlockConfirmations);

      const value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      const transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      const message = createMessage(recipientAccount, value, transactionHash, homeBridgeWithThreeSigs.address);
      const signature = await sign(authoritiesFiveAccs[0], message)
      const signature2 = await sign(authoritiesFiveAccs[1], message)
      const signature3 = await sign(authoritiesFiveAccs[2], message)
      '3'.should.be.bignumber.equal(await validatorContractWith3Signatures.requiredSignatures());

      await homeBridgeWithThreeSigs.submitSignature(signature, message, {from: authoritiesFiveAccs[0]}).should.be.fulfilled;
      await homeBridgeWithThreeSigs.submitSignature(signature2, message, {from: authoritiesFiveAccs[1]}).should.be.fulfilled;
      const {logs} = await homeBridgeWithThreeSigs.submitSignature(signature3, message, {from: authoritiesFiveAccs[2]}).should.be.fulfilled;
      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesFiveAccs[2])
    })
    it('attack when increasing requiredSignatures', async () => {
      var recipientAccount = accounts[8]
      var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      var homeGasPrice = web3.toBigNumber(0);
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(recipientAccount, value, transactionHash,  homeBridgeWithTwoSigs.address);
      var signature = await sign(authoritiesTwoAccs[0], message)
      var signature2 = await sign(authoritiesTwoAccs[1], message)
      var signature3 = await sign(authoritiesTwoAccs[2], message)
      '2'.should.be.bignumber.equal(await validatorContractWith2Signatures.requiredSignatures());
      await homeBridgeWithTwoSigs.submitSignature(signature, message, {from: authoritiesTwoAccs[0]}).should.be.fulfilled;
      await homeBridgeWithTwoSigs.submitSignature(signature, message, {from: authoritiesTwoAccs[0]}).should.be.rejectedWith(ERROR_MSG);
      await homeBridgeWithTwoSigs.submitSignature(signature, message, {from: authoritiesTwoAccs[1]}).should.be.rejectedWith(ERROR_MSG);
      const {logs} = await homeBridgeWithTwoSigs.submitSignature(signature2, message, {from: authoritiesTwoAccs[1]}).should.be.fulfilled;
      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesTwoAccs[1])
      await validatorContractWith2Signatures.setRequiredSignatures(3).should.be.fulfilled;
      '3'.should.be.bignumber.equal(await validatorContractWith2Signatures.requiredSignatures());
      const attackerTx = await homeBridgeWithTwoSigs.submitSignature(signature3, message, {from: authoritiesTwoAccs[2]}).should.be.rejectedWith(ERROR_MSG);
    })
    it('attack when decreasing requiredSignatures', async () => {
      var recipientAccount = accounts[8]
      var value = web3.toBigNumber(web3.toWei(0.5, "ether"));
      var homeGasPrice = web3.toBigNumber(0);
      var transactionHash = "0x1045bfe274b88120a6b1e5d01b5ec00ab5d01098346e90e7c7a3c9b8f0181c80";
      var message = createMessage(recipientAccount, value, transactionHash,  homeBridgeWithTwoSigs.address);
      var signature = await sign(authoritiesTwoAccs[0], message)
      var signature2 = await sign(authoritiesTwoAccs[1], message)
      var signature3 = await sign(authoritiesTwoAccs[2], message)
      '2'.should.be.bignumber.equal(await validatorContractWith2Signatures.requiredSignatures());
      await homeBridgeWithTwoSigs.submitSignature(signature, message, {from: authoritiesTwoAccs[0]}).should.be.fulfilled;
      await validatorContractWith2Signatures.setRequiredSignatures(1).should.be.fulfilled;
      '1'.should.be.bignumber.equal(await validatorContractWith2Signatures.requiredSignatures());
      const {logs} = await homeBridgeWithTwoSigs.submitSignature(signature2, message, {from: authoritiesTwoAccs[1]}).should.be.fulfilled;
      logs.length.should.be.equal(2)
      logs[1].event.should.be.equal('CollectedSignatures')
      logs[1].args.authorityResponsibleForRelay.should.be.equal(authoritiesTwoAccs[1])
    })
  })

  describe('#requiredMessageLength', async () => {
    beforeEach(async () => {
      homeContract = await HomeBridge.new()
    })

    it('should return the required message length', async () => {
      const requiredMessageLength = await homeContract.requiredMessageLength()
      '104'.should.be.bignumber.equal(requiredMessageLength)
    })
  })
})
