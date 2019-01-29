## Gas Consumption `NATIVE-TO-ERC` Bridge Mode with Reward contract

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
HomeBridgeNativeToErc|deployment|4193535|4193535|4193535
EternalStorageProxy|upgradeTo|35871|30924|30913
FeeManagerNativeToErc|deployment|861773|861773|861773
HomeBridgeNativeToErc|rewardableInitialize|305520|305584|305563
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
Total| |8069397|8280148|8174821

##### Foreign
 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
ERC677BridgeToken|deployment|1463536|1464560|1464170
EternalStorageProxy|deployment|378510|378510|378510
RewardableValidators|deployment|1615790|1615790|1615790
EternalStorageProxy|upgradeTo|35871|30924|30913
RewardableValidators|initialize|202711|423292|318008
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
EternalStorageProxy|deployment|378510|378510|378510
ForeignBridgeNativeToErc|deployment|3534781|3534781|3534781
EternalStorageProxy|upgradeTo|35871|30924|30913
FeeManagerNativeToErc|deployment|861773|861773|861773
ForeignBridgeNativeToErc|rewardableInitialize|327843|327907|327896
ERC677BridgeToken|setBridgeContract|29432|44432|39432
ERC677BridgeToken|transferOwnership|30860|30924|30913
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
Total| |8956794|9183633|9072915

#### Usage

##### Validators

 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
To sign at the Home (each validator)|
HomeBridgeNativeToErc|submitSignature|159814|275587|220654
To relay signatures from the Home to the Foreign (one validator)|
ForeignBridgeNativeToErc|executeSignatures|193143|374488|288553
To sign and relay from the Foreign to the Home (each validator)|
HomeBridgeNativeToErc|executeAffirmation|67290|205460|108687

##### Users

 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
To request transfer from the Home to the Foreign|
HomeBridgeNativeToErc|fallback|46982|46982|46982
To request transfer from the Foreign to the Home|
ERC677BridgeToken|transferAndCall|58654|166206|92597  
