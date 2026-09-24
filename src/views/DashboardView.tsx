import React from 'react';
import {
  FilePlus,
  Compass,
  ArrowRight,
  ShieldCheck,
  MapPin,
  ExternalLink,
  CheckCircle2,
  Clock3,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { useComplaints } from '../context/ComplaintsContext';
import { NavView } from '../components/Navbar';
import { Complaint } from '../types';

interface DashboardViewProps {
  onNavigate: (view: NavView) => void;
  onSelectComplaintForVerification?: (
    complaint: Complaint
  ) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onSelectComplaintForVerification,
}) => {
  const { user } = useAuth();
  const { userComplaints } = useComplaints();

  const totalReports = Math.max(user?.reportsCount ?? 0, userComplaints.length);

  const unresolvedCount = userComplaints.length > 0
    ? userComplaints.filter(
        (c) =>
          c.status === 'reported' ||
          c.status === 'ai_analyzed'
      ).length
    : totalReports;

  const underRepairCount = userComplaints.filter(
    (c) =>
      c.status === 'repair_in_progress' ||
      c.status === 'repair_claimed'
  ).length;

  const verifiedCount = Math.max(
    user?.verifiedRepairsCount ?? 0,
    userComplaints.filter((c) => c.status === 'verified').length
  );

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8 lg:py-8">

      <div className="mx-auto max-w-7xl space-y-6">

        {/* HERO / WELCOME */}
        <section className="relative overflow-hidden rounded-3xl border border-blue-100 bg-white p-6 shadow-sm sm:p-8">

          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-100/60 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-cyan-100/50 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">

            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />

                <span className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                  Citizen Dashboard
                </span>
              </div>

              <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                Welcome back,{' '}
                <span className="text-blue-600">
                  {user?.displayName || 'Citizen'}
                </span>
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                Track your road reports, monitor repair progress,
                and verify completed work from one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">

              <button
                onClick={() => onNavigate('report')}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
              >
                <FilePlus className="h-4 w-4" />
                Report a Pothole
              </button>

              <button
                onClick={() => onNavigate('map')}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <Compass className="h-4 w-4 text-blue-600" />
                Live City Map
              </button>

            </div>
          </div>
        </section>

        {/* AUTHORITY BANNER */}
        {(user?.role === 'municipal_officer' ||
          user?.role === 'admin' ||
          user?.role === 'authority') && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

              <div className="flex items-start gap-3">

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>

                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-amber-700">
                    Authority access available
                  </div>

                  <p className="mt-1 text-xs leading-5 text-amber-800/80">
                    Your account has municipal authority privileges.
                    Open the Authority Hub to manage road reports.
                  </p>
                </div>

              </div>

              <button
                onClick={() => onNavigate('admin')}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-amber-600"
              >
                Open Authority Hub
                <ArrowRight className="h-3.5 w-3.5" />
              </button>

            </div>
          </section>
        )}

        {/* STAT CARDS */}
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">

          {/* TOTAL */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between">

              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total Reports
              </span>

              <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
                <BarChart3 className="h-4 w-4" />
              </div>

            </div>

            <div className="mt-4 text-3xl font-black text-slate-900">
              {totalReports}
            </div>

            <p className="mt-1 text-xs text-blue-600">
              Reports submitted
            </p>
          </div>

          {/* PENDING */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between">

              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Awaiting Repair
              </span>

              <div className="rounded-xl bg-rose-50 p-2 text-rose-600">
                <AlertTriangle className="h-4 w-4" />
              </div>

            </div>

            <div className="mt-4 text-3xl font-black text-slate-900">
              {unresolvedCount}
            </div>

            <p className="mt-1 text-xs text-rose-600">
              Pending action
            </p>
          </div>

          {/* REPAIR */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between">

              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                In Repair
              </span>

              <div className="rounded-xl bg-amber-50 p-2 text-amber-600">
                <Clock3 className="h-4 w-4" />
              </div>

            </div>

            <div className="mt-4 text-3xl font-black text-slate-900">
              {underRepairCount}
            </div>

            <p className="mt-1 text-xs text-amber-600">
              Work in progress
            </p>
          </div>

          {/* VERIFIED */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-center justify-between">

              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Verified
              </span>

              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>

            </div>

            <div className="mt-4 text-3xl font-black text-slate-900">
              {verifiedCount}
            </div>

            <p className="mt-1 text-xs text-emerald-600">
              Successfully closed
            </p>
          </div>

        </section>

        {/* REPORTS */}
        <section>

          <div className="mb-4 flex items-center justify-between">

            <div>
              <h2 className="text-xl font-black text-slate-900">
                Your Road Reports
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Track the complaints submitted from your account.
              </p>
            </div>

            <button
              onClick={() => onNavigate('my-complaints')}
              className="hidden items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 sm:flex"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </button>

          </div>

          {userComplaints.length === 0 ? (

            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <MapPin className="h-7 w-7" />
              </div>

              <h3 className="mt-4 text-lg font-black text-slate-900">
                No road reports yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Report a pothole or road defect and track its progress
                directly from your dashboard.
              </p>

              <div className="mt-5 flex flex-wrap justify-center gap-3">

                <button
                  onClick={() => onNavigate('report')}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-blue-700"
                >
                  Report Road Defect
                </button>

                <button
                  onClick={() => onNavigate('map')}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Explore Live Map
                </button>

              </div>

            </div>

          ) : (

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

              {userComplaints.map((c) => {

                const isVerified = c.status === 'verified';
                const isSuspicious = c.status === 'suspicious';

                return (
                  <div
                    key={c.id}
                    className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                  >

                    {/* TOP */}
                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">

                      <span className="font-mono text-xs font-black text-blue-600">
                        {c.id}
                      </span>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${
                          isVerified
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : isSuspicious
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700'
                        }`}
                      >
                        {c.status.replace('_', ' ')}
                      </span>

                    </div>

                    {/* LOCATION */}
                    <div className="mt-4">

                      <div className="flex items-start gap-2">

                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />

                        <div>

                          <div className="text-sm font-bold text-slate-900">
                            {c.location.road}
                          </div>

                          {c.location.landmark && (
                            <div className="mt-0.5 text-xs text-blue-600">
                              {c.location.landmark}
                            </div>
                          )}

                          <div className="mt-0.5 text-xs text-slate-500">
                            {c.location.city},{' '}
                            {c.location.state}
                          </div>

                        </div>

                      </div>

                    </div>

                    {/* DESCRIPTION */}
                    <p className="mt-4 line-clamp-2 text-xs leading-5 text-slate-600">
                      {c.description}
                    </p>

                    {/* FOOTER */}
                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">

                      <div className="text-[11px] text-slate-500">
                        Hazard:{' '}
                        <span className="font-bold text-slate-800">
                          {c.hazardScore}/100
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          if (
                            onSelectComplaintForVerification
                          ) {
                            onSelectComplaintForVerification(c);
                          }

                          onNavigate('verification');
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 transition hover:text-blue-700"
                      >
                        Inspect
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>

                    </div>

                  </div>
                );
              })}

            </div>
          )}

        </section>

        {/* MOBILE VIEW ALL */}
        {userComplaints.length > 0 && (
          <button
            onClick={() => onNavigate('my-complaints')}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold text-blue-600 sm:hidden"
          >
            View all reports
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}

      </div>
    </div>
  );
};
