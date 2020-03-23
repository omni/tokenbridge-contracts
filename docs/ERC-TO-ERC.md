## Gas Consumption `ERC-TO-ERC` Bridge Mode

#### Deployment
##### Home
 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
EternalStorageProxy|deployment|378510|378510|378510
BridgeValidators|deployment|1144207|1144207|1144207
EternalStorageProxy|upgradeTo|35871|30924|30913
BridgeValidators|initialize|187738|280847|253949
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
EternalStorageProxy|deployment|378510|378510|378510
HomeBridgeErcToErc|deployment|3528509|3528509|3528509
EternalStorageProxy|upgradeTo|35871|30924|30913
ERC677BridgeToken|deployment|1498202|1499226|1498829
ERC677BridgeToken|setBridgeContract|29432|44432|39432
ERC677BridgeToken|transferOwnership|30860|30924|30913
HomeBridgeErcToErc|initialize|212299|213195|213003
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
Total| |7521315|7621514|7588994

##### Foreign
 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
EternalStorageProxy|deployment|378510|378510|378510
BridgeValidators|deployment|1144207|1144207|1144207
EternalStorageProxy|upgradeTo|35871|30924|30913
BridgeValidators|initialize|187738|280847|253949
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
EternalStorageProxy|deployment|378510|378510|378510
ForeignBridgeErcToErc|deployment|2449436|2449436|2449436
EternalStorageProxy|upgradeTo|35871|30924|30913
ForeignBridgeErcToErc|initialize|150614|150614|150614
EternalStorageProxy|transferProxyOwnership|30653|30653|30653
Total| |4822063|4905278|4878358

#### Usage

##### Validators

 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
To sign at the Home (each validator)|
HomeBridgeErcToErc|submitSignature|159386|275159|220171
To relay signatures from the Home to the Foreign (one validator)|
ForeignBridgeErcToErc|executeSignatures|73779|115769|93027
To sign and relay from the Foreign to the Home (each validator)|
HomeBridgeErcToErc|executeAffirmation|79336|134607|108215

##### Users

 Contract | Method | Min | Max | Avg
----  | ---- | ---- | ---- | ----
To request transfer from the Home to the Foreign|
ERC677BridgeToken|transferAndCall|58370|166206|92399
To request transfer from the Foreign to the Home|
ERC677BridgeToken|transfer|37691|86589|55000  

