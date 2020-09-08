after(async () => {
  if (process.env.SOLIDITY_COVERAGE === 'true') {
    await global.coverageSubprovider.writeCoverageAsync()
  }
})
