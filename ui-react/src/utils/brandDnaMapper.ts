export const BRAND_DNA_KEY_MAP: Record<string, string> = {
    // PT (como salvo na UI) → EN (como o backend espera)
    reel_titulo: 'reel_title',
    reel_roteiro: 'reel_script',
    reel_cta: 'reel_cta',
    estatico_titulo: 'static_title',
    estatico_legenda: 'static_caption',
    estatico_hashtags: 'static_hashtags',
    carrossel_titulo: 'carousel_title',
    carrossel_slides: 'carousel_slides',
    stories_titulo: 'stories_title',
    stories_legenda: 'stories_caption',
};

// Inverso para leitura
export const BRAND_DNA_KEY_MAP_REVERSE = Object.fromEntries(
    Object.entries(BRAND_DNA_KEY_MAP).map(([k, v]) => [v, k])
);

// Normalizar objeto para EN (uso no backend)
export function normalizeBrandDnaToEN(raw: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(raw)) {
        const enKey = BRAND_DNA_KEY_MAP[key] || key;
        result[enKey] = value;
    }
    return result;
}

// Normalizar objeto para PT (uso na UI)
export function normalizeBrandDnaToPT(raw: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(raw)) {
        const ptKey = BRAND_DNA_KEY_MAP_REVERSE[key] || key;
        result[ptKey] = value;
    }
    return result;
}
