import type { DocCategory } from "./types"

export const scriptingCategory: DocCategory = {
  slug: "scripting-customizado",
  title: "Scripting Customizado",
  description:
    "Estenda o API Gateway com scripts Lua customizados para logica de negocio, transformacoes e integracoes avancadas.",
  icon: "Code",
  articles: [
    // ── 1. Introducao ao Scripting Lua ──────────────────────────
    {
      slug: "introducao-lua",
      title: "Scripting Lua no Gateway",
      description:
        "Entenda como o scripting Lua permite estender o API Gateway com logica customizada no ciclo de vida da requisicao.",
      icon: "Terminal",
      tags: ["lua", "serverless", "scripting"],
      content: [
        {
          id: "o-que-lua-permite",
          title: "O que o Scripting Lua Permite",
          body: `O API Gateway executa sobre o OpenResty, uma plataforma que combina Nginx com LuaJIT. Isso significa que voce pode escrever scripts Lua que sao executados diretamente no pipeline de processamento de requisicoes, com performance proxima a de codigo nativo.

Com scripting Lua voce pode:

- **Transformar requisicoes e respostas** de formas que plugins declarativos nao suportam
- **Implementar logica de negocio** customizada no gateway (validacoes, roteamento inteligente)
- **Integrar com servicos externos** durante o processamento da requisicao
- **Manipular headers, body e parametros** com total flexibilidade
- **Implementar autenticacao customizada** com logica especifica da sua organizacao
- **Gerar respostas sinteticas** sem precisar consultar o upstream

> **Nota:** Scripts Lua sao poderosos mas devem ser usados com cuidado. Sempre que um plugin declarativo resolver o problema, prefira o plugin. Scripts sao para casos que os plugins padrao nao cobrem.`,
        },
        {
          id: "plugins-serverless",
          title: "Plugins Serverless (Pre e Post Function)",
          body: `O API Gateway oferece dois plugins para executar scripts Lua customizados em diferentes fases do processamento:

### serverless-pre-function

Executa o script **antes** de enviar a requisicao ao upstream. E a fase ideal para:

- Validar e transformar a requisicao
- Injetar headers baseados em logica customizada
- Bloquear requisicoes com base em regras de negocio
- Fazer chamadas a servicos auxiliares para enriquecimento

**Configuracao:**

\`\`\`json
{
  "phase": "rewrite",
  "functions": [
    "return function(conf, ctx) ... end"
  ]
}
\`\`\`

### serverless-post-function

Executa o script **depois** de receber a resposta do upstream. E indicado para:

- Transformar o corpo da resposta
- Adicionar headers de resposta baseados em logica customizada
- Registrar metricas e logs customizados
- Modificar o status code com base em condicoes

**Configuracao:**

\`\`\`json
{
  "phase": "header_filter",
  "functions": [
    "return function(conf, ctx) ... end"
  ]
}
\`\`\`

> **Dica:** O campo \`phase\` define em qual fase do Nginx o script executa. As fases mais comuns sao: \`rewrite\` (antes do upstream), \`header_filter\` (ao receber headers da resposta) e \`body_filter\` (ao receber o body da resposta).`,
        },
        {
          id: "ciclo-vida-requisicao",
          title: "Ciclo de Vida da Requisicao",
          body: `Entender o ciclo de vida da requisicao no API Gateway e fundamental para escrever scripts eficientes. O processamento segue estas fases:

**1. Rewrite (reescrita)**
- Primeira fase apos o recebimento da requisicao
- Ideal para modificar URI, headers e parametros
- \`serverless-pre-function\` com \`phase: "rewrite"\` executa aqui

**2. Access (acesso)**
- Fase de autenticacao e autorizacao
- Plugins de autenticacao (key-auth, jwt-auth) executam aqui
- Use \`phase: "access"\` para validacoes que dependem do consumer

**3. Before Proxy (antes do proxy)**
- Ultima chance de modificar a requisicao antes de enviar ao upstream
- Util para transformacoes finais baseadas em dados de autenticacao

**4. Header Filter (filtro de headers)**
- Executada quando os headers da resposta do upstream sao recebidos
- Ideal para modificar headers de resposta
- \`serverless-post-function\` com \`phase: "header_filter"\` executa aqui

**5. Body Filter (filtro do body)**
- Executada quando o corpo da resposta e recebido
- Permite transformar o corpo antes de enviar ao cliente
- Cuidado: o corpo pode chegar em chunks

**6. Log (registro)**
- Fase final, apos a resposta ser enviada ao cliente
- Ideal para logging e metricas customizadas
- Nao afeta a resposta (ja foi enviada)

> **Atencao:** Nunca execute operacoes bloqueantes (I/O sincrono, sleep) nas fases de processamento. Isso trava o worker do Nginx e impacta todas as requisicoes.`,
        },
        {
          id: "apis-disponiveis",
          title: "APIs Disponiveis nos Scripts",
          body: `Scripts Lua no API Gateway tem acesso a diversas APIs para interagir com a requisicao, resposta e servicos externos.

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

> **Dica:** Sempre trate erros (\`if not res then\`) ao usar a API HTTP. Falhas de rede sao comuns e devem ser tratadas graciosamente.`,
        },
      ],
    },
    // ── 2. Biblioteca de Scripts ────────────────────────────────
    {
      slug: "biblioteca-scripts",
      title: "Biblioteca de Scripts",
      description:
        "Scripts pre-construidos disponiveis no FuseOne para injecao de headers, transformacao de body, roteamento e mais.",
      icon: "Library",
      tags: ["scripts", "biblioteca", "templates"],
      content: [
        {
          id: "sobre-biblioteca",
          title: "Sobre a Biblioteca de Scripts",
          body: `O FuseOne API Gateway inclui uma **biblioteca de scripts** pre-construidos que cobrem os casos de uso mais comuns. Esses scripts foram testados, otimizados e podem ser aplicados diretamente nas suas rotas sem precisar escrever codigo do zero.

A biblioteca esta disponivel no editor visual de politicas. Ao adicionar um plugin \`serverless-pre-function\` ou \`serverless-post-function\`, voce pode escolher um script da biblioteca e customizar os parametros.

**Categorias disponiveis:**
- Injecao e manipulacao de headers
- Transformacao de body (requisicao e resposta)
- Roteamento condicional
- Logging customizado
- Validacao de tokens e dados

Cada script da biblioteca inclui:
- Descricao do que faz
- Parametros configuraveis
- Exemplo de uso
- Notas sobre performance

> **Dica:** Use os scripts da biblioteca como ponto de partida. Voce pode copia-los e customiza-los conforme a necessidade do seu cenario.`,
        },
        {
          id: "scripts-headers",
          title: "Scripts de Injecao de Headers",
          body: `Scripts para adicionar, modificar ou remover headers em requisicoes e respostas.

### Injetar Header Baseado em Horario

Adiciona um header indicando o periodo do dia (util para roteamento por horario comercial):

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

Injeta headers com informacoes do consumidor autenticado para o upstream:

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

Remove headers internos que nao devem ser expostos ao cliente:

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

> **Nota:** O script de sanitizacao de headers deve ser usado como \`serverless-post-function\` na fase \`header_filter\`.`,
        },
        {
          id: "scripts-transformacao",
          title: "Scripts de Transformacao de Body",
          body: `Scripts para modificar o corpo da requisicao ou resposta em transito.

### Adicionar Envelope na Resposta

Encapsula a resposta do upstream em um envelope padrao com metadados:

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

### Remover Campos Sensiveis da Resposta

Filtra campos que nao devem ser retornados ao cliente (ex: dados internos, IDs de banco):

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

> **Atencao:** Scripts de transformacao de body na fase \`body_filter\` podem receber o corpo em chunks. Certifique-se de tratar o caso onde \`ngx.arg[1]\` contem apenas um fragmento do JSON completo.`,
        },
        {
          id: "scripts-roteamento",
          title: "Scripts de Roteamento Condicional",
          body: `Scripts que modificam o destino da requisicao com base em condicoes dinamicas.

### Roteamento por Tenant (Multi-tenancy)

Direciona a requisicao para o upstream correto com base no tenant identificado no header ou subdominio:

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

Consulta um servico de feature flags para decidir o roteamento:

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

> **Dica:** Sempre implemente um fallback quando o roteamento depende de servicos externos. Se o servico de feature flags estiver fora do ar, a rota deve continuar funcionando com o comportamento padrao.`,
        },
        {
          id: "scripts-logging-validacao",
          title: "Scripts de Logging e Validacao",
          body: `Scripts para registro customizado e validacao de dados.

### Logging Customizado com Contexto de Negocio

Registra informacoes de negocio nos logs do gateway para facilitar o debugging:

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

### Validacao de Payload JSON

Valida campos obrigatorios no corpo da requisicao antes de enviar ao upstream:

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

### Validacao de Token Customizado

Valida um token proprietario consultando um servico de autenticacao:

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

> **Nota:** O script de logging deve ser usado na fase \`log\` (\`serverless-post-function\` com \`phase: "log"\`). Os scripts de validacao devem usar a fase \`rewrite\` ou \`access\`.`,
        },
      ],
    },
    // ── 3. Boas Praticas e Limitacoes ───────────────────────────
    {
      slug: "boas-praticas-lua",
      title: "Boas Praticas e Limitacoes",
      description:
        "Performance, seguranca, debugging e limitacoes do scripting Lua no API Gateway.",
      icon: "AlertTriangle",
      tags: ["boas-praticas", "performance", "seguranca"],
      content: [
        {
          id: "performance",
          title: "Performance e Otimizacao",
          body: `Scripts Lua no API Gateway sao executados pelo LuaJIT, que compila o codigo para instrucoes nativas. Ainda assim, scripts mal escritos podem degradar significativamente a performance do gateway.

### Regras de Ouro

- **Evite alocacoes desnecessarias**: Reutilize tabelas e strings sempre que possivel
- **Minimize chamadas externas**: Cada chamada HTTP adiciona latencia
- **Use cache em memoria**: O modulo \`lua-resty-lrucache\` permite cache local no worker
- **Prefira operacoes nao-bloqueantes**: Use \`ngx.timer.at\` para tarefas em background

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

### O que NAO FAZER

\`\`\`lua
-- RUIM: operacao bloqueante
os.execute("sleep 1")

-- RUIM: leitura de arquivo sincrone em cada requisicao
local f = io.open("/path/to/file")

-- RUIM: loop infinito ou muito longo
while true do ... end

-- RUIM: criar tabelas grandes em cada requisicao
local big_table = {}
for i = 1, 100000 do big_table[i] = i end
\`\`\`

> **Atencao:** Um script que bloqueia um worker do Nginx afeta **todas** as requisicoes processadas por aquele worker, nao apenas a requisicao atual.

### Metricas de Performance
- Scripts simples (header injection): < 0.1ms de latencia adicional
- Scripts com chamada HTTP externa: 1-50ms dependendo do servico
- Scripts com transformacao de body: 0.5-5ms dependendo do tamanho`,
        },
        {
          id: "limites-memoria",
          title: "Limites de Memoria e Recursos",
          body: `O API Gateway impoe limites para evitar que scripts consumam recursos excessivos e afetem a estabilidade do sistema.

### Limites Padrao

- **Tamanho maximo do script**: 64KB de codigo Lua por plugin
- **Memoria por requisicao**: O Nginx limita a memoria alocada por requisicao
- **Tempo de execucao**: Scripts nao devem exceder 60 segundos (timeout do worker)
- **Conexoes HTTP externas**: Limitadas pelo pool de conexoes do worker

### Gerenciamento de Memoria

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
- Aumento gradual no consumo de memoria dos workers
- Latencia crescente sem aumento de trafego
- Erros "lua_alloc" ou "out of memory" nos logs

> **Dica:** Monitore o consumo de memoria dos workers do Nginx apos habilitar scripts customizados. Use \`ngx.worker.pid()\` para identificar o worker nos logs e correlacionar com metricas do sistema.

**Boas praticas:**
- Teste scripts com carga realista antes de aplicar em producao
- Monitore metricas de memoria apos deployar novos scripts
- Use \`collectgarbage("count")\` durante o desenvolvimento para medir o consumo
- Prefira scripts curtos e focados em uma unica responsabilidade`,
        },
        {
          id: "operacoes-evitar",
          title: "Operacoes Bloqueantes a Evitar",
          body: `O modelo de concorrencia do OpenResty e baseado em **coroutines cooperativas**. Isso significa que um script que bloqueia impede que o worker processe outras requisicoes. Conhecer as operacoes proibidas e essencial.

### Operacoes PROIBIDAS

- **\`os.execute()\`**: Executa comandos do sistema de forma bloqueante
- **\`io.open()\` / \`io.read()\`**: I/O de arquivo sincrono
- **\`socket\` (LuaSocket padrao)**: Use \`ngx.socket.tcp\` ou \`resty.http\` em vez disso
- **\`os.clock()\` em loops**: Pode causar busy-wait
- **\`require\` condicional em cada requisicao**: Carregue modulos no escopo do modulo, nao dentro da funcao

### Alternativas Nao-Bloqueantes

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

> **Nota:** \`ngx.sleep()\` e cooperativo e nao bloqueia o worker, diferente de \`os.execute("sleep")\`. Ainda assim, use com moderacao pois a requisicao ficara pendente durante o sleep.

### Checklist Pre-Deploy
- O script usa apenas APIs nao-bloqueantes (ngx.*, resty.*)?
- Todos os timeouts estao configurados em chamadas externas?
- O script trata erros de rede e timeouts graciosamente?
- Nao ha loops infinitos ou condicionais que possam nunca terminar?`,
        },
        {
          id: "debugging",
          title: "Debugging e Troubleshooting",
          body: `Depurar scripts Lua no gateway requer tecnicas especificas, ja que nao e possivel usar debuggers tradicionais em ambiente de producao.

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

Os logs de script aparecem no log de erro do API Gateway. No FuseOne, voce pode visualiza-los na aba de **Logs de Debug** do painel de monitoramento.

### Estrategias de Debugging

**1. Desenvolvimento local:**
- Use o ambiente de desenvolvimento com \`make infra\` e \`make backend\`
- Habilite o nivel de log \`debug\` na configuracao do gateway
- Teste o script com \`curl\` e verifique os logs

**2. Tratamento de erros explicito:**

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

> **Dica:** Use o header \`X-Debug\` durante o desenvolvimento para expor informacoes de debugging sem afetar requisicoes normais. Remova ou desabilite antes de ir para producao.

**Erros comuns e solucoes:**
- \`attempt to index a nil value\`: Variavel nao inicializada — verifique se o dado existe
- \`bad argument to decode\`: JSON invalido — valide o input antes de decodificar
- \`no resolver defined\`: DNS nao configurado — use IPs ou configure o resolver no Nginx`,
        },
        {
          id: "seguranca-scripts",
          title: "Seguranca dos Scripts",
          body: `Scripts Lua executam com os mesmos privilegios do processo do API Gateway. Isso significa que scripts mal-intencionados ou mal escritos podem comprometer a seguranca de todo o sistema.

### Riscos de Seguranca

- **Vazamento de dados**: Scripts podem acessar headers e bodies de todas as requisicoes
- **Acesso ao filesystem**: Funcoes como \`io.open\` podem ler arquivos do servidor
- **Exfiltração de dados**: Scripts podem enviar dados para endpoints externos
- **Denial of Service**: Scripts mal escritos podem consumir todos os recursos

### Controles Recomendados

**1. Controle de acesso:**
- Restrinja quem pode criar e editar scripts (permissao \`plugins:write\` no FuseOne)
- Implemente um processo de revisao (code review) para novos scripts
- Mantenha um registro de auditoria de alteracoes em scripts

**2. Validacao de scripts:**

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

**3. Principio do menor privilegio:**
- Scripts devem acessar apenas os dados necessarios para sua funcao
- Nao propague credenciais internas para respostas ao cliente
- Limite os endpoints que scripts podem chamar (use service mesh/iptables)

**4. Protecao contra injection:**
- Valide e sanitize todos os inputs usados em chamadas externas
- Nunca concatene inputs do usuario em URLs ou queries sem validacao
- Use parametros tipados em vez de concatenacao de strings

> **Atencao:** Trate todo script Lua como codigo de producao. Aplique as mesmas praticas de seguranca que voce usaria em qualquer outro componente do sistema: validacao de entrada, tratamento de erros, principio do menor privilegio e auditoria.

### Checklist de Seguranca
- O script valida todos os inputs do usuario?
- O script evita logar dados sensiveis (tokens, senhas, PII)?
- O script limita o acesso a apenas os recursos necessarios?
- O script foi revisado por outro desenvolvedor?
- As permissoes de quem pode editar scripts estao restritas?`,
        },
      ],
    },
  ],
}
