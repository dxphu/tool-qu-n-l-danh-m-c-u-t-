
import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  Wallet, 
  RefreshCcw, 
  Bell, 
  Send, 
  Info,
  ChevronRight,
  Loader2,
  CloudOff,
  Settings,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { AssetType, PortfolioData, Asset, TelegramConfig } from './types';
import { fetchMarketPrices, generateTelegramReport } from './services/geminiService';
import { fetchPortfolioFromSupabase, saveAssetToSupabase, saveAllAssetsToSupabase, saveTelegramConfigToSupabase } from './services/supabaseService';
import { sendTelegramMessage } from './services/telegramService';
import { CONFIG } from './config';

const COLORS = ['#F59E0B', '#3B82F6', '#10B981'];

const App: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [isCloudConfigured, setIsCloudConfigured] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>('Chưa cập nhật');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [portfolio, setPortfolio] = useState<PortfolioData>({
    monthlyContribution: CONFIG.MONTHLY_CONTRIBUTION,
    telegramConfig: { 
      botToken: CONFIG.DEFAULT_BOT_TOKEN, 
      chatId: CONFIG.DEFAULT_CHAT_ID 
    },
    assets: {
      GOLD: { type: 'GOLD', label: 'Vàng DOJI', amount: 0.5, currentPrice: 85000000, targetAllocation: CONFIG.DEFAULT_ALLOCATION },
      USDT: { type: 'USDT', label: 'USDT Binance', amount: 1700, currentPrice: 25400, targetAllocation: CONFIG.DEFAULT_ALLOCATION },
      SAVINGS: { type: 'SAVINGS', label: 'Tiết kiệm VND', amount: 45000000, currentPrice: 1, targetAllocation: CONFIG.DEFAULT_ALLOCATION }
    }
  });

  useEffect(() => {
    const init = async () => {
      try {
        if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) { 
          setIsCloudConfigured(false); 
          return; 
        }

        setSyncing(true);
        const { assets, telegram } = await fetchPortfolioFromSupabase();
        
        setPortfolio(prev => {
          const newAssets = { ...prev.assets };
          if (assets) {
            (Object.keys(assets) as AssetType[]).forEach(type => {
              if (newAssets[type]) {
                newAssets[type].amount = assets[type].amount ?? newAssets[type].amount;
                newAssets[type].currentPrice = assets[type].currentPrice ?? newAssets[type].currentPrice;
              }
            });
          }
          return { 
            ...prev, 
            assets: newAssets,
            telegramConfig: telegram || prev.telegramConfig 
          };
        });
      } catch (error) {
        console.error("Initialization failed:", error);
        setStatusMsg({ type: 'error', text: 'Không thể kết nối cơ sở dữ liệu. Đang dùng dữ liệu cục bộ.' });
      } finally {
        setSyncing(false);
      }
    };
    init();
  }, []);

  const portfolioStats = useMemo(() => {
    const goldValue = portfolio.assets.GOLD.amount * portfolio.assets.GOLD.currentPrice;
    const usdtValue = portfolio.assets.USDT.amount * portfolio.assets.USDT.currentPrice;
    const savingsValue = portfolio.assets.SAVINGS.amount;
    const total = goldValue + usdtValue + savingsValue;

    const data = [
      { name: 'Vàng', value: goldValue, actualPct: total > 0 ? (goldValue / total) * 100 : 0 },
      { name: 'USDT', value: usdtValue, actualPct: total > 0 ? (usdtValue / total) * 100 : 0 },
      { name: 'Tiết kiệm', value: savingsValue, actualPct: total > 0 ? (savingsValue / total) * 100 : 0 },
    ];

    const alerts: string[] = [];
    data.forEach(item => {
      const targetPct = (CONFIG.DEFAULT_ALLOCATION * 100);
      const deviation = Math.abs(item.actualPct - targetPct);
      if (deviation > (CONFIG.REBALANCE_THRESHOLD * 100)) {
        alerts.push(`⚠️ ${item.name} lệch ${(item.actualPct).toFixed(1)}% (Mục tiêu ${targetPct.toFixed(1)}%) - Cần tái cân bằng!`);
      }
    });

    return { total, data, alerts };
  }, [portfolio]);

  const handleUpdatePrices = async () => {
    setPricesLoading(true);
    setSyncing(true);
    try {
      const result = await fetchMarketPrices();
      const updatedAssets = {
        ...portfolio.assets,
        GOLD: { ...portfolio.assets.GOLD, currentPrice: result.goldPrice },
        USDT: { ...portfolio.assets.USDT, currentPrice: result.usdtPrice },
      };
      setPortfolio(prev => ({ ...prev, assets: updatedAssets }));
      await saveAllAssetsToSupabase(updatedAssets);
      setLastUpdate(result.lastUpdated);
      setStatusMsg({ type: 'success', text: 'Cập nhật giá thành công!' });
    } catch (error) { 
      console.error(error); 
      setStatusMsg({ type: 'error', text: 'Lỗi cập nhật giá. Vui lòng kiểm tra API Key.' });
    } finally { 
      setPricesLoading(false); 
      setSyncing(false); 
    }
  };

  const handleManualEdit = async (type: AssetType, field: 'amount' | 'currentPrice', val: number) => {
    const updatedAsset = { ...portfolio.assets[type], [field]: val };
    setPortfolio(prev => ({ ...prev, assets: { ...prev.assets, [type]: updatedAsset } }));
    setSyncing(true);
    await saveAssetToSupabase(updatedAsset);
    setSyncing(false);
  };

  const handleTelegramConfigChange = async (field: keyof TelegramConfig, val: string) => {
    const newConfig = { ...portfolio.telegramConfig, [field]: val };
    setPortfolio(prev => ({ ...prev, telegramConfig: newConfig }));
    setSyncing(true);
    await saveTelegramConfigToSupabase(newConfig);
    setSyncing(false);
  };

  const handleGenerateReport = async () => {
    setLoading(true);
    setReportText(null);
    try {
      const report = await generateTelegramReport(portfolio, portfolioStats.alerts);
      setReportText(report);
    } catch (error) { 
      console.error(error);
      setStatusMsg({ type: 'error', text: 'Không thể tạo báo cáo. Vui lòng thử lại.' });
    } finally { 
      setLoading(false); 
    }
  };

  const handleSendToTelegram = async () => {
    if (!reportText) return;
    setSendingTelegram(true);
    setStatusMsg(null);
    try {
      const result = await sendTelegramMessage(portfolio.telegramConfig, reportText);
      setStatusMsg({ type: result.success ? 'success' : 'error', text: result.message });
    } catch (error) {
      setStatusMsg({ type: 'error', text: 'Có lỗi xảy ra khi gửi tin nhắn.' });
    } finally {
      setSendingTelegram(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-[#f8fafc]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <TrendingUp size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">WealthBalance AI</h1>
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1 text-[10px] font-bold ${!isCloudConfigured ? 'text-slate-400' : syncing ? 'text-amber-500' : 'text-emerald-500'}`}>
                  {syncing ? <Loader2 size={10} className="animate-spin" /> : !isCloudConfigured ? <CloudOff size={10} /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                  {!isCloudConfigured ? 'Chế độ Local' : syncing ? 'Đang lưu Cloud...' : 'Đã đồng bộ Cloud'}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
            >
              <Settings size={20} className={showSettings ? 'text-indigo-600' : ''} />
            </button>
            <button 
              onClick={handleUpdatePrices}
              disabled={pricesLoading || (syncing && isCloudConfigured)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-semibold hover:bg-indigo-100 transition-colors disabled:opacity-50"
            >
              {pricesLoading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCcw size={16} />}
              <span className="hidden sm:inline">Cập nhật giá Live</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {showSettings && (
            <section className="bg-white border border-indigo-100 rounded-2xl p-6 shadow-sm ring-4 ring-indigo-50">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <ShieldCheck size={20} className="text-indigo-600" />
                Cấu hình Telegram Bot
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Bot Token</label>
                  <input 
                    type="password"
                    placeholder="123456:ABC-DEF..."
                    value={portfolio.telegramConfig.botToken}
                    onChange={(e) => handleTelegramConfigChange('botToken', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">Chat ID</label>
                  <input 
                    type="text"
                    placeholder="654321..."
                    value={portfolio.telegramConfig.chatId}
                    onChange={(e) => handleTelegramConfigChange('chatId', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </section>
          )}

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-start mb-4">
                <span className="p-2 bg-slate-100 rounded-lg text-slate-600">
                  <Wallet size={20} />
                </span>
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Tổng tài sản</span>
              </div>
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                {portfolioStats.total.toLocaleString()} <span className="text-lg font-normal text-slate-400">VND</span>
              </h2>
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                <Info size={14} />
                <span>Cập nhật: {lastUpdate}</span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-center min-h-[160px]">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={portfolioStats.data} innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value">
                    {portfolioStats.data.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => value.toLocaleString() + ' VND'} />
                </PieChart>
              </ResponsiveContainer>
              <div className="ml-4 space-y-1">
                {portfolioStats.data.map((item, idx) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx] }}></div>
                    <span className="font-semibold text-slate-600">{item.name}:</span>
                    <span className="text-slate-900 font-bold">{item.actualPct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {portfolioStats.alerts.length > 0 ? (
            <section className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-orange-500 rounded-lg text-white"><Bell size={20} /></div>
                <h3 className="text-lg font-bold text-orange-900">Cảnh báo Tái cân bằng</h3>
              </div>
              <ul className="space-y-2">
                {portfolioStats.alerts.map((alert, i) => (
                  <li key={i} className="flex items-center gap-2 text-orange-800 text-sm font-medium">
                    <ChevronRight size={14} /> {alert}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex items-center gap-4">
              <div className="p-2 bg-emerald-500 rounded-lg text-white"><CheckCircle2 size={20} /></div>
              <div>
                <h3 className="font-bold text-emerald-900">Danh mục ổn định</h3>
                <p className="text-sm text-emerald-700">Tỷ trọng tài sản đang ở mức lý tưởng.</p>
              </div>
            </section>
          )}

          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Quản lý Số dư</h3>
              <p className="text-[10px] font-bold text-indigo-500 uppercase">Target: {(CONFIG.DEFAULT_ALLOCATION * 100).toFixed(1)}% Mỗi loại</p>
            </div>
            <div className="divide-y divide-slate-50">
              {(Object.values(portfolio.assets) as Asset[]).map((asset) => (
                <div key={asset.type} className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="min-w-[120px]">
                    <h4 className="font-bold text-slate-900">{asset.label}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                      {asset.type === 'GOLD' ? 'Lượng vàng' : asset.type === 'USDT' ? 'Số lượng USDT' : 'Tiền tiết kiệm'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 sm:gap-6 flex-1 justify-end">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 block uppercase">Số lượng</label>
                      <input 
                        type="number"
                        value={asset.amount}
                        onChange={(e) => handleManualEdit(asset.type, 'amount', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-sm font-medium focus:border-indigo-500 outline-none"
                      />
                    </div>
                    {asset.type !== 'SAVINGS' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 block uppercase">Giá (VND)</label>
                        <input 
                          type="number"
                          value={asset.currentPrice}
                          onChange={(e) => handleManualEdit(asset.type, 'currentPrice', parseInt(e.target.value) || 0)}
                          className="w-28 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-sm font-medium focus:border-indigo-500 outline-none"
                        />
                      </div>
                    )}
                    <div className="text-right min-w-[100px]">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Thành tiền</p>
                      <p className="text-sm font-bold text-slate-900">{(asset.amount * asset.currentPrice).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-100">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <Send size={18} /> Gửi báo cáo Daily
            </h3>
            <p className="text-indigo-100 text-xs mb-6 leading-relaxed">
              Gemini AI sẽ quét danh mục và gửi phân tích trực tiếp qua Telegram của bạn.
            </p>
            <button 
              onClick={handleGenerateReport}
              disabled={loading}
              className="w-full py-3 bg-white text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 mb-3"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <RefreshCcw size={18} />}
              {reportText ? 'Tạo lại báo cáo' : 'Phân tích & Soạn tin'}
            </button>

            {reportText && (
              <button 
                onClick={handleSendToTelegram}
                disabled={sendingTelegram || !portfolio.telegramConfig.botToken}
                className="w-full py-3 bg-indigo-500 text-white border border-indigo-400 rounded-xl font-bold hover:bg-indigo-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {sendingTelegram ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                Gửi ngay Telegram
              </button>
            )}
          </section>

          {statusMsg && (
            <div className={`p-4 rounded-xl flex items-start gap-3 border ${statusMsg.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
              {statusMsg.type === 'success' ? <CheckCircle2 size={18} className="shrink-0" /> : <AlertCircle size={18} className="shrink-0" />}
              <p className="text-sm font-medium">{statusMsg.text}</p>
            </div>
          )}

          {reportText && (
            <section className="bg-slate-900 rounded-2xl p-6 text-slate-300 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Preview Tin Nhắn</span>
                <button 
                  onClick={() => { navigator.clipboard.writeText(reportText); alert("Copied!"); }}
                  className="text-indigo-400 text-[10px] font-bold hover:underline"
                >
                  COPY TEXT
                </button>
              </div>
              <div className="text-[13px] whitespace-pre-wrap leading-relaxed font-mono bg-slate-800/50 p-4 rounded-xl border border-slate-700 max-h-[400px] overflow-y-auto">
                {reportText}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
