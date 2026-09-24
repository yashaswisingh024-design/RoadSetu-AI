import React from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Compass,
  FilePlus,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { NavView } from '../components/Navbar';

interface LandingViewProps {
  onNavigate: (view: NavView) => void;
}

/**
 * Public landing page for RoadSetu AI.
 *
 * This file intentionally keeps the landing page self-contained so it does not
 * depend on complaint data being available during the initial application boot.
 * That makes the public route resilient even when Firebase is still loading.
 */
export const LandingView: React.FC<LandingViewProps> = ({ onNavigate }) => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />
      <div className="pointer-events-none absolute -top-48 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-blue-100/70 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-blue-700 shadow-sm">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-500" />
            Civic Infrastructure Accountability Engine
          </div>

          <h1 className="mt-8 text-5xl font-black leading-tight tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
            Report it. Track it.{' '}
            <span className="text-blue-600">Verify it.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            RoadSetu AI connects citizen road reports with AI analysis,
            geolocation, municipal routing and repair verification in one
            accountable workflow.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => onNavigate('report')}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 active:scale-95"
            >
              <FilePlus className="h-4 w-4" />
              Report a Road Issue
            </button>

            <button
              onClick={() => onNavigate('map')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
            >
              <Compass className="h-4 w-4 text-blue-600" />
              Explore Live Map
            </button>

            <button
              onClick={() => onNavigate('verification')}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
            >
              <CheckCircle2 className="h-4 w-4" />
              AI Verification
            </button>
          </div>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-3">
          <FeatureCard
            icon={<MapPin className="h-5 w-5" />}
            title="Geotagged Reporting"
            text="Capture a road problem with location context and a human-readable corridor address."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="AI-Assisted Verification"
            text="Analyze evidence and track the repair lifecycle instead of treating a complaint as closed after submission."
          />
          <FeatureCard
            icon={<BarChart3 className="h-5 w-5" />}
            title="Public Accountability"
            text="Follow complaint status, municipal action and verification evidence through a transparent workflow."
          />
        </div>

        <div className="mt-16 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
          <div className="grid lg:grid-cols-2">
            <div className="p-7 sm:p-10">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
                End-to-End Civic Pipeline
              </span>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                From citizen report to verified repair
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                RoadSetu AI is designed around a traceable lifecycle: report,
                analyze, route, repair, verify and account.
              </p>

              <button
                onClick={() => onNavigate('accountability')}
                className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800"
              >
                View accountability dashboard
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-950 p-6 sm:grid-cols-3">
              {['Citizen Report', 'AI Analysis', 'Smart Routing', 'Repair Evidence', 'AI Verification', 'Accountability'].map(
                (step, index) => (
                  <div
                    key={step}
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-4"
                  >
                    <div className="font-mono text-xs font-bold text-blue-400">
                      0{index + 1}
                    </div>
                    <div className="mt-3 text-xs font-bold leading-5 text-white">
                      {step}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const FeatureCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  text: string;
}> = ({ icon, title, text }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
      {icon}
    </div>
    <h3 className="mt-5 text-base font-bold text-slate-900">{title}</h3>
    <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
  </div>
);
