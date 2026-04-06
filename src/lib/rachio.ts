export interface RachioZone {
  rachio_zone_id: string;
  zone_number: number;
  zone_name: string;
  enabled: boolean;
}

export async function getDeviceZones(apiKey: string, deviceId: string): Promise<RachioZone[]> {
  const url = `https://api.rach.io/1/public/device/${deviceId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Rachio API error: ${response.status} ${response.statusText}`);
  }

  const device = await response.json();
  const zones: any[] = device.zones ?? [];

  return zones.map((z) => ({
    rachio_zone_id: z.id,
    zone_number: z.zoneNumber,
    zone_name: z.name,
    enabled: z.enabled ?? true,
  }));
}

const RACHIO_MAX_DAYS = 35;
const MAX_TIME_RANGE_MS = RACHIO_MAX_DAYS * 24 * 60 * 60 * 1000;

export interface ZoneEvent {
  event_id: string;
  zone_name: string | null;
  duration_seconds: number | null;
  end_time: number | null;
  end_time_datetime: string | null;
  topic: string | null;
  summary: string | null;
}

async function fetchDeviceEvents(
  apiKey: string,
  deviceId: string,
  startTime: number,
  endTime: number
): Promise<any[]> {
  const baseUrl = 'https://api.rach.io/1';
  const url = `${baseUrl}/public/device/${deviceId}/event?startTime=${startTime}&endTime=${endTime}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Rachio API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function getZoneRunEvents(
  apiKey: string,
  deviceId: string,
  startTime?: number,
  endTime?: number
): Promise<ZoneEvent[]> {
  const now = Date.now();
  const resolvedEnd = endTime ?? now;
  const resolvedStart = startTime ?? now - 7 * 24 * 60 * 60 * 1000;

  const timeRangeMs = resolvedEnd - resolvedStart;
  let allEvents: any[] = [];

  if (timeRangeMs <= MAX_TIME_RANGE_MS) {
    allEvents = await fetchDeviceEvents(apiKey, deviceId, resolvedStart, resolvedEnd);
  } else {
    let current = resolvedStart;
    while (current < resolvedEnd) {
      const chunkEnd = Math.min(current + MAX_TIME_RANGE_MS, resolvedEnd);
      const chunk = await fetchDeviceEvents(apiKey, deviceId, current, chunkEnd);
      allEvents.push(...chunk);
      current = chunkEnd + 1;
    }
  }

  const zoneCompleted = allEvents.filter(
    (e) => e.type === 'ZONE_STATUS' && e.subType === 'ZONE_COMPLETED'
  );

  return zoneCompleted.map(parseZoneEvent);
}

function parseZoneEvent(event: any): ZoneEvent {
  const summary: string = event.summary ?? '';

  const zoneMatch = summary.match(/^(.+?)\s+(completed|began)\s+watering/);
  const zoneName = zoneMatch ? zoneMatch[1].trim() : null;

  const durationMatch = summary.match(/for\s+(\d+)\s+minutes?/);
  const durationSeconds = durationMatch ? parseInt(durationMatch[1]) * 60 : null;

  const endTimeMs: number | null = event.eventDate ?? null;
  const endTimeDatetime = endTimeMs
    ? new Date(endTimeMs).toISOString().replace('T', ' ').substring(0, 19)
    : null;

  return {
    event_id: event.id,
    zone_name: zoneName,
    duration_seconds: durationSeconds,
    end_time: endTimeMs,
    end_time_datetime: endTimeDatetime,
    topic: event.topic ?? null,
    summary,
  };
}
