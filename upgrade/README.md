### How to run upgrade scripts

Install dependencies in root project and compile the contracts
```bash
cd ..
npm i
npm run compile
```

Install dependencies from `upgrade` folder
```bash
cd upgrade
npm i
```

Create `.env` file
```bash
cp .env.example .env
```

Complete the variables in `.env` file. The `ROLE` variable indicates if the validator will send the creation transaction on the multisig wallet or if it will send the confirmation.

Run the script. The following are available:
* `npm run mcdUpgrade:upgradeBridgeOnHome`
* `npm run mcdUpgrade:upgradeValidatorsOnForeign`
* `npm run mcdUpgrade:upgradeBridgeOnForeign`
* `npm run mcdUpgrade:migrateToMCD`
