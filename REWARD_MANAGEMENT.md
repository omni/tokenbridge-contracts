# Reward Management

## NATIVE-TO-ERC
Configuration:
```
HOME_REWARDABLE=ONE_DIRECTION
FOREIGN_REWARDABLE=ONE_DIRECTION
```
### Home to Foreign transfer
Fees are calculated and distributed on Foreign network. Validators will receive ERC20 tokens.
![native-erc-hometoforeign](https://user-images.githubusercontent.com/4614574/51607402-4bda6180-1ef3-11e9-91e3-50fe5d35d296.png)

### Foreign to Home transfer
Fees are calculated and distributed on Home network. Validators will receive native coins.
![native-erc-foreigntohome](https://user-images.githubusercontent.com/4614574/51607428-5d236e00-1ef3-11e9-8083-3669899c7252.png)

## NATIVE-TO-ERC - Fees collected on Home network only
Configuration:
```
HOME_REWARDABLE=BOTH_DIRECTIONS
FOREIGN_REWARDABLE=false
```
### Home to Foreign transfer
Fees are calculated and distributed on Home network. Validators will receive native coins.
![native-erc-homefee-hometoforeign](https://user-images.githubusercontent.com/4614574/53118155-43456d00-352b-11e9-80db-53e31494e09b.png)

### Foreign to Home transfer
Fees are calculated and distributed on Home network. Validators will receive native coins.
![native-erc-homefee-foreigntohome](https://user-images.githubusercontent.com/4614574/53118176-4b9da800-352b-11e9-8118-123f30e37d61.png)

## ERC-TO-NATIVE
Configuration:
```
HOME_REWARDABLE=BOTH_DIRECTIONS
FOREIGN_REWARDABLE=false
```
### Foreign to Home transfer
Fees are calculated and distributed on Home network. Validators will receive native coins.
![erc-native-foreigntohome](https://user-images.githubusercontent.com/4614574/51607498-9065fd00-1ef3-11e9-8212-fc1ba16ae91a.png)

### Home to Foreign transfer
Fees are calculated and distributed on Home network. Validators will receive native coins.
![erc-native-hometoforeign](https://user-images.githubusercontent.com/4614574/51607508-96f47480-1ef3-11e9-93a1-0f1111793f2a.png)

## ERC-TO-ERC

### Foreign to Home transfer
Fees are calculated and distributed on Home network. Validators will receive ERC20 tokens.
![ERC-ERC-ForeignToHome (1)](https://user-images.githubusercontent.com/4614574/56502412-98c8d680-64e8-11e9-8eea-5bcd545d74d9.png)

### Home to Foreign transfer
Fees are calculated and distributed on Home network. Validators will receive ERC20 tokens.
![ERC-ERC-HomeToForeign (1)](https://user-images.githubusercontent.com/4614574/56502454-b8f89580-64e8-11e9-84ae-d9a1c229e0c4.png)
