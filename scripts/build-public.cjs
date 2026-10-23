const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'dist');
const target = path.join(root, 'public-app');
const files = ['index.html', 'style.css', 'refined.css', 'app.js', 'wallet.js', 'chain.js', 'network.json', 'vendor/ethers.umd.min.js', 'vendor/ethers-LICENSE.md'];
for (const file of files) {
  if (!fs.statSync(path.join(source, file)).isFile()) throw new Error('Missing public asset: ' + file);
}
const config = JSON.parse(fs.readFileSync(path.join(source, 'network.json'), 'utf8'));
if (config.chainId !== 31611 || !/^0x[0-9a-f]{40}$/i.test(config.latchCredit)) throw new Error('Invalid deployed network configuration');
fs.rmSync(target, { recursive: true, force: true });
for (const file of files) {
  const dest = path.join(target, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(source, file), dest);
}
console.log('Public app ready: ' + files.length + ' assets in public-app');
