import { useEffect, useState } from 'react';
import axios from 'axios';
import { StockCard } from './components/StockCard';
import { ChatBox } from './components/ChatBox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { TrendingUp, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { Heatmap } from './components/Heatmap';
import { Popover, PopoverContent, PopoverTrigger } from './components/ui/popover';
import { Calendar } from './components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { Button } from './components/ui/button';
import { cn } from './components/ui/utils';

interface StockData {
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  turnoverRate?: string | number;
  kline: any[];
  trend: any[];
}

// 模擬K線和走勢資料 (因為後端目前只有單日或少量交易資料，趨勢圖仍需模擬)
const generateMockVisuals = (basePrice: number, dateStr?: string) => {
  const klineData = [];
  let currentPrice = basePrice;
  // Use provided date or fallback to today
  const anchorDate = dateStr ? parseISO(dateStr) : new Date();

  for (let i = 9; i >= 0; i--) {
    const date = new Date(anchorDate);
    date.setDate(anchorDate.getDate() - i);

    // Simple random walk
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
    const date = new Date(anchorDate);
    date.setDate(anchorDate.getDate() - i);
    currentPrice = currentPrice + (Math.random() - 0.5) * (basePrice * 0.03);
    trend.push({
      date: `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`,
      price: currentPrice
    });
  }

  return { kline: klineData, trend, lastPrice: klineData[klineData.length - 1].close };
};

export default function App() {
  const [listedStocks, setListedStocks] = useState<StockData[]>([]);
  const [otcStocks, setOtcStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataDate, setDataDate] = useState<string>('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Fetch available dates on mount
  useEffect(() => {
    const fetchDates = async () => {
      try {
        const res = await axios.get('/api/available-dates');
        if (res.data && res.data.data) {
          const dates = res.data.data;
          setAvailableDates(dates);
          if (dates.length > 0) {
            setSelectedDate(dates[0]); // Default to latest
          }
        }
      } catch (err) {
        console.error("Error fetching dates:", err);
      }
    };
    fetchDates();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedDate && availableDates.length > 0) return; // Wait for initial date

      setLoading(true);
      try {
        const params = selectedDate ? { date: selectedDate } : {};
        const [resListed, resOtc] = await Promise.all([
          axios.get('/api/top10?market=TWSE', { params }),
          axios.get('/api/top10?market=TPEx', { params })
        ]);

        const listedData = resListed.data?.data || [];
        const otcData = resOtc.data?.data || [];

        // Attempt to find the date from the response if not explicitly set
        const dateSource = listedData[0] || otcData[0];
        if (dateSource && dateSource.date) {
          setDataDate(dateSource.date.replace(/-/g, '/'));
        }

        const transform = (data: any[]) => data.map(item => {
          let kline = item.kline;
          let trend = item.trend;

          if (!kline || kline.length === 0) {
            const visuals = generateMockVisuals(item.close_price, item.date);
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
            turnoverRate: item.turnover_rate || 'N/A',
            kline: kline,
            trend: trend
          };
        });

        setListedStocks(transform(listedData).slice(0, 20)); // Limit to Top 20 as requested
        setOtcStocks(transform(otcData).slice(0, 20));
      } catch (error) {
        console.error("Error fetching data:", error);
        setListedStocks([]);
        setOtcStocks([]);
      } finally {
        setLoading(false);
      }
    };

    if (selectedDate || (availableDates.length === 0 && loading)) {
      fetchData();
    }
  }, [selectedDate]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto">
        {/* 標題 */}
        <div className="bg-white shadow-sm p-4 sticky top-0 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <h1 className="text-gray-900 font-bold">台股成交值排行</h1>
          </div>

          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant={"outline"}
                  className={cn(
                    "w-[140px] h-9 justify-start text-left font-normal text-xs bg-gray-50 border-gray-200",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5 text-gray-400" />
                  {selectedDate ? format(parseISO(selectedDate), "yyyy/MM/dd") : <span>選擇日期</span>}
                  <ChevronDown className="ml-auto h-3.5 w-3.5 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[100]" align="end" side="bottom">
                <Calendar
                  mode="single"
                  selected={selectedDate ? parseISO(selectedDate) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setSelectedDate(format(date, "yyyy-MM-dd"));
                      setIsCalendarOpen(false);
                    }
                  }}
                  disabled={(date) => {
                    const dateStr = format(date, "yyyy-MM-dd");
                    return !availableDates.includes(dateStr);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
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
                <div className="space-y-4">
                  {/* Heatmap Section */}
                  <Heatmap data={listedStocks} title="上市成交值熱力圖" />

                  {/* List Section */}
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
                        turnoverRate={stock.turnoverRate}
                        kline={stock.kline}
                        trend={stock.trend}
                      />
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="otc">
              {loading ? (
                <div className="text-center p-4">載入中...</div>
              ) : (
                <div className="space-y-4">
                  {/* Heatmap Section */}
                  <Heatmap data={otcStocks} title="上櫃成交值熱力圖" />

                  {/* List Section */}
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
                        turnoverRate={stock.turnoverRate}
                        kline={stock.kline}
                        trend={stock.trend}
                      />
                    ))}
                  </div>
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