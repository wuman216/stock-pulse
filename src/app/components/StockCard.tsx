import { LineChart, Line, Tooltip, ComposedChart, Bar, XAxis, YAxis } from 'recharts';
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
  kline: KLineData[];
  trend: TrendData[];
}

export function StockCard({ rank, code, name, price, change, changePercent, volume, kline, trend }: StockCardProps) {
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
            <div className="flex items-center gap-2">
              <span className="text-gray-900">{code}</span>
              <span className="text-gray-600">{name}</span>
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
          <div className="text-xs text-gray-500">成交值</div>
          <div className="text-gray-900">{volume.toFixed(2)}億</div>
        </div>
      </div>

      {/* K線和走勢圖 */}
      <div className="space-y-3 mt-4">
        {/* 10日K線 */}
        <div>
          <div className="text-xs text-gray-500 mb-2">10日K線</div>
          <ComposedChart
            width={320}
            height={100}
            data={klineChartData}
            margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
          >
            <YAxis
              domain={['dataMin', 'dataMax']}
              hide
            />
            <XAxis dataKey="day" hide />
            <Bar
              dataKey="priceRange"
              shape={<CustomBar />}
              isAnimationActive={false}
            />
            <Tooltip
              contentStyle={{ fontSize: '11px', padding: '4px 8px' }}
              formatter={(value: any, name: string, props: any) => {
                const { payload } = props;
                return [
                  `開:${payload.open.toFixed(2)} 高:${payload.high.toFixed(2)} 低:${payload.low.toFixed(2)} 收:${payload.close.toFixed(2)}`,
                  ''
                ];
              }}
              labelFormatter={(label, payload) => payload && payload[0] ? payload[0].payload.date : label}
            />
          </ComposedChart>
        </div>

        {/* 30日走勢 */}
        <div>
          <div className="text-xs text-gray-500 mb-2">近30日走勢</div>
          <LineChart width={320} height={80} data={trend} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <YAxis
              type="number"
              domain={[(min: number) => min, (max: number) => max]}
              hide
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
              formatter={(value: number) => [`$${value.toFixed(2)}`, '價格']}
              labelFormatter={(label, payload) => payload && payload[0] ? payload[0].payload.date : label}
            />
          </LineChart>
        </div>
      </div>
    </div>
  );
}