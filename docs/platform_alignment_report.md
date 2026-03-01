# genOS Cloud Platform — Relatório de Alinhamento Estratégico

## 1. Análise da Estrutura Atual

### O genOS é um Cloud Platform?
**Sim.** A estrutura atual de banco de dados (`tenants`, `applications`, `subscriptions`, `credit_wallets`) segue rigorosamente o modelo de plataforma em nuvem multitenant. A hierarquia de 3 níveis (Root -> Agency -> Client) permite que o sistema escale tanto horizontalmente (novos clientes) quanto verticalmente (novas agências).

### genOS é filho do Cestari Studio?
**Não exatamente.** O `genOS` é o ecossistema tecnológico. No banco de dados, o nó no topo é o `Cestari Studio Master` (Root). A agência `Cestari Studio` é, sim, um inquilino (tenant) filho do Master, agindo como operadora dos demais clientes.

### Wix Private Members IDs
**IDs Únicos.** Confirmamos que cada cliente possui um `wix_member_id` único, o que é o correto para isolamento de dados. Eles compartilham apenas o `wix_site_id`, indicando que residem no mesmo portal centralizado da Lumina/Cestari.

---

## 2. Pontos de Desalinhamento (Action Items)

Identificamos que a automação de Brand DNA falhou em alguns casos devido a slugs que não batem entre os arquivos `.md` e o Banco de Dados.

| Categoria | Problema | Solução |
|-----------|----------|---------|
| **Slugs** | `primeira-folha.md` vs `joaodiel` | Renomear slug no banco para `primeira-folha` |
| **Slugs** | `theo-webert.md` vs `theo` | Renomear slug no banco para `theo-webert` |
| **Slugs** | `clareira-de-avalon.md` vs `bcorbucci` | Renomear slug no banco para `clareira-de-avalon` |
| **Ausência** | `polo-ar-condicionado.md` | Criar tenant correspondente |
| **Ausência** | Tenant `renata` | Criar arquivo brand-dna correspondente ou remover |

---

## 3. Prompts de Correção (Unidade)

### Prompt 01: Padronização de Slugs
"Aplique o seguinte SQL no Supabase para sincronizar os slugs dos clientes com os nomes oficiais dos seus Brand DNAs:
```sql
UPDATE tenants SET slug = 'primeira-folha' WHERE slug = 'joaodiel';
UPDATE tenants SET slug = 'theo-webert' WHERE slug = 'theo';
UPDATE tenants SET slug = 'lets-travel-with-us-360' WHERE slug = 'letstravel360';
UPDATE tenants SET slug = 'dads-love' WHERE slug = 'jorgeluiscolombo';
UPDATE tenants SET slug = 'clareira-de-avalon' WHERE slug = 'bcorbucci';
UPDATE tenants SET slug = 'joab-nascimento' WHERE slug = 'joabnascar';
UPDATE tenants SET slug = 'jose-victor-carvalho' WHERE slug = 'victorcarvalho';
```"

### Prompt 02: Criação de Tenant Faltante (Polo Ar Condicionado)
"Execute este SQL para criar o tenant que possui arquivo de DNA mas não existia no banco:
```sql
INSERT INTO tenants (name, slug, parent_tenant_id, depth_level, plan)
VALUES ('Polo Ar Condicionado', 'polo-ar-condicionado', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 2, 'professional');
```"

---

## 4. 🏆 MASTER PROMPT (Fix-It-All)

"Atue como Database Administrator Senior. Analise a hierarquia do genOS Cloud. Eu preciso sincronizar 100% dos meus Tenants com os arquivos Brand DNA na pasta `docs/brand-dna/`. 

Execute as seguintes ações:
1. **Padronizar Slugs**: Atualize os slugs da tabela `tenants` (`joaodiel` -> `primeira-folha`, `theo` -> `theo-webert`, `letstravel360` -> `lets-travel-with-us-360`, `jorgeluiscolombo` -> `dads-love`, `bcorbucci` -> `clareira-de-avalon`, `joabnascar` -> `joab-nascimento`, `victorcarvalho` -> `jose-victor-carvalho`).
2. **Provisionar Faltantes**: Verifique se o tenant `polo-ar-condicionado` existe; se não, crie-o vinculado à agência Cestari Studio.
3. **Re-executar Ingestão**: Após alinhar os slugs, rode novamente o script `docs/ingest_brand_dnas.js` para garantir que os dnas_id sejam vinculados corretamente via subquery de slug.
4. **Validar**: Confirme que agora temos 15 tenants ativos com 15 Brand DNAs vinculados."
