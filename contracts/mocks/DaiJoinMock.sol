/// join.sol -- Basic token adapters

// Copyright (C) 2018 Rain <rainbreak@riseup.net>
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

pragma solidity 0.4.24;

contract DSTokenLike {
    function mint(address,uint) external;
    function burn(address,uint) external;
}

contract VatLike {
    function slip(bytes32,address,int) external;
    function move(address,address,uint) external;
}

contract DaiJoin {
    // --- Auth ---
    mapping (address => uint) public wards;
    function rely(address usr) external auth { wards[usr] = 1; }
    function deny(address usr) external auth { wards[usr] = 0; }
    modifier auth {
        require(wards[msg.sender] == 1, "DaiJoin/not-authorized");
        _;
    }

    VatLike public vat;
    DSTokenLike public dai;
    uint    public live;  // Access Flag

    constructor(address vat_, address dai_) public {
        wards[msg.sender] = 1;
        live = 1;
        vat = VatLike(vat_);
        dai = DSTokenLike(dai_);
    }
    function cage() external auth {
        live = 0;
    }
    uint constant ONE = 10 ** 27;
    function mul(uint x, uint y) internal pure returns (uint z) {
        require(y == 0 || (z = x * y) / y == x);
    }
    function join(address usr, uint wad) external {
        vat.move(address(this), usr, mul(ONE, wad));
        dai.burn(msg.sender, wad);
    }
    function exit(address usr, uint wad) external {
        require(live == 1, "DaiJoin/not-live");
        vat.move(msg.sender, address(this), mul(ONE, wad));
        dai.mint(usr, wad);
    }
}