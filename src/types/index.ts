export type Role = "student" | "admin";
export type CourseLevel = "beginner" | "intermediate" | "advanced";
export type CourseStatus = "draft" | "published";
export type LessonType = "video" | "text" | "quiz";
export type EnrollmentStatus = "active" | "pending" | "completed" | "cancelled";
export type RequestStatus = "pending" | "approved" | "rejected";
export type ReviewStatus = "visible" | "hidden";

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  role: Role;
  createdAt: number;
  updatedAt: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;      // مفتاح lucide
  order: number;
  isActive: boolean;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  shortDescription: string;
  description: string;
  thumbnail: string;
  categoryId: string;
  level: CourseLevel;
  isFree: boolean;
  price: number;
  currency: string;
  isFeatured: boolean;
  status: CourseStatus;
  instructorName: string;
  instructorBio?: string;
  durationMinutes: number;
  lessonsCount: number;
  sectionsCount: number;
  rating: number;
  ratingsCount: number;
  studentsCount: number;
  seo?: { title?: string; description?: string; ogImage?: string };
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
}

export interface Section { id: string; title: string; order: number; }

export interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  order: number;
  durationMinutes: number;
  videoId?: string;
  content?: string;
  quizId?: string;
}

export interface QuizQuestion {
  id: string;
  type: "mcq" | "truefalse";
  text: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface Quiz {
  id: string;
  courseId: string;
  lessonId: string;
  title: string;
  passScore: number;   // 0–100
  questions: QuizQuestion[];
}

export interface Enrollment {
  id: string;          // {uid}_{courseId}
  studentId: string;
  courseId: string;
  status: EnrollmentStatus;
  progress: number;
  lastLessonId?: string;
  enrolledAt: number;
  completedAt?: number;
}

export interface Progress {
  id: string;          // {uid}_{courseId}
  studentId: string;
  courseId: string;
  completedLessons: string[];
  quizResults: { quizId: string; score: number; passed: boolean; at: number }[];
  updatedAt: number;
}

export interface Review {
  id: string;
  courseId: string;
  studentId: string;
  studentName: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  createdAt: number;
}

export interface Certificate {
  id: string;
  studentId: string;
  courseId: string;
  studentName: string;
  courseTitle: string;
  issuedAt: number;
  isActive: boolean;
}

export interface EnrollmentRequest {
  id: string;
  studentId: string;
  courseId: string;
  status: RequestStatus;
  note?: string;
  createdAt: number;
  processedAt?: number;
}

export interface GlobalStats {
  students: number;
  courses: number;
  lessons: number;
  certificates: number;
}
