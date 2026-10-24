'use strict';
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=n=>n?new Date(Number(n)*1000).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'—';
const deadline=n=>n?new Date(Number(n)*1000).toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'Set when funded';
const amount=n=>ethers.formatUnits(n||0n,18),short=a=>a.slice(0,6)+'…'+a.slice(-4);
const states=['','Awaiting funding','Active','Repaid','Cancelled','Defaulted'];
const transactionLabel=label=>({request:'Loan request',fund:'Loan funding',repay:'Loan repayment',cancel:'Request cancellation',claimDefault:'Default claim',claimCollateral:'Collateral claim',withdrawRepayment:'Repayment withdrawal'}[label]||label);
let api,config,session=null,positions=[],loans=[],filter='all',busy=false,epoch=0,loading=false,loadError='',ownedCount=0,ownedOffset=0,loanBefore,moreLoans=false,now=0,repayment=0n;
let txKey='',records=[];
function loadTxs(){txKey='latch-txs-'+config.chainId+'-'+config.latchCredit.toLowerCase();try{const d=JSON.parse(localStorage.getItem(txKey)||'[]');if(Array.isArray(d))records=d.filter(t=>/^0x[0-9a-f]{64}$/i.test(t.hash)&&ethers.isAddress(t.account)).slice(0,100)}catch{}}
function saveTxs(){try{localStorage.setItem(txKey,JSON.stringify(records))}catch{}}
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),5000)}
function panel(html,label='LATCH'){$('#drawer-label').textContent=label;$('#drawer-content').innerHTML=html;if(!$('#drawer').open)$('#drawer').showModal()}
$('#close').onclick=()=>$('#drawer').close();$('#drawer').addEventListener('click',e=>{if(e.target===$('#drawer')&&e.clientX<$('#drawer').getBoundingClientRect().left)$('#drawer').close()});
const details=rows=>'<div class="details">'+rows.map(([a,b])=>`<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')+'</div>';
const terms='<details><summary>Collateral and recovery terms</summary><p>Your veBTC NFT enters escrow when you submit a request. MUSD arrives only after another wallet funds it. Repayment creates a separate NFT claim. After the one-day grace period, the lender can claim default and recover the NFT. Bitcoin withdrawal still depends on lock expiry and voting restrictions. Latch provides no voting or reward forwarding while the NFT is in escrow. There is no price oracle or guaranteed lender.</p></details>';
const mine=l=>session&&(api.same(l.borrower,session.account)||api.same(l.lender,session.account));
const borrower=l=>session&&api.same(l.borrower,session.account);
function errorText(e){if(Number(e.code)===4001||e.code==='ACTION_REJECTED')return 'Request declined in your wallet.';let name=e.revert?.name;try{if(!name&&e.data)name=api.credit.interface.parseError(e.data)?.name}catch{}return {Unauthorized:'This wallet cannot perform that action.',IneligiblePosition:'This position is not eligible for those terms.',InvalidTerms:'The contract rejected these terms.',InvalidState:'This loan changed. Refresh and retry.',Deadline:'The funding or repayment deadline has passed.'}[name]||String(e.shortMessage||e.message||'Unable to complete the request.').slice(0,300)}
function view(v){v=['positions','market','activity'].includes(v)?v:'positions';$$('.view').forEach(x=>x.classList.toggle('active',x.id===v));$$('nav button').forEach(x=>x.classList.toggle('active',x.dataset.view===v));const title={positions:'Positions',market:'Credit market',activity:'Activity'}[v];$('#title').textContent=title;$('#breadcrumb').textContent='Workspace / '+title;$('#subtitle').textContent={positions:'Manage credit against your locked Bitcoin.',market:'Fund requests on terms you choose.',activity:'Your loans, repayments and transactions.'}[v];$('#new-loan').hidden=v!=='positions';history.replaceState(null,'','#'+v);render()}
$$('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));$('.logo').onclick=e=>{e.preventDefault();view('positions')};
$$('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;$$('[data-filter]').forEach(x=>x.classList.toggle('selected',x===b));render()});
function positionStatus(p){if(p.loanId)return 'In escrow';if(p.kind!==0)return 'Managed';if(p.permanent)return 'Permanent';if(p.end<=now)return 'Expired';if(p.amount<=0n)return 'Empty';return 'Available'}
function render(){
  if(!api)return;
  document.body.classList.toggle('is-syncing',loading);
  $('#positions').setAttribute('aria-busy',String(loading));
  const own=loans.filter(borrower),debt=own.filter(l=>l.state===2),next=debt.slice().sort((a,b)=>a.dueAt-b.dueAt)[0];
  $('#collateral').textContent=session?amount(positions.reduce((sum,p)=>sum+p.amount,0n)):'—';$('#position-count').textContent=session?String(positions.length):'0';$('#collateral-note').textContent=session?(loading?'Loading positions…':positions.length+' positions loaded'):'Connect to view positions';
  $('#debt').textContent=session?amount(debt.reduce((sum,l)=>sum+l.principal+l.interest,0n)):'—';$('#loan-count').textContent=debt.length+' active loans'+(moreLoans?' · recent loans loaded':'');$('#next-due').textContent=next?date(next.dueAt):'—';$('#next-amount').textContent=next?amount(next.principal+next.interest)+' MUSD':'Nothing due';
  $('#new-loan').disabled=busy||loading||!session||!positions.some(p=>!p.loanId&&api.same(p.owner,session.account)&&api.eligible(p,now+3*86400));
  $('#sync-state').textContent=loadError||(loading?'Syncing…':session?'Connected':'Connect your wallet');$('#refresh').disabled=loading||busy;
  const list=positions.filter(p=>filter==='all'||(filter==='pledged'?p.loanId>0n:p.loanId===0n));
  $('#position-rows').innerHTML=list.map(p=>`<tr><td><div class="position-name"><span class="btc">₿</span><div><b>veBTC #${p.id}</b><small>${p.permanent?'Permanent lock':'Fixed lock'}</small></div></div></td><td>${esc(amount(p.amount))} BTC</td><td>${p.permanent?'Permanent':date(p.end)}</td><td><span class="status ${p.loanId?'pledged':''}">${positionStatus(p)}</span></td><td><button class="button" data-position="${p.id}">${p.loanId?'View loan':'View position'}</button></td></tr>`).join('')||`<tr><td colspan="5" class="empty">${loading?'Loading positions…':!session?'Connect your wallet to view your veBTC positions.':loadError?'Unable to load positions. Refresh to retry.':'No veBTC positions found. Add an existing NFT by ID below.'}</td></tr>`;
  $('#load-positions').hidden=!session||ownedCount<=ownedOffset;
  $('#position-guide').hidden=!session||loading||positions.length>0||Boolean(loadError);
  $('#recent').innerHTML=own.length?own.slice(0,3).map(l=>`<div class="event"><b>Loan #${l.id} · ${states[l.state]}</b><span>${esc(amount(l.principal))} MUSD</span></div>`).join(''):'No loan activity yet.';
  const requests=loans.filter(l=>l.state===1&&l.expiresAt>now);
  $('#market-rows').innerHTML=requests.map(l=>`<tr><td><b>veBTC #${l.tokenId}</b><small>Request #${l.id}</small></td><td>${esc(amount(l.principal))} MUSD</td><td>${l.duration/86400} days</td><td>${esc(amount(l.interest))} MUSD</td><td><button class="button" data-loan="${l.id}">Review</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty">'+(loading?'Loading requests…':loadError?'Requests could not be loaded. Refresh to retry.':'No open requests yet.')+'</td></tr>';
  $('#history').innerHTML=loans.filter(mine).map(l=>`<article class="loan"><div><strong>${esc(amount(l.principal))} MUSD</strong><p>#${l.id} · veBTC #${l.tokenId} · ${states[l.state]}</p></div><button class="button" data-loan="${l.id}">Manage</button></article>`).join('')||'<div class="empty">'+(session?'No loans found for this wallet.':'Connect your wallet to view your loans.')+'</div>';
  $('#withdraw').hidden=!session||repayment===0n;$('#withdraw').textContent='Withdraw '+amount(repayment)+' MUSD';$('#load-loans').hidden=!moreLoans;$('#load-loans').disabled=loading||busy;
  const txs=records.filter(t=>session&&api.same(t.account,session.account));
  $('#transactions').innerHTML=txs.length?txs.map(t=>`<div class="event"><b>${esc(transactionLabel(t.label))} · ${esc(t.status)}</b><a href="${config.explorer}/tx/${t.hash}" target="_blank" rel="noopener noreferrer">${short(t.hash)} ↗</a></div>`).join(''):'No transactions submitted from this browser.';
  const schedule=own.find(l=>l.state===2)||own.find(l=>l.state===1);
  $('#schedule').innerHTML=schedule?'<h2>Loan schedule · #'+schedule.id+'</h2>'+details([['Funding deadline',deadline(schedule.expiresAt)],['Repayment due',schedule.dueAt?deadline(schedule.dueAt):'Set when funded'],['Grace period','1 day']]):'<h2>Position schedule</h2><p class="muted">Your loan dates appear here after a request.</p>';
  $$('[data-position]').forEach(b=>b.onclick=()=>openPosition(b.dataset.position));$$('[data-loan]').forEach(b=>b.onclick=()=>openLoan(b.dataset.loan));
}
async function refresh(append=false){
  if(!api||loading)return;const generation=epoch;loading=true;loadError='';render();
  try{
    const block=await api.provider.getBlock('latest');if(generation!==epoch)return;now=block.timestamp;
    const page=await api.loans(append?loanBefore:undefined);if(generation!==epoch)return;loans=append?loans.concat(page.loans):page.loans;loanBefore=page.before;moreLoans=page.hasMore;
    if(session){
      const current=session;const [owned,balance]=await Promise.all([api.owned(current.account),api.credit.repaymentBalance(current.account)]);if(generation!==epoch)return;
      ownedCount=owned.count;ownedOffset=owned.positions.length;repayment=balance;const map=new Map(owned.positions.map(p=>[String(p.id),p]));
      for(const l of loans.filter(borrower)){if(l.state===1||l.state===2||api.same(l.claimant,current.account)){const p=await api.position(l.tokenId);if(p.loanId)map.set(String(p.id),p);}}
      if(generation!==epoch)return;positions=[...map.values()];
      for(const t of records.filter(t=>t.status==='Pending'&&api.same(t.account,current.account))){const r=await api.provider.getTransactionReceipt(t.hash);if(r)t.status=r.status===1?'Confirmed':'Reverted';else if(Number.isInteger(t.nonce)&&await api.provider.getTransactionCount(t.account,'latest')>t.nonce)t.status='Replaced · check wallet';}saveTxs();
    }else{positions=[];repayment=0n;}
  }catch(e){if(generation===epoch){loadError=errorText(e);toast(loadError)}}finally{loading=false;render();if(generation!==epoch)refresh();}
}
window.addEventListener('latch:wallet',e=>{epoch++;session=e.detail;positions=[];loans=[];repayment=0n;ownedCount=0;if($('#drawer').open)$('#drawer').close();render();refresh()});
async function submit(make,label){
  if(!session)throw Error('Connect your wallet first.');const owner=session.account;
  label=transactionLabel(label);const status=t=>{if($('#tx-status'))$('#tx-status').textContent=t};status('Confirm '+label.toLowerCase()+' in your wallet.');
  const tx=await make(),entry={hash:tx.hash,account:owner,label,status:'Pending',nonce:tx.nonce};records.unshift(entry);records=records.slice(0,100);saveTxs();render();status('Submitted. Waiting for confirmation…');
  let receipt;
  try{receipt=await tx.wait(1,180000)}catch(e){
    if(e.code==='TRANSACTION_REPLACED'){
      if(e.replacement?.hash)entry.hash=e.replacement.hash;
      if(e.cancelled){entry.status='Cancelled';saveTxs();throw Error('Transaction cancelled in your wallet.');}
      receipt=e.receipt;
    }else{if(e.receipt){entry.status='Reverted';saveTxs();}throw e;}
  }
  if(!receipt)throw Error('Still pending. Check Activity before retrying.');entry.status=receipt.status===1?'Confirmed':'Reverted';saveTxs();if(receipt.status!==1)throw Error('Transaction reverted.');return receipt;
}
async function run(label,operation){
  if(busy)return;const current=session;if(!current){toast('Connect your wallet first.');return;}
  if(records.some(t=>t.status==='Pending'&&api.same(t.account,current.account))){toast('A transaction is still pending. Refresh Activity before submitting another.');return;}
  busy=true;$$('#drawer-content button').forEach(b=>b.disabled=true);render();
  try{await operation(current);toast(label+' confirmed.');if($('#drawer').open)$('#drawer').close();}
  catch(e){toast(errorText(e));if($('#tx-status'))$('#tx-status').textContent=errorText(e);}
  finally{busy=false;$$('#drawer-content button').forEach(b=>b.disabled=false);await refresh();}
}
const txStatus=()=>'<p id="tx-status" role="status"></p>';
async function openPosition(id){try{const p=await api.position(id);if(p.loanId)return openLoan(p.loanId);panel(`<h2>veBTC #${p.id}</h2>${details([['Locked BTC',amount(p.amount)],['Unlock date',p.permanent?'Permanent':date(p.end)],['Status',positionStatus(p)]])}${terms}<button id="request-position" class="button primary wide">Request loan</button>`,'POSITION');$('#request-position').disabled=!session||!api.same(p.owner,session.account)||!api.eligible(p,now+3*86400);$('#request-position').onclick=()=>borrow(p);}catch(e){toast(errorText(e))}}
function borrow(p){
  panel(`<h2>Request a loan</h2><p>veBTC #${p.id} · ${esc(amount(p.amount))} BTC</p><label class="field" for="principal">Amount · MUSD</label><input id="principal" type="number" min="0" step="any" placeholder="0.00"><label class="field" for="interest">Fixed interest · MUSD</label><input id="interest" type="number" min="0" step="any" value="0"><label class="field" for="duration">Loan term · days</label><input id="duration" type="number" min="1" max="90" step="1" value="7"><p>Requests stay open for 24 hours. The repayment term starts when a lender funds the request.</p><button id="review-request" class="button primary wide">Review request</button><p id="quote-error" class="error" role="alert"></p>`,'REQUEST LOAN');
  $('#review-request').onclick=async()=>{try{const block=await api.provider.getBlock('latest');const q=api.terms(p,$('#principal').value,$('#interest').value,$('#duration').value,block.timestamp);panel(`<h2>Review request</h2>${details([['Position','veBTC #'+p.id],['Requested',amount(q.principal)+' MUSD'],['Fixed interest',amount(q.interest)+' MUSD'],['Total repayment',amount(q.principal+q.interest)+' MUSD'],['Loan term',q.duration/86400+' days'],['Funding deadline',deadline(q.expiresAt)],['BTC unlock',date(p.end)]])}${terms}<p class="warning">Submitting moves this NFT into escrow. You receive MUSD when a separate lender funds the request.</p><button id="submit-request" class="button primary wide">Approve position & submit</button>${txStatus()}`,'REVIEW');$('#submit-request').onclick=()=>run('Loan request',async s=>{await api.nftApproval(s,p.id,submit);await api.action(s,'request',[q.tokenId,q.principal,q.interest,q.duration,q.expiresAt],submit)});}catch(e){if($('#quote-error'))$('#quote-error').textContent=errorText(e)}};
}
async function openLoan(id){try{
  const raw=await api.credit.loans(id),claimant=await api.credit.collateralClaimant(id),l={id:BigInt(id),borrower:raw.borrower,lender:raw.lender,tokenId:raw.tokenId,principal:raw.principal,interest:raw.interest,duration:Number(raw.duration),expiresAt:Number(raw.expiresAt),dueAt:Number(raw.dueAt),state:Number(raw.state),claimant};
  const block=await api.provider.getBlock('latest'),time=block.timestamp,p=await api.position(l.tokenId),isBorrower=borrower(l),isLender=session&&api.same(l.lender,session.account),canClaim=session&&api.same(l.claimant,session.account);
  let actions='';const add=(id,text)=>actions+=`<button id="${id}" class="button primary wide">${text}</button>`;
  if(l.state===1&&isBorrower)add('cancel-loan','Cancel request');if(l.state===1&&!isBorrower&&l.expiresAt>time&&session)add('fund-loan','Approve MUSD & fund');if(l.state===2&&isBorrower&&time<=l.dueAt+86400)add('repay-loan','Approve MUSD & repay');if(l.state===2&&isLender&&time>l.dueAt+86400)add('default-loan','Claim default');if(canClaim)add('claim-nft','Claim collateral NFT');
  const termReturn=l.principal?(l.interest*10000n/l.principal):0n;
  const returnLabel=(termReturn/100n)+'.'+String(termReturn%100n).padStart(2,'0')+'%';
  const due=l.dueAt||time+l.duration;
  const defaultAfter=due+86400;
  const live=l.state===1||l.state===2;
  const economics=details([['Principal',amount(l.principal)+' MUSD'],['Interest if repaid',amount(l.interest)+' MUSD'],['Return over '+l.duration/86400+' days',returnLabel],['Total repayment',amount(l.principal+l.interest)+' MUSD']]);
  const timing=details([['Repayment'+(l.state===1?' if funded now':''),deadline(due)],['Default claim after'+(l.state===1?' · estimate':''),deadline(defaultAfter)],['BTC lock expires',p.permanent?'Permanent':deadline(p.end)]]);
  panel(`<h2>Loan #${l.id}</h2><p>${states[l.state]} · veBTC #${l.tokenId}</p><h3>Loan terms</h3>${economics}<p class="muted">Fixed interest, payable in full even on early repayment. Return excludes gas.</p>${live?'<h3>Recovery timeline</h3>'+timing+'<p class="muted">On default, claim the NFT first. BTC withdrawal also requires lock expiry and clearance of voting restrictions.</p>':''}<details><summary>Position and request details</summary>${details([['Locked collateral',amount(p.amount)+' BTC'],['Loan term',l.duration/86400+' days'],['Funding deadline',deadline(l.expiresAt)],['Repayment due',deadline(l.dueAt)],['BTC unlock',p.permanent?'Permanent':deadline(p.end)],['Borrower',short(l.borrower)],['Lender',l.state===1?'Awaiting funding':short(l.lender)]])}</details>${terms}${l.state===1&&l.expiresAt<=time?'<p class="warning">Funding window expired. The borrower can cancel and claim the NFT.</p>':''}${l.state===1&&!isBorrower?'<p class="warning">Funding sends MUSD to the borrower. Collateral value and repayment are not guaranteed.</p>':''}${canClaim?'<p>Settlement is complete. Claim the NFT in a separate transaction.</p>':''}${actions}${!session?'<p>Connect your wallet to continue.</p>':''}${txStatus()}`,'LOAN DETAILS');
  if($('#cancel-loan'))$('#cancel-loan').onclick=()=>run('Cancellation',s=>api.action(s,'cancel',[l.id],submit));
  if($('#fund-loan'))$('#fund-loan').onclick=()=>run('Funding',async s=>{await api.tokenApproval(s,l.principal,submit);await api.action(s,'fund',[l.id],submit)});
  if($('#repay-loan'))$('#repay-loan').onclick=()=>run('Repayment',async s=>{await api.tokenApproval(s,l.principal+l.interest,submit);await api.action(s,'repay',[l.id],submit)});
  if($('#default-loan'))$('#default-loan').onclick=()=>run('Default claim',s=>api.action(s,'claimDefault',[l.id],submit));
  if($('#claim-nft'))$('#claim-nft').onclick=()=>run('Collateral claim',s=>api.action(s,'claimCollateral',[l.id,s.account],submit));
}catch(e){toast(errorText(e))}}
$('#new-loan').onclick=()=>{const available=positions.filter(p=>session&&api.same(p.owner,session.account)&&!p.loanId&&api.eligible(p,now+3*86400));panel('<h2>Choose collateral</h2>'+available.map(p=>`<button class="button wide" data-pick="${p.id}">veBTC #${p.id} · ${esc(amount(p.amount))} BTC</button>`).join(''),'REQUEST LOAN');$$('[data-pick]').forEach(b=>b.onclick=()=>borrow(available.find(p=>String(p.id)===b.dataset.pick)))};
$('#add-position').onclick=()=>{if(!session)return toast('Connect your wallet first.');panel('<h2>Add position by ID</h2><label class="field" for="token-id">veBTC NFT ID</label><input id="token-id" type="number" min="1" step="1"><button id="lookup-position" class="button primary wide">Check position</button><p id="lookup-error" role="alert"></p>','POSITION');$('#lookup-position').onclick=async()=>{try{const value=$('#token-id').value;if(!/^[1-9][0-9]*$/.test(value))throw Error('Enter a valid NFT ID.');const p=await api.position(BigInt(value));if(!api.same(p.owner,session.account))throw Error('This NFT is not in your wallet.');positions=positions.filter(x=>x.id!==p.id).concat(p);render();openPosition(p.id)}catch(e){if($('#lookup-error'))$('#lookup-error').textContent=errorText(e)}}};
$('#load-positions').onclick=async()=>{if(loading||!session)return;const generation=epoch;loading=true;render();try{const current=session,page=await api.owned(current.account,ownedOffset);if(generation!==epoch)return;ownedOffset+=page.positions.length;positions=positions.concat(page.positions.filter(p=>!positions.some(x=>x.id===p.id)));}catch(e){toast(errorText(e))}finally{loading=false;render();if(generation!==epoch)refresh()}};
$('#load-loans').onclick=()=>refresh(true);$('#refresh').onclick=()=>refresh();
$('#withdraw').onclick=()=>{panel('<h2>Withdraw repayment</h2>'+details([['Available',amount(repayment)+' MUSD'],['Recipient',short(session.account)]])+'<button id="withdraw-confirm" class="button primary wide">Withdraw MUSD</button>'+txStatus(),'REPAYMENT');$('#withdraw-confirm').onclick=()=>run('Withdrawal',s=>api.action(s,'withdrawRepayment',[s.account],submit))};
$('#terms').onclick=()=>panel('<h2>Collateral terms</h2>'+terms,'LATCH');
$('#about').onclick=()=>panel('<h2>About Latch</h2><p>Credit against locked Bitcoin.</p><p>Request MUSD against eligible veBTC positions. Repay to reclaim your collateral NFT. Your Bitcoin’s unlock date stays unchanged.</p><p><a href="'+config.explorer+'/address/'+config.latchCredit+'" target="_blank" rel="noopener noreferrer">View lending contract ↗</a></p>','LATCH');
(async()=>{try{
  const response=await fetch('network.json');if(!response.ok)throw Error('Network configuration missing.');config=await response.json();
  const request=new ethers.FetchRequest(config.rpcUrl);request.timeout=20000;const provider=new ethers.JsonRpcProvider(request,undefined,{batchMaxCount:1,cacheTimeout:-1});
  if(!config.latchCredit){
    let record;try{record=JSON.parse(localStorage.getItem('latch-active-31611-'+config.veBTC.toLowerCase())||'null')}catch{}
    if(!record){provider.destroy();throw Error('Complete the corrected contract setup at /deploy.html, then reload Latch.');}
    config=await LatchChain.resolveDeployment(ethers,provider,config,record);
  }
  api=new LatchChain(ethers,provider,config);await api.verify();loadTxs();view(location.hash.slice(1));await refresh();
}catch(e){$('#sync-state').textContent=errorText(e);$('#new-loan').disabled=true;toast(errorText(e));}})();
