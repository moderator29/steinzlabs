import 'server-only';

/**
 * Tornado Cash sanctioned-pool address registry. Sourced from the OFAC
 * SDN list (https://www.treasury.gov/ofac/downloads/sdnlist.txt) and
 * Chainalysis published Tornado entries. Any wallet that has ever
 * deposited into / withdrawn from one of these pools is considered
 * Tornado-adjacent for the network graph's adjacency-flag overlay.
 */

const ETH_POOLS = new Set<string>([
  // ETH pools
  '0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc', // 0.1 ETH
  '0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936', // 1 ETH
  '0x910cbd523d972eb0a6f4cae4618ad62622b39dbf', // 10 ETH
  '0xa160cdab225685da1d56aa342ad8841c3b53f291', // 100 ETH
  // DAI
  '0xd4b88df4d29f5cedd6857912842cff3b20c8cfa3',
  '0xfd8610d20aa15b7b2e3be39b396a1bc3516c7144',
  '0x07687e702b410fa43f4cb4af7fa097918ffd2730',
  // USDC
  '0xd96f2b1c14db8458374d9aca76e26c3d18364307',
  '0x4736dcf1b7a3d580672ccce6213cdb35c1e69a55',
  // USDT
  '0x169ad27a470d064dede56a2d3ff727986b15d52b',
  '0x0836222f2b2b24a3f36f98668ed8f0b38d1a872f',
]);

/**
 * True when the given address is a Tornado Cash sanctioned pool itself
 * (deposits/withdraws touch it directly).
 */
export function isTornadoPool(address: string): boolean {
  return ETH_POOLS.has(address.toLowerCase());
}

/**
 * Given a set of edges (any shape with from/to), return the addresses
 * that are 1-hop adjacent to a Tornado pool. Used by the network graph
 * to flag adjacency on rendering.
 */
export function tornadoAdjacentSet(
  edges: Array<{ source: string; target: string; sourceAddress?: string; targetAddress?: string }>,
  addressOf: (nodeId: string) => string | undefined = () => undefined,
): Set<string> {
  const adjacent = new Set<string>();
  for (const e of edges) {
    const src = e.sourceAddress ?? addressOf(e.source);
    const tgt = e.targetAddress ?? addressOf(e.target);
    if (src && isTornadoPool(tgt ?? '')) adjacent.add(src);
    if (tgt && isTornadoPool(src ?? '')) adjacent.add(tgt);
  }
  return adjacent;
}
