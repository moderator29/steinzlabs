# Vercel Cron Schedule — Pending Pro Upgrade

Removed from repo root 2026-04-17 because Vercel Hobby plan does not allow sub-daily crons.
Restore `vercel.json` at the repo root with the JSON below after upgrading to Vercel Pro.

```json
{
  "crons": [
    { "path": "/api/cron/context-feed-poll", "schedule": "*/2 * * * *" },
    { "path": "/api/cron/whale-activity-poll", "schedule": "*/1 * * * *" },
    { "path": "/api/cron/smart-money-ranking", "schedule": "0 */6 * * *" },
    { "path": "/api/cron/cluster-analysis", "schedule": "0 */6 * * *" },
    { "path": "/api/cron/network-metrics", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/trends-aggregator", "schedule": "*/2 * * * *" },
    { "path": "/api/cron/narrative-detection", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/fear-greed-index", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/alert-monitor", "schedule": "*/1 * * * *" },
    { "path": "/api/cron/market-stats-snapshot", "schedule": "*/30 * * * *" },
    { "path": "/api/cron/daily-digest", "schedule": "0 9 * * *" }
  ]
}
```

Endpoint handlers remain in `app/api/cron/*/route.ts`. They are callable manually or via external scheduler in the meantime. Also set `CRON_SECRET` in Vercel env vars before re-enabling.
