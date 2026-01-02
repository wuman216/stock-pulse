import { LineChart, Line, Tooltip, ComposedChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceArea, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface KLineData {
  date: string;  // MM/DD 格式
  open: number;
  close: number;
  high: number;
  low: number;
}

interface TrendData {
  date: string;  // MM/DD 格式
  price: number;
}

interface StockCardProps {
  rank: number;
  code: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  turnoverRate?: number | string;
  change5d?: number;
  bias20?: number;
  hasFutures?: boolean;
  kline: KLineData[];
  trend: TrendData[];
}

export function StockCard({ rank, code, name, price, change, changePercent, volume, turnoverRate, change5d, bias20, hasFutures, kline, trend }: StockCardProps) {
  // Determine color based on change
  const isRising = change > 0;
  const isFalling = change < 0;

  // Chart logic still uses kline mock data for now
  // 準備K線圖數據
  const klineChartData = kline.map((k, index) => ({
    date: k.date,
    day: index + 1,
    high: k.high,
    low: k.low,
    open: k.open,
    close: k.close,
    priceRange: [k.low, k.high],
    isRising: k.close >= k.open
  }));

  // Calculate custom ticks: Max, Min, Average
  const getTicks = (data: any[], type: 'kline' | 'trend') => {
    if (!data || data.length === 0) return [];
    const isKline = type === 'kline';
    const values = data.map(d => isKline ? d.close : d.price);
    const allHighs = isKline ? data.map(d => d.high) : values;
    const allLows = isKline ? data.map(d => d.low) : values;

    // Safety check for empty arrays or NaNs
    if (allHighs.length === 0) return [];

    const max = Math.max(...allHighs);
    const min = Math.min(...allLows);
    const rawMid = (max + min) / 2;
    const mid = rawMid < 100 ? parseFloat(rawMid.toFixed(1)) : Math.round(rawMid);

    return Array.from(new Set([min, mid, max])).sort((a, b) => a - b);
  };

  const klineTicks = getTicks(kline, 'kline');
  const trendTicks = getTicks(trend, 'trend');

  const CustomBar = (props: any) => {
    const { x, y, width, height, payload } = props;
    const { open, close, high, low, isRising } = payload;
    const barColor = isRising ? '#dc2626' : '#16a34a'; // Red if rising, Green if falling

    // Recharts Bar with dataKey="priceRange" ([low, high]):
    // y = pixel position of 'high'
    // height = pixel height of (high - low) range

    const range = high - low;
    const unitHeight = range === 0 ? 0 : height / range;

    // Calculate relative Y positions from the top (High)
    // Formula: y + (High - Value) * unitHeight
    const openY = y + (high - open) * unitHeight;
    const closeY = y + (high - close) * unitHeight;

    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.max(Math.abs(openY - closeY), 1); // Min 1px height
    const wickX = x + width / 2;

    return (
      <g>
        {/* Wick: High (y) to Low (y + height) */}
        <line x1={wickX} y1={y} x2={wickX} y2={y + height} stroke={barColor} strokeWidth={1} />
        {/* Body: Open to Close */}
        <rect x={x} y={bodyTop} width={width} height={bodyHeight} fill={barColor} />
      </g>
    );
  };

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex-shrink-0">
            {rank}
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-gray-900">{code}</span>
              <span className="text-gray-600">{name}</span>
              {hasFutures && (
                <span className="ml-1 px-1 py-[1px] text-[9px] bg-gray-500 text-white rounded">股期</span>
              )}
            </div>
            <div className="mt-1">
              <span className={`text-lg font-bold ${isRising ? 'text-red-600' : isFalling ? 'text-green-600' : 'text-gray-900'}`}>
                ${price.toFixed(2)}
              </span>
              <span className={`ml-2 text-sm ${isRising ? 'text-red-500' : isFalling ? 'text-green-500' : 'text-gray-500'}`}>
                {change > 0 ? '+' : ''}{change.toFixed(2)} ({changePercent > 0 ? '+' : ''}{changePercent}%)
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="mb-1">
            <div className="text-xs text-gray-500">成交值</div>
            <div className="text-gray-900 font-medium">{volume.toFixed(2)}億</div>
          </div>
          <div className="mb-1">
            <div className="text-xs text-gray-500">週轉率</div>
            <div className={`text-xs font-mono font-medium ${Number(turnoverRate) > 5 ? 'text-red-500' : 'text-gray-700'}`}>
              {turnoverRate ?? 'N/A'}%
            </div>
          </div>
        </div>
      </div>

      {/* Technical Indicators Area */}
      {(typeof change5d === 'number' || typeof bias20 === 'number') && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 mb-4 text-xs text-gray-600 border-t pt-2">
          {typeof change5d === 'number' && (() => {
            let config = { label: '正常', className: 'bg-gray-100 text-gray-700' };
            if (change5d > 25) config = { label: '高風險', className: 'bg-red-600 text-white' };
            else if (change5d > 15) config = { label: '強勢', className: 'bg-orange-600 text-white' };
            else if (change5d > 5) config = { label: '偏強', className: 'bg-orange-400 text-white' };
            else if (change5d < -5) config = { label: '弱勢', className: 'bg-blue-600 text-white' };

            return (
              <div className="flex items-center gap-2">
                <span>5日漲幅:</span>
                <span className={`px-2 py-0.5 rounded font-medium ${config.className}`}>
                  {config.label} {change5d > 0 ? '+' : ''}{change5d.toFixed(1)}%
                </span>
              </div>
            );
          })()}

          {typeof bias20 === 'number' && (() => {
            let config = { label: '正常', className: 'bg-gray-100 text-gray-700' };
            if (bias20 > 15) config = { label: '過熱', className: 'bg-red-600 text-white' };
            else if (bias20 > 10) config = { label: '乖離大', className: 'bg-orange-600 text-white' };
            else if (bias20 > 2) config = { label: '偏多', className: 'bg-orange-400 text-white' };
            else if (bias20 < -5) config = { label: '偏空', className: 'bg-blue-600 text-white' };

            return (
              <div className="flex items-center gap-2">
                <span>20MA乖離:</span>
                <span className={`px-2 py-0.5 rounded font-medium ${config.className}`}>
                  {config.label} {bias20 > 0 ? '+' : ''}{bias20.toFixed(1)}%
                </span>
              </div>
            );
          })()}
        </div>
      )}

      {/* K線和走勢圖 */}
      <div className="space-y-3 mt-4">
        {/* 20日K線 */}
        <div>
          <div className="text-xs text-gray-500 mb-2">20日K線</div>
          <ResponsiveContainer width="100%" height={100}>
            <ComposedChart
              data={klineChartData}
              margin={{ top: 10, right: 0, bottom: 10, left: 0 }}
            >
              <CartesianGrid vertical={false} stroke="#e5e7eb" />
              <YAxis
                domain={[klineTicks[0], klineTicks[klineTicks.length - 1]]}
                ticks={klineTicks}
                orientation="right"
                interval={0}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                width={40}
                axisLine={false}
                tickLine={false}
              />
              <XAxis dataKey="day" hide />
              <Bar
                dataKey="priceRange"
                shape={<CustomBar />}
                isAnimationActive={false}
              />
              <Tooltip
                contentStyle={{ fontSize: '11px', padding: '4px 8px' }}
                formatter={(value: any, name: any, props: any) => {
                  const { payload } = props;
                  return [
                    `開:${payload.open.toFixed(2)} 高:${payload.high.toFixed(2)} 低:${payload.low.toFixed(2)} 收:${payload.close.toFixed(2)}`,
                    ''
                  ];
                }}
                labelFormatter={(label: any, payload: any) => payload && payload[0] ? payload[0].payload.date : label}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* 60日走勢 */}
        <div>
          <div className="text-xs text-gray-500 mb-2">近60日走勢</div>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={trend} margin={{ top: 10, right: 0, bottom: 10, left: 0 }}>
              <CartesianGrid vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="date" hide />
              {kline.length > 0 && (
                <ReferenceArea x1={kline[0].date} x2={kline[kline.length - 1].date} fill="#e5e7eb" fillOpacity={0.5} />
              )}
              <YAxis
                type="number"
                domain={[trendTicks[0], trendTicks[trendTicks.length - 1]]}
                ticks={trendTicks}
                orientation="right"
                interval={0}
                tick={{ fontSize: 10, fill: '#6b7280' }}
                width={40}
                axisLine={false}
                tickLine={false}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke={isRising ? '#dc2626' : '#16a34a'}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Tooltip
                contentStyle={{ fontSize: '12px', padding: '4px 8px' }}
                formatter={(value: any) => [`$${value.toFixed(2)}`, '價格']}
                labelFormatter={(label: any, payload: any) => payload && payload[0] ? payload[0].payload.date : label}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}