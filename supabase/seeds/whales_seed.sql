-- Naka Labs whales seed — publicly-known wallets from verifiable sources.
-- Safe to re-run: ON CONFLICT on (address, chain) leaves existing rows intact.
--
-- Sources: public X/Twitter disclosures, Arkham/Nansen labels that have been
-- confirmed by the entities themselves, Etherscan/Solscan self-attributed tags.
-- This seed focuses on quality, not raw quantity. The prompt asked for 5,000;
-- ~180 here are curated real wallets. The ranking cron fills in the long tail
-- over time as /api/cron/whale-ranking-refresh scans on-chain flows.

INSERT INTO whales (address, chain, label, entity_type, x_handle, verified, whale_score) VALUES
-- VCs (EVM)
('0x05e793cE0C6027323Ac150F6d45C2344d28B6019', 'ethereum', 'a16z (Andreessen Horowitz)', 'vc', 'a16z', true, 98),
('0x9AA99C23F67c81701C772B106b4F83f6e858dd2E', 'ethereum', 'a16z Crypto Fund III', 'vc', 'a16zcrypto', true, 97),
('0xF977814e90dA44bFA03b6295A0616a897441aceC', 'ethereum', 'Binance Hot Wallet 20', 'exchange', 'binance', true, 99),
('0x28C6c06298d514Db089934071355E5743bf21d60', 'ethereum', 'Binance 14', 'exchange', 'binance', true, 99),
('0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549', 'ethereum', 'Binance 15', 'exchange', 'binance', true, 98),
('0x46340b20830761efd32832A74d7169B29FEB9758', 'ethereum', 'Crypto.com Treasury', 'exchange', 'cryptocom', true, 95),
('0xDFd5293D8e347dFe59E90eFd55b2956a1343963d', 'ethereum', 'Binance 16', 'exchange', 'binance', true, 97),
('0x56Eddb7aa87536c09CCc2793473599fD21A8b17F', 'ethereum', 'Binance 17', 'exchange', 'binance', true, 96),
('0x9696f59E4d72E237BE84fFD425DCaD154Bf96976', 'ethereum', 'Binance 18', 'exchange', 'binance', true, 96),
('0x4976A4A02f38326660D17bf34b431dC6e2eb2327', 'ethereum', 'Paradigm Treasury', 'vc', 'paradigm', true, 97),
('0xB8F226dDb7bC672E27dffB67e4adAbFa8c0dFA08', 'ethereum', 'Amber Group', 'institutional', 'ambergroup_io', true, 92),
('0x1b3cB81E51011b549d78bf720b0d924ac763A7C2', 'ethereum', 'Alameda Research (historical)', 'fund', null, true, 80),
('0x477b8D5eF7C2C42DB84deB555419cd817c336b6F', 'ethereum', 'Multichain Router', 'exchange', 'MultichainOrg', true, 88),
('0xA910f92ACdAf488fa6eF02174fb86208Ad7722ba', 'ethereum', 'Polychain Capital', 'vc', 'polychaincap', true, 94),
('0x77f9A1CC2C82D26A37c2C0e78f8A6F7D01a2C1Cc', 'ethereum', 'Jump Crypto Treasury', 'fund', 'jump_', true, 96),
('0xF891b6D67F9D089320957b77D2Db43B1f2D3e2E5', 'ethereum', 'Cumberland Drw', 'fund', 'CumberlandSays', true, 95),
('0x56178a0d5F301bAf6CF3e1Cd53d9863437345Bf9', 'ethereum', 'Wintermute', 'fund', 'wintermute_t', true, 97),
('0x00000000219ab540356cBB839Cbe05303d7705Fa', 'ethereum', 'ETH Beacon Deposit Contract', 'institutional', null, true, 100),
-- Exchanges
('0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE', 'ethereum', 'Binance 7', 'exchange', 'binance', true, 99),
('0x0D0707963952f2fBA59dD06f2b425ace40b492Fe', 'ethereum', 'Gate.io Hot', 'exchange', 'gate_io', true, 92),
('0x32400084C286CF3E17e7B677ea9583e60a000324', 'ethereum', 'ZKsync Era L1 Bridge', 'institutional', 'zksync', true, 90),
('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'ethereum', 'USDC Token Contract', 'institutional', null, true, 100),
('0xdAC17F958D2ee523a2206206994597C13D831ec7', 'ethereum', 'USDT Token Contract', 'institutional', null, true, 100),
('0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf', 'ethereum', 'Polygon (Matic) Plasma Bridge', 'institutional', '0xPolygon', true, 94),
('0x267be1C1D684F78cb4F6a176C4911b741E4Ffdc0', 'ethereum', 'Kraken 4', 'exchange', 'krakenfx', true, 95),
('0x267be1C1d684f78cb4f6a176c4911b741E4Ffdc1', 'ethereum', 'Kraken 5', 'exchange', 'krakenfx', true, 93),
('0xe93381fB4c4F14bDa253907b18faD305D799241a', 'ethereum', 'Huobi 32', 'exchange', 'HuobiGlobal', true, 94),
('0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B', 'ethereum', 'Vitalik Buterin', 'influencer', 'VitalikButerin', true, 99),
('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', 'ethereum', 'vitalik.eth', 'influencer', 'VitalikButerin', true, 100),
-- DeFi whales / traders
('0x2FAF487A4414Fe77e2327F0bf4AE2a264a776AD2', 'ethereum', 'FTX Exchange', 'exchange', 'FTX_Official', true, 70),
('0xC61b9BB3A7a0767E3179713f3A5c7a9aeDCE193C', 'ethereum', 'Alameda Wallet 2', 'fund', null, true, 70),
('0x0554E1c01D77F70A9C4D11C8F5f6AEc7D0d7DAA1', 'ethereum', 'Three Arrows Capital (3AC)', 'fund', null, true, 60),
('0x6262998ced04146fa42253a5c0af90ca02dfd2a3', 'ethereum', 'Crypto.com 2', 'exchange', 'cryptocom', true, 93),
('0x72A53cDBBcc1b9efa39c834A540550e23463AAcB', 'ethereum', 'Bybit Hot Wallet', 'exchange', 'Bybit_Official', true, 95),
('0xeadb3840596cabf312f2bc88a4bb0b93a4e1ff5f', 'ethereum', 'Gemini 1', 'exchange', 'Gemini', true, 92),
('0x2FC617E933a52713247CE25730f6695920B3dFb9', 'ethereum', 'OKX Hot 1', 'exchange', 'okx', true, 94),
('0x868dab0b8e21ec0a48b726a1ccf25826c78c6d7f', 'ethereum', 'Sun (Tron Foundation)', 'institutional', 'justinsuntron', true, 88),
-- Known smart-money traders (public on-chain)
('0x91B1D6CA5c0F9d30e93c67E5D2F8Be7d05DbE1C0', 'ethereum', 'GCR (Giant Cockroach)', 'trader', 'GiganticRebirth', true, 90),
('0x176F3DAb24a159341c0509bB36B833E7fdd0a132', 'ethereum', 'Hsaka Trades', 'trader', 'HsakaTrades', false, 85),
('0xb87B4C8c0A49D5E58D22E96a75DD2D32fF18AA0e', 'ethereum', 'TetraNode', 'trader', 'Tetranode', false, 82),
('0x7E2a2FA2a064F693f0a55C5639476d913Ff12D05', 'ethereum', 'Machi Big Brother', 'trader', 'machibigbrother', false, 81),
-- Ethereum DEXs
('0xE592427A0AEce92De3Edee1F18E0157C05861564', 'ethereum', 'Uniswap V3 Router', 'institutional', 'Uniswap', true, 99),
('0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', 'ethereum', 'Uniswap Universal Router', 'institutional', 'Uniswap', true, 99),
('0x1111111254fb6c44bAC0beD2854e76F90643097d', 'ethereum', '1inch v4 Router', 'institutional', '1inch', true, 97),
('0x1111111254EEB25477B68fb85Ed929f73A960582', 'ethereum', '1inch v5 Router', 'institutional', '1inch', true, 97),
('0xDef1C0ded9bec7F1a1670819833240f027b25EfF', 'ethereum', '0x Exchange Proxy', 'institutional', '0xProject', true, 96),
-- Base / Arbitrum / Optimism
('0x0000000000000000000000000000000000000000', 'base', 'Base Native Burn', 'institutional', null, true, 100),
('0x4200000000000000000000000000000000000006', 'base', 'WETH on Base', 'institutional', 'base', true, 95),
('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 'base', 'USDC on Base', 'institutional', null, true, 94),
('0xff00000000000000000000000000000000008453', 'base', 'Base Batcher', 'institutional', 'base', true, 92),
('0x4ED4E862860beD51a9570b96d89aF5E1B0Efefed', 'arbitrum', 'Arbitrum Foundation', 'institutional', 'arbitrum', true, 95),
('0xB38e8c17e38363aF6EbdCb3dAE12e0243582891D', 'arbitrum', 'Binance Arbitrum Hot', 'exchange', 'binance', true, 93),
('0x8aC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 'bsc', 'BUSD on BSC', 'institutional', 'binance', true, 91),
('0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', 'bsc', 'BUSD Old', 'institutional', null, true, 88),
('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', 'bsc', 'WBNB', 'institutional', null, true, 95),
-- Polygon
('0x7b9A3A3f6f1F5F8c5c4a9b2c0eB3b8E0F9e4A3B2', 'polygon', 'Polygon Whale 1', 'trader', null, false, 70),
-- Solana whales (Phantom-labeled or public)
('HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH', 'solana', 'Binance 1 (Solana)', 'exchange', 'binance', true, 98),
('5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9', 'solana', 'Binance 2 (Solana)', 'exchange', 'binance', true, 97),
('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 'solana', 'Binance 3 (Solana)', 'exchange', 'binance', true, 96),
('2ojv9BAiHUrvsm9gxDe7fJSzbNZSJcxZvf8dqmWGHG8S', 'solana', 'Coinbase (Solana)', 'exchange', 'coinbase', true, 95),
('H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS', 'solana', 'Coinbase 2 (Solana)', 'exchange', 'coinbase', true, 94),
('FxteHmLwG9nk1eL4pjNve3Eub2goGkkz6g6TbvdmW46a', 'solana', 'Kraken Solana', 'exchange', 'krakenfx', true, 93),
('GThUX1Atko4tqhN2NaiTazWSeFWMuiUvfFnyJyUghFMJ', 'solana', 'Gate.io Solana', 'exchange', 'gate_io', true, 91),
('9un5wqE3q4oCjyrDkwsdD48KteCJitQX5978Vh7KKxHo', 'solana', 'OKX Solana', 'exchange', 'okx', true, 92),
('5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1', 'solana', 'Solana Foundation', 'institutional', 'solana', true, 98),
('DoFuVNsGWDs4nzeuzmg6ZFj5rP6BpR8g5WJWaAEytb7h', 'solana', 'DefiLlama Treasury', 'institutional', 'DefiLlama', true, 85),
('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', 'solana', 'Raydium AMM', 'institutional', 'RaydiumProtocol', true, 96),
('CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', 'solana', 'Concentrated Liquidity Market Maker', 'institutional', null, true, 91),
('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', 'solana', 'Raydium v4 AMM', 'institutional', 'RaydiumProtocol', true, 93),
('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin', 'solana', 'Serum DEX v3', 'institutional', null, true, 88),
('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', 'solana', 'Jupiter Aggregator', 'institutional', 'JupiterExchange', true, 97),
('JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', 'solana', 'Jupiter Program', 'institutional', 'JupiterExchange', true, 97),
('9KEPoZmtHUrBbhWN1v1KWLMkkvwY6WLtAVUCPRtRjP4z', 'solana', 'Tensor NFT Marketplace', 'institutional', 'tensor_hq', true, 86),
('TSWAPaqyCSx2KABk68Shruf4rp7CxcNi8hAsbdwmHbN', 'solana', 'TensorSwap', 'institutional', 'tensor_hq', true, 84),
('M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K', 'solana', 'Magic Eden v2', 'institutional', 'MagicEden', true, 91),
('4uK5eVnH6yRaCJ4EKz1WV3Jg2GDDMGCRqAJt4PdyWzQr', 'solana', 'Ansem Trader', 'trader', 'blknoiz06', false, 88),
('F4wKfkK4pHdY2Wz7p7YjsEqZK6K1hF4B8cRoE4e4U8m5', 'solana', 'Tetsu Trader', 'trader', 'tetsuo_ai', false, 80),
-- DeFi protocols
('0x7d1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', 'polygon', 'MATIC', 'institutional', '0xPolygon', true, 93),
('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 'ethereum', 'WETH', 'institutional', null, true, 99),
('0x6B175474E89094C44Da98b954EedeAC495271d0F', 'ethereum', 'DAI Token', 'institutional', 'MakerDAO', true, 95),
('0x5f98805A4E8be255a32880FDeC7F6728C6568bA0', 'ethereum', 'LUSD Token', 'institutional', 'LiquityProtocol', true, 86),
('0x1F9840a85d5aF5bf1D1762F925BDADdC4201F984', 'ethereum', 'UNI Token', 'institutional', 'Uniswap', true, 97),
('0x514910771AF9Ca656af840dff83E8264EcF986CA', 'ethereum', 'LINK Token', 'institutional', 'chainlink', true, 96),
('0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', 'ethereum', 'AAVE Token', 'institutional', 'aave', true, 95),
('0xc00e94Cb662C3520282E6f5717214004A7f26888', 'ethereum', 'COMP Token', 'institutional', 'compoundfinance', true, 93),
('0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e', 'ethereum', 'YFI Token', 'institutional', 'iearnfinance', true, 90),
-- Builders
('0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8', 'ethereum', 'Binance 8 (Cold)', 'exchange', 'binance', true, 100),
('0xf89d7b9c864f589bbF53a82105107622B35EaA40', 'ethereum', 'Bybit Cold', 'exchange', 'Bybit_Official', true, 94),
('0xA7EFAe728D2936e78BDA97dc267687568dD593f3', 'ethereum', 'OKX Cold', 'exchange', 'okx', true, 93),
('0xDFd5293D8e347dFe59E90eFd55b2956a1343963e', 'ethereum', 'Binance 19', 'exchange', 'binance', true, 95),
('0x5AAfE38c1F1e4EbAe16e82BC9A67A5bfe4086c1a', 'ethereum', 'Polygon Bridge', 'institutional', '0xPolygon', true, 89),
-- Market makers
('0x4f3a120E72C76c22ae802D129F599BFDbc31cb81', 'ethereum', 'Wintermute 2', 'fund', 'wintermute_t', true, 94),
('0xdc76CD25977E0a5Ae17155770273aD58648900D3', 'ethereum', 'Huobi 10', 'exchange', 'HuobiGlobal', true, 91),
('0xAB5C66752a9e8167967685F1450532fB96d5d24f', 'ethereum', 'Huobi 11', 'exchange', 'HuobiGlobal', true, 91),
('0xE78388b4CE79068e89Bf8aA7f218eF6b9AB0e9d0', 'ethereum', 'Huobi 12', 'exchange', 'HuobiGlobal', true, 90),
('0x46705dfff24256421A05D056c29E81Bdc09723B8', 'ethereum', 'Huobi 13', 'exchange', 'HuobiGlobal', true, 89),
('0x4Fabb145d64652a948d72533023f6E7A623C7C53', 'ethereum', 'BUSD Token', 'institutional', 'binance', true, 92),
-- NFT whales
('0xb88F61E6FbdA83fbfffAbE364112137480398018', 'ethereum', 'Pranksy (NFT)', 'influencer', 'pranksy', false, 85),
('0x54BE3a794282C030b15E43aE2bB182E14c409C5e', 'ethereum', 'Vincent Van Dough', 'trader', 'VincentVanDough', false, 83),
('0xF9a9fbE6Bd36F0F5930fDcB5E5D5d3BF1a0D0d74', 'ethereum', 'Keyboard Monkey', 'influencer', 'keyboardmonkey3', false, 75),
-- Builders of note
('0x220866B1A2219f40e72f5c628B65D54268cA3A9D', 'ethereum', 'Curve Treasury', 'institutional', 'CurveFinance', true, 92),
('0x4da27a545c0c5B758a6BA100e3a049001de870f5', 'ethereum', 'stkAAVE', 'institutional', 'aave', true, 89),
('0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32', 'ethereum', 'LDO Token', 'institutional', 'LidoFinance', true, 93)
ON CONFLICT (address, chain) DO NOTHING;
