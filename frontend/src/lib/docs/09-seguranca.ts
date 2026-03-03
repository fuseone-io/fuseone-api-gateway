import type { DocCategory } from "./types"

export const segurancaCategory: DocCategory = {
  slug: "seguranca",
  title: "Seguranca",
  description:
    "Proteja suas APIs com autenticacao, SSL, protecao contra ameacas e gerenciamento seguro de credenciais.",
  icon: "Shield",
  articles: [
    // ── 1. Autenticacao de APIs ─────────────────────────────────────────
    {
      slug: "autenticacao-apis",
      title: "Autenticacao de APIs",
      description:
        "Metodos de autenticacao disponiveis, quando usar cada um e como combinar com politicas baseadas em consumers.",
      icon: "KeyRound",
      tags: ["autenticacao", "jwt", "api-key", "oauth"],
      content: [
        {
          id: "visao-geral-auth",
          title: "Visao Geral",
          body: `O API Gateway oferece multiplos metodos de autenticacao que podem ser aplicados individualmente ou combinados em cada rota. A autenticacao e feita via plugins, permitindo flexibilidade total na configuracao.

Quando uma requisicao chega ao gateway, o plugin de autenticacao:

1. Extrai a credencial da requisicao (header, query param, cookie, etc.)
2. Valida a credencial contra o provedor configurado
3. Identifica o **consumer** associado a credencial
4. Permite ou rejeita a requisicao com base na validacao

A identificacao do consumer e fundamental porque permite aplicar politicas diferenciadas por cliente: rate limits, cotas, permissoes de acesso e tracking de metricas.

> **Nota:** Voce pode habilitar multiplos plugins de autenticacao na mesma rota. Neste caso, a requisicao e aceita se **qualquer um** dos metodos validar com sucesso (logica OR). Para exigir multiplos metodos simultaneamente, use o plugin \`consumer-restriction\`.`,
        },
        {
          id: "api-key",
          title: "API Key",
          body: `A autenticacao por API Key e o metodo mais simples e amplamente utilizado. Cada consumer recebe uma chave unica que deve ser enviada em todas as requisicoes.

### Como Funciona
O consumer envia a chave no header \`apikey\` (padrao) ou em outro local configuravel:

\`\`\`
GET /api/v1/produtos HTTP/1.1
Host: api.exemplo.com
apikey: sua-chave-aqui-abc123
\`\`\`

### Quando Usar
- APIs internas entre servicos (service-to-service)
- Integracao com parceiros de confianca
- Cenarios simples onde nao e necessario login interativo
- Prototipacao e desenvolvimento

### Configuracao
No plugin \`key-auth\`, voce pode configurar:

- \`header\` — Nome do header que contem a chave (padrao: \`apikey\`)
- \`query\` — Alternativamente, aceitar a chave como query parameter
- \`hide_credentials\` — Remover a chave antes de encaminhar ao upstream (recomendado)

> **Dica:** Sempre habilite \`hide_credentials\` para evitar que a chave de API seja enviada ao servidor de destino. Isso reduz o risco de vazamento em logs do upstream.`,
        },
        {
          id: "jwt-auth",
          title: "JWT (JSON Web Token)",
          body: `A autenticacao JWT permite validar tokens assinados sem necessidade de consultar um servidor de autorizacao em cada requisicao. O gateway verifica a assinatura e as claims do token localmente.

### Como Funciona
1. O cliente obtem um JWT do seu servidor de autorizacao (IdP)
2. Envia o token no header \`Authorization: Bearer <token>\`
3. O gateway valida a assinatura usando a chave publica/secret configurada
4. Extrai as claims do token para identificar o consumer

### Quando Usar
- APIs publicas com autenticacao de usuarios
- Microservicos que ja utilizam JWT internamente
- Cenarios que exigem informacoes adicionais no token (roles, scopes, etc.)
- Integracao com provedores OAuth2/OpenID Connect

### Configuracao
O plugin \`jwt-auth\` suporta:

- \`algorithm\` — Algoritmo de assinatura: HS256, HS384, HS512, RS256, RS384, RS512, ES256, ES384, ES512
- \`secret\` / \`public_key\` — Chave para verificacao da assinatura
- \`claims_to_verify\` — Claims obrigatorias (ex: \`exp\`, \`nbf\`)
- \`consumer_claim\` — Claim usada para identificar o consumer (padrao: \`sub\`)

> **Atencao:** Para algoritmos RS* e ES* (assimetricos), configure apenas a chave publica no gateway. Nunca armazene a chave privada no API Gateway.`,
        },
        {
          id: "outros-metodos",
          title: "Outros Metodos de Autenticacao",
          body: `Alem de API Key e JWT, o API Gateway suporta os seguintes metodos:

### Basic Auth
Autenticacao HTTP basica com usuario e senha. Simples, porem menos seguro — use apenas sobre HTTPS. Configuravel via plugin \`basic-auth\`.

### HMAC Auth
Autenticacao baseada em assinatura HMAC do request. Cada requisicao e assinada com uma chave secreta, garantindo integridade e autenticidade. Ideal para APIs que precisam de non-repudiation.

### OpenID Connect
Integre com provedores de identidade compativeis com OIDC (Keycloak, Auth0, Azure AD, Google). O gateway realiza a validacao do token diretamente com o provedor. Suporta fluxos Authorization Code, Implicit e Client Credentials.

### Forward Auth
Delega a decisao de autenticacao para um servico externo. O gateway envia um request ao servico de auth e, com base na resposta (2xx = permitido, 4xx = negado), aceita ou rejeita a requisicao original. Util para logica de autorizacao customizada.

### LDAP
Valida credenciais contra um servidor LDAP/Active Directory. Ideal para integracao com diretorio corporativo existente.

> **Dica:** Para cenarios corporativos complexos, combine OpenID Connect (autenticacao) com \`consumer-restriction\` (autorizacao) para controle granular de acesso baseado em groups e scopes do token.

Cada metodo possui trade-offs entre simplicidade, seguranca e flexibilidade. Escolha com base nos requisitos do seu cenario especifico.`,
        },
      ],
    },

    // ── 2. SSL e Certificados ───────────────────────────────────────────
    {
      slug: "ssl-certificados",
      title: "SSL e Certificados",
      description:
        "Gerencie certificados SSL, configure SNI, force HTTPS e monitore a validade dos certificados.",
      icon: "Lock",
      tags: ["ssl", "tls", "certificados", "https"],
      content: [
        {
          id: "gerenciando-certificados",
          title: "Gerenciando Certificados",
          body: `O API Gateway gerencia certificados SSL/TLS para terminar conexoes HTTPS nas rotas configuradas. A terminacao SSL no gateway centraliza o gerenciamento de certificados e simplifica a configuracao dos upstreams.

Para adicionar um certificado, acesse **Configuracoes > SSL/TLS > Certificados** e clique em **Novo Certificado**. Voce precisara fornecer:

- **Certificado (PEM)** — O certificado publico no formato PEM (inclua a cadeia completa se necessario)
- **Chave privada (PEM)** — A chave privada correspondente no formato PEM
- **SNIs** — Lista de Server Name Indications (dominios) que utilizarao este certificado

Exemplo de upload via interface:

1. Cole o conteudo do certificado (incluindo \`-----BEGIN CERTIFICATE-----\` e \`-----END CERTIFICATE-----\`)
2. Cole a chave privada
3. Adicione os dominios: \`api.exemplo.com\`, \`*.exemplo.com\` (wildcards sao suportados)

> **Atencao:** A chave privada e armazenada de forma segura e encriptada. Mesmo assim, limite o acesso ao gerenciamento de certificados apenas a administradores de confianca via permissoes RBAC.`,
        },
        {
          id: "sni-configuracao",
          title: "SNI e Multiplos Dominios",
          body: `O Server Name Indication (SNI) permite que o API Gateway sirva certificados diferentes para dominios diferentes na mesma porta (443). Isso e essencial quando voce gerencia multiplas APIs em dominios distintos.

### Como o SNI Funciona
Quando o cliente inicia uma conexao TLS, ele envia o nome do servidor (hostname) no handshake. O gateway usa essa informacao para selecionar o certificado correto antes de completar a conexao.

### Configuracao de SNI
Cada certificado pode estar associado a um ou mais SNIs:

- **Dominio exato** — \`api.exemplo.com\` (corresponde apenas a este dominio)
- **Wildcard** — \`*.exemplo.com\` (corresponde a qualquer subdominio de exemplo.com)

Prioridade de resolucao:

1. Dominio exato tem prioridade sobre wildcard
2. Se nenhum certificado corresponder ao SNI solicitado, o gateway usa o certificado padrao (se configurado) ou rejeita a conexao

### Certificados por Ambiente
Uma pratica comum e usar certificados diferentes para cada ambiente:

- \`api.dev.exemplo.com\` — Certificado de desenvolvimento (pode ser self-signed)
- \`api.staging.exemplo.com\` — Certificado de staging
- \`api.exemplo.com\` — Certificado de producao (emitido por CA publica)

> **Dica:** Para simplificar o gerenciamento, use certificados wildcard (\`*.exemplo.com\`) quando possivel. Isso reduz o numero de certificados a gerenciar e renovar.`,
        },
        {
          id: "forcando-https",
          title: "Forcando HTTPS",
          body: `E uma pratica de seguranca essencial forcar o uso de HTTPS em todas as rotas de producao. O API Gateway oferece duas abordagens para garantir que clientes nao acessem APIs via HTTP inseguro:

### Redirecionamento HTTP para HTTPS
Configure o gateway para redirecionar automaticamente requisicoes HTTP (porta 80) para HTTPS (porta 443):

O plugin \`redirect\` pode ser configurado na rota com:

\`\`\`json
{
  "http_to_https": true,
  "ret_code": 301
}
\`\`\`

Isso retorna um HTTP 301 (redirecionamento permanente) com o header \`Location\` apontando para a versao HTTPS da URL.

### HSTS (HTTP Strict Transport Security)
Alem do redirecionamento, configure o header HSTS para instruir navegadores a sempre usar HTTPS:

\`\`\`
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
\`\`\`

O plugin \`response-rewrite\` pode ser utilizado para adicionar este header automaticamente a todas as respostas.

> **Nota:** O HSTS so funciona apos a primeira visita HTTPS. Para protecao desde a primeira requisicao, considere registrar seu dominio na lista HSTS Preload dos navegadores.

### Comunicacao Gateway-Upstream
Alem de forcar HTTPS no lado do cliente, voce pode configurar o upstream para usar HTTPS na comunicacao entre o gateway e o servidor de destino. Configure o esquema \`https\` no upstream e, se necessario, desabilite a verificacao de certificado para upstreams com certificados self-signed.`,
        },
        {
          id: "monitoramento-validade",
          title: "Monitoramento de Validade",
          body: `Certificados SSL expirados causam interrupcoes severas — navegadores e clientes rejeitam conexoes com certificados invalidos. O FuseOne monitora a validade dos seus certificados e alerta antes da expiracao.

### Dashboard de Certificados
A pagina **Configuracoes > SSL/TLS** exibe todos os certificados com:

- **Dominio(s)** — SNIs associados
- **Emissor** — Autoridade certificadora que emitiu o certificado
- **Valido ate** — Data de expiracao com indicador visual:
  - Verde: mais de 30 dias para expirar
  - Amarelo: menos de 30 dias para expirar
  - Vermelho: menos de 7 dias ou ja expirado

### Alertas Automaticos
O sistema envia alertas automaticos quando certificados estao proximos da expiracao:

- **30 dias antes** — Notificacao informativa (severidade baixa)
- **14 dias antes** — Notificacao de aviso (severidade media)
- **7 dias antes** — Notificacao urgente (severidade alta)
- **Expirado** — Notificacao critica diaria ate que o certificado seja renovado

As notificacoes sao enviadas pelos canais configurados em **Configuracoes > Notificacoes**.

> **Dica:** Para evitar preocupacoes com expiracao, considere usar certificados de provedores que oferecem renovacao automatica via ACME/Let's Encrypt. O gateway pode ser configurado para suportar renovacao automatica em ambientes compativeis.`,
        },
      ],
    },

    // ── 3. Protecao contra Ameacas ──────────────────────────────────────
    {
      slug: "protecao-apis",
      title: "Protecao contra Ameacas",
      description:
        "IP restriction, CORS, CSRF, limitacao de body, protecao contra SQL injection e mascaramento de dados.",
      icon: "ShieldAlert",
      tags: ["ip-restriction", "cors", "threat-protection", "data-masking"],
      content: [
        {
          id: "ip-restriction",
          title: "Restricao por IP",
          body: `O plugin \`ip-restriction\` permite controlar quais enderecos IP podem acessar suas rotas. Voce pode configurar listas de permissao (whitelist) ou bloqueio (blacklist).

### Whitelist (Lista de Permissao)
Apenas os IPs listados podem acessar a rota. Todos os demais sao bloqueados com HTTP 403:

\`\`\`json
{
  "whitelist": [
    "10.0.0.0/8",
    "192.168.1.100",
    "203.0.113.0/24"
  ]
}
\`\`\`

### Blacklist (Lista de Bloqueio)
Todos os IPs podem acessar, exceto os listados:

\`\`\`json
{
  "blacklist": [
    "198.51.100.0/24",
    "203.0.113.50"
  ]
}
\`\`\`

Formatos suportados:

- IP individual: \`192.168.1.100\`
- CIDR: \`10.0.0.0/8\`
- IPv6: \`::1\`, \`fe80::/10\`

> **Nota:** Quando o gateway esta atras de um load balancer ou CDN, certifique-se de configurar o header \`X-Forwarded-For\` ou \`X-Real-IP\` corretamente para que o IP real do cliente seja utilizado na restricao, e nao o IP do load balancer.

Use whitelist para APIs internas que devem ser acessiveis apenas de redes confiavies. Use blacklist para bloquear IPs conhecidos como maliciosos.`,
        },
        {
          id: "cors-csrf",
          title: "CORS e CSRF",
          body: `### CORS (Cross-Origin Resource Sharing)
O plugin \`cors\` configura os headers necessarios para permitir que aplicacoes web em um dominio acessem APIs em outro dominio. Sem CORS configurado, navegadores bloqueiam requisicoes cross-origin.

Configuracao tipica:

\`\`\`json
{
  "allow_origins": "https://app.exemplo.com",
  "allow_methods": "GET, POST, PUT, DELETE, OPTIONS",
  "allow_headers": "Authorization, Content-Type",
  "expose_headers": "X-Request-Id",
  "max_age": 3600,
  "allow_credential": true
}
\`\`\`

Campos importantes:

- \`allow_origins\` — Dominios permitidos (use \`*\` apenas em desenvolvimento)
- \`allow_methods\` — Metodos HTTP permitidos
- \`allow_headers\` — Headers que o cliente pode enviar
- \`allow_credential\` — Permite envio de cookies cross-origin

### CSRF (Cross-Site Request Forgery)
O plugin \`csrf\` protege contra ataques CSRF gerando e validando tokens anti-falsificacao. Ele e especialmente importante para APIs que aceitam requisicoes de navegadores com cookies de sessao.

O plugin injeta um token CSRF em um cookie e valida que requisicoes POST/PUT/DELETE incluam esse token em um header customizado.

> **Atencao:** Nunca use \`allow_origins: "*"\` com \`allow_credential: true\` em producao. Essa combinacao e insegura e bloqueada pelos navegadores. Sempre especifique os dominios permitidos explicitamente.`,
        },
        {
          id: "threat-protection",
          title: "Protecao contra Ameacas",
          body: `O API Gateway oferece plugins dedicados para proteger suas APIs contra ameacas comuns:

### URI Blocker
O plugin \`uri-blocker\` bloqueia requisicoes para URIs que correspondam a padroes perigosos:

\`\`\`json
{
  "block_rules": [
    "/admin",
    "/.env",
    "/wp-admin",
    "\\\\.sql$"
  ]
}
\`\`\`

Util para bloquear tentativas de acesso a recursos administrativos, arquivos sensiveis ou caminhos conhecidos de ataques automatizados.

### Limitacao de Tamanho do Body
Configure o tamanho maximo do corpo da requisicao para prevenir ataques de payload excessivamente grande (denial of service):

O plugin \`request-body-limit\` rejeita requisicoes cujo body exceda o limite configurado (ex: 10 MB) com HTTP 413 Payload Too Large.

### Protecao contra SQL Injection
O plugin de inspecao de payload analisa parametros de query string e body em busca de padroes comuns de SQL injection, como:

- Instrucoes SQL (\`SELECT\`, \`UNION\`, \`DROP\`, \`DELETE\`)
- Comentarios SQL (\`--\`, \`/**/\`)
- Caracteres especiais em contextos suspeitos (\`' OR 1=1\`)

> **Nota:** A protecao contra SQL injection no gateway e uma camada adicional de defesa. Ela nao substitui boas praticas no backend como prepared statements e validacao de entrada.

Combine multiplas camadas de protecao para uma defesa em profundidade eficaz.`,
        },
        {
          id: "data-masking",
          title: "Mascaramento de Dados (Data Masking)",
          body: `O plugin \`data-mask\` permite redatar informacoes sensiveis (PII — Personally Identifiable Information) nas respostas das suas APIs antes de envia-las ao cliente. Isso e util para cumprir regulamentacoes como LGPD e GDPR.

### Como Funciona
O plugin intercepta a resposta do upstream e aplica regras de mascaramento antes de enviar ao cliente:

1. Analisa o body da resposta (JSON)
2. Identifica campos que correspondem as regras configuradas
3. Substitui os valores por versoes mascaradas
4. Envia a resposta modificada ao cliente

### Configuracao de Regras
Defina quais campos devem ser mascarados e como:

\`\`\`json
{
  "rules": [
    {
      "path": "$.cpf",
      "type": "partial",
      "show_last": 3,
      "char": "*"
    },
    {
      "path": "$.email",
      "type": "partial",
      "show_first": 2,
      "show_last": 0,
      "char": "*"
    },
    {
      "path": "$.credit_card",
      "type": "full",
      "replacement": "****"
    }
  ]
}
\`\`\`

Neste exemplo:

- CPF \`123.456.789-09\` seria exibido como \`*********-09\`
- Email \`usuario@email.com\` seria exibido como \`us*************\`
- Cartao de credito seria completamente substituido por \`****\`

### Tipos de Mascaramento
- **partial** — Mascara parte do valor, preservando inicio e/ou fim
- **full** — Substitui o valor inteiro por uma string fixa
- **hash** — Substitui por um hash irreversivel (util para correlacao sem exposicao)

> **Dica:** O mascaramento pode ser aplicado condicionalmente com base no consumer. Por exemplo, consumidores internos veem os dados completos, enquanto consumidores externos recebem dados mascarados. Configure isso combinando \`data-mask\` com \`consumer-restriction\`.`,
        },
      ],
    },

    // ── 4. Gerenciamento de Secrets ─────────────────────────────────────
    {
      slug: "secrets-management",
      title: "Gerenciamento de Secrets",
      description:
        "Armazene credenciais com seguranca e referencie-as nas configuracoes de plugins.",
      icon: "KeySquare",
      tags: ["secrets", "credenciais", "seguranca"],
      content: [
        {
          id: "o-que-sao-secrets",
          title: "O que sao Secrets",
          body: `Secrets sao credenciais e valores sensiveis que precisam ser utilizados nas configuracoes de plugins mas nao devem ser armazenados em texto plano. Exemplos comuns incluem:

- Chaves de API de provedores de IA (OpenAI, Anthropic, etc.)
- Credenciais de autenticacao de upstreams
- Tokens de acesso a servicos externos
- Chaves de assinatura JWT
- Senhas de banco de dados para plugins que acessam dados

O gerenciador de secrets do FuseOne permite armazenar esses valores de forma segura e referencia-los nas configuracoes de plugins usando a sintaxe \`\${{secrets.NOME_DA_SECRET}}\`. No momento da execucao, o gateway substitui a referencia pelo valor real da secret.

### Beneficios
- **Seguranca** — Secrets sao encriptadas em repouso e em transito
- **Auditoria** — Todas as operacoes em secrets sao registradas no log de auditoria
- **Rotacao** — Atualize o valor de uma secret sem reconfigurar os plugins que a utilizam
- **Separacao de responsabilidades** — Desenvolvedores configuram plugins sem acesso aos valores reais

> **Nota:** Mesmo administradores nao podem visualizar o valor de uma secret apos criacao. A interface mostra apenas os metadados (nome, descricao, data de criacao).`,
        },
        {
          id: "criando-secrets",
          title: "Criando e Gerenciando Secrets",
          body: `Para gerenciar secrets, acesse **Configuracoes > Secrets**. A pagina exibe todas as secrets cadastradas com nome, descricao e data da ultima atualizacao.

### Criando uma Secret
Clique em **Nova Secret** e preencha:

- **Nome** — Identificador unico em UPPER_SNAKE_CASE (ex: \`OPENAI_API_KEY\`, \`UPSTREAM_DB_PASSWORD\`)
- **Valor** — O conteudo sensivel da secret
- **Descricao** — Texto descritivo para identificar o proposito da secret (opcional)

Apos salvar, o valor nao pode mais ser visualizado — apenas atualizado.

### Atualizando uma Secret
Clique na secret e selecione **Atualizar Valor**. Digite o novo valor e confirme. A atualizacao e propagada automaticamente para todos os plugins que referenciam essa secret.

### Removendo uma Secret
Antes de remover uma secret, verifique se ela nao esta sendo referenciada por nenhum plugin. O FuseOne exibe um aviso se detectar referencias existentes, mas a remocao nao e bloqueada — plugins que referenciam uma secret removida recebem um erro na execucao.

> **Atencao:** A remocao de uma secret e irreversivel. Certifique-se de que nenhuma rota ativa depende dela antes de proceder.

### Referenciando Secrets
Use a sintaxe de referencia nos campos de configuracao de plugins:

\`\`\`json
{
  "api_key": "\${{secrets.OPENAI_API_KEY}}",
  "webhook_url": "\${{secrets.SLACK_WEBHOOK_URL}}"
}
\`\`\``,
        },
        {
          id: "backends-secrets",
          title: "Backends de Secrets",
          body: `O FuseOne suporta diferentes backends para armazenamento de secrets, permitindo integrar com a infraestrutura de gerenciamento de credenciais que voce ja utiliza.

### Backend Interno (Padrao)
As secrets sao armazenadas no banco de dados do FuseOne, encriptadas com AES-256-GCM. A chave de encriptacao e derivada da configuracao do servidor. Este e o backend padrao e nao requer configuracao adicional.

### HashiCorp Vault
Integre com o HashiCorp Vault para gerenciamento centralizado de secrets:

- Configure a URL do Vault e o metodo de autenticacao em **Configuracoes > Secrets > Backend**
- As secrets sao lidas diretamente do Vault no momento da execucao
- Suporta autenticacao via Token, AppRole e Kubernetes

### AWS Secrets Manager
Integre com o AWS Secrets Manager para ambientes AWS:

- Configure a regiao e credenciais de acesso
- As secrets sao referenciadas pelo ARN ou nome no AWS Secrets Manager
- Suporta rotacao automatica de secrets via AWS

### Variaveis de Ambiente
Para cenarios simples, secrets podem ser injetadas via variaveis de ambiente do servidor:

- Defina a variavel no ambiente onde o gateway executa
- Referencie com a sintaxe \`$ENV.NOME_DA_VARIAVEL\`

> **Dica:** Para ambientes de producao com requisitos de compliance, recomendamos o uso do HashiCorp Vault ou AWS Secrets Manager, que oferecem rotacao automatica, auditoria detalhada e controle de acesso granular.`,
        },
        {
          id: "boas-praticas-secrets",
          title: "Boas Praticas",
          body: `Siga estas recomendacoes para gerenciar secrets de forma segura no FuseOne:

### Nomenclatura Consistente
Adote uma convencao de nomes clara e consistente para suas secrets:

- Use UPPER_SNAKE_CASE: \`OPENAI_API_KEY\`, \`DB_PASSWORD\`
- Inclua o contexto no nome: \`PROD_STRIPE_SECRET\`, \`DEV_SMTP_PASSWORD\`
- Agrupe por provedor ou servico: \`AWS_ACCESS_KEY\`, \`AWS_SECRET_KEY\`

### Rotacao Regular
Estabeleca uma politica de rotacao de secrets:

- **Chaves de API** — Rotacione a cada 90 dias
- **Senhas de banco** — Rotacione a cada 60 dias
- **Tokens de servico** — Rotacione a cada 30 dias
- **Apos incidentes** — Rotacione imediatamente todas as secrets que possam ter sido comprometidas

### Principio do Menor Privilegio
- Crie secrets especificas para cada ambiente (dev, staging, producao)
- Nao compartilhe a mesma secret entre ambientes diferentes
- Limite o acesso ao gerenciamento de secrets apenas a roles que realmente necessitam

### Monitoramento
- Revise periodicamente o log de auditoria para detectar acessos nao autorizados a secrets
- Configure alertas para operacoes sensiveis (criacao, atualizacao, remocao de secrets)
- Monitore tentativas de acesso a secrets inexistentes (pode indicar tentativa de ataque)

> **Atencao:** Nunca armazene secrets em codigo-fonte, arquivos de configuracao versionados ou variaveis de ambiente expostas em logs. Sempre utilize o gerenciador de secrets do FuseOne ou um backend externo dedicado.`,
        },
      ],
    },
  ],
}
