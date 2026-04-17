-- Smart Money Wallets seed — 15 well-known on-chain entities
INSERT INTO smart_money_wallets (address, label, chain, tier, pnl_30d, win_rate, total_volume, tags) VALUES
  ('0x28c6c06298d514db089934071355e5743bf21d60', 'Binance Hot Wallet 14',       'ethereum', 'mega',   NULL, NULL, NULL, ARRAY['exchange','cex']),
  ('0x21a31ee1afc51d94c2efccaa2092ad1028285549', 'Binance Hot Wallet 15',       'ethereum', 'mega',   NULL, NULL, NULL, ARRAY['exchange','cex']),
  ('0xDFd5293D8e347dFe59E90eFd55b2956a1343963', 'Binance: Cold Wallet',        'ethereum', 'mega',   NULL, NULL, NULL, ARRAY['exchange','cex','cold']),
  ('0xB5d85CBf7cB3EE0D56b3bB207D5Fc4B82f43F51', 'Coinbase: Prime',             'ethereum', 'large',  NULL, NULL, NULL, ARRAY['exchange','cex']),
  ('0xA090e606E30bD747d4E6245a1517EbE430F0057', 'Jump Trading',                'ethereum', 'large',  185.2, 0.68, 2400000000, ARRAY['mm','fund']),
  ('0x8EB8a3b98659Cce290402893d0123abb75E3ab28', 'Alameda Research (FTX)',      'ethereum', 'mega',   NULL, NULL, NULL, ARRAY['defunct','fund']),
  ('0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503', 'Binance: Deployer',          'ethereum', 'large',  NULL, NULL, NULL, ARRAY['exchange','deployer']),
  ('0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8', 'Binance Cold Wallet 1',      'ethereum', 'mega',   NULL, NULL, NULL, ARRAY['exchange','cold']),
  ('0x9BF4001d307dFd62B26A2F1307ee0C0307632d59', 'DWF Labs',                   'ethereum', 'large',  310.5, 0.72, 890000000, ARRAY['mm','fund']),
  ('0x1db92e2EeBC8E0c075a02BeA49a2935BcD2dFCF', 'Andreessen Horowitz (a16z)',  'ethereum', 'mega',   NULL, NULL, NULL, ARRAY['vc','fund']),
  ('0xE92d1A43df510F82C66382592a047d288f85226f', 'Paradigm VC',                'ethereum', 'mega',   NULL, NULL, NULL, ARRAY['vc','fund']),
  ('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', 'Alameda SOL Wallet',     'solana',   'mega',   NULL, NULL, NULL, ARRAY['defunct','fund']),
  ('3XW2Ah1enCsBTLhFtdMVMeaq3aYxCi63SHqAZQygHY4', 'Multicoin Capital SOL',   'solana',   'large',  220.1, 0.65, 450000000, ARRAY['vc','fund']),
  ('5tzFkiKscXHK5RWxkFNPiQQAoTzEkBOsYDyKjHAjPcUj', 'Paradigm SOL',           'solana',   'large',  NULL, NULL, NULL, ARRAY['vc','fund']),
  ('0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE', 'Binance Hot Wallet 8',       'ethereum', 'large',  NULL, NULL, NULL, ARRAY['exchange','cex'])
ON CONFLICT (address) DO NOTHING;
