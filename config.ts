
export const CONFIG = {
  gemini: {
    model: 'gemini-3-flash-preview',
  },
  supabase: {
    url: (process.env as any).SUPABASE_URL || '',
    anonKey: (process.env as any).SUPABASE_ANON_KEY || '',
  },
  portfolio: {
    monthlyContribution: 12000000,
    defaultAllocation: 1 / 3,
    rebalanceThreshold: 0.05, // 5%
  },
  telegram: {
    // Các giá trị mặc định nếu cần
    defaultBotToken: '',
    defaultChatId: '',
  }
};
