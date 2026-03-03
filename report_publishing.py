#!/usr/bin/env python3
"""
genOS Content Factory — Relatório Comparativo de Publicação
Cestari Studio · Março 2026
"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import mm, cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas as pdfcanvas
import os

# ── Colors ──
DARK_BG = HexColor('#161616')
CARD_BG = HexColor('#262626')
BORDER = HexColor('#393939')
PRIMARY = HexColor('#0f62fe')
GREEN = HexColor('#24a148')
RED = HexColor('#da1e28')
YELLOW = HexColor('#f1c21b')
PURPLE = HexColor('#8a3ffc')
CYAN = HexColor('#1192e8')
TEXT_PRIMARY = HexColor('#f4f4f4')
TEXT_SECONDARY = HexColor('#c6c6c6')
TEXT_HELPER = HexColor('#8d8d8d')

OUTPUT = '/sessions/cool-wonderful-brahmagupta/mnt/genOS-Full/genOS_Publishing_Report.pdf'

# ── Page background ──
def on_page(c, doc):
    c.saveState()
    c.setFillColor(DARK_BG)
    c.rect(0, 0, A4[0], A4[1], fill=True, stroke=False)
    # Footer
    c.setFont('Helvetica', 7)
    c.setFillColor(TEXT_HELPER)
    c.drawString(20*mm, 10*mm, 'genOS Cloud Platform · Cestari Studio · Confidencial')
    c.drawRightString(A4[0] - 20*mm, 10*mm, f'Página {doc.page}')
    c.restoreState()

# ── Styles ──
styles = getSampleStyleSheet()

def make_style(name, parent='Normal', **kw):
    defaults = dict(fontName='Helvetica', textColor=TEXT_PRIMARY, leading=14, spaceAfter=4)
    defaults.update(kw)
    return ParagraphStyle(name, parent=styles[parent], **defaults)

st_title = make_style('DTitle', fontSize=22, fontName='Helvetica-Bold', leading=28, spaceAfter=2)
st_subtitle = make_style('DSub', fontSize=11, textColor=TEXT_SECONDARY, spaceAfter=16)
st_h1 = make_style('DH1', fontSize=16, fontName='Helvetica-Bold', leading=22, spaceBefore=18, spaceAfter=8, textColor=PRIMARY)
st_h2 = make_style('DH2', fontSize=13, fontName='Helvetica-Bold', leading=18, spaceBefore=14, spaceAfter=6, textColor=CYAN)
st_h3 = make_style('DH3', fontSize=11, fontName='Helvetica-Bold', leading=15, spaceBefore=10, spaceAfter=4, textColor=TEXT_PRIMARY)
st_body = make_style('DBody', fontSize=9.5, leading=14, alignment=TA_JUSTIFY, spaceAfter=6, textColor=TEXT_SECONDARY)
st_bullet = make_style('DBullet', fontSize=9.5, leading=14, leftIndent=14, bulletIndent=0, spaceAfter=4, textColor=TEXT_SECONDARY)
st_note = make_style('DNote', fontSize=8.5, leading=12, textColor=TEXT_HELPER, leftIndent=10, borderPadding=6, spaceAfter=8)
st_cell = make_style('DCell', fontSize=8.5, leading=11, textColor=TEXT_SECONDARY, alignment=TA_LEFT)
st_cell_bold = make_style('DCellBold', fontSize=8.5, leading=11, textColor=TEXT_PRIMARY, fontName='Helvetica-Bold')
st_cell_center = make_style('DCellCenter', fontSize=8.5, leading=11, textColor=TEXT_SECONDARY, alignment=TA_CENTER)

def hr():
    return HRFlowable(width='100%', thickness=0.5, color=BORDER, spaceAfter=8, spaceBefore=8)

def tag(text, color):
    return f'<font color="{color}">[{text}]</font>'

def bold(text):
    return f'<b>{text}</b>'

def table_block(headers, rows, col_widths=None):
    """Create a styled table."""
    w = col_widths or [None] * len(headers)
    data = [[Paragraph(h, st_cell_bold) for h in headers]]
    for row in rows:
        data.append([Paragraph(str(c), st_cell) for c in row])
    t = Table(data, colWidths=w, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#333333')),
        ('BACKGROUND', (0, 1), (-1, -1), CARD_BG),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [CARD_BG, HexColor('#2a2a2a')]),
    ]))
    return t

# ── Build document ──
doc = SimpleDocTemplate(
    OUTPUT, pagesize=A4,
    leftMargin=20*mm, rightMargin=20*mm,
    topMargin=22*mm, bottomMargin=20*mm,
)

story = []
W = A4[0] - 40*mm  # usable width

# ════════════════════════════════════════════════════════════
# COVER
# ════════════════════════════════════════════════════════════
story.append(Spacer(1, 60))
story.append(Paragraph('genOS Cloud Platform', make_style('cover_pre', fontSize=11, textColor=TEXT_HELPER, spaceAfter=4)))
story.append(Paragraph('Content Factory', make_style('cover_title', fontSize=30, fontName='Helvetica-Bold', leading=36, spaceAfter=2)))
story.append(Paragraph('Relatório Comparativo de Publicação', make_style('cover_sub', fontSize=18, textColor=CYAN, spaceAfter=24)))
story.append(hr())
story.append(Paragraph('Análise de arquitetura para distribuição de conteúdo gerado por IA em redes sociais, CMS (Wix/Webflow), e geração de arquivos — cobrindo integração direta vs. intermediários, custos, OAuth, e estrutura multi-tenant.', st_body))
story.append(Spacer(1, 30))
story.append(Paragraph('Cestari Studio · Março 2026', make_style('cover_date', fontSize=10, textColor=TEXT_HELPER)))
story.append(Paragraph('Documento Confidencial — Uso Interno', make_style('cover_conf', fontSize=9, textColor=RED, spaceAfter=4)))
story.append(PageBreak())

# ════════════════════════════════════════════════════════════
# TABLE OF CONTENTS
# ════════════════════════════════════════════════════════════
story.append(Paragraph('Índice', st_h1))
story.append(hr())
toc_items = [
    ('1', 'Resumo Executivo'),
    ('2', 'Opção A — Integração Direta (In-House)'),
    ('3', 'Opção B — API Intermediária (Aggregator)'),
    ('4', 'Comparativo: Direta vs. Intermediária'),
    ('5', 'Estrutura por Plataforma Social'),
    ('6', 'CMS: Wix & Webflow'),
    ('7', 'Geração de Arquivos (DOCX, XLSX, PDF, CSV)'),
    ('8', 'Wix Online Programs (Cursos)'),
    ('9', 'Arquitetura Multi-Tenant'),
    ('10', 'Estimativa de Custos Consolidada'),
    ('11', 'Recomendação Final'),
]
for num, title in toc_items:
    story.append(Paragraph(f'<b>{num}.</b>  {title}', make_style(f'toc_{num}', fontSize=10, leading=18, textColor=TEXT_SECONDARY, leftIndent=10)))
story.append(PageBreak())

# ════════════════════════════════════════════════════════════
# 1. RESUMO EXECUTIVO
# ════════════════════════════════════════════════════════════
story.append(Paragraph('1. Resumo Executivo', st_h1))
story.append(hr())
story.append(Paragraph('O Content Factory do genOS atualmente gera, revisa e agenda conteúdo — mas <b>não publica em nenhuma plataforma</b>. Este relatório analisa duas abordagens para fechar esse loop: integração direta com cada API de rede social, ou uso de uma API intermediária (aggregator). Além disso, cobre a geração automática de conteúdo CMS (blog posts, páginas web) via Wix e Webflow, geração de arquivos (DOCX, XLSX, PDF, CSV), e a criação de cursos/programas no Wix — tudo baseado no Brand DNA de cada tenant.', st_body))
story.append(Spacer(1, 6))

story.append(Paragraph('Pipeline Atual vs. Proposto:', st_h3))
story.append(Paragraph('<b>Hoje:</b> Post criado → IA gera conteúdo → Revisão → Aprovação → <font color="#da1e28">FIM (não publica)</font>', st_body))
story.append(Paragraph('<b>Proposto:</b> Post criado → IA gera → Quality Gate → Aprovação → Schedule → <font color="#24a148">Publicação automática</font> → Analytics', st_body))
story.append(PageBreak())

# ════════════════════════════════════════════════════════════
# 2. OPÇÃO A — INTEGRAÇÃO DIRETA
# ════════════════════════════════════════════════════════════
story.append(Paragraph('2. Opção A — Integração Direta (In-House)', st_h1))
story.append(hr())
story.append(Paragraph('Nesta abordagem, o genOS se conecta diretamente à API de cada plataforma. Isso requer implementar o fluxo OAuth, os endpoints de publicação, e o tratamento de erros para cada rede social individualmente.', st_body))

story.append(Paragraph('Infraestrutura necessária no Supabase:', st_h3))
story.append(Paragraph('• <b>social_connections</b> — tabela para armazenar tokens OAuth por tenant + plataforma', st_bullet))
story.append(Paragraph('• <b>dispatch_queue</b> — fila de publicação com status (pending/dispatched/failed/published)', st_bullet))
story.append(Paragraph('• <b>dispatch_log</b> — histórico com platform_post_id, response, error, published_at', st_bullet))
story.append(Paragraph('• <b>Edge Function: publish-dispatcher</b> — cron que consulta posts com scheduled_date ≤ now()', st_bullet))
story.append(Paragraph('• <b>Edge Function: oauth-callback</b> — endpoint para receber tokens OAuth de cada plataforma', st_bullet))
story.append(Paragraph('• <b>Edge Function: social-publish</b> — lógica de POST para cada API', st_bullet))

story.append(Spacer(1, 8))
story.append(Paragraph('Fluxo OAuth do Cliente (para cada plataforma):', st_h3))
story.append(Paragraph('1. Tenant (agency ou client) clica em "Conectar Instagram" no Settings do Content Factory', st_body))
story.append(Paragraph('2. Redirect para a tela de autorização da plataforma (ex: Meta Login Dialog)', st_body))
story.append(Paragraph('3. Usuário autoriza o app genOS a publicar em seu nome', st_body))
story.append(Paragraph('4. Plataforma redireciona para <b>oauth-callback</b> edge function com authorization code', st_body))
story.append(Paragraph('5. Edge function troca code por access_token + refresh_token', st_body))
story.append(Paragraph('6. Tokens encriptados são salvos em <b>social_connections</b> (tenant_id + platform)', st_body))
story.append(Paragraph('7. Token refresh automático via cron antes do vencimento', st_body))

story.append(Spacer(1, 8))
story.append(Paragraph('Vantagens:', st_h3))
story.append(Paragraph('• Controle total sobre cada integração, timing, e retry logic', st_bullet))
story.append(Paragraph('• Sem custo de API intermediária (paga apenas a infra Supabase)', st_bullet))
story.append(Paragraph('• Dados de analytics ficam 100% no seu banco', st_bullet))
story.append(Paragraph('• Sem limites impostos por terceiros além dos próprios da plataforma', st_bullet))

story.append(Paragraph('Desvantagens:', st_h3))
story.append(Paragraph('• <font color="#da1e28">6 integrações independentes para construir e manter</font>', st_bullet))
story.append(Paragraph('• Cada plataforma tem quirks: Meta exige container → publish em 2 etapas, TikTok só vídeo, etc.', st_bullet))
story.append(Paragraph('• App Review obrigatório (Meta, TikTok) pode levar semanas', st_bullet))
story.append(Paragraph('• Manutenção contínua: APIs mudam, tokens expiram, rate limits mudam', st_bullet))
story.append(Paragraph('• Estimativa: <b>4-6 semanas</b> de desenvolvimento para todas as plataformas', st_bullet))
story.append(PageBreak())

# ════════════════════════════════════════════════════════════
# 3. OPÇÃO B — API INTERMEDIÁRIA
# ════════════════════════════════════════════════════════════
story.append(Paragraph('3. Opção B — API Intermediária (Aggregator)', st_h1))
story.append(hr())
story.append(Paragraph('Nesta abordagem, o genOS envia o conteúdo para uma API unificada que se encarrega de distribuir para todas as plataformas. O OAuth do usuário final é feito na plataforma intermediária (ou via link redirect), e o genOS recebe um profile_key por tenant.', st_body))

story.append(Spacer(1, 8))
story.append(Paragraph('Comparativo de Intermediários:', st_h2))

headers = ['Critério', 'Ayrshare', 'Late.dev', 'Buffer API']
rows = [
    ['Plataformas', 'Instagram, Facebook, X, LinkedIn, TikTok, YouTube, Pinterest, Reddit, Telegram + 6', 'Instagram, Facebook, X, LinkedIn, TikTok, YouTube, Threads, Reddit, Pinterest, Bluesky, Google Business', 'Instagram, Facebook, X, LinkedIn, TikTok, YouTube, Threads, Pinterest, Bluesky, Google Business, Mastodon'],
    ['Multi-Tenant', 'Sim (Business Plan) — profile keys por tenant', 'Sim (nativo) — workspace isolation', 'Limitado (beta) — via channel IDs'],
    ['Scheduling', 'Sim — real-time + agendamento', 'Sim — queue management nativo', 'Sim — core feature'],
    ['Vídeo', 'Requer Premium ($149/mês)', 'Todos os planos (incluindo free)', 'Sim em todos os planos'],
    ['SLA/Uptime', 'Não publicado', '99.97% SLA documentado', 'Não publicado (beta)'],
    ['Rate Limits', 'Não documentado publicamente', '60-1200 req/min por tier', 'Limitado (beta)'],
    ['SDKs', 'Node, Python, Go, PHP', 'Node, Python, Go, Java, PHP, .NET, Rust', 'REST only (beta)'],
]
story.append(table_block(headers, rows, col_widths=[70, W/3-10, W/3-10, W/3-10]))

story.append(Spacer(1, 12))
story.append(Paragraph('Preços dos Intermediários:', st_h2))

headers2 = ['Plano', 'Ayrshare', 'Late.dev', 'Buffer']
rows2 = [
    ['Free / Starter', '$0 — 20 posts/mês, sem vídeo', '$0 — tier gratuito para devs', '$0 — 3 canais, 10 posts cada'],
    ['Mid-Tier', '$149/mês (Premium) — 1000 posts, vídeo incluso', '$19/mês (Build) — indivíduos', '$5/mês por canal (Essentials)'],
    ['Business', '$499/mês (Business) — multi-tenant, profiles', '$49/mês (Accelerate) — agências, +50 profiles por $49', '$10/mês por canal (Team)'],
    ['Enterprise', 'Custom pricing', '$999/mês — SLA enterprise', 'Não disponível (beta)'],
    ['Custo por Profile', 'Incluído no plano (usage-based)', '+$49 por 50 profiles adicionais', '$5-10 por canal'],
]
story.append(table_block(headers2, rows2, col_widths=[80, (W-80)/3, (W-80)/3, (W-80)/3]))

story.append(Spacer(1, 10))
story.append(Paragraph('Fluxo OAuth com Intermediário:', st_h3))
story.append(Paragraph('1. Tenant clica "Conectar Redes Sociais" no Settings do Content Factory', st_body))
story.append(Paragraph('2. genOS gera um <b>profile link</b> via API do intermediário (ex: Ayrshare /profiles)', st_body))
story.append(Paragraph('3. Tenant é redirecionado para o dashboard do intermediário para conectar suas redes', st_body))
story.append(Paragraph('4. Intermediário cuida de TODO o OAuth, tokens, refresh — genOS recebe apenas um <b>profile_key</b>', st_body))
story.append(Paragraph('5. Para publicar: genOS faz POST /post com profile_key + conteúdo', st_body))
story.append(Paragraph(f'{tag("NOTA", "#f1c21b")} Com Late.dev, é possível hospedar o OAuth flow dentro do seu app via SDK, sem redirect externo.', st_note))

story.append(Paragraph('Vantagens:', st_h3))
story.append(Paragraph('• <font color="#24a148">1 integração ao invés de 6</font> — endpoint único para todas as plataformas', st_bullet))
story.append(Paragraph('• Implementação em 1-2 semanas', st_bullet))
story.append(Paragraph('• OAuth é responsabilidade do intermediário (menos manutenção)', st_bullet))
story.append(Paragraph('• Video, carousel, stories — o intermediário normaliza os formatos', st_bullet))

story.append(Paragraph('Desvantagens:', st_h3))
story.append(Paragraph('• Custo mensal recorrente ($49-$499/mês dependendo do volume)', st_bullet))
story.append(Paragraph('• Dependência de terceiro — se cair, publicação para', st_bullet))
story.append(Paragraph('• Menos controle sobre timing exato e retry logic', st_bullet))
story.append(Paragraph('• Features avançadas (carousel, reels) podem ter limitações', st_bullet))
story.append(PageBreak())

# ════════════════════════════════════════════════════════════
# 4. COMPARATIVO
# ════════════════════════════════════════════════════════════
story.append(Paragraph('4. Comparativo: Integração Direta vs. Intermediária', st_h1))
story.append(hr())

headers3 = ['Aspecto', 'Integração Direta (In-House)', 'API Intermediária (Aggregator)']
rows3 = [
    ['Tempo de Implementação', '4-6 semanas (todas as plataformas)', '1-2 semanas (endpoint único)'],
    ['Custo Mensal', '$0 + custo de infra Supabase (~$25)', '$49-$499/mês dependendo do volume'],
    ['Custo X (Twitter) API', '$200/mês (Basic) para postar', 'Incluído no plano do intermediário'],
    ['Manutenção', 'Alta — cada API muda independentemente', 'Baixa — intermediário absorve mudanças'],
    ['App Review', 'Obrigatório (Meta ~2-4 sem, TikTok ~1-2 sem)', 'Não necessário (usa o app do intermediário)'],
    ['Multi-Tenant', 'Você implementa: social_connections + encryption', 'Nativo: profile_keys isolados por tenant'],
    ['OAuth Complexity', 'Alta — 6 fluxos diferentes', 'Baixa — 1 fluxo ou SDK do intermediário'],
    ['Controle', '100% — cada request, retry, formato', 'Parcial — depende do que a API expõe'],
    ['Analytics', 'Direto da plataforma (máximo detalhe)', 'Resumido via intermediário (pode ser limitado)'],
    ['Escalabilidade', 'Linear com complexidade por plataforma', 'Escala via upgrade de plano'],
    ['Risco de Lock-in', 'Nenhum — suas integrações', 'Médio — migrar intermediários requer retrabalho'],
    ['Ideal Para', 'Produto maduro, equipe de engenharia', 'MVP/escala rápida, equipe enxuta'],
]
story.append(table_block(headers3, rows3, col_widths=[90, (W-90)/2, (W-90)/2]))
story.append(PageBreak())

# ════════════════════════════════════════════════════════════
# 5. ESTRUTURA POR PLATAFORMA
# ════════════════════════════════════════════════════════════
story.append(Paragraph('5. Estrutura por Plataforma Social', st_h1))
story.append(hr())

platforms = [
    {
        'name': 'Instagram (Meta Graph API)',
        'auth': 'OAuth 2.0 via Facebook Login → Instagram Business/Creator Account vinculada a Facebook Page',
        'scopes': 'instagram_basic, instagram_content_publish, pages_show_list, pages_read_engagement',
        'publish_flow': '1) POST /media (cria container com image_url ou video_url + caption)\n2) Aguarda status FINISHED\n3) POST /media_publish (publica o container)\nPara Carousel: cria containers filhos → container pai → publish',
        'formats': 'Feed (imagem/vídeo), Carousel (2-10 items), Reels (vídeo 3-90s), Stories (imagem/vídeo 15s)',
        'limits': '25 posts/dia por conta, API rate limit: 200 calls/user/hour',
        'review': 'App Review obrigatório — 2-4 semanas. Precisa de Privacy Policy, Data Deletion callback, e Business Verification',
        'cost': 'API gratuita. Custo = App Review + manutenção. Token refresh a cada 60 dias (long-lived)',
        'notes': 'Basic Display API descontinuada em Dez/2024. Usar Instagram Platform API (Direct Login) para novos apps.'
    },
    {
        'name': 'Facebook (Meta Graph API)',
        'auth': 'OAuth 2.0 via Facebook Login → Page Access Token',
        'scopes': 'pages_manage_posts, pages_read_engagement, pages_show_list',
        'publish_flow': 'POST /{page-id}/feed (texto)\nPOST /{page-id}/photos (imagem)\nPOST /{page-id}/videos (vídeo)\nScheduled: scheduled_publish_time no payload',
        'formats': 'Post texto, imagem, vídeo, link, carousel (via multi-photo)',
        'limits': 'Rate limit: 200 calls/user/hour, 4800 calls/app/user/24h',
        'review': 'Mesmo App Review do Instagram (app compartilhado)',
        'cost': 'Gratuito',
        'notes': 'Compartilha app e tokens com Instagram. Uma integração cobre ambos.'
    },
    {
        'name': 'LinkedIn (Marketing API)',
        'auth': 'OAuth 2.0 3-legged → Member ou Organization tokens',
        'scopes': 'w_member_social (perfil pessoal), w_organization_social (Company Page), r_basicprofile',
        'publish_flow': 'POST /rest/posts com body JSON incluindo author (URN), commentary, e distribution.\nPara imagem/vídeo: primeiro upload via Assets API → register → upload binary → use no post.',
        'formats': 'Texto, imagem, vídeo, artigos, documentos (PDF upload), polls',
        'limits': '100 API calls/dia para apps em desenvolvimento, 100K+ após aprovação',
        'review': 'Aprovação do LinkedIn Marketing Developer Platform necessária. Company Page admin access obrigatório.',
        'cost': 'Gratuito',
        'notes': 'A partir de Dez/2025: suporta "Sign in with Google" e "Sign in with Apple" no OAuth flow.'
    },
    {
        'name': 'X / Twitter (API v2)',
        'auth': 'OAuth 2.0 PKCE (user context) ou OAuth 1.0a',
        'scopes': 'tweet.read, tweet.write, users.read, offline.access',
        'publish_flow': 'POST /2/tweets com body { "text": "..." }\nPara mídia: POST /1.1/media/upload (ainda usa v1.1) → media_id → referência no tweet.\nThreads: reply_to tweet anterior.',
        'formats': 'Texto (280 chars), imagem (até 4), GIF (1), vídeo (1, até 140s)',
        'limits': 'Free: 500 posts/mês | Basic: 10K/mês | Pro: 1M/mês',
        'review': 'Conta de desenvolvedor aprovada. Basic+ requer verificação.',
        'cost': 'Free: $0 (500 posts). Basic: $200/mês. Pro: $5,000/mês. Enterprise: $42K/mês. Pay-as-you-go disponível desde Fev/2026.',
        'notes': 'Única plataforma com custo direto de API para publicação. Free tier muito limitado para SaaS multi-tenant.'
    },
    {
        'name': 'TikTok (Content Posting API)',
        'auth': 'OAuth 2.0 via TikTok Login Kit',
        'scopes': 'video.publish, video.upload',
        'publish_flow': '1) GET /creator_info (valida duração max, privacidade)\n2) POST /publish/inbox/video/init (source=FILE_UPLOAD ou PULL_FROM_URL)\n3) Upload chunks (para FILE_UPLOAD)\n4) POST /publish/status/fetch (verificar publicação)',
        'formats': 'Vídeo (MP4 H.264, 3s-10min), Fotos (Content Posting API Photo)',
        'limits': '6 requests/min por user token. Posts de apps não auditados ficam em modo privado.',
        'review': 'Auditoria obrigatória do TikTok Developer. Sem auditoria: posts ficam privados.',
        'cost': 'Gratuito após aprovação.',
        'notes': 'Sem auditoria = posts privados (invisíveis). Auditoria verifica compliance com ToS. Somente vídeo/foto — sem texto puro.'
    },
    {
        'name': 'YouTube (Data API v3)',
        'auth': 'OAuth 2.0 via Google Cloud Console',
        'scopes': 'youtube.upload, youtube.readonly',
        'publish_flow': 'POST /youtube/v3/videos com multipart upload (metadata + binary).\nPrivacy: public, unlisted, private.\nSchedule: publishAt no snippet.',
        'formats': 'Vídeo (MP4 recomendado, até 256GB), Shorts (vertical, ≤60s)',
        'limits': 'Quota: 10,000 unidades/dia. Upload = 1,600 unidades. ~6 uploads/dia no tier gratuito.',
        'review': 'Verificação do app no Google Cloud para sensitive scopes. Quota audit para limites maiores.',
        'cost': 'Gratuito (10K units/dia). Quota extra: precisa aplicar e justificar uso.',
        'notes': 'Quota é o principal gargalo. Para multi-tenant com volume, precisa de quota increase (pode ser negado).'
    },
]

for p in platforms:
    story.append(Paragraph(p['name'], st_h2))
    fields = [
        ('Autenticação', p['auth']),
        ('Scopes', p['scopes']),
        ('Fluxo de Publicação', p['publish_flow']),
        ('Formatos Suportados', p['formats']),
        ('Rate Limits', p['limits']),
        ('App Review', p['review']),
        ('Custo da API', p['cost']),
        ('Observações', p['notes']),
    ]
    for label, val in fields:
        val_clean = val.replace('\n', '<br/>')
        story.append(Paragraph(f'<b>{label}:</b> {val_clean}', st_body))
    story.append(Spacer(1, 6))
    story.append(hr())

story.append(PageBreak())

# ════════════════════════════════════════════════════════════
# 6. CMS: WIX & WEBFLOW
# ════════════════════════════════════════════════════════════
story.append(Paragraph('6. CMS: Wix &amp; Webflow', st_h1))
story.append(hr())

story.append(Paragraph('Wix (Blog + CMS)', st_h2))
story.append(Paragraph('A Wix REST API permite criar e publicar blog posts programaticamente. O Content Factory pode gerar conteúdo (título, corpo em Rich Content / Ricos JSON, SEO meta, imagens) com base no Brand DNA e publicar diretamente no blog do tenant.', st_body))

story.append(Paragraph('<b>Autenticação:</b> OAuth 2.0 via Wix App (3rd-party app instalado no site do tenant) ou API Key para apps headless.', st_body))
story.append(Paragraph('<b>Endpoints principais:</b>', st_h3))
story.append(Paragraph('• <b>Create Draft Post:</b> POST /blog/v3/draft-posts — cria rascunho com Rich Content', st_bullet))
story.append(Paragraph('• <b>Publish Draft:</b> POST /blog/v3/draft-posts/{id}/publish — publica o rascunho', st_bullet))
story.append(Paragraph('• <b>Bulk Create:</b> POST /blog/v3/bulk/draft-posts — cria múltiplos de uma vez', st_bullet))
story.append(Paragraph('• <b>CMS Collections:</b> POST /wix-data/v2/items — insere itens em collections customizadas', st_bullet))
story.append(Paragraph('<b>Rich Content:</b> Formato Ricos JSON suportando texto formatado, imagens, vídeos embed, tabelas, headings, etc.', st_body))
story.append(Paragraph('<b>Limites:</b> 100,000 posts por blog. 400KB por post. memberId obrigatório para 3rd-party apps.', st_body))
story.append(Paragraph('<b>Custo:</b> API gratuita. Wix Business plan ($17/mês) para o site do tenant.', st_body))
story.append(Paragraph(f'{tag("FLUXO", "#8a3ffc")} Brand DNA → IA gera conteúdo em Ricos JSON → Create Draft → Quality Gate → Publish Draft → Post live no blog do tenant.', st_note))

story.append(Spacer(1, 12))
story.append(Paragraph('Webflow (CMS Collections)', st_h2))
story.append(Paragraph('A Webflow CMS API permite criar, atualizar e publicar Collection Items programaticamente. Ideal para blogs, portfólios, catálogos, e qualquer conteúdo estruturado.', st_body))

story.append(Paragraph('<b>Autenticação:</b> OAuth 2.0 via Webflow App ou Site API Token (por site).', st_body))
story.append(Paragraph('<b>Endpoints principais:</b>', st_h3))
story.append(Paragraph('• <b>Create Item (Staged):</b> POST /collections/{id}/items — cria item staged (não publicado)', st_bullet))
story.append(Paragraph('• <b>Create Item (Live):</b> POST /collections/{id}/items/live — cria e publica imediatamente', st_bullet))
story.append(Paragraph('• <b>Publish Items:</b> POST /collections/{id}/items/publish — publica items staged', st_bullet))
story.append(Paragraph('• <b>Bulk Publish:</b> Suporta publicação de múltiplos items em um request', st_bullet))
story.append(Paragraph('<b>Multi-locale:</b> Suporte nativo para conteúdo em múltiplos idiomas.', st_body))
story.append(Paragraph('<b>Limites:</b> Basic: 100 pages. CMS: 2,000 items. Business: 10,000 items.', st_body))
story.append(Paragraph('<b>Custo:</b> API incluída no plano do site. CMS Plan: $23/mês (annual) por site.', st_body))
story.append(Paragraph(f'{tag("FLUXO", "#8a3ffc")} Brand DNA → IA gera fields do Collection Item → Create Staged → Quality Gate → Publish Item → Conteúdo live no site.', st_note))

story.append(Spacer(1, 8))
story.append(Paragraph('Comparativo Wix vs. Webflow API:', st_h3))
headers_cms = ['Aspecto', 'Wix', 'Webflow']
rows_cms = [
    ['Auth', 'OAuth 2.0 / API Key', 'OAuth 2.0 / Site Token'],
    ['Blog Posts', 'Sim — Draft Posts API (Ricos JSON)', 'Sim — Collection Items (campos customizados)'],
    ['CMS Custom', 'Sim — Wix Data API', 'Sim — Collections API'],
    ['Páginas Web', 'Limitado — via Velo/Blocks (não via REST)', 'Limitado — pages via Designer, items via API'],
    ['Rich Content', 'Ricos JSON (robusto)', 'HTML em Rich Text fields'],
    ['Multi-locale', 'Sim (via Multilingual API)', 'Sim (nativo)'],
    ['Custo do site', 'Business: $17/mês', 'CMS: $23/mês'],
    ['Limite de items', '100K posts', '2K-10K items (por plano)'],
]
story.append(table_block(headers_cms, rows_cms, col_widths=[80, (W-80)/2, (W-80)/2]))
story.append(PageBreak())

# ════════════════════════════════════════════════════════════
# 7. GERAÇÃO DE ARQUIVOS
# ════════════════════════════════════════════════════════════
story.append(Paragraph('7. Geração de Arquivos (DOCX, XLSX, PDF, CSV)', st_h1))
story.append(hr())
story.append(Paragraph('O Content Factory pode gerar arquivos de múltiplos formatos com base no Brand DNA do tenant. Isso roda inteiramente no backend (Edge Functions ou Server) sem necessidade de APIs externas.', st_body))

headers_files = ['Formato', 'Biblioteca/Ferramenta', 'Caso de Uso', 'Complexidade']
rows_files = [
    ['DOCX', 'docx (Node), python-docx (Python)', 'Relatórios de marca, press releases, briefings', 'Média — templates com estilos'],
    ['XLSX', 'ExcelJS (Node), openpyxl (Python)', 'Planilhas de métricas, calendários editoriais, exports', 'Média — formatação e fórmulas'],
    ['PDF', 'PDFKit (Node), ReportLab (Python)', 'Media kits, one-pagers, certificados, relatórios visuais', 'Alta — layout visual complexo'],
    ['CSV', 'Nativo (fs/streams)', 'Export de posts, dados de analytics, bulk import', 'Baixa — texto delimitado'],
]
story.append(table_block(headers_files, rows_files, col_widths=[50, 110, (W-220)/2+30, (W-220)/2+30]))

story.append(Spacer(1, 8))
story.append(Paragraph('<b>Arquitetura:</b> Uma Edge Function <b>generate-document</b> recebe {format, template_id, data, brand_dna} e retorna o arquivo. O Brand DNA injeta cores, fontes, logo, e tom de voz no template.', st_body))
story.append(Paragraph('<b>Storage:</b> Arquivos gerados são salvos no Supabase Storage (bucket por tenant) com URLs assinadas para download.', st_body))
story.append(Paragraph('<b>Custo:</b> Zero em APIs — apenas custo de compute (Supabase Edge Functions) e storage ($0.021/GB no Supabase).', st_body))
story.append(PageBreak())

# ════════════════════════════════════════════════════════════
# 8. WIX ONLINE PROGRAMS (CURSOS)
# ════════════════════════════════════════════════════════════
story.append(Paragraph('8. Wix Online Programs (Cursos)', st_h1))
story.append(hr())
story.append(Paragraph(f'{tag("ATENÇÃO", "#da1e28")} A Wix <b>NÃO disponibiliza API pública</b> para o produto Online Programs (Cursos). Esta é uma limitação confirmada pela comunidade de desenvolvedores e pelo estado atual da documentação da Wix (Março 2026).', st_body))

story.append(Spacer(1, 8))
story.append(Paragraph('Status Atual:', st_h3))
story.append(Paragraph('• O produto "Wix Online Programs" existe como app dentro do ecossistema Wix', st_bullet))
story.append(Paragraph('• <b>NÃO há API REST</b> para criar, gerenciar ou publicar programas/cursos', st_bullet))
story.append(Paragraph('• Feature request aberta no Wix Studio Community Forum desde 2023, sem resolução', st_bullet))
story.append(Paragraph('• A Bookings API v2 cobre "courses" de agendamento (ex: Pilates 12 sessões) — <b>não é a mesma coisa</b> que programas educacionais', st_bullet))

story.append(Spacer(1, 8))
story.append(Paragraph('Alternativas Viáveis:', st_h3))
story.append(Paragraph('<b>A) Workaround via Wix CMS:</b> Criar uma Collection "Cursos" no CMS do Wix com campos customizados (título, descrição, módulos, vídeos, materiais). Popular via Wix Data API. A experiência do curso é construída com Wix Blocks ou páginas dinâmicas. Não tem LMS features nativos (progresso, certificados, quizzes).', st_body))
story.append(Paragraph('<b>B) Integração com LMS externo:</b> Usar Teachable API, Thinkific API, ou Kajabi. O Content Factory gera o conteúdo do curso (módulos, lições) e publica via API do LMS. Custo adicional do LMS ($39-199/mês).', st_body))
story.append(Paragraph('<b>C) Aguardar API da Wix:</b> Monitorar o changelog da Wix. Quando/se lançarem a API, integrar.', st_body))
story.append(Paragraph(f'{tag("RECOMENDAÇÃO", "#0f62fe")} Para o MVP, usar abordagem A (CMS customizado). Para features LMS completos (certificados, progresso), usar abordagem B com Teachable ou Thinkific.', st_note))
story.append(PageBreak())

# ════════════════════════════════════════════════════════════
# 9. MULTI-TENANT
# ════════════════════════════════════════════════════════════
story.append(Paragraph('9. Arquitetura Multi-Tenant', st_h1))
story.append(hr())
story.append(Paragraph('O genOS opera com 3 níveis de tenant: <b>Master (depth 0)</b> → <b>Agency (depth 1)</b> → <b>Client (depth 2)</b>. Cada tenant-filho herda e personaliza o Brand DNA do tenant-pai. A publicação deve respeitar essa hierarquia.', st_body))

story.append(Spacer(1, 8))
story.append(Paragraph('Fluxo de Conexão de Redes Sociais:', st_h3))
story.append(Paragraph('1. <b>Agency</b> configura o Content Factory e conecta suas próprias redes sociais (ou do cliente)', st_body))
story.append(Paragraph('2. <b>Client</b> pode conectar suas próprias redes (se autorizado pela Agency)', st_body))
story.append(Paragraph('3. Cada conexão é armazenada em <b>social_connections</b> com tenant_id + platform + profile_key/token', st_body))
story.append(Paragraph('4. Um post gerado para o Client X só pode ser publicado nas redes conectadas do Client X', st_body))
story.append(Paragraph('5. Agency pode publicar em nome do Client se tiver permissão (RBAC: agency_operator)', st_body))

story.append(Spacer(1, 8))
story.append(Paragraph('Tabela social_connections (proposta):', st_h3))
headers_sc = ['Campo', 'Tipo', 'Descrição']
rows_sc = [
    ['id', 'uuid PK', 'ID único da conexão'],
    ['tenant_id', 'uuid FK → tenants', 'Tenant dono da conexão'],
    ['platform', 'enum', 'instagram, facebook, linkedin, x, tiktok, youtube, wix, webflow'],
    ['platform_account_id', 'text', 'ID da conta na plataforma (page_id, user_urn, etc.)'],
    ['platform_account_name', 'text', 'Nome/handle da conta para display'],
    ['access_token', 'text (encrypted)', 'Token de acesso (encriptado com vault key)'],
    ['refresh_token', 'text (encrypted)', 'Token de refresh (encriptado)'],
    ['token_expires_at', 'timestamptz', 'Expiração do access_token'],
    ['profile_key', 'text', 'Profile key do intermediário (se Opção B)'],
    ['scopes', 'text[]', 'Scopes autorizados'],
    ['connected_by', 'uuid FK → profiles', 'Quem conectou (agency_operator ou client_user)'],
    ['status', 'enum', 'active, expired, revoked, error'],
    ['created_at', 'timestamptz', 'Data de conexão'],
]
story.append(table_block(headers_sc, rows_sc, col_widths=[100, 80, W-180]))

story.append(Spacer(1, 8))
story.append(Paragraph('Brand DNA por Tenant:', st_h3))
story.append(Paragraph('Cada Client herda o Brand DNA base da Agency mas pode sobrescrever campos específicos (paleta de cores, tom de voz, logo, limites de caracteres). Quando o Content Factory gera conteúdo para publicação, ele usa o Brand DNA <b>resolvido</b> (merge do pai com override do filho).', st_body))
story.append(Paragraph('Para CMS (Wix/Webflow): cada Client tem seu próprio site com sua API Key/OAuth. O Content Factory publica no site correto usando as credenciais do social_connections do Client.', st_body))
story.append(PageBreak())

# ════════════════════════════════════════════════════════════
# 10. ESTIMATIVA DE CUSTOS
# ════════════════════════════════════════════════════════════
story.append(Paragraph('10. Estimativa de Custos Consolidada', st_h1))
story.append(hr())

story.append(Paragraph('Cenário: Agency com 10 Clients, cada um publicando em 3 plataformas, ~50 posts/mês cada.', st_h3))

headers_cost = ['Item', 'Opção A (Direta)', 'Opção B (Intermediária)']
rows_cost = [
    ['Desenvolvimento Inicial', '~160-240h dev ($16K-24K one-time)', '~40-80h dev ($4K-8K one-time)'],
    ['X (Twitter) API', '$200/mês (Basic)', '$0 (incluído)'],
    ['Meta API', '$0', '$0'],
    ['LinkedIn API', '$0', '$0'],
    ['TikTok API', '$0', '$0'],
    ['YouTube API', '$0', '$0'],
    ['API Intermediária', 'N/A', '$49-499/mês (Late.dev ou Ayrshare)'],
    ['Supabase (Edge + DB + Storage)', '~$25-75/mês', '~$25-75/mês'],
    ['Wix (por site de client)', '$17/mês × 10 = $170/mês', '$17/mês × 10 = $170/mês'],
    ['Webflow (por site de client)', '$23/mês × 10 = $230/mês', '$23/mês × 10 = $230/mês'],
    ['Manutenção Mensal (dev)', '~20h/mês ($2K)', '~4h/mês ($400)'],
    ['TOTAL MENSAL (sem CMS)', '~$2,225-2,275/mês', '~$474-974/mês'],
    ['TOTAL MENSAL (com Wix)', '~$2,395-2,445/mês', '~$644-1,144/mês'],
    ['TOTAL MENSAL (com Webflow)', '~$2,455-2,505/mês', '~$704-1,204/mês'],
]
story.append(table_block(headers_cost, rows_cost, col_widths=[120, (W-120)/2, (W-120)/2]))

story.append(Spacer(1, 8))
story.append(Paragraph(f'{tag("NOTA", "#f1c21b")} Custos de Wix/Webflow são pagos pelo tenant (cliente final), não pelo genOS. O custo real para o genOS é o intermediário + infra Supabase + manutenção dev.', st_note))
story.append(PageBreak())

# ════════════════════════════════════════════════════════════
# 11. RECOMENDAÇÃO FINAL
# ════════════════════════════════════════════════════════════
story.append(Paragraph('11. Recomendação Final', st_h1))
story.append(hr())

story.append(Paragraph('Para o estágio atual do genOS — produto em construção, equipe enxuta (designer-fundador), foco em validação de mercado — a <b>Opção B (API Intermediária)</b> é a escolha clara.', st_body))

story.append(Spacer(1, 8))
story.append(Paragraph('Plano de Implementação Sugerido:', st_h2))

story.append(Paragraph('<b>Fase 1 — MVP (Semanas 1-2):</b>', st_h3))
story.append(Paragraph('• Integrar <b>Late.dev</b> (melhor custo-benefício, multi-tenant nativo, SLA documentado)', st_bullet))
story.append(Paragraph('• Criar tabela <b>social_connections</b> no Supabase', st_bullet))
story.append(Paragraph('• Implementar UI de "Conectar Redes" no Settings (master/agency only)', st_bullet))
story.append(Paragraph('• Edge Function <b>social-publish</b> que faz POST para Late.dev com profile_key + conteúdo', st_bullet))
story.append(Paragraph('• Cron <b>publish-dispatcher</b> que processa a fila de agendamento', st_bullet))

story.append(Paragraph('<b>Fase 2 — CMS (Semanas 3-4):</b>', st_h3))
story.append(Paragraph('• Integrar Wix Blog API (Create Draft → Publish) com Brand DNA', st_bullet))
story.append(Paragraph('• Integrar Webflow CMS API (Create Item → Publish) com Brand DNA', st_bullet))
story.append(Paragraph('• UI no Content Factory para selecionar destino: "Redes Sociais" ou "Blog/CMS"', st_bullet))

story.append(Paragraph('<b>Fase 3 — Arquivos &amp; Cursos (Semanas 5-6):</b>', st_h3))
story.append(Paragraph('• Edge Function <b>generate-document</b> para DOCX, XLSX, PDF, CSV', st_bullet))
story.append(Paragraph('• Workaround de cursos via Wix CMS Collections', st_bullet))
story.append(Paragraph('• UI de download/preview de arquivos gerados', st_bullet))

story.append(Paragraph('<b>Fase 4 — Escala (Futuro):</b>', st_h3))
story.append(Paragraph('• Migrar integrações de alto volume para direto (Meta, LinkedIn) se economizar custo', st_bullet))
story.append(Paragraph('• Adicionar analytics de publicação (engagement, reach, clicks)', st_bullet))
story.append(Paragraph('• API pública do genOS para white-label', st_bullet))

story.append(Spacer(1, 16))
story.append(Paragraph(f'{tag("LATE.DEV", "#24a148")} — Recomendado como intermediário principal. $49/mês (Accelerate) cobre o cenário inicial com folga. Multi-tenant nativo. 11 plataformas. Vídeo em todos os planos. SLA 99.97%. SDKs em 7 linguagens.', st_note))

story.append(Spacer(1, 30))
story.append(hr())
story.append(Paragraph('Documento gerado por genOS Cloud Platform · Content Factory Intelligence', make_style('footer_note', fontSize=8, textColor=TEXT_HELPER, alignment=TA_CENTER)))

# ── Generate PDF ──
doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print(f'✅ PDF gerado: {OUTPUT}')
print(f'   Tamanho: {os.path.getsize(OUTPUT) / 1024:.0f} KB')
