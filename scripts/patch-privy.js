const fs = require('fs');
const path = require('path');

const filePath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@privy-io',
  'react-auth',
  'dist',
  'esm',
  'index-Bvw5OxHl.mjs'
);

if (!fs.existsSync(filePath)) {
  console.log('[patch-privy] Privy ESM file not found, skipping patch');
  process.exit(0);
}

let content = fs.readFileSync(filePath, 'utf8');

const oldPattern =
  'if(d.externalWallets.solana.connectors)return d.externalWallets.solana.connectors.onMount(),()=>d.externalWallets.solana.connectors.onUnmount()';
const safePattern =
  'if("function"===typeof d.externalWallets?.solana?.connectors?.onMount)return d.externalWallets.solana.connectors.onMount(),()=>{"function"===typeof d.externalWallets?.solana?.connectors?.onUnmount&&d.externalWallets.solana.connectors.onUnmount()}';

if (content.includes(oldPattern)) {
  content = content.replace(oldPattern, safePattern);
  fs.writeFileSync(filePath, content);
  console.log('[patch-privy] Patched Solana connector onMount check');
} else if (content.includes(safePattern)) {
  console.log('[patch-privy] Already patched');
} else {
  console.log('[patch-privy] Pattern not found - Privy version may have changed');
}
