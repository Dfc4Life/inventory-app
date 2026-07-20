// src/sync.ts
// مزامنة سحابية تلقائية — automatic cloud backup to Supabase

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getDatabaseBuffer } from './db/database';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_BUCKET } from './config';

let client: SupabaseClient | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let lastSyncAt: Date | null = null;
let syncing = false;

const REMOTE_FILE = 'latest.db';

function checkConfigured(): boolean {
  const url: string = SUPABASE_URL;
  const key: string = SUPABASE_ANON_KEY;
  return Boolean(url) && Boolean(key) && url !== 'YOUR_SUPABASE_URL' && url.startsWith('http');
}

function getClient(): SupabaseClient | null {
  if (!checkConfigured()) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

export function getConfigDiagnosis(): string {
  const url: string = SUPABASE_URL;
  const key: string = SUPABASE_ANON_KEY;
  const c1 = Boolean(url);
  const c2 = Boolean(key);
  const c3 = url !== 'YOUR_SUPABASE_URL';
  const c4 = url.startsWith('http');
  const final = c1 && c2 && c3 && c4;
  return [
    `1. url موجود: ${c1}`,
    `2. key موجود: ${c2} (الطول: ${key ? key.length : 0})`,
    `3. url ليس placeholder: ${c3}`,
    `4. url يبدأ بـ http: ${c4}`,
    `5. النتيجة النهائية: ${final}`,
    `url = "${url}"`,
  ].join('\n');
}

export function triggerSync(delayMs = 8000): void {
  if (!checkConfigured()) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { syncNow().catch(() => {}); }, delayMs);
}

export async function syncNow(): Promise<boolean> {
  const supabase = getClient();
  if (!supabase || syncing) return false;
  syncing = true;
  try {
    const buffer = await getDatabaseBuffer();
    const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(REMOTE_FILE, buffer, { contentType: 'application/octet-stream', upsert: true });
    if (error) throw error;
    lastSyncAt = new Date();
    return true;
  } catch (e) {
    return false;
  } finally {
    syncing = false;
  }
}

export function getLastSyncAt(): Date | null { return lastSyncAt; }
export function isSyncConfigured(): boolean { return checkConfigured(); }

export async function syncNowVerbose(): Promise<{ ok: boolean; message: string }> {
  if (!checkConfigured()) {
    return { ok: false, message: getConfigDiagnosis() };
  }
  const supabase = getClient();
  if (!supabase) return { ok: false, message: 'تعذّر إنشاء اتصال Supabase' };
  try {
    const buffer = await getDatabaseBuffer();
    const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(REMOTE_FILE, buffer, { contentType: 'application/octet-stream', upsert: true });
    if (error) throw error;
    lastSyncAt = new Date();
    return { ok: true, message: 'تم الرفع بنجاح ✓' };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}