# DNA Brand — Cestari Studio Master

> Nó raiz do ecossistema genOS Cloud Platform.

---

## 1. Identidade

| Campo | Valor |
|-------|-------|
| **Nome** | Cestari Studio Master |
| **Slug** | cestari-studio |
| **Email** | mail@cestari.studio |
| **Segmento** | Holding / Plataforma de gestão |
| **Plano** | Enterprise |
| **Profundidade** | Depth 0 (raiz) |
| **Tipo** | Agência (master node) |

---

## 2. Propósito

### Função
O Cestari Studio Master é o **nó raiz** da arquitetura multi-tenant do genOS Cloud Platform. Ele funciona como a conta administrativa principal que gerencia todos os sub-tenants (clientes da Cestari Studio).

### Diferença do "Cestari Studio"

| Aspecto | Cestari Studio Master | Cestari Studio |
|---------|----------------------|----------------|
| **Depth** | 0 (raiz) | 1 (sub-tenant) |
| **Plano** | Enterprise | Professional |
| **Função** | Admin/plataforma | Agência/execução |
| **Visibilidade** | Todos os tenants | Próprios projetos |

---

## 3. Capacidades

### Gestão Multi-Tenant
- Visão global de todos os 15 clientes ativos
- Dashboard administrativo com métricas cross-tenant
- Gestão de planos (enterprise, professional, starter)
- Configuração de brand configs por tenant

### Hierarquia

```
Cestari Studio Master (depth 0, enterprise)
├── Cestari Studio Agency (depth 1, professional)
├── Polo Ar Condicionado (depth 1, enterprise)
└── [13 clientes depth 2]
    ├── All Life Institute (starter)
    ├── Clareira de Avalon (professional)
    ├── Dads Love (starter)
    ├── Fabio Andreoni / Obbra (professional)
    ├── Gabriel Salvadeo (starter)
    ├── Joab Nascimento (professional)
    ├── José Victor Carvalho (starter)
    ├── Lets Travel With Us 360 (starter)
    ├── Nina Couto (starter)
    ├── Primeira Folha (starter)
    ├── Puttinato (starter)
    └── Theo Webert (professional)
```

---

## 4. Infraestrutura

### genOS Cloud Platform
- **Stack**: Next.js 14 + Supabase + Vercel
- **Auth**: Email verification + cookie session
- **Database**: PostgreSQL com RLS (Row Level Security)
- **Storage**: Supabase Storage (mídias dos clientes)
- **Multi-tenancy**: Isolamento por tenant_id via RLS

### Evolução Planejada

| Fase | Tecnologia |
|------|-----------|
| MVP | Supabase Auth + RLS |
| Fase 2 | Keycloak + Namespaces K8s |
| Fase 3 | SSO Enterprise + Zero Trust |

---

## 5. Voz da Marca

A marca Cestari Studio Master não tem comunicação externa. É uma entidade puramente administrativa/técnica. Toda comunicação pública é feita pela marca "Cestari Studio".

---

## 6. Observações

Este tenant existe para fins de gestão da plataforma e não representa uma marca pública. O DNA Brand da marca Cestari Studio (para comunicação, branding e identidade visual) está no arquivo `cestari-studio.md`.

---

*Documento gerado pela Cestari Studio via genOS Cloud Platform*
*Fonte: Supabase (tenants), arquitetura do sistema*
