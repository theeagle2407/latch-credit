const fs=require('node:fs'),path=require('node:path'),{ethers}=require('ethers'),LatchChain=require('../dist/chain.js');
const root=path.resolve(__dirname,'..');
(async()=>{
  if(!process.argv[2])throw Error('Usage: node scripts/activate-deployment.cjs TRANSACTION_HASH_OR_RECEIPT_PATH');
  const config=JSON.parse(fs.readFileSync(path.join(root,'dist/network.json'),'utf8'));
  const input=process.argv[2];let record;
  if(!/^0x[0-9a-f]{64}$/i.test(input))record=JSON.parse(fs.readFileSync(path.resolve(input),'utf8'));
  const request=new ethers.FetchRequest(config.rpcUrl);request.timeout=20000;
  const provider=new ethers.JsonRpcProvider(request,undefined,{batchMaxCount:1,cacheTimeout:-1});
  try{
    if(!record){const receipt=await provider.getTransactionReceipt(input);if(!receipt?.contractAddress)throw Error('Deployment receipt is not available yet or this is not a deployment transaction.');record={address:receipt.contractAddress,transactionHash:input};}
    const updated=await LatchChain.resolveDeployment(ethers,provider,config,record);
    const {abi,...settings}=updated;
    fs.writeFileSync(path.join(root,'config/mezo-testnet.json'),JSON.stringify(settings,null,2)+'\n');
    fs.writeFileSync(path.join(root,'dist/network.json'),JSON.stringify(updated,null,2)+'\n');
    console.log('Verified and activated Latch at '+updated.latchCredit+'. Reload the app.');
  }finally{provider.destroy();}
})().catch(e=>{console.error(e.shortMessage||e.message);process.exitCode=1});
