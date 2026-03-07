import type { DocCategory } from "./types"

export const gerenciamentoApisCategory: DocCategory = {
  slug: "gerenciamento-apis",
  title: "Gerenciamento de APIs",
  description:
    "Aprenda a criar, configurar e gerenciar suas APIs utilizando o dashboard e o editor visual de fluxo.",
  icon: "Workflow",
  articles: [
    {
      slug: "criando-apis",
      title: "Criando e Configurando APIs",
      description:
        "Guia completo sobre rotas, upstreams, services e balanceamento de carga.",
      icon: "Route",
      tags: ["rotas", "upstreams", "load-balancing"],
      content: [
        {
          id: "rotas",
          title: "Rotas",
          body: `Uma **rota** é o recurso fundamental do API Gateway. Ela define as regras de correspondência para requisições de entrada e determina como elas devem ser processadas e encaminhadas.

Cada rota é composta por:

- **URI** — O caminho da requisição (ex: \`/api/v1/usuarios/*\`). Suporta correspondência exata, prefixos e wildcards.
- **Métodos HTTP** — Quais métodos são aceitos (GET, POST, PUT, DELETE, etc.)
- **Host** — Domínio ou subdomínio para correspondência (ex: \`api.meusite.com\`)
- **Headers** — Correspondência opcional por headers da requisição
- **Variáveis** — Condições avançadas usando variáveis do gateway (IP do cliente, argumentos, etc.)

### Prioridade de Correspondência
Quando múltiplas rotas podem corresponder a uma mesma requisição, o gateway utiliza um sistema de prioridade. Você pode definir a prioridade manualmente no campo **Priority** ou deixar que o sistema calcule automaticamente com base na especificidade da rota.

> **Dica:** Rotas mais específicas (ex: \`/api/v1/usuarios/123\`) devem ter prioridade maior que rotas genéricas (ex: \`/api/v1/usuarios/*\`). Isso garante que a correspondência mais precisa seja utilizada.`,
        },
        {
          id: "upstreams",
          title: "Upstreams e Balanceamento de Carga",
          body: `O **upstream** define o conjunto de servidores backend que recebem as requisições encaminhadas pelo gateway. Você pode configurar um upstream diretamente na rota ou criá-lo separadamente para reuso entre múltiplas rotas.

### Configurando Nós
Cada upstream contém uma lista de **nós** (nodes), onde cada nó representa um servidor backend:

- **Host** — IP ou hostname do servidor (ex: \`10.0.0.1\` ou \`backend.internal\`)
- **Porta** — Porta do serviço (ex: \`8080\`)
- **Peso** — Influência na distribuição de carga (ex: peso 2 recebe o dobro de tráfego que peso 1)

### Algoritmos de Balanceamento
O gateway suporta quatro algoritmos de balanceamento de carga:

- **roundrobin** — Distribui requisições de forma circular entre os nós, respeitando os pesos configurados. É o algoritmo padrão e funciona bem para a maioria dos cenários.
- **chash** (Consistent Hashing) — Direciona requisições com a mesma chave (header, cookie ou variável) sempre para o mesmo nó. Ideal para cenários com cache local ou sessões sticky.
- **ewma** (Exponentially Weighted Moving Average) — Seleciona automaticamente o nó com menor latência recente. Excelente para upstreams com nós heterogêneos.
- **least_conn** — Encaminha para o nó com menos conexões ativas no momento. Bom para requisições com tempo de processamento variável.

> **Nota:** Para configurar consistent hashing, você precisa definir o campo \`hash_on\` (ex: \`header\`, \`cookie\`, \`consumer\`) e o \`key\` correspondente (ex: nome do header).`,
          subsections: [
            {
              id: "health-checks",
              title: "Health Checks",
              body: `O gateway pode monitorar a saúde dos nós do upstream com health checks ativos e passivos:

- **Health Check Ativo** — O gateway envia requisições periódicas (ex: \`GET /health\`) para cada nó e marca como indisponível aqueles que não respondem corretamente.
- **Health Check Passivo** — O gateway analisa as respostas reais do tráfego. Se um nó retornar erros consecutivos (ex: 5 respostas 5xx seguidas), ele é temporariamente removido do balanceamento.

Configure health checks na seção **Checks** do upstream. Defina o intervalo entre verificações, o número de sucessos para considerar saudável e o número de falhas para considerar indisponível.

> **Dica:** Combine health checks ativos e passivos para obter a melhor detecção de falhas. O passivo reage rapidamente a problemas, enquanto o ativo detecta recuperação.`,
            },
          ],
        },
        {
          id: "services",
          title: "Services e Service Discovery",
          body: `Um **service** agrupa configurações de upstream e políticas que podem ser compartilhadas entre múltiplas rotas. Em vez de repetir a mesma configuração em cada rota, você cria um service e o referencia.

### Quando Usar Services
- Quando múltiplas rotas apontam para o mesmo backend
- Quando você quer aplicar as mesmas políticas a um grupo de rotas
- Para simplificar a manutenção — altere o service e todas as rotas vinculadas serão atualizadas

### Service Discovery
Para ambientes dinâmicos onde os endereços dos backends mudam frequentemente (como Kubernetes ou Consul), o gateway suporta **service discovery**:

- **DNS** — Resolve o hostname do upstream via DNS e atualiza automaticamente os nós quando os registros mudam.
- **Consul** — Integra-se com HashiCorp Consul para descoberta automática de serviços registrados.
- **Kubernetes** — Descobre pods diretamente a partir dos services do Kubernetes.

Com service discovery habilitado, você não precisa gerenciar manualmente a lista de nós. O gateway atualiza os endereços automaticamente conforme os serviços escalam ou migram.

> **Atenção:** Ao usar service discovery, certifique-se de que o gateway tem conectividade de rede com o provedor de discovery (DNS, Consul, API do Kubernetes). Problemas de conectividade podem resultar em upstreams vazios.`,
        },
        {
          id: "configuracoes-avancadas",
          title: "Configurações Avançadas de Rota",
          body: `Além das configurações básicas, cada rota oferece opções avançadas para cenários específicos:

### Timeout e Retries
- **connect_timeout** — Tempo máximo para estabelecer conexão com o upstream (padrão: 60s)
- **send_timeout** — Tempo máximo para enviar a requisição ao upstream
- **read_timeout** — Tempo máximo para receber a resposta do upstream
- **retries** — Número de tentativas em caso de falha de conexão

### Filtragem por Variáveis
Você pode adicionar condições avançadas usando variáveis do gateway. Por exemplo:

- Rotear apenas requisições de um IP específico: \`remote_addr == 10.0.0.5\`
- Rotear por valor de header: \`http_x_tenant == empresa-a\`
- Rotear por argumento de query: \`arg_version == v2\`

### Habilitação de WebSocket
Para rotas que precisam suportar conexões WebSocket, habilite a opção **enable_websocket** na configuração da rota. O gateway fará o upgrade automático da conexão HTTP para WebSocket.

> **Dica:** Defina timeouts adequados ao tempo de processamento do seu backend. APIs que realizam operações demoradas (relatórios, processamento de dados) podem precisar de timeouts maiores que o padrão.`,
        },
      ],
    },
    {
      slug: "editor-fluxo",
      title: "Editor Visual de Fluxo",
      description:
        "Aprenda a usar o editor visual drag-and-drop para configurar o pipeline de processamento das suas APIs.",
      icon: "GitBranch",
      tags: ["flow-editor", "visual", "drag-drop"],
      content: [
        {
          id: "introducao-editor",
          title: "Entendendo o Editor de Fluxo",
          body: `O **Editor Visual de Fluxo** é a principal ferramenta de configuração de APIs no FuseOne. Ele apresenta o pipeline de processamento de requisições como um diagrama visual, onde cada nó representa uma etapa do processamento.

O fluxo segue a seguinte estrutura:

- **Requisição de Entrada** — O ponto inicial, representando a requisição do cliente
- **Políticas de Requisição** — Processamento aplicado antes de encaminhar ao upstream (autenticação, rate limiting, transformação)
- **Upstream** — O serviço backend de destino
- **Políticas de Resposta** — Processamento aplicado na resposta antes de devolver ao cliente (transformação, headers, CORS)
- **Resposta ao Cliente** — O ponto final do fluxo

Cada política é representada como um **card** no diagrama, mostrando o nome, categoria (por cor) e um indicador de status (configurada ou pendente).

> **Nota:** As políticas são executadas na ordem em que aparecem no fluxo, de cima para baixo. A ordem pode impactar o comportamento — por exemplo, a autenticação deve vir antes da restrição por consumidor.`,
        },
        {
          id: "adicionando-politicas",
          title: "Adicionando Políticas ao Fluxo",
          body: `Para adicionar uma política ao pipeline da sua API:

1. No editor de fluxo, clique no botão **"+"** entre dois nós existentes ou no final do pipeline
2. A **Galeria de Políticas** será aberta, mostrando todas as políticas disponíveis organizadas por categoria
3. Navegue pelas categorias ou use o campo de busca para encontrar a política desejada
4. Clique na política para adicioná-la ao fluxo

### Configurando uma Política
Após adicionar uma política, o painel de configuração será aberto automaticamente:

- Preencha os campos obrigatórios (marcados com asterisco)
- Campos opcionais permitem ajuste fino do comportamento
- Use o botão **Documentação** para ver a referência completa da política
- O painel mostra uma pré-visualização do JSON de configuração gerado

### Removendo e Reordenando
- Para **remover** uma política, clique no ícone de lixeira no card
- Para **reordenar**, arraste o card para a posição desejada no pipeline
- Para **desabilitar** temporariamente sem remover, use o toggle no card

> **Dica:** Você pode duplicar uma política configurada clicando no menu de opções (três pontos) do card e selecionando "Duplicar". Isso é útil quando você precisa de configurações semelhantes em diferentes pontos do fluxo.`,
        },
        {
          id: "pipeline-requisicao",
          title: "Pipeline de Processamento",
          body: `Entender a ordem de execução do pipeline é essencial para configurar APIs corretamente. O gateway processa cada requisição nas seguintes fases:

### Fase de Requisição (Request)
Políticas executadas **antes** de encaminhar a requisição ao upstream:

1. **Autenticação** — Verifica a identidade do chamador (key-auth, jwt-auth, etc.)
2. **Segurança** — Aplica restrições de acesso (ip-restriction, consumer-restriction)
3. **Controle de tráfego** — Verifica limites de taxa e quotas (limit-req, limit-count)
4. **Transformação** — Modifica a requisição antes do encaminhamento (proxy-rewrite, body-transformer)

### Fase de Resposta (Response)
Políticas executadas **após** receber a resposta do upstream:

1. **Transformação** — Modifica a resposta (response-rewrite, body-transformer)
2. **Observabilidade** — Registra logs e métricas (http-logger, kafka-logger)

### Fase de Log
Executada de forma assíncrona após a resposta ser enviada ao cliente. Não impacta a latência percebida.

> **Atenção:** Algumas políticas têm fase fixa (ex: autenticação sempre roda na fase de requisição). Outras podem ser configuradas para rodar em fases diferentes. Consulte a documentação de cada política para detalhes.`,
        },
        {
          id: "modo-json",
          title: "Modo JSON Avançado",
          body: `Para usuários avançados, o editor oferece um **modo JSON** que permite editar a configuração da rota diretamente em formato JSON:

1. No editor de fluxo, clique no botão **JSON** no canto superior direito
2. O editor de código será aberto com a configuração completa da rota
3. Edite o JSON conforme necessário
4. Clique em **Aplicar** para salvar as alterações

### Quando Usar o Modo JSON
- Quando você precisa configurar opções avançadas não disponíveis na interface visual
- Para copiar e colar configurações entre rotas ou ambientes
- Para configurar políticas com parâmetros complexos ou aninhados
- Para debug — o JSON mostra exatamente o que será enviado ao gateway

### Validação
O editor JSON inclui:
- **Syntax highlighting** — Destaque de sintaxe para facilitar a leitura
- **Validação em tempo real** — Erros de sintaxe JSON são destacados imediatamente
- **Auto-complete** — Sugestões de campos e valores baseados no schema da API

> **Dica:** Você pode alternar livremente entre o modo visual e o modo JSON. As alterações feitas em um modo são refletidas automaticamente no outro. Isso permite usar o modo visual para tarefas comuns e o JSON para ajustes finos.`,
        },
      ],
    },
    {
      slug: "ciclo-vida",
      title: "Ciclo de Vida de APIs",
      description:
        "Entenda os estados, versionamento e rastreamento de mudanças no ciclo de vida das suas APIs.",
      icon: "RefreshCw",
      tags: ["lifecycle", "versionamento", "deploy"],
      content: [
        {
          id: "estados",
          title: "Estados de uma API",
          body: `No FuseOne, cada API passa por um ciclo de vida bem definido com os seguintes estados:

### Rascunho (Draft)
Estado inicial de uma API recém-criada. Neste estado:
- A configuração pode ser editada livremente
- A rota **não está ativa** no gateway — nenhum tráfego é processado
- Ideal para preparar e revisar a configuração antes da publicação
- Você pode salvar e voltar a editar quantas vezes quiser

### Publicada (Deployed)
A API está ativa e processando tráfego no gateway:
- Requisições que correspondem à rota são processadas normalmente
- Alterações na configuração são aplicadas imediatamente ao salvar
- Métricas e logs são coletados ativamente
- Este é o estado normal de operação

### Depreciada (Deprecated)
A API está marcada para descontinuação:
- Ainda processa tráfego normalmente para manter compatibilidade
- Um aviso visual indica que a API está depreciada
- Consumidores devem ser notificados para migrar para a nova versão
- Após o período de transição, a API pode ser desativada

> **Nota:** A transição entre estados é registrada no audit log com o usuário responsável e a data/hora da mudança. Isso garante rastreabilidade completa.`,
        },
        {
          id: "versionamento",
          title: "Versionamento de APIs",
          body: `O FuseOne suporta estratégias de versionamento para gerenciar evoluções das suas APIs sem quebrar integração com consumidores existentes:

### Versionamento por URI
A forma mais comum — inclua a versão no caminho da rota:
- \`/api/v1/produtos\` — Versão 1
- \`/api/v2/produtos\` — Versão 2

Cada versão é uma rota independente com sua própria configuração de upstream e políticas. Você pode manter múltiplas versões ativas simultaneamente.

### Versionamento por Header
Use um header customizado para selecionar a versão:
- \`X-API-Version: 1\` — Direciona para o upstream da v1
- \`X-API-Version: 2\` — Direciona para o upstream da v2

Isso pode ser implementado com políticas de roteamento condicional ou traffic-split.

### Versionamento por Query Parameter
Menos comum, mas suportado:
- \`/api/produtos?version=1\`

> **Dica:** O versionamento por URI é a abordagem mais recomendada por ser a mais simples de entender e implementar. Consumidores podem ver claramente qual versão estão usando, e você pode monitorar métricas de cada versão separadamente.`,
        },
        {
          id: "rastreamento",
          title: "Rastreamento de Mudanças",
          body: `Toda alteração feita em uma API é registrada automaticamente no sistema de **audit log** do FuseOne. Isso inclui:

- **Criação** de novas rotas, upstreams e services
- **Atualização** de configurações existentes (campos alterados, políticas adicionadas/removidas)
- **Exclusão** de recursos
- **Mudanças de estado** (draft para deployed, deployed para deprecated)

### Consultando o Histórico
Para ver o histórico de mudanças de uma API específica:

1. Acesse a página de detalhes da API
2. As atividades recentes são exibidas na interface
3. Cada entrada mostra: data/hora, usuário responsável e descrição da ação

### Diff de Configuração
Ao promover uma API entre ambientes (ex: desenvolvimento para produção), o sistema apresenta um **diff visual** mostrando exatamente o que será alterado. Isso permite revisar as mudanças antes de aplicá-las, reduzindo o risco de erros em produção.

> **Atenção:** O audit log é imutável — registros não podem ser editados ou excluídos. Isso garante conformidade com requisitos de auditoria e rastreabilidade.`,
        },
        {
          id: "promocao-ambientes",
          title: "Promoção entre Ambientes",
          body: `O FuseOne suporta a promoção de configurações entre ambientes (por exemplo, desenvolvimento, staging e produção), permitindo um fluxo de deploy seguro e controlado:

### Fluxo de Promoção
1. **Desenvolva** a API no ambiente de desenvolvimento
2. **Solicite** uma promoção para o próximo ambiente
3. **Revise** o diff de configuração gerado automaticamente
4. **Aprove** ou **rejeite** a solicitação de promoção
5. Se aprovada, a configuração é aplicada no ambiente de destino

### Benefícios
- **Segurança** — Nenhuma mudança chega à produção sem revisão
- **Rastreabilidade** — Cada promoção é registrada com aprovador e data
- **Consistência** — As mesmas configurações testadas em staging são aplicadas em produção
- **Rollback** — Em caso de problemas, você pode reverter para a configuração anterior

Acesse a seção **Promotions** na barra lateral para gerenciar solicitações de promoção pendentes e visualizar o histórico de promoções realizadas.

> **Dica:** Configure regras de aprovação para exigir que promoções para produção sejam aprovadas por pelo menos dois administradores. Isso adiciona uma camada extra de segurança ao processo de deploy.`,
        },
      ],
    },
  ],
}
