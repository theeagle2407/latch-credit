(function(root){
class LatchChain {
  static async resolveDeployment(e,provider,config,record){
    if(!record||!e.isAddress(record.address)||!/^0x[0-9a-f]{64}$/i.test(record.transactionHash))throw Error('Invalid deployment receipt.');
    const [tx,receipt]=await Promise.all([provider.getTransaction(record.transactionHash),provider.getTransactionReceipt(record.transactionHash)]);
    if(!tx||!receipt)throw Error('Transaction or receipt is not available from this RPC yet. Retry shortly.');
    if(receipt.status!==1)throw Error('Deployment transaction reverted.');
    if(!receipt.contractAddress||tx.to)throw Error('This transaction is not a contract deployment.');
    if(receipt.contractAddress.toLowerCase()!==record.address.toLowerCase())throw Error('The downloaded receipt address differs from the onchain contract address. Use the deployment transaction hash to activate.');
    if(e.keccak256(tx.data)!==config.creationDataHash||tx.from.toLowerCase()!==config.expectedDeployer.toLowerCase())throw Error('Deployment targets the wrong collateral contract or does not match the prepared contract.');
    const updated={...config,latchCredit:receipt.contractAddress,status:'deployed',deploymentTransaction:record.transactionHash,deploymentBlock:receipt.blockNumber};
    const client=new LatchChain(e,provider,updated);await client.verify();return updated;
  }
  constructor(ethers, provider, config) {
    this.e=ethers; this.provider=provider; this.config=config;
    this.credit=new ethers.Contract(config.latchCredit,config.abi,provider);
    this.nft=new ethers.Contract(config.veBTC,[
      'function balanceOf(address) view returns(uint256)',
      'function ownerToNFTokenIdList(address,uint256) view returns(uint256)',
      'function tokenOfOwnerByIndex(address,uint256) view returns(uint256)',
      'function ownerOf(uint256) view returns(address)',
      'function locked(uint256) view returns(int128 amount,uint256 end,bool isPermanent)',
      'function escrowType(uint256) view returns(uint8)',
      'function getApproved(uint256) view returns(address)',
      'function isApprovedForAll(address,address) view returns(bool)',
      'function approve(address,uint256)'
    ],provider);
    this.token=new ethers.Contract(config.musd,[
      'function balanceOf(address) view returns(uint256)',
      'function allowance(address,address) view returns(uint256)',
      'function approve(address,uint256) returns(bool)'
    ],provider);
  }
  same(a,b){return typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase()}
  async verify(){
    if(Number((await this.provider.getNetwork()).chainId)!==this.config.chainId)throw Error('Unexpected network.');
    const [m,v]=await Promise.all([this.credit.musd(),this.credit.veBTC()]);
    if(!this.same(m,this.config.musd)||!this.same(v,this.config.veBTC))throw Error('Contract configuration does not match its deployed token addresses.');
  }
  async position(id){
    const [owner,lock,kind,loanId]=await Promise.all([this.nft.ownerOf(id),this.nft.locked(id),this.nft.escrowType(id),this.credit.positionLoan(id)]);
    return {id:BigInt(id),owner,amount:lock.amount,end:Number(lock.end),permanent:lock.isPermanent,kind:Number(kind),loanId};
  }
  eligible(p,latestDue){return p.kind===0&&!p.permanent&&p.amount>0n&&p.end>=latestDue}
  async owned(address,offset=0,limit=25){
    const count=Number(await this.nft.balanceOf(address)), positions=[];
    for(let i=offset;i<Math.min(count,offset+limit);i++){
      let id;try{id=await this.nft.ownerToNFTokenIdList(address,i)}catch{id=await this.nft.tokenOfOwnerByIndex(address,i)}
      if(id===0n)throw Error('Position enumeration returned an invalid ID. Use Add position by ID.');
      const p=await this.position(id);if(!this.same(p.owner,address))throw Error('Position ownership changed. Refresh and retry.');positions.push(p);
    }
    return {count,positions};
  }
  async loans(before,limit=50){
    const next=before===undefined?await this.credit.nextId():BigInt(before),out=[];
    const end=next>BigInt(limit)?next-BigInt(limit):1n;
    for(let i=next-1n;i>=end;i--){
      const l=await this.credit.loans(i),claimant=await this.credit.collateralClaimant(i);
      out.push({id:i,borrower:l.borrower,lender:l.lender,tokenId:l.tokenId,principal:l.principal,interest:l.interest,duration:Number(l.duration),expiresAt:Number(l.expiresAt),dueAt:Number(l.dueAt),state:Number(l.state),claimant});
    }
    return {loans:out,before:end,hasMore:end>1n};
  }
  terms(p,amount,interest,days,now){
    const principal=this.e.parseUnits(amount,18),fee=this.e.parseUnits(interest,18),duration=Number(days)*86400,expiresAt=now+86400;
    if(principal<=0n||fee<0n||fee>principal||!Number.isInteger(Number(days))||duration<86400||duration>90*86400)throw Error('Enter a positive amount, interest up to the principal, and a whole term of 1–90 days.');
    if(!this.eligible(p,expiresAt+duration+86400))throw Error('This lock must cover the funding window, loan term and one-day grace period.');
    return {principal,interest:fee,duration,expiresAt,tokenId:p.id};
  }
  async signer(session){
    if(!session?.provider||!session.account)throw Error('Connect your wallet first.');
    const chain=await session.provider.request({method:'eth_chainId'}),accounts=await session.provider.request({method:'eth_accounts'});
    if(Number(chain)!==this.config.chainId)throw Error('Switch your wallet to Mezo to continue.');
    if(!this.same(accounts[0],session.account))throw Error('Wallet account changed. Reconnect and retry.');
    const browser=new this.e.BrowserProvider(session.provider,'any');return browser.getSigner(session.account);
  }
  async nftApproval(session,id,submit){
    const signer=await this.signer(session),owner=await this.nft.ownerOf(id);
    if(!this.same(owner,session.account))throw Error('This position is no longer in your wallet.');
    const [approval,all]=await Promise.all([this.nft.getApproved(id),this.nft.isApprovedForAll(session.account,this.config.latchCredit)]);
    if(!all&&!this.same(approval,this.config.latchCredit))await submit(()=>this.nft.connect(signer).approve(this.config.latchCredit,id),'Approve position');
  }
  async tokenApproval(session,amount,submit){
    if(await this.token.balanceOf(session.account)<amount)throw Error('Your MUSD balance is insufficient.');
    const allowance=await this.token.allowance(session.account,this.config.latchCredit);
    if(allowance<amount){
      let signer=await this.signer(session);
      if(allowance>0n){await submit(()=>this.token.connect(signer).approve(this.config.latchCredit,0n),'Reset MUSD allowance');signer=await this.signer(session);}
      await submit(()=>this.token.connect(signer).approve(this.config.latchCredit,amount),'Approve '+this.e.formatUnits(amount,18)+' MUSD');
    }
  }
  async action(session,method,args,submit){
    if(!['request','fund','cancel','repay','claimDefault','claimCollateral','withdrawRepayment'].includes(method))throw Error('Unknown loan action.');
    const signer=await this.signer(session),contract=this.credit.connect(signer);
    await contract[method].staticCall(...args);
    await this.signer(session);
    return submit(()=>contract[method](...args),method);
  }
}
if(typeof module!=='undefined'&&module.exports)module.exports=LatchChain;else root.LatchChain=LatchChain;
})(globalThis);
