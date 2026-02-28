// genOS Full v1.0.0 "Lumina" — server/types/dna.ts

export interface AudienceAnalytics {
  id: string;
  tenant_id: string;
  location: string[];
  age_groups: string[];
  genders: string[];
  purchase_interests: string[];
  lifestyle_markers: string[];
  content_consumption: Record<string, string>;
  sentiment_rules: Record<string, string>;
  dynamic_categories: string[];
  created_at: string;
  updated_at: string;
}

export interface DNAConstraints {
  limits: {
    description: { min: number; max: number };
    carousel: { title_max_words: number; paragraph_max_words: number; max_cards: number };
    reels: { title_max_words: number; max_frames: number };
    static_post: { title_max_words: number; paragraph_max_words: number };
  };
  fixed_elements: {
    footer_snippet: string;
    hashtags: string[];
  };
  sequence: string[];
}

export interface BrandDNA {
  id: string;
  tenant_id: string;
  voice_tone: Record<string, any>;
  voice_description: string;
  language: string;
  persona_name: string;
  content_rules: DNAConstraints | Record<string, any>; // Extended for generic or specific constraints
  forbidden_words: string[];
  hashtag_strategy: Record<string, any>;
  color_palette: Record<string, any>;
  sample_posts: any[];
  personality_traits: Record<string, any>;
  typography: Record<string, any>;
  target_audience: Record<string, any>;
  brand_values: Record<string, any>;
  created_at: string;
  updated_at: string;
}
