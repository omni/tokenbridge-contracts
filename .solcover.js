const { spawn } = require('child_process');

const accounts = process.env.ACCOUNTS
  .trim()
  .split(/\s*(?:--account=)/)
  .slice(1)
  .map((pair) => {
    const [secretKey, balance] = pair.split(',')
    return {secretKey, balance}
  })

async function deployCompound() {
  return new Promise((resolve) => {
    const deploy = spawn('docker-compose', [
      '-f', 'test/docker-compose.yml',
      '--env-file', 'test/.env',
      'up', 'compound'
    ]);

    deploy.stdout.on('data', data => {
      console.log(`${data}`);
    });
    
    deploy.on('close', code => {
      resolve(code)
    });
  })
}

module.exports = {
  skipFiles: [
    'Migrations.sol',
    'mocks',
    'interfaces',
    'helpers'
  ],
  providerOptions: {
    _chainId: 1337,
    network_id: 1337,
    allowUnlimitedContractSize: true,
    accounts
  },
  onServerReady: deployCompound,
  istanbulReporter: ['lcov']
}