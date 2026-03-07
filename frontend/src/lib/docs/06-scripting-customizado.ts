import type { DocCategory } from "./types"

export const scriptingCategory: DocCategory = {
  slug: "scripting-customizado",
  title: "Scripting Customizado",
  description:
    "Estenda o API Gateway com scripts Lua customizados para lógica de negócio, transformações e integrações avançadas.",
  icon: "Code",
  articles: [
    // ── 1. Introdução ao Scripting Lua ──────────────────────────
    {
      slug: "introducao-lua",
      title: "Scripting Lua no Gateway",
      description:
        "Entenda como o scripting Lua permite estender o API Gateway com lógica customizada no ciclo de vida da requisição.",
      icon: "Terminal",
      tags: ["lua", "serverless", "scripting"],
      content: [
        {
          id: "o-que-lua-permite",
          title: "O que o Scripting Lua Permite",
          body: `O API Gateway executa sobre o OpenResty, uma plataforma que combina Nginx com LuaJIT. Isso significa que você pode escrever scripts Lua que são executados diretamente no pipeline de processamento de requisições, com performance próxima à de código nativo.

Com scripting Lua você pode:

- **Transformar requisições e respostas** de formas que plugins declarativos não suportam
- **Implementar lógica de negócio** customizada no gateway (validações, roteamento inteligente)
- **Integrar com serviços externos** durante o processamento da requisição
- **Manipular headers, body e parâmetros** com total flexibilidade
- **Implementar autenticação customizada** com lógica específica da sua organização
- **Gerar respostas sintéticas** sem precisar consultar o upstream

> **Nota:** Scripts Lua são poderosos mas devem ser usados com cuidado. Sempre que um plugin declarativo resolver o problema, prefira o plugin. Scripts são para casos que os plugins padrão não cobrem.`,
        },
        {
          id: "plugins-serverless",
          title: "Plugins Serverless (Pre e Post Function)",
          body: `O API Gateway oferece dois plugins para executar scripts Lua customizados em diferentes fases do processamento:

### serverless-pre-function

Executa o script **antes** de enviar a requisição ao upstream. É a fase ideal para:

- Validar e transformar a requisição
- Injetar headers baseados em lógica customizada
- Bloquear requisições com base em regras de negócio
- Fazer chamadas a serviços auxiliares para enriquecimento

**Configuração:**

\`\`\`json
{
  "phase": "rewrite",
  "functions": [
    "return function(conf, ctx) ... end"
  ]
}
\`\`\`

### serverless-post-function

Executa o script **depois** de receber a resposta do upstream. É indicado para:

- Transformar o corpo da resposta
- Adicionar headers de resposta baseados em lógica customizada
- Registrar métricas e logs customizados
- Modificar o status code com base em condições

**Configuração:**

\`\`\`json
{
  "phase": "header_filter",
  "functions": [
    "return function(conf, ctx) ... end"
  ]
}
\`\`\`

> **Dica:** O campo \`phase\` define em qual fase do Nginx o script executa. As fases mais comuns são: \`rewrite\` (antes do upstream), \`header_filter\` (ao receber headers da resposta) e \`body_filter\` (ao receber o body da resposta).`,
        },
        {
          id: "ciclo-vida-requisicao",
          title: "Ciclo de Vida da Requisição",
          body: `Entender o ciclo de vida da requisição no API Gateway é fundamental para escrever scripts eficientes. O processamento segue estas fases:

**1. Rewrite (reescrita)**
- Primeira fase após o recebimento da requisição
- Ideal para modificar URI, headers e parâmetros
- \`serverless-pre-function\` com \`phase: "rewrite"\` executa aqui

**2. Access (acesso)**
- Fase de autenticação e autorização
- Plugins de autenticação (key-auth, jwt-auth) executam aqui
- Use \`phase: "access"\` para validações que dependem do consumer

**3. Before Proxy (antes do proxy)**
- Última chance de modificar a requisição antes de enviar ao upstream
- Útil para transformações finais baseadas em dados de autenticação

**4. Header Filter (filtro de headers)**
- Executada quando os headers da resposta do upstream são recebidos
- Ideal para modificar headers de resposta
- \`serverless-post-function\` com \`phase: "header_filter"\` executa aqui

**5. Body Filter (filtro do body)**
- Executada quando o corpo da resposta é recebido
- Permite transformar o corpo antes de enviar ao cliente
- Cuidado: o corpo pode chegar em chunks

**6. Log (registro)**
- Fase final, após a resposta ser enviada ao cliente
- Ideal para logging e métricas customizadas
- Não afeta a resposta (já foi enviada)

> **Atenção:** Nunca execute operações bloqueantes (I/O síncrono, sleep) nas fases de processamento. Isso trava o worker do Nginx e impacta todas as requisições.`,
        },
        {
          id: "apis-disponiveis",
          title: "APIs Disponíveis nos Scripts",
          body: `Scripts Lua no API Gateway têm acesso a diversas APIs para interagir com a requisição, resposta e serviços externos.

### API do Nginx (ngx)

\`\`\`lua
-- Ler e definir headers da requisicao
local auth = ngx.req.get_headers()["Authorization"]
ngx.req.set_header("X-Custom", "valor")

-- Ler o corpo da requisicao
ngx.req.read_body()
local body = ngx.req.get_body_data()

-- Ler parametros de query string
local args = ngx.req.get_uri_args()
local page = args["page"]

-- Definir headers de resposta
ngx.header["X-Response-Custom"] = "valor"

-- Retornar resposta diretamente (sem ir ao upstream)
ngx.status = 200
ngx.say('{"message": "resposta do script"}')
ngx.exit(200)

-- Variaveis do Nginx
local ip = ngx.var.remote_addr
local uri = ngx.var.uri
local method = ngx.var.request_method
\`\`\`

### API do Core (core)

\`\`\`lua
local core = require("apisix.core")

-- Logging estruturado
core.log.info("Requisicao processada: ", ngx.var.uri)
core.log.warn("Latencia alta: ", latency, "ms")
core.log.error("Falha na validacao: ", err)

-- Manipulacao de JSON
local data = core.json.decode(body)
local json_str = core.json.encode({ key = "value" })

-- Gerar IDs unicos
local id = core.id.get()
\`\`\`

### HTTP Client (resty.http)

\`\`\`lua
local http = require("resty.http")
local httpc = http.new()
httpc:set_timeout(1000) -- 1 segundo

local res, err = httpc:request_uri("http://servico:8080/api", {
  method = "GET",
  headers = { ["Content-Type"] = "application/json" }
})

if res and res.status == 200 then
  local data = core.json.decode(res.body)
end
\`\`\`

> **Dica:** Sempre trate erros (\`if not res then\`) ao usar a API HTTP. Falhas de rede são comuns e devem ser tratadas graciosamente.`,
        },
      ],
    },
    // ── 2. Biblioteca de Scripts ────────────────────────────────
    {
      slug: "biblioteca-scripts",
      title: "Biblioteca de Scripts",
      description:
        "Scripts pré-construídos disponíveis no FuseOne para injeção de headers, transformação de body, roteamento e mais.",
      icon: "Library",
      tags: ["scripts", "biblioteca", "templates"],
      content: [
        {
          id: "sobre-biblioteca",
          title: "Sobre a Biblioteca de Scripts",
          body: `O FuseOne API Gateway inclui uma **biblioteca de scripts** pré-construídos que cobrem os casos de uso mais comuns. Esses scripts foram testados, otimizados e podem ser aplicados diretamente nas suas rotas sem precisar escrever código do zero.

A biblioteca está disponível no editor visual de políticas. Ao adicionar um plugin \`serverless-pre-function\` ou \`serverless-post-function\`, você pode escolher um script da biblioteca e customizar os parâmetros.

**Categorias disponíveis:**
- Injeção e manipulação de headers
- Transformação de body (requisição e resposta)
- Roteamento condicional
- Logging customizado
- Validação de tokens e dados

Cada script da biblioteca inclui:
- Descrição do que faz
- Parâmetros configuráveis
- Exemplo de uso
- Notas sobre performance

> **Dica:** Use os scripts da biblioteca como ponto de partida. Você pode copiá-los e customizá-los conforme a necessidade do seu cenário.`,
        },
        {
          id: "scripts-headers",
          title: "Scripts de Injeção de Headers",
          body: `Scripts para adicionar, modificar ou remover headers em requisições e respostas.

### Injetar Header Baseado em Horário

Adiciona um header indicando o período do dia (útil para roteamento por horário comercial):

\`\`\`lua
return function(conf, ctx)
  local hour = tonumber(os.date("%H"))
  if hour >= 8 and hour < 18 then
    ngx.req.set_header("X-Business-Hours", "true")
  else
    ngx.req.set_header("X-Business-Hours", "false")
  end
end
\`\`\`

### Propagar Headers do Consumer

Injeta headers com informações do consumidor autenticado para o upstream:

\`\`\`lua
return function(conf, ctx)
  local consumer = ctx.consumer
  if consumer then
    ngx.req.set_header("X-Consumer-Name", consumer.username or "unknown")
    ngx.req.set_header("X-Consumer-Group", consumer.group_id or "default")
  end
end
\`\`\`

### Sanitizar Headers de Resposta

Remove headers internos que não devem ser expostos ao cliente:

\`\`\`lua
return function(conf, ctx)
  local headers_to_remove = {
    "X-Internal-Id",
    "X-Debug-Info",
    "X-Backend-Server",
    "Server",
    "X-Powered-By"
  }
  for _, header in ipairs(headers_to_remove) do
    ngx.header[header] = nil
  end
end
\`\`\`

> **Nota:** O script de sanitização de headers deve ser usado como \`serverless-post-function\` na fase \`header_filter\`.`,
        },
        {
          id: "scripts-transformacao",
          title: "Scripts de Transformação de Body",
          body: `Scripts para modificar o corpo da requisição ou resposta em trânsito.

### Adicionar Envelope na Resposta

Encapsula a resposta do upstream em um envelope padrão com metadados:

\`\`\`lua
return function(conf, ctx)
  local core = require("apisix.core")
  ngx.req.read_body()
  -- Nota: este script deve ser adaptado para body_filter
  -- para transformar a resposta do upstream
  local original = ngx.arg[1]
  if original and #original > 0 then
    local data = core.json.decode(original)
    local envelope = {
      success = true,
      timestamp = ngx.now(),
      request_id = ngx.var.request_id,
      data = data
    }
    ngx.arg[1] = core.json.encode(envelope)
  end
end
\`\`\`

### Remover Campos Sensíveis da Resposta

Filtra campos que não devem ser retornados ao cliente (ex: dados internos, IDs de banco):

\`\`\`lua
return function(conf, ctx)
  local core = require("apisix.core")
  local original = ngx.arg[1]
  if original and #original > 0 then
    local data = core.json.decode(original)
    if type(data) == "table" then
      data["internal_id"] = nil
      data["database_ref"] = nil
      data["_metadata"] = nil
      ngx.arg[1] = core.json.encode(data)
    end
  end
end
\`\`\`

> **Atenção:** Scripts de transformação de body na fase \`body_filter\` podem receber o corpo em chunks. Certifique-se de tratar o caso onde \`ngx.arg[1]\` contém apenas um fragmento do JSON completo.`,
        },
        {
          id: "scripts-roteamento",
          title: "Scripts de Roteamento Condicional",
          body: `Scripts que modificam o destino da requisição com base em condições dinâmicas.

### Roteamento por Tenant (Multi-tenancy)

Direciona a requisição para o upstream correto com base no tenant identificado no header ou subdomínio:

\`\`\`lua
return function(conf, ctx)
  local core = require("apisix.core")
  local tenant = ngx.req.get_headers()["X-Tenant-Id"]

  if not tenant then
    -- Tenta extrair do subdominio
    local host = ngx.var.host
    tenant = host:match("^(%w+)%.")
  end

  if not tenant then
    ngx.status = 400
    ngx.say(core.json.encode({
      error = "Tenant nao identificado. Envie o header X-Tenant-Id."
    }))
    return ngx.exit(400)
  end

  -- Define o upstream baseado no tenant
  local upstreams = {
    ["acme"] = "http://acme-backend:8080",
    ["globex"] = "http://globex-backend:8080"
  }

  local upstream_url = upstreams[tenant]
  if upstream_url then
    ctx.var.upstream_uri = upstream_url .. ngx.var.uri
  end

  ngx.req.set_header("X-Resolved-Tenant", tenant)
end
\`\`\`

### Roteamento por Feature Flag

Consulta um serviço de feature flags para decidir o roteamento:

\`\`\`lua
return function(conf, ctx)
  local http = require("resty.http")
  local core = require("apisix.core")
  local httpc = http.new()
  httpc:set_timeout(500)

  local res, err = httpc:request_uri(
    "http://feature-flags:8080/api/flags/new-checkout",
    { method = "GET" }
  )

  if res and res.status == 200 then
    local flag = core.json.decode(res.body)
    if flag.enabled then
      ngx.req.set_header("X-Route-Version", "v2")
    else
      ngx.req.set_header("X-Route-Version", "v1")
    end
  else
    -- Fallback: versao estavel
    ngx.req.set_header("X-Route-Version", "v1")
    core.log.warn("Feature flag service unavailable, using fallback")
  end
end
\`\`\`

> **Dica:** Sempre implemente um fallback quando o roteamento depende de serviços externos. Se o serviço de feature flags estiver fora do ar, a rota deve continuar funcionando com o comportamento padrão.`,
        },
        {
          id: "scripts-logging-validacao",
          title: "Scripts de Logging e Validação",
          body: `Scripts para registro customizado e validação de dados.

### Logging Customizado com Contexto de Negócio

Registra informações de negócio nos logs do gateway para facilitar o debugging:

\`\`\`lua
return function(conf, ctx)
  local core = require("apisix.core")

  local log_data = {
    timestamp = ngx.now(),
    method = ngx.var.request_method,
    uri = ngx.var.uri,
    status = ngx.status,
    latency = ngx.var.request_time,
    consumer = ctx.consumer and ctx.consumer.username or "anonymous",
    ip = ngx.var.remote_addr,
    request_id = ngx.var.request_id,
    upstream_status = ngx.var.upstream_status
  }

  core.log.info("api-access: ", core.json.encode(log_data))
end
\`\`\`

### Validação de Payload JSON

Valida campos obrigatórios no corpo da requisição antes de enviar ao upstream:

\`\`\`lua
return function(conf, ctx)
  local core = require("apisix.core")

  if ngx.var.request_method == "POST" or ngx.var.request_method == "PUT" then
    ngx.req.read_body()
    local body = ngx.req.get_body_data()

    if not body then
      ngx.status = 400
      ngx.say(core.json.encode({
        error = "Corpo da requisicao e obrigatorio."
      }))
      return ngx.exit(400)
    end

    local data, err = core.json.decode(body)
    if not data then
      ngx.status = 400
      ngx.say(core.json.encode({
        error = "JSON invalido no corpo da requisicao.",
        details = err
      }))
      return ngx.exit(400)
    end

    -- Validar campos obrigatorios
    local required = { "name", "email" }
    for _, field in ipairs(required) do
      if not data[field] or data[field] == "" then
        ngx.status = 422
        ngx.say(core.json.encode({
          error = "Campo obrigatorio ausente: " .. field
        }))
        return ngx.exit(422)
      end
    end
  end
end
\`\`\`

### Validação de Token Customizado

Valida um token proprietário consultando um serviço de autenticação:

\`\`\`lua
return function(conf, ctx)
  local http = require("resty.http")
  local core = require("apisix.core")
  local token = ngx.req.get_headers()["X-Custom-Token"]

  if not token then
    ngx.status = 401
    ngx.say(core.json.encode({ error = "Token ausente." }))
    return ngx.exit(401)
  end

  local httpc = http.new()
  httpc:set_timeout(1000)
  local res, err = httpc:request_uri(
    "http://auth-service:8080/api/validate",
    {
      method = "POST",
      body = core.json.encode({ token = token }),
      headers = { ["Content-Type"] = "application/json" }
    }
  )

  if not res or res.status ~= 200 then
    ngx.status = 401
    ngx.say(core.json.encode({ error = "Token invalido ou expirado." }))
    return ngx.exit(401)
  end

  local user = core.json.decode(res.body)
  ngx.req.set_header("X-User-Id", user.id)
  ngx.req.set_header("X-User-Role", user.role)
end
\`\`\`

> **Nota:** O script de logging deve ser usado na fase \`log\` (\`serverless-post-function\` com \`phase: "log"\`). Os scripts de validação devem usar a fase \`rewrite\` ou \`access\`.`,
        },
      ],
    },
    // ── 3. Boas Práticas e Limitações ───────────────────────────
    {
      slug: "boas-praticas-lua",
      title: "Boas Práticas e Limitações",
      description:
        "Performance, segurança, debugging e limitações do scripting Lua no API Gateway.",
      icon: "AlertTriangle",
      tags: ["boas-práticas", "performance", "segurança"],
      content: [
        {
          id: "performance",
          title: "Performance e Otimização",
          body: `Scripts Lua no API Gateway são executados pelo LuaJIT, que compila o código para instruções nativas. Ainda assim, scripts mal escritos podem degradar significativamente a performance do gateway.

### Regras de Ouro

- **Evite alocações desnecessárias**: Reutilize tabelas e strings sempre que possível
- **Minimize chamadas externas**: Cada chamada HTTP adiciona latência
- **Use cache em memória**: O módulo \`lua-resty-lrucache\` permite cache local no worker
- **Prefira operações não-bloqueantes**: Use \`ngx.timer.at\` para tarefas em background

### O que FAZER

\`\`\`lua
-- BOM: usar variaveis locais (mais rapido que globais)
local core = require("apisix.core")
local ngx = ngx

-- BOM: cache de resultados frequentes
local lrucache = require("resty.lrucache")
local cache = lrucache.new(1000)

-- BOM: reutilizar tabelas
local reusable_table = {}
\`\`\`

### O que NÃO FAZER

\`\`\`lua
-- RUIM: operacao bloqueante
os.execute("sleep 1")

-- RUIM: leitura de arquivo sincrona em cada requisicao
local f = io.open("/path/to/file")

-- RUIM: loop infinito ou muito longo
while true do ... end

-- RUIM: criar tabelas grandes em cada requisicao
local big_table = {}
for i = 1, 100000 do big_table[i] = i end
\`\`\`

> **Atenção:** Um script que bloqueia um worker do Nginx afeta **todas** as requisições processadas por aquele worker, não apenas a requisição atual.

### Métricas de Performance
- Scripts simples (header injection): < 0.1ms de latência adicional
- Scripts com chamada HTTP externa: 1-50ms dependendo do serviço
- Scripts com transformação de body: 0.5-5ms dependendo do tamanho`,
        },
        {
          id: "limites-memoria",
          title: "Limites de Memória e Recursos",
          body: `O API Gateway impõe limites para evitar que scripts consumam recursos excessivos e afetem a estabilidade do sistema.

### Limites Padrão

- **Tamanho máximo do script**: 64KB de código Lua por plugin
- **Memória por requisição**: O Nginx limita a memória alocada por requisição
- **Tempo de execução**: Scripts não devem exceder 60 segundos (timeout do worker)
- **Conexões HTTP externas**: Limitadas pelo pool de conexões do worker

### Gerenciamento de Memória

\`\`\`lua
-- Use o pool de conexoes para reutilizar conexoes HTTP
local httpc = http.new()
httpc:set_timeout(1000)
httpc:set_keepalive(60000, 100) -- 60s keepalive, pool de 100

-- Evite acumular dados em variaveis do modulo
-- Variaveis de modulo persistem entre requisicoes no mesmo worker
-- Isso pode causar memory leaks
\`\`\`

### Sinais de Problemas
- Aumento gradual no consumo de memória dos workers
- Latência crescente sem aumento de tráfego
- Erros "lua_alloc" ou "out of memory" nos logs

> **Dica:** Monitore o consumo de memória dos workers do Nginx após habilitar scripts customizados. Use \`ngx.worker.pid()\` para identificar o worker nos logs e correlacionar com métricas do sistema.

**Boas práticas:**
- Teste scripts com carga realista antes de aplicar em produção
- Monitore métricas de memória após deployar novos scripts
- Use \`collectgarbage("count")\` durante o desenvolvimento para medir o consumo
- Prefira scripts curtos e focados em uma única responsabilidade`,
        },
        {
          id: "operacoes-evitar",
          title: "Operações Bloqueantes a Evitar",
          body: `O modelo de concorrência do OpenResty é baseado em **coroutines cooperativas**. Isso significa que um script que bloqueia impede que o worker processe outras requisições. Conhecer as operações proibidas é essencial.

### Operações PROIBIDAS

- **\`os.execute()\`**: Executa comandos do sistema de forma bloqueante
- **\`io.open()\` / \`io.read()\`**: I/O de arquivo síncrono
- **\`socket\` (LuaSocket padrão)**: Use \`ngx.socket.tcp\` ou \`resty.http\` em vez disso
- **\`os.clock()\` em loops**: Pode causar busy-wait
- **\`require\` condicional em cada requisição**: Carregue módulos no escopo do módulo, não dentro da função

### Alternativas Não-Bloqueantes

\`\`\`lua
-- Em vez de io.open, use ngx.shared.DICT para dados compartilhados
local shared = ngx.shared.my_cache
shared:set("key", "value", 3600) -- TTL de 1 hora
local value = shared:get("key")

-- Em vez de socket bloqueante, use cosocket
local sock = ngx.socket.tcp()
sock:settimeout(1000)
sock:connect("host", 6379)

-- Em vez de sleep bloqueante, use ngx.sleep (cooperativo)
ngx.sleep(0.1) -- cede controle para o event loop

-- Para tarefas em background, use timer
ngx.timer.at(0, function(premature)
  if premature then return end
  -- codigo assincrono aqui
end)
\`\`\`

> **Nota:** \`ngx.sleep()\` é cooperativo e não bloqueia o worker, diferente de \`os.execute("sleep")\`. Ainda assim, use com moderação pois a requisição ficará pendente durante o sleep.

### Checklist Pré-Deploy
- O script usa apenas APIs não-bloqueantes (ngx.*, resty.*)?
- Todos os timeouts estão configurados em chamadas externas?
- O script trata erros de rede e timeouts graciosamente?
- Não há loops infinitos ou condicionais que possam nunca terminar?`,
        },
        {
          id: "debugging",
          title: "Debugging e Troubleshooting",
          body: `Depurar scripts Lua no gateway requer técnicas específicas, já que não é possível usar debuggers tradicionais em ambiente de produção.

### Logging como Principal Ferramenta

\`\`\`lua
local core = require("apisix.core")

-- Niveis de log disponiveis
core.log.debug("Detalhe fino: ", variable)  -- Desabilitado por padrao em prod
core.log.info("Informacao: ", "requisicao processada")
core.log.warn("Aviso: ", "fallback ativado para ", service)
core.log.error("Erro: ", err)

-- Dica: serialize tabelas para visualizar no log
core.log.info("dados: ", core.json.encode(data))
\`\`\`

### Onde Ver os Logs

Os logs de script aparecem no log de erro do API Gateway. No FuseOne, você pode visualizá-los na aba de **Logs de Debug** do painel de monitoramento.

### Estratégias de Debugging

**1. Desenvolvimento local:**
- Use o ambiente de desenvolvimento com \`make infra\` e \`make backend\`
- Habilite o nível de log \`debug\` na configuração do gateway
- Teste o script com \`curl\` e verifique os logs

**2. Tratamento de erros explícito:**

\`\`\`lua
local ok, err = pcall(function()
  -- codigo que pode falhar
  local data = core.json.decode(body)
end)

if not ok then
  core.log.error("Erro no script: ", err)
  ngx.status = 500
  ngx.say(core.json.encode({ error = "Erro interno no processamento." }))
  return ngx.exit(500)
end
\`\`\`

**3. Headers de debug (apenas em development):**

\`\`\`lua
if ngx.req.get_headers()["X-Debug"] == "true" then
  ngx.header["X-Script-Duration"] = tostring(ngx.now() - start_time)
  ngx.header["X-Script-Result"] = result
end
\`\`\`

> **Dica:** Use o header \`X-Debug\` durante o desenvolvimento para expor informações de debugging sem afetar requisições normais. Remova ou desabilite antes de ir para produção.

**Erros comuns e soluções:**
- \`attempt to index a nil value\`: Variável não inicializada — verifique se o dado existe
- \`bad argument to decode\`: JSON inválido — valide o input antes de decodificar
- \`no resolver defined\`: DNS não configurado — use IPs ou configure o resolver no Nginx`,
        },
        {
          id: "seguranca-scripts",
          title: "Segurança dos Scripts",
          body: `Scripts Lua executam com os mesmos privilégios do processo do API Gateway. Isso significa que scripts mal-intencionados ou mal escritos podem comprometer a segurança de todo o sistema.

### Riscos de Segurança

- **Vazamento de dados**: Scripts podem acessar headers e bodies de todas as requisições
- **Acesso ao filesystem**: Funções como \`io.open\` podem ler arquivos do servidor
- **Exfiltração de dados**: Scripts podem enviar dados para endpoints externos
- **Denial of Service**: Scripts mal escritos podem consumir todos os recursos

### Controles Recomendados

**1. Controle de acesso:**
- Restrinja quem pode criar e editar scripts (permissão \`plugins:write\` no FuseOne)
- Implemente um processo de revisão (code review) para novos scripts
- Mantenha um registro de auditoria de alterações em scripts

**2. Validação de scripts:**

\`\`\`lua
-- NUNCA confie em dados de entrada sem validacao
local input = ngx.req.get_headers()["X-Data"]
if not input or #input > 1000 then
  -- rejeitar inputs muito grandes
  return ngx.exit(400)
end

-- NUNCA use funcoes de execucao de sistema
-- os.execute("rm -rf /")  -- EXTREMAMENTE PERIGOSO

-- NUNCA logue dados sensiveis
-- core.log.info("Token: ", auth_token)  -- NAO FACA ISSO
\`\`\`

**3. Princípio do menor privilégio:**
- Scripts devem acessar apenas os dados necessários para sua função
- Não propague credenciais internas para respostas ao cliente
- Limite os endpoints que scripts podem chamar (use service mesh/iptables)

**4. Proteção contra injection:**
- Valide e sanitize todos os inputs usados em chamadas externas
- Nunca concatene inputs do usuário em URLs ou queries sem validação
- Use parâmetros tipados em vez de concatenação de strings

> **Atenção:** Trate todo script Lua como código de produção. Aplique as mesmas práticas de segurança que você usaria em qualquer outro componente do sistema: validação de entrada, tratamento de erros, princípio do menor privilégio e auditoria.

### Checklist de Segurança
- O script valida todos os inputs do usuário?
- O script evita logar dados sensíveis (tokens, senhas, PII)?
- O script limita o acesso a apenas os recursos necessários?
- O script foi revisado por outro desenvolvedor?
- As permissões de quem pode editar scripts estão restritas?`,
        },
      ],
    },
  ],
}
