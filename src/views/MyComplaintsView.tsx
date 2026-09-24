import React from 'react';
import { FileText, MapPin, ArrowRight } from 'lucide-react';
import { useComplaints } from '../context/ComplaintsContext';
import { Complaint } from '../types';
import { NavView } from '../components/Navbar';

interface MyComplaintsViewProps {
  onNavigate: (view: NavView) => void;
  onSelectComplaintForVerification?: (complaint: Complaint) => void;
}

export const MyComplaintsView: React.FC<MyComplaintsViewProps> = ({ onNavigate, onSelectComplaintForVerification }) => {
  const { userComplaints } = useComplaints();
  return <div className="min-h-[80vh] bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl"><div className="mb-6"><h1 className="text-3xl font-black">My Complaints</h1><p className="mt-2 text-sm text-slate-500">Track reports submitted from your account.</p></div>{userComplaints.length===0?<div className="rounded-3xl border border-slate-200 bg-white p-10 text-center"><FileText className="mx-auto h-10 w-10 text-blue-500"/><h2 className="mt-4 font-bold">No complaints yet</h2><button onClick={()=>onNavigate('report')} className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white">Report a road issue</button></div>:<div className="grid gap-4">{userComplaints.map(c=><button key={c.id} onClick={()=>onSelectComplaintForVerification?.(c)} className="w-full rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-blue-300"><div className="flex items-start justify-between gap-4"><div><span className="font-mono text-xs text-blue-600">{c.id}</span><h2 className="mt-1 font-bold">{c.defectType}</h2><p className="mt-1 text-sm text-slate-500">{c.description}</p><p className="mt-2 flex items-center gap-1 text-xs text-slate-400"><MapPin className="h-3 w-3"/>{c.location.formattedAddress || c.location.city}</p></div><ArrowRight className="h-5 w-5 text-slate-400"/></div><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{c.status}</span><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{c.severity}</span></div></button>)}</div>}</div></div>;
};
