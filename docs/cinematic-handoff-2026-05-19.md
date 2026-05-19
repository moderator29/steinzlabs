# Cinematic system — current status (2026-05-19)

Concise owner-action checklist. The exhaustive spec lives in `cinematic-system-handoff.md`; this doc tracks **what's actually done on the live system + what's still on you**.

---

## Already executed (verified live)

| Item | Status |
|---|---|
| `phantomfcalls@gmail.com` → `tier=naka_cult`, `is_chosen=true` | ✓ verified via Supabase |
| `regadapol@gmail.com` → `tier=naka_cult`, `is_chosen=true` | ✓ verified |
| `nevo.paul@gmail.com` → `tier=naka_cult`, `is_chosen=true` | ✓ verified |
| `cult_treasury_snapshots` seeded | ✓ 1 row |
| `cult_ambient_tracks` seeded | ✓ 8 rows, all active |
| `/public/branding/badge-naka-cult.png` | ✓ present |
| `/public/sounds/.gitkeep` | ✓ on this branch |
| `/public/audio/.gitkeep` | ✓ on this branch |

NakaCult landing (`/naka-cult`) polish on this branch:
- Live stats strip (members, treasury, NAKA threshold, soundtrack count) — all real numbers from Supabase
- Chambers expanded with concrete feature lists per pillar
- New "Held by sigil, not subscription" 6-card feature grid
- New 6-question FAQ accordion
- Chosen entry card visually distinguished with gold trim
- All new motion respects `prefers-reduced-motion`

---

## Still on you

### 1. Upload 14 sound MP3s into `/public/sounds/`

| File | Duration | Use |
|---|---|---|
| `vault-enter.mp3` | 2.5s | /vault load |
| `vault-exit.mp3` | 1.5s | /vault leave |
| `chamber-conclave.mp3` | 1.2s | Conclave tab open |
| `chamber-oracle.mp3` | 1.2s | Oracle tab open |
| `chamber-sanctum.mp3` | 1.2s | Sanctum tab open |
| `vote-cast.mp3` | 0.4s | Decree vote |
| `decree-pass.mp3` | 2.0s | Passing Decree |
| `decree-fail.mp3` | 1.5s | Failing Decree |
| `seal-open.mp3` | 0.8s | Daily Seal opens |
| `seal-close.mp3` | 0.6s | Daily Seal closes |
| `whisper-incoming.mp3` | 0.4s | DM received |
| `whisper-send.mp3` | 0.3s | DM sent |
| `sigil-unlock.mp3` | 1.8s | Sigil earned |
| `chosen-confirm.mp3` | 2.4s | Chosen granted |

Source: Mixkit / Pixabay / Freesound (CC0 or attribution-free only). Missing files fail silently — no errors.

### 2. Upload 8 music MP3s into `/public/audio/`

DB rows already point at these paths. Verify with:
```sql
SELECT title, artist, storage_path
FROM cult_ambient_tracks
WHERE is_active = true
ORDER BY display_order;
```

The Sanctum Library plays them when present; the Spotify-embed fallback covers you until the files land.

### 3. WalletConnect smoke test (2 min, mobile)

1. https://nakalabs.xyz/login on mobile Safari
2. Tap **Connect with WalletConnect**
3. Confirm Phantom / Rabby launches via deep link
4. Sign the sign-in message
5. Expect to land at `/dashboard` with address visible in top-right

If it hangs at the QR step → `NEXT_PUBLIC_WC_PROJECT_ID` is invalid or rate-limited. Regenerate at https://cloud.walletconnect.com.

### 4. (Optional) Cloudflare Turnstile emergency state

If sign-in is currently broken by a Cloudflare / domain-whitelist issue:
1. Vercel → Environment Variables, set BOTH:
   - `NEXT_PUBLIC_TURNSTILE_BYPASS=1`
   - `TURNSTILE_EMERGENCY_BYPASS=1`
2. Redeploy
3. Login surfaces an amber "Security check temporarily bypassed" banner while bypass is live
4. After Turnstile is healthy: delete both env vars and redeploy

Branch: `fix/turnstile-bypass-clean` (pushed separately).
