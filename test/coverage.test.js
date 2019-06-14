after(async () => {
  if (process.env.SOLIDITY_COVERAGE === 'true') {
    console.log('Writing coverage report.')
    await global.coverageSubprovider.writeCoverageAsync()
  }
})
