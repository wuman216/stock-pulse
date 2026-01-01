import { useMemo } from 'react';
import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';

interface StockData {
    code: string;
    name: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number; // Billions
    turnoverRate?: number | string;
}

interface HeatmapProps {
    data: StockData[];
    title: string;
}

// Helper to get color based on change percentage (Standard Market Heatmap)
const getTrendColor = (change: number) => {
    // Taiwan Market: Red = Up, Green = Down
    // Range: -10% (Deep Green) <-> 0% (Gray) <-> 10% (Deep Red)

    // Limits
    if (change >= 9.5) return '#7f1d1d'; // Red 900
    if (change <= -9.5) return '#14532d'; // Green 900

    if (change > 0) {
        // Red Scale
        if (change > 7) return '#991b1b'; // Red 800
        if (change > 5) return '#b91c1c'; // Red 700
        if (change > 3) return '#dc2626'; // Red 600
        if (change > 1) return '#ef4444'; // Red 500
        return '#f87171'; // Red 400
    } else if (change < 0) {
        // Green Scale
        if (change < -7) return '#166534'; // Green 800
        if (change < -5) return '#15803d'; // Green 700
        if (change < -3) return '#16a34a'; // Green 600
        if (change < -1) return '#22c55e'; // Green 500
        return '#4ade80'; // Green 400
    }

    return '#6b7280'; // Gray 500 (Unchanged)
};

const CustomContent = (props: any) => {
    const { x, y, width, height, name, changePercent, price, volume, turnoverRate, code } = props;

    // Use Trend Color based on Change %
    const bgColor = getTrendColor(Number(changePercent) || 0);

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: bgColor,
                    stroke: '#fff',
                    strokeWidth: 2,
                }}
            />
            {/* Only show text if box is large enough */}
            {width > 40 && height > 30 && (
                <foreignObject x={x} y={y} width={width} height={height}>
                    <div className="h-full w-full flex flex-col items-center justify-center text-white p-1 text-center leading-tight overflow-hidden">
                        <div className="font-bold text-xs sm:text-sm">{code} {name}</div>
                        {height > 50 && (
                            <>
                                <div className="text-xs font-mono">${price}</div>
                                <div className={`text-xs ${Number(changePercent) >= 0 ? 'text-red-100' : 'text-green-100'}`}>
                                    {Number(changePercent) > 0 ? '+' : ''}{changePercent}%
                                </div>
                            </>
                        )}
                    </div>
                </foreignObject>
            )}
        </g>
    );
};

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white p-3 border border-gray-200 shadow-lg rounded text-sm text-gray-800 z-50">
                <div className="font-bold mb-1">{data.code} {data.name}</div>
                <div>價格: ${data.price}</div>
                <div className={data.changePercent >= 0 ? 'text-red-600' : 'text-green-600'}>
                    漲跌幅: {data.changePercent > 0 ? '+' : ''}{data.changePercent}%
                </div>
                <div>成交值: {(Number(data.volume) || 0).toFixed(1)}億</div>
                <div>週轉率: {data.turnoverRate ?? 'N/A'}%</div>
            </div>
        );
    }
    return null;
};

export const Heatmap = ({ data, title }: HeatmapProps) => {
    // Only take top 10 for heatmap as requested to fill space better and avoid clutter
    const top10Data = useMemo(() => data.slice(0, 10), [data]);

    const chartData = useMemo(() => {
        return [
            {
                name: 'Market',
                children: top10Data.map(s => ({
                    ...s,
                    size: s.volume,
                    value: s.volume // Treemap uses 'value' to calculate area size
                }))
            }
        ];
    }, [top10Data]);

    const totalVolume = useMemo(() => {
        const sum = data.reduce((acc, curr) => acc + curr.volume, 0);
        return sum.toFixed(1);
    }, [data]);

    if (data.length === 0) return null;

    return (
        <div className="p-4 bg-white mb-4 rounded-lg shadow-sm border border-gray-100">
            <div className="flex justify-between items-end mb-2">
                <h2 className="text-lg font-bold text-gray-800">{title} (Top 10)</h2>
                <span className="text-sm text-gray-500">總成交值: <span className="font-mono text-gray-900 font-bold ml-1">{totalVolume} 億</span></span>
            </div>

            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                        data={chartData}
                        dataKey="value"
                        stroke="#fff"
                        isAnimationActive={false}
                        content={<CustomContent />}
                    >
                        <Tooltip content={<CustomTooltip />} />
                    </Treemap>
                </ResponsiveContainer>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-2">
                    <span>漲跌幅顏色:</span>
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-green-800 rounded"></div>
                        <span>跌 (-10%)</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-gray-400 rounded"></div>
                        <span>平 (0%)</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-red-800 rounded"></div>
                        <span>漲 (+10%)</span>
                    </div>
                </div>
                <div>* 面積=成交值</div>
            </div>
        </div>
    );
};
