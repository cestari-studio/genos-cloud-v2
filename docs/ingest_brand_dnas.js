const fs = require('fs');
const path = require('path');

const dnaDir = path.join(__dirname, 'brand-dna');
const outputFile = path.join(__dirname, '..', 'supabase', 'seed_brand_dnas.sql');

const files = fs.readdirSync(dnaDir).filter(f => f.endsWith('.md'));

let sqlContent = `-- Seed Brand DNAs generated from docs/brand-dna/\n\n`;

files.forEach(file => {
    const filePath = path.join(dnaDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Basic extraction logic
    const brandNameMatch = content.match(/# DNA Brand — (.*)/);
    const brandName = brandNameMatch ? brandNameMatch[1].trim() : file.replace('.md', '');

    const mission = extractSection(content, 'Missão');
    const vision = extractSection(content, 'Visão');
    const values = extractSection(content, 'Valores Core') || extractSection(content, 'Pilares Estratégicos');
    const tone = extractSection(content, 'Tom');
    const audience = extractSection(content, 'Público-Alvo');

    // Complex sections (handling Tables and Lists)
    const vocabulary = extractVocabulary(content);
    const guidelines = extractSection(content, 'Princípios de Copy') || extractSection(content, 'Diretrizes Gerais');
    const examples = extractSection(content, 'Formatos de Copy');

    // Clean strings (strip Markdown headers)
    const cleanMission = mission.replace(/###? Missão\s*/i, '').trim();
    const cleanVision = vision.replace(/###? Visão\s*/i, '').trim();
    const cleanTone = tone.replace(/###? Tom\s*/i, '').trim();
    const cleanAudience = audience.replace(/###? Público-Alvo\s*/i, '').trim();

    // Function to format as PG Array
    const toPgArray = (arr) => {
        if (!arr || arr.length === 0) return "'{}'";
        return `ARRAY[${arr.map(v => `'${escapeSql(v)}'`).join(', ')}]`;
    };

    // Prepare fields
    const brandValuesList = values.split('\n').filter(v => v.trim()).map(v => v.trim().replace(/^- |\d+\. /g, ''));
    const forbiddenWordsList = vocabulary.avoid.split(',').filter(v => v.trim()).map(v => v.trim());
    const samplePostsList = examples.split('\n').filter(v => v.trim()).map(v => v.trim());

    const pgBrandValues = toPgArray(brandValuesList);
    const pgForbiddenWords = toPgArray(forbiddenWordsList);
    const pgSamplePosts = toPgArray(samplePostsList);
    const pgContentRules = `'${escapeSql(JSON.stringify({ guidelines: guidelines.replace(/###? .*\n/i, '').trim() }))}'::jsonb`;

    // Mapping to SQL
    const slug = file.replace('.md', '');

    sqlContent += `-- Brand: ${brandName}\n`;
    sqlContent += `INSERT INTO public.brand_dna (
        tenant_id, 
        voice_tone, 
        voice_description, 
        brand_values, 
        forbidden_words, 
        target_audience, 
        content_rules, 
        sample_posts
    ) VALUES (
        (SELECT id FROM public.tenants WHERE slug = '${slug}' LIMIT 1), 
        '${escapeSql(cleanTone)}', 
        '${escapeSql(cleanMission + '\n\n' + cleanVision)}', 
        ${pgBrandValues}, 
        ${pgForbiddenWords}, 
        '${escapeSql(cleanAudience)}', 
        ${pgContentRules}, 
        ${pgSamplePosts}
    ) ON CONFLICT (tenant_id) DO UPDATE SET
        voice_tone = EXCLUDED.voice_tone,
        voice_description = EXCLUDED.voice_description,
        brand_values = EXCLUDED.brand_values,
        forbidden_words = EXCLUDED.forbidden_words,
        target_audience = EXCLUDED.target_audience,
        content_rules = EXCLUDED.content_rules,
        sample_posts = EXCLUDED.sample_posts;\n\n`;
});

fs.writeFileSync(outputFile, sqlContent);
console.log(`Generated SQL seed file at: ${outputFile}`);

// Helper functions
function extractSection(content, sectionName) {
    const regex = new RegExp(`###? ${sectionName}[\\s\\S]*?(?=##|$)`, 'i');
    const match = content.match(regex);
    if (!match) return '';
    return match[0]
        .replace(/###? .*\n/, '')
        .trim()
        .replace(/\n\s*\n/g, '\n');
}

function extractVocabulary(content) {
    const vocab = { preferred: '', avoid: '' };
    const section = extractSection(content, 'Vocabulário da Marca');
    if (!section) return vocab;

    // Handle Markdown Table
    const rows = section.split('\n');
    rows.forEach(row => {
        const columns = row.split('|').filter(c => c.trim());
        if (columns.length >= 2 && !row.includes('---')) {
            vocab.preferred += columns[0].replace(/✅|❌|\*/g, '').trim() + ', ';
            vocab.avoid += columns[1].replace(/✅|❌|\*/g, '').trim() + ', ';
        }
    });

    vocab.preferred = vocab.preferred.replace(/, $/, '');
    vocab.avoid = vocab.avoid.replace(/, $/, '');
    return vocab;
}

function escapeSql(str) {
    if (!str) return '';
    return str.replace(/'/g, "''");
}
