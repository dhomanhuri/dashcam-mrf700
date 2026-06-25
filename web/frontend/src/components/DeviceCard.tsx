interface Device {
  device_id: string;
  name?: string;
  imei?: string;
  online: boolean;
  last_seen: string;
}

export default function DeviceCard({ device, onClick, selected }: {
  device: Device;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer p-4 rounded-lg border transition-all ${
        selected
          ? 'border-blue-500 bg-blue-900/20'
          : 'border-slate-700 bg-slate-800 hover:border-slate-500'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-sm truncate">{device.name || device.device_id}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          device.online ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/40 text-slate-400'
        }`}>
          {device.online ? '● Online' : '○ Offline'}
        </span>
      </div>
      <div className="text-xs text-slate-400 space-y-1">
        <div>ID: {device.device_id}</div>
        {device.imei && <div>IMEI: {device.imei}</div>}
        {device.last_seen && (
          <div>Last seen: {new Date(device.last_seen).toLocaleString('id-ID')}</div>
        )}
      </div>
    </div>
  );
}
