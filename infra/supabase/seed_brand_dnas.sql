-- Seed Brand DNAs generated from docs/brand-dna/

-- Brand: All Life Institute
INSERT INTO public.brand_dna (
        tenant_id, 
        voice_tone, 
        voice_description, 
        brand_values, 
        forbidden_words, 
        target_audience, 
        content_rules, 
        sample_posts
    ) VALUES (
        (SELECT id FROM public.tenants WHERE slug = 'all-life-institute' LIMIT 1), 
        'Educativo, acolhedor, científico sem ser técnico demais. Inspira confiança e acessibilidade.', 
        'Promover saúde integral através da medicina do estilo de vida, combinando ciência e práticas de bem-estar para transformar a qualidade de vida das pessoas.

Ser referência em medicina do estilo de vida no Brasil, democratizando o acesso a práticas de saúde integral e preventiva.
---', 
        '{}', 
        '{}', 
        '', 
        '{"guidelines":"### Diretrizes Gerais\r\n- Paleta clean com tons que remetem à natureza e saúde\r\n- Imagens reais e autênticas (não stock genérico)\r\n- Tipografia legível e moderna\r\n- Elementos visuais que transmitam equilíbrio e bem-estar\r\n---"}'::jsonb, 
        '{}'
    ) ON CONFLICT (tenant_id) DO UPDATE SET
        voice_tone = EXCLUDED.voice_tone,
        voice_description = EXCLUDED.voice_description,
        brand_values = EXCLUDED.brand_values,
        forbidden_words = EXCLUDED.forbidden_words,
        target_audience = EXCLUDED.target_audience,
        content_rules = EXCLUDED.content_rules,
        sample_posts = EXCLUDED.sample_posts;

-- Brand: Cestari Studio Master
INSERT INTO public.brand_dna (
        tenant_id, 
        voice_tone, 
        voice_description, 
        brand_values, 
        forbidden_words, 
        target_audience, 
        content_rules, 
        sample_posts
    ) VALUES (
        (SELECT id FROM public.tenants WHERE slug = 'cestari-studio-master' LIMIT 1), 
        '', 
        '

', 
        '{}', 
        '{}', 
        '', 
        '{"guidelines":""}'::jsonb, 
        '{}'
    ) ON CONFLICT (tenant_id) DO UPDATE SET
        voice_tone = EXCLUDED.voice_tone,
        voice_description = EXCLUDED.voice_description,
        brand_values = EXCLUDED.brand_values,
        forbidden_words = EXCLUDED.forbidden_words,
        target_audience = EXCLUDED.target_audience,
        content_rules = EXCLUDED.content_rules,
        sample_posts = EXCLUDED.sample_posts;

-- Brand: Cestari Studio
INSERT INTO public.brand_dna (
        tenant_id, 
        voice_tone, 
        voice_description, 
        brand_values, 
        forbidden_words, 
        target_audience, 
        content_rules, 
        sample_posts
    ) VALUES (
        (SELECT id FROM public.tenants WHERE slug = 'cestari-studio' LIMIT 1), 
        'Técnico, confiante, visionário. Fala como quem constrói o futuro — não como quem o descreve.', 
        'Oferecer soluções e produtos à prova do futuro, combinando design estratégico, tecnologia e inteligência artificial para criar marcas e experiências que evoluem com o tempo.

Ser a referência em design estratégico e tecnologia aplicada para marcas brasileiras, liderando a transição para um novo paradigma de criação com IA.', 
        '{}', 
        '{}', 
        '', 
        '{"guidelines":""}'::jsonb, 
        '{}'
    ) ON CONFLICT (tenant_id) DO UPDATE SET
        voice_tone = EXCLUDED.voice_tone,
        voice_description = EXCLUDED.voice_description,
        brand_values = EXCLUDED.brand_values,
        forbidden_words = EXCLUDED.forbidden_words,
        target_audience = EXCLUDED.target_audience,
        content_rules = EXCLUDED.content_rules,
        sample_posts = EXCLUDED.sample_posts;

-- Brand: Clareira de Avalon
INSERT INTO public.brand_dna (
        tenant_id, 
        voice_tone, 
        voice_description, 
        brand_values, 
        forbidden_words, 
        target_audience, 
        content_rules, 
        sample_posts
    ) VALUES (
        (SELECT id FROM public.tenants WHERE slug = 'clareira-de-avalon' LIMIT 1), 
        'Místico, empoderador, feminino, sagrado. Linguagem poética e transformadora, com raízes no universo de Avalon.', 
        'Criar um espaço sagrado de conexão com tradições ancestrais célticas e druídicas, promovendo cura, empoderamento e reconexão com o feminino sagrado.

Ser referência em práticas espirituais druídicas no Brasil, unindo sabedoria ancestral e transformação pessoal contemporânea.
---', 
        '{}', 
        '{}', 
        '', 
        '{"guidelines":""}'::jsonb, 
        '{}'
    ) ON CONFLICT (tenant_id) DO UPDATE SET
        voice_tone = EXCLUDED.voice_tone,
        voice_description = EXCLUDED.voice_description,
        brand_values = EXCLUDED.brand_values,
        forbidden_words = EXCLUDED.forbidden_words,
        target_audience = EXCLUDED.target_audience,
        content_rules = EXCLUDED.content_rules,
        sample_posts = EXCLUDED.sample_posts;

-- Brand: Dads Love
INSERT INTO public.brand_dna (
        tenant_id, 
        voice_tone, 
        voice_description, 
        brand_values, 
        forbidden_words, 
        target_audience, 
        content_rules, 
        sample_posts
    ) VALUES (
        (SELECT id FROM public.tenants WHERE slug = 'dads-love' LIMIT 1), 
        'Inspirador, inclusivo, empoderador. Desafia normas com leveza e autenticidade.', 
        'Promover a paternidade ativa e envolvida, desafiando normas sociais tradicionais e incentivando pais a abraçarem um papel presente e transformador na criação dos filhos.

Normalizar e celebrar a paternidade ativa no Brasil, criando uma comunidade de pais que se apoiam e se inspiram mutuamente.
---', 
        '{}', 
        '{}', 
        '', 
        '{"guidelines":""}'::jsonb, 
        '{}'
    ) ON CONFLICT (tenant_id) DO UPDATE SET
        voice_tone = EXCLUDED.voice_tone,
        voice_description = EXCLUDED.voice_description,
        brand_values = EXCLUDED.brand_values,
        forbidden_words = EXCLUDED.forbidden_words,
        target_audience = EXCLUDED.target_audience,
        content_rules = EXCLUDED.content_rules,
        sample_posts = EXCLUDED.sample_posts;

-- Brand: Gabriel Salvadeo
INSERT INTO public.brand_dna (
        tenant_id, 
        voice_tone, 
        voice_description, 
        brand_values, 
        forbidden_words, 
        target_audience, 
        content_rules, 
        sample_posts
    ) VALUES (
        (SELECT id FROM public.tenants WHERE slug = 'gabriel-salvadeo' LIMIT 1), 
        '*A ser definido.* Recomenda-se que a voz reflita autenticidade e os valores pessoais de Gabriel.', 
        '*A ser definido em sessão de briefing.* Gabriel Salvadeo está construindo sua marca pessoal com apoio da Cestari Studio.

*A ser definido em sessão de briefing.*
---', 
        '{}', 
        '{}', 
        '', 
        '{"guidelines":""}'::jsonb, 
        '{}'
    ) ON CONFLICT (tenant_id) DO UPDATE SET
        voice_tone = EXCLUDED.voice_tone,
        voice_description = EXCLUDED.voice_description,
        brand_values = EXCLUDED.brand_values,
        forbidden_words = EXCLUDED.forbidden_words,
        target_audience = EXCLUDED.target_audience,
        content_rules = EXCLUDED.content_rules,
        sample_posts = EXCLUDED.sample_posts;

-- Brand: Joab Nascimento
INSERT INTO public.brand_dna (
        tenant_id, 
        voice_tone, 
        voice_description, 
        brand_values, 
        forbidden_words, 
        target_audience, 
        content_rules, 
        sample_posts
    ) VALUES (
        (SELECT id FROM public.tenants WHERE slug = 'joab-nascimento' LIMIT 1), 
        'Acolhedor, profissional, conectado ao corpo e bem-estar. Linguagem que convida ao cuidado sem ser clínica.', 
        'Promover bem-estar físico e mental através da massoterapia e práticas de wellness, oferecendo serviços, planos e produtos para clientes presenciais e digitais.

Construir um espaço próprio de referência em wellness, com serviços presenciais e uma linha de produtos digitais que amplifiquem o alcance da marca.
---', 
        '{}', 
        '{}', 
        '', 
        '{"guidelines":""}'::jsonb, 
        '{}'
    ) ON CONFLICT (tenant_id) DO UPDATE SET
        voice_tone = EXCLUDED.voice_tone,
        voice_description = EXCLUDED.voice_description,
        brand_values = EXCLUDED.brand_values,
        forbidden_words = EXCLUDED.forbidden_words,
        target_audience = EXCLUDED.target_audience,
        content_rules = EXCLUDED.content_rules,
        sample_posts = EXCLUDED.sample_posts;

-- Brand: José Victor F. de Carvalho
INSERT INTO public.brand_dna (
        tenant_id, 
        voice_tone, 
        voice_description, 
        brand_values, 
        forbidden_words, 
        target_audience, 
        content_rules, 
        sample_posts
    ) VALUES (
        (SELECT id FROM public.tenants WHERE slug = 'jose-victor-carvalho' LIMIT 1), 
        '*A ser definido.* Recomenda-se que a voz reflita as competências profissionais e valores pessoais de José Victor.', 
        '*A ser definido em sessão de briefing.* José Victor está construindo sua marca pessoal e presença digital com apoio da Cestari Studio.

*A ser definido em sessão de briefing.*
---', 
        '{}', 
        '{}', 
        '', 
        '{"guidelines":""}'::jsonb, 
        '{}'
    ) ON CONFLICT (tenant_id) DO UPDATE SET
        voice_tone = EXCLUDED.voice_tone,
        voice_description = EXCLUDED.voice_description,
        brand_values = EXCLUDED.brand_values,
        forbidden_words = EXCLUDED.forbidden_words,
        target_audience = EXCLUDED.target_audience,
        content_rules = EXCLUDED.content_rules,
        sample_posts = EXCLUDED.sample_posts;

-- Brand: Lets Travel With Us 360
INSERT INTO public.brand_dna (
        tenant_id, 
        voice_tone, 
        voice_description, 
        brand_values, 
        forbidden_words, 
        target_audience, 
        content_rules, 
        sample_posts
    ) VALUES (
        (SELECT id FROM public.tenants WHERE slug = 'lets-travel-with-us-360' LIMIT 1), 
        'Aventureiro, inspirador, envolvente. Linguagem que transporta — como se o leitor já estivesse viajando.', 
        'Proporcionar experiências de viagem completas e imersivas (360°), conectando viajantes a destinos e culturas de forma autêntica e memorável.

Ser referência em experiências de turismo imersivo, oferecendo jornadas que transformam a perspectiva do viajante.
---', 
        '{}', 
        '{}', 
        '', 
        '{"guidelines":""}'::jsonb, 
        '{}'
    ) ON CONFLICT (tenant_id) DO UPDATE SET
        voice_tone = EXCLUDED.voice_tone,
        voice_description = EXCLUDED.voice_description,
        brand_values = EXCLUDED.brand_values,
        forbidden_words = EXCLUDED.forbidden_words,
        target_audience = EXCLUDED.target_audience,
        content_rules = EXCLUDED.content_rules,
        sample_posts = EXCLUDED.sample_posts;

-- Brand: Nina Couto
INSERT INTO public.brand_dna (
        tenant_id, 
        voice_tone, 
        voice_description, 
        brand_values, 
        forbidden_words, 
        target_audience, 
        content_rules, 
        sample_posts
    ) VALUES (
        (SELECT id FROM public.tenants WHERE slug = 'nina-couto' LIMIT 1), 
        'Contemporâneo, feminino, dinâmico. Próximo e pessoal — como uma amiga que indica o look perfeito.', 
        'Oferecer moda feminina estilosa e acessível, celebrando a mulher brasileira em todas as suas formas. Cada peça é escolhida com carinho — um tributo à mãe da fundadora.

Ser referência em moda feminina acessível no Brasil, combinando curadoria cuidadosa com entrega para todo o país.', 
        '{}', 
        '{}', 
        '', 
        '{"guidelines":""}'::jsonb, 
        '{}'
    ) ON CONFLICT (tenant_id) DO UPDATE SET
        voice_tone = EXCLUDED.voice_tone,
        voice_description = EXCLUDED.voice_description,
        brand_values = EXCLUDED.brand_values,
        forbidden_words = EXCLUDED.forbidden_words,
        target_audience = EXCLUDED.target_audience,
        content_rules = EXCLUDED.content_rules,
        sample_posts = EXCLUDED.sample_posts;

-- Brand: Obbra (Objeto Brasileiro)
INSERT INTO public.brand_dna (
        tenant_id, 
        voice_tone, 
        voice_description, 
        brand_values, 
        forbidden_words, 
        target_audience, 
        content_rules, 
        sample_posts
    ) VALUES (
        (SELECT id FROM public.tenants WHERE slug = 'obbra' LIMIT 1), 
        'Artístico, conceitual, sofisticado. Fala de processo, material e intenção — não de preço ou status.', 
        'Criar objetos e peças de design que expressam a identidade brasileira contemporânea, unindo craftsmanship, arte aplicada e design conceitual.

Posicionar o design brasileiro autoral no cenário internacional, valorizando materiais, técnicas e narrativas nacionais.
---', 
        '{}', 
        '{}', 
        '', 
        '{"guidelines":""}'::jsonb, 
        '{}'
    ) ON CONFLICT (tenant_id) DO UPDATE SET
        voice_tone = EXCLUDED.voice_tone,
        voice_description = EXCLUDED.voice_description,
        brand_values = EXCLUDED.brand_values,
        forbidden_words = EXCLUDED.forbidden_words,
        target_audience = EXCLUDED.target_audience,
        content_rules = EXCLUDED.content_rules,
        sample_posts = EXCLUDED.sample_posts;

-- Brand: Polo Ar Condicionado
INSERT INTO public.brand_dna (
        tenant_id, 
        voice_tone, 
        voice_description, 
        brand_values, 
        forbidden_words, 
        target_audience, 
        content_rules, 
        sample_posts
    ) VALUES (
        (SELECT id FROM public.tenants WHERE slug = 'polo-ar-condicionado' LIMIT 1), 
        'Profissional, confiável, técnico. Linguagem que transmite segurança e expertise em climatização.', 
        'Ser o maior e mais confiável distribuidor de ar condicionado do Brasil, oferecendo variedade, segurança e atendimento especializado.

Liderar o mercado de distribuição de climatização no Brasil com excelência operacional e presença digital forte.
---', 
        '{}', 
        '{}', 
        '', 
        '{"guidelines":""}'::jsonb, 
        '{}'
    ) ON CONFLICT (tenant_id) DO UPDATE SET
        voice_tone = EXCLUDED.voice_tone,
        voice_description = EXCLUDED.voice_description,
        brand_values = EXCLUDED.brand_values,
        forbidden_words = EXCLUDED.forbidden_words,
        target_audience = EXCLUDED.target_audience,
        content_rules = EXCLUDED.content_rules,
        sample_posts = EXCLUDED.sample_posts;

-- Brand: Primeira Folha
INSERT INTO public.brand_dna (
        tenant_id, 
        voice_tone, 
        voice_description, 
        brand_values, 
        forbidden_words, 
        target_audience, 
        content_rules, 
        sample_posts
    ) VALUES (
        (SELECT id FROM public.tenants WHERE slug = 'primeira-folha' LIMIT 1), 
        'Artesanal, sustentável, espiritual, consciente. Linguagem que honra processos naturais e éticos.', 
        'Criar produtos naturais artesanais — banhos de ervas e incensos — que transformam rituais de autocuidado em experiências sensoriais significativas, com respeito ao meio ambiente e processos éticos.

Ser referência em produtos naturais para rituais pessoais no Brasil, unindo design sustentável, espiritualidade e qualidade artesanal.
---', 
        '{}', 
        '{}', 
        '', 
        '{"guidelines":""}'::jsonb, 
        '{}'
    ) ON CONFLICT (tenant_id) DO UPDATE SET
        voice_tone = EXCLUDED.voice_tone,
        voice_description = EXCLUDED.voice_description,
        brand_values = EXCLUDED.brand_values,
        forbidden_words = EXCLUDED.forbidden_words,
        target_audience = EXCLUDED.target_audience,
        content_rules = EXCLUDED.content_rules,
        sample_posts = EXCLUDED.sample_posts;

-- Brand: PUTTINATO
INSERT INTO public.brand_dna (
        tenant_id, 
        voice_tone, 
        voice_description, 
        brand_values, 
        forbidden_words, 
        target_audience, 
        content_rules, 
        sample_posts
    ) VALUES (
        (SELECT id FROM public.tenants WHERE slug = 'puttinato' LIMIT 1), 
        'Descritivo, preciso, silencioso, convidativo. A marca fala como um curador — nunca como um vendedor.', 
        'Transformar vidro em linguagem artística contemporânea, unindo técnica ancestral e experimentação radical para criar peças que desafiam a percepção do material.

Posicionar o Brasil no mapa global do glass art contemporâneo, tornando-se referência em vidro autoral na América Latina.', 
        ARRAY['### Pilares Estratégicos', '**Experimentar** — Experimentação como método. Cada peça é um laboratório.', '**Pesquisa** — Investigação de técnicas, materiais e processos como base criativa.', '**Método** — Processo documentado e replicável. A arte tem estrutura.', '---'], 
        ARRAY['Evitar', 'artesanato', 'handmade', 'luxo', 'exclusivo', 'único (como adjetivo vago)', 'ateliê (em contexto artesanal)'], 
        '', 
        '{"guidelines":"### Princípios de Copy\r\n- **Sempre usar:** técnica nomeada, material descrito, processo evidenciado\r\n- **Nunca usar:** emojis, CTAs com urgência, \"artesanato\", \"luxo\", \"handmade\", \"exclusivo\"\r\n- **Títulos:** ≤10 palavras, sem pontuação decorativa\r\n- **Texto corrido:** frases curtas, parágrafos de 2-3 linhas máximo"}'::jsonb, 
        ARRAY['### Formatos de Copy', '- **Instagram:** Visual-first. Copy como legenda descritiva, não CTA.', '- **Website:** Editorial. Separação clara entre loja e conteúdo.', '- **Catálogo:** Fotográfico. Ficha técnica + narrativa curta.', '---']
    ) ON CONFLICT (tenant_id) DO UPDATE SET
        voice_tone = EXCLUDED.voice_tone,
        voice_description = EXCLUDED.voice_description,
        brand_values = EXCLUDED.brand_values,
        forbidden_words = EXCLUDED.forbidden_words,
        target_audience = EXCLUDED.target_audience,
        content_rules = EXCLUDED.content_rules,
        sample_posts = EXCLUDED.sample_posts;

-- Brand: Theo Webert
INSERT INTO public.brand_dna (
        tenant_id, 
        voice_tone, 
        voice_description, 
        brand_values, 
        forbidden_words, 
        target_audience, 
        content_rules, 
        sample_posts
    ) VALUES (
        (SELECT id FROM public.tenants WHERE slug = 'theo-webert' LIMIT 1), 
        'Pessoal, próximo, educativo. Compartilha bastidores e aprendizados. Mais informal que o All Life Institute, mantendo a credibilidade científica.', 
        '

', 
        '{}', 
        '{}', 
        '', 
        '{"guidelines":""}'::jsonb, 
        '{}'
    ) ON CONFLICT (tenant_id) DO UPDATE SET
        voice_tone = EXCLUDED.voice_tone,
        voice_description = EXCLUDED.voice_description,
        brand_values = EXCLUDED.brand_values,
        forbidden_words = EXCLUDED.forbidden_words,
        target_audience = EXCLUDED.target_audience,
        content_rules = EXCLUDED.content_rules,
        sample_posts = EXCLUDED.sample_posts;

