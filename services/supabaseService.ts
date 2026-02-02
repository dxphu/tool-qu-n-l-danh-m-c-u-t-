
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Asset, AssetType, TelegramConfig } from '../types';

const SUPABASE_URL = (process.env as any).SUPABASE_URL;
const SUPABASE_ANON_KEY = (process.env as any).SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '') {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
  }
}

export const fetchPortfolioFromSupabase = async (): Promise<{ assets: Record<AssetType, Partial<Asset>> | null, telegram: TelegramConfig | null }> => {
  if (!supabase) return { assets: null, telegram: null };

  try {
    const { data: assetData } = await supabase.from('portfolio_assets').select('*');
    const { data: configData } = await supabase.from('app_settings').select('*').eq('key', 'telegram_config').single();

    const assets: any = {};
    assetData?.forEach((row) => {
      assets[row.asset_type] = {
        amount: row.amount,
        currentPrice: row.current_price,
      };
    });

    return { 
      assets: Object.keys(assets).length > 0 ? assets : null, 
      telegram: configData ? configData.value : null 
    };
  } catch (e) {
    console.error("Error fetching from Supabase:", e);
    return { assets: null, telegram: null };
  }
};

export const saveAssetToSupabase = async (asset: Asset) => {
  if (!supabase) return;
  try {
    await supabase.from('portfolio_assets').upsert({
      asset_type: asset.type,
      amount: asset.amount,
      current_price: asset.currentPrice,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'asset_type' });
  } catch (e) { console.error(e); }
};

export const saveTelegramConfigToSupabase = async (config: TelegramConfig) => {
  if (!supabase) return;
  try {
    await supabase.from('app_settings').upsert({
      key: 'telegram_config',
      value: config,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' });
  } catch (e) { console.error(e); }
};

export const saveAllAssetsToSupabase = async (assets: Record<AssetType, Asset>) => {
  if (!supabase) return;
  const promises = Object.values(assets).map(asset => saveAssetToSupabase(asset));
  await Promise.all(promises);
};
