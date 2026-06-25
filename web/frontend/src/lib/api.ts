const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3501';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3501';

export async function fetchDevices() {
  const res = await fetch(`${API_URL}/api/devices`);
  if (!res.ok) throw new Error('Failed to fetch devices');
  return res.json();
}

export async function fetchDevice(deviceId: string) {
  const res = await fetch(`${API_URL}/api/devices/${deviceId}`);
  if (!res.ok) throw new Error('Failed to fetch device');
  return res.json();
}

export async function fetchLatestGPS(deviceId: string) {
  const res = await fetch(`${API_URL}/api/devices/${deviceId}/gps/latest`);
  if (!res.ok) throw new Error('Failed to fetch GPS');
  return res.json();
}

export async function fetchGPSHistory(deviceId: string, from?: string, to?: string) {
  let url = `${API_URL}/api/devices/${deviceId}/gps/history?limit=500`;
  if (from) url += `&from=${from}`;
  if (to) url += `&to=${to}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch GPS history');
  return res.json();
}

export async function fetchEvents(deviceId: string) {
  const res = await fetch(`${API_URL}/api/devices/${deviceId}/events`);
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
}

export async function fetchPacketStats() {
  const res = await fetch(`${API_URL}/api/packets/stats`);
  if (!res.ok) throw new Error('Failed to fetch packet stats');
  return res.json();
}

export function createWebSocket(onMessage: (data: any) => void): WebSocket {
  const ws = new WebSocket(WS_URL);
  ws.onmessage = (e) => {
    try { onMessage(JSON.parse(e.data)); } catch {}
  };
  return ws;
}

export { WS_URL, API_URL };
