import React, { useState } from 'react';
import {
  FileText,
  Search,
  MapPin,
  Calendar,
  ExternalLink,
  Plus,
  ArrowRight,
  ShieldCheck,
  Clock3,
  AlertTriangle,
} from 'lucide-react';
import { useComplaints } from '../context/ComplaintsContext';
import { useAuth } from '../context/AuthContext';
import { NavView } from '../components/Navbar';
import { Complaint, ComplaintStatus } from '../types';

interface MyComplaintsViewProps {
  onNavigate: (view: NavView) => void;
  onSelectComplaintForVerification?: (complaint: Complaint) => void;
}

export const MyComplaintsView: React.FC<MyComplaintsViewProps> = ({
  onNavigate,
  onSelectComplaintForVerification,
}) => {
  const { user } = useAuth();
  const { userComplaints } = useComplaints();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] =
    useState<'all' | ComplaintStatus>('all');

  const filtered = userComplaints.filter((c) => {
    const query = searchQuery.toLowerCase();

    const matchesSearch =
      c.id.toLowerCase().includes(query) ||
      c.location.road.toLowerCase().includes(query) ||
      c.location.city.toLowerCase().includes(query) ||
      c.description.toLowerCase().includes(query);

    const matchesStatus =
      filterStatus === 'all' || c.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const getStatus = (status: ComplaintStatus) => {
    switch (status) {
      case 'verified':
        return {
          label: 'Verified',
          icon: ShieldCheck,
          className:
            'bg-emerald-50 text-emerald-700 border-emerald-200',
        };

      case 'suspicious':
        return {
          label: 'Needs Review',
          icon: AlertTriangle,
          className:
            'bg-rose-50 text-rose-700 border-rose-200',
        };

      case 'repair_in_progress':
      case 'repair_claimed':
        return {
          label: 'Under Repair',
          icon: Clock3,
          className:
            'bg-amber-50 text-amber-700 border-amber-200',
        };

      default:
        return {
          label: status.replace('_', ' '),
          icon: Clock3,
          className:
            'bg-blue-50 text-blue-700 border-blue-200',
        };
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-600">
                <FileText className="h-4 w-4" />
                My Reports
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                Your Complaint History
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {user?.displayName ? `Hi ${user.displayName}, ` : ''}
                track every pothole report, its current status, location,
                and AI verification details from one place.
              </p>
            </div>
            <button
              onClick={() => onNavigate('report')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Report a Pothole
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ID, road or description..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'All Reports' },
                { id: 'reported', label: 'Pending' },
                { id: 'repair_in_progress', label: 'In Repair' },
                { id: 'verified', label: 'Verified' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() =>
                    setFilterStatus(tab.id as 'all' | ComplaintStatus)
                  }
                  className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                    filterStatus === tab.id
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between px-1">
          <p className="text-sm font-semibold text-slate-600">
            {filtered.length} report{filtered.length !== 1 ? 's' : ''} found
          </p>
          <span className="text-xs text-slate-400">Live complaint status</span>
        </div>

        {filtered.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
              <FileText className="h-7 w-7 text-blue-500" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">No complaints found</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              Try changing your search or filters, or submit a new pothole report.
            </p>
            <button
              onClick={() => onNavigate('report')}
              className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700"
            >
              Submit a new report
              <ArrowRight className="h-4 w-4" />
            </button>
          </section>
        ) : (
          <div className="space-y-4">
            {filtered.map((c) => {
              const status = getStatus(c.status);
              const StatusIcon = status.icon;
              return (
                <article
                  key={c.id}
                  className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:border-blue-200 hover:shadow-md"
                >
                  <div className="flex flex-col lg:flex-row">
                    <div className="relative h-52 w-full shrink-0 bg-slate-100 lg:h-auto lg:w-64">
                      <img
                        src={c.beforeImage}
                        alt="Reported pothole"
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute left-3 top-3 rounded-lg bg-white/95 px-2.5 py-1 text-[10px] font-bold text-slate-700 shadow-sm">
                        Hazard {c.hazardScore}/100
                      </div>
                    </div>
                    <div className="flex-1 p-5 sm:p-6">
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-700">
                            {c.id}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${status.className}`}>
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </span>
                          <span className="text-xs text-slate-400">Priority: {c.priority}</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-blue-600" />
                            <h2 className="text-base font-bold text-slate-900">{c.location.road}</h2>
                          </div>
                          {c.location.landmark && (
                            <p className="ml-6 mt-1 text-xs font-medium text-blue-600">{c.location.landmark}</p>
                          )}
                          <p className="ml-6 text-xs text-slate-500">{c.location.city}, {c.location.state}</p>
                        </div>
                        <p className="max-w-3xl text-sm leading-6 text-slate-600">{c.description}</p>
                        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
                          <span>Department: <strong className="text-slate-700">{c.department}</strong></span>
                          <span>Estimated repair: <strong className="text-slate-700">{c.estimatedRepairDays} days</strong></span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(c.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                          <button
                            onClick={() => {
                              if (onSelectComplaintForVerification) onSelectComplaintForVerification(c);
                              onNavigate('verification');
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-700"
                          >
                            Inspect AI Verification
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => onNavigate('map')}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                            View on Map
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
