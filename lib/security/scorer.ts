/**
 * Central risk scorer used by /api/security/* routes.
 * Input is the raw GoPlus token/address/approval response; output is a
 * normalized 0–100 score + level + reasons array. Same thresholds used
 * by the cron security-monitor and the copy-trade execute endpoint so
 * the user never sees divergent risk grades between surfaces.
 */

export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  reasons: string[];
  sections: Record<string, { ok: boolean; detail?: string }>;
}

export function scoreTokenSecurity(raw: Record<string, unknown>): RiskAssessment {
  let score = 100;
  const reasons: string[] = [];
  const sections: RiskAssessment["sections"] = {};

  // Honeypot
  const isHoneypot = raw.isHoneypot === true || raw.is_honeypot === "1" || raw.is_honeypot === 1;
  sections.honeypot = { ok: !isHoneypot, detail: isHoneypot ? "Token is flagged as a honeypot" : "No honeypot pattern detected" };
  if (isHoneypot) { score -= 60; reasons.push("honeypot"); }

  // Tax
  const buyTax = Number(raw.buyTax ?? raw.buy_tax ?? 0);
  const sellTax = Number(raw.sellTax ?? raw.sell_tax ?? 0);
  sections.tax = {
    ok: buyTax <= 10 && sellTax <= 10,
    detail: `Buy ${(buyTax * 100).toFixed(1)}% / Sell ${(sellTax * 100).toFixed(1)}%`,
  };
  if (buyTax > 10) { score -= 15; reasons.push(`buy_tax_${buyTax}`); }
  if (sellTax > 10) { score -= 15; reasons.push(`sell_tax_${sellTax}`); }

  // Ownership
  const isMintable = raw.isMintable === true || raw.is_mintable === "1";
  const ownerCanChangeBalance = raw.ownerCanChangeBalance === true || raw.owner_change_balance === "1";
  const ownerRenounced = raw.owner_address === "0x0000000000000000000000000000000000000000";
  sections.ownership = {
    ok: !isMintable && !ownerCanChangeBalance,
    detail: ownerRenounced
      ? "Owner renounced"
      : isMintable
        ? "Owner can mint new supply"
        : ownerCanChangeBalance
          ? "Owner can mutate balances"
          : "Owner retained, no hazardous powers",
  };
  if (isMintable) { score -= 15; reasons.push("mintable"); }
  if (ownerCanChangeBalance) { score -= 25; reasons.push("owner_balance_mutable"); }

  // Trading restrictions
  const cannotBuy = raw.cannot_buy === "1" || raw.cannotBuy === true;
  const cannotSellAll = raw.cannot_sell_all === "1" || raw.cannotSellAll === true;
  const tradingCooldown = raw.trading_cooldown === "1" || raw.tradingCooldown === true;
  sections.tradingRestrictions = {
    ok: !cannotBuy && !cannotSellAll && !tradingCooldown,
    detail:
      cannotBuy ? "Buys are blocked" :
      cannotSellAll ? "Cannot sell full balance" :
      tradingCooldown ? "Trading cooldown enforced" : "No trading restrictions",
  };
  if (cannotBuy) { score -= 40; reasons.push("buy_blocked"); }
  if (cannotSellAll) { score -= 35; reasons.push("cannot_sell_all"); }
  if (tradingCooldown) { score -= 10; reasons.push("trading_cooldown"); }

  // Liquidity
  const isInDex = raw.is_in_dex === "1" || raw.isInDex === true;
  const totalSupply = Number(raw.total_supply ?? raw.totalSupply ?? 0);
  sections.liquidity = { ok: isInDex, detail: isInDex ? "Listed on at least one DEX" : "Not listed on a tracked DEX" };
  if (!isInDex) { score -= 20; reasons.push("not_in_dex"); }

  // Holder distribution
  const holderCount = Number(raw.holder_count ?? raw.holderCount ?? 0);
  const lpHolderCount = Number(raw.lp_holder_count ?? raw.lpHolderCount ?? 0);
  sections.holders = {
    ok: holderCount >= 100,
    detail: `${holderCount.toLocaleString()} holders · ${lpHolderCount} LP holders${totalSupply ? ` · supply ${totalSupply.toLocaleString()}` : ""}`,
  };
  if (holderCount < 50) { score -= 15; reasons.push("low_holder_count"); }

  // Contract code
  const isOpenSource = raw.is_open_source === "1" || raw.isOpenSource === true;
  const isProxy = raw.is_proxy === "1" || raw.isProxy === true;
  sections.contractCode = {
    ok: isOpenSource && !isProxy,
    detail: `${isOpenSource ? "Verified source" : "Source unverified"}${isProxy ? " · upgradeable proxy" : ""}`,
  };
  if (!isOpenSource) { score -= 10; reasons.push("source_unverified"); }
  if (isProxy) { score -= 5; reasons.push("upgradeable_proxy"); }

  // Similar scam match
  const similar = raw.other_potential_risks ?? raw.note;
  sections.similarScams = {
    ok: !similar,
    detail: similar ? String(similar).slice(0, 200) : "No similar scam signatures matched",
  };
  if (similar) { score -= 10; reasons.push("similar_scam_match"); }

  score = Math.max(0, Math.min(100, score));
  const level: RiskLevel =
    score >= 85 ? "safe" : score >= 65 ? "low" : score >= 40 ? "medium" : score >= 20 ? "high" : "critical";
  return { score, level, reasons, sections };
}

export function scoreAddressSecurity(raw: Record<string, unknown>): RiskAssessment {
  let score = 100;
  const reasons: string[] = [];
  const sections: RiskAssessment["sections"] = {};

  const isScam = raw.isScam === true || raw.data_source === "SCAMMER";
  const isBlacklisted = raw.isBlacklisted === true || raw.blacklist_doubt === "1";
  const isSanctioned = raw.sanctioned === true || raw.is_sanctioned === "1";
  const isPhishing = raw.phishing_activities === "1" || raw.isPhishing === true;

  sections.scam = { ok: !isScam, detail: isScam ? "Flagged as scam source" : "No scam reports" };
  sections.blacklist = { ok: !isBlacklisted, detail: isBlacklisted ? "Blacklisted by registries" : "Not blacklisted" };
  sections.sanctions = { ok: !isSanctioned, detail: isSanctioned ? "Subject to sanctions" : "No sanctions hit" };
  sections.phishing = { ok: !isPhishing, detail: isPhishing ? "Linked to phishing activity" : "No phishing history" };

  if (isScam) { score -= 80; reasons.push("scam_address"); }
  if (isBlacklisted) { score -= 60; reasons.push("blacklisted"); }
  if (isSanctioned) { score -= 80; reasons.push("sanctioned"); }
  if (isPhishing) { score -= 50; reasons.push("phishing"); }

  score = Math.max(0, Math.min(100, score));
  const level: RiskLevel =
    score >= 85 ? "safe" : score >= 65 ? "low" : score >= 40 ? "medium" : score >= 20 ? "high" : "critical";
  return { score, level, reasons, sections };
}
