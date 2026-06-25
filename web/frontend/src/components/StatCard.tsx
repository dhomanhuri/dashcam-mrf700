export default function StatCard({ label, value, unit, color = 'blue' }: {
  label: string;
  value: string | number | undefined;
  unit?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red';
}) {
  const colors = {
    blue: 'text-blue-400',
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colors[color]}`}>
        {value ?? '-'}
        {unit && <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span>}
      </div>
    </div>
  );
}
