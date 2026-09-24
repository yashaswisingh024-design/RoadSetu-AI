import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, ImagePlus, Loader2, Lock, MapPin, RefreshCw, ShieldCheck, Sparkles, Upload, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useComplaints } from '../context/ComplaintsContext';
import { HumanLocation } from '../types';
import { getCurrentUserLocation, reverseGeocodeCoords } from '../utils/reverseGeocode';
import { apiFetch } from '../lib/apiClient';
import { NavView } from '../components/Navbar';

interface ReportFlowViewProps { onNavigate: (view: NavView) => void; }
type Analysis = { defectType?: string; severity?: string; hazardScore?: number; confidence?: number; aiSummary?: string; recommendedAction?: string };
const emptyLocation: HumanLocation = { road:'', area:'', landmark:'', city:'', state:'', country:'India', formattedAddress:'', latitude:0, longitude:0 };

export const ReportFlowView: React.FC<ReportFlowViewProps> = ({ onNavigate }) => {
  const { user, openAuthModal, showToast } = useAuth();
  const { addComplaint, checkForDuplicates } = useComplaints();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [photoUrl,setPhotoUrl]=useState<string|null>(null);
  const [base64Image,setBase64Image]=useState<string|null>(null);
  const [description,setDescription]=useState('');
  const [location,setLocation]=useState<HumanLocation>(emptyLocation);
  const [locationLoading,setLocationLoading]=useState(true);
  const [locationError,setLocationError]=useState<string|null>(null);
  const [cameraOpen,setCameraOpen]=useState(false);
  const [cameraLoading,setCameraLoading]=useState(false);
  const [cameraPreview,setCameraPreview]=useState<string|null>(null);
  const [analyzing,setAnalyzing]=useState(false);
  const [analysis,setAnalysis]=useState<Analysis|null>(null);
  const [submitted,setSubmitted]=useState(false);
  const [nearbyReports,setNearbyReports]=useState(false);

  useEffect(()=>{
    let active=true;
    (async()=>{
      setLocationLoading(true);
      const result=await getCurrentUserLocation(true);
      if(!active)return;
      if(result.status==='success'&&result.coords){
        try{ setLocation(await reverseGeocodeCoords(result.coords.latitude,result.coords.longitude)); setLocationError(null); }
        catch{ setLocation({...emptyLocation,city:result.city||'',state:result.region||'',country:result.country||'India',formattedAddress:result.city||'Current location',latitude:result.coords.latitude,longitude:result.coords.longitude}); }
      }else setLocationError(result.errorMessage||'Location access was not available.');
      setLocationLoading(false);
    })();
    return()=>{active=false;streamRef.current?.getTracks().forEach(t=>t.stop());};
  },[]);

  const setImage=(dataUrl:string)=>{setPhotoUrl(dataUrl);setBase64Image(dataUrl);setAnalysis(null);setSubmitted(false);setNearbyReports(false);};
  const handleFile=(e:React.ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/')){showToast('Please choose an image file.','error');return;}const reader=new FileReader();reader.onload=()=>setImage(String(reader.result));reader.readAsDataURL(file);e.target.value='';};
  const openCamera=async()=>{
    if(!navigator.mediaDevices?.getUserMedia){cameraInputRef.current?.click();return;}
    setCameraLoading(true);setCameraPreview(null);
    try{streamRef.current?.getTracks().forEach(t=>t.stop());const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}},audio:false});streamRef.current=stream;setCameraOpen(true);requestAnimationFrame(()=>{if(videoRef.current){videoRef.current.srcObject=stream;videoRef.current.play().catch(()=>undefined);}});}
    catch(error){const name=error instanceof DOMException?error.name:'';showToast(name==='NotAllowedError'?'Camera permission was denied. Allow camera access and try again.':'Unable to access the camera. You can use Upload Image instead.','info');}
    finally{setCameraLoading(false);}
  };
  const closeCamera=()=>{streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;setCameraOpen(false);setCameraPreview(null);};
  const captureFrame=()=>{const video=videoRef.current,canvas=canvasRef.current;if(!video||!canvas||!video.videoWidth||!video.videoHeight){showToast('Camera is still starting. Please wait a moment.','info');return;}canvas.width=video.videoWidth;canvas.height=video.videoHeight;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.drawImage(video,0,0,canvas.width,canvas.height);setCameraPreview(canvas.toDataURL('image/jpeg',0.9));streamRef.current?.getTracks().forEach(t=>t.stop());streamRef.current=null;};
  const refreshLocation=async()=>{setLocationLoading(true);setLocationError(null);const result=await getCurrentUserLocation(true);if(result.status==='success'&&result.coords){try{setLocation(await reverseGeocodeCoords(result.coords.latitude,result.coords.longitude));showToast('Live location updated.','success');}catch{setLocation({...emptyLocation,city:result.city||'',state:result.region||'',country:result.country||'India',formattedAddress:result.city||'Current location',latitude:result.coords.latitude,longitude:result.coords.longitude});}}else setLocationError(result.errorMessage||'Unable to retrieve your location.');setLocationLoading(false);};
  const analyzeAndSubmit=async()=>{
    if(!photoUrl||!base64Image){showToast('Capture or upload a road image first.','info');return;}
    if(!location.latitude&&!location.longitude){showToast('Add a valid location before submitting.','info');return;}
    if(!user){openAuthModal('login');return;}
    const nearby=checkForDuplicates(location.latitude,location.longitude);setNearbyReports(Boolean(nearby.existingComplaint));setAnalyzing(true);
    try{
      const response=await apiFetch('/api/analyze-defect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageBase64:base64Image,description,location})});
      if(!response.ok)throw new Error((await response.text().catch(()=>''))||`AI analysis failed with HTTP ${response.status}.`);
      const json=await response.json();const data:Analysis=json.data||json;
      if(!data?.defectType||!data?.severity)throw new Error('AI analysis returned an incomplete result.');
      setAnalysis(data);
      const created=await addComplaint({description:description.trim()||data.aiSummary||'Road defect reported from image analysis.',location,beforeImage:photoUrl,severity:data.severity as any,defectType:data.defectType,hazardScore:data.hazardScore,confidence:data.confidence,aiSummary:data.aiSummary,recommendedAction:data.recommendedAction,estimatedRepairDays:data.severity==='Critical'?1:data.severity==='High'?2:4,department:`${location.city||'Municipal'} Road Engineering Division`});
      setSubmitted(Boolean(created));showToast('Report submitted successfully.','success');
    }catch(error){console.error('Road defect submission failed:',error);showToast(error instanceof Error?error.message:'Could not complete the report. Please try again.','error');}
    finally{setAnalyzing(false);}
  };

  if(!user)return <div className="min-h-[80vh] bg-slate-50 flex items-center justify-center p-6"><div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl"><div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Lock className="h-7 w-7"/></div><h1 className="text-2xl font-black text-slate-900">Report a Road Defect</h1><p className="mt-2 text-sm text-slate-500">Sign in to submit a verified civic report with your image and location.</p><button onClick={()=>openAuthModal('login')} className="mt-7 w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white hover:bg-blue-700">Sign in to continue</button></div></div>;

  return <div className="min-h-[80vh] bg-slate-50 px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto max-w-6xl"><div className="mb-8"><div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700"><Sparkles className="h-3.5 w-3.5"/>AI-assisted road reporting</div><h1 className="mt-4 text-3xl font-black text-slate-900 sm:text-4xl">Report a Road Defect</h1><p className="mt-2 text-sm text-slate-500">Capture the road condition, confirm where it is, and let AI analyze the evidence.</p></div>
    <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold text-slate-900">Road image</h2><p className="mt-1 text-xs text-slate-500">Use a fresh photo or choose one from your device.</p></div><ImagePlus className="h-5 w-5 text-blue-600"/></div>
        {photoUrl?<div className="relative overflow-hidden rounded-2xl"><img src={photoUrl} alt="Selected road condition" className="max-h-[430px] w-full object-cover"/><button onClick={()=>{setPhotoUrl(null);setBase64Image(null);setAnalysis(null);}} className="absolute right-3 top-3 rounded-full bg-white p-2 shadow"><X className="h-4 w-4"/></button></div>:<div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-center"><ImagePlus className="mb-3 h-10 w-10 text-blue-500"/><h3 className="font-bold text-slate-900">Add a clear road image</h3><p className="mt-1 text-xs text-slate-500">A visible road surface helps the AI identify the defect.</p></div>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><button onClick={()=>void openCamera()} disabled={cameraLoading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{cameraLoading?<Loader2 className="h-4 w-4 animate-spin"/>:<Camera className="h-4 w-4"/>}Capture Live Image</button><button onClick={()=>fileInputRef.current?.click()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"><Upload className="h-4 w-4"/>Upload Image</button><input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden"/><input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden"/></div>
        <label className="mt-6 block"><span className="text-xs font-bold text-slate-700">What did you notice? <span className="font-normal text-slate-400">(optional)</span></span><textarea value={description} onChange={e=>setDescription(e.target.value)} rows={4} placeholder="e.g. Large pothole near the left lane after the junction..." className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"/></label>
      </section>
      <aside className="space-y-5"><section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><h2 className="font-bold text-slate-900">Location</h2><p className="mt-1 text-xs text-slate-500">Used to route the report to the right area.</p></div><MapPin className="h-5 w-5 text-blue-600"/></div><div className="mt-4 rounded-2xl bg-slate-50 p-4">{locationLoading?<div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Detecting your location…</div>:location.formattedAddress?<><p className="text-sm font-semibold text-slate-900">{location.formattedAddress}</p><p className="mt-1 text-xs text-slate-500">{location.road}{location.area?` · ${location.area}`:''}</p></>:<p className="text-sm text-amber-600">Location not available</p>}</div>{locationError&&<p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{locationError}</p>}<button onClick={refreshLocation} disabled={locationLoading} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700"><RefreshCw className="h-3.5 w-3.5"/>Use current location</button></section>
        <section className="rounded-3xl border border-blue-100 bg-blue-50/60 p-5"><div className="flex items-center gap-2 text-blue-700"><Sparkles className="h-4 w-4"/><h2 className="font-bold">AI analysis</h2></div>{analysis?<div className="mt-4 space-y-3"><div className="rounded-xl bg-white p-3"><p className="text-[11px] uppercase text-slate-400">Detected defect</p><p className="mt-1 font-bold text-slate-900">{analysis.defectType}</p></div><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-white p-3"><p className="text-[11px] uppercase text-slate-400">Severity</p><p className="mt-1 font-bold">{analysis.severity}</p></div><div className="rounded-xl bg-white p-3"><p className="text-[11px] uppercase text-slate-400">Confidence</p><p className="mt-1 font-bold text-blue-700">{analysis.confidence??'—'}%</p></div></div><p className="rounded-xl bg-white p-3 text-xs text-slate-600">{analysis.aiSummary||'Analysis completed.'}</p></div>:<p className="mt-4 rounded-2xl bg-white p-4 text-xs text-slate-500">Your image is analyzed when you submit.</p>}</section></aside>
    </div>
    {nearbyReports&&<div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><strong>Nearby report found.</strong> Another citizen may have reported an issue close to this location.</div>}
    <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-between"><button onClick={()=>onNavigate('dashboard')} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700">Back to dashboard</button><button onClick={analyzeAndSubmit} disabled={analyzing||submitted} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-3 text-sm font-black text-white disabled:opacity-60">{analyzing?<><Loader2 className="h-4 w-4 animate-spin"/>Analyzing image…</>:submitted?<><CheckCircle2 className="h-4 w-4"/>Report submitted</>:<><Sparkles className="h-4 w-4"/>Analyze & Submit Report</>}</button></div><div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-slate-400"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600"/>Your authenticated account is attached to the report.</div>
    </div>
    {cameraOpen&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"><div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-4"><b>Capture live road image</b><button onClick={closeCamera}><X className="h-5 w-5"/></button></div>{cameraPreview?<img src={cameraPreview} alt="Captured road preview" className="aspect-video w-full bg-slate-950 object-contain"/>:<video ref={videoRef} autoPlay playsInline muted className="aspect-video w-full bg-slate-950 object-cover"/>}<div className="grid gap-3 p-5 sm:grid-cols-2">{cameraPreview?<><button onClick={()=>{setCameraPreview(null);void openCamera();}} className="rounded-xl border py-3 font-semibold">Retake</button><button onClick={()=>{setImage(cameraPreview);setCameraPreview(null);setCameraOpen(false);}} className="rounded-xl bg-blue-600 py-3 font-bold text-white">Use Photo</button></>:<button onClick={captureFrame} className="rounded-xl bg-blue-600 py-3 font-bold text-white sm:col-span-2">Capture Image</button>}</div></div></div>}
    <canvas ref={canvasRef} className="hidden"/>
  </div>;
};