import React from 'react';
import { CheckCircle2, ArrowLeft } from 'lucide-react';
import { useComplaints } from '../context/ComplaintsContext';
import { NavView } from '../components/Navbar';

interface VerificationCenterViewProps { onNavigate:(view:NavView)=>void; selectedComplaintId?:string|null; }
export const VerificationCenterView: React.FC<VerificationCenterViewProps> = ({ onNavigate, selectedComplaintId }) => {
 const { complaints } = useComplaints(); const selected=complaints.find(c=>c.id===selectedComplaintId);
 return <div className="min-h-[80vh] bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8"><div className="mx-auto max-w-5xl"><button onClick={()=>onNavigate('dashboard')} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><ArrowLeft className="h-4 w-4"/>Back</button><div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><CheckCircle2 className="h-7 w-7 text-emerald-600"/><div><h1 className="text-2xl font-black">Verification Center</h1><p className="mt-1 text-sm text-slate-500">Review repair and verification records.</p></div></div>{selected?<div className="mt-6 rounded-2xl bg-slate-50 p-5"><p className="font-mono text-xs text-blue-600">{selected.id}</p><h2 className="mt-1 font-bold">{selected.defectType}</h2><p className="mt-2 text-sm text-slate-600">{selected.description}</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{selected.status}</span><span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold">{selected.severity}</span></div></div>:<div className="mt-6 text-sm text-slate-500">Select a complaint from your reports or dashboard to review it here.</div>}</div></div></div>;
};
