## Gas Consumption `ERC-TO-NATIVE` Bridge Mode with Reward contract

#### Deployment
##### Home
 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
EternalStorageProxy|deployment|378510|378510|378510
RewardableValidators|deployment|1615790|1615790|1615790
EternalStorageProxy|upgradeTo|35871|30924|30913
RewardableValidators|initialize|202711|423292|318008
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
EternalStorageProxy|deployment|378510|378510|378510
HomeBridgeErcToNative|deployment|5644337|5644337|5644337
EternalStorageProxy|upgradeTo|35871|30924|30913
FeeManagerErcToNative|deployment|1068197|1068197|1068197
HomeBridgeErcToNative|rewardableInitialize|353084|353148|353132
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
Total| |9774187|9984938|9879616

##### Foreign
 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
EternalStorageProxy|deployment|378510|378510|378510
BridgeValidators|deployment|1351491|1351491|1351491
EternalStorageProxy|upgradeTo|35871|30924|30913
BridgeValidators|initialize|210762|306607|270900
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
EternalStorageProxy|deployment|378510|378510|378510
ForeignBridgeErcToNative|deployment|2863900|2863900|2863900
EternalStorageProxy|upgradeTo|35871|30924|30913
ForeignBridgeErcToNative|initialize|239130|239130|239130
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
Total| |5555351|5641302|5605573

#### Usage

##### Validators

 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
To sign at the Home (each validator)|
HomeBridgeErcToNative|submitSignature|159926|307729|219658
To relay signatures from the Home to the Foreign (one validator)|
ForeignBridgeErcToNative|executeSignatures|83142|140737|114527
To sign and relay from the Foreign to the Home (each validator)|
HomeBridgeErcToNative|executeAffirmation|67422|318558|142697

##### Users

 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
To request transfer from the Home to the Foreign|
HomeBridgeErcToNative|fallback|83622|83622|83622
To request transfer from the Foreign to the Home|
ERC677BridgeToken|transfer|37691|86589|55000

