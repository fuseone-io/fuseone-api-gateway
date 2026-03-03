import type { DocCategory } from "./types"

export const referenciaPluginsCategory: DocCategory = {
  slug: "referencia-plugins",
  title: "Referencia de Plugins",
  description:
    "Documentacao detalhada de todos os plugins disponiveis no API Gateway, organizados por categoria.",
  icon: "BookOpen",
  articles: [
    // ── 1. Plugins de Autenticacao ──────────────────────────────
    {
      slug: "plugins-autenticacao",
      title: "Plugins de Autenticacao",
      description:
        "Controle quem pode acessar suas APIs com plugins de autenticacao como key-auth, JWT, OAuth e mais.",
      icon: "KeyRound",
      tags: ["autenticacao", "key-auth", "jwt", "oauth"],
      content: [
        {
          id: "visao-geral-autenticacao",
          title: "Visao Geral",
          body: `Os plugins de autenticacao sao a primeira linha de defesa das suas APIs. Eles validam a identidade do consumidor antes que a requisicao alcance o upstream.

O API Gateway oferece diversas estrategias de autenticacao que podem ser combinadas conforme a necessidade:

- **key-auth**: Autenticacao por chave de API, ideal para integracao entre sistemas
- **basic-auth**: Autenticacao por usuario e senha (HTTP Basic)
- **jwt-auth**: Validacao de tokens JWT, indicado para aplicacoes modernas
- **hmac-auth**: Assinatura HMAC para garantir integridade da requisicao
- **openid-connect**: Integracao com provedores OAuth 2.0 / OIDC (Keycloak, Auth0, etc.)
- **forward-auth**: Delegacao da autenticacao para um servico externo

> **Dica:** Voce pode habilitar mais de um plugin de autenticacao na mesma rota. O API Gateway tentara cada um em ordem e aceitara o primeiro que for bem-sucedido.`,
          subsections: [
            {
              id: "key-auth",
              title: "key-auth",
              body: `O plugin **key-auth** autentica consumidores atraves de uma chave de API enviada no header, query string ou cookie.

**Quando usar:**
- Integracao maquina-a-maquina (M2M)
- APIs internas que precisam de identificacao simples do chamador
- Cenarios onde voce quer rastrear uso por consumidor sem complexidade de tokens

**Configuracao:**

\`\`\`json
{
  "key": "minha-chave-secreta-123"
}
\`\`\`

O campo \`header\` define o nome do header onde a chave sera enviada (padrao: \`apikey\`). O campo \`query\` permite receber a chave pela query string.

> **Nota:** Sempre utilize chaves longas e aleatorias. Evite chaves previsiveis como nomes de projetos ou sequencias numericas.

**Boas praticas:**
- Rotacione chaves periodicamente
- Use um \`consumer\` diferente para cada integracao
- Combine com \`ip-restriction\` para defesa em profundidade
- Monitore o uso via logs para detectar chaves comprometidas`,
            },
            {
              id: "basic-auth",
              title: "basic-auth",
              body: `O plugin **basic-auth** implementa autenticacao HTTP Basic (RFC 7617). O consumidor envia usuario e senha codificados em Base64 no header \`Authorization\`.

**Quando usar:**
- Acesso a APIs administrativas ou internas
- Integracoes legadas que nao suportam JWT ou OAuth
- Prototipagem rapida durante o desenvolvimento

**Configuracao no consumidor:**

\`\`\`json
{
  "username": "meu-usuario",
  "password": "senha-segura-456"
}
\`\`\`

> **Atencao:** O basic-auth transmite credenciais codificadas em Base64 (nao criptografadas). Sempre use HTTPS em producao para proteger as credenciais em transito.

**Boas praticas:**
- Nunca use basic-auth sem TLS/HTTPS
- Prefira senhas fortes com pelo menos 16 caracteres
- Considere migrar para jwt-auth ou openid-connect em producao`,
            },
            {
              id: "jwt-auth",
              title: "jwt-auth",
              body: `O plugin **jwt-auth** valida tokens JWT (JSON Web Token) presentes na requisicao. Suporta algoritmos HS256, HS512, RS256 e ES256.

**Quando usar:**
- Aplicacoes web e mobile modernas
- Arquiteturas de microsservicos com autenticacao centralizada
- Quando voce precisa de claims customizadas no token (roles, permissoes, etc.)

**Configuracao no consumidor:**

\`\`\`json
{
  "key": "identificador-do-consumidor",
  "secret": "chave-secreta-para-hs256",
  "algorithm": "HS256",
  "exp": 86400
}
\`\`\`

Para RS256, configure o campo \`public_key\` com a chave publica em formato PEM. O campo \`exp\` define o tempo de expiracao do token em segundos.

**Boas praticas:**
- Prefira RS256 em producao — a chave privada nunca precisa estar no gateway
- Defina tempos de expiracao curtos (15-60 minutos) com refresh tokens
- Valide os claims \`iss\` e \`aud\` para prevenir uso indevido de tokens
- Use o campo \`claims_to_verify\` para validar claims obrigatorias`,
            },
            {
              id: "hmac-auth",
              title: "hmac-auth",
              body: `O plugin **hmac-auth** verifica a assinatura HMAC da requisicao, garantindo tanto a identidade do chamador quanto a integridade dos dados transmitidos.

**Quando usar:**
- Webhooks que precisam de verificacao de origem
- APIs financeiras ou de pagamento
- Integracoes onde a integridade da mensagem e critica

**Configuracao no consumidor:**

\`\`\`json
{
  "access_key": "meu-access-key",
  "secret_key": "minha-chave-secreta",
  "algorithm": "hmac-sha256",
  "signed_headers": ["date", "content-type"]
}
\`\`\`

O cliente deve assinar os headers especificados em \`signed_headers\` usando a chave secreta e incluir a assinatura no header \`Authorization\`.

> **Nota:** O hmac-auth requer sincronizacao de relogios entre cliente e servidor. O campo \`clock_skew\` (padrao: 300 segundos) define a tolerancia maxima.

**Boas praticas:**
- Inclua o header \`Date\` nos headers assinados para prevenir replay attacks
- Use \`hmac-sha256\` ou superior — evite SHA-1
- Documente claramente o processo de assinatura para consumidores da API`,
            },
            {
              id: "openid-connect",
              title: "openid-connect",
              body: `O plugin **openid-connect** integra o API Gateway com provedores de identidade que implementam o protocolo OpenID Connect / OAuth 2.0, como Keycloak, Auth0, Okta e Azure AD.

**Quando usar:**
- Single Sign-On (SSO) corporativo
- APIs publicas que exigem autenticacao OAuth 2.0
- Cenarios onde voce ja possui um Identity Provider (IdP)

**Configuracao:**

\`\`\`json
{
  "client_id": "meu-client-id",
  "client_secret": "meu-client-secret",
  "discovery": "https://idp.exemplo.com/.well-known/openid-configuration",
  "scope": "openid profile email",
  "bearer_only": true
}
\`\`\`

Com \`bearer_only: true\`, o plugin apenas valida tokens Bearer existentes. Com \`bearer_only: false\`, ele redireciona usuarios nao autenticados para o fluxo de login do IdP.

> **Dica:** Use o endpoint de discovery para que o gateway busque automaticamente as chaves publicas, endpoints de token e configuracoes do IdP.

**Boas praticas:**
- Sempre use o endpoint de discovery em vez de configurar URLs manualmente
- Habilite \`set_userinfo_header\` para propagar informacoes do usuario ao upstream
- Configure \`introspection_endpoint\` para validacao de tokens opacos
- Mantenha o \`client_secret\` em variaveis de ambiente, nao no codigo`,
            },
            {
              id: "forward-auth",
              title: "forward-auth",
              body: `O plugin **forward-auth** delega a decisao de autenticacao/autorizacao para um servico HTTP externo. O gateway encaminha a requisicao ao servico de auth e, com base na resposta, permite ou bloqueia o acesso.

**Quando usar:**
- Logica de autorizacao complexa que nao cabe em plugins padrao
- Integracoes com sistemas de autorizacao legados
- Cenarios onde voce precisa de verificacoes customizadas (ex: limites de conta, feature flags)

**Configuracao:**

\`\`\`json
{
  "uri": "http://auth-service:8080/verify",
  "request_headers": ["Authorization", "X-Tenant-Id"],
  "upstream_headers": ["X-User-Id", "X-User-Role"],
  "request_method": "POST"
}
\`\`\`

O campo \`request_headers\` define quais headers sao enviados ao servico de auth. O campo \`upstream_headers\` define quais headers da resposta do servico de auth sao propagados ao upstream.

> **Nota:** Se o servico de auth retornar status 2xx, a requisicao e permitida. Qualquer outro status bloqueia a requisicao e a resposta do servico de auth e retornada ao cliente.

**Boas praticas:**
- Mantenha o servico de auth proximo ao gateway (mesma rede) para minimizar latencia
- Implemente timeouts curtos para evitar que falhas no auth travem as requisicoes
- Retorne headers informativos do servico de auth para enriquecer o contexto do upstream`,
            },
          ],
        },
      ],
    },
    // ── 2. Plugins de Seguranca ─────────────────────────────────
    {
      slug: "plugins-seguranca",
      title: "Plugins de Seguranca",
      description:
        "Proteja suas APIs contra abusos com restricao de IP, bloqueio de URI, CORS e protecao CSRF.",
      icon: "Shield",
      tags: ["seguranca", "ip", "cors", "restricao"],
      content: [
        {
          id: "visao-geral-seguranca",
          title: "Visao Geral",
          body: `Os plugins de seguranca formam camadas adicionais de protecao alem da autenticacao. Eles controlam **de onde**, **como** e **quem** pode acessar suas APIs.

Essas protecoes funcionam de forma complementar:

- **ip-restriction**: Permite ou bloqueia acessos com base no IP de origem
- **uri-blocker**: Bloqueia padroes de URI suspeitos ou perigosos
- **consumer-restriction**: Restringe acesso a consumidores ou grupos especificos
- **cors**: Configura Cross-Origin Resource Sharing para aplicacoes web
- **csrf**: Protege contra ataques Cross-Site Request Forgery

> **Dica:** Combine multiplos plugins de seguranca para criar uma defesa em profundidade. Por exemplo, use \`ip-restriction\` junto com \`consumer-restriction\` para garantir que apenas consumidores autorizados de IPs confiáveis acessem APIs sensiveis.`,
          subsections: [
            {
              id: "ip-restriction",
              title: "ip-restriction",
              body: `O plugin **ip-restriction** permite criar listas de IPs permitidos (whitelist) ou bloqueados (blacklist). Suporta enderecos IPv4, IPv6 e notacao CIDR.

**Quando usar:**
- Restringir acesso a APIs administrativas a IPs internos
- Bloquear IPs conhecidos por abuso ou ataques
- Limitar acesso de parceiros a faixas de IP especificas

**Configuracao (whitelist):**

\`\`\`json
{
  "whitelist": [
    "10.0.0.0/8",
    "192.168.1.0/24",
    "200.100.50.25"
  ]
}
\`\`\`

**Configuracao (blacklist):**

\`\`\`json
{
  "blacklist": [
    "203.0.113.0/24"
  ],
  "message": "Acesso bloqueado para o seu endereco IP."
}
\`\`\`

> **Atencao:** Nao use whitelist e blacklist simultaneamente. Escolha uma estrategia. Whitelist e mais segura pois bloqueia tudo que nao estiver na lista.

**Boas praticas:**
- Prefira whitelist para APIs criticas e internas
- Use notacao CIDR para gerenciar faixas de IP de forma eficiente
- Documente o motivo de cada regra para facilitar a manutencao
- Teste as regras em ambiente de staging antes de aplicar em producao`,
            },
            {
              id: "uri-blocker",
              title: "uri-blocker",
              body: `O plugin **uri-blocker** bloqueia requisicoes cujo URI corresponda a padroes especificados via expressoes regulares. E util para prevenir acesso a endpoints perigosos ou exploracoes conhecidas.

**Quando usar:**
- Bloquear acesso a arquivos sensiveis (\`.env\`, \`.git\`, \`wp-admin\`)
- Prevenir ataques de path traversal (\`../\`)
- Filtrar tentativas de explorar vulnerabilidades conhecidas

**Configuracao:**

\`\`\`json
{
  "block_rules": [
    "\\\\.env$",
    "\\\\.git",
    "wp-admin",
    "\\\\.\\\\."
  ],
  "rejected_code": 403,
  "rejected_msg": "Acesso bloqueado por politica de seguranca."
}
\`\`\`

> **Nota:** Os padroes usam expressoes regulares. Lembre-se de escapar caracteres especiais como pontos (\`\\\\.\`) e barras.

**Boas praticas:**
- Comece com um conjunto basico de regras contra ataques comuns
- Monitore os logs de bloqueio para identificar falsos positivos
- Atualize as regras periodicamente com base em novas ameacas`,
            },
            {
              id: "consumer-restriction",
              title: "consumer-restriction",
              body: `O plugin **consumer-restriction** limita o acesso a uma rota para consumidores, grupos ou metodos HTTP especificos. Funciona em conjunto com os plugins de autenticacao.

**Quando usar:**
- Restringir endpoints de escrita (POST, PUT, DELETE) a consumidores privilegiados
- Criar niveis de acesso (bronze, silver, gold) para diferentes planos de API
- Garantir que apenas consumidores de determinado grupo acessem recursos sensiveis

**Configuracao por consumidor:**

\`\`\`json
{
  "type": "consumer_name",
  "whitelist": ["parceiro-a", "parceiro-b"],
  "rejected_code": 403
}
\`\`\`

**Configuracao por grupo de metodos:**

\`\`\`json
{
  "type": "consumer_group_id",
  "whitelist": ["grupo-premium"],
  "allowed_by_methods": {
    "grupo-basico": ["GET", "HEAD"]
  }
}
\`\`\`

> **Dica:** Combine com \`key-auth\` ou \`jwt-auth\` para que o gateway identifique o consumidor antes de aplicar a restricao.

**Boas praticas:**
- Organize consumidores em grupos logicos para facilitar o gerenciamento
- Use \`allowed_by_methods\` para controle granular de metodos HTTP
- Prefira whitelist em vez de blacklist para maior seguranca`,
            },
            {
              id: "cors",
              title: "cors",
              body: `O plugin **cors** configura os headers de Cross-Origin Resource Sharing, permitindo que aplicacoes web em dominios diferentes acessem sua API de forma segura.

**Quando usar:**
- APIs consumidas por aplicacoes frontend (SPAs em React, Vue, Angular)
- Quando o frontend e a API estao em dominios ou portas diferentes
- APIs publicas que precisam ser acessiveis via JavaScript no navegador

**Configuracao:**

\`\`\`json
{
  "allow_origins": "https://app.exemplo.com",
  "allow_methods": "GET,POST,PUT,DELETE,OPTIONS",
  "allow_headers": "Authorization,Content-Type,X-Request-Id",
  "expose_headers": "X-Total-Count,X-Request-Id",
  "max_age": 3600,
  "allow_credential": true
}
\`\`\`

> **Atencao:** Evite usar \`allow_origins: "*"\` em producao, especialmente com \`allow_credential: true\`. Isso expoe sua API a qualquer origem.

**Boas praticas:**
- Liste explicitamente as origens permitidas
- Restrinja \`allow_methods\` apenas aos metodos necessarios
- Configure \`max_age\` para reduzir requisicoes preflight OPTIONS
- Use \`allow_origins_by_regex\` para permitir subdominio com padroes dinamicos`,
            },
            {
              id: "csrf",
              title: "csrf",
              body: `O plugin **csrf** protege contra ataques Cross-Site Request Forgery gerando e validando tokens anti-CSRF automaticamente.

**Quando usar:**
- APIs que recebem requisicoes de formularios HTML
- Endpoints que alteram estado (POST, PUT, DELETE) acessados via navegador
- Quando a API usa cookies para autenticacao de sessao

**Configuracao:**

\`\`\`json
{
  "name": "csrf_token",
  "expires": 7200,
  "key": "chave-secreta-para-csrf"
}
\`\`\`

O plugin gera um token via cookie e exige que o cliente o envie de volta no header em requisicoes que alteram estado. Requisicoes GET, HEAD e OPTIONS sao isentas.

> **Nota:** O CSRF e relevante apenas quando a autenticacao usa cookies/sessoes. Para APIs com autenticacao via token Bearer (JWT), o CSRF geralmente nao e necessario.

**Boas praticas:**
- Configure \`expires\` com um valor razoavel (1-2 horas)
- Certifique-se de que o frontend envia o token no header correto
- Use em conjunto com o plugin \`cors\` para protecao completa`,
            },
          ],
        },
      ],
    },
    // ── 3. Plugins de Controle de Trafego ───────────────────────
    {
      slug: "plugins-trafego",
      title: "Plugins de Controle de Trafego",
      description:
        "Gerencie o fluxo de requisicoes com rate limiting, cache, canary releases e controle de concorrencia.",
      icon: "Gauge",
      tags: ["rate-limiting", "cache", "trafego", "canary"],
      content: [
        {
          id: "visao-geral-trafego",
          title: "Visao Geral",
          body: `Os plugins de controle de trafego protegem seus upstreams contra sobrecarga e permitem estrategias avancadas de roteamento e cache.

Eles atuam em diferentes dimensoes do trafego:

- **limit-req**: Limita a taxa de requisicoes por segundo (rate limiting)
- **limit-conn**: Controla o numero maximo de conexoes simultaneas
- **limit-count**: Define cotas de requisicoes por periodo (minuto, hora, dia)
- **traffic-split**: Distribui trafego entre upstreams para canary releases e testes A/B
- **proxy-cache**: Cacheia respostas para reduzir carga nos upstreams
- **request-id**: Injeta identificadores unicos para rastreabilidade

> **Dica:** Combine \`limit-count\` (cota por hora/dia) com \`limit-req\` (taxa por segundo) para protecao em multiplas camadas. A cota previne abuso geral e o rate limit previne rajadas.`,
          subsections: [
            {
              id: "limit-req",
              title: "limit-req",
              body: `O plugin **limit-req** implementa rate limiting baseado no algoritmo "leaky bucket". Ele limita a taxa de requisicoes por segundo, suavizando rajadas de trafego.

**Quando usar:**
- Proteger APIs contra rajadas excessivas de requisicoes
- Garantir qualidade de servico (QoS) para todos os consumidores
- Prevenir que um unico cliente monopolize os recursos

**Configuracao:**

\`\`\`json
{
  "rate": 10,
  "burst": 5,
  "rejected_code": 429,
  "key_type": "var",
  "key": "remote_addr",
  "rejected_msg": "Taxa de requisicoes excedida. Tente novamente em alguns segundos."
}
\`\`\`

O campo \`rate\` define requisicoes permitidas por segundo. O campo \`burst\` permite rajadas temporarias alem do limite. O \`key\` define o criterio de agrupamento (por IP, consumer, header, etc.).

**Opcoes de agrupamento (key):**
- \`remote_addr\`: Por IP de origem
- \`consumer_name\`: Por consumidor autenticado
- \`server_addr\`: Por IP do servidor (menos comum)

> **Nota:** Requisicoes em rajada (entre rate e rate+burst) sao atrasadas, nao rejeitadas. Apenas acima de rate+burst a requisicao retorna 429.

**Boas praticas:**
- Defina limites baseados na capacidade real do seu upstream
- Use \`consumer_name\` como key para limites por cliente
- Retorne o header \`Retry-After\` para orientar clientes sobre quando tentar novamente`,
            },
            {
              id: "limit-conn",
              title: "limit-conn",
              body: `O plugin **limit-conn** limita o numero de conexoes simultaneas (concorrentes) a uma rota. Diferente do rate limiting, ele controla quantas requisicoes podem estar sendo processadas ao mesmo tempo.

**Quando usar:**
- Endpoints que consomem muitos recursos (relatorios, exports, uploads)
- APIs com processamento demorado (IA, transcodificacao, batch)
- Proteger upstreams que tem limite de conexoes simultaneas

**Configuracao:**

\`\`\`json
{
  "conn": 50,
  "burst": 10,
  "default_conn_delay": 0.1,
  "rejected_code": 503,
  "key_type": "var",
  "key": "remote_addr"
}
\`\`\`

O campo \`conn\` define o limite de conexoes simultaneas. O \`burst\` permite exceder temporariamente o limite com um atraso de \`default_conn_delay\` segundos.

> **Dica:** Use \`limit-conn\` em endpoints pesados e \`limit-req\` em endpoints leves. Eles se complementam.

**Boas praticas:**
- Monitore o numero medio de conexoes simultaneas antes de definir limites
- Configure o \`default_conn_delay\` de acordo com o tempo de resposta tipico
- Use logs e metricas para ajustar os valores ao longo do tempo`,
            },
            {
              id: "limit-count",
              title: "limit-count",
              body: `O plugin **limit-count** implementa cotas de requisicoes por periodo de tempo (minuto, hora, dia). E ideal para planos de API com limites mensais ou diarios.

**Quando usar:**
- Planos de API com cotas (1000 req/dia para o plano basico, 10000 para premium)
- Limitar o uso de APIs externas ou com custo por chamada
- Compliance com contratos de SLA

**Configuracao:**

\`\`\`json
{
  "count": 1000,
  "time_window": 3600,
  "key_type": "var",
  "key": "consumer_name",
  "rejected_code": 429,
  "rejected_msg": "Cota de requisicoes excedida. Atualize seu plano para mais requisicoes.",
  "policy": "redis",
  "redis_host": "redis",
  "redis_port": 6379
}
\`\`\`

O campo \`time_window\` define o periodo em segundos (3600 = 1 hora). O campo \`policy\` define onde armazenar os contadores — \`local\` (em memoria) ou \`redis\` (compartilhado entre nos).

**Headers de resposta:**
- \`X-RateLimit-Limit\`: Cota total
- \`X-RateLimit-Remaining\`: Requisicoes restantes
- \`X-RateLimit-Reset\`: Segundos ate o reset da janela

> **Atencao:** Em ambientes com multiplos nos do gateway, use a politica \`redis\` para que os contadores sejam compartilhados. Com \`local\`, cada no mantem seu proprio contador.

**Boas praticas:**
- Use Redis em producao para contadores precisos e compartilhados
- Retorne os headers de rate limit para que clientes monitorem seu consumo
- Defina cotas diferentes por consumidor ou grupo de consumidores`,
            },
            {
              id: "traffic-split",
              title: "traffic-split",
              body: `O plugin **traffic-split** distribui o trafego entre diferentes upstreams com base em pesos ou regras. E fundamental para canary releases, testes A/B e migracoes graduais.

**Quando usar:**
- Canary releases: enviar 5% do trafego para a nova versao
- Testes A/B: dividir trafego entre duas versoes de um servico
- Migracao gradual: mover trafego do sistema legado para o novo
- Blue/green deployments com transicao suave

**Configuracao (canary por peso):**

\`\`\`json
{
  "rules": [
    {
      "weighted_upstreams": [
        {
          "upstream": {
            "type": "roundrobin",
            "nodes": { "novo-servico:8080": 1 }
          },
          "weight": 5
        },
        {
          "weight": 95
        }
      ]
    }
  ]
}
\`\`\`

O upstream sem a chave \`upstream\` recebe o trafego restante no upstream padrao da rota. No exemplo, 5% vai para o novo servico e 95% para o upstream original.

**Configuracao (split por condicao):**

\`\`\`json
{
  "rules": [
    {
      "match": [
        { "vars": [["http_x_canary", "==", "true"]] }
      ],
      "weighted_upstreams": [
        {
          "upstream": {
            "type": "roundrobin",
            "nodes": { "novo-servico:8080": 1 }
          },
          "weight": 100
        }
      ]
    }
  ]
}
\`\`\`

> **Dica:** Comece com um percentual pequeno (1-5%) e aumente gradualmente enquanto monitora erros e latencia na nova versao.

**Boas praticas:**
- Monitore metricas de erro e latencia durante o canary
- Tenha um plano de rollback rapido (voltar peso para 0)
- Use condicoes (match) para testar com usuarios internos antes de abrir para todos`,
            },
            {
              id: "proxy-cache",
              title: "proxy-cache",
              body: `O plugin **proxy-cache** armazena respostas do upstream em cache, reduzindo a carga nos servicos de backend e melhorando o tempo de resposta para requisicoes repetidas.

**Quando usar:**
- Endpoints com dados que mudam com pouca frequencia (catalogo de produtos, configuracoes)
- APIs com alto volume de leitura e baixa taxa de escrita
- Reduzir latencia para usuarios em regioes distantes do backend

**Configuracao:**

\`\`\`json
{
  "cache_strategy": "disk",
  "cache_zone": "disk_cache_one",
  "cache_key": ["$host", "$request_uri"],
  "cache_bypass": ["$arg_nocache"],
  "cache_method": ["GET"],
  "cache_http_status": [200, 301],
  "cache_ttl": 300,
  "hide_cache_headers": false,
  "no_cache": ["$arg_debug"]
}
\`\`\`

O campo \`cache_key\` define como a chave de cache e composta. O \`cache_ttl\` define o tempo de vida em segundos. O \`cache_bypass\` permite forcar a busca no upstream (ex: se o parametro \`nocache=1\` estiver presente).

**Headers de resposta:**
- \`X-Cache-Status\`: HIT (do cache), MISS (do upstream) ou BYPASS (ignorou cache)

> **Nota:** Apenas requisicoes GET sao cacheadas por padrao. Respostas com \`Set-Cookie\` ou \`Cache-Control: no-cache\` nao sao cacheadas.

**Boas praticas:**
- Defina TTLs curtos para dados que mudam (30-60s) e longos para dados estaticos (horas)
- Use a chave de cache cuidadosamente — inclua parametros relevantes
- Monitore a taxa de HIT/MISS para ajustar a estrategia
- Configure \`cache_bypass\` para permitir invalidacao manual`,
            },
            {
              id: "request-id",
              title: "request-id",
              body: `O plugin **request-id** injeta um identificador unico (UUID) em cada requisicao, permitindo rastrear o percurso completo de uma chamada atraves de todos os servicos.

**Quando usar:**
- Rastreamento distribuido (distributed tracing)
- Correlacao de logs entre gateway, servicos e bancos de dados
- Debugging de problemas em producao

**Configuracao:**

\`\`\`json
{
  "header_name": "X-Request-Id",
  "include_in_response": true,
  "algorithm": "uuid"
}
\`\`\`

O campo \`header_name\` define o nome do header (padrao: \`X-Request-Id\`). Com \`include_in_response: true\`, o ID tambem e retornado na resposta ao cliente.

Se a requisicao ja contiver o header, o plugin preserva o valor existente em vez de gerar um novo. Isso permite que sistemas externos definam seus proprios IDs de correlacao.

> **Dica:** Configure o \`request-id\` como um plugin global para que todas as requisicoes recebam um identificador. Isso simplifica enormemente o debugging.

**Boas praticas:**
- Use \`snowflake\` como algoritmo em cenarios de alto volume (melhor performance que UUID)
- Propague o request ID para todos os servicos downstream
- Inclua o request ID nos logs de aplicacao para correlacao
- Retorne sempre o ID na resposta para que o cliente possa referencia-lo em suporte`,
            },
          ],
        },
      ],
    },
    // ── 4. Plugins de Transformacao ──────────────────────────────
    {
      slug: "plugins-transformacao",
      title: "Plugins de Transformacao",
      description:
        "Transforme requisicoes e respostas em transito com rewrite de headers, body, URI e transcodificacao gRPC.",
      icon: "Shuffle",
      tags: ["transformacao", "rewrite", "grpc", "fault-injection"],
      content: [
        {
          id: "visao-geral-transformacao",
          title: "Visao Geral",
          body: `Os plugins de transformacao modificam requisicoes e respostas em transito, permitindo adaptar o formato dos dados sem alterar os servicos de backend.

Eles sao essenciais para:

- **proxy-rewrite**: Reescrever URI, headers e metodo HTTP antes de enviar ao upstream
- **response-rewrite**: Modificar o corpo, headers e status code da resposta
- **grpc-transcode**: Converter chamadas REST para gRPC automaticamente
- **fault-injection**: Simular falhas e atrasos para testes de resiliencia

> **Dica:** Plugins de transformacao sao executados em uma ordem especifica no pipeline. O \`proxy-rewrite\` atua na fase de acesso (antes do upstream), enquanto o \`response-rewrite\` atua na fase de resposta (depois do upstream).`,
          subsections: [
            {
              id: "proxy-rewrite",
              title: "proxy-rewrite",
              body: `O plugin **proxy-rewrite** modifica a requisicao antes de envia-la ao upstream. Pode alterar URI, host, metodo HTTP e headers.

**Quando usar:**
- Remover prefixos da URL (ex: \`/api/v1/users\` vira \`/users\` no upstream)
- Adicionar headers de contexto (tenant, versao, ambiente)
- Redirecionar para endpoints diferentes no upstream

**Configuracao:**

\`\`\`json
{
  "uri": "/internal$uri",
  "host": "servico-interno.local",
  "headers": {
    "set": {
      "X-Gateway": "fuseone",
      "X-Forwarded-Prefix": "/api/v1"
    },
    "remove": ["X-Debug"]
  }
}
\`\`\`

O campo \`uri\` suporta variaveis do Nginx como \`$uri\`, \`$host\` e \`$remote_addr\`. O campo \`regex_uri\` permite reescritas baseadas em regex:

\`\`\`json
{
  "regex_uri": ["/api/v1/(.*)", "/$1"]
}
\`\`\`

> **Nota:** O \`regex_uri\` tem prioridade sobre o campo \`uri\` quando ambos estao configurados.

**Boas praticas:**
- Use \`regex_uri\` para remover prefixos de versionamento
- Adicione headers de contexto que facilitem o roteamento e logging no upstream
- Teste as reescritas com cuidado — erros podem causar requisicoes para URIs erradas`,
            },
            {
              id: "response-rewrite",
              title: "response-rewrite",
              body: `O plugin **response-rewrite** modifica a resposta do upstream antes de envia-la ao cliente. Pode alterar o corpo, headers, status code e tipo de conteudo.

**Quando usar:**
- Ocultar headers internos do upstream (ex: \`Server\`, \`X-Powered-By\`)
- Padronizar formatos de erro entre diferentes upstreams
- Injetar headers de seguranca (CSP, HSTS, X-Frame-Options)
- Transformar o corpo da resposta (ex: adicionar envelope, remover campos)

**Configuracao:**

\`\`\`json
{
  "headers": {
    "set": {
      "X-Response-Time": "$upstream_response_time",
      "Strict-Transport-Security": "max-age=31536000"
    },
    "remove": ["Server", "X-Powered-By"]
  },
  "body": "{\"data\": $body, \"gateway\": \"fuseone\"}",
  "vars": [
    ["status", ">=", 500]
  ]
}
\`\`\`

O campo \`vars\` permite aplicar a transformacao condicionalmente — no exemplo acima, apenas para respostas com status 500+.

> **Dica:** Use o \`response-rewrite\` para padronizar headers de seguranca em todas as respostas. Isso evita depender de cada servico configurar seus proprios headers.

**Boas praticas:**
- Sempre remova headers que exponham detalhes internos (\`Server\`, \`X-Powered-By\`)
- Adicione headers de seguranca como HSTS, X-Content-Type-Options e X-Frame-Options
- Use condicoes (\`vars\`) para aplicar transformacoes apenas em cenarios especificos`,
            },
            {
              id: "grpc-transcode",
              title: "grpc-transcode",
              body: `O plugin **grpc-transcode** converte automaticamente chamadas REST/JSON em requisicoes gRPC, permitindo expor servicos gRPC como APIs REST sem modificar o backend.

**Quando usar:**
- Expor servicos gRPC para clientes que so suportam REST (navegadores, apps mobile)
- Criar uma fachada REST sobre microsservicos gRPC
- Permitir que equipes frontend consumam servicos gRPC sem bibliotecas especificas

**Configuracao:**

\`\`\`json
{
  "proto_id": "1",
  "service": "pacote.MeuServico",
  "method": "MeuMetodo",
  "deadline": 5000
}
\`\`\`

O campo \`proto_id\` referencia o arquivo .proto previamente cadastrado no API Gateway. O \`service\` e \`method\` identificam o servico e metodo gRPC a ser chamado. O \`deadline\` define o timeout em milissegundos.

**Fluxo:**
1. Cliente envia requisicao REST/JSON
2. O plugin converte os parametros JSON para a mensagem Protobuf correspondente
3. Envia a chamada gRPC ao upstream
4. Converte a resposta Protobuf de volta para JSON
5. Retorna ao cliente como resposta REST

> **Nota:** Voce precisa cadastrar o arquivo .proto no API Gateway antes de usar o plugin. O proto define a estrutura das mensagens e servicos.

**Boas praticas:**
- Mantenha os arquivos .proto sincronizados com os servicos backend
- Use \`deadline\` para evitar que chamadas gRPC lentas travem o gateway
- Teste a transcodificacao com campos opcionais e tipos complexos (maps, repeated)`,
            },
            {
              id: "fault-injection",
              title: "fault-injection",
              body: `O plugin **fault-injection** permite simular falhas e atrasos nas respostas, tornando possivel testar a resiliencia dos seus clientes e servicos sem afetar o upstream real.

**Quando usar:**
- Testes de resiliencia e chaos engineering
- Validar comportamento de retentativas e circuit breakers nos clientes
- Simular degradacao de servico para testar alertas e monitoramento
- Treinar equipes para lidar com incidentes

**Configuracao (atraso):**

\`\`\`json
{
  "delay": {
    "duration": 3,
    "percentage": 50
  }
}
\`\`\`

**Configuracao (abort / erro):**

\`\`\`json
{
  "abort": {
    "http_status": 503,
    "body": "{\"error\": \"Servico temporariamente indisponivel\"}",
    "percentage": 10
  }
}
\`\`\`

O campo \`percentage\` define a porcentagem de requisicoes afetadas (0-100). Voce pode combinar \`delay\` e \`abort\` na mesma configuracao.

> **Atencao:** Nunca habilite fault-injection em producao sem o campo \`percentage\` configurado, pois o padrao e 100% — todas as requisicoes serao afetadas.

**Boas praticas:**
- Use em ambientes de staging e development, nunca em producao sem protecao
- Comece com percentuais baixos (1-5%) e aumente gradualmente
- Combine com monitoramento para validar que os alertas disparam corretamente
- Documente os cenarios de teste para que a equipe entenda os resultados`,
            },
          ],
        },
      ],
    },
    // ── 5. Plugins de Observabilidade ───────────────────────────
    {
      slug: "plugins-observabilidade",
      title: "Plugins de Observabilidade",
      description:
        "Envie logs estruturados para sistemas externos como HTTP endpoints, Kafka e webhooks.",
      icon: "Activity",
      tags: ["logging", "observabilidade", "kafka"],
      content: [
        {
          id: "visao-geral-observabilidade",
          title: "Visao Geral",
          body: `Os plugins de observabilidade exportam dados de requisicoes e respostas para sistemas externos de logging, monitoramento e analise.

Uma boa estrategia de observabilidade permite:

- Diagnosticar problemas rapidamente com logs detalhados
- Identificar padroes de uso e tendencias de trafego
- Detectar anomalias e ataques em tempo real
- Cumprir requisitos de auditoria e compliance

O API Gateway oferece os seguintes plugins de logging:

- **http-logger**: Envia logs via HTTP/HTTPS para qualquer endpoint
- **kafka-logger**: Publica logs em topicos Apache Kafka
- **http-callout**: Faz chamadas HTTP customizadas durante o processamento

> **Dica:** Habilite o logging como plugin global para capturar todas as requisicoes. Use filtros para excluir endpoints de health check e metricas que geram volume desnecessario.`,
          subsections: [
            {
              id: "http-logger",
              title: "http-logger",
              body: `O plugin **http-logger** envia logs de cada requisicao/resposta para um endpoint HTTP ou HTTPS. E o plugin de logging mais versatil, compativel com qualquer sistema que aceite logs via HTTP.

**Quando usar:**
- Enviar logs para Elasticsearch, Loki, Splunk ou Datadog
- Integrar com sistemas de SIEM para auditoria
- Centralizar logs de multiplas instancias do gateway

**Configuracao:**

\`\`\`json
{
  "uri": "https://logs.exemplo.com/api/v1/logs",
  "auth_header": "Bearer token-do-servico-de-logs",
  "batch_max_size": 100,
  "inactive_timeout": 5,
  "buffer_duration": 60,
  "max_retry_count": 3,
  "retry_delay": 1,
  "concat_method": "json"
}
\`\`\`

O campo \`batch_max_size\` agrupa multiplos logs em um unico envio para melhor performance. O \`inactive_timeout\` define quantos segundos esperar antes de enviar um batch incompleto. O \`concat_method\` pode ser \`json\` (array JSON), \`new_line\` (NDJSON) ou \`json_object\`.

**Formato do log:**
Cada entrada inclui: metodo, URI, status, latencia, IP do cliente, headers da requisicao/resposta, informacoes do consumer e da rota.

> **Nota:** Os logs sao enviados de forma assincrona em background, sem impacto na latencia da requisicao.

**Boas praticas:**
- Use batch para reduzir o numero de chamadas HTTP ao destino
- Configure \`max_retry_count\` para lidar com falhas temporarias
- Filtre campos sensiveis (tokens, senhas) usando \`include_req_body: false\`
- Monitore o tamanho do buffer para evitar perda de logs em caso de indisponibilidade do destino`,
            },
            {
              id: "kafka-logger",
              title: "kafka-logger",
              body: `O plugin **kafka-logger** publica logs de requisicoes em topicos Apache Kafka, ideal para pipelines de dados em tempo real e arquiteturas orientadas a eventos.

**Quando usar:**
- Pipelines de dados em tempo real (Kafka -> Spark/Flink -> DataLake)
- Sistemas de auditoria com alta disponibilidade
- Cenarios onde o volume de logs e muito alto para HTTP direto
- Integracao com ecossistema de streaming (Kafka Connect, ksqlDB)

**Configuracao:**

\`\`\`json
{
  "broker_list": {
    "kafka-1.exemplo.com:9092": {},
    "kafka-2.exemplo.com:9092": {}
  },
  "kafka_topic": "api-gateway-logs",
  "producer_type": "async",
  "required_acks": 1,
  "batch_max_size": 500,
  "buffer_duration": 10,
  "max_retry_count": 3
}
\`\`\`

O campo \`producer_type\` pode ser \`sync\` (garante entrega, maior latencia) ou \`async\` (melhor performance, risco minimo de perda). O \`required_acks\` define o nivel de confirmacao (0=nenhum, 1=lider, -1=todos os replicas).

> **Dica:** Use \`producer_type: "async"\` com \`required_acks: 1\` para um bom equilibrio entre performance e confiabilidade.

**Boas praticas:**
- Configure pelo menos 2 brokers para alta disponibilidade
- Use particoes no topico para distribuir a carga de escrita
- Defina retencao do topico de acordo com politicas de compliance
- Monitore o lag do consumidor para garantir processamento em tempo real`,
            },
            {
              id: "http-callout",
              title: "http-callout",
              body: `O plugin **http-callout** (tambem conhecido como \`ext-plugin-pre-req\` ou via serverless functions) permite fazer chamadas HTTP customizadas durante o processamento da requisicao, possibilitando integracoes complexas.

**Quando usar:**
- Enriquecer a requisicao com dados de um servico externo antes de enviar ao upstream
- Notificar um webhook em tempo real sobre eventos especificos
- Buscar configuracoes dinamicas ou feature flags
- Validar dados em um servico de compliance antes de processar

**Exemplo via serverless-pre-function:**

\`\`\`lua
local http = require("resty.http")
local httpc = http.new()

local res, err = httpc:request_uri("http://enrichment:8080/context", {
  method = "GET",
  headers = {
    ["X-Request-Id"] = ngx.var.request_id
  }
})

if res and res.status == 200 then
  ngx.req.set_header("X-Enriched-Data", res.body)
end
\`\`\`

Este padrao permite integracoes flexiveis que nao sao possiveis com plugins declarativos. O servico externo e chamado durante o processamento e o resultado pode ser usado para modificar a requisicao.

> **Atencao:** Chamadas HTTP externas adicionam latencia a requisicao. Use timeouts curtos e implemente fallbacks para o caso de o servico externo estar indisponivel.

**Boas praticas:**
- Defina timeouts agressivos (100-500ms) para chamadas externas
- Implemente circuit breaker no servico chamado
- Use cache (proxy-cache ou em memoria) para reduzir chamadas repetidas
- Monitore a latencia adicional introduzida pelas chamadas externas`,
            },
          ],
        },
      ],
    },
    // ── 6. Plugins de IA ────────────────────────────────────────
    {
      slug: "plugins-ai",
      title: "Plugins de IA",
      description:
        "Gerencie e controle o acesso a Large Language Models (LLMs) com proxy, rate limiting por tokens e moderacao de conteudo.",
      icon: "Brain",
      tags: ["ia", "llm", "ai-proxy", "tokens"],
      content: [
        {
          id: "visao-geral-ia",
          title: "Visao Geral",
          body: `Os plugins de IA transformam o API Gateway em um **AI Gateway**, fornecendo uma camada unificada para gerenciar acesso a provedores de modelos de linguagem (LLMs) como OpenAI, Anthropic, Azure OpenAI, AWS Bedrock e outros.

Com estes plugins voce pode:

- Abstrair multiplos provedores de IA atras de uma unica API
- Controlar custos com rate limiting baseado em tokens
- Proteger seus modelos com guardrails de conteudo
- Implementar RAG (Retrieval-Augmented Generation) no gateway
- Moderar conteudo com integracao AWS Comprehend

Plugins disponiveis:

- **ai-proxy**: Proxy reverso para provedores de IA (OpenAI, Anthropic, etc.)
- **ai-proxy-multi**: Failover e load balancing entre multiplos provedores
- **ai-prompt-guard**: Filtros de entrada para bloquear prompts maliciosos
- **ai-request-rewrite**: Transformacao de requisicoes para IA
- **ai-rate-limiting**: Rate limiting por contagem de tokens
- **ai-rag**: Integracao com bases de conhecimento para RAG
- **ai-aws-content-moderation**: Moderacao de conteudo via AWS Comprehend

> **Nota:** Os plugins de IA exigem que o upstream seja um provedor de LLM. Eles nao funcionam com APIs REST convencionais.`,
          subsections: [
            {
              id: "ai-proxy",
              title: "ai-proxy",
              body: `O plugin **ai-proxy** atua como proxy reverso para provedores de IA, traduzindo requisicoes no formato padrao OpenAI para o formato especifico de cada provedor.

**Quando usar:**
- Centralizar o acesso a provedores de IA atraves do gateway
- Abstrair diferenças entre provedores (OpenAI, Anthropic, Azure, Bedrock)
- Aplicar politicas de seguranca e rate limiting nas chamadas de IA
- Registrar e auditar todas as interacoes com modelos de linguagem

**Configuracao (OpenAI):**

\`\`\`json
{
  "provider": "openai",
  "model": "gpt-4o",
  "api_key": "\${{OPENAI_API_KEY}}",
  "options": {
    "max_tokens": 4096,
    "temperature": 0.7
  }
}
\`\`\`

**Configuracao (Anthropic):**

\`\`\`json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "api_key": "\${{ANTHROPIC_API_KEY}}",
  "options": {
    "max_tokens": 8192
  }
}
\`\`\`

**Provedores suportados:** OpenAI, Anthropic, Azure OpenAI, AWS Bedrock, Google Gemini, Cohere, Mistral, entre outros.

> **Dica:** Use variaveis de ambiente (\`\${{VAR}}\`) para as chaves de API em vez de valores hardcoded. Isso permite rotacionar chaves sem alterar a configuracao do gateway.

**Boas praticas:**
- Configure timeouts mais longos para chamadas de IA (30-120 segundos)
- Habilite streaming (\`stream: true\`) para melhorar a experiencia do usuario
- Monitore o uso de tokens para controlar custos
- Use junto com \`ai-prompt-guard\` para protecao adicional`,
            },
            {
              id: "ai-proxy-multi",
              title: "ai-proxy-multi",
              body: `O plugin **ai-proxy-multi** permite configurar failover e load balancing entre multiplos provedores de IA. Se um provedor falhar ou atingir o limite de taxa, o trafego e redirecionado automaticamente para o proximo.

**Quando usar:**
- Alta disponibilidade para servicos de IA criticos
- Balancear carga entre provedores para otimizar custos
- Failover automatico quando um provedor esta indisponivel
- Testes comparativos entre modelos de diferentes provedores

**Configuracao:**

\`\`\`json
{
  "providers": [
    {
      "provider": "openai",
      "model": "gpt-4o",
      "api_key": "\${{OPENAI_API_KEY}}",
      "weight": 70,
      "priority": 1
    },
    {
      "provider": "anthropic",
      "model": "claude-sonnet-4-20250514",
      "api_key": "\${{ANTHROPIC_API_KEY}}",
      "weight": 30,
      "priority": 2
    }
  ],
  "strategy": "weighted",
  "fallback_on_error": true
}
\`\`\`

A estrategia \`weighted\` distribui o trafego com base nos pesos. A \`priority\` define a ordem de failover — se o provedor de prioridade 1 falhar, o trafego vai para o de prioridade 2.

> **Nota:** O plugin detecta automaticamente erros 429 (rate limit) e 5xx dos provedores e redireciona o trafego.

**Boas praticas:**
- Defina pesos com base no custo e performance de cada provedor
- Configure pelo menos 2 provedores para garantir disponibilidade
- Monitore metricas de failover para identificar provedores problematicos
- Use modelos equivalentes em diferentes provedores para consistencia`,
            },
            {
              id: "ai-prompt-guard",
              title: "ai-prompt-guard",
              body: `O plugin **ai-prompt-guard** filtra e valida os prompts enviados pelos usuarios antes de encaminha-los ao provedor de IA. Ele protege contra prompt injection, jailbreak e conteudo inapropriado.

**Quando usar:**
- Aplicacoes de IA voltadas para o publico
- Cenarios onde prompt injection pode causar danos (ex: acessar dados privados)
- Compliance com politicas de uso aceitavel
- Protecao contra jailbreak de system prompts

**Configuracao:**

\`\`\`json
{
  "deny_patterns": [
    "ignore previous instructions",
    "ignore todas as instrucoes",
    "system prompt",
    "DAN mode"
  ],
  "allow_patterns": [],
  "max_prompt_length": 10000,
  "action": "reject",
  "rejected_msg": "Prompt bloqueado por politica de seguranca."
}
\`\`\`

O campo \`deny_patterns\` lista padroes que serao bloqueados (suporta regex). O \`max_prompt_length\` limita o tamanho do prompt para evitar abusos. A \`action\` pode ser \`reject\` (bloquear) ou \`warn\` (logar e permitir).

> **Atencao:** Nenhum filtro de prompt e 100% eficaz. Use o prompt guard como uma camada de defesa, nao como unica protecao. Combine com moderacao de conteudo e system prompts robustos.

**Boas praticas:**
- Mantenha os padroes de bloqueio atualizados com novas tecnicas de ataque
- Registre prompts bloqueados para analise e melhoria dos filtros
- Use a acao \`warn\` em desenvolvimento para identificar falsos positivos
- Combine com \`ai-aws-content-moderation\` para protecao mais abrangente`,
            },
            {
              id: "ai-request-rewrite",
              title: "ai-request-rewrite",
              body: `O plugin **ai-request-rewrite** permite transformar a requisicao antes de envia-la ao provedor de IA. Voce pode injetar system prompts, modificar parametros e padronizar o formato.

**Quando usar:**
- Injetar system prompts padrao em todas as requisicoes
- Adicionar contexto (nome do usuario, idioma, regras de negocio)
- Padronizar parametros como temperature, max_tokens e top_p
- Transformar formatos de requisicao entre clientes e provedores

**Configuracao:**

\`\`\`json
{
  "system_prompt": "Voce e um assistente especializado em suporte tecnico. Responda sempre em portugues, de forma clara e objetiva.",
  "prepend_messages": [
    {
      "role": "system",
      "content": "Data atual: {{current_date}}. Usuario: {{header.X-User-Name}}."
    }
  ],
  "override_params": {
    "temperature": 0.3,
    "max_tokens": 2048
  }
}
\`\`\`

O campo \`system_prompt\` e adicionado como primeira mensagem do tipo system. Os \`prepend_messages\` sao inseridos antes das mensagens do usuario. O \`override_params\` sobrescreve parametros da requisicao original.

> **Dica:** Use templates com variaveis (\`{{header.X-User-Name}}\`) para personalizar o contexto de cada requisicao.

**Boas praticas:**
- Centralize os system prompts no gateway para facilitar a manutencao
- Use \`override_params\` para garantir que os clientes nao configurem valores inseguros
- Versione os system prompts para facilitar rollback
- Teste as transformacoes com diferentes formatos de entrada`,
            },
            {
              id: "ai-rate-limiting",
              title: "ai-rate-limiting",
              body: `O plugin **ai-rate-limiting** implementa rate limiting baseado na contagem de tokens consumidos, em vez de simples contagem de requisicoes. Isso e essencial para controlar custos de APIs de IA.

**Quando usar:**
- Controlar o gasto com provedores de IA por consumidor ou aplicacao
- Definir cotas de tokens diarias/mensais por plano
- Prevenir que um unico usuario consuma todos os tokens disponiveis
- Otimizar o orcamento de IA da organizacao

**Configuracao:**

\`\`\`json
{
  "limit": 100000,
  "time_window": 86400,
  "key": "consumer_name",
  "token_counting": "actual",
  "rejected_code": 429,
  "rejected_msg": "Cota de tokens excedida. Seu limite diario foi atingido."
}
\`\`\`

O campo \`limit\` define o numero maximo de tokens no periodo. O \`token_counting\` pode ser \`actual\` (conta tokens reais da resposta) ou \`estimated\` (estima antes de enviar). O \`time_window\` e em segundos (86400 = 1 dia).

**Headers de resposta:**
- \`X-AI-RateLimit-Limit-Tokens\`: Cota total de tokens
- \`X-AI-RateLimit-Remaining-Tokens\`: Tokens restantes
- \`X-AI-RateLimit-Reset\`: Segundos ate o reset

> **Nota:** O modo \`actual\` e mais preciso mas so aplica o limite apos a resposta. O modo \`estimated\` pode bloquear antes, evitando custos, mas pode ser menos preciso.

**Boas praticas:**
- Use cotas diferentes para diferentes planos de consumidores
- Monitore o consumo de tokens diariamente para ajustar limites
- Configure alertas quando um consumidor atingir 80% da cota
- Use Redis como backend para contadores compartilhados entre nos`,
            },
            {
              id: "ai-rag",
              title: "ai-rag",
              body: `O plugin **ai-rag** (Retrieval-Augmented Generation) enriquece os prompts com informacoes relevantes de uma base de conhecimento vetorial antes de enviar ao provedor de IA.

**Quando usar:**
- Chatbots com conhecimento especifico da empresa
- Assistentes que precisam consultar documentacao interna
- Respostas baseadas em dados atualizados (nao limitadas ao treinamento do modelo)
- Cenarios onde alucinacoes do modelo sao inaceitaveis

**Configuracao:**

\`\`\`json
{
  "vector_store": {
    "type": "qdrant",
    "endpoint": "http://qdrant:6333",
    "collection": "knowledge-base"
  },
  "embedding": {
    "provider": "openai",
    "model": "text-embedding-3-small",
    "api_key": "\${{OPENAI_API_KEY}}"
  },
  "top_k": 5,
  "similarity_threshold": 0.7,
  "context_template": "Use as seguintes informacoes como referencia para responder:\\n\\n{{context}}"
}
\`\`\`

O fluxo do RAG no gateway: (1) O prompt do usuario e convertido em embedding, (2) Os documentos mais similares sao recuperados da base vetorial, (3) O contexto e injetado no prompt, (4) O prompt enriquecido e enviado ao LLM.

> **Dica:** Ajuste o \`similarity_threshold\` para balancear entre relevancia (valor alto) e cobertura (valor baixo). Comece com 0.7 e ajuste conforme necessario.

**Boas praticas:**
- Mantenha a base de conhecimento atualizada com pipelines de indexacao
- Use \`top_k\` entre 3 e 10 para nao sobrecarregar o contexto
- Monitore a qualidade das respostas e ajuste o threshold
- Considere o limite de tokens do modelo ao definir \`top_k\``,
            },
            {
              id: "ai-aws-content-moderation",
              title: "ai-aws-content-moderation",
              body: `O plugin **ai-aws-content-moderation** utiliza o Amazon Comprehend para analisar e moderar o conteudo dos prompts e respostas de IA, detectando linguagem toxica, ofensiva ou inapropriada.

**Quando usar:**
- Aplicacoes de IA publicas que exigem moderacao de conteudo
- Compliance com regulamentacoes sobre conteudo gerado por IA
- Protecao da marca contra respostas ofensivas ou inapropriadas
- Ambientes educacionais ou corporativos com politicas de conteudo

**Configuracao:**

\`\`\`json
{
  "aws_region": "us-east-1",
  "aws_access_key": "\${{AWS_ACCESS_KEY}}",
  "aws_secret_key": "\${{AWS_SECRET_KEY}}",
  "moderation_categories": [
    "PROFANITY",
    "HATE_SPEECH",
    "INSULT",
    "SEXUAL",
    "VIOLENCE_OR_THREAT"
  ],
  "threshold": 0.8,
  "check_input": true,
  "check_output": true,
  "action": "reject"
}
\`\`\`

O campo \`moderation_categories\` define quais categorias de conteudo serao monitoradas. O \`threshold\` (0.0 a 1.0) define a sensibilidade — valores mais altos sao menos restritivos. Com \`check_input\` e \`check_output\`, voce controla se a moderacao ocorre na entrada, saida ou ambas.

> **Nota:** A moderacao de saida (\`check_output\`) adiciona latencia pois aguarda a resposta completa do LLM antes de analisar. Para streaming, apenas a moderacao de entrada e aplicada em tempo real.

**Boas praticas:**
- Habilite \`check_input\` e \`check_output\` para protecao completa
- Ajuste o \`threshold\` de acordo com a sensibilidade do seu caso de uso
- Registre conteudo moderado para analise e melhoria dos filtros
- Use junto com \`ai-prompt-guard\` para camadas complementares de protecao
- Considere o custo adicional das chamadas ao AWS Comprehend no calculo de custos`,
            },
          ],
        },
      ],
    },
  ],
}
