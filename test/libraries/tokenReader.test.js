const TokenReaderTest = artifacts.require('TokenReaderTest.sol')
require('../setup')

contract('TokenReader Library', () => {
  describe('test different possible tokens', () => {
    for (let i = 1; i <= 7; i++) {
      it(`should handle Token${i}`, async () => {
        const test = await TokenReaderTest.new()
        await test[`test${i}`]().should.be.fulfilled
      })
    }
  })
})
