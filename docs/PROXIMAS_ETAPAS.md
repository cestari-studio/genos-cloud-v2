# genOS Lumina - Próximas Etapas de Desenvolvimento

A fundação do **genOS** está construída com sucesso. Temos a autenticação em ponte com o Wix (Auth Bridge), arquitetura Node.js rodando o proxy reverso para os microserviços, o UI Shell (Dark Mode `g100`/`g90`) configurado nativamente com o IBM Carbon, e as páginas de configurações e vitrine de componentes (Foundry) montadas. Além disso, criamos um Login cinematográfico com Modal Decorado de AI com base nas guidelines avançadas da IBM.

Com base nesse alicerce, aqui estão as opções para as **próximas grandes etapas** do sistema. O usuário pode escolher qual caminho focar primeiro:

### Etapa A: Dashboard Avançado de Monitoramento (Home)
- **Objetivo**: Transformar a tela inicial (`Home.tsx`) num Centro de Comando (Command Center).
- **Entregáveis**:
  - Integração do pacote `@carbon/charts-react` (se ainda não explorado) ou construção de Gauges e DataCards usando Layouts Nativos do Carbon.
  - Exibição de Métricas do "WatsonX / genOS AI": Uso de tokens, uptime dos clusters de inferência e número de requisições.
  - Grid de "Atividades Recentes" listando logs do Wix Bridge e tentativas de login.

### Etapa B: Interface de Chat AI / WatsonX Console (Nova Página)
- **Objetivo**: Dar vida à "Plataforma AI" criando o ambiente onde o usuário interage (prompt) com o genOS.
- **Entregáveis**:
  - Novo módulo de Rota (ex: `/console` ou `/ai-chat`).
  - Um console de Chat estilizado corporativamente (semelhante ao WatsonX.ai ou ChatGPT), usando Listas de Notificações, Inline Loadings, e AI Labels para as respostas da IA.
  - Barra inferior de "Input" presa na tela para envio de prompts complexos.

### Etapa C: Faturamento, Pricing & Quotas (Settings/Billing)
- **Objetivo**: Conectar o lado de "Negócios" do genOS, crucial já que integramos planos Wix.
- **Entregáveis**:
  - Nova aba em `Settings.tsx` dedicada a Faturamento (Billing).
  - Componentes de `<ProgressIndicator>` e `<ProgressBar>` para mostrar consumo mensal de Tokens por camada (Tier Grátis, Pro, Enterprise).
  - Tabelas de faturas passadas (Data Table com Expandable Rows).

### Etapa D: Refatoração e Deploy Híbrido (DevOps)
- **Objetivo**: Empacotar o genOS para ir ao ar em produção.
- **Entregáveis**:
  - Revisar variáveis de ambiente (`.env.production`).
  - Otimização do bundle Vite/React (Code Splitting das enormes bibliotecas do Carbon).
  - Containerização da Node.js Bridge (criação de `Dockerfile` e `docker-compose.yml`) preparando a ponte de tráfego para a DigitalOcean, AWS ou Vercel.

**Aguardando a direção do usuário para iniciar o desenvolvimento ativo da opção selecionada.**
