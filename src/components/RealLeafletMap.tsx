import React, { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Complaint } from '../types';

interface RealLeafletMapProps {
  complaints: Complaint[];
  selectedComplaintId?: string;
  onSelectComplaint: (complaint: Complaint) => void;
  className?: string;
}

const DEFAULT_CENTER: L.LatLngExpression = [19.2183, 72.9781];

function validCoordinates(complaint: Complaint) {
  const latitude = Number(complaint.location?.latitude);
  const longitude = Number(complaint.location?.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 && !(latitude === 0 && longitude === 0);
}

function markerColor(status: Complaint['status']) {
  if (status === 'verified_closed') return '#16a34a';
  if (status === 'repair_in_progress' || status === 'repair_claimed') return '#f59e0b';
  if (status === 'suspicious') return '#dc2626';
  return '#2563eb';
}

export const RealLeafletMap: React.FC<RealLeafletMapProps> = ({
  complaints,
  selectedComplaintId,
  onSelectComplaint,
  className = '',
}) => {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapElementRef.current || mapRef.current) return;

    const map = L.map(mapElementRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    requestAnimationFrame(() => map.invalidateSize());

    return () => {
      markersRef.current?.clearLayers();
      markersRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markersRef.current;
    if (!map || !markerLayer) return;

    markerLayer.clearLayers();

    const locatedComplaints = complaints.filter(validCoordinates);
    const bounds = L.latLngBounds([]);

    locatedComplaints.slice(0, 100).forEach((complaint) => {
      const latitude = Number(complaint.location.latitude);
      const longitude = Number(complaint.location.longitude);
      const color = markerColor(complaint.status);
      const selected = complaint.id === selectedComplaintId;

      const icon = L.divIcon({
        className: 'roadsetu-map-marker',
        html: `<div style="width:${selected ? 36 : 30}px;height:${selected ? 36 : 30}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:${selected ? '4px solid #dbeafe' : '3px solid white'};box-shadow:0 3px 10px rgba(15,23,42,.28);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);color:white;font-size:${selected ? 15 : 13}px;font-weight:800;">!</span></div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -34],
      });

      const marker = L.marker([latitude, longitude], { icon });
      const address = complaint.location.formattedAddress || [complaint.location.road, complaint.location.area, complaint.location.city].filter(Boolean).join(', ') || 'Location available';
      marker.bindPopup(`
        <div style="min-width:210px;font-family:Inter,Arial,sans-serif">
          <strong style="font-size:14px">${escapeHtml(complaint.defectType || 'Road issue')}</strong>
          <div style="margin-top:5px;color:#475569;font-size:12px">${escapeHtml(address)}</div>
          <div style="margin-top:7px;font-size:11px;font-weight:700;color:${color}">${escapeHtml(String(complaint.status).replaceAll('_', ' ').toUpperCase())}</div>
          <div style="margin-top:8px;font-size:11px;color:#64748b">${escapeHtml(complaint.id)}</div>
        </div>
      `);
      marker.on('click', () => onSelectComplaint(complaint));
      marker.addTo(markerLayer);
      bounds.extend([latitude, longitude]);
    });

    if (locatedComplaints.length > 0) {
      if (selectedComplaintId) {
        const selected = locatedComplaints.find(c => c.id === selectedComplaintId);
        if (selected) {
          map.flyTo([Number(selected.location.latitude), Number(selected.location.longitude)], Math.max(map.getZoom(), 15), { duration: 0.7 });
          const selectedMarker = markerLayer.getLayers().find(layer => (layer as L.Marker).getLatLng?.().lat === Number(selected.location.latitude) && (layer as L.Marker).getLatLng?.().lng === Number(selected.location.longitude));
          if (selectedMarker && selectedMarker instanceof L.Marker) selectedMarker.openPopup();
          return;
        }
      }
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 14 });
    } else {
      map.setView(DEFAULT_CENTER, 11);
    }

    requestAnimationFrame(() => map.invalidateSize());
  }, [complaints, selectedComplaintId, onSelectComplaint]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 ${className}`}>
      <div ref={mapElementRef} className="h-full min-h-[470px] w-full" />
      <div className="absolute left-3 top-3 z-[500] rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs font-bold text-slate-700 shadow-lg backdrop-blur">
        {complaints.filter(validCoordinates).length} mapped report{complaints.filter(validCoordinates).length === 1 ? '' : 's'}
      </div>
      {complaints.length > 0 && complaints.filter(validCoordinates).length === 0 && (
        <div className="absolute inset-0 z-[450] flex items-center justify-center bg-white/70 p-6 text-center backdrop-blur-[1px]">
          <div className="rounded-2xl border border-amber-200 bg-white px-5 py-4 shadow-lg">
            <p className="font-bold text-slate-800">Reports loaded, but coordinates are unavailable.</p>
            <p className="mt-1 text-xs text-slate-500">The map will display markers as soon as valid latitude and longitude are available.</p>
          </div>
        </div>
      )}
    </div>
  );
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] || char));
}
