// Database types for TypeScript
export interface User {
  id: string;
  email: string;
  name: string;
  user_type: 'basic' | 'professional' | 'admin';
  remaining_images: number;
  total_images_processed: number;
  created_at: string;
  updated_at: string;
  last_login?: string;
  is_active: boolean;
  subscription_status: 'free' | 'active' | 'expired' | 'cancelled';
  stripe_customer_id?: string;
  profile_image_url?: string;
  // CAMPOS ADICIONADOS PELA FUNÇÃO RPC
  total_gasto?: number;
  pacotes_ativos?: number;
}

export interface Client {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  client_id?: string;
  name: string;
  status: 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
  // Campo especial que virá da nossa consulta ao banco de dados
  client?: { name: string };
  // Campo que podemos adicionar para facilitar a vida no frontend
  client_name?: string;
  images: { count: number }[];
}

export interface Package {
  id: string;
  name: string;
  description?: string;
  price: number;
  images: number;
  is_active: boolean;
  type: 'avulso' | 'mensal' | 'profissional';
  features?: string[];
  sort_order: number;
  is_most_popular?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  package_id?: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method?: string;
  stripe_payment_intent_id?: string;
  stripe_session_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  completed_at?: string;
}

export interface UploadedImage {
  id: string;
  user_id: string;
  original_filename: string;
  file_path: string;
  file_size?: number;
  mime_type?: string;
  width?: number;
  height?: number;
  upload_ip?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface ProcessedImage {
  id: string;
  user_id: string;
  project_id?: string; // Coluna que adicionamos
  uploaded_image_id?: string;
  processed_file_path: string;
  processing_type: string;
  file_size?: number;
  width?: number;
  height?: number;
  processing_time_seconds?: number;
  ai_model_used?: string;
  processing_parameters?: Record<string, unknown>;
  quality_score?: number;
  created_at: string;
}

export interface PlatformSettings {
  id: 1;
  max_file_size_mb: number;
  free_images_for_new_users: number;
  maintenance_mode: boolean;
  maintenance_message: string | null;
  allowed_file_types: string | null;
  stripe_publishable_key: string | null;
  default_currency: string;
  openai_model: string;
  prompt_modifier_food: string | null;
  prompt_modifier_vehicles: string | null;
  prompt_modifier_real_estate: string | null;
  prompt_modifier_products: string | null;
  terms_of_service_url: string | null;
  privacy_policy_url: string | null;
}
