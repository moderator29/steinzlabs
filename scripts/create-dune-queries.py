#!/usr/bin/env python3
"""
Create the multi-chain Dune queries and print the DUNE_QUERY_* env values.

WHY THIS SCRIPT: the Claude Code sandbox's network policy blocks api.dune.com,
so the queries can't be created from there. Run this on YOUR machine, where your
Dune key works — your key never touches the chat or the sandbox.

USAGE:
    export DUNE_API_KEY=dqk_...            # your Dune API key (kept local)
    python3 scripts/create-dune-queries.py

    # dry run — just prints what it would create, no API calls:
    python3 scripts/create-dune-queries.py --dry-run

It reads the SQL straight from docs/dune-multichain-queries.md (single source of
truth), creates one Dune query per block via the CRUD API, and prints, for each,
the Vercel env line to paste, e.g.:

    DUNE_QUERY_SMART_MONEY=1234567

REQUIREMENTS:
- A Dune plan that includes the CRUD Query API (Plus or higher). On the free
  plan, create-query returns 402/403 — in that case just paste each SQL block
  into a new query on dune.com manually and copy the ID from the URL.
"""
import json
import os
import re
import sys
import urllib.request
import urllib.error

DOC = os.path.join(os.path.dirname(__file__), "..", "docs", "dune-multichain-queries.md")
API = "https://api.dune.com/api/v1/query"

# The 5 ```sql blocks in the doc, in order, mapped to a name + the env var the
# app reads (app/api/cron/dune-refresh/route.ts).
TARGETS = [
    ("Naka — Smart Money Score (multichain)",       "DUNE_QUERY_SMART_MONEY"),
    ("Naka — Smart Money Token Flow (multichain)",  "DUNE_QUERY_SMART_MONEY_FLOW"),
    ("Naka — Wash Trade Score (multichain)",        "DUNE_QUERY_WASH_TRADE"),
    ("Naka — Cluster Aggregates (multichain)",      "DUNE_QUERY_CLUSTER_AGGREGATES"),
    ("Naka — MEV Loss Aggregate (multichain)",      "DUNE_QUERY_MEV_LOSS"),
]


def extract_sql_blocks(md_path):
    with open(md_path, "r", encoding="utf-8") as fh:
        text = fh.read()
    blocks = re.findall(r"```sql\n(.*?)```", text, re.DOTALL)
    return [b.strip() for b in blocks]


def create_query(api_key, name, sql):
    body = json.dumps({"name": name, "query_sql": sql, "is_private": False}).encode()
    req = urllib.request.Request(
        API, data=body, method="POST",
        headers={"X-Dune-API-Key": api_key, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode())
    # Dune returns {"query_id": <int>}
    return data.get("query_id") or data.get("queryId")


def main():
    dry = "--dry-run" in sys.argv
    sql_blocks = extract_sql_blocks(DOC)
    if len(sql_blocks) < len(TARGETS):
        print(f"ERROR: found {len(sql_blocks)} sql blocks in the doc, need {len(TARGETS)}.", file=sys.stderr)
        sys.exit(1)

    key = os.environ.get("DUNE_API_KEY", "")
    if not dry and not key:
        print("ERROR: set DUNE_API_KEY first (export DUNE_API_KEY=dqk_...).", file=sys.stderr)
        sys.exit(1)

    print("\n# Paste these into Vercel → Settings → Environment Variables")
    print("# (Production + Preview), then redeploy.\n")

    results = []
    for (name, env_var), sql in zip(TARGETS, sql_blocks):
        if dry:
            print(f"[dry-run] would create '{name}'  ({len(sql)} chars of SQL)  -> {env_var}")
            continue
        try:
            qid = create_query(key, name, sql)
            print(f"{env_var}={qid}")
            results.append((env_var, qid))
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:300]
            print(f"# FAILED {env_var}: HTTP {e.code} {detail}", file=sys.stderr)
            if e.code in (401, 402, 403):
                print("#   → key invalid, or your Dune plan lacks the CRUD Query API.\n"
                      "#     Paste this query's SQL block into dune.com manually and copy the ID.",
                      file=sys.stderr)
        except Exception as e:  # noqa: BLE001
            print(f"# FAILED {env_var}: {e}", file=sys.stderr)

    if results and not dry:
        print(f"\n# Created {len(results)}/{len(TARGETS)} queries. "
              "Set the vars above and redeploy; the dune-refresh cron ingests all chains next run.")


if __name__ == "__main__":
    main()
