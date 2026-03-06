// genOS Full v1.0.0 "Lumina" — config/collections.ts
// Wix CMS Collection mappings and CSV slug registry

export interface CollectionMapping {
  csvSlug: string;
  wixCollectionId: string;
  supabaseTable: string;
  syncDirection: 'push' | 'pull' | 'bidirectional';
  description: string;
  fieldMap: Record<string, string>; // supabase_field → wix_field
}

export const COLLECTIONS: CollectionMapping[] = [
  {
    csvSlug: 'blog-posts',
    wixCollectionId: 'BlogPosts',
    supabaseTable: 'content_items',
    syncDirection: 'push',
    description: 'Blog posts and long-form articles',
    fieldMap: {
      title: 'title',
      body: 'richContent',
      status: 'status',
      pillar: 'category',
      hashtags: 'tags',
      visual_direction: 'coverImage',
    },
  },
  {
    csvSlug: 'social-posts',
    wixCollectionId: 'SocialPosts',
    supabaseTable: 'content_items',
    syncDirection: 'push',
    description: 'Social media posts (Instagram, LinkedIn, etc.)',
    fieldMap: {
      title: 'title',
      body: 'caption',
      platform: 'platform',
      status: 'status',
      hashtags: 'hashtags',
      pillar: 'contentPillar',
    },
  },
  {
    csvSlug: 'client-accounts',
    wixCollectionId: 'ClientAccounts',
    supabaseTable: 'tenants',
    syncDirection: 'bidirectional',
    description: 'Client account registry',
    fieldMap: {
      name: 'clientName',
      slug: 'slug',
      plan: 'plan',
      status: 'status',
    },
  },
  {
    csvSlug: 'portfolio-items',
    wixCollectionId: 'PortfolioItems',
    supabaseTable: 'content_items',
    syncDirection: 'push',
    description: 'Portfolio showcase items',
    fieldMap: {
      title: 'projectName',
      body: 'description',
      visual_direction: 'coverImage',
      extra_fields: 'projectDetails',
    },
  },
  {
    csvSlug: 'services-catalog',
    wixCollectionId: 'ServicesCatalog',
    supabaseTable: 'content_items',
    syncDirection: 'push',
    description: 'Services and packages catalog',
    fieldMap: {
      title: 'serviceName',
      body: 'description',
      extra_fields: 'pricing',
    },
  },
  {
    csvSlug: 'testimonials',
    wixCollectionId: 'Testimonials',
    supabaseTable: 'content_items',
    syncDirection: 'pull',
    description: 'Client testimonials and reviews',
    fieldMap: {
      title: 'clientName',
      body: 'testimonialText',
      extra_fields: 'rating',
    },
  },
  {
    csvSlug: 'team-members',
    wixCollectionId: 'TeamMembers',
    supabaseTable: 'content_items',
    syncDirection: 'push',
    description: 'Team member profiles',
    fieldMap: {
      title: 'name',
      body: 'bio',
      extra_fields: 'role',
    },
  },
  {
    csvSlug: 'travel-destinations',
    wixCollectionId: 'TravelDestinations',
    supabaseTable: 'content_items',
    syncDirection: 'push',
    description: 'Travel content and destination guides',
    fieldMap: {
      title: 'destinationName',
      body: 'description',
      extra_fields: 'location',
    },
  },
  {
    csvSlug: 'faq-entries',
    wixCollectionId: 'FAQEntries',
    supabaseTable: 'content_items',
    syncDirection: 'push',
    description: 'FAQ and knowledge base entries',
    fieldMap: {
      title: 'question',
      body: 'answer',
      extra_fields: 'category',
    },
  },
];

export function getCollectionByCsvSlug(slug: string): CollectionMapping | undefined {
  return COLLECTIONS.find(c => c.csvSlug === slug);
}

export function getCollectionByWixId(wixId: string): CollectionMapping | undefined {
  return COLLECTIONS.find(c => c.wixCollectionId === wixId);
}

// Content type limits for compliance checking
export const CONTENT_TYPE_LIMITS: Record<string, { minChars: number; maxChars: number }> = {
  social_post: { minChars: 50, maxChars: 2200 },
  blog_article: { minChars: 800, maxChars: 15000 },
  video_script: { minChars: 200, maxChars: 5000 },
  image_brief: { minChars: 50, maxChars: 500 },
  newsletter: { minChars: 300, maxChars: 8000 },
  travel_listing: { minChars: 100, maxChars: 3000 },
};

// AI provider routing config
export const AI_ROUTING: Record<string, 'gemini' | 'claude'> = {
  social_post: 'gemini',
  blog_article: 'claude',
  video_script: 'claude',
  image_brief: 'gemini',
  newsletter: 'claude',
  travel_listing: 'gemini',
  compliance_review: 'claude',
  general: 'gemini',
};
