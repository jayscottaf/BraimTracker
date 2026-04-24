export type Role = "OWNER" | "WORKER";

export type JobStatus =
  | "DRAFT"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "AWAITING_REVIEW"
  | "APPROVED"
  | "PAID";

export type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type PhotoType = "INSTRUCTION" | "BEFORE" | "AFTER";
export type PriceMode = "HOURLY" | "FLAT";

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string | null;
  hourlyRate?: string | number | null;
}

export interface Zone {
  id: string;
  name: string;
  description: string | null;
  priority: Priority;
  referencePhoto: string | null;
  notes: string | null;
  createdAt: string;
  _count?: { jobs: number };
  jobs?: Job[];
}

export interface WorkerProfile {
  id: string;
  userId: string;
  hourlyRate: string | number;
  phone: string | null;
  active: boolean;
}

export interface Worker extends User {
  loginCode: string | null;
  workerProfile: WorkerProfile | null;
  _count?: { assignedJobs: number };
}

export interface JobPhoto {
  id: string;
  jobId: string;
  type: PhotoType;
  url: string;
  pathname: string;
  caption: string | null;
  uploadedById: string;
  createdAt: string;
}

export interface JobTask {
  id: string;
  jobId: string;
  label: string;
  done: boolean;
  doneAt: string | null;
  doneById: string | null;
  order: number;
}

export interface TimeEntry {
  id: string;
  jobId: string;
  workerId: string;
  startAt: string;
  endAt: string | null;
  durationMinutes: number | null;
  manualEntry: boolean;
  notes: string | null;
}

export interface Payment {
  id: string;
  jobId: string;
  amount: string | number;
  paid: boolean;
  paidAt: string | null;
  method: string | null;
  notes: string | null;
  createdAt: string;
  job?: {
    id: string;
    title: string;
    zone: { name: string };
    assignedWorker: { id: string; name: string } | null;
  };
}

export interface ActivityItem {
  id: string;
  jobId: string | null;
  actorId: string;
  action: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
  actor?: { id: string; name: string; role: Role };
}

export interface Job {
  id: string;
  title: string;
  description: string | null;
  zoneId: string;
  zone?: Zone;
  taskType: string;
  instructions: string | null;
  priority: Priority;
  status: JobStatus;
  assignedWorkerId: string | null;
  assignedWorker: { id: string; name: string } | null;
  targetDate: string | null;
  estimatedHours: string | number | null;
  actualHours: string | number | null;
  priceMode: PriceMode;
  hourlyRate: string | number;
  flatRate: string | number | null;
  totalOwed: string | number | null;
  ownerNotes: string | null;
  workerNotes: string | null;
  createdAt: string;
  updatedAt: string;
  photos?: JobPhoto[];
  tasks?: JobTask[];
  timeEntries?: TimeEntry[];
  payment?: Payment | null;
  activity?: ActivityItem[];
  _count?: { tasks: number; photos: number; timeEntries: number };
}

export interface DashboardSummary {
  counts: { active: number; awaiting: number; completed: number };
  weekHours: number;
  unpaidTotal: number;
  recentJobs: Job[];
}
