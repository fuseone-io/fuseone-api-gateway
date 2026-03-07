import type { DocCategory } from "./types"

export const segurancaCategory: DocCategory = {
  slug: "seguranca",
  title: "Segurança",
  description:
    "Proteja suas APIs com autenticação, SSL, proteção contra ameaças e gerenciamento seguro de credenciais.",
  icon: "Shield",
  articles: [
    // ── 1. Autenticação de APIs ─────────────────────────────────────────
    {
      slug: "autenticacao-apis",
      title: "Autenticação de APIs",
      description:
        "Métodos de autenticação disponíveis, quando usar cada um e como combinar com políticas baseadas em consumers.",
      icon: "KeyRound",
      tags: ["autenticação", "jwt", "api-key", "oauth"],
      content: [
        {
          id: "visao-geral-auth",
          title: "Visão Geral",
          body: `O API Gateway oferece múltiplos métodos de autenticação que podem ser aplicados individualmente ou combinados em cada rota. A autenticação é feita via plugins, permitindo flexibilidade total na configuração.

Quando uma requisição chega ao gateway, o plugin de autenticação:

1. Extrai a credencial da requisição (header, query param, cookie, etc.)
2. Valida a credencial contra o provedor configurado
3. Identifica o **consumer** associado à credencial
4. Permite ou rejeita a requisição com base na validação

A identificação do consumer é fundamental porque permite aplicar políticas diferenciadas por cliente: rate limits, cotas, permissões de acesso e tracking de métricas.

> **Nota:** Você pode habilitar múltiplos plugins de autenticação na mesma rota. Neste caso, a requisição é aceita se **qualquer um** dos métodos validar com sucesso (lógica OR). Para exigir múltiplos métodos simultaneamente, use o plugin \`consumer-restriction\`.`,
        },
        {
          id: "api-key",
          title: "API Key",
          body: `A autenticação por API Key é o método mais simples e amplamente utilizado. Cada consumer recebe uma chave única que deve ser enviada em todas as requisições.

### Como Funciona
O consumer envia a chave no header \`apikey\` (padrão) ou em outro local configurável:

\`\`\`
GET /api/v1/produtos HTTP/1.1
Host: api.exemplo.com
apikey: sua-chave-aqui-abc123
\`\`\`

### Quando Usar
- APIs internas entre serviços (service-to-service)
- Integração com parceiros de confiança
- Cenários simples onde não é necessário login interativo
- Prototipação e desenvolvimento

### Configuração
No plugin \`key-auth\`, você pode configurar:

- \`header\` — Nome do header que contém a chave (padrão: \`apikey\`)
- \`query\` — Alternativamente, aceitar a chave como query parameter
- \`hide_credentials\` — Remover a chave antes de encaminhar ao upstream (recomendado)

> **Dica:** Sempre habilite \`hide_credentials\` para evitar que a chave de API seja enviada ao servidor de destino. Isso reduz o risco de vazamento em logs do upstream.`,
        },
        {
          id: "jwt-auth",
          title: "JWT (JSON Web Token)",
          body: `A autenticação JWT permite validar tokens assinados sem necessidade de consultar um servidor de autorização em cada requisição. O gateway verifica a assinatura e as claims do token localmente.

### Como Funciona
1. O cliente obtém um JWT do seu servidor de autorização (IdP)
2. Envia o token no header \`Authorization: Bearer <token>\`
3. O gateway valida a assinatura usando a chave pública/secret configurada
4. Extrai as claims do token para identificar o consumer

### Quando Usar
- APIs públicas com autenticação de usuários
- Microsserviços que já utilizam JWT internamente
- Cenários que exigem informações adicionais no token (roles, scopes, etc.)
- Integração com provedores OAuth2/OpenID Connect

### Configuração
O plugin \`jwt-auth\` suporta:

- \`algorithm\` — Algoritmo de assinatura: HS256, HS384, HS512, RS256, RS384, RS512, ES256, ES384, ES512
- \`secret\` / \`public_key\` — Chave para verificação da assinatura
- \`claims_to_verify\` — Claims obrigatórias (ex: \`exp\`, \`nbf\`)
- \`consumer_claim\` — Claim usada para identificar o consumer (padrão: \`sub\`)

> **Atenção:** Para algoritmos RS* e ES* (assimétricos), configure apenas a chave pública no gateway. Nunca armazene a chave privada no API Gateway.`,
        },
        {
          id: "outros-metodos",
          title: "Outros Métodos de Autenticação",
          body: `Além de API Key e JWT, o API Gateway suporta os seguintes métodos:

### Basic Auth
Autenticação HTTP básica com usuário e senha. Simples, porém menos seguro — use apenas sobre HTTPS. Configurável via plugin \`basic-auth\`.

### HMAC Auth
Autenticação baseada em assinatura HMAC do request. Cada requisição é assinada com uma chave secreta, garantindo integridade e autenticidade. Ideal para APIs que precisam de non-repudiation.

### OpenID Connect
Integre com provedores de identidade compatíveis com OIDC (Keycloak, Auth0, Azure AD, Google). O gateway realiza a validação do token diretamente com o provedor. Suporta fluxos Authorization Code, Implicit e Client Credentials.

### Forward Auth
Delega a decisão de autenticação para um serviço externo. O gateway envia um request ao serviço de auth e, com base na resposta (2xx = permitido, 4xx = negado), aceita ou rejeita a requisição original. Útil para lógica de autorização customizada.

### LDAP
Valida credenciais contra um servidor LDAP/Active Directory. Ideal para integração com diretório corporativo existente.

> **Dica:** Para cenários corporativos complexos, combine OpenID Connect (autenticação) com \`consumer-restriction\` (autorização) para controle granular de acesso baseado em groups e scopes do token.

Cada método possui trade-offs entre simplicidade, segurança e flexibilidade. Escolha com base nos requisitos do seu cenário específico.`,
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
          body: `O API Gateway gerencia certificados SSL/TLS para terminar conexões HTTPS nas rotas configuradas. A terminação SSL no gateway centraliza o gerenciamento de certificados e simplifica a configuração dos upstreams.

Para adicionar um certificado, acesse **Configurações > SSL/TLS > Certificados** e clique em **Novo Certificado**. Você precisará fornecer:

- **Certificado (PEM)** — O certificado público no formato PEM (inclua a cadeia completa se necessário)
- **Chave privada (PEM)** — A chave privada correspondente no formato PEM
- **SNIs** — Lista de Server Name Indications (domínios) que utilizarão este certificado

Exemplo de upload via interface:

1. Cole o conteúdo do certificado (incluindo \`-----BEGIN CERTIFICATE-----\` e \`-----END CERTIFICATE-----\`)
2. Cole a chave privada
3. Adicione os domínios: \`api.exemplo.com\`, \`*.exemplo.com\` (wildcards são suportados)

> **Atenção:** A chave privada é armazenada de forma segura e encriptada. Mesmo assim, limite o acesso ao gerenciamento de certificados apenas a administradores de confiança via permissões RBAC.`,
        },
        {
          id: "sni-configuracao",
          title: "SNI e Múltiplos Domínios",
          body: `O Server Name Indication (SNI) permite que o API Gateway sirva certificados diferentes para domínios diferentes na mesma porta (443). Isso é essencial quando você gerencia múltiplas APIs em domínios distintos.

### Como o SNI Funciona
Quando o cliente inicia uma conexão TLS, ele envia o nome do servidor (hostname) no handshake. O gateway usa essa informação para selecionar o certificado correto antes de completar a conexão.

### Configuração de SNI
Cada certificado pode estar associado a um ou mais SNIs:

- **Domínio exato** — \`api.exemplo.com\` (corresponde apenas a este domínio)
- **Wildcard** — \`*.exemplo.com\` (corresponde a qualquer subdomínio de exemplo.com)

Prioridade de resolução:

1. Domínio exato tem prioridade sobre wildcard
2. Se nenhum certificado corresponder ao SNI solicitado, o gateway usa o certificado padrão (se configurado) ou rejeita a conexão

### Certificados por Ambiente
Uma prática comum é usar certificados diferentes para cada ambiente:

- \`api.dev.exemplo.com\` — Certificado de desenvolvimento (pode ser self-signed)
- \`api.staging.exemplo.com\` — Certificado de staging
- \`api.exemplo.com\` — Certificado de produção (emitido por CA pública)

> **Dica:** Para simplificar o gerenciamento, use certificados wildcard (\`*.exemplo.com\`) quando possível. Isso reduz o número de certificados a gerenciar e renovar.`,
        },
        {
          id: "forcando-https",
          title: "Forçando HTTPS",
          body: `É uma prática de segurança essencial forçar o uso de HTTPS em todas as rotas de produção. O API Gateway oferece duas abordagens para garantir que clientes não acessem APIs via HTTP inseguro:

### Redirecionamento HTTP para HTTPS
Configure o gateway para redirecionar automaticamente requisições HTTP (porta 80) para HTTPS (porta 443):

O plugin \`redirect\` pode ser configurado na rota com:

\`\`\`json
{
  "http_to_https": true,
  "ret_code": 301
}
\`\`\`

Isso retorna um HTTP 301 (redirecionamento permanente) com o header \`Location\` apontando para a versão HTTPS da URL.

### HSTS (HTTP Strict Transport Security)
Além do redirecionamento, configure o header HSTS para instruir navegadores a sempre usar HTTPS:

\`\`\`
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
\`\`\`

O plugin \`response-rewrite\` pode ser utilizado para adicionar este header automaticamente a todas as respostas.

> **Nota:** O HSTS só funciona após a primeira visita HTTPS. Para proteção desde a primeira requisição, considere registrar seu domínio na lista HSTS Preload dos navegadores.

### Comunicação Gateway-Upstream
Além de forçar HTTPS no lado do cliente, você pode configurar o upstream para usar HTTPS na comunicação entre o gateway e o servidor de destino. Configure o esquema \`https\` no upstream e, se necessário, desabilite a verificação de certificado para upstreams com certificados self-signed.`,
        },
        {
          id: "monitoramento-validade",
          title: "Monitoramento de Validade",
          body: `Certificados SSL expirados causam interrupções severas — navegadores e clientes rejeitam conexões com certificados inválidos. O FuseOne monitora a validade dos seus certificados e alerta antes da expiração.

### Dashboard de Certificados
A página **Configurações > SSL/TLS** exibe todos os certificados com:

- **Domínio(s)** — SNIs associados
- **Emissor** — Autoridade certificadora que emitiu o certificado
- **Válido até** — Data de expiração com indicador visual:
  - Verde: mais de 30 dias para expirar
  - Amarelo: menos de 30 dias para expirar
  - Vermelho: menos de 7 dias ou já expirado

### Alertas Automáticos
O sistema envia alertas automáticos quando certificados estão próximos da expiração:

- **30 dias antes** — Notificação informativa (severidade baixa)
- **14 dias antes** — Notificação de aviso (severidade média)
- **7 dias antes** — Notificação urgente (severidade alta)
- **Expirado** — Notificação crítica diária até que o certificado seja renovado

As notificações são enviadas pelos canais configurados em **Configurações > Notificações**.

> **Dica:** Para evitar preocupações com expiração, considere usar certificados de provedores que oferecem renovação automática via ACME/Let's Encrypt. O gateway pode ser configurado para suportar renovação automática em ambientes compatíveis.`,
        },
      ],
    },

    // ── 3. Proteção contra Ameaças ──────────────────────────────────────
    {
      slug: "protecao-apis",
      title: "Proteção contra Ameaças",
      description:
        "IP restriction, CORS, CSRF, limitação de body, proteção contra SQL injection e mascaramento de dados.",
      icon: "ShieldAlert",
      tags: ["ip-restriction", "cors", "threat-protection", "data-masking"],
      content: [
        {
          id: "ip-restriction",
          title: "Restrição por IP",
          body: `O plugin \`ip-restriction\` permite controlar quais endereços IP podem acessar suas rotas. Você pode configurar listas de permissão (whitelist) ou bloqueio (blacklist).

### Whitelist (Lista de Permissão)
Apenas os IPs listados podem acessar a rota. Todos os demais são bloqueados com HTTP 403:

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

> **Nota:** Quando o gateway está atrás de um load balancer ou CDN, certifique-se de configurar o header \`X-Forwarded-For\` ou \`X-Real-IP\` corretamente para que o IP real do cliente seja utilizado na restrição, e não o IP do load balancer.

Use whitelist para APIs internas que devem ser acessíveis apenas de redes confiáveis. Use blacklist para bloquear IPs conhecidos como maliciosos.`,
        },
        {
          id: "cors-csrf",
          title: "CORS e CSRF",
          body: `### CORS (Cross-Origin Resource Sharing)
O plugin \`cors\` configura os headers necessários para permitir que aplicações web em um domínio acessem APIs em outro domínio. Sem CORS configurado, navegadores bloqueiam requisições cross-origin.

Configuração típica:

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

- \`allow_origins\` — Domínios permitidos (use \`*\` apenas em desenvolvimento)
- \`allow_methods\` — Métodos HTTP permitidos
- \`allow_headers\` — Headers que o cliente pode enviar
- \`allow_credential\` — Permite envio de cookies cross-origin

### CSRF (Cross-Site Request Forgery)
O plugin \`csrf\` protege contra ataques CSRF gerando e validando tokens anti-falsificação. Ele é especialmente importante para APIs que aceitam requisições de navegadores com cookies de sessão.

O plugin injeta um token CSRF em um cookie e valida que requisições POST/PUT/DELETE incluam esse token em um header customizado.

> **Atenção:** Nunca use \`allow_origins: "*"\` com \`allow_credential: true\` em produção. Essa combinação é insegura e bloqueada pelos navegadores. Sempre especifique os domínios permitidos explicitamente.`,
        },
        {
          id: "threat-protection",
          title: "Proteção contra Ameaças",
          body: `O API Gateway oferece plugins dedicados para proteger suas APIs contra ameaças comuns:

### URI Blocker
O plugin \`uri-blocker\` bloqueia requisições para URIs que correspondam a padrões perigosos:

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

Útil para bloquear tentativas de acesso a recursos administrativos, arquivos sensíveis ou caminhos conhecidos de ataques automatizados.

### Limitação de Tamanho do Body
Configure o tamanho máximo do corpo da requisição para prevenir ataques de payload excessivamente grande (denial of service):

O plugin \`request-body-limit\` rejeita requisições cujo body exceda o limite configurado (ex: 10 MB) com HTTP 413 Payload Too Large.

### Proteção contra SQL Injection
O plugin de inspeção de payload analisa parâmetros de query string e body em busca de padrões comuns de SQL injection, como:

- Instruções SQL (\`SELECT\`, \`UNION\`, \`DROP\`, \`DELETE\`)
- Comentários SQL (\`--\`, \`/**/\`)
- Caracteres especiais em contextos suspeitos (\`' OR 1=1\`)

> **Nota:** A proteção contra SQL injection no gateway é uma camada adicional de defesa. Ela não substitui boas práticas no backend como prepared statements e validação de entrada.

Combine múltiplas camadas de proteção para uma defesa em profundidade eficaz.`,
        },
        {
          id: "data-masking",
          title: "Mascaramento de Dados (Data Masking)",
          body: `O plugin \`data-mask\` permite redatar informações sensíveis (PII — Personally Identifiable Information) nas respostas das suas APIs antes de enviá-las ao cliente. Isso é útil para cumprir regulamentações como LGPD e GDPR.

### Como Funciona
O plugin intercepta a resposta do upstream e aplica regras de mascaramento antes de enviar ao cliente:

1. Analisa o body da resposta (JSON)
2. Identifica campos que correspondem às regras configuradas
3. Substitui os valores por versões mascaradas
4. Envia a resposta modificada ao cliente

### Configuração de Regras
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
- Cartão de crédito seria completamente substituído por \`****\`

### Tipos de Mascaramento
- **partial** — Mascara parte do valor, preservando início e/ou fim
- **full** — Substitui o valor inteiro por uma string fixa
- **hash** — Substitui por um hash irreversível (útil para correlação sem exposição)

> **Dica:** O mascaramento pode ser aplicado condicionalmente com base no consumer. Por exemplo, consumidores internos veem os dados completos, enquanto consumidores externos recebem dados mascarados. Configure isso combinando \`data-mask\` com \`consumer-restriction\`.`,
        },
      ],
    },

    // ── 4. Gerenciamento de Secrets ─────────────────────────────────────
    {
      slug: "secrets-management",
      title: "Gerenciamento de Secrets",
      description:
        "Armazene credenciais com segurança e referencie-as nas configurações de plugins.",
      icon: "KeySquare",
      tags: ["secrets", "credenciais", "segurança"],
      content: [
        {
          id: "o-que-sao-secrets",
          title: "O que são Secrets",
          body: `Secrets são credenciais e valores sensíveis que precisam ser utilizados nas configurações de plugins mas não devem ser armazenados em texto plano. Exemplos comuns incluem:

- Chaves de API de provedores de IA (OpenAI, Anthropic, etc.)
- Credenciais de autenticação de upstreams
- Tokens de acesso a serviços externos
- Chaves de assinatura JWT
- Senhas de banco de dados para plugins que acessam dados

O gerenciador de secrets do FuseOne permite armazenar esses valores de forma segura e referenciá-los nas configurações de plugins usando a sintaxe \`\${{secrets.NOME_DA_SECRET}}\`. No momento da execução, o gateway substitui a referência pelo valor real da secret.

### Benefícios
- **Segurança** — Secrets são encriptadas em repouso e em trânsito
- **Auditoria** — Todas as operações em secrets são registradas no log de auditoria
- **Rotação** — Atualize o valor de uma secret sem reconfigurar os plugins que a utilizam
- **Separação de responsabilidades** — Desenvolvedores configuram plugins sem acesso aos valores reais

> **Nota:** Mesmo administradores não podem visualizar o valor de uma secret após criação. A interface mostra apenas os metadados (nome, descrição, data de criação).`,
        },
        {
          id: "criando-secrets",
          title: "Criando e Gerenciando Secrets",
          body: `Para gerenciar secrets, acesse **Configurações > Secrets**. A página exibe todas as secrets cadastradas com nome, descrição e data da última atualização.

### Criando uma Secret
Clique em **Nova Secret** e preencha:

- **Nome** — Identificador único em UPPER_SNAKE_CASE (ex: \`OPENAI_API_KEY\`, \`UPSTREAM_DB_PASSWORD\`)
- **Valor** — O conteúdo sensível da secret
- **Descrição** — Texto descritivo para identificar o propósito da secret (opcional)

Após salvar, o valor não pode mais ser visualizado — apenas atualizado.

### Atualizando uma Secret
Clique na secret e selecione **Atualizar Valor**. Digite o novo valor e confirme. A atualização é propagada automaticamente para todos os plugins que referenciam essa secret.

### Removendo uma Secret
Antes de remover uma secret, verifique se ela não está sendo referenciada por nenhum plugin. O FuseOne exibe um aviso se detectar referências existentes, mas a remoção não é bloqueada — plugins que referenciam uma secret removida recebem um erro na execução.

> **Atenção:** A remoção de uma secret é irreversível. Certifique-se de que nenhuma rota ativa depende dela antes de proceder.

### Referenciando Secrets
Use a sintaxe de referência nos campos de configuração de plugins:

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
          body: `O FuseOne suporta diferentes backends para armazenamento de secrets, permitindo integrar com a infraestrutura de gerenciamento de credenciais que você já utiliza.

### Backend Interno (Padrão)
As secrets são armazenadas no banco de dados do FuseOne, encriptadas com AES-256-GCM. A chave de encriptação é derivada da configuração do servidor. Este é o backend padrão e não requer configuração adicional.

### HashiCorp Vault
Integre com o HashiCorp Vault para gerenciamento centralizado de secrets:

- Configure a URL do Vault e o método de autenticação em **Configurações > Secrets > Backend**
- As secrets são lidas diretamente do Vault no momento da execução
- Suporta autenticação via Token, AppRole e Kubernetes

### AWS Secrets Manager
Integre com o AWS Secrets Manager para ambientes AWS:

- Configure a região e credenciais de acesso
- As secrets são referenciadas pelo ARN ou nome no AWS Secrets Manager
- Suporta rotação automática de secrets via AWS

### Variáveis de Ambiente
Para cenários simples, secrets podem ser injetadas via variáveis de ambiente do servidor:

- Defina a variável no ambiente onde o gateway executa
- Referencie com a sintaxe \`$ENV.NOME_DA_VARIAVEL\`

> **Dica:** Para ambientes de produção com requisitos de compliance, recomendamos o uso do HashiCorp Vault ou AWS Secrets Manager, que oferecem rotação automática, auditoria detalhada e controle de acesso granular.`,
        },
        {
          id: "boas-praticas-secrets",
          title: "Boas Práticas",
          body: `Siga estas recomendações para gerenciar secrets de forma segura no FuseOne:

### Nomenclatura Consistente
Adote uma convenção de nomes clara e consistente para suas secrets:

- Use UPPER_SNAKE_CASE: \`OPENAI_API_KEY\`, \`DB_PASSWORD\`
- Inclua o contexto no nome: \`PROD_STRIPE_SECRET\`, \`DEV_SMTP_PASSWORD\`
- Agrupe por provedor ou serviço: \`AWS_ACCESS_KEY\`, \`AWS_SECRET_KEY\`

### Rotação Regular
Estabeleça uma política de rotação de secrets:

- **Chaves de API** — Rotacione a cada 90 dias
- **Senhas de banco** — Rotacione a cada 60 dias
- **Tokens de serviço** — Rotacione a cada 30 dias
- **Após incidentes** — Rotacione imediatamente todas as secrets que possam ter sido comprometidas

### Princípio do Menor Privilégio
- Crie secrets específicas para cada ambiente (dev, staging, produção)
- Não compartilhe a mesma secret entre ambientes diferentes
- Limite o acesso ao gerenciamento de secrets apenas a roles que realmente necessitam

### Monitoramento
- Revise periodicamente o log de auditoria para detectar acessos não autorizados a secrets
- Configure alertas para operações sensíveis (criação, atualização, remoção de secrets)
- Monitore tentativas de acesso a secrets inexistentes (pode indicar tentativa de ataque)

> **Atenção:** Nunca armazene secrets em código-fonte, arquivos de configuração versionados ou variáveis de ambiente expostas em logs. Sempre utilize o gerenciador de secrets do FuseOne ou um backend externo dedicado.`,
        },
      ],
    },
  ],
}
