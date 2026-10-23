/* EIP-6963 wallet discovery and Mezo network selection. */
(() => {
  const wallets = new Map();
  const button = document.querySelector('#wallet');
  let active = null, account = '', chain = '', pending = false, choosing = false;
  let cleanup = () => {};
  const short = value => value.slice(0, 6) + '…' + value.slice(-4);
  const validAccount = value => typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value);
  const announce = () => window.dispatchEvent(new CustomEvent('latch:wallet',{detail:active&&account&&Number(chain)===31611?{provider:active.provider,account}:null}));
  async function ensureNetwork(provider) {
    if(Number(await provider.request({method:'eth_chainId'}))!==31611){
      try { await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x7b7b'}]}); }
      catch(e){if(Number(e.code)!==4902)throw e;await provider.request({method:'wallet_addEthereumChain',params:[{chainId:'0x7b7b',chainName:'Mezo Testnet',nativeCurrency:{name:'Bitcoin',symbol:'BTC',decimals:18},rpcUrls:['https://rpc.test.mezo.org'],blockExplorerUrls:['https://explorer.test.mezo.org']}]});await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x7b7b'}]});}
    }
    const value=await provider.request({method:'eth_chainId'});if(Number(value)!==31611)throw Error('Network switch was not completed.');return String(value);
  }
  function update() {
    button.textContent = pending ? 'Check your wallet…' : account ? short(account) : 'Connect wallet';
    button.disabled = pending;
    button.title = account || 'Connect an installed wallet';
  }
  function disconnect() {
    cleanup(); cleanup = () => {}; active = null; account = ''; chain = ''; update(); announce();
  }
  function add(provider, name, key) {
    if (!provider || typeof provider.request !== 'function') return;
    if ([...wallets.values()].some(w => w.provider === provider)) return;
    wallets.set(key, {provider, name: String(name || 'Installed wallet').slice(0, 80)});
    if (choosing && !pending) chooser();
  }
  window.addEventListener('eip6963:announceProvider', event => {
    const d = event.detail;
    if (d && d.info && typeof d.info.uuid === 'string') add(d.provider, d.info.name, d.info.uuid);
  });
  function discover() {
    window.dispatchEvent(new Event('eip6963:requestProvider'));
    // Use legacy injection only when no modern announcement is available.
    if (!wallets.size && window.ethereum) {
      const providers = Array.isArray(window.ethereum.providers) ? window.ethereum.providers : [window.ethereum];
      providers.forEach((p, i) => add(p, p.isRabby ? 'Rabby' : p.isCoinbaseWallet ? 'Coinbase Wallet' : p.isMetaMask ? 'MetaMask' : 'Installed wallet', 'legacy-' + i));
    }
  }
  function status(message) {
    const element = document.querySelector('#wallet-status');
    if (element) element.textContent = message;
    else toast(message);
  }
  function chooser() {
    choosing = true;
    panel('<h2>Connect wallet</h2><p>Choose an installed wallet.</p><div id="wallet-list"></div><p id="wallet-status" role="status"></p>', 'WALLET');
    const list = document.querySelector('#wallet-list');
    for (const wallet of wallets.values()) {
      const option = document.createElement('button');
      option.className = 'button wide wallet-option';
      option.textContent = wallet.name;
      option.onclick = () => connect(wallet);
      list.appendChild(option);
    }
    if (!wallets.size) status('No wallet detected. Enable your wallet extension for this site, then retry.');
    const retry = document.createElement('button');
    retry.className = 'text-button'; retry.textContent = 'Refresh wallets';
    retry.onclick = () => { discover(); chooser(); };
    list.appendChild(retry);
  }
  async function connect(wallet) {
    if (pending) return;
    pending = true; choosing = false; update();
    document.querySelectorAll('.wallet-option').forEach(b => b.disabled = true);
    status('Approve the connection in your wallet.');
    try {
      const accounts = await wallet.provider.request({method: 'eth_requestAccounts'});
      if (!Array.isArray(accounts) || !validAccount(accounts[0])) throw new Error('No account');
      const network=await ensureNetwork(wallet.provider);
      cleanup(); active = wallet; account = accounts[0]; chain=network;
      const provider = wallet.provider;
      const accountsChanged = accounts => {
        if (!Array.isArray(accounts) || !validAccount(accounts[0])) disconnect();
        else { account = accounts[0]; update(); announce(); }
        if (document.querySelector('#wallet-address')) { if (account) accountPanel(); else document.querySelector('#drawer').close(); }
      };
      const chainChanged = value => { chain = String(value); announce(); if(Number(chain)!==31611)toast('Wallet network changed. Reconnect to continue on Mezo.');if (document.querySelector('#wallet-address')) accountPanel(); };
      const lost = () => { disconnect(); if (document.querySelector('#wallet-address')) document.querySelector('#drawer').close(); toast('Wallet disconnected.'); };
      if (typeof provider.on === 'function') {
        provider.on('accountsChanged', accountsChanged); provider.on('chainChanged', chainChanged); provider.on('disconnect', lost);
        cleanup = () => {
          if (typeof provider.removeListener !== 'function') return;
          provider.removeListener('accountsChanged', accountsChanged); provider.removeListener('chainChanged', chainChanged); provider.removeListener('disconnect', lost);
        };
      }
      if (document.querySelector('#wallet-list')) document.querySelector('#drawer').close();
      announce(); toast('Wallet connected.');
    } catch (error) {
      const code = Number(error.code);
      const message = code === 4001 ? 'Connection declined. You can try again.' : code === -32002 ? 'A request is already open. Check your wallet.' : 'Unable to connect. Unlock your wallet and try again.';
      chooser(); status(message);
    } finally {
      pending = false; update();
      document.querySelectorAll('.wallet-option').forEach(b => b.disabled = false);
    }
  }
  function accountPanel() {
    if (!account) return;
    choosing = false;
    panel('<h2>Wallet</h2><p id="wallet-name"></p><p id="wallet-address" style="overflow-wrap:anywhere"></p><p id="wallet-network"></p><button id="switch-network" class="button wide">Switch to Mezo</button><button id="disconnect-wallet" class="button wide">Disconnect from Latch</button>', 'ACCOUNT');
    document.querySelector('#wallet-name').textContent = active.name;
    document.querySelector('#wallet-address').textContent = account;
    document.querySelector('#wallet-network').textContent = chain ? (Number(chain) === 31611 ? 'Mezo testnet' : 'Network ID: ' + Number(chain)) : 'Network unavailable';
    document.querySelector('#switch-network').hidden=Number(chain)===31611;
    document.querySelector('#switch-network').onclick=async()=>{try{chain=await ensureNetwork(active.provider);announce();accountPanel()}catch{toast('Network switch not completed.')}};
    document.querySelector('#disconnect-wallet').onclick = () => { disconnect(); document.querySelector('#drawer').close(); };
  }
  document.querySelector('#drawer').addEventListener('close', () => { choosing = false; });
  button.onclick = () => {
    if (pending) return;
    if (account) return accountPanel();
    discover();
    if (wallets.size === 1) connect(wallets.values().next().value);
    else chooser();
  };
  window.dispatchEvent(new Event('eip6963:requestProvider'));
})();
