const HomeAMBErc677ToErc677 = artifacts.require('HomeAMBErc677ToErc677.sol')
const ForeignAMBErc677ToErc677 = artifacts.require('ForeignAMBErc677ToErc677.sol')
const { shouldBehaveLikeBasicAMBErc677ToErc677 } = require('./AMBErc677ToErc677Behavior.test')

contract('HomeAMBErc677ToErc677', async accounts => {
  beforeEach(async function() {
    this.bridge = await HomeAMBErc677ToErc677.new()
  })
  shouldBehaveLikeBasicAMBErc677ToErc677(ForeignAMBErc677ToErc677, accounts)
})