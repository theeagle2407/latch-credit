// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IVeBTC is IERC721 {
    struct LockedBalance { int128 amount; uint256 end; bool isPermanent; }
    function locked(uint256 id) external view returns (LockedBalance memory);
    function escrowType(uint256 id) external view returns (uint8);
}

/// @notice Experimental fixed-term, lender-funded credit. No oracle or liquidation engine.
/// @dev No admin, upgrades, arbitrary calls, voting delegation, or collateral withdrawal.
contract LatchCredit is IERC721Receiver, ReentrancyGuard {
    using SafeERC20 for IERC20;
    enum State { None, Requested, Active, Repaid, Cancelled, Defaulted }
    struct Loan {
        address borrower; address lender; uint256 tokenId;
        uint256 principal; uint256 interest; uint256 duration;
        uint256 expiresAt; uint256 dueAt; State state;
    }
    IERC20 public immutable musd;
    IVeBTC public immutable veBTC;
    uint256 public constant GRACE_PERIOD = 1 days;
    uint256 public nextId = 1;
    mapping(uint256 => Loan) public loans;
    mapping(uint256 => uint256) public positionLoan;
    mapping(uint256 => address) public collateralClaimant;
    mapping(address => uint256) public repaymentBalance;
    bool private receiving;
    address private expectedFrom;
    uint256 private expectedToken;
    event Requested(uint256 indexed id, address indexed borrower, uint256 indexed tokenId, uint256 principal, uint256 interest, uint256 duration, uint256 expiresAt);
    event Funded(uint256 indexed id, address indexed lender, uint256 dueAt);
    event Repaid(uint256 indexed id, uint256 amount);
    event Cancelled(uint256 indexed id);
    event Defaulted(uint256 indexed id);
    event CollateralClaimed(uint256 indexed id, address indexed recipient);
    event RepaymentWithdrawn(address indexed lender, address indexed recipient, uint256 amount);
    error InvalidTerms(); error IneligiblePosition(); error Unauthorized(); error InvalidState(); error Deadline(); error UnexpectedNFT();

    constructor(address token, address nft) {
        if(token.code.length==0 || nft.code.length==0) revert InvalidTerms();
        musd=IERC20(token); veBTC=IVeBTC(nft);
    }
    function request(uint256 tokenId,uint256 principal,uint256 interest,uint256 duration,uint256 expiresAt) external nonReentrant returns(uint256 id) {
        if(principal==0 || interest>principal || duration<1 days || duration>90 days || expiresAt<=block.timestamp || expiresAt>block.timestamp+7 days) revert InvalidTerms();
        if(veBTC.ownerOf(tokenId)!=msg.sender) revert Unauthorized();
        if(positionLoan[tokenId]!=0) revert IneligiblePosition();
        _eligible(tokenId,expiresAt+duration+GRACE_PERIOD);
        id=nextId++;
        loans[id]=Loan(msg.sender,address(0),tokenId,principal,interest,duration,expiresAt,0,State.Requested);
        positionLoan[tokenId]=id;
        receiving=true; expectedFrom=msg.sender; expectedToken=tokenId;
        veBTC.safeTransferFrom(msg.sender,address(this),tokenId);
        receiving=false;
        if(veBTC.ownerOf(tokenId)!=address(this)) revert UnexpectedNFT();
        emit Requested(id,msg.sender,tokenId,principal,interest,duration,expiresAt);
    }
    function fund(uint256 id) external nonReentrant {
        Loan storage l=loans[id];
        if(l.state!=State.Requested) revert InvalidState();
        if(block.timestamp>=l.expiresAt) revert Deadline();
        if(msg.sender==l.borrower) revert Unauthorized();
        _eligible(l.tokenId,block.timestamp+l.duration+GRACE_PERIOD);
        l.lender=msg.sender; l.dueAt=block.timestamp+l.duration; l.state=State.Active;
        musd.safeTransferFrom(msg.sender,l.borrower,l.principal);
        emit Funded(id,msg.sender,l.dueAt);
    }
    function cancel(uint256 id) external nonReentrant {
        Loan storage l=loans[id];
        if(l.state!=State.Requested) revert InvalidState();
        // Anyone may expire a request, but the NFT claim always belongs to its borrower.
        if(msg.sender!=l.borrower && block.timestamp<l.expiresAt) revert Unauthorized();
        l.state=State.Cancelled; collateralClaimant[id]=l.borrower;
        emit Cancelled(id);
    }
    function repay(uint256 id) external nonReentrant {
        Loan storage l=loans[id];
        if(l.state!=State.Active) revert InvalidState();
        if(msg.sender!=l.borrower) revert Unauthorized();
        if(block.timestamp>l.dueAt+GRACE_PERIOD) revert Deadline();
        uint256 amount=l.principal+l.interest;
        l.state=State.Repaid; collateralClaimant[id]=l.borrower;
        repaymentBalance[l.lender]+=amount;
        musd.safeTransferFrom(msg.sender,address(this),amount);
        emit Repaid(id,amount);
    }
    function claimDefault(uint256 id) external nonReentrant {
        Loan storage l=loans[id];
        if(l.state!=State.Active) revert InvalidState();
        if(msg.sender!=l.lender) revert Unauthorized();
        if(block.timestamp<=l.dueAt+GRACE_PERIOD) revert Deadline();
        l.state=State.Defaulted; collateralClaimant[id]=l.lender;
        emit Defaulted(id);
    }
    /// @notice Separate NFT delivery from settlement so receiver failures cannot block repayment.
    function claimCollateral(uint256 id,address recipient) external nonReentrant {
        if(collateralClaimant[id]!=msg.sender || msg.sender==address(0)) revert Unauthorized();
        if(recipient==address(0)||recipient==address(this)) revert InvalidTerms();
        uint256 tokenId=loans[id].tokenId;
        delete collateralClaimant[id]; delete positionLoan[tokenId];
        veBTC.safeTransferFrom(address(this),recipient,tokenId);
        emit CollateralClaimed(id,recipient);
    }
    function withdrawRepayment(address recipient) external nonReentrant {
        uint256 amount=repaymentBalance[msg.sender];
        if(amount==0 || recipient==address(0) || recipient==address(this)) revert InvalidTerms();
        repaymentBalance[msg.sender]=0;
        musd.safeTransfer(recipient,amount);
        emit RepaymentWithdrawn(msg.sender,recipient,amount);
    }
    function _eligible(uint256 tokenId,uint256 latestDue) internal view {
        IVeBTC.LockedBalance memory lock=veBTC.locked(tokenId);
        if(veBTC.escrowType(tokenId)!=0 || lock.isPermanent || lock.amount<=0 || lock.end<latestDue) revert IneligiblePosition();
    }
    function onERC721Received(address operator,address from,uint256 tokenId,bytes calldata) external view returns(bytes4) {
        if(msg.sender!=address(veBTC)||!receiving||operator!=address(this)||from!=expectedFrom||tokenId!=expectedToken) revert UnexpectedNFT();
        return IERC721Receiver.onERC721Received.selector;
    }
}
