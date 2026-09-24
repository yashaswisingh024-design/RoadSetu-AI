import React, { useState } from 'react';
import {
  X,
  User,
  Mail,
  Calendar,
  FileText,
  CheckCircle,
  ShieldCheck,
  LogOut,
  Edit2,
  Check,
  Key,
  Building2,
  Briefcase,
  MapPin,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useComplaints } from '../context/ComplaintsContext';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToMyComplaints: () => void;
  onNavigateToAuthority?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  onNavigateToMyComplaints,
  onNavigateToAuthority,
}) => {
  const {
    user,
    logout,
    updateUserProfileData,
  } = useAuth();

  const {
    userComplaints,
    complaints,
  } = useComplaints();

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(
    user?.displayName || ''
  );

  if (!isOpen || !user) return null;

  const isAuthority =
    user.role === 'authority' ||
    user.role === 'municipal_officer' ||
    user.role === 'admin';

  const verifiedCount = userComplaints.filter(
    (c) => c.status === 'verified'
  ).length;

  const reportsCount = Math.max(user.reportsCount || 0, userComplaints.length);

  const totalJurisdictionCount = complaints.length;

  const auditedCount = complaints.filter(
    (c) =>
      c.status === 'verified' ||
      c.status === 'closed' ||
      c.escrowStatus === 'disbursed'
  ).length;

  const handleSaveName = async () => {
    if (editedName.trim()) {
      await updateUserProfileData(editedName.trim());
      setIsEditing(false);
    }
  };

  const formattedDate = new Date(
    user.createdAt
  ).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">

        {/* Top accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400" />

        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close profile"
          className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6 sm:p-7">

          {/* Header */}
          <div className="flex items-start gap-4 pr-10">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xl font-black shadow-sm ${
                isAuthority
                  ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                  : 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
              }`}
            >
              {user.displayName
                .charAt(0)
                .toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">

              {isEditing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) =>
                      setEditedName(e.target.value)
                    }
                    autoFocus
                    className="min-w-0 flex-1 rounded-xl border border-blue-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none ring-2 ring-blue-50"
                  />

                  <button
                    onClick={handleSaveName}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700"
                    title="Save name"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-xl font-black tracking-tight text-slate-900">
                    {user.displayName}
                  </h2>

                  <button
                    onClick={() => {
                      setEditedName(user.displayName);
                      setIsEditing(true);
                    }}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-blue-600"
                    title="Edit display name"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {user.email}
                </span>
              </div>

              <div className="mt-2">
                {isAuthority ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                    <Building2 className="h-3 w-3" />
                    Municipal Authority
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    <ShieldCheck className="h-3 w-3" />
                    Verified Citizen
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="my-6 h-px bg-slate-100" />

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {isAuthority
                    ? 'Jurisdiction Reports'
                    : 'My Reports'}
                </span>

                <div className="rounded-xl bg-blue-100 p-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                </div>
              </div>

              <div className="mt-3 text-2xl font-black text-slate-900">
                {isAuthority
                  ? totalJurisdictionCount
                  : reportsCount}
              </div>

              <p className="mt-1 text-[11px] text-slate-500">
                {isAuthority
                  ? 'Reports in current jurisdiction'
                  : 'Filed from your account'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {isAuthority
                    ? 'Audited Cases'
                    : 'Verified Repairs'}
                </span>

                <div className="rounded-xl bg-emerald-100 p-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                </div>
              </div>

              <div className="mt-3 text-2xl font-black text-slate-900">
                {isAuthority
                  ? auditedCount
                  : verifiedCount}
              </div>

              <p className="mt-1 text-[11px] text-slate-500">
                {isAuthority
                  ? 'Verified or closed cases'
                  : 'Verified infrastructure repairs'}
              </p>
            </div>

          </div>

          {/* Account information */}
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">

            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Account Information
                </span>
              </div>
            </div>

            <div className="divide-y divide-slate-100 px-4">

              {isAuthority ? (
                <>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Briefcase className="h-4 w-4 text-slate-400" />
                      <span className="text-xs text-slate-500">
                        Designation
                      </span>
                    </div>

                    <span className="max-w-[230px] text-right text-xs font-semibold text-slate-800">
                      {user.designation ||
                        'Executive Engineer (Pothole Triage)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      <span className="text-xs text-slate-500">
                        Department
                      </span>
                    </div>

                    <span className="max-w-[230px] truncate text-right text-xs font-semibold text-slate-800">
                      {user.department ||
                        'Thane Municipal Corporation (Road Works)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      <span className="text-xs text-slate-500">
                        Jurisdiction
                      </span>
                    </div>

                    <span className="text-right text-xs font-semibold text-slate-800">
                      {user.jurisdiction ||
                        'Zone 2 (Wards 4, 7)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Lock className="h-4 w-4 text-slate-400" />
                      <span className="text-xs text-slate-500">
                        Official Badge ID
                      </span>
                    </div>

                    <span className="font-mono text-[11px] font-bold text-slate-700">
                      {user.employeeId ||
                        'ENG-MH-TMC-0482'}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Key className="h-4 w-4 text-slate-400" />
                      <span className="text-xs text-slate-500">
                        Citizen UID
                      </span>
                    </div>

                    <span className="max-w-[220px] truncate font-mono text-[11px] font-bold text-blue-600">
                      {user.uid}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span className="text-xs text-slate-500">
                        Registered On
                      </span>
                    </div>

                    <span className="text-xs font-semibold text-slate-800">
                      {formattedDate}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="h-4 w-4 text-slate-400" />
                      <span className="text-xs text-slate-500">
                        Account Status
                      </span>
                    </div>

                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Active & Verified
                    </span>
                  </div>
                </>
              )}

            </div>
          </div>

          {/* Actions */}
          <div className="mt-5 space-y-2.5">

            {isAuthority ? (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToAuthority?.();
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3.5 text-left transition hover:border-blue-300 hover:bg-blue-100"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
                    <Building2 className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-xs font-black text-slate-900">
                      Municipal Authority Hub
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Manage reports and verification
                    </p>
                  </div>
                </div>

                <ArrowRight className="h-4 w-4 text-blue-600" />
              </button>
            ) : (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToMyComplaints();
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3.5 text-left transition hover:border-blue-300 hover:bg-blue-100"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
                    <FileText className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-xs font-black text-slate-900">
                      My Complaints
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      View and track your reports
                    </p>
                  </div>
                </div>

                <ArrowRight className="h-4 w-4 text-blue-600" />
              </button>
            )}

            <button
              onClick={() => {
                onClose();
                logout();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-4 py-3 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>

          </div>

          {/* Footer note */}
          <div className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            RoadSetu secure civic account
          </div>

        </div>
      </div>
    </div>
  );
};
