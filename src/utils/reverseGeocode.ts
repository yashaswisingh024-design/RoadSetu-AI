import { HumanLocation } from '../types';

export interface GeocodeSearchResult {
  displayName: string;
  road: string;
  area: string;
  landmark?: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  formattedAddress: string;
}

export type GeolocationStatus =
  | 'idle'
  | 'requesting'
  | 'success'
  | 'permission_denied'
  | 'position_unavailable'
  | 'timeout'
  | 'unsupported'
  | 'error';

export interface GeolocationResult {
  status: GeolocationStatus;
  source?: 'gps' | 'ip';
  coords?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  city?: string;
  region?: string;
  country?: string;
  errorMessage?: string;
  isIframeBlocked?: boolean;
}

export async function getCurrentUserLocation(enableIpFallback: boolean = true): Promise<GeolocationResult> {
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;

  const tryIpFallback = async (originalErrorMsg: string, status: GeolocationStatus): Promise<GeolocationResult> => {
    if (!enableIpFallback) {
      return { status, errorMessage: originalErrorMsg, isIframeBlocked: isIframe };
    }

    try {
      const res = await fetch('/api/ip-location', { signal: AbortSignal.timeout(3500) });
      if (res.ok) {
        const data = await res.json();
        if (data.success && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          return {
            status: 'success', source: 'ip',
            coords: { latitude: data.latitude, longitude: data.longitude, accuracy: 2500 },
            city: data.city, region: data.region, country: data.country,
            errorMessage: isIframe ? 'Located approximately via network IP (browser GPS blocked inside iframe).' : 'Located via network IP.',
            isIframeBlocked: isIframe,
          };
        }
      }
    } catch {}

    try {
      const directRes = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
      if (directRes.ok) {
        const data = await directRes.json();
        if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
          return {
            status: 'success', source: 'ip',
            coords: { latitude: data.latitude, longitude: data.longitude, accuracy: 3000 },
            city: data.city, region: data.region, country: data.country_name,
            errorMessage: 'Located via network IP.', isIframeBlocked: isIframe,
          };
        }
      }
    } catch {}

    return { status, errorMessage: originalErrorMsg, isIframeBlocked: isIframe };
  };

  if (typeof window === 'undefined' || !navigator.geolocation) {
    return tryIpFallback('Geolocation is not supported by your browser or device.', 'unsupported');
  }

  return new Promise<GeolocationResult>((resolve) => {
    let hasResolved = false;

    const onSuccess = (position: GeolocationPosition) => {
      if (hasResolved) return;
      hasResolved = true;
      resolve({
        status: 'success', source: 'gps',
        coords: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        },
      });
    };

    const onError = async (error: GeolocationPositionError) => {
      if (hasResolved) return;
      if (error.code === error.TIMEOUT) {
        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => {
            if (hasResolved) return;
            hasResolved = true;
            resolve({
              status: 'success', source: 'gps',
              coords: {
                latitude: fallbackPos.coords.latitude,
                longitude: fallbackPos.coords.longitude,
                accuracy: fallbackPos.coords.accuracy,
              },
            });
          },
          async () => {
            if (hasResolved) return;
            hasResolved = true;
            resolve(await tryIpFallback('Location request timed out. Please search for your street or allow location access.', 'timeout'));
          },
          { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000 }
        );
        return;
      }

      hasResolved = true;
      let msg = 'Unable to retrieve your location.';
      let status: GeolocationStatus = 'error';
      if (error.code === error.PERMISSION_DENIED) {
        msg = isIframe ? 'Location permission denied or restricted in preview iframe. Open in a new tab or search below.' : 'Location permission was denied. Please allow location access in your browser or search below.';
        status = 'permission_denied';
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        msg = 'Current GPS position is unavailable on this device.';
        status = 'position_unavailable';
      }
      resolve(await tryIpFallback(msg, status));
    };

    try {
      navigator.geolocation.getCurrentPosition(onSuccess, onError, {
        enableHighAccuracy: true, timeout: 6000, maximumAge: 30000,
      });
    } catch {
      onError({ code: 1, message: 'Permission denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
    }
  });
}

export async function reverseGeocodeCoords(lat: number, lon: number): Promise<HumanLocation> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Nominatim reverse geocoding returned status ${response.status}`);
    const data = await response.json();
    const addr = data.address || {};
    const road = addr.road || addr.pedestrian || addr.street || addr.highway || addr.cycleway || addr.path || 'Public Corridor';
    const area = addr.suburb || addr.neighbourhood || addr.residential || addr.commercial || addr.subdistrict || addr.quarter || addr.district || '';
    const landmark = addr.amenity || addr.building || addr.shop || addr.tourism || addr.leisure || addr.office || addr.historic || '';
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || 'Municipal District';
    const state = addr.state || '';
    const country = addr.country || 'India';
    const parts = [road];
    if (landmark) parts.push(`Near ${landmark}`);
    if (area) parts.push(area);
    if (city) parts.push(city);
    if (state) parts.push(state);
    return { road, area: area || city, landmark: landmark || '', city, state, country, formattedAddress: parts.filter(Boolean).join(', '), latitude: lat, longitude: lon };
  } catch (error) {
    console.warn('Real reverse geocode error, providing structured coordinate fallback:', error);
    return { road: 'Road Corridor', area: 'Detected Coordinate Area', landmark: '', city: 'Local Ward', state: '', country: 'India', formattedAddress: `Road at ${lat.toFixed(4)}, ${lon.toFixed(4)}`, latitude: lat, longitude: lon };
  }
}

export async function searchGeocodeLocations(query: string): Promise<GeocodeSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(trimmed)}&limit=6&addressdetails=1`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Nominatim search returned ${response.status}`);
    const results = await response.json();
    if (!Array.isArray(results)) return [];
    return results.map((item: any) => {
      const addr = item.address || {};
      const road = addr.road || addr.pedestrian || addr.street || addr.highway || item.name || 'Public Road';
      const area = addr.suburb || addr.neighbourhood || addr.residential || addr.commercial || addr.district || '';
      const landmark = addr.amenity || addr.building || addr.shop || addr.tourism || '';
      const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || '';
      const state = addr.state || '';
      const country = addr.country || '';
      const parts = [road];
      if (landmark && landmark !== road) parts.push(`Near ${landmark}`);
      if (area && area !== road) parts.push(area);
      if (city) parts.push(city);
      if (state) parts.push(state);
      return { displayName: item.display_name, road, area: area || city, landmark: landmark || '', city, state, country, latitude: parseFloat(item.lat), longitude: parseFloat(item.lon), formattedAddress: parts.filter(Boolean).join(', ') };
    });
  } catch (error) {
    console.error('Error querying geocoding service:', error);
    return [];
  }
}

export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatMultilineLocation(location: HumanLocation): { roadLine: string; landmarkLine?: string; cityStateLine: string } {
  const roadLine = location.road || 'Corridor Location';
  const landmarkLine = location.landmark ? `Near ${location.landmark.replace(/^Near\s+/i, '')}` : undefined;
  const parts = [location.area, location.city, location.state].filter(Boolean);
  return { roadLine, landmarkLine, cityStateLine: parts.join(', ') || 'Smart City Municipal Sector' };
}
