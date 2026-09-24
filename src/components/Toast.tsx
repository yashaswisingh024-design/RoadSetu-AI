import React from 'react';
import { useAuth } from '../context/AuthContext';
export const Toast: React.FC = () => { const { toast } = useAuth() as any; if(!toast) return null; return <div className="fixed bottom-5 right-5 z-[100] max-w-sm rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-2xl">{toast.message || toast}</div>; };
