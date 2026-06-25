import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import DeviceCard from '../components/DeviceCard';
import StatCard from '../components/StatCard';
import { fetchDevices, fetchLatestGPS, fetchGPSHistory, fetchEvents, createWebSocket } from '../lib/api';

const MapView = dynamic(() => import('../components/MapView'), { ssr: false });

const fetcher = (fn: () => Promise<any>) => fn();

export default function Dashboard() {
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [liveGPS, setLiveGPS] = useState<any>(null);
  const [devices, setDevices] = useState<any[]>([]);

  // Fetch devices
  useEffect(() => {
    fetchDevices().then(setDevices).catch(console.error);
    const interval = setInterval(() => {
      fetchDevices().then(setDevices).catch(console.error);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch GPS + events for selected device
  const { data: latestGPS } = useSWR(
    selectedDevice ? `gps-${selectedDevice}` : null,
    () => fetchLatestGPS(selectedDevice!),
    { refreshInterval: 5000 }
  );

  const { data: gpsHistory } = useSWR(
    selectedDevice ? `history-${selectedDevice}` : null,
    () => fetchGPSHistory(selectedDevice!),
    { refreshInterval: 30000 }
  );

  const { data: events } = useSWR(
    selectedDevice ? `events-${selectedDevice}` : null,
    () => fetchEvents(selectedDevice!),
    { refreshInterval: 10000 }
  );

  // WebSocket for realtime updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ws = createWebSocket((data) => {
      if (data.type === 'GPS_UPDATE') {
        if (!selectedDevice || data.deviceId === selectedDevice) {
          setLiveGPS(data.data);
        }
        // Update online status
        setDevices(prev => prev.map(d =>
          d.device_id === data.deviceId ? { ...d, online: true, last_seen: new Date().toISOString() } : d
        ));
      }
      if (data.type === 'DEVICE_OFFLINE') {
        setDevices(prev => prev.map(d =>
          d.device_id === data.deviceId ? { ...d, online: false } : d
        ));
      }
    });

    return () => ws.close();
  }, [selectedDevice]);

  const currentGPS = liveGPS || latestGPS;
  const position = currentGPS?.lat ? { lat: Number(currentGPS.lat), lng: Number(currentGPS.lng) } : undefined;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-sm font-bold">M</div>
          <div>
            <h1 className="font-bold text-lg leading-tight">MRF700 Telematics</h1>
            <p className="text-xs text-slate-400">Open Telematics Platform</p>
          </div>
        </div>
        <div className="text-xs text-slate-400">
          {devices.filter(d => d.online).length} / {devices.length} online
        </div>
      </div>

      <div className="flex h-[calc(100vh-65px)]">
        {/* Sidebar - Device List */}
        <div className="w-72 border-r border-slate-700 flex flex-col">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-sm font-semibold text-slate-300">Devices</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {devices.length === 0 && (
              <p className="text-xs text-slate-500 text-center mt-8">No devices connected</p>
            )}
            {devices.map(device => (
              <DeviceCard
                key={device.device_id}
                device={device}
                selected={selectedDevice === device.device_id}
                onClick={() => setSelectedDevice(device.device_id)}
              />
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedDevice ? (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              <div className="text-center">
                <div className="text-4xl mb-3">📡</div>
                <p>Select a device to view telemetry</p>
              </div>
            </div>
          ) : (
            <>
              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-3 p-4 border-b border-slate-700">
                <StatCard
                  label="Speed"
                  value={currentGPS?.speed != null ? Math.round(Number(currentGPS.speed)) : '-'}
                  unit="km/h"
                  color="blue"
                />
                <StatCard
                  label="ACC"
                  value={currentGPS?.acc_on ? 'ON' : 'OFF'}
                  color={currentGPS?.acc_on ? 'green' : 'yellow'}
                />
                <StatCard
                  label="Latitude"
                  value={currentGPS?.lat ? Number(currentGPS.lat).toFixed(6) : '-'}
                  color="blue"
                />
                <StatCard
                  label="Longitude"
                  value={currentGPS?.lng ? Number(currentGPS.lng).toFixed(6) : '-'}
                  color="blue"
                />
              </div>

              {/* Map + Events */}
              <div className="flex-1 flex overflow-hidden">
                {/* Map */}
                <div className="flex-1 p-4">
                  <MapView
                    position={position}
                    history={gpsHistory || []}
                    height="100%"
                  />
                </div>

                {/* Events Panel */}
                <div className="w-72 border-l border-slate-700 flex flex-col">
                  <div className="p-3 border-b border-slate-700">
                    <h3 className="text-sm font-semibold text-slate-300">Recent Events</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {(!events || events.length === 0) && (
                      <p className="text-xs text-slate-500 text-center mt-8">No events</p>
                    )}
                    {events?.map((ev: any) => (
                      <div key={ev.id} className="p-3 border-b border-slate-800 hover:bg-slate-800/50">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                            {ev.event_type}
                          </span>
                        </div>
                        {ev.description && (
                          <p className="text-xs text-slate-400">{ev.description}</p>
                        )}
                        <p className="text-xs text-slate-600 mt-1">
                          {new Date(ev.occurred_at).toLocaleString('id-ID')}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
