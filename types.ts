
export type AssetType = 'GOLD' | 'USDT' | 'SAVINGS';

export interface Asset {
  type: AssetType;
  label: string;
  amount: number;
  currentPrice: number;
  targetAllocation: number;
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface PortfolioData {
  assets: Record<AssetType, Asset>;
  monthlyContribution: number;
  telegramConfig: TelegramConfig;
}

export interface MarketPriceUpdate {
  goldPrice: number;
  usdtPrice: number;
  lastUpdated: string;
  sourceNotes?: string;
}
