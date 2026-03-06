// genOS Full v1.0.0 "Lumina" — server/services/constraintKernel.ts
import { DNAConstraints } from '../types/dna';

export interface KernelValidationResult {
    isValid: boolean;
    errors: string[];
    transformedContent: string;
}

/**
 * Parses the raw AI output, validates and enforces character/word limits,
 * and seamlessly appends fixed elements from the DNA rules.
 */
export function applyConstraintKernel(
    content: string,
    contentType: 'carousel' | 'reels' | 'static_post' | 'description' | string,
    constraints: DNAConstraints | undefined
): KernelValidationResult {

    const errors: string[] = [];
    let transformedContent = content.trim();

    if (!constraints || !constraints.limits) {
        return { isValid: true, errors: [], transformedContent };
    }

    const limits = constraints.limits;

    // 1. Strict Character Limits (e.g., Description)
    if (contentType === 'description' && limits.description) {
        const len = transformedContent.length;
        if (len < limits.description.min || len > limits.description.max) {
            errors.push(`Descricão falhou no Constraint Kernel: ${len} caracteres (Esperado ${limits.description.min}-${limits.description.max}).`);
        }
    }

    // 2. Strict Word Limits depending on format type
    if (contentType === 'static_post' && limits.static_post) {
        const lines = transformedContent.split('\\n').filter(l => l.trim().length > 0);
        if (lines.length > 0) {
            const titleWords = lines[0].split(' ').length;
            if (titleWords > limits.static_post.title_max_words) {
                errors.push(`Título do Post Estático excedeu ${limits.static_post.title_max_words} palavras (tem ${titleWords}).`);
            }
        }
        if (lines.length > 1) {
            const paragraphWords = lines.slice(1).join(' ').split(' ').length;
            if (paragraphWords > limits.static_post.paragraph_max_words) {
                errors.push(`Corpo do Post Estático excedeu ${limits.static_post.paragraph_max_words} palavras (tem ${paragraphWords}).`);
            }
        }
    }

    if (contentType === 'carousel' && limits.carousel) {
        // Basic heuristic: check average line lengths simulating cards
        const lines = transformedContent.split('\\n').filter(l => l.trim().length > 0);
        lines.forEach((line, index) => {
            const words = line.split(' ').length;
            // Heuristic: Odd lines are titles, even are paragraphs
            if (index % 2 === 0) {
                if (words > limits.carousel.title_max_words) errors.push(`Card ${(index / 2) + 1} Título excedeu ${limits.carousel.title_max_words} palavras.`);
            } else {
                if (words > limits.carousel.paragraph_max_words) errors.push(`Card ${Math.ceil(index / 2)} Parágrafo excedeu ${limits.carousel.paragraph_max_words} palavras.`);
            }
        });
    }

    if (contentType === 'reels' && limits.reels) {
        const lines = transformedContent.split('\\n').filter(l => l.trim().length > 0);
        lines.forEach((line, index) => {
            const words = line.split(' ').length;
            if (words > limits.reels.title_max_words) {
                errors.push(`Reels Frame ${index + 1} excedeu ${limits.reels.title_max_words} palavras.`);
            }
        });
    }

    // 3. Auto-injection of Fixed Elements (Footer & Hashtags)
    if (constraints.fixed_elements) {
        const { footer_snippet, hashtags } = constraints.fixed_elements;

        // Avoid double appending if AI already included it
        let appendText = '\\n\\n';

        if (footer_snippet && !transformedContent.includes(footer_snippet)) {
            appendText += footer_snippet + '\\n';
        }

        if (hashtags && hashtags.length > 0) {
            const missingHashtags = hashtags.filter(tag => !transformedContent.includes(tag));
            if (missingHashtags.length > 0) {
                appendText += missingHashtags.join(' ');
            }
        }

        if (appendText.trim().length > 0) {
            transformedContent += appendText;
        }
    }

    return {
        isValid: errors.length === 0,
        errors,
        transformedContent
    };
}
