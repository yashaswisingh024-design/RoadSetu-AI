import React from 'react';
import { ArrowUpRight, List, Map as MapIcon } from 'lucide-react';
import { useComplaints } from '../context/ComplaintsContext';
import { Complaint } from '../types';
import { NavView } from '../components/Navbar';
import { RealLeafletMap } from '../components/RealLeafletMap';

interface LiveMapViewProps {
  onNavigate: (view: NavView) => void;
  onSelectComplaintForVerification?: (complaint: Complaint) => void;
}

export const LiveMapView: React.FC<LiveMapViewProps> = ({ onNavigate, onSelectComplaintForVerification }) => {
  const { complaints } = useComplaints();

  return (
    <div className="min-h-[80vh] bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              <MapIcon className="h-3.5 w-3.5" /> LIVE MAP
            </div>
            <h1 className="text-3xl font-black tracking-tight">Live City Map</h1>
            <p className="mt-2 text-sm text-slate-500">Reported road issues and their current status.</p>
          </div>
          <button onClick={() => onNavigate('report')} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700">
            Report an issue
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_360px]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <RealLeafletMap
              complaints={complaints}
              onSelectComplaint={(complaint) => onSelectComplaintForVerification?.(complaint)}
              className="min-h-[560px]"
            />
            <div className="flex flex-wrap items-center gap-4 px-2 pt-3 text-[11px] font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Active</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Repair</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-green-600" /> Verified</span>
              <span className="ml-auto">OpenStreetMap</span>
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-black text-slate-900">Reported Issues</h2>
                <p className="mt-0.5 text-xs text-slate-500">{complaints.length} reports loaded</p>
              </div>
              <List className="h-5 w-5 text-slate-400" />
            </div>
            <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
              {complaints.slice(0, 30).map((complaint) => (
                <button
                  key={complaint.id}
                  onClick={() => onSelectComplaintForVerification?.(complaint)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-800">{complaint.location.road || complaint.location.city || 'Reported road'}</p>
                      <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{complaint.location.formattedAddress || complaint.description}</p>
                      <span className="mt-2 inline-block rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold capitalize text-blue-700">{String(complaint.status).replaceAll('_', ' ')}</span>
                    </div>
                  </div>
                </button>
              ))}
              {complaints.length === 0 && <p className="rounded-2xl bg-slate-50 p-6 text-center text-xs text-slate-500">No reports available yet.</p>}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
