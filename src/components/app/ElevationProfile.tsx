"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Mountain } from "lucide-react";

interface ElevationProfileProps {
  data: { distance: number; elevation: number }[];
  onHoverIndexChange?: (index: number | null) => void;
  dark?: boolean; // Para uso dentro do mapa (fundo escuro)
}

export default function ElevationProfile({ data, onHoverIndexChange, dark = false }: ElevationProfileProps) {
  if (!data || data.length === 0) return null;

  const minElevation = Math.min(...data.map(d => d.elevation));
  const maxElevation = Math.max(...data.map(d => d.elevation));
  const gain = maxElevation - minElevation;
  const tickColor = dark ? 'rgba(255,255,255,0.5)' : '#9ca3af';

  return (
    <div className={dark ? "w-full h-full" : "bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mt-4"}>
      {!dark && (
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
              <Mountain className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Perfil de Elevação</h3>
              <p className="text-[10px] text-gray-500 font-medium">Relevo e altitude da trilha</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-800">{Math.round(maxElevation)}m</p>
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Pico Máx</p>
          </div>
        </div>
      )}

      <div className="h-32 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart 
            data={data} 
            margin={{ top: 5, right: 0, left: -20, bottom: 0 }}
            onMouseMove={(e) => {
              if (e.activeTooltipIndex !== undefined && onHoverIndexChange) {
                onHoverIndexChange(Number(e.activeTooltipIndex));
              }
            }}
            onMouseLeave={() => {
              if (onHoverIndexChange) {
                onHoverIndexChange(null);
              }
            }}
          >
            <defs>
              <linearGradient id="colorElevation" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="distance" 
              tickFormatter={(val) => `${val}km`} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: tickColor }}
              minTickGap={30}
            />
            <YAxis 
              domain={['dataMin - 10', 'dataMax + 10']} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fill: tickColor }}
              tickFormatter={(val) => `${Math.round(val)}m`}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
              labelStyle={{ color: '#6b7280', fontSize: '12px', fontWeight: 'bold' }}
              itemStyle={{ color: '#f97316', fontSize: '14px', fontWeight: 'black' }}
              formatter={(value: any) => [`${Math.round(Number(value) || 0)}m`, 'Altitude']}
              labelFormatter={(label) => `${label} km`}
            />
            <Area 
              type="monotone" 
              dataKey="elevation" 
              stroke="#f97316" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorElevation)" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {!dark && (
        <div className="flex justify-between mt-3 px-1">
          <div className="text-xs text-gray-500">
            Início: <strong className="text-gray-700">{Math.round(data[0].elevation)}m</strong>
          </div>
          <div className="text-xs text-gray-500">
            Ganho: <strong className="text-orange-500">+{Math.round(gain)}m</strong>
          </div>
        </div>
      )}
    </div>
  );
}
