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
let patched = false;

const PATCHES = [
  {
    name: 'Solana onMount typeof guard',
    old: 'if(d.externalWallets.solana.connectors)return d.externalWallets.solana.connectors.onMount(),()=>d.externalWallets.solana.connectors.onUnmount()',
    new: 'try{if("function"===typeof d.externalWallets?.solana?.connectors?.onMount)return d.externalWallets.solana.connectors.onMount(),()=>{"function"===typeof d.externalWallets?.solana?.connectors?.onUnmount&&d.externalWallets.solana.connectors.onUnmount()}}catch(e){}',
  },
  {
    name: 'Solana onMount typeof guard (already step1 patched)',
    old: 'if("function"===typeof d.externalWallets?.solana?.connectors?.onMount)return d.externalWallets.solana.connectors.onMount(),()=>{"function"===typeof d.externalWallets?.solana?.connectors?.onUnmount&&d.externalWallets.solana.connectors.onUnmount()}',
    new: 'try{if("function"===typeof d.externalWallets?.solana?.connectors?.onMount)return d.externalWallets.solana.connectors.onMount(),()=>{"function"===typeof d.externalWallets?.solana?.connectors?.onUnmount&&d.externalWallets.solana.connectors.onUnmount()}}catch(e){}',
  },
  {
    name: 'Solana connectors dependency array optional chain',
    old: '}),[d.externalWallets.solana.connectors])',
    new: '}),[d.externalWallets?.solana?.connectors])',
  },
];

const ALREADY_DONE_MARKER = 'try{if("function"===typeof d.externalWallets?.solana?.connectors?.onMount)';

for (const patch of PATCHES) {
  if (patch.old === ALREADY_DONE_MARKER) continue;
  if (content.includes(patch.old)) {
    content = content.replace(patch.old, patch.new);
    console.log(`[patch-privy] Applied: ${patch.name}`);
    patched = true;
  } else if (content.includes(patch.new)) {
    console.log(`[patch-privy] Already applied: ${patch.name}`);
  } else {
    console.log(`[patch-privy] Pattern not found for: ${patch.name}`);
  }
}

if (patched) {
  fs.writeFileSync(filePath, content);
  console.log('[patch-privy] Wrote patched file');
} else {
  console.log('[patch-privy] No changes needed');
}
