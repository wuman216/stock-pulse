import { useEffect, useState } from 'react';
import axios from 'axios';
import { StockCard } from './components/StockCard';
import { ChatBox } from './components/ChatBox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { TrendingUp } from 'lucide-react';

interface StockData {
  code: string;
  name: string;
  price: number;
  volume: number;
  kline: any[];
  trend: any[];
}

// 模擬K線和走勢資料 (因為後端目前只有基本交易資料)
// 模擬K線和走勢資料 (因為後端目前只有單日或少量交易資料，趨勢圖仍需模擬)
const generateMockVisuals = (basePrice: number) => {
  const klineData = [];
  let currentPrice = basePrice;
  const today = new Date(); // Or use the data date

  for (let i = 9; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    // ... logic same ...
    const openPrice = currentPrice + (Math.random() - 0.5) * (basePrice * 0.05); // 5% vol
    const closePrice = openPrice + (Math.random() - 0.5) * (basePrice * 0.05);
    const highPrice = Math.max(openPrice, closePrice) + Math.random() * (basePrice * 0.02);
    const lowPrice = Math.min(openPrice, closePrice) - Math.random() * (basePrice * 0.02);

    klineData.push({
      date: `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`,
      open: openPrice,
      close: closePrice,
      high: highPrice,
      low: lowPrice
    });
    currentPrice = closePrice;
  }

  // Trend
  const trend = [];
  currentPrice = basePrice;
  for (let i = 29; i >= 0; i--) {
    // ... same ...
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    currentPrice = currentPrice + (Math.random() - 0.5) * (basePrice * 0.03);
    trend.push({
      date: `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`,
      price: currentPrice
    });
  }

  return { kline: klineData, trend, lastPrice: klineData[klineData.length - 1].close };
};

interface StockData {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  kline: any[];
  trend: any[];
}

export default function App() {
  const [listedStocks, setListedStocks] = useState<StockData[]>([]);
  const [otcStocks, setOtcStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataDate, setDataDate] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resListed, resOtc] = await Promise.all([
          axios.get('http://localhost:3001/api/top10?market=TWSE'),
          axios.get('http://localhost:3001/api/top10?market=TPEx')
        ]);

        // Attempt to find the date from the first item
        const dateSource = resListed.data.data[0] || resOtc.data.data[0];
        if (dateSource && dateSource.date) {
          setDataDate(dateSource.date.replace(/-/g, '/'));
        }

        const transform = (data: any[]) => data.map(item => {
          let kline = item.kline;
          let trend = item.trend;

          // Fallback to mock if no history (e.g. data insufficient)
          if (!kline || kline.length === 0) {
            const visuals = generateMockVisuals(item.close_price);
            kline = visuals.kline;
            trend = visuals.trend;
          }

          return {
            code: item.stock_code,
            name: item.name,
            price: item.close_price,
            change: item.change || 0,
            changePercent: item.change_percent || 0,
            volume: item.trade_value / 100000000,
            kline: kline,
            trend: trend
          };
        });

        setListedStocks(transform(resListed.data.data));
        setOtcStocks(transform(resOtc.data.data));
        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto">
        {/* 標題 */}
        <div className="bg-white shadow-sm p-4 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <h1 className="text-gray-900">台股成交值排行</h1>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {dataDate || new Date().toLocaleDateString()}
          </div>
        </div>

        {/* Tabs */}
        <div className="p-4">
          <Tabs defaultValue="listed" className="w-full">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="listed" className="flex-1">
                上市成交值
              </TabsTrigger>
              <TabsTrigger value="otc" className="flex-1">
                上櫃成交值
              </TabsTrigger>
            </TabsList>

            <TabsContent value="listed">
              {loading ? (
                <div className="text-center p-4">載入中...</div>
              ) : (
                <div className="space-y-3">
                  {listedStocks.map((stock, index) => (
                    <StockCard
                      key={stock.code}
                      rank={index + 1}
                      code={stock.code}
                      name={stock.name}
                      price={stock.price}
                      change={stock.change}
                      changePercent={stock.changePercent}
                      volume={stock.volume}
                      kline={stock.kline}
                      trend={stock.trend}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="otc">
              {loading ? (
                <div className="text-center p-4">載入中...</div>
              ) : (
                <div className="space-y-3">
                  {otcStocks.map((stock, index) => (
                    <StockCard
                      key={stock.code}
                      rank={index + 1}
                      code={stock.code}
                      name={stock.name}
                      price={stock.price}
                      change={stock.change}
                      changePercent={stock.changePercent}
                      volume={stock.volume}
                      kline={stock.kline}
                      trend={stock.trend}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* 說明 */}
          <div className="mt-6 text-center text-gray-400 text-xs">
            * 資料來源：本地資料庫 (模擬/TWSE)
          </div>
        </div>
      </div>

      {/* AI 聊天助手 */}
      <ChatBox />
    </div>
  );
}