'use client';

interface HolderComposition {
  institutions: {
    percentage: number;
    count: number;
    totalValue: string;
    entities: string[];
  };
  exchanges: {
    percentage: number;
    count: number;
    totalValue: string;
    names: string[];
  };
  retail: {
    percentage: number;
    count: number;
    totalValue: string;
  };
  scammers: {
    percentage: number;
    count: number;
    totalValue: string;
    addresses: string[];
  };
}

interface HolderBreakdownProps {
  composition: HolderComposition;
}

export function HolderBreakdown({ composition }: HolderBreakdownProps) {
  const segments = [
    {
      label: 'Institutions',
      percentage: composition.institutions.percentage,
      count: composition.institutions.count,
      value: composition.institutions.totalValue,
      color: '#0A1EFF',
      detail: composition.institutions.entities.join(', ') || 'None detected',
    },
    {
      label: 'Exchanges',
      percentage: composition.exchanges.percentage,
      count: composition.exchanges.count,
      value: composition.exchanges.totalValue,
      color: '#4488FF',
      detail: composition.exchanges.names.join(', ') || 'None detected',
    },
    {
      label: 'Retail',
      percentage: composition.retail.percentage,
      count: composition.retail.count,
      value: composition.retail.totalValue,
      color: '#888888',
      detail: `${composition.retail.count} wallets`,
    },
    {
      label: 'Scammers',
      percentage: composition.scammers.percentage,
      count: composition.scammers.count,
      value: composition.scammers.totalValue,
      color: '#FF4444',
      detail: composition.scammers.count > 0
        ? `${composition.scammers.count} flagged address(es)`
        : 'None detected',
    },
  ];

  return (
    <div className="bg-[#141824] rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-300 mb-4">
        Holder Composition
      </h3>

      <div className="flex h-4 rounded-full overflow-hidden mb-4">
        {segments.map((seg) => (
          seg.percentage > 0 && (
            <div
              key={seg.label}
              className="h-full transition-all"
              style={{
                width: `${seg.percentage}%`,
                backgroundColor: seg.color,
              }}
              title={`${seg.label}: ${seg.percentage.toFixed(1)}%`}
            />
          )
        ))}
      </div>

      <div className="space-y-3">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <div>
                <div className="text-sm text-white">{seg.label}</div>
                <div className="text-xs text-gray-500 max-w-[200px] truncate">
                  {seg.detail}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-white font-mono">
                {seg.percentage.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500">
                ${parseFloat(seg.value).toLocaleString()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
