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
          body: `Uma **rota** e o recurso fundamental do API Gateway. Ela define as regras de correspondencia para requisicoes de entrada e determina como elas devem ser processadas e encaminhadas.

Cada rota e composta por:

- **URI** — O caminho da requisicao (ex: \`/api/v1/usuarios/*\`). Suporta correspondencia exata, prefixos e wildcards.
- **Metodos HTTP** — Quais metodos sao aceitos (GET, POST, PUT, DELETE, etc.)
- **Host** — Dominio ou subdominio para correspondencia (ex: \`api.meusite.com\`)
- **Headers** — Correspondencia opcional por headers da requisicao
- **Variaveis** — Condicoes avancadas usando variaveis do gateway (IP do cliente, argumentos, etc.)

### Prioridade de Correspondencia
Quando multiplas rotas podem corresponder a uma mesma requisicao, o gateway utiliza um sistema de prioridade. Voce pode definir a prioridade manualmente no campo **Priority** ou deixar que o sistema calcule automaticamente com base na especificidade da rota.

> **Dica:** Rotas mais especificas (ex: \`/api/v1/usuarios/123\`) devem ter prioridade maior que rotas genericas (ex: \`/api/v1/usuarios/*\`). Isso garante que a correspondencia mais precisa seja utilizada.`,
        },
        {
          id: "upstreams",
          title: "Upstreams e Balanceamento de Carga",
          body: `O **upstream** define o conjunto de servidores backend que recebem as requisicoes encaminhadas pelo gateway. Voce pode configurar um upstream diretamente na rota ou cria-lo separadamente para reuso entre multiplas rotas.

### Configurando Nos
Cada upstream contem uma lista de **nos** (nodes), onde cada no representa um servidor backend:

- **Host** — IP ou hostname do servidor (ex: \`10.0.0.1\` ou \`backend.internal\`)
- **Porta** — Porta do servico (ex: \`8080\`)
- **Peso** — Influencia na distribuicao de carga (ex: peso 2 recebe o dobro de trafego que peso 1)

### Algoritmos de Balanceamento
O gateway suporta quatro algoritmos de balanceamento de carga:

- **roundrobin** — Distribui requisicoes de forma circular entre os nos, respeitando os pesos configurados. E o algoritmo padrao e funciona bem para a maioria dos cenarios.
- **chash** (Consistent Hashing) — Direciona requisicoes com a mesma chave (header, cookie ou variavel) sempre para o mesmo no. Ideal para cenarios com cache local ou sessoes sticky.
- **ewma** (Exponentially Weighted Moving Average) — Seleciona automaticamente o no com menor latencia recente. Excelente para upstreams com nos heterogeneos.
- **least_conn** — Encaminha para o no com menos conexoes ativas no momento. Bom para requisicoes com tempo de processamento variavel.

> **Nota:** Para configurar consistent hashing, voce precisa definir o campo \`hash_on\` (ex: \`header\`, \`cookie\`, \`consumer\`) e o \`key\` correspondente (ex: nome do header).`,
          subsections: [
            {
              id: "health-checks",
              title: "Health Checks",
              body: `O gateway pode monitorar a saude dos nos do upstream com health checks ativos e passivos:

- **Health Check Ativo** — O gateway envia requisicoes periodicas (ex: \`GET /health\`) para cada no e marca como indisponivel aqueles que nao respondem corretamente.
- **Health Check Passivo** — O gateway analisa as respostas reais do trafego. Se um no retornar erros consecutivos (ex: 5 respostas 5xx seguidas), ele e temporariamente removido do balanceamento.

Configure health checks na secao **Checks** do upstream. Defina o intervalo entre verificacoes, o numero de sucessos para considerar saudavel e o numero de falhas para considerar indisponivel.

> **Dica:** Combine health checks ativos e passivos para obter a melhor deteccao de falhas. O passivo reage rapidamente a problemas, enquanto o ativo detecta recuperacao.`,
            },
          ],
        },
        {
          id: "services",
          title: "Services e Service Discovery",
          body: `Um **service** agrupa configuracoes de upstream e politicas que podem ser compartilhadas entre multiplas rotas. Em vez de repetir a mesma configuracao em cada rota, voce cria um service e o referencia.

### Quando Usar Services
- Quando multiplas rotas apontam para o mesmo backend
- Quando voce quer aplicar as mesmas politicas a um grupo de rotas
- Para simplificar a manutencao — altere o service e todas as rotas vinculadas serao atualizadas

### Service Discovery
Para ambientes dinamicos onde os enderecos dos backends mudam frequentemente (como Kubernetes ou Consul), o gateway suporta **service discovery**:

- **DNS** — Resolve o hostname do upstream via DNS e atualiza automaticamente os nos quando os registros mudam.
- **Consul** — Integra-se com HashiCorp Consul para descoberta automatica de servicos registrados.
- **Kubernetes** — Descobre pods diretamente a partir dos services do Kubernetes.

Com service discovery habilitado, voce nao precisa gerenciar manualmente a lista de nos. O gateway atualiza os enderecos automaticamente conforme os servicos escalam ou migram.

> **Atencao:** Ao usar service discovery, certifique-se de que o gateway tem conectividade de rede com o provedor de discovery (DNS, Consul, API do Kubernetes). Problemas de conectividade podem resultar em upstreams vazios.`,
        },
        {
          id: "configuracoes-avancadas",
          title: "Configuracoes Avancadas de Rota",
          body: `Alem das configuracoes basicas, cada rota oferece opcoes avancadas para cenarios especificos:

### Timeout e Retries
- **connect_timeout** — Tempo maximo para estabelecer conexao com o upstream (padrao: 60s)
- **send_timeout** — Tempo maximo para enviar a requisicao ao upstream
- **read_timeout** — Tempo maximo para receber a resposta do upstream
- **retries** — Numero de tentativas em caso de falha de conexao

### Filtragem por Variaveis
Voce pode adicionar condicoes avancadas usando variaveis do gateway. Por exemplo:

- Rotear apenas requisicoes de um IP especifico: \`remote_addr == 10.0.0.5\`
- Rotear por valor de header: \`http_x_tenant == empresa-a\`
- Rotear por argumento de query: \`arg_version == v2\`

### Habilitacao de WebSocket
Para rotas que precisam suportar conexoes WebSocket, habilite a opcao **enable_websocket** na configuracao da rota. O gateway fara o upgrade automatico da conexao HTTP para WebSocket.

> **Dica:** Defina timeouts adequados ao tempo de processamento do seu backend. APIs que realizam operacoes demoradas (relatorios, processamento de dados) podem precisar de timeouts maiores que o padrao.`,
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
          body: `O **Editor Visual de Fluxo** e a principal ferramenta de configuracao de APIs no FuseOne. Ele apresenta o pipeline de processamento de requisicoes como um diagrama visual, onde cada no representa uma etapa do processamento.

O fluxo segue a seguinte estrutura:

- **Requisicao de Entrada** — O ponto inicial, representando a requisicao do cliente
- **Politicas de Requisicao** — Processamento aplicado antes de encaminhar ao upstream (autenticacao, rate limiting, transformacao)
- **Upstream** — O servico backend de destino
- **Politicas de Resposta** — Processamento aplicado na resposta antes de devolver ao cliente (transformacao, headers, CORS)
- **Resposta ao Cliente** — O ponto final do fluxo

Cada politica e representada como um **card** no diagrama, mostrando o nome, categoria (por cor) e um indicador de status (configurada ou pendente).

> **Nota:** As politicas sao executadas na ordem em que aparecem no fluxo, de cima para baixo. A ordem pode impactar o comportamento — por exemplo, a autenticacao deve vir antes da restricao por consumidor.`,
        },
        {
          id: "adicionando-politicas",
          title: "Adicionando Politicas ao Fluxo",
          body: `Para adicionar uma politica ao pipeline da sua API:

1. No editor de fluxo, clique no botao **"+"** entre dois nos existentes ou no final do pipeline
2. A **Galeria de Politicas** sera aberta, mostrando todas as politicas disponiveis organizadas por categoria
3. Navegue pelas categorias ou use o campo de busca para encontrar a politica desejada
4. Clique na politica para adicionala ao fluxo

### Configurando uma Politica
Apos adicionar uma politica, o painel de configuracao sera aberto automaticamente:

- Preencha os campos obrigatorios (marcados com asterisco)
- Campos opcionais permitem ajuste fino do comportamento
- Use o botao **Documentacao** para ver a referencia completa da politica
- O painel mostra uma pre-visualizacao do JSON de configuracao gerado

### Removendo e Reordenando
- Para **remover** uma politica, clique no icone de lixeira no card
- Para **reordenar**, arraste o card para a posicao desejada no pipeline
- Para **desabilitar** temporariamente sem remover, use o toggle no card

> **Dica:** Voce pode duplicar uma politica configurada clicando no menu de opcoes (tres pontos) do card e selecionando "Duplicar". Isso e util quando voce precisa de configuracoes semelhantes em diferentes pontos do fluxo.`,
        },
        {
          id: "pipeline-requisicao",
          title: "Pipeline de Processamento",
          body: `Entender a ordem de execucao do pipeline e essencial para configurar APIs corretamente. O gateway processa cada requisicao nas seguintes fases:

### Fase de Requisicao (Request)
Politicas executadas **antes** de encaminhar a requisicao ao upstream:

1. **Autenticacao** — Verifica a identidade do chamador (key-auth, jwt-auth, etc.)
2. **Seguranca** — Aplica restricoes de acesso (ip-restriction, consumer-restriction)
3. **Controle de trafego** — Verifica limites de taxa e quotas (limit-req, limit-count)
4. **Transformacao** — Modifica a requisicao antes do encaminhamento (proxy-rewrite, body-transformer)

### Fase de Resposta (Response)
Politicas executadas **apos** receber a resposta do upstream:

1. **Transformacao** — Modifica a resposta (response-rewrite, body-transformer)
2. **Observabilidade** — Registra logs e metricas (http-logger, kafka-logger)

### Fase de Log
Executada de forma assincrona apos a resposta ser enviada ao cliente. Nao impacta a latencia percebida.

> **Atencao:** Algumas politicas tem fase fixa (ex: autenticacao sempre roda na fase de requisicao). Outras podem ser configuradas para rodar em fases diferentes. Consulte a documentacao de cada politica para detalhes.`,
        },
        {
          id: "modo-json",
          title: "Modo JSON Avancado",
          body: `Para usuarios avancados, o editor oferece um **modo JSON** que permite editar a configuracao da rota diretamente em formato JSON:

1. No editor de fluxo, clique no botao **JSON** no canto superior direito
2. O editor de codigo sera aberto com a configuracao completa da rota
3. Edite o JSON conforme necessario
4. Clique em **Aplicar** para salvar as alteracoes

### Quando Usar o Modo JSON
- Quando voce precisa configurar opcoes avancadas nao disponiveis na interface visual
- Para copiar e colar configuracoes entre rotas ou ambientes
- Para configurar politicas com parametros complexos ou aninhados
- Para debug — o JSON mostra exatamente o que sera enviado ao gateway

### Validacao
O editor JSON inclui:
- **Syntax highlighting** — Destaque de sintaxe para facilitar a leitura
- **Validacao em tempo real** — Erros de sintaxe JSON sao destacados imediatamente
- **Auto-complete** — Sugestoes de campos e valores baseados no schema da API

> **Dica:** Voce pode alternar livremente entre o modo visual e o modo JSON. As alteracoes feitas em um modo sao refletidas automaticamente no outro. Isso permite usar o modo visual para tarefas comuns e o JSON para ajustes finos.`,
        },
      ],
    },
    {
      slug: "ciclo-vida",
      title: "Ciclo de Vida de APIs",
      description:
        "Entenda os estados, versionamento e rastreamento de mudancas no ciclo de vida das suas APIs.",
      icon: "RefreshCw",
      tags: ["lifecycle", "versionamento", "deploy"],
      content: [
        {
          id: "estados",
          title: "Estados de uma API",
          body: `No FuseOne, cada API passa por um ciclo de vida bem definido com os seguintes estados:

### Rascunho (Draft)
Estado inicial de uma API recem-criada. Neste estado:
- A configuracao pode ser editada livremente
- A rota **nao esta ativa** no gateway — nenhum trafego e processado
- Ideal para preparar e revisar a configuracao antes da publicacao
- Voce pode salvar e voltar a editar quantas vezes quiser

### Publicada (Deployed)
A API esta ativa e processando trafego no gateway:
- Requisicoes que correspondem a rota sao processadas normalmente
- Alteracoes na configuracao sao aplicadas imediatamente ao salvar
- Metricas e logs sao coletados ativamente
- Este e o estado normal de operacao

### Depreciada (Deprecated)
A API esta marcada para descontinuacao:
- Ainda processa trafego normalmente para manter compatibilidade
- Um aviso visual indica que a API esta depreciada
- Consumidores devem ser notificados para migrar para a nova versao
- Apos o periodo de transicao, a API pode ser desativada

> **Nota:** A transicao entre estados e registrada no audit log com o usuario responsavel e a data/hora da mudanca. Isso garante rastreabilidade completa.`,
        },
        {
          id: "versionamento",
          title: "Versionamento de APIs",
          body: `O FuseOne suporta estrategias de versionamento para gerenciar evolucoes das suas APIs sem quebrar integracao com consumidores existentes:

### Versionamento por URI
A forma mais comum — inclua a versao no caminho da rota:
- \`/api/v1/produtos\` — Versao 1
- \`/api/v2/produtos\` — Versao 2

Cada versao e uma rota independente com sua propria configuracao de upstream e politicas. Voce pode manter multiplas versoes ativas simultaneamente.

### Versionamento por Header
Use um header customizado para selecionar a versao:
- \`X-API-Version: 1\` — Direciona para o upstream da v1
- \`X-API-Version: 2\` — Direciona para o upstream da v2

Isso pode ser implementado com politicas de roteamento condicional ou traffic-split.

### Versionamento por Query Parameter
Menos comum, mas suportado:
- \`/api/produtos?version=1\`

> **Dica:** O versionamento por URI e a abordagem mais recomendada por ser a mais simples de entender e implementar. Consumidores podem ver claramente qual versao estao usando, e voce pode monitorar metricas de cada versao separadamente.`,
        },
        {
          id: "rastreamento",
          title: "Rastreamento de Mudancas",
          body: `Toda alteracao feita em uma API e registrada automaticamente no sistema de **audit log** do FuseOne. Isso inclui:

- **Criacao** de novas rotas, upstreams e services
- **Atualizacao** de configuracoes existentes (campos alterados, politicas adicionadas/removidas)
- **Exclusao** de recursos
- **Mudancas de estado** (draft para deployed, deployed para deprecated)

### Consultando o Historico
Para ver o historico de mudancas de uma API especifica:

1. Acesse a pagina de detalhes da API
2. As atividades recentes sao exibidas na interface
3. Cada entrada mostra: data/hora, usuario responsavel e descricao da acao

### Diff de Configuracao
Ao promover uma API entre ambientes (ex: desenvolvimento para producao), o sistema apresenta um **diff visual** mostrando exatamente o que sera alterado. Isso permite revisar as mudancas antes de aplica-las, reduzindo o risco de erros em producao.

> **Atencao:** O audit log e imutavel — registros nao podem ser editados ou excluidos. Isso garante conformidade com requisitos de auditoria e rastreabilidade.`,
        },
        {
          id: "promocao-ambientes",
          title: "Promocao entre Ambientes",
          body: `O FuseOne suporta a promocao de configuracoes entre ambientes (por exemplo, desenvolvimento, staging e producao), permitindo um fluxo de deploy seguro e controlado:

### Fluxo de Promocao
1. **Desenvolva** a API no ambiente de desenvolvimento
2. **Solicite** uma promocao para o proximo ambiente
3. **Revise** o diff de configuracao gerado automaticamente
4. **Aprove** ou **rejeite** a solicitacao de promocao
5. Se aprovada, a configuracao e aplicada no ambiente de destino

### Beneficios
- **Seguranca** — Nenhuma mudanca chega a producao sem revisao
- **Rastreabilidade** — Cada promocao e registrada com aprovador e data
- **Consistencia** — As mesmas configuracoes testadas em staging sao aplicadas em producao
- **Rollback** — Em caso de problemas, voce pode reverter para a configuracao anterior

Acesse a secao **Promotions** na barra lateral para gerenciar solicitacoes de promocao pendentes e visualizar o historico de promocoes realizadas.

> **Dica:** Configure regras de aprovacao para exigir que promocoes para producao sejam aprovadas por pelo menos dois administradores. Isso adiciona uma camada extra de seguranca ao processo de deploy.`,
        },
      ],
    },
  ],
}
