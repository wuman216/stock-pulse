import { LineChart, Line, ComposedChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

interface KLineData {
  open: number;
  close: number;
  high: number;
  low: number;
}

interface TrendData {
  day: number;
  price: number;
}

interface StockRowProps {
  code: string;
  name: string;
  price: number;
  volume: number;
  kline: KLineData;
  trend: TrendData[];
}

export function StockRow({ code, name, price, volume, kline, trend }: StockRowProps) {
  const isRising = kline.close >= kline.open;
  const changePercent = ((kline.close - kline.open) / kline.open * 100).toFixed(2);

  // K线图数据
  const klineData = [{
    name: '今日',
    high: kline.high,
    low: kline.low,
    open: kline.open,
    close: kline.close,
    body: [Math.min(kline.open, kline.close), Math.max(kline.open, kline.close)]
  }];

  return (
    <div className="grid grid-cols-[100px_150px_120px_120px_150px_200px] gap-4 items-center py-4 px-6 border-b hover:bg-gray-50 transition-colors">
      {/* 股票代号 */}
      <div>
        <div className="text-gray-900">{code}</div>
      </div>

      {/* 股票名称 */}
      <div>
        <div className="text-gray-900">{name}</div>
      </div>

      {/* 现价和涨跌幅 */}
      <div>
        <div className={isRising ? 'text-red-600' : 'text-green-600'}>
          ${price.toFixed(2)}
        </div>
        <div className={`text-sm ${isRising ? 'text-red-500' : 'text-green-500'}`}>
          {isRising ? '+' : ''}{changePercent}%
        </div>
      </div>

      {/* 成交值（亿） */}
      <div>
        <div className="text-gray-900">{volume.toFixed(2)}亿</div>
      </div>

      {/* 今日K线 */}
      <div className="flex justify-center">
        <ComposedChart width={120} height={60} data={klineData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <Bar 
            dataKey="body" 
            fill={isRising ? '#dc2626' : '#16a34a'} 
            barSize={30}
          />
          <Bar 
            dataKey="high" 
            fill="transparent"
            stroke={isRising ? '#dc2626' : '#16a34a'}
            strokeWidth={1}
            barSize={1}
          />
          <Bar 
            dataKey="low" 
            fill="transparent"
            stroke={isRising ? '#dc2626' : '#16a34a'}
            strokeWidth={1}
            barSize={1}
          />
        </ComposedChart>
      </div>

      {/* 10天走势 */}
      <div className="flex justify-center">
        <LineChart width={180} height={60} data={trend} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <Line 
            type="monotone" 
            dataKey="price" 
            stroke={isRising ? '#dc2626' : '#16a34a'} 
            strokeWidth={2}
            dot={false}
          />
          <Tooltip 
            contentStyle={{ fontSize: '12px' }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, '价格']}
          />
        </LineChart>
      </div>
    </div>
  );
}
