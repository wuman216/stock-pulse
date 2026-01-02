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

// Helper to get color based on Turnover Rate
const getTurnoverColor = (rate: number) => {
    // Gradient: Deep Blue -> Light Blue -> Light Red -> Deep Red
    // Represents: Very Cold -> Normal -> Active -> Very Hot

    if (rate <= 1) return '#1e40af'; // Blue 800 (Very Cold)
    if (rate <= 2) return '#3b82f6'; // Blue 500
    if (rate <= 3) return '#93c5fd'; // Blue 300 (Cool)

    // Transition to Red
    if (rate <= 5) return '#fca5a5'; // Red 300 (Warming up)
    if (rate <= 7) return '#ef4444'; // Red 500 (Hot)
    if (rate <= 10) return '#b91c1c'; // Red 700 (Very Hot)

    return '#7f1d1d'; // Red 900 (Extreme)
};

const CustomContent = (props: any) => {
    const { x, y, width, height, name, volume, turnoverRate } = props;

    // Use Turnover Color based on Turnover Rate
    const bgColor = getTurnoverColor(Number(turnoverRate) || 0);

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
                        <div className="font-bold text-xs sm:text-sm drop-shadow-md">{name}</div>
                        {height > 35 && (
                            <div className={`text-[10px] opacity-95 mt-0.5 drop-shadow-md font-mono flex flex-col items-center ${height > 55 ? 'leading-none gap-0.5' : ''}`}>
                                {height > 55 ? (
                                    <>
                                        <span>{(Number(volume) || 0).toFixed(1)}億</span>
                                        <span>{turnoverRate ?? 'N/A'}%</span>
                                    </>
                                ) : (
                                    <span>{(Number(volume) || 0).toFixed(1)}億, {turnoverRate ?? 'N/A'}%</span>
                                )}
                            </div>
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
                    <span>週轉率顏色:</span>
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-blue-800 rounded"></div>
                        <span>冷 (&lt;1%)</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-blue-300 rounded"></div>
                        <span>普 (3%)</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-red-300 rounded"></div>
                        <span>溫 (5%)</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-4 h-4 bg-red-800 rounded"></div>
                        <span>熱 (&gt;7%)</span>
                    </div>
                </div>
                <div>* 面積=成交值</div>
            </div>
        </div>
    );
};
