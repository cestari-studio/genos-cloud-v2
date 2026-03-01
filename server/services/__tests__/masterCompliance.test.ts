/**
 * masterCompliance.test.ts — Unit tests for the 4-layer compliance engine
 *
 * Strategy: mock Supabase + constraintKernel so we test pure scoring logic
 * without hitting any external service.
 */

// ── Mocks ────────────────────────────────────────────────────────────
jest.mock('../supabaseClient', () => ({
  supabase: {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  },
}));

jest.mock('../constraintKernel', () => ({
  applyConstraintKernel: jest.fn((_content: string, _type: string) => ({
    isValid: true,
    errors: [],
    transformedContent: _content,
  })),
}));

import { supabase } from '../supabaseClient';
import { applyConstraintKernel } from '../constraintKernel';
import { checkCompliance, ComplianceResult } from '../masterCompliance';

// ── Helpers ──────────────────────────────────────────────────────────

const TENANT_ID = 'test-tenant-123';

function mockBrandDna(overrides: Record<string, unknown> = {}) {
  return {
    forbidden_words: ['grátis', 'barato', 'promoção'],
    voice_tone: {
      formality: 'professional-casual',
      energy: 'high',
      vocabulario_chave: ['inovação', 'design', 'futuro'],
    },
    content_rules: {},
    brand_values: {},
    persona_name: 'Lumina',
    ...overrides,
  };
}

function mockRules(rules: Array<{ rule_type: string; rule_config: Record<string, unknown>; severity?: string }> = []) {
  return rules.map(r => ({ ...r, is_active: true, severity: r.severity || 'medium' }));
}

/**
 * Configure the chained Supabase mock so the first .single() returns brand DNA
 * and the second chain returns compliance rules.
 */
function setupSupabaseMock(dna: Record<string, unknown>, rules: any[]) {
  let callCount = 0;
  const chainable = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { data: dna, error: null };
      }
      return { data: null, error: null };
    }),
  };

  // For rules query (no .single()), we intercept the last .eq() to return data
  let eqCallCount = 0;
  chainable.eq = jest.fn().mockImplementation(() => {
    eqCallCount++;
    // After brand_dna query (3 eq calls: tenant_id + single), rules query has eq('tenant_id') + eq('is_active')
    // We attach data to the object for when it's awaited without .single()
    const result = { ...chainable, data: rules, error: null };
    return result;
  });

  (supabase.from as jest.Mock).mockReturnValue(chainable);
}

// ── Tests ────────────────────────────────────────────────────────────

describe('masterCompliance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (applyConstraintKernel as jest.Mock).mockImplementation((content: string) => ({
      isValid: true,
      errors: [],
      transformedContent: content,
    }));
  });

  describe('checkForbiddenWords (Layer 1)', () => {
    it('should score 25/25 when no forbidden words are found', async () => {
      setupSupabaseMock(mockBrandDna(), mockRules());

      const result = await checkCompliance(TENANT_ID, 'Design inovador para o futuro!', 'static_post');

      expect(result.checks.forbidden_words.pass).toBe(true);
      expect(result.checks.forbidden_words.score).toBe(25);
    });

    it('should score 0/25 when forbidden words are present', async () => {
      setupSupabaseMock(mockBrandDna(), mockRules());

      const result = await checkCompliance(TENANT_ID, 'Oferta grátis e barato!', 'static_post');

      expect(result.checks.forbidden_words.pass).toBe(false);
      expect(result.checks.forbidden_words.score).toBe(0);
      expect(result.checks.forbidden_words.details).toContain('grátis');
      expect(result.checks.forbidden_words.details).toContain('barato');
    });
  });

  describe('checkToneAlignment (Layer 2)', () => {
    it('should penalize casual language in professional tone', async () => {
      setupSupabaseMock(mockBrandDna(), mockRules());

      const result = await checkCompliance(TENANT_ID, 'Mano, esse design é tipo muito bom véi', 'static_post');

      expect(result.checks.tone_alignment.score).toBeLessThan(25);
    });

    it('should penalize low energy when high energy is expected', async () => {
      setupSupabaseMock(mockBrandDna(), mockRules());

      const result = await checkCompliance(TENANT_ID, 'O design segue padrões normais sem nada especial.', 'static_post');

      expect(result.checks.tone_alignment.score).toBeLessThan(25);
    });

    it('should score full marks for aligned tone with energy', async () => {
      setupSupabaseMock(mockBrandDna(), mockRules());

      const result = await checkCompliance(TENANT_ID, 'Descubra o poder do design inovador! Transforme seu futuro agora!', 'static_post');

      expect(result.checks.tone_alignment.score).toBe(25);
    });
  });

  describe('checkLengthCompliance (Layer 3)', () => {
    it('should pass when no length rule exists', async () => {
      setupSupabaseMock(mockBrandDna(), mockRules());

      const result = await checkCompliance(TENANT_ID, 'Conteúdo curto.', 'static_post');

      expect(result.checks.length_compliance.pass).toBe(true);
      expect(result.checks.length_compliance.score).toBe(25);
    });

    it('should fail when content is too short', async () => {
      const rules = mockRules([{
        rule_type: 'length_limit',
        rule_config: { static_post: { min: 100, max: 500 } },
      }]);
      setupSupabaseMock(mockBrandDna(), rules);

      const result = await checkCompliance(TENANT_ID, 'Curto.', 'static_post');

      expect(result.checks.length_compliance.pass).toBe(false);
      expect(result.checks.length_compliance.details).toContain('muito curto');
    });
  });

  describe('constraint kernel integration', () => {
    it('should apply heavy penalty when kernel fails', async () => {
      (applyConstraintKernel as jest.Mock).mockImplementation((content: string) => ({
        isValid: false,
        errors: ['Excedeu limite de caracteres para description'],
        transformedContent: content,
      }));
      setupSupabaseMock(mockBrandDna(), mockRules());

      const result = await checkCompliance(TENANT_ID, 'Descubra o design do futuro!', 'description');

      expect(result.checks.constraint_kernel.pass).toBe(false);
      expect(result.score).toBeLessThanOrEqual(70); // rawScore - 30
      expect(result.suggestions).toContain('Excedeu limite de caracteres para description');
    });
  });

  describe('verdict logic', () => {
    it('should return "approved" for score >= 75 with valid kernel', async () => {
      setupSupabaseMock(mockBrandDna(), mockRules());

      const result = await checkCompliance(
        TENANT_ID,
        'Descubra a inovação do design! Transforme seu futuro com soluções à prova do tempo!',
        'static_post'
      );

      expect(result.verdict).toBe('approved');
      expect(result.score).toBeGreaterThanOrEqual(75);
    });

    it('should return "rejected" for very low score', async () => {
      (applyConstraintKernel as jest.Mock).mockImplementation((content: string) => ({
        isValid: false,
        errors: ['Kernel failed'],
        transformedContent: content,
      }));
      setupSupabaseMock(
        mockBrandDna({ forbidden_words: ['design'] }),
        mockRules([{
          rule_type: 'length_limit',
          rule_config: { static_post: { min: 500, max: 1000 } },
        }])
      );

      const result = await checkCompliance(TENANT_ID, 'Mano, design grátis tipo barato véi', 'static_post');

      expect(result.verdict).toBe('rejected');
      expect(result.score).toBeLessThan(40);
    });
  });
});
