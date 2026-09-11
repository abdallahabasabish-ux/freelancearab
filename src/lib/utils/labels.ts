import type { CourseLevel } from "@/types";

export const levelLabels: Record<CourseLevel, string> = {
  beginner: "مبتدئ",
  intermediate: "متوسط",
  advanced: "متقدم",
};

export const categoriesIconMap: Record<string, string> = {
  briefcase: "Briefcase",
  "pen-line": "PenLine",
  search: "Search",
  palette: "Palette",
  "code-2": "Code2",
  megaphone: "Megaphone",
  sparkles: "Sparkles",
  globe: "Globe",
};

export const WHATSAPP_URL = process.env.NEXT_PUBLIC_WHATSAPP_URL ?? "https://wa.me/";
