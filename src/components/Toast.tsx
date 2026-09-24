import React from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Toast: React.FC = () => {
  const { toastMessage } = useAuth();
  if (!toastMessage) return null;
  const Icon = toastMessage.type === 'success' ? CheckCircle2 : toastMessage.type === 'error' ? AlertCircle : Info;
  const tone = toastMessage.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : toastMessage.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-blue-200 bg-blue-50 text-blue-800';
  return <div className={`fixed bottom-5 right-5 z-[100] flex max-w-sm items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-2xl ${tone}`}><Icon className="h-5 w-5 shrink-0"/><span>{toastMessage.text}</span></div>;
};
