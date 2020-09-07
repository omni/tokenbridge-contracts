### How to run upgrade scripts

Install dependencies in root project and compile the contracts
```bash
cd ..
yarn install --frozen-lockfile
yarn build
```

Create `.env` file
```bash
cp .env.example .env
```

Complete the variables in `.env` file. The `ROLE` variable indicates if the validator will send the creation transaction on the multisig wallet or if it will send the confirmation.

Run the script. The following are available:
* `yarn run upgradeBridgeOnForeign`
