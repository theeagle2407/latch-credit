// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
contract MockMUSD is ERC20 { constructor() ERC20("Mock MUSD","MUSD") {} function mint(address a,uint256 n) external {_mint(a,n);} }
contract MockVeBTC is ERC721 {
 struct LockedBalance {int128 amount;uint256 end;bool isPermanent;}
 mapping(uint256=>LockedBalance) public locked;
 mapping(uint256=>uint8) public escrowType;
 uint256[] private ids;
 constructor() ERC721("Mock veBTC","veBTC") {}
 function mint(address a,uint256 id,uint256 end,bool permanent,uint8 kind) external {_mint(a,id);ids.push(id);locked[id]=LockedBalance(1e17,end,permanent);escrowType[id]=kind;}
 function ownerToNFTokenIdList(address a,uint256 index) external view returns(uint256) {uint256 count;for(uint256 i;i<ids.length;i++){if(ownerOf(ids[i])==a){if(count==index)return ids[i];count++;}}return 0;}
}
