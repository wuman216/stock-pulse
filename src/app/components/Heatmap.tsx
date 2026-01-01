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

const CustomContent = (props: any) => {
    const { x, y, width, height, name, changePercent, price, volume, turnoverRate, code } = props;

    // Too small to render text?
    if (width < 50 || height < 50) return null;

    // Color logic based on Turnover Rate
    // User: "高點最熱情(紅), 低點最冷(藍)"
    // If N/A or 0, use Blue (Cool).
    // This is a placeholder logic until we have real turnover rates.
    // For now, if "N/A", we use a default slate/blue color.
    let bgColor = '#3b82f6'; // Default Blue (Cool)

    if (typeof turnoverRate === 'number') {
        // Simple linear scale for demo: 0% -> Blue, 10% -> Red
        // This will be refined later
        if (turnoverRate > 5) bgColor = '#ef4444';
        else if (turnoverRate > 1) bgColor = '#8b5cf6'; // Purple
    } else {
        // N/A case: Using "Cool" Blue as requested for low/unknown
        bgColor = '#60a5fa';
    }

    // Text color
    const textColor = '#ffffff';

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
            {width > 60 && height > 40 && (
                <foreignObject x={x} y={y} width={width} height={height}>
                    <div className="h-full w-full flex flex-col items-center justify-center text-white p-1 text-center leading-tight overflow-hidden">
                        <div className="font-bold text-xs sm:text-sm">{code} {name}</div>
                        {height > 60 && (
                            <>
                                <div className="text-xs font-mono">${price}</div>
                                <div className={`text-xs ${changePercent >= 0 ? 'text-red-100' : 'text-green-100'}`}>
                                    {changePercent > 0 ? '+' : ''}{changePercent}%
                                </div>
                                {height > 80 && (
                                    <div className="text-[10px] opacity-90 mt-1">
                                        {(Number(volume) || 0).toFixed(1)}億 | {turnoverRate ?? 'N/A'}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </foreignObject>
            )}
        </g>
    );
};

export const Heatmap = ({ data, title }: HeatmapProps) => {
    // Only take top 20 for heatmap to avoid clutter
    const chartData = useMemo(() => {
        return [
            {
                name: 'Market',
                children: data.slice(0, 15).map(s => ({
                    ...s,
                    size: s.volume, // Recharts uses 'size' prop for area calculation by default? Actually it uses valueKey.
                    value: s.volume
                }))
            }
        ];
    }, [data]);

    const totalVolume = useMemo(() => {
        const sum = data.reduce((acc, curr) => acc + curr.volume, 0);
        return sum.toFixed(1);
    }, [data]);

    if (data.length === 0) return null;

    return (
        <div className="p-4 bg-white mb-4 rounded-lg shadow-sm border border-gray-100">
            <div className="flex justify-between items-end mb-2">
                <h2 className="text-lg font-bold text-gray-800">{title}</h2>
                <span className="text-sm text-gray-500">總成交值: <span className="font-mono text-gray-900 font-bold ml-1">{totalVolume} 億</span></span>
            </div>

            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                        data={chartData}
                        dataKey="value"
                        aspectRatio={4 / 3}
                        stroke="#fff"
                        isAnimationActive={false}
                        content={<CustomContent />}
                    >
                        {/* Tooltip is tricky with custom content in Recharts sometimes, removing for now to rely on visual text */}
                    </Treemap>
                </ResponsiveContainer>
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                <span>週轉率:</span>
                <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-blue-400 rounded"></div>
                    <span>冷靜 (N/A)</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-4 h-4 bg-red-500 rounded"></div>
                    <span>熱情</span>
                </div>
                <span className="ml-auto opacity-75">* 面積=成交值 | 漲跌=紅漲綠跌</span>
            </div>
        </div>
    );
};
