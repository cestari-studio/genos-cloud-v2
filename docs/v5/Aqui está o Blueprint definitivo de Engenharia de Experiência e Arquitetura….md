Aqui está o Blueprint definitivo de Engenharia de Experiência e Arquitetura Sistêmica para o genOS™ v5.0.0, estabelecendo os padrões de design, fluxos de operação e a conectividade granular exigida pela Cestari Studio.  
  
## Blueprint Industrial & Design System: genOS™ v5.0.0  
A evolução do genOS™ para a versão 5.0.0 funde uma infraestrutura serverless rigorosa (Supabase + Vercel) com a precisão ergométrica do **IBM Carbon Design System (v11)**. Este documento atua como a matriz de verdade para a equipe de engenharia e design, mapeando a interseção exata entre operações de banco de dados, lógica agêntica e padrões de interface visual (UX/UI).  
## 1. Stack de Design e Componentização (The Carbon Ecosystem)  
A interface da plataforma abandona componentes genéricos em favor de uma adoção exaustiva do ecossistema Carbon, operando invariavelmente sob o **Tema GS100 (Gray 100)** para garantir contraste industrial e foco cognitivo.  
* **Core UI (@carbon/react):** Toda a fundação estrutural utiliza o sistema de grade 2x (16 colunas). A superfície universal é ancorada no token $background (#161616), enquanto as camadas modais e *DataTables* elevam-se cromaticamente para o token $layer-01 (Gray 90).   
* **Data Visualization (@carbon/charts):** O módulo FinOps Explorer™ e o GEO Intelligence™ empregam DonutCharts e StackedBarCharts para transformar telemetria bruta e consumo de tokens em insights financeiros imediatos, utilizando interações de *Tooltip* customizadas para exibir métricas de ROI.  
* **Expressive UI (@carbon/ibm-dotcom):** Reservado para o site institucional da Cestari Studio e para o *Handover Hub* (Módulo 10). Emprega *Leadspaces* e pictogramas de alto contraste para celebrar a ativação de novos *tenants* sem poluir a interface de trabalho.   
* **AI Experience (@carbon/ai-chat):** A materialização visual do motor Helian™. Utiliza os componentes AILabel (nas variantes *Default* e *Inline*) para transparência sistêmica, e AISkeletonText / AISkeletonPlaceholder gerando estados de *shimmer* com aria-live="polite" para preencher a tela durante a latência de execução das Edge Functions.  
## 2. Taxonomia de Ecossistema: Produtos e Engines  
A interação entre os módulos segue uma hierarquia de microsserviços onde a responsabilidade é estritamente delegada:  
* **Produtos Cloud:** Content Factory™ (Workstation de produção), GEO Intelligence™ (Predição semântica), Agency Master™ (Controle B2B multi-tenant) e FinOps Explorer™ (Auditoria de recursos).  
* **Subprodutos e Serviços:** BrandDNA™ (Vetorização de identidade via pgvector), QualityGate™ (Workflow de aprovação humana e *guardrails*), Matrix Grid™ / Matrix List™ (Renderização visual e edição em lote) e Social Scheduler™ (Logística cronometrada de webhooks).  
* **Engines (Motores Serverless):**  
    * **Helian™ (AI-Engine):** Orquestrador agêntico que utiliza o padrão de *AI Router* para alternar dinamicamente entre Claude e Gemini, otimizando custo e precisão.   
    * **Agent Envelope™:** Motor de *Context Engineering* que injeta regras absolutas de negócio just-in-time no prompt, prevenindo alucinações e degradação de contexto (*Context Rot*).   
    * **Compliance Auditor™:** Filtro de heurística que cruza saídas da IA com restrições corporativas.  
    * **Wix Auth Bridge™:** Camada de identidade (OIDC) que processa e enriquece o JWT com as *custom claims* necessárias para destravar os silos de dados.   
* **Add-ons:** Quantum Pulse (análise de probabilidade híbrida via Qiskit ), Real-time Context (Web scraping para fact-checking) e White-label Suite.   
## 3. Lógica de Operação, Inteligência e FinOps  
A engenharia financeira e a transparência de IA são tratadas como recursos de primeira classe diretamente na UI:  
* **Transparência de Inteligência:** Cada campo de input no Content Factory™ (como o gerador de *Post Static* ou *Reels*) é acompanhado por um AILabel Inline With Content. Este componente apresenta a análise prévia de gasto de tokens, informando ao usuário o custo da requisição antes do clique.  
* **Justificativa de IA (Heurística):** Quando o Compliance Auditor™ avalia um post, o componente *Standard AILabel* é acionado utilizando o padrão *AI Explained*. Um popover revela o relatório de heurística de 100 palavras gerado pela engine, explicando exatamente por que certas palavras-chave da marca foram priorizadas ou bloqueadas.  
* **Ciclo da Credit Wallet e Overage (Stripe):** Cada execução do Helian™ gera logs de telemetria transformados em eventos (stripe.billing.meters.createEvent). O componente *ProgressIndicator* reflete o saldo da Credit Wallet. Quando o limite é excedido, ocorre a transição automática para o *Overage Billing* (Pay-per-use), e os padrões de interface *Toasts* e *Expressive Modals* do Carbon notificam o administrador da conta.   
* **Injeção do QHE Score:** O motor em Python do Quantum Pulse processa simulações probabilísticas multidimensionais e devolve o Score QHE. O Agent Envelope™ empacota esse score como um metadado formatado e o injeta diretamente no prompt de contexto da geração seguinte do Helian™, refinando a assertividade da campanha sem intervenção manual.  
## 4. Segurança, Acessibilidade e Design Mobile-First  
O nível de resiliência e usabilidade garante que a plataforma atenda padrões enterprise.  
* **Segurança e JWT Handshake:** A arquitetura RLS (Row Level Security) do PostgreSQL utiliza as funções seguras (select auth.jwt() -> 'app_metadata' -> 'tenant_id') para isolar dados. O sistema reflete os papéis na UI: o SYSADMIN tem acesso a telemetria irrestrita; o AGENCY utiliza a cláusula IN no RLS para visualizar *DataTables* consolidadas; o TENANT ADMIN controla o fluxo de faturamento; e o FREELANCER possui inputs restritos a *Read-only* nos módulos de configuração de marca, podendo atuar apenas nas *Text Toolbars* do QualityGate™.   
* **Acessibilidade (A11y):** A workstation garante conformidade WCAG AA/AAA. Todos os botões e áreas interativas mantêm ativamente o contorno azul de foco (token $focus), garantindo navegação lógica via teclado (Tab). O componente AISkeleton utiliza aria-live="polite" para que os leitores de tela anunciem atualizações de conteúdo agêntico sem interromper a fala atual.   
* **Mobile First (A Workstation de Bolso):** O grid 2x do Carbon possibilita a degradação responsiva da Matrix List™. Em telas menores, colunas secundárias são colapsadas utilizando classes de visibilidade, o SideNav do Console Hub converte-se em um menu hambúrguer, e as interações do QualityGate™ adotam *Bottom Sheets* para facilitar o manuseio tátil com áreas de toque mínimas de 44x44px.  
  
## 5. Anatomia e Conectividade: A Matriz das Workstations  
O mapeamento exaustivo a seguir cruza o fluxo do usuário com os recursos exatos do Carbon Design System e a arquitetura subjacente.  
## Módulo 2: Onboarding & Ativação (The Gateway)  
* **Página/Step:** BrandDNA™ Setup (Visual & Voz)  
* **Operação Real:** Definição de Niche, Missão, Voz e Arquétipo da marca.  
* **Lógica Serverless/DB:** Ingestão de embeddings no pgvector acionada por Edge Functions; RLS restringe a gravação ao tenant_id.  
* **Componente Carbon:** FluidForm encapsulado em um Tile (elevado ao $layer-01), campos TextInput e TextArea.  
* **UX Pattern:** *Empty States* para guiar o usuário na primeira configuração; *ProgressIndicator* acompanhando os passos até a ativação.  
## Módulo 4: Agency Master™ (B2B Control)  
* **Página/Step:** Agency Dashboard / Client Portfolio  
* **Operação Real:** Visão consolidada e particionamento de clientes.  
* **Lógica Serverless/DB:** Consulta Postgres ignorando o isolamento simples e utilizando um array auth.jwt() -> 'app_metadata' -> 'teams' para renderizar múltiplos clientes filhos.   
* **Componente Carbon:** DataTable tradicional associada a Search (Busca global) e Complex Charts.  
* **UX Pattern:** *Filtering* avançado para encontrar contas filhas e *Disclosures* (Accordions) para visualizar o "Onboarding Tracker" sem sair da página principal.  
## Módulo 6: Content Factory™ (Industrial Core)  
* **Página/Step:** Matrix List™  
* **Operação Real:** Workstation de produção em massa, regeneração de saídas, e envio para aprovação via Helian™.  
* **Lógica Serverless/DB:** Edge Functions invocando o Vercel AI SDK em streaming (streamObject); Auditoria de integridade persistida no PostgreSQL (Version History).  
* **Componente Carbon:** DataTable com a variação ai-label-with-expansion. Linhas individuais utilizam AISkeletonPlaceholder durante o processamento.  
* **UX Pattern:** *Common Actions* via Toolbar (Aprovar, Regenerar, Agendar) por linha; *AI Explained* no AILabel acoplado à célula para justificar as escolhas de *copywriting*. Transições de movimento usando os tokens nativos do Carbon (e.g., standard-easing).  
## Módulo 8: Social Hub & QualityGate™  
* **Página/Step:** QualityGate™ (Feedback Inbox) & Scheduler  
* **Operação Real:** Revisão estratégica humana, alteração final de assets e agendamento de webhooks para APIs do Instagram/TikTok.  
* **Lógica Serverless/DB:** Motor pg_cron avaliando carimbos de tempo (timestamps) de postagens aprovadas.  
* **Componente Carbon:** Text Toolbar customizada para ajustes no artefato gerado e DatePicker para organização logística.  
* **UX Pattern:** *Expressive Modals* para confirmar aprovações arriscadas e *Notifications* (Toasts) para confirmar sucesso de publicação ou erros de API externa.  
## Módulo 9: FinOps Explorer™  
* **Página/Step:** Cost Audit & Billing  
* **Operação Real:** Auditoria minuciosa do consumo da Credit Wallet (Token Control) e transição de faturamento (Stripe).  
* **Lógica Serverless/DB:** Consulta a Materialized Views com os dados de experimental_telemetry de tokens; Chamadas à API de *Invoices* do Stripe.  
* **Componente Carbon:** DonutChart (para proporção de créditos gastos) e StackedBarChart (Custo Gemini vs Claude).  
* **UX Pattern:** *Dashboards* limpos focado no grid estrutural; *Dialogs* (confirmação crítica) acionados para alertar transições para *Overage Billing*.  
  
## 6. Documentação de Handover: Referência de Código  
Para garantir a reprodutibilidade exata, abaixo constam referências arquiteturais em código TypeScript e SQL detalhando a integração entre o Carbon, Vercel AI e Supabase RLS.  
**A. Componentização da Matrix List com AI Experience (React/Carbon)**  
**A. Componentização da Matrix List com AI Experience (React/Carbon)**  
Exibe a integração profunda do estado de *loading* agêntico utilizando os padrões oficiais da IBM.  
TypeScript  
TypeScript  
##   
##   
##   
## import { DataTable, Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from '@carbon/react';  
## import { AILabel, AISkeletonText } from '@carbon/react/icons';  
## import { useChat } from 'ai/react';  
##   
## export function MatrixListWorkstation({ tenantId }) {  
##   // Integramos a geração de conteúdo em streaming  
##   const { messages, isLoading, append } = useChat({  
##     api: '/api/helian-router',  
##     headers: { 'x-tenant-id': tenantId }  
##   });  
##   
##   return (  
##     <DataTable rows={messages} headers={headers}>  
##       {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (  
##         <Table {...getTableProps()}>  
##           <TableHead>  
##             <TableRow>  
##               {headers.map((header) => (  
##                 <TableHeader {...getHeaderProps({ header })}>  
##                   {header.header}  
##                 </TableHeader>  
##               ))}  
##               {/* Posicionamento Consistente do AILabel no cabeçalho da tabela */}  
##               <TableHeader>  
##                 <AILabel size="sm" align="right" text="AI Generated via Helian™" />  
##               </TableHeader>  
##             </TableRow>  
##           </TableHead>  
##           <TableBody>  
##             {rows.map((row) => (  
##               <TableRow {...getRowProps({ row })}>  
##                 {row.cells.map((cell) => (  
##                   <TableCell key={cell.id}>  
##                     {/* Motion e Skeleton para suavizar latência Serverless */}  
##                     {isLoading && cell.isGenerating? (  
##                       <AISkeletonText aria-live="polite" />  
##                     ) : (  
##                       cell.value  
##                     )}  
##                   </TableCell>  
##                 ))}  
##               </TableRow>  
##             ))}  
##           </TableBody>  
##         </Table>  
##       )}  
##     </DataTable>  
##   );  
## }  
**B. Orquestração do Helian™ AI Router com Fallback Automático (Vercel Edge)**  
Garante zero *downtime* na esteira industrial, mudando de modelos de forma assíncrona.  
Garante zero *downtime* na esteira industrial, mudando de modelos de forma assíncrona.  
TypeScript  
TypeScript  
##   
##   
##   
**// app/api/helian-router/route.ts**  
## import { streamText } from 'ai';  
## import { getTenantContext } from '@/lib/agent-envelope';  
##   
## export const runtime = 'edge';  
##   
**export async function POST(request: Request) {**  
**  const { prompt } = await request.json();**  
**  const tenantId = request.headers.get('x-tenant-id');**  
    
**  // Agent Envelope™ compõe as regras estritas da marca**  
**  const systemContext = await getTenantContext(tenantId);**  
  
**  const result = streamText({**  
**    model: 'anthropic/claude-sonnet-4.5', // Modelo Especialista Primário**  
**    system: systemContext,**  
    prompt,  
**    providerOptions: {**  
**      gateway: {**  
**        // Fallback Strategy: Se a Anthropic falhar, transita silenciosamente **  
**        // para o modelo do Google para proteger a linha de montagem**  
**        models: ['google/gemini-3-flash', 'openai/gpt-4o-mini'],**  
      },  
    },  
**    experimental_telemetry: {**  
**      isEnabled: true, // Aciona o metering pro FinOps Explorer**  
**      functionId: `content-factory-${tenantId}`**  
    }  
  });  
  
##   return result.toDataStreamResponse();  
## }  
**C. Handshake de Segurança: Supabase RLS com Custom Claims do Wix**  
A fundação do banco de dados que blinda a infraestrutura, exigindo que o identificador de organização seja avaliado globalmente.  
SQL  
SQL  
##   
##   
##   
**-- Habilitar RLS estrito na tabela principal de assets industriais**  
## ALTER TABLE public.content_assets ENABLE ROW LEVEL SECURITY;  
##   
**-- Política Definitiva para o Role TENANT_ADMIN**  
**-- Otimizada extraindo o valor do JSON apenas uma vez para uso do Query Planner**  
## CREATE POLICY "Strict Tenant Isolation"  
## ON public.content_assets  
## FOR ALL  
## TO authenticated  
**USING (**  
##   tenant_id = (SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid)  
## )  
**WITH CHECK (**  
##   tenant_id = (SELECT NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid)  
## );  
Este Blueprint codifica os pilares exigidos, orquestrando um maquinário Serverless inabalável que atua como o sistema nervoso central da agência, envelopado na estética e arquitetura pragmática do nível mais alto da indústria.  
