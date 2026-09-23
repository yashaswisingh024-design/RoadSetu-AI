import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, collection, doc, setDoc, updateDoc, onSnapshot, query, where, sanitizeForFirestore } from '../lib/firebase';
import { Complaint, VerificationResult, NotificationItem, DuplicateCheckResult } from '../types';
import { useAuth } from './AuthContext';
import { calculateDistanceMeters } from '../utils/reverseGeocode';

interface ComplaintsContextType {
  complaints: Complaint[];
  userComplaints: Complaint[];
  notifications: NotificationItem[];
  unreadNotificationCount: number;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
  checkForDuplicates: (latitude: number, longitude: number) => DuplicateCheckResult;
  supportComplaint: (complaintId: string) => Promise<void>;
  addComplaint: (data: { description: string; location: Complaint['location']; beforeImage: string; severity?: Complaint['severity']; defectType?: string; hazardScore?: number; confidence?: number; aiSummary?: string; recommendedAction?: string; estimatedRepairDays?: number; department?: string; }) => Promise<Complaint>;
  updateComplaintStatus: (id: string, status: Complaint['status'], extra?: Partial<Complaint>) => Promise<void>;
  updateVerification: (id: string, verification: VerificationResult) => Promise<void>;
  getComplaintById: (id: string) => Complaint | undefined;
  stats: { totalReported: number; totalRepaired: number; totalVerified: number; awaitingRepair: number; inRepair: number; verifiedClosed: number; allPlatformReportsCount: number; allPlatformVerifiedCount: number; fraudBlockedAmount: number; avgConfidence: number; };
}

const ComplaintsContext = createContext<ComplaintsContextType | undefined>(undefined);
const DUPLICATE_RADIUS_METERS = 50;
const ACTIVE_STATUSES = new Set<Complaint['status']>(['reported','ai_analyzed','routed','assigned','repair_in_progress','repair_claimed','suspicious']);
const MAX_FIRESTORE_IMAGE_CHARS = 360_000;

/** Firestore documents are limited to 1 MiB. Keep the stored preview comfortably below that limit.
 * The full-size image is still used by the AI request before this function is called.
 */
async function prepareFirestoreImage(input: string): Promise<string> {
  if (!input || !input.startsWith('data:image/')) return input || '';
  if (input.length <= MAX_FIRESTORE_IMAGE_CHARS) return input;

  try {
    const compressed = await new Promise<string>((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        let width = Math.min(image.naturalWidth || image.width, 640);
        let height = Math.max(1, Math.round((image.naturalHeight || image.height) * (width / (image.naturalWidth || image.width))));
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas unavailable'));
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(image, 0, 0, width, height);

        let result = canvas.toDataURL('image/jpeg', 0.55);
        for (let quality = 0.45; result.length > MAX_FIRESTORE_IMAGE_CHARS && quality >= 0.2; quality -= 0.05) {
          result = canvas.toDataURL('image/jpeg', quality);
        }
        if (result.length > MAX_FIRESTORE_IMAGE_CHARS) {
          width = 480;
          height = Math.max(1, Math.round((image.naturalHeight || image.height) * (width / (image.naturalWidth || image.width))));
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(image, 0, 0, width, height);
          result = canvas.toDataURL('image/jpeg', 0.35);
        }
        resolve(result.length <= MAX_FIRESTORE_IMAGE_CHARS ? result : '');
      };
      image.onerror = () => reject(new Error('Unable to decode image'));
      image.src = input;
    });
    return compressed;
  } catch (error) {
    console.warn('Firestore image preview compression failed:', error);
    return '';
  }
}

export const ComplaintsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, showToast } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const reportsRef = collection(db, 'reports');
    return onSnapshot(reportsRef, snapshot => {
      const loaded: Complaint[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const rawAfter = data.afterImage || data.repairImage || null;
        const isLegacyCake = typeof rawAfter === 'string' && (rawAfter.includes('photo-1578985545062') || rawAfter.toLowerCase().includes('cake') || rawAfter.toLowerCase().includes('pastry'));
        loaded.push({
          id: docSnap.id,
          userId: data.reporterId || data.userId || '',
          userEmail: data.reporterEmail || data.userEmail || '',
          userName: data.reporterName || data.userName || 'Citizen',
          description: data.description || '',
          location: data.location || { road:'Unknown road', area:'', city:'', state:'', formattedAddress:'', latitude:0, longitude:0 },
          defectType: data.defectType || 'Pothole',
          severity: data.severity || 'High',
          hazardScore: typeof data.hazardScore === 'number' ? data.hazardScore : 0,
          confidence: typeof data.confidence === 'number' ? data.confidence : undefined,
          aiSummary: data.aiSummary,
          recommendedAction: data.recommendedAction,
          priority: data.priority || 'Standard P3',
          department: data.assignedDepartment || data.department || 'Municipal Road Engineering',
          status: data.status || 'reported',
          beforeImage: data.beforeImage || data.imageUrl || '',
          afterImage: isLegacyCake ? null : (rawAfter || null),
          repairStatus: data.repairStatus,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
          estimatedRepairDays: data.estimatedRepairDays || 2,
          contractorClaimed: Boolean(data.contractorClaimed),
          contractorNotes: data.contractorNotes,
          verification: isLegacyCake ? undefined : data.verification,
        });
      });
      loaded.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setComplaints(loaded);
    }, error => console.warn('Firestore reports subscription notice:', error));
  }, []);

  useEffect(() => {
    if (!user?.uid) { setNotifications([]); return; }
    const q = query(collection(db, 'notifications'), where('userId', '==', user.uid));
    return onSnapshot(q, snapshot => {
      const loaded: NotificationItem[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        loaded.push({ id: docSnap.id, userId: data.userId, reportId: data.reportId, title: data.title || 'Status Update', message: data.message || '', type: data.type || 'alert', read: Boolean(data.read), createdAt: data.createdAt || new Date().toISOString() });
      });
      loaded.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(loaded);
    }, error => console.warn('Notifications snapshot error:', error));
  }, [user?.uid]);

  const userComplaints = complaints.filter(c => user?.uid === c.userId);

  const checkForDuplicates = (latitude: number, longitude: number): DuplicateCheckResult => {
    if (!user?.uid || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return { hasDuplicate:false };
    const nearest = complaints.filter(c => {
      const lat = Number(c.location?.latitude), lng = Number(c.location?.longitude);
      return ACTIVE_STATUSES.has(c.status) && Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
    }).map(c => ({ complaint:c, distance:calculateDistanceMeters(latitude, longitude, Number(c.location.latitude), Number(c.location.longitude)) }))
      .filter(x => x.distance <= DUPLICATE_RADIUS_METERS)
      .sort((a,b) => a.distance - b.distance || new Date(b.complaint.createdAt).getTime() - new Date(a.complaint.createdAt).getTime())[0];
    if (!nearest) return { hasDuplicate:false };
    return { hasDuplicate:false, existingComplaint:nearest.complaint, distanceMeters:Math.round(nearest.distance), isOwnComplaint:nearest.complaint.userId === user.uid };
  };

  const supportComplaint = async (complaintId: string) => {
    if (!user?.uid) throw new Error('You must be signed in to support a civic report.');
    const complaint = complaints.find(c => c.id === complaintId);
    if (!complaint) throw new Error('Complaint not found.');
    if (complaint.userId === user.uid) throw new Error('You cannot support your own complaint.');
    if (!ACTIVE_STATUSES.has(complaint.status)) throw new Error('This complaint is no longer active.');
    await setDoc(doc(db,'reports',complaintId,'supporters',user.uid), sanitizeForFirestore({ uid:user.uid, createdAt:new Date().toISOString() }), { merge:false });
    showToast('Existing report confirmed. Thank you for supporting the issue.','success');
  };

  const addComplaint = async (data: { description:string; location:Complaint['location']; beforeImage:string; severity?:Complaint['severity']; defectType?:string; hazardScore?:number; confidence?:number; aiSummary?:string; recommendedAction?:string; estimatedRepairDays?:number; department?:string; }): Promise<Complaint> => {
    if (!user) throw new Error('You must be signed in to submit a civic report.');
    const latitude = Number(data.location?.latitude), longitude = Number(data.location?.longitude);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) throw new Error('We could not determine a valid report location. Please enable location access or choose a valid location.');

    const randomSeq = Math.floor(100000 + Math.random()*900000);
    const stateCode = data.location.state?.slice(0,2).toUpperCase() || 'XX';
    const complaintId = `RS-${new Date().getFullYear()}-${stateCode}-${randomSeq}`;
    const now = new Date().toISOString();
    const severity = data.severity || 'High';
    const hazardScore = data.hazardScore ?? (severity === 'Critical' ? 92 : severity === 'High' ? 76 : 54);
    const confidence = data.confidence;

    // Store a small Firestore-safe preview instead of a potentially multi-megabyte base64 photo.
    // The original compressed image remains available to the AI request in ReportPotholeView.
    const firestoreImage = await prepareFirestoreImage(data.beforeImage || '');

    const newComplaint: Complaint = {
      id:complaintId, userId:user.uid, userEmail:user.email, userName:user.displayName || 'Citizen',
      description:data.description, location:{...data.location, latitude, longitude}, defectType:data.defectType || 'Pothole', severity,
      hazardScore, confidence, aiSummary:data.aiSummary, recommendedAction:data.recommendedAction,
      priority:severity === 'Critical' ? 'Urgent P1' : severity === 'High' ? 'High P2' : 'Standard P3',
      department:data.department || 'Municipal Road Engineering', status:'reported', beforeImage:firestoreImage,
      createdAt:now, updatedAt:now, estimatedRepairDays:data.estimatedRepairDays || (severity === 'Critical' ? 1 : 2), contractorClaimed:false,
    };

    try {
      const reportRef = doc(db,'reports',complaintId);
      const reportPayload = sanitizeForFirestore({
        id:complaintId, reporterId:user.uid, reporterEmail:user.email || '', reporterName:user.displayName || 'Citizen',
        description:newComplaint.description || '', imageUrl:firestoreImage, beforeImage:firestoreImage,
        location:{ road:newComplaint.location.road || '', area:newComplaint.location.area || '', landmark:newComplaint.location.landmark || '', city:newComplaint.location.city || '', state:newComplaint.location.state || '', country:newComplaint.location.country || 'India', formattedAddress:newComplaint.location.formattedAddress || '', latitude, longitude },
        defectType:newComplaint.defectType || 'Pothole', severity:newComplaint.severity, hazardScore:newComplaint.hazardScore,
        ...(confidence !== undefined ? {confidence} : {}), ...(newComplaint.aiSummary ? {aiSummary:newComplaint.aiSummary} : {}), ...(newComplaint.recommendedAction ? {recommendedAction:newComplaint.recommendedAction} : {}),
        priority:newComplaint.priority, assignedDepartment:newComplaint.department, status:newComplaint.status, createdAt:now, updatedAt:now,
        estimatedRepairDays:newComplaint.estimatedRepairDays, repairStatus:'pending_assignment',
      });
      await setDoc(reportRef, reportPayload);

      const notifId = `NOTIF-${Date.now()}-${Math.floor(Math.random()*1000)}`;
      await setDoc(doc(db,'notifications',notifId), sanitizeForFirestore({ id:notifId, userId:user.uid, reportId:complaintId, title:'Complaint Registered', message:`Your complaint ${complaintId} has been registered and routed to ${newComplaint.department}.`, type:'submission', read:false, createdAt:now }));
      await updateDoc(doc(db,'users',user.uid), { reportsCount:(user.reportsCount || 0) + 1 }).catch(error => console.warn('Could not increment user count:', error));
      showToast(`Complaint ${complaintId} submitted successfully!`,'success');
      return newComplaint;
    } catch (error) {
      console.error('Failed to save complaint to Firestore:', error);
      showToast('Error submitting report to database. Please check your connection.','error');
      throw error;
    }
  };

  const updateComplaintStatus = async (id:string, status:Complaint['status'], extra?:Partial<Complaint>) => {
    setComplaints(prev => prev.map(c => c.id === id ? {...c,status,updatedAt:new Date().toISOString(),...extra} : c));
    try {
      await updateDoc(doc(db,'reports',id), sanitizeForFirestore({status,updatedAt:new Date().toISOString(),...extra}));
      const comp = complaints.find(c => c.id === id);
      if (comp?.userId) {
        const notifId = `NOTIF-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        await setDoc(doc(db,'notifications',notifId), sanitizeForFirestore({id:notifId,userId:comp.userId,reportId:id,title:'Complaint Updated',message:`Status for ${id} changed to ${status.replace('_',' ')}.`,type:status === 'verified' ? 'verification' : 'repair',read:false,createdAt:new Date().toISOString()})).catch(error => console.warn('Notification save error:',error));
      }
      showToast(`Report ${id} updated to ${status.replace('_',' ')}.`,'info');
    } catch (error) { console.error('Failed to update complaint status in Firestore:',error); showToast('Status update failed to persist.','error'); throw error; }
  };

  const updateVerification = async (id:string, verification:VerificationResult) => {
    const isVerified = verification.status === 'verified';
    setComplaints(prev => prev.map(c => c.id === id ? {...c,status:isVerified ? 'verified' : 'suspicious',verification,updatedAt:new Date().toISOString()} : c));
    try {
      await updateDoc(doc(db,'reports',id), sanitizeForFirestore({status:isVerified ? 'verified' : 'suspicious',verificationStatus:verification.status,verificationScore:verification.overallScore,verification,updatedAt:new Date().toISOString()}));
      showToast(isVerified ? `Repair ${id} verified successfully!` : `Repair ${id} flagged as suspicious.`, isVerified ? 'success' : 'error');
    } catch (error) { console.error('Failed to update verification in Firestore:',error); showToast('Verification update failed to persist.','error'); throw error; }
  };

  const markNotificationAsRead = async (notificationId:string) => { await updateDoc(doc(db,'notifications',notificationId),{read:true}).catch(error => console.warn('Could not mark notification as read:',error)); };
  const getComplaintById = (id:string) => complaints.find(c => c.id === id);
  const awaitingRepair = userComplaints.filter(c => ['reported','ai_analyzed','routed','assigned'].includes(c.status)).length;
  const inRepair = userComplaints.filter(c => ['repair_in_progress','repair_claimed'].includes(c.status)).length;
  const verifiedClosed = userComplaints.filter(c => ['verified','closed'].includes(c.status)).length;
  const allPlatformReportsCount = complaints.length;
  const allPlatformVerifiedCount = complaints.filter(c => c.status === 'verified').length;
  const totalRepaired = complaints.filter(c => ['repair_in_progress','repair_claimed'].includes(c.status)).length;
  const totalVerified = allPlatformVerifiedCount;
  const suspiciousCount = complaints.filter(c => c.status === 'suspicious').length;
  const confidenceValues = complaints.map(c => c.confidence).filter((value): value is number => typeof value === 'number');
  const avgConfidence = confidenceValues.length ? Number((confidenceValues.reduce((sum,value) => sum + value,0)/confidenceValues.length).toFixed(1)) : 0;
  const fraudBlockedAmount = suspiciousCount * 45000;
  const unreadNotificationCount = notifications.filter(n => !n.read).length;

  return <ComplaintsContext.Provider value={{complaints,userComplaints,notifications,unreadNotificationCount,markNotificationAsRead,checkForDuplicates,supportComplaint,addComplaint,updateComplaintStatus,updateVerification,getComplaintById,stats:{totalReported:allPlatformReportsCount || userComplaints.length,totalRepaired,totalVerified,awaitingRepair,inRepair,verifiedClosed,allPlatformReportsCount,allPlatformVerifiedCount,fraudBlockedAmount,avgConfidence}}}>{children}</ComplaintsContext.Provider>;
};

export function useComplaints(): ComplaintsContextType {
  const context = useContext(ComplaintsContext);
  if (!context) throw new Error('useComplaints must be used within a ComplaintsProvider');
  return context;
}
