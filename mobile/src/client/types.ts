export type ClientRecord = {
  id: string;
  full_name: string;
  email: string;
  pontos: number | null;
  cashback_saldo: number | null;
  photo_url?: string | null;
  phone?: string | null;
  rg?: string | null;
  cpf?: string | null;
  birth_date?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  health_notes?: string | null;
  image_authorization?: boolean | null;
};

export type TrailRecord = {
  id: string;
  title: string;
  date: string;
  price: number;
  description?: string | null;
  difficulty?: string | null;
  duration_hours?: number | null;
  distance_km?: number | null;
  max_capacity?: number | null;
  flyer_url?: string | null;
  images?: string[] | null;
  video_url?: string | null;
  checklist_items?: string[] | null;
  accepted_payment_methods?: string[] | null;
  guide_name?: string | null;
  location?: string | null;
};

export type ProductRecord = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  image?: string | null;
  active: boolean;
};

export type MainTab = "home" | "trails" | "store" | "ranking" | "profile";

export type ClientRoute =
  | { name: MainTab }
  | { name: "trail-detail"; trail: TrailRecord; owned: boolean }
  | { name: "trail-checkout"; trail: TrailRecord }
  | { name: "product-checkout"; product: ProductRecord }
  | { name: "wallet" }
  | { name: "recharge" }
  | { name: "passport" }
  | { name: "contracts" }
  | { name: "album"; agendaId: string; title: string }
  | { name: "profile-edit" }
  | { name: "safety" }
  | { name: "benefits" }
  | { name: "settings" };
