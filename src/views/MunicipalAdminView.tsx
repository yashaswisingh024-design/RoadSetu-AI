import React, { useState } from 'react';
import {
  Building2,
  Search,
  CheckCircle2,
  Clock,
  Truck,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  FileCheck,
  ChevronRight,
  MapPin,
  BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import { useComplaints } from '../context/ComplaintsContext';
import { useAuth } from '../context/AuthContext';
import { Complaint, ComplaintStatus } from '../types';
import { NavView } from '../components/Navbar';
import { MatchOriginalViewModal } from '../components/MatchOriginalViewModal';

interface MunicipalAdminViewProps {
  onNavigate: (view: NavView) => void;
  onSelectComplaintForVerification?: (
    complaint: Complaint
  ) => void;
}

const CHART_COLORS = ['#2563eb', '#f59e0b', '#10b981', '#ef4444'];

export const MunicipalAdminView: React.FC<
  MunicipalAdminViewProps
> = ({
  onNavigate,
  onSelectComplaintForVerification,
}) => {
  const {
    complaints,
    updateComplaintStatus,
    stats,
  } = useComplaints();

  const { user, showToast } = useAuth();

  const [activeTab, setActiveTab] = useState<
    'triage' | 'verification' | 'analytics' | 'contractors'
  >('triage');

  const [selectedStatus, setSelectedStatus] =
    useState<string>('all');

  const [searchQuery, setSearchQuery] =
    useState('');

  const [matchingComplaint, setMatchingComplaint] =
    useState<Complaint | null>(null);

  const isAuthority =
    user?.role === 'municipal_officer' ||
    user?.role === 'admin' ||
    user?.role === 'authority';

  const pendingTriageCount = complaints.filter(
    (c) =>
      c.status === 'reported' ||
      c.status === 'ai_analyzed'
  ).length;

  const inRepairCount = complaints.filter(
    (c) => c.status === 'repair_in_progress'
  ).length;

  const awaitingVerificationCount =
    complaints.filter(
      (c) =>
        c.status === 'repair_claimed' ||
        (c.status === 'repair_in_progress' &&
          c.afterImage)
    ).length;

  const verifiedCount = complaints.filter(
    (c) => c.status === 'verified'
  ).length;

  const suspiciousCount = complaints.filter(
    (c) => c.status === 'suspicious'
  ).length;

  const totalProtectedFunds =
    stats.fraudBlockedAmount ||
    suspiciousCount * 28500 +
      verifiedCount * 14500;

  const filtered = complaints.filter((c) => {
    const q = searchQuery.toLowerCase();

    const matchesSearch =
      c.id.toLowerCase().includes(q) ||
      c.location.road
        .toLowerCase()
        .includes(q) ||
      c.department
        .toLowerCase()
        .includes(q) ||
      c.location.city
        .toLowerCase()
        .includes(q);

    const matchesStatus =
      selectedStatus === 'all' ||
      c.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  const handleStatusUpdate = async (
    complaint: Complaint,
    status: ComplaintStatus
  ) => {
    try {
      await updateComplaintStatus(
        complaint.id,
        status
      );

      showToast(
        `Report ${complaint.id} updated.`,
        'success'
      );
    } catch (error) {
      console.error(
        'Status update failed:',
        error
      );

      showToast(
        'Could not update this report.',
        'error'
      );
    }
  };

  const handleContractorMatchSubmission =
    async (
      capturedImage: string,
      notes: string
    ) => {
      if (!matchingComplaint) return;

      try {
        await updateComplaintStatus(
          matchingComplaint.id,
          'repair_claimed',
          {
            afterImage: capturedImage,
            contractorNotes: notes,
          }
        );

        showToast(
          `Repair evidence captured for ${matchingComplaint.id}.`,
          'success'
        );

        const updated = {
          ...matchingComplaint,
          afterImage: capturedImage,
          contractorNotes: notes,
          status: 'repair_claimed' as const,
        };

        setMatchingComplaint(null);

        if (
          onSelectComplaintForVerification
        ) {
          onSelectComplaintForVerification(
            updated
          );
        } else {
          onNavigate('verification');
        }
      } catch (error) {
        console.error(
          'Failed to submit repair:',
          error
        );

        showToast(
          'Could not submit repair evidence.',
          'error'
        );
      }
    };

  if (!isAuthority) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50">
            <ShieldCheck className="h-8 w-8 text-amber-600" />
          </div>

          <h2 className="mt-5 text-2xl font-black text-slate-900">
            Authority access required
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Sign in with a provisioned municipal
            authority account to access this hub.
          </p>

          <button
            onClick={() =>
              onNavigate('dashboard')
            }
            className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
          >
            Return to Portal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* HEADER */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700">
                <Building2 className="h-3.5 w-3.5" />
                Municipal Authority Hub
              </div>

              <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                Municipal Operations
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Manage reports, repair progress,
                verification and civic operations.
              </p>
            </div>

            <button
              onClick={() =>
                window.location.reload()
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </section>

        {/* STAT CARDS */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

          {[
            {
              label: 'Pending Triage',
              value: pendingTriageCount,
              icon: Clock,
              bg: 'bg-amber-50',
              iconColor: 'text-amber-600',
            },
            {
              label: 'In Repair',
              value: inRepairCount,
              icon: Truck,
              bg: 'bg-blue-50',
              iconColor: 'text-blue-600',
            },
            {
              label: 'Awaiting Verification',
              value: awaitingVerificationCount,
              icon: FileCheck,
              bg: 'bg-violet-50',
              iconColor: 'text-violet-600',
            },
            {
              label: 'Verified',
              value: verifiedCount,
              icon: CheckCircle2,
              bg: 'bg-emerald-50',
              iconColor: 'text-emerald-600',
            },
            {
              label: 'Protected Funds',
              value: `₹${Math.round(
                totalProtectedFunds
              ).toLocaleString('en-IN')}`,
              icon: ShieldCheck,
              bg: 'bg-slate-100',
              iconColor: 'text-slate-700',
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.bg}`}
                >
                  <Icon
                    className={`h-5 w-5 ${item.iconColor}`}
                  />
                </div>

                <div className="mt-4 text-2xl font-black text-slate-900">
                  {item.value}
                </div>

                <div className="mt-1 text-xs font-semibold text-slate-400">
                  {item.label}
                </div>
              </div>
            );
          })}
        </section>

        {/* MAIN PANEL */}
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">

          {/* TABS */}
          <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-2">
            {[
              ['triage', 'Triage'],
              ['verification', 'Verification'],
              ['analytics', 'Analytics'],
              ['contractors', 'Contractors'],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() =>
                  setActiveTab(
                    value as
                      | 'triage'
                      | 'verification'
                      | 'analytics'
                      | 'contractors'
                  )
                }
                className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                  activeTab === value
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:bg-white/70 hover:text-slate-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-5 sm:p-6">

            {/* TRIAGE */}
            {activeTab === 'triage' && (
              <>
                <div className="mb-5">
                  <h2 className="text-lg font-black text-slate-900">
                    Report Triage
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Review incoming reports and move
                    them through the repair workflow.
                  </p>
                </div>

                <div className="mb-5 flex flex-col gap-3 sm:flex-row">

                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      value={searchQuery}
                      onChange={(e) =>
                        setSearchQuery(
                          e.target.value
                        )
                      }
                      placeholder="Search reports, roads or cities..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-700 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <select
                    value={selectedStatus}
                    onChange={(e) =>
                      setSelectedStatus(
                        e.target.value
                      )
                    }
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="all">
                      All statuses
                    </option>

                    {[
                      'reported',
                      'ai_analyzed',
                      'routed',
                      'assigned',
                      'repair_in_progress',
                      'repair_claimed',
                      'verified',
                      'suspicious',
                      'closed',
                    ].map((status) => (
                      <option
                        key={status}
                        value={status}
                      >
                        {status.replaceAll(
                          '_',
                          ' '
                        )}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-3">
                  {filtered.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                      <Search className="mx-auto h-7 w-7 text-slate-300" />

                      <p className="mt-3 text-sm font-semibold text-slate-500">
                        No reports match the filters.
                      </p>
                    </div>
                  ) : (
                    filtered
                      .slice(0, 50)
                      .map((complaint) => (
                        <div
                          key={complaint.id}
                          className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-sm"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">

                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-lg bg-blue-50 px-2.5 py-1 font-mono text-xs font-bold text-blue-700">
                                  {complaint.id}
                                </span>

                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase text-slate-500">
                                  {complaint.status.replaceAll(
                                    '_',
                                    ' '
                                  )}
                                </span>
                              </div>

                              <div className="mt-3 flex items-start gap-2">
                                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />

                                <div>
                                  <p className="text-sm font-bold text-slate-800">
                                    {complaint.location.formattedAddress ||
                                      `${complaint.location.road}, ${complaint.location.city}`}
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500">
                                    {complaint.description}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() =>
                                onSelectComplaintForVerification?.(
                                  complaint
                                )
                              }
                              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                              Open verification
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">

                            {complaint.status !==
                              'repair_in_progress' &&
                              complaint.status !==
                                'verified' && (
                                <button
                                  onClick={() =>
                                    handleStatusUpdate(
                                      complaint,
                                      'repair_in_progress'
                                    )
                                  }
                                  className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                                >
                                  Mark in repair
                                </button>
                              )}

                            {complaint.status ===
                              'repair_in_progress' && (
                              <button
                                onClick={() =>
                                  handleStatusUpdate(
                                    complaint,
                                    'repair_claimed'
                                  )
                                }
                                className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100"
                              >
                                Mark repair claimed
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </>
            )}

            {/* VERIFICATION */}
            {activeTab === 'verification' && (
              <div>
                <div className="mb-5">
                  <h2 className="text-lg font-black text-slate-900">
                    Repair Verification Queue
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Open claimed repairs in the AI
                    verification center.
                  </p>
                </div>

                <div className="space-y-2">
                  {complaints.filter(
                    (c) =>
                      c.status ===
                        'repair_claimed' ||
                      c.afterImage
                  ).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                      <FileCheck className="mx-auto h-7 w-7 text-slate-300" />

                      <p className="mt-3 text-sm font-semibold text-slate-500">
                        No repairs awaiting verification.
                      </p>
                    </div>
                  ) : (
                    complaints
                      .filter(
                        (c) =>
                          c.status ===
                            'repair_claimed' ||
                          c.afterImage
                      )
                      .map((complaint) => (
                        <button
                          key={complaint.id}
                          onClick={() =>
                            onSelectComplaintForVerification?.(
                              complaint
                            )
                          }
                          className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/30"
                        >
                          <div>
                            <span className="font-mono text-xs font-bold text-blue-600">
                              {complaint.id}
                            </span>

                            <span className="mt-1 block text-sm font-semibold text-slate-800">
                              {complaint.location.formattedAddress}
                            </span>
                          </div>

                          <ChevronRight className="h-5 w-5 text-slate-400" />
                        </button>
                      ))
                  )}
                </div>
              </div>
            )}

            {/* ANALYTICS */}
            {activeTab === 'analytics' && (
              <div>
                <div className="mb-5">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />

                    <h2 className="text-lg font-black text-slate-900">
                      Operations Analytics
                    </h2>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    Current report and repair workflow
                    distribution.
                  </p>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">

                  <div className="h-80 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <BarChart
                        data={[
                          {
                            name: 'Reported',
                            value:
                              pendingTriageCount,
                          },
                          {
                            name: 'Repair',
                            value: inRepairCount,
                          },
                          {
                            name: 'Verified',
                            value: verifiedCount,
                          },
                          {
                            name: 'Suspicious',
                            value: suspiciousCount,
                          },
                        ]}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#e2e8f0"
                        />

                        <XAxis
                          dataKey="name"
                          tick={{
                            fill: '#64748b',
                            fontSize: 11,
                          }}
                        />

                        <YAxis
                          allowDecimals={false}
                          tick={{
                            fill: '#64748b',
                            fontSize: 11,
                          }}
                        />

                        <Tooltip />

                        <Bar
                          dataKey="value"
                          fill="#2563eb"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="h-80 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <PieChart>
                        <Pie
                          data={[
                            {
                              name: 'Pending',
                              value:
                                pendingTriageCount,
                            },
                            {
                              name: 'Repair',
                              value:
                                inRepairCount,
                            },
                            {
                              name: 'Verified',
                              value:
                                verifiedCount,
                            },
                            {
                              name: 'Suspicious',
                              value:
                                suspiciousCount,
                            },
                          ]}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          label
                        >
                          {[
                            0, 1, 2, 3,
                          ].map((index) => (
                            <Cell
                              key={index}
                              fill={
                                CHART_COLORS[
                                  index
                                ]
                              }
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* CONTRACTORS */}
            {activeTab === 'contractors' && (
              <div>
                <div className="mb-5">
                  <h2 className="text-lg font-black text-slate-900">
                    Contractor Repair Workflow
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Capture post-repair evidence from a
                    viewpoint similar to the original
                    citizen report.
                  </p>
                </div>

                <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-xs font-semibold leading-5 text-blue-800">
                    Contractors must provide repair
                    evidence that can be compared with
                    the original defect before the repair
                    is verified.
                  </p>
                </div>

                <div className="space-y-3">
                  {complaints.filter(
                    (c) =>
                      c.status ===
                        'repair_in_progress' ||
                      c.status === 'assigned'
                  ).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                      <Truck className="mx-auto h-8 w-8 text-slate-300" />

                      <p className="mt-3 text-sm font-semibold text-slate-500">
                        No active repair dispatches.
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Move a report into repair from
                        the Triage tab.
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {complaints
                        .filter(
                          (c) =>
                            c.status ===
                              'repair_in_progress' ||
                            c.status === 'assigned'
                        )
                        .map((complaint) => (
                          <div
                            key={complaint.id}
                            className="rounded-2xl border border-slate-200 bg-white p-4"
                          >
                            <div className="flex items-start justify-between gap-3">

                              <div>
                                <span className="font-mono text-xs font-bold text-blue-600">
                                  {complaint.id}
                                </span>

                                <h3 className="mt-1 text-sm font-bold text-slate-800">
                                  {complaint.location.road}
                                </h3>

                                <p className="mt-1 text-xs text-slate-500">
                                  {complaint.location.city}
                                  {' • '}
                                  {complaint.defectType}
                                </p>
                              </div>

                              {complaint.beforeImage && (
                                <img
                                  src={
                                    complaint.beforeImage
                                  }
                                  alt="Reported defect"
                                  className="h-14 w-14 rounded-xl border border-slate-200 object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                            </div>

                            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-700">
                                {complaint.status.replaceAll(
                                  '_',
                                  ' '
                                )}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  setMatchingComplaint(
                                    complaint
                                  )
                                }
                                className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                              >
                                Match Original View
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* MODAL */}
        {matchingComplaint && (
          <MatchOriginalViewModal
            isOpen={Boolean(
              matchingComplaint
            )}
            onClose={() =>
              setMatchingComplaint(null)
            }
            complaint={matchingComplaint}
            onSubmitRepair={
              handleContractorMatchSubmission
            }
          />
        )}
      </div>
    </div>
  );
};
