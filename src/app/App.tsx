import { useEffect, useState } from 'react';
import axios from 'axios';
import { StockCard } from './components/StockCard';

import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { TrendingUp, Calendar as CalendarIcon, ChevronDown, Copy } from 'lucide-react';
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
  change5d?: number;
  bias20?: number;
  hasFutures?: boolean;
  kline: any[];
  trend: any[];
}

// 模擬K線和走勢資料 (因為後端目前只有單日或少量交易資料，趨勢圖仍需模擬)
// 模擬K線和走勢資料 (因為後端目前只有單日或少量交易資料，趨勢圖仍需模擬)
const generateMockVisuals = (basePrice: number, dateStr?: string) => {
  const klineData = [];
  let currentPrice = basePrice;
  // Use provided date or fallback to today
  const anchorDate = dateStr ? parseISO(dateStr) : new Date();

  // Generate 60 days of K-Lines
  const days = 60;

  // Create a longer buffer for MA calc (60 + 60 = 120)
  const totalDays = days + 60;
  const historyPrices: number[] = [];

  // Generate backwards from today
  for (let i = totalDays - 1; i >= 0; i--) {
    const date = new Date(anchorDate);
    date.setDate(anchorDate.getDate() - i); // Simple day subtraction (ignoring weekends for mock)

    // Simple random walk
    const vol = basePrice * 0.03;
    const openPrice = currentPrice + (Math.random() - 0.5) * vol;
    const closePrice = openPrice + (Math.random() - 0.5) * vol;
    const highPrice = Math.max(openPrice, closePrice) + Math.random() * (vol * 0.5);
    const lowPrice = Math.min(openPrice, closePrice) - Math.random() * (vol * 0.5);

    historyPrices.push(closePrice);

    // Only push to klineData if within the last `days`
    if (i < days) {
      const ma = (n: number) => {
        if (historyPrices.length < n) return null;
        const slice = historyPrices.slice(-n);
        return slice.reduce((a, b) => a + b, 0) / n;
      };

      klineData.push({
        date: `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`,
        open: openPrice,
        close: closePrice,
        high: highPrice,
        low: lowPrice,
        ma5: ma(5),
        ma20: ma(20),
        ma60: ma(60)
      });
    }
    currentPrice = closePrice;
  }

  return { kline: klineData, trend: [], lastPrice: klineData[klineData.length - 1].close };
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
            change5d: item.change_5d,
            bias20: item.bias_20,
            hasFutures: item.has_futures,
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
      <div className="max-w-md md:max-w-7xl mx-auto">
        {/* 標題 */}
        <div className="bg-white shadow-sm p-4 sticky top-0 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" />
            <h1 className="text-gray-900 font-bold">台股成交值排行</h1>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                const btn = e.currentTarget;
                const originalText = btn.innerHTML;

                // Helper to format a table
                const formatTable = (title: string, data: StockData[]) => {
                  const headers = ["排名", "代號", "名稱", "收盤價", "漲跌", "幅度%", "成交值(億)", "週轉率%", "5日漲幅", "20日乖離"];
                  const rows = data.map((s, i) => [
                    i + 1,
                    s.code,
                    s.name,
                    s.price,
                    s.change,
                    s.changePercent + '%',
                    s.volume.toFixed(2),
                    (s.turnoverRate ?? 'N/A') + '%',
                    typeof s.change5d === 'number' ? s.change5d.toFixed(1) + '%' : 'N/A',
                    typeof s.bias20 === 'number' ? s.bias20.toFixed(1) + '%' : 'N/A'
                  ].join('\t'));
                  return [title, headers.join('\t'), ...rows].join('\n');
                };

                const text = [
                  formatTable("市場: 上市 (TWSE)", listedStocks),
                  "",
                  formatTable("市場: 上櫃 (TPEx)", otcStocks)
                ].join('\n');

                navigator.clipboard.writeText(text).then(() => {
                  btn.innerText = "已複製!";
                  setTimeout(() => {
                    // Restore icon and text using simpler logic since we can't easily reference original JSX here without more state
                    // But actually, simpler is to just hardcode restoration
                    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy w-3.5 h-3.5 mr-1"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>複製數據`;
                  }, 2000);
                });
              }}
              className="h-9 px-3 text-xs flex items-center bg-white"
            >
              <Copy className="w-3.5 h-3.5 mr-1" />
              複製數據
            </Button>

            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
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
        {/* Content Area */}
        <div className="p-4">

          {/* Mobile Tabs Controller (Hidden on Desktop) */}
          <Tabs defaultValue="listed" className="w-full md:hidden">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="listed" className="flex-1">上市成交值</TabsTrigger>
              <TabsTrigger value="otc" className="flex-1">上櫃成交值</TabsTrigger>
            </TabsList>

            <TabsContent value="listed">
              {loading ? <div className="text-center p-4">載入中...</div> : (
                <div className="space-y-4">
                  <Heatmap data={listedStocks} title="上市成交值熱力圖" />
                  <div className="space-y-3">
                    {listedStocks.map((stock, index) => (
                      <StockCard key={stock.code} rank={index + 1} {...stock} />
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="otc">
              {loading ? <div className="text-center p-4">載入中...</div> : (
                <div className="space-y-4">
                  <Heatmap data={otcStocks} title="上櫃成交值熱力圖" />
                  <div className="space-y-3">
                    {otcStocks.map((stock, index) => (
                      <StockCard key={stock.code} rank={index + 1} {...stock} />
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Desktop Dual Column Layout (Hidden on Mobile) */}
          <div className="hidden md:grid grid-cols-2 gap-6">
            {/* Left Column: TWSE */}
            <div>
              <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
                <span className="w-2 h-6 bg-blue-600 rounded-sm"></span>
                上市成交值排行
              </h2>
              {loading ? <div className="text-center p-10">資料載入中...</div> : (
                <div className="space-y-4">
                  <Heatmap data={listedStocks} title="上市熱力圖" />
                  <div className="space-y-3">
                    {listedStocks.map((stock, index) => (
                      <StockCard key={stock.code} rank={index + 1} {...stock} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: OTC */}
            <div>
              <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
                <span className="w-2 h-6 bg-green-600 rounded-sm"></span>
                上櫃成交值排行
              </h2>
              {loading ? <div className="text-center p-10">資料載入中...</div> : (
                <div className="space-y-4">
                  <Heatmap data={otcStocks} title="上櫃熱力圖" />
                  <div className="space-y-3">
                    {otcStocks.map((stock, index) => (
                      <StockCard key={stock.code} rank={index + 1} {...stock} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 說明 */}
          <div className="mt-6 text-center text-gray-400 text-xs">
            * 資料來源：本地資料庫 (模擬/TWSE)
          </div>
        </div>
      </div>


    </div>
  );
}