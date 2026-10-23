const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const solc=require('solc'),ganache=require('ganache'),{ethers}=require('ethers'),LatchChain=require('../dist/chain.js');
const sources=Object.fromEntries(['contracts/LatchCredit.sol','contracts/test/Mocks.sol'].map(p=>[p,{content:fs.readFileSync(p,'utf8')}]));
const output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion:'london',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}}),{import:p=>{try{return {contents:fs.readFileSync(path.join('node_modules',p),'utf8')}}catch{return {error:'Missing '+p}}}}));
if((output.errors||[]).some(e=>e.severity==='error'))throw Error('Compilation failed');
const rpc=ganache.provider({logging:{quiet:true},wallet:{totalAccounts:3},chain:{chainId:31611}}),provider=new ethers.BrowserProvider(rpc,undefined,{cacheTimeout:-1});provider.pollingInterval=10;
async function done(make){const tx=await make();return tx.wait()}
(async()=>{try{
 const [b,l]=await Promise.all([provider.getSigner(0),provider.getSigner(1)]),ba=await b.getAddress(),la=await l.getAddress();
 const session=a=>({account:a,provider:{request:async p=>p.method==='eth_accounts'?[a]:rpc.request(p)}});
 async function deploy(file,name,args=[]){const a=output.contracts[file][name],c=await new ethers.ContractFactory(a.abi,a.evm.bytecode.object,b).deploy(...args);await c.waitForDeployment();return c}
 const m=await deploy('contracts/test/Mocks.sol','MockMUSD'),v=await deploy('contracts/test/Mocks.sol','MockVeBTC'),c=await deploy('contracts/LatchCredit.sol','LatchCredit',[await m.getAddress(),await v.getAddress()]);
 const api=new LatchChain(ethers,provider,{chainId:31611,latchCredit:await c.getAddress(),musd:await m.getAddress(),veBTC:await v.getAddress(),abi:output.contracts['contracts/LatchCredit.sol'].LatchCredit.abi});
 await api.verify();
 const deploymentConfig={...api.config,creationDataHash:ethers.keccak256(c.deploymentTransaction().data),expectedDeployer:ba};
 const record={address:await c.getAddress(),transactionHash:c.deploymentTransaction().hash};
 const activated=await LatchChain.resolveDeployment(ethers,provider,deploymentConfig,record);assert.equal(activated.latchCredit,await c.getAddress());
 await assert.rejects(async()=>LatchChain.resolveDeployment(ethers,provider,deploymentConfig,{...record,address:await m.getAddress()}),/differs from the onchain/);
 await assert.rejects(()=>LatchChain.resolveDeployment(ethers,provider,{...deploymentConfig,creationDataHash:ethers.ZeroHash},record),/wrong collateral/);
 console.log('PASS activation verifies creation data and rejects mismatched collateral deployment');
 const now=(await provider.getBlock('latest')).timestamp;
 await done(()=>v.mint(ba,1,now+28*86400,false,0));await done(()=>m.mint(la,ethers.parseEther('100')));
 const owned=await api.owned(ba);assert.equal(owned.count,1);assert.equal(owned.positions[0].id,1n);console.log('PASS client loads NFT ownership, lock and enumeration');
 const q=api.terms(owned.positions[0],'10','0.25','7',now);assert.equal(q.interest,ethers.parseEther('0.25'));assert.throws(()=>api.terms(owned.positions[0],'10','1','27',now));assert.throws(()=>api.terms(owned.positions[0],'10','1','1.5',now));console.log('PASS exact amounts and collateral horizon validation');
 await assert.rejects(()=>api.signer({account:ba,provider:{request:async p=>p.method==='eth_chainId'?'0x1':[ba]}}),/Switch/);
 await assert.rejects(()=>api.signer({account:ba,provider:{request:async p=>p.method==='eth_chainId'?'0x7b7b':[la]}}),/account changed/);console.log('PASS wrong network and changed wallet blocked');
 await api.nftApproval(session(ba),1,done);assert.equal(await v.getApproved(1),await c.getAddress());assert.equal(await v.isApprovedForAll(ba,await c.getAddress()),false);
 await api.action(session(ba),'request',[1,q.principal,q.interest,q.duration,q.expiresAt],done);assert.equal(await m.balanceOf(ba),0n);console.log('PASS per-NFT approval and escrow request without fake funding');
 await assert.rejects(()=>api.action(session(ba),'fund',[1],done));await api.tokenApproval(session(la),q.principal,done);assert.equal(await m.allowance(la,await c.getAddress()),q.principal);
 await api.action(session(la),'fund',[1],done);assert.equal(await m.balanceOf(ba),q.principal);console.log('PASS separate lender, exact token approval and funding');
 await assert.rejects(()=>api.tokenApproval(session(ba),q.principal+q.interest,done),/insufficient/);
 await done(()=>m.mint(ba,q.interest));await api.tokenApproval(session(ba),q.principal+q.interest,done);await api.action(session(ba),'repay',[1],done);
 assert.equal(await v.ownerOf(1),await c.getAddress());await api.action(session(ba),'claimCollateral',[1,ba],done);assert.equal(await v.ownerOf(1),ba);
 await api.action(session(la),'withdrawRepayment',[la],done);assert.equal(await c.repaymentBalance(la),0n);console.log('PASS repayment, separate NFT claim and lender withdrawal');
 const page=await api.loans();assert.equal(page.loans[0].state,3);assert.equal(page.hasMore,false);console.log('PASS reads settled loan state');
 }finally{await provider.destroy();await rpc.disconnect()}})().catch(e=>{console.error(e);process.exitCode=1});
