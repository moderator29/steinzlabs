/**
 * Telegram bot end-to-end diagnostic. Calls Telegram's own getMe,
 * getWebhookInfo and getMyCommands endpoints server-side (the bot token
 * never leaves the server) and returns a summary so we can immediately
 * tell:
 *   - Is the bot token valid?
 *   - Is the webhook URL registered with Telegram?
 *   - Is the webhook secret set and matching what our route expects?
 *   - Are there any pending-updates or recent webhook errors?
 *   - Are the bot commands registered with Telegram's command menu?
 *
 * Run when users report "the bot doesn't respond" — the pending-updates
 * count + last_error_message field are usually the smoking gun.
 *
 * Auth: admin-only, same gate as the whale verifier.
 *
 * Usage:
 *   curl "https://nakalabs.xyz/api/admin/telegram/diagnose" \
 *     -H "x-migration-secret: <ADMIN_MIGRATION_SECRET>"
 */
import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthenticatedUser } from '@/lib/auth/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authorized(req: NextRequest): Promise<boolean> {
  const headerSecret = req.headers.get('x-migration-secret');
  if (headerSecret && process.env.ADMIN_MIGRATION_SECRET && headerSecret === process.env.ADMIN_MIGRATION_SECRET) {
    return true;
  }
  const user = await getAuthenticatedUser(req);
  if (!user) return false;
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  return data?.role === 'admin';
}

async function tg(token: string, method: string, body?: unknown): Promise<any> {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const res = await fetch(url, body ? {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  } : undefined);
  const data = await res.json();
  return { ok: res.ok && data.ok, status: res.status, result: data.result, description: data.description };
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  const env = {
    TELEGRAM_BOT_TOKEN: token ? `set (${token.slice(0, 8)}…)` : 'MISSING',
    TELEGRAM_WEBHOOK_SECRET: webhookSecret ? `set (${webhookSecret.length} chars)` : 'MISSING',
    TELEGRAM_BOT_USERNAME: botUsername || 'MISSING',
    NEXT_PUBLIC_APP_URL: appUrl || 'MISSING',
  };

  if (!token) {
    return NextResponse.json({
      ok: false,
      error: 'TELEGRAM_BOT_TOKEN not set in env',
      env,
      fix: 'Add TELEGRAM_BOT_TOKEN from @BotFather to Vercel environment variables and redeploy.',
    });
  }

  const [me, webhookInfo, commands] = await Promise.all([
    tg(token, 'getMe'),
    tg(token, 'getWebhookInfo'),
    tg(token, 'getMyCommands'),
  ]);

  // Supabase-side counts for context
  const supabase = getSupabaseAdmin();
  const { count: totalLinks } = await supabase
    .from('user_telegram_links')
    .select('*', { count: 'exact', head: true });
  const { count: completedLinks } = await supabase
    .from('user_telegram_links')
    .select('*', { count: 'exact', head: true })
    .not('telegram_chat_id', 'is', null);

  const expectedWebhookUrl = appUrl ? `${appUrl}/api/telegram/webhook` : '(NEXT_PUBLIC_APP_URL not set)';
  const actualWebhookUrl = webhookInfo.result?.url || '(none registered)';
  const webhookMatches = actualWebhookUrl === expectedWebhookUrl;

  const diagnosis: string[] = [];
  if (!me.ok) diagnosis.push('❌ getMe failed — bot token is invalid or revoked');
  else diagnosis.push(`✅ Bot authenticated as @${me.result.username} (id ${me.result.id})`);

  if (!webhookInfo.result?.url) diagnosis.push('❌ No webhook registered with Telegram — bot will never receive messages');
  else if (!webhookMatches) diagnosis.push(`⚠️  Webhook points to ${actualWebhookUrl} but app expects ${expectedWebhookUrl}`);
  else diagnosis.push(`✅ Webhook registered correctly`);

  if (webhookInfo.result?.last_error_message) {
    diagnosis.push(`❌ Last webhook error: ${webhookInfo.result.last_error_message} (${new Date((webhookInfo.result.last_error_date ?? 0) * 1000).toISOString()})`);
  }
  if (webhookInfo.result?.pending_update_count > 0) {
    diagnosis.push(`⚠️  ${webhookInfo.result.pending_update_count} pending updates queued — webhook may be failing`);
  }
  if (!webhookInfo.result?.has_custom_certificate && webhookInfo.result?.url) {
    // Fine — Telegram only requires a cert if self-signed
  }
  if (webhookInfo.result?.ip_address) {
    diagnosis.push(`ℹ️  Webhook IP: ${webhookInfo.result.ip_address}`);
  }

  const secretMatchesExpected = webhookSecret
    ? `set server-side; Telegram stores it out of band (not returned by API). If messages aren't being processed, check that your webhook registration used the same value.`
    : 'WEBHOOK_SECRET not set — webhook route accepts all incoming POSTs in dev mode, which is insecure for prod.';

  if (!commands.ok || !commands.result?.length) {
    diagnosis.push('⚠️  No bot commands registered with Telegram — the menu under the text input will be empty.');
  } else {
    diagnosis.push(`✅ ${commands.result.length} commands registered with Telegram menu`);
  }

  return NextResponse.json({
    ok: me.ok && webhookMatches,
    env,
    bot: me.result ?? null,
    webhook: {
      registered: !!webhookInfo.result?.url,
      matchesApp: webhookMatches,
      url: actualWebhookUrl,
      expected: expectedWebhookUrl,
      pendingUpdates: webhookInfo.result?.pending_update_count ?? 0,
      lastErrorDate: webhookInfo.result?.last_error_date
        ? new Date(webhookInfo.result.last_error_date * 1000).toISOString()
        : null,
      lastErrorMessage: webhookInfo.result?.last_error_message ?? null,
      maxConnections: webhookInfo.result?.max_connections ?? null,
      allowedUpdates: webhookInfo.result?.allowed_updates ?? null,
      secretStatus: secretMatchesExpected,
    },
    commands: commands.result ?? [],
    dbState: {
      totalLinks: totalLinks ?? 0,
      completedLinks: completedLinks ?? 0,
    },
    diagnosis,
  });
}

/**
 * POST resets the webhook — registers it fresh with Telegram's servers,
 * binding the webhook secret. Use this when diagnose shows "no webhook
 * registered" or the URL doesn't match.
 */
export async function POST(req: NextRequest) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nakalabs.xyz';

  if (!token) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN missing' }, { status: 500 });
  }

  const url = `${appUrl}/api/telegram/webhook`;
  const setResult = await tg(token, 'setWebhook', {
    url,
    secret_token: webhookSecret || undefined,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true,
  });

  // Also register the command menu so users see them in the Telegram UI
  const commandResult = await tg(token, 'setMyCommands', {
    commands: [
      { command: 'start', description: 'Get started' },
      { command: 'help', description: 'Show all commands' },
      { command: 'link', description: 'Link your Naka account: /link <code>' },
      { command: 'unlink', description: 'Disconnect your Naka account' },
      { command: 'status', description: 'Check your plan + link status' },
      { command: 'price', description: 'Token price: /price ETH' },
      { command: 'watchlist', description: 'Open your watchlist' },
      { command: 'alerts', description: 'Recent alerts' },
      { command: 'whale', description: 'Wallet snapshot (Mini+)' },
      { command: 'portfolio', description: 'Your portfolio (Mini+)' },
      { command: 'copy', description: 'Copy trading (Pro+)' },
      { command: 'snipe', description: 'Sniper bot (Max)' },
      { command: 'vtx', description: 'Ask VTX AI anything' },
    ],
  });

  return NextResponse.json({
    setWebhook: setResult,
    setMyCommands: commandResult,
    registeredAt: url,
  });
}
