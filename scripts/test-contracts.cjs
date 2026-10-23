const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const solc=require('solc'),ganache=require('ganache'),{ethers}=require('ethers');
const sources=Object.fromEntries(['contracts/LatchCredit.sol','contracts/test/Mocks.sol'].map(p=>[p,{content:fs.readFileSync(p,'utf8')}]));
const output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion:'london',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}}),{import:p=>{try{return{contents:fs.readFileSync(path.join('node_modules',p),'utf8')}}catch{return{error:'Missing '+p}}}}));
const errors=(output.errors||[]).filter(e=>e.severity==='error');if(errors.length)throw Error(errors.map(e=>e.formattedMessage).join('\n'));
fs.mkdirSync('artifacts',{recursive:true});const artifact=output.contracts['contracts/LatchCredit.sol'].LatchCredit;fs.writeFileSync('artifacts/LatchCredit.json',JSON.stringify(artifact,null,2));
const rpc=ganache.provider({logging:{quiet:true},wallet:{totalAccounts:4},chain:{hardfork:'shanghai'}}),provider=new ethers.BrowserProvider(rpc, undefined, {cacheTimeout: -1});provider.pollingInterval=10;
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name)}
async function rejects(fn){await assert.rejects(async()=>{const tx=await fn();if(tx?.wait)await tx.wait()})}
(async()=>{const [b,l,x]=await Promise.all([0,1,2].map(i=>provider.getSigner(i))),ba=await b.getAddress(),la=await l.getAddress(),xa=await x.getAddress();
async function deploy(file,name,args=[]){const a=output.contracts[file][name],c=await new ethers.ContractFactory(a.abi,a.evm.bytecode.object,b).deploy(...args);await c.waitForDeployment();return c}
const m=await deploy('contracts/test/Mocks.sol','MockMUSD'),v=await deploy('contracts/test/Mocks.sol','MockVeBTC'),c=await deploy('contracts/LatchCredit.sol','LatchCredit',[await m.getAddress(),await v.getAddress()]);const ca=await c.getAddress(),now=Number((await provider.getBlock('latest')).timestamp),day=86400,P=ethers.parseEther('1500'),I=ethers.parseEther('7');
for(const [id,permanent,kind,end] of [[1,false,0,now+100*day],[2,false,0,now+100*day],[3,true,0,now+100*day],[4,false,2,now+100*day],[5,false,0,now+day],[6,false,0,now+100*day]])await(await v.mint(ba,id,end,permanent,kind)).wait();
await(await v.setApprovalForAll(ca,true)).wait();await(await m.mint(la,P*10n)).wait();await(await m.connect(l).approve(ca,ethers.MaxUint256)).wait();
await test('reject permanent, managed and insufficient lock horizon',async()=>{for(const id of [3,4,5])await rejects(()=>c.request(id,P,I,7*day,now+day))});
await test('only owner can request',()=>rejects(()=>c.connect(x).request(1,P,I,7*day,now+day)));
await test('escrow request transfers NFT, creates no MUSD',async()=>{await(await c.request(1,P,I,7*day,now+day)).wait();assert.equal(await v.ownerOf(1),ca);assert.equal(await m.balanceOf(ba),0n)});
await test('borrower cannot self-fund',()=>rejects(()=>c.fund(1)));
await test('lender funds exact principal',async()=>{await(await c.connect(l).fund(1)).wait();assert.equal(await m.balanceOf(ba),P);assert.equal((await c.loans(1)).state,2n)});
await test('active collateral cannot be cancelled or seized early',async()=>{await rejects(()=>c.cancel(1));await rejects(()=>c.connect(l).claimDefault(1));await rejects(()=>c.claimCollateral(1,ba))});
await test('failed repayment preserves loan',async()=>{await rejects(()=>c.repay(1));assert.equal((await c.loans(1)).state,2n)});
await(await m.mint(ba,I)).wait();await(await m.approve(ca,ethers.MaxUint256)).wait();
await test('repayment settles debt and assigns borrower NFT claim',async()=>{await(await c.repay(1)).wait();assert.equal((await c.loans(1)).state,3n);assert.equal(await c.collateralClaimant(1),ba);assert.equal(await c.repaymentBalance(la),P+I)});
await test('only claimant can retrieve collateral',async()=>{await rejects(()=>c.connect(x).claimCollateral(1,xa));await(await c.claimCollateral(1,ba)).wait();assert.equal(await v.ownerOf(1),ba);assert.equal(await c.positionLoan(1),0n)});
await test('lender withdraws repayment once',async()=>{const before=await m.balanceOf(la);await(await c.connect(l).withdrawRepayment(la)).wait();assert.equal(await m.balanceOf(la),before+P+I);await rejects(()=>c.connect(l).withdrawRepayment(la))});
await test('unfunded request cancellation returns claim to borrower',async()=>{await(await c.request(2,P,I,7*day,now+day)).wait();await rejects(()=>c.connect(x).cancel(2));await(await c.cancel(2)).wait();await(await c.claimCollateral(2,ba)).wait();assert.equal(await v.ownerOf(2),ba)});
await test('reject unsolicited safe NFT deposits',()=>rejects(()=>v['safeTransferFrom(address,address,uint256)'](ba,ca,6)));
await(await c.request(1,P,I,day,now+day)).wait();await(await c.connect(l).fund(3)).wait();await rpc.request({method:'evm_increaseTime',params:[2*day+2]});await rpc.request({method:'evm_mine',params:[]});
await test('default only after grace and only to lender',async()=>{await rejects(()=>c.repay(3));await rejects(()=>c.connect(x).claimDefault(3));await(await c.connect(l).claimDefault(3)).wait();await(await c.connect(l).claimCollateral(3,la)).wait();assert.equal(await v.ownerOf(1),la);assert.equal((await c.loans(3)).state,5n)});
console.log(`${passed} contract checks passed; compiled with solc ${solc.version()}.`);await rpc.disconnect();})().catch(async e=>{console.error(e);await rpc.disconnect();process.exitCode=1});
