import type { DocCategory } from "./types"

export const referenciaPluginsCategory: DocCategory = {
  slug: "referencia-plugins",
  title: "Referência de Plugins",
  description:
    "Documentação detalhada de todos os plugins disponíveis no API Gateway, organizados por categoria.",
  icon: "BookOpen",
  articles: [
    // ── 1. Plugins de Autenticação ──────────────────────────────
    {
      slug: "plugins-autenticacao",
      title: "Plugins de Autenticação",
      description:
        "Controle quem pode acessar suas APIs com plugins de autenticação como key-auth, JWT, OAuth e mais.",
      icon: "KeyRound",
      tags: ["autenticação", "key-auth", "jwt", "oauth"],
      content: [
        {
          id: "visao-geral-autenticacao",
          title: "Visão Geral",
          body: `Os plugins de autenticação são a primeira linha de defesa das suas APIs. Eles validam a identidade do consumidor antes que a requisição alcance o upstream.

O API Gateway oferece diversas estratégias de autenticação que podem ser combinadas conforme a necessidade:

- **key-auth**: Autenticação por chave de API, ideal para integração entre sistemas
- **basic-auth**: Autenticação por usuário e senha (HTTP Basic)
- **jwt-auth**: Validação de tokens JWT, indicado para aplicações modernas
- **hmac-auth**: Assinatura HMAC para garantir integridade da requisição
- **openid-connect**: Integração com provedores OAuth 2.0 / OIDC (Keycloak, Auth0, etc.)
- **forward-auth**: Delegação da autenticação para um serviço externo
- **authz-keycloak**: Autorização baseada em recursos UMA do Keycloak
- **ldap-auth**: Autenticação contra diretórios LDAP/Active Directory
- **authz-casbin**: Controle de acesso baseado em políticas via Casbin
- **authz-casdoor**: Single sign-on via plataforma Casdoor
- **cas-auth**: Autenticação via Central Authentication Service (CAS)
- **wolf-rbac**: Controle de acesso baseado em roles via Wolf
- **opa**: Autorização via Open Policy Agent com políticas Rego

> **Dica:** Você pode habilitar mais de um plugin de autenticação na mesma rota. O API Gateway tentará cada um em ordem e aceitará o primeiro que for bem-sucedido.`,
          subsections: [
            {
              id: "key-auth",
              title: "key-auth",
              body: `O plugin **key-auth** autentica consumidores através de uma chave de API enviada no header, query string ou cookie.

**Quando usar:**
- Integração máquina-a-máquina (M2M)
- APIs internas que precisam de identificação simples do chamador
- Cenários onde você quer rastrear uso por consumidor sem complexidade de tokens

**Configuração:**

\`\`\`json
{
  "key": "minha-chave-secreta-123"
}
\`\`\`

O campo \`header\` define o nome do header onde a chave será enviada (padrão: \`apikey\`). O campo \`query\` permite receber a chave pela query string.

> **Nota:** Sempre utilize chaves longas e aleatórias. Evite chaves previsíveis como nomes de projetos ou sequências numéricas.

**Boas práticas:**
- Rotacione chaves periodicamente
- Use um \`consumer\` diferente para cada integração
- Combine com \`ip-restriction\` para defesa em profundidade
- Monitore o uso via logs para detectar chaves comprometidas`,
            },
            {
              id: "basic-auth",
              title: "basic-auth",
              body: `O plugin **basic-auth** implementa autenticação HTTP Basic (RFC 7617). O consumidor envia usuário e senha codificados em Base64 no header \`Authorization\`.

**Quando usar:**
- Acesso a APIs administrativas ou internas
- Integrações legadas que não suportam JWT ou OAuth
- Prototipagem rápida durante o desenvolvimento

**Configuração no consumidor:**

\`\`\`json
{
  "username": "meu-usuario",
  "password": "senha-segura-456"
}
\`\`\`

> **Atenção:** O basic-auth transmite credenciais codificadas em Base64 (não criptografadas). Sempre use HTTPS em produção para proteger as credenciais em trânsito.

**Boas práticas:**
- Nunca use basic-auth sem TLS/HTTPS
- Prefira senhas fortes com pelo menos 16 caracteres
- Considere migrar para jwt-auth ou openid-connect em produção`,
            },
            {
              id: "jwt-auth",
              title: "jwt-auth",
              body: `O plugin **jwt-auth** valida tokens JWT (JSON Web Token) presentes na requisição. Suporta algoritmos HS256, HS512, RS256 e ES256.

**Quando usar:**
- Aplicações web e mobile modernas
- Arquiteturas de microsserviços com autenticação centralizada
- Quando você precisa de claims customizadas no token (roles, permissões, etc.)

**Configuração no consumidor:**

\`\`\`json
{
  "key": "identificador-do-consumidor",
  "secret": "chave-secreta-para-hs256",
  "algorithm": "HS256",
  "exp": 86400
}
\`\`\`

Para RS256, configure o campo \`public_key\` com a chave pública em formato PEM. O campo \`exp\` define o tempo de expiração do token em segundos.

**Boas práticas:**
- Prefira RS256 em produção — a chave privada nunca precisa estar no gateway
- Defina tempos de expiração curtos (15-60 minutos) com refresh tokens
- Valide os claims \`iss\` e \`aud\` para prevenir uso indevido de tokens
- Use o campo \`claims_to_verify\` para validar claims obrigatórias`,
            },
            {
              id: "hmac-auth",
              title: "hmac-auth",
              body: `O plugin **hmac-auth** verifica a assinatura HMAC da requisição, garantindo tanto a identidade do chamador quanto a integridade dos dados transmitidos.

**Quando usar:**
- Webhooks que precisam de verificação de origem
- APIs financeiras ou de pagamento
- Integrações onde a integridade da mensagem é crítica

**Configuração no consumidor:**

\`\`\`json
{
  "access_key": "meu-access-key",
  "secret_key": "minha-chave-secreta",
  "algorithm": "hmac-sha256",
  "signed_headers": ["date", "content-type"]
}
\`\`\`

O cliente deve assinar os headers especificados em \`signed_headers\` usando a chave secreta e incluir a assinatura no header \`Authorization\`.

> **Nota:** O hmac-auth requer sincronização de relógios entre cliente e servidor. O campo \`clock_skew\` (padrão: 300 segundos) define a tolerância máxima.

**Boas práticas:**
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
- APIs públicas que exigem autenticação OAuth 2.0
- Cenários onde você já possui um Identity Provider (IdP)

**Configuração:**

\`\`\`json
{
  "client_id": "meu-client-id",
  "client_secret": "meu-client-secret",
  "discovery": "https://idp.exemplo.com/.well-known/openid-configuration",
  "scope": "openid profile email",
  "bearer_only": true
}
\`\`\`

Com \`bearer_only: true\`, o plugin apenas valida tokens Bearer existentes. Com \`bearer_only: false\`, ele redireciona usuários não autenticados para o fluxo de login do IdP.

> **Dica:** Use o endpoint de discovery para que o gateway busque automaticamente as chaves públicas, endpoints de token e configurações do IdP.

**Boas práticas:**
- Sempre use o endpoint de discovery em vez de configurar URLs manualmente
- Habilite \`set_userinfo_header\` para propagar informações do usuário ao upstream
- Configure \`introspection_endpoint\` para validação de tokens opacos
- Mantenha o \`client_secret\` em variáveis de ambiente, não no código`,
            },
            {
              id: "forward-auth",
              title: "forward-auth",
              body: `O plugin **forward-auth** delega a decisão de autenticação/autorização para um serviço HTTP externo. O gateway encaminha a requisição ao serviço de auth e, com base na resposta, permite ou bloqueia o acesso.

**Quando usar:**
- Lógica de autorização complexa que não cabe em plugins padrão
- Integrações com sistemas de autorização legados
- Cenários onde você precisa de verificações customizadas (ex: limites de conta, feature flags)

**Configuração:**

\`\`\`json
{
  "uri": "http://auth-service:8080/verify",
  "request_headers": ["Authorization", "X-Tenant-Id"],
  "upstream_headers": ["X-User-Id", "X-User-Role"],
  "request_method": "POST"
}
\`\`\`

O campo \`request_headers\` define quais headers são enviados ao serviço de auth. O campo \`upstream_headers\` define quais headers da resposta do serviço de auth são propagados ao upstream.

> **Nota:** Se o serviço de auth retornar status 2xx, a requisição é permitida. Qualquer outro status bloqueia a requisição e a resposta do serviço de auth é retornada ao cliente.

**Boas práticas:**
- Mantenha o serviço de auth próximo ao gateway (mesma rede) para minimizar latência
- Implemente timeouts curtos para evitar que falhas no auth travem as requisições
- Retorne headers informativos do serviço de auth para enriquecer o contexto do upstream`,
            },
            {
              id: "authz-keycloak",
              title: "authz-keycloak",
              body: `O plugin **authz-keycloak** integra o API Gateway com o Keycloak para autorização baseada em recursos (UMA 2.0). Além de validar o token, ele verifica se o usuário tem permissão para acessar o recurso específico.

**Quando usar:**
- Autorização granular baseada em recursos e escopos (não apenas roles)
- Cenários onde as permissões são gerenciadas no Keycloak como resources/policies
- Aplicações multitenante com políticas de acesso complexas

**Configuração:**

\`\`\`json
{
  "client_id": "api-gateway",
  "client_secret": "$secret://keycloak-client-secret",
  "discovery": "https://keycloak.exemplo.com/realms/meu-realm/.well-known/uma2-configuration",
  "policy_enforcement_mode": "ENFORCING",
  "permissions": ["resource-users#read", "resource-orders#write"],
  "lazy_load_paths": true
}
\`\`\`

O campo \`permissions\` define os recursos e escopos que o consumidor precisa ter. O \`policy_enforcement_mode\` pode ser \`ENFORCING\` (bloqueia sem permissão), \`PERMISSIVE\` (permite e loga) ou \`DISABLED\`.

> **Nota:** Este plugin é diferente do \`openid-connect\`. O OIDC apenas autentica (valida o token). O authz-keycloak vai além e autoriza (verifica permissões específicas no Keycloak).

**Boas práticas:**
- Habilite \`lazy_load_paths\` para carregar permissões sob demanda e melhorar performance
- Use escopos granulares (read, write, delete) em vez de apenas allow/deny
- Combine com \`consumer-restriction\` para múltiplas camadas de autorização`,
            },
            {
              id: "ldap-auth",
              title: "ldap-auth",
              body: `O plugin **ldap-auth** autentica consumidores contra um servidor LDAP ou Active Directory, utilizando bind simples com as credenciais fornecidas via HTTP Basic Auth.

**Quando usar:**
- Ambientes corporativos com Active Directory ou OpenLDAP
- APIs internas que devem usar as mesmas credenciais do domínio
- Cenários onde criar consumidores separados no gateway não é viável

**Configuração:**

\`\`\`json
{
  "ldap_uri": "ldaps://ldap.exemplo.com:636",
  "base_dn": "ou=users,dc=exemplo,dc=com",
  "uid": "sAMAccountName",
  "use_tls": true,
  "tls_verify": true
}
\`\`\`

O campo \`uid\` define o atributo LDAP usado para identificar o usuário (ex: \`sAMAccountName\` para AD, \`uid\` para OpenLDAP). O plugin faz um bind com as credenciais recebidas via HTTP Basic Auth.

> **Atenção:** Sempre use LDAPS (porta 636) ou StartTLS para proteger as credenciais em trânsito. Nunca use LDAP sem criptografia em produção.

**Boas práticas:**
- Configure \`tls_verify: true\` para validar o certificado do servidor LDAP
- Use um \`base_dn\` restrito para limitar a busca a uma OU específica
- Monitore falhas de autenticação para detectar tentativas de brute force`,
            },
            {
              id: "authz-casbin",
              title: "authz-casbin",
              body: `O plugin **authz-casbin** implementa controle de acesso baseado em políticas usando o modelo Casbin. Suporta RBAC, ABAC, ACL e modelos customizados definidos via configuração.

**Quando usar:**
- Políticas de autorização complexas que vão além de roles simples
- Modelos de controle de acesso customizados (ex: RBAC hierárquico, ABAC)
- Cenários onde as regras de acesso mudam frequentemente

**Configuração:**

\`\`\`json
{
  "model_path": "/path/to/model.conf",
  "policy_path": "/path/to/policy.csv",
  "username": "consumer_name"
}
\`\`\`

**Exemplo de modelo (RBAC):**

\`\`\`
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub, obj, act

[role_definition]
g = _, _

[matchers]
m = g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act
\`\`\`

**Exemplo de política:**

\`\`\`
p, admin, /api/*, GET
p, admin, /api/*, POST
p, viewer, /api/*, GET
g, alice, admin
g, bob, viewer
\`\`\`

> **Dica:** O Casbin suporta modelos avançados como RBAC com domínios (multitenante), ABAC com condições e herança de roles hierárquica.

**Boas práticas:**
- Comece com um modelo RBAC simples e evolua conforme a necessidade
- Teste as políticas em ambiente de desenvolvimento antes de produção
- Use o editor visual do Casbin (casbin.org/editor) para validar modelos`,
            },
            {
              id: "authz-casdoor",
              title: "authz-casdoor",
              body: `O plugin **authz-casdoor** integra o API Gateway com a plataforma de identidade Casdoor para Single Sign-On (SSO). O Casdoor é uma solução open-source de gerenciamento de identidade que suporta OAuth 2.0, OIDC e SAML.

**Quando usar:**
- Quando você utiliza o Casdoor como Identity Provider
- SSO corporativo com múltiplas aplicações
- Cenários onde você precisa de uma tela de login customizável

**Configuração:**

\`\`\`json
{
  "endpoint": "https://casdoor.exemplo.com",
  "client_id": "meu-client-id",
  "client_secret": "$secret://casdoor-client-secret",
  "callback_url": "https://api.exemplo.com/callback"
}
\`\`\`

O plugin redireciona usuários não autenticados para a tela de login do Casdoor. Após o login, o Casdoor redireciona de volta com um código de autorização que é trocado por um token.

**Boas práticas:**
- Configure o \`callback_url\` como uma rota no gateway que o plugin intercepta
- Use HTTPS tanto no gateway quanto no Casdoor
- Armazene o \`client_secret\` no gerenciador de segredos`,
            },
            {
              id: "cas-auth",
              title: "cas-auth",
              body: `O plugin **cas-auth** implementa autenticação via CAS (Central Authentication Service), um protocolo de SSO amplamente utilizado em universidades e organizações governamentais.

**Quando usar:**
- Ambientes acadêmicos ou governamentais que já usam CAS
- SSO com servidores CAS existentes (Apereo CAS, etc.)
- Integração com sistemas legados que dependem do protocolo CAS

**Configuração:**

\`\`\`json
{
  "idp_uri": "https://cas.exemplo.com/cas",
  "cas_callback_uri": "/cas/callback",
  "logout_uri": "/cas/logout"
}
\`\`\`

O fluxo segue o protocolo CAS padrão: (1) Usuário acessa a API, (2) Gateway redireciona para o servidor CAS, (3) Usuário faz login, (4) CAS redireciona de volta com um ticket, (5) Gateway valida o ticket no CAS.

**Boas práticas:**
- Configure \`logout_uri\` para permitir logout centralizado
- Valide sempre o ticket no backend (nunca confie apenas no redirect)
- Considere migrar para OIDC se estiver iniciando um novo projeto`,
            },
            {
              id: "wolf-rbac",
              title: "wolf-rbac",
              body: `O plugin **wolf-rbac** implementa controle de acesso baseado em roles (RBAC) através do servidor Wolf. O Wolf é um sistema leve de gerenciamento de permissões que combina autenticação e autorização.

**Quando usar:**
- Quando você utiliza o Wolf como sistema de gerenciamento de permissões
- Cenários que precisam de RBAC com interface de administração
- Aplicações que requerem controle de acesso por URL e método HTTP

**Configuração:**

\`\`\`json
{
  "server": "http://wolf-server:12180",
  "appid": "minha-aplicacao",
  "header_prefix": "X-"
}
\`\`\`

O plugin consulta o servidor Wolf para verificar se o usuário autenticado tem permissão para acessar o recurso (URL + método HTTP). Os dados do usuário são propagados ao upstream via headers.

**Boas práticas:**
- Mantenha o servidor Wolf próximo ao gateway para minimizar latência
- Configure permissões no Wolf com granularidade de URL + método
- Use o painel administrativo do Wolf para gerenciar roles e permissões visualmente`,
            },
            {
              id: "opa",
              title: "opa",
              body: `O plugin **opa** (Open Policy Agent) permite externalizar decisões de autorização para um servidor OPA. As políticas são escritas em linguagem Rego e podem avaliar qualquer aspecto da requisição.

**Quando usar:**
- Políticas de autorização que precisam de lógica complexa
- Cenários onde as políticas devem ser versionadas e auditadas separadamente
- Organizações que já usam OPA para outras decisões de política (K8s, Terraform)

**Configuração:**

\`\`\`json
{
  "host": "http://opa:8181",
  "policy": "api/authz/allow",
  "with_route": true,
  "with_consumer": true,
  "with_service": true
}
\`\`\`

**Exemplo de política Rego:**

\`\`\`
package api.authz

default allow = false

allow {
  input.consumer.username == "admin"
}

allow {
  input.request.method == "GET"
  startswith(input.request.path, "/api/public/")
}
\`\`\`

O campo \`policy\` define o caminho da política no OPA. Os campos \`with_route\`, \`with_consumer\` e \`with_service\` controlam quais dados são enviados ao OPA como input.

> **Dica:** O OPA permite testar políticas unitariamente com \`opa test\`, facilitando o desenvolvimento e a validação antes de deploy.

**Boas práticas:**
- Versione as políticas Rego em repositório Git
- Teste unitariamente cada política com \`opa test\`
- Use bundles para distribuir políticas automaticamente ao OPA
- Monitore o tempo de avaliação das políticas para evitar impacto na latência`,
            },
          ],
        },
      ],
    },
    // ── 2. Plugins de Segurança ─────────────────────────────────
    {
      slug: "plugins-seguranca",
      title: "Plugins de Segurança",
      description:
        "Proteja suas APIs contra abusos com restrição de IP, bloqueio de URI, CORS e proteção CSRF.",
      icon: "Shield",
      tags: ["segurança", "ip", "cors", "restrição"],
      content: [
        {
          id: "visao-geral-seguranca",
          title: "Visão Geral",
          body: `Os plugins de segurança formam camadas adicionais de proteção além da autenticação. Eles controlam **de onde**, **como** e **quem** pode acessar suas APIs.

Essas proteções funcionam de forma complementar:

- **ip-restriction**: Permite ou bloqueia acessos com base no IP de origem
- **uri-blocker**: Bloqueia padrões de URI suspeitos ou perigosos
- **consumer-restriction**: Restringe acesso a consumidores ou grupos específicos
- **cors**: Configura Cross-Origin Resource Sharing para aplicações web
- **csrf**: Protege contra ataques Cross-Site Request Forgery
- **request-validation**: Valida headers e corpo da requisição com JSON Schema
- **ua-restriction**: Filtra acessos pelo header User-Agent
- **referer-restriction**: Filtra acessos pelo header Referer
- **threat-protection**: Proteção contra ataques JSON, SQL injection e XSS
- **data-masking**: Redação de PII em respostas (LGPD/GDPR)

> **Dica:** Combine múltiplos plugins de segurança para criar uma defesa em profundidade. Por exemplo, use \`ip-restriction\` junto com \`consumer-restriction\` para garantir que apenas consumidores autorizados de IPs confiáveis acessem APIs sensíveis.`,
          subsections: [
            {
              id: "ip-restriction",
              title: "ip-restriction",
              body: `O plugin **ip-restriction** permite criar listas de IPs permitidos (whitelist) ou bloqueados (blacklist). Suporta endereços IPv4, IPv6 e notação CIDR.

**Quando usar:**
- Restringir acesso a APIs administrativas a IPs internos
- Bloquear IPs conhecidos por abuso ou ataques
- Limitar acesso de parceiros a faixas de IP específicas

**Configuração (whitelist):**

\`\`\`json
{
  "whitelist": [
    "10.0.0.0/8",
    "192.168.1.0/24",
    "200.100.50.25"
  ]
}
\`\`\`

**Configuração (blacklist):**

\`\`\`json
{
  "blacklist": [
    "203.0.113.0/24"
  ],
  "message": "Acesso bloqueado para o seu endereço IP."
}
\`\`\`

> **Atenção:** Não use whitelist e blacklist simultaneamente. Escolha uma estratégia. Whitelist é mais segura pois bloqueia tudo que não estiver na lista.

**Boas práticas:**
- Prefira whitelist para APIs críticas e internas
- Use notação CIDR para gerenciar faixas de IP de forma eficiente
- Documente o motivo de cada regra para facilitar a manutenção
- Teste as regras em ambiente de staging antes de aplicar em produção`,
            },
            {
              id: "uri-blocker",
              title: "uri-blocker",
              body: `O plugin **uri-blocker** bloqueia requisições cujo URI corresponda a padrões especificados via expressões regulares. É útil para prevenir acesso a endpoints perigosos ou explorações conhecidas.

**Quando usar:**
- Bloquear acesso a arquivos sensíveis (\`.env\`, \`.git\`, \`wp-admin\`)
- Prevenir ataques de path traversal (\`../\`)
- Filtrar tentativas de explorar vulnerabilidades conhecidas

**Configuração:**

\`\`\`json
{
  "block_rules": [
    "\\\\.env$",
    "\\\\.git",
    "wp-admin",
    "\\\\.\\\\."
  ],
  "rejected_code": 403,
  "rejected_msg": "Acesso bloqueado por política de segurança."
}
\`\`\`

> **Nota:** Os padrões usam expressões regulares. Lembre-se de escapar caracteres especiais como pontos (\`\\\\.\`) e barras.

**Boas práticas:**
- Comece com um conjunto básico de regras contra ataques comuns
- Monitore os logs de bloqueio para identificar falsos positivos
- Atualize as regras periodicamente com base em novas ameaças`,
            },
            {
              id: "consumer-restriction",
              title: "consumer-restriction",
              body: `O plugin **consumer-restriction** limita o acesso a uma rota para consumidores, grupos ou métodos HTTP específicos. Funciona em conjunto com os plugins de autenticação.

**Quando usar:**
- Restringir endpoints de escrita (POST, PUT, DELETE) a consumidores privilegiados
- Criar níveis de acesso (bronze, silver, gold) para diferentes planos de API
- Garantir que apenas consumidores de determinado grupo acessem recursos sensíveis

**Configuração por consumidor:**

\`\`\`json
{
  "type": "consumer_name",
  "whitelist": ["parceiro-a", "parceiro-b"],
  "rejected_code": 403
}
\`\`\`

**Configuração por grupo de métodos:**

\`\`\`json
{
  "type": "consumer_group_id",
  "whitelist": ["grupo-premium"],
  "allowed_by_methods": {
    "grupo-basico": ["GET", "HEAD"]
  }
}
\`\`\`

> **Dica:** Combine com \`key-auth\` ou \`jwt-auth\` para que o gateway identifique o consumidor antes de aplicar a restrição.

**Boas práticas:**
- Organize consumidores em grupos lógicos para facilitar o gerenciamento
- Use \`allowed_by_methods\` para controle granular de métodos HTTP
- Prefira whitelist em vez de blacklist para maior segurança`,
            },
            {
              id: "cors",
              title: "cors",
              body: `O plugin **cors** configura os headers de Cross-Origin Resource Sharing, permitindo que aplicações web em domínios diferentes acessem sua API de forma segura.

**Quando usar:**
- APIs consumidas por aplicações frontend (SPAs em React, Vue, Angular)
- Quando o frontend e a API estão em domínios ou portas diferentes
- APIs públicas que precisam ser acessíveis via JavaScript no navegador

**Configuração:**

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

> **Atenção:** Evite usar \`allow_origins: "*"\` em produção, especialmente com \`allow_credential: true\`. Isso expõe sua API a qualquer origem.

**Boas práticas:**
- Liste explicitamente as origens permitidas
- Restrinja \`allow_methods\` apenas aos métodos necessários
- Configure \`max_age\` para reduzir requisições preflight OPTIONS
- Use \`allow_origins_by_regex\` para permitir subdomínio com padrões dinâmicos`,
            },
            {
              id: "csrf",
              title: "csrf",
              body: `O plugin **csrf** protege contra ataques Cross-Site Request Forgery gerando e validando tokens anti-CSRF automaticamente.

**Quando usar:**
- APIs que recebem requisições de formulários HTML
- Endpoints que alteram estado (POST, PUT, DELETE) acessados via navegador
- Quando a API usa cookies para autenticação de sessão

**Configuração:**

\`\`\`json
{
  "name": "csrf_token",
  "expires": 7200,
  "key": "chave-secreta-para-csrf"
}
\`\`\`

O plugin gera um token via cookie e exige que o cliente o envie de volta no header em requisições que alteram estado. Requisições GET, HEAD e OPTIONS são isentas.

> **Nota:** O CSRF é relevante apenas quando a autenticação usa cookies/sessões. Para APIs com autenticação via token Bearer (JWT), o CSRF geralmente não é necessário.

**Boas práticas:**
- Configure \`expires\` com um valor razoável (1-2 horas)
- Certifique-se de que o frontend envia o token no header correto
- Use em conjunto com o plugin \`cors\` para proteção completa`,
            },
            {
              id: "request-validation",
              title: "request-validation",
              body: `O plugin **request-validation** valida headers e corpo da requisição usando JSON Schema antes de encaminhar ao upstream. Requisições inválidas são rejeitadas no gateway, protegendo o backend.

**Quando usar:**
- Validar o formato do corpo da requisição (campos obrigatórios, tipos, formatos)
- Garantir que headers obrigatórios estejam presentes
- Prevenir requisições malformadas de alcançar o upstream
- Documentar e enforçar contratos de API

**Configuração:**

\`\`\`json
{
  "header_schema": {
    "type": "object",
    "required": ["X-Tenant-Id"],
    "properties": {
      "X-Tenant-Id": {
        "type": "string",
        "pattern": "^[a-z0-9-]+$"
      }
    }
  },
  "body_schema": {
    "type": "object",
    "required": ["name", "email"],
    "properties": {
      "name": { "type": "string", "minLength": 1, "maxLength": 100 },
      "email": { "type": "string", "format": "email" }
    }
  },
  "rejected_code": 400
}
\`\`\`

> **Dica:** Use JSON Schema draft-4 ou superior. O gateway valida automaticamente e retorna mensagens de erro detalhadas indicando quais campos são inválidos.

**Boas práticas:**
- Valide apenas os campos críticos para não tornar a API excessivamente rígida
- Use \`additionalProperties: false\` para rejeitar campos desconhecidos
- Combine com a documentação da API para manter schema e docs sincronizados`,
            },
            {
              id: "ua-restriction",
              title: "ua-restriction",
              body: `O plugin **ua-restriction** filtra requisições com base no header User-Agent. Permite criar listas de User-Agents permitidos (whitelist) ou bloqueados (blacklist) usando strings ou expressões regulares.

**Quando usar:**
- Bloquear bots e crawlers indesejados
- Restringir acesso a versões mínimas de aplicativos mobile
- Identificar e bloquear ferramentas de scraping
- Exigir que clientes se identifiquem via User-Agent

**Configuração (blacklist):**

\`\`\`json
{
  "blacklist": [
    "curl*",
    "python-requests*",
    "scrapy*",
    "Go-http-client*"
  ],
  "rejected_code": 403,
  "rejected_msg": "Acesso não permitido para este cliente."
}
\`\`\`

**Configuração (whitelist):**

\`\`\`json
{
  "whitelist": [
    "MeuApp/.*",
    "Mozilla/.*"
  ]
}
\`\`\`

> **Nota:** O User-Agent pode ser facilmente falsificado. Use este plugin como camada adicional, não como mecanismo de segurança principal.

**Boas práticas:**
- Use regex para cobrir variações de versão (ex: \`MeuApp/.*\`)
- Combine com \`ip-restriction\` para defesa em profundidade
- Monitore os logs para identificar User-Agents suspeitos não cobertos pelas regras`,
            },
            {
              id: "referer-restriction",
              title: "referer-restriction",
              body: `O plugin **referer-restriction** controla o acesso com base no header Referer da requisição. É útil para garantir que a API seja chamada apenas a partir de páginas ou domínios autorizados.

**Quando usar:**
- Proteger APIs públicas que devem ser consumidas apenas pelo seu frontend
- Prevenir que terceiros embedem chamadas à sua API em seus sites
- Controlar quais domínios podem fazer chamadas à API via navegador

**Configuração:**

\`\`\`json
{
  "whitelist": [
    "*.exemplo.com",
    "app.parceiro.com"
  ],
  "bypass_missing": false,
  "rejected_code": 403,
  "rejected_msg": "Origem não autorizada."
}
\`\`\`

O campo \`bypass_missing\` define se requisições sem o header Referer são permitidas (\`true\`) ou bloqueadas (\`false\`). Os padrões suportam wildcards com \`*\`.

> **Nota:** Assim como o User-Agent, o header Referer pode ser falsificado. Use como camada adicional de proteção, não como mecanismo único.

**Boas práticas:**
- Configure \`bypass_missing: false\` para máxima segurança
- Use wildcards para cobrir subdomínios (ex: \`*.exemplo.com\`)
- Combine com \`cors\` para proteção completa em cenários de navegador`,
            },
            {
              id: "threat-protection",
              title: "threat-protection",
              body: `O plugin **threat-protection** (também disponível como parte do \`body-transformer\` ou via \`serverless-pre-function\`) protege contra ataques comuns como JSON attacks (profundidade excessiva, arrays gigantes), SQL injection e XSS.

**Quando usar:**
- APIs expostas à internet que recebem input de usuários
- Proteção contra payloads JSON malformados ou excessivamente grandes
- Prevenção de ataques de injeção em parâmetros e headers
- Compliance com requisitos de segurança (OWASP Top 10)

**Configuração:**

\`\`\`json
{
  "max_body_size": 1048576,
  "max_json_depth": 10,
  "max_array_length": 100,
  "max_object_keys": 50,
  "max_string_length": 10000,
  "check_sql_injection": true,
  "check_xss": true
}
\`\`\`

O campo \`max_body_size\` limita o tamanho do corpo em bytes (1MB no exemplo). Os campos \`max_json_depth\`, \`max_array_length\` e \`max_object_keys\` protegem contra JSON bombs.

> **Atenção:** Configure os limites de acordo com o uso legítimo da sua API. Valores muito restritivos podem bloquear requisições válidas.

**Boas práticas:**
- Defina \`max_body_size\` baseado no maior payload legítimo esperado
- Habilite verificação de SQL injection e XSS em APIs que aceitam texto livre
- Monitore bloqueios para ajustar limites e reduzir falsos positivos
- Combine com \`request-validation\` para validação estrutural + proteção contra ataques`,
            },
            {
              id: "data-masking",
              title: "data-masking",
              body: `O plugin **data-masking** redige (mascara) dados sensíveis como PII (Personally Identifiable Information) nas respostas antes de enviá-las ao cliente. Essencial para conformidade com LGPD, GDPR e outras regulamentações de proteção de dados.

**Quando usar:**
- Cumprir requisitos de LGPD/GDPR na camada de API
- Mascarar CPF, email, telefone ou outros dados pessoais em respostas
- Ambientes de staging que usam dados de produção e precisam de anonimização
- APIs que retornam dados sensíveis que nem todos os consumidores devem ver

**Configuração:**

\`\`\`json
{
  "rules": [
    {
      "path": "$.cpf",
      "mask": "***.***.***-**"
    },
    {
      "path": "$.email",
      "mask_regex": "(.)(.*)(@.*)",
      "replace": "$1****$3"
    },
    {
      "path": "$.telefone",
      "mask": "(**) ****-****"
    }
  ]
}
\`\`\`

O campo \`path\` usa JSONPath para localizar o campo a mascarar. O \`mask\` define o formato fixo de substituição. Para padrões dinâmicos, use \`mask_regex\` com \`replace\`.

> **Dica:** Aplique data masking como plugin global em ambientes de staging para proteger dados sensíveis durante testes.

**Boas práticas:**
- Mascare todos os campos de PII identificados no mapeamento de dados
- Teste as regras de mascaramento com dados reais para garantir que não quebrem o formato
- Use \`consumer-restriction\` para permitir acesso a dados completos apenas para consumidores autorizados
- Documente quais campos são mascarados na documentação da API`,
            },
          ],
        },
      ],
    },
    // ── 3. Plugins de Controle de Tráfego ───────────────────────
    {
      slug: "plugins-trafego",
      title: "Plugins de Controle de Tráfego",
      description:
        "Gerencie o fluxo de requisições com rate limiting, cache, canary releases e controle de concorrência.",
      icon: "Gauge",
      tags: ["rate-limiting", "cache", "tráfego", "canary"],
      content: [
        {
          id: "visao-geral-trafego",
          title: "Visão Geral",
          body: `Os plugins de controle de tráfego protegem seus upstreams contra sobrecarga e permitem estratégias avançadas de roteamento e cache.

Eles atuam em diferentes dimensões do tráfego:

- **limit-req**: Limita a taxa de requisições por segundo (rate limiting)
- **limit-conn**: Controla o número máximo de conexões simultâneas
- **limit-count**: Define cotas de requisições por período (minuto, hora, dia)
- **traffic-split**: Distribui tráfego entre upstreams para canary releases e testes A/B
- **proxy-cache**: Cacheia respostas para reduzir carga nos upstreams
- **request-id**: Injeta identificadores únicos para rastreabilidade
- **api-breaker**: Circuit breaker para proteger upstreams degradados
- **proxy-mirror**: Espelha tráfego para um upstream secundário
- **client-control**: Controla limites da requisição do cliente (body size)
- **real-ip**: Detecta o IP real do cliente a partir de headers de proxy
- **workflow**: Executa ações condicionais baseadas em regras de matching

> **Dica:** Combine \`limit-count\` (cota por hora/dia) com \`limit-req\` (taxa por segundo) para proteção em múltiplas camadas. A cota previne abuso geral e o rate limit previne rajadas.`,
          subsections: [
            {
              id: "limit-req",
              title: "limit-req",
              body: `O plugin **limit-req** implementa rate limiting baseado no algoritmo "leaky bucket". Ele limita a taxa de requisições por segundo, suavizando rajadas de tráfego.

**Quando usar:**
- Proteger APIs contra rajadas excessivas de requisições
- Garantir qualidade de serviço (QoS) para todos os consumidores
- Prevenir que um único cliente monopolize os recursos

**Configuração:**

\`\`\`json
{
  "rate": 10,
  "burst": 5,
  "rejected_code": 429,
  "key_type": "var",
  "key": "remote_addr",
  "rejected_msg": "Taxa de requisições excedida. Tente novamente em alguns segundos."
}
\`\`\`

O campo \`rate\` define requisições permitidas por segundo. O campo \`burst\` permite rajadas temporárias além do limite. O \`key\` define o critério de agrupamento (por IP, consumer, header, etc.).

**Opções de agrupamento (key):**
- \`remote_addr\`: Por IP de origem
- \`consumer_name\`: Por consumidor autenticado
- \`server_addr\`: Por IP do servidor (menos comum)

> **Nota:** Requisições em rajada (entre rate e rate+burst) são atrasadas, não rejeitadas. Apenas acima de rate+burst a requisição retorna 429.

**Boas práticas:**
- Defina limites baseados na capacidade real do seu upstream
- Use \`consumer_name\` como key para limites por cliente
- Retorne o header \`Retry-After\` para orientar clientes sobre quando tentar novamente`,
            },
            {
              id: "limit-conn",
              title: "limit-conn",
              body: `O plugin **limit-conn** limita o número de conexões simultâneas (concorrentes) a uma rota. Diferente do rate limiting, ele controla quantas requisições podem estar sendo processadas ao mesmo tempo.

**Quando usar:**
- Endpoints que consomem muitos recursos (relatórios, exports, uploads)
- APIs com processamento demorado (IA, transcodificação, batch)
- Proteger upstreams que têm limite de conexões simultâneas

**Configuração:**

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

O campo \`conn\` define o limite de conexões simultâneas. O \`burst\` permite exceder temporariamente o limite com um atraso de \`default_conn_delay\` segundos.

> **Dica:** Use \`limit-conn\` em endpoints pesados e \`limit-req\` em endpoints leves. Eles se complementam.

**Boas práticas:**
- Monitore o número médio de conexões simultâneas antes de definir limites
- Configure o \`default_conn_delay\` de acordo com o tempo de resposta típico
- Use logs e métricas para ajustar os valores ao longo do tempo`,
            },
            {
              id: "limit-count",
              title: "limit-count",
              body: `O plugin **limit-count** implementa cotas de requisições por período de tempo (minuto, hora, dia). É ideal para planos de API com limites mensais ou diários.

**Quando usar:**
- Planos de API com cotas (1000 req/dia para o plano básico, 10000 para premium)
- Limitar o uso de APIs externas ou com custo por chamada
- Compliance com contratos de SLA

**Configuração:**

\`\`\`json
{
  "count": 1000,
  "time_window": 3600,
  "key_type": "var",
  "key": "consumer_name",
  "rejected_code": 429,
  "rejected_msg": "Cota de requisições excedida. Atualize seu plano para mais requisições.",
  "policy": "redis",
  "redis_host": "redis",
  "redis_port": 6379
}
\`\`\`

O campo \`time_window\` define o período em segundos (3600 = 1 hora). O campo \`policy\` define onde armazenar os contadores — \`local\` (em memória) ou \`redis\` (compartilhado entre nós).

**Headers de resposta:**
- \`X-RateLimit-Limit\`: Cota total
- \`X-RateLimit-Remaining\`: Requisições restantes
- \`X-RateLimit-Reset\`: Segundos até o reset da janela

> **Atenção:** Em ambientes com múltiplos nós do gateway, use a política \`redis\` para que os contadores sejam compartilhados. Com \`local\`, cada nó mantém seu próprio contador.

**Boas práticas:**
- Use Redis em produção para contadores precisos e compartilhados
- Retorne os headers de rate limit para que clientes monitorem seu consumo
- Defina cotas diferentes por consumidor ou grupo de consumidores`,
            },
            {
              id: "traffic-split",
              title: "traffic-split",
              body: `O plugin **traffic-split** distribui o tráfego entre diferentes upstreams com base em pesos ou regras. É fundamental para canary releases, testes A/B e migrações graduais.

**Quando usar:**
- Canary releases: enviar 5% do tráfego para a nova versão
- Testes A/B: dividir tráfego entre duas versões de um serviço
- Migração gradual: mover tráfego do sistema legado para o novo
- Blue/green deployments com transição suave

**Configuração (canary por peso):**

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

O upstream sem a chave \`upstream\` recebe o tráfego restante no upstream padrão da rota. No exemplo, 5% vai para o novo serviço e 95% para o upstream original.

**Configuração (split por condição):**

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

> **Dica:** Comece com um percentual pequeno (1-5%) e aumente gradualmente enquanto monitora erros e latência na nova versão.

**Boas práticas:**
- Monitore métricas de erro e latência durante o canary
- Tenha um plano de rollback rápido (voltar peso para 0)
- Use condições (match) para testar com usuários internos antes de abrir para todos`,
            },
            {
              id: "proxy-cache",
              title: "proxy-cache",
              body: `O plugin **proxy-cache** armazena respostas do upstream em cache, reduzindo a carga nos serviços de backend e melhorando o tempo de resposta para requisições repetidas.

**Quando usar:**
- Endpoints com dados que mudam com pouca frequência (catálogo de produtos, configurações)
- APIs com alto volume de leitura e baixa taxa de escrita
- Reduzir latência para usuários em regiões distantes do backend

**Configuração:**

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

O campo \`cache_key\` define como a chave de cache é composta. O \`cache_ttl\` define o tempo de vida em segundos. O \`cache_bypass\` permite forçar a busca no upstream (ex: se o parâmetro \`nocache=1\` estiver presente).

**Headers de resposta:**
- \`X-Cache-Status\`: HIT (do cache), MISS (do upstream) ou BYPASS (ignorou cache)

> **Nota:** Apenas requisições GET são cacheadas por padrão. Respostas com \`Set-Cookie\` ou \`Cache-Control: no-cache\` não são cacheadas.

**Boas práticas:**
- Defina TTLs curtos para dados que mudam (30-60s) e longos para dados estáticos (horas)
- Use a chave de cache cuidadosamente — inclua parâmetros relevantes
- Monitore a taxa de HIT/MISS para ajustar a estratégia
- Configure \`cache_bypass\` para permitir invalidação manual`,
            },
            {
              id: "request-id",
              title: "request-id",
              body: `O plugin **request-id** injeta um identificador único (UUID) em cada requisição, permitindo rastrear o percurso completo de uma chamada através de todos os serviços.

**Quando usar:**
- Rastreamento distribuído (distributed tracing)
- Correlação de logs entre gateway, serviços e bancos de dados
- Debugging de problemas em produção

**Configuração:**

\`\`\`json
{
  "header_name": "X-Request-Id",
  "include_in_response": true,
  "algorithm": "uuid"
}
\`\`\`

O campo \`header_name\` define o nome do header (padrão: \`X-Request-Id\`). Com \`include_in_response: true\`, o ID também é retornado na resposta ao cliente.

Se a requisição já contiver o header, o plugin preserva o valor existente em vez de gerar um novo. Isso permite que sistemas externos definam seus próprios IDs de correlação.

> **Dica:** Configure o \`request-id\` como um plugin global para que todas as requisições recebam um identificador. Isso simplifica enormemente o debugging.

**Boas práticas:**
- Use \`snowflake\` como algoritmo em cenários de alto volume (melhor performance que UUID)
- Propague o request ID para todos os serviços downstream
- Inclua o request ID nos logs de aplicação para correlação
- Retorne sempre o ID na resposta para que o cliente possa referenciá-lo em suporte`,
            },
            {
              id: "api-breaker",
              title: "api-breaker",
              body: `O plugin **api-breaker** implementa o padrão Circuit Breaker para proteger upstreams degradados. Quando o upstream retorna erros consecutivos, o circuito "abre" e o gateway retorna erros diretamente, sem sobrecarregar o backend.

**Quando usar:**
- Proteger upstreams que ficam intermitentemente indisponíveis
- Evitar cascata de falhas em arquiteturas de microsserviços
- Dar tempo ao upstream para se recuperar sem receber tráfego
- Melhorar a experiência do usuário com respostas rápidas de erro

**Configuração:**

\`\`\`json
{
  "break_response_code": 502,
  "break_response_body": "{\\"error\\": \\"Serviço temporariamente indisponível\\"}",
  "break_response_headers": [
    { "key": "Content-Type", "value": "application/json" }
  ],
  "unhealthy": {
    "http_statuses": [500, 502, 503],
    "failures": 3
  },
  "healthy": {
    "http_statuses": [200],
    "successes": 1
  },
  "max_breaker_sec": 300
}
\`\`\`

Quando o upstream retorna \`failures\` erros consecutivos com os status codes em \`http_statuses\`, o circuito abre por até \`max_breaker_sec\` segundos. Após esse período, uma requisição de teste é enviada. Se retornar um status em \`healthy.http_statuses\`, o circuito fecha.

> **Dica:** Use o circuit breaker junto com \`traffic-split\` para redirecionar tráfego automaticamente para um upstream de fallback quando o principal estiver degradado.

**Boas práticas:**
- Configure \`failures\` entre 3-5 para evitar aberturas por erros esporádicos
- Use \`max_breaker_sec\` entre 30-300 segundos dependendo do tempo de recuperação do upstream
- Retorne um corpo de resposta útil (\`break_response_body\`) para que clientes saibam o que aconteceu`,
            },
            {
              id: "proxy-mirror",
              title: "proxy-mirror",
              body: `O plugin **proxy-mirror** espelha (copia) o tráfego para um upstream secundário sem afetar a resposta ao cliente. A resposta do espelho é descartada.

**Quando usar:**
- Testar uma nova versão do serviço com tráfego real sem risco
- Enviar tráfego para análise de segurança ou debugging
- Replicar requisições para um ambiente de staging
- Alimentar pipelines de teste com dados reais de produção

**Configuração:**

\`\`\`json
{
  "host": "http://servico-espelho:8080",
  "path": "/mirror",
  "sample_ratio": 0.1
}
\`\`\`

O campo \`host\` define o upstream espelho. O \`path\` (opcional) reescreve o path da requisição espelhada. O \`sample_ratio\` (0.0 a 1.0) define a fração do tráfego a espelhar (0.1 = 10%).

> **Nota:** O espelhamento é assíncrono — a resposta ao cliente não é afetada pela latência ou erros do upstream espelho.

**Boas práticas:**
- Use \`sample_ratio\` menor que 1.0 em APIs de alto volume para não sobrecarregar o espelho
- Garanta que o upstream espelho esteja preparado para receber o mesmo volume de tráfego
- Não use o espelhamento com requisições que causam efeitos colaterais (pagamentos, envio de emails) — ou use com um serviço que apenas registra sem processar`,
            },
            {
              id: "client-control",
              title: "client-control",
              body: `O plugin **client-control** permite controlar limites do lado do cliente, como o tamanho máximo do corpo da requisição. Requisições que excedem os limites são rejeitadas antes de serem processadas.

**Quando usar:**
- Limitar o tamanho de uploads por rota
- Definir limites diferentes de body size para endpoints específicos
- Proteger o gateway contra requisições excessivamente grandes

**Configuração:**

\`\`\`json
{
  "max_body_size": 10485760
}
\`\`\`

O campo \`max_body_size\` define o tamanho máximo do corpo em bytes (10MB no exemplo). Requisições maiores recebem status 413 (Payload Too Large).

> **Dica:** Use este plugin em rotas de upload para limitar o tamanho de arquivos, enquanto mantém um limite global menor no Nginx para requisições normais.

**Boas práticas:**
- Configure limites adequados para cada tipo de endpoint (upload vs API normal)
- Retorne uma mensagem clara quando o limite é excedido
- Combine com rate limiting para prevenir abuso via uploads repetidos`,
            },
            {
              id: "real-ip",
              title: "real-ip",
              body: `O plugin **real-ip** detecta o endereço IP real do cliente a partir de headers HTTP definidos por proxies reversos e CDNs (como \`X-Forwarded-For\` ou \`X-Real-IP\`).

**Quando usar:**
- O gateway está atrás de um load balancer, CDN ou proxy reverso
- Os plugins \`ip-restriction\` e \`limit-req\` precisam do IP real, não do IP do proxy
- Logging e analytics precisam registrar o IP real do cliente

**Configuração:**

\`\`\`json
{
  "source": "http_x_forwarded_for",
  "trusted_addresses": [
    "10.0.0.0/8",
    "172.16.0.0/12"
  ],
  "recursive": true
}
\`\`\`

O campo \`source\` define de qual header extrair o IP real. O \`trusted_addresses\` define quais IPs são de proxies confiáveis. Com \`recursive: true\`, o plugin busca o primeiro IP não-confiável no header \`X-Forwarded-For\`, percorrendo da direita para a esquerda.

> **Atenção:** Configure corretamente os \`trusted_addresses\` para que apenas proxies legítimos possam definir o IP real. Caso contrário, um atacante pode falsificar o header \`X-Forwarded-For\`.

**Boas práticas:**
- Sempre configure este plugin quando o gateway está atrás de um proxy/CDN
- Liste todos os IPs/CIDRs dos seus proxies confiáveis
- Habilite \`recursive: true\` quando há múltiplos proxies na cadeia
- Teste com \`ip-restriction\` para confirmar que o IP real está sendo detectado`,
            },
            {
              id: "workflow",
              title: "workflow",
              body: `O plugin **workflow** permite definir regras condicionais que executam ações específicas quando as condições são atendidas. É como um "if/then" configurável no pipeline de requisições.

**Quando usar:**
- Aplicar rate limiting diferente por consumer ou rota
- Bloquear requisições condicionalmente baseado em headers, método ou path
- Criar lógica condicional sem código customizado
- Rotear ou transformar requisições baseado em condições

**Configuração:**

\`\`\`json
{
  "rules": [
    {
      "case": [
        ["http_x_api_version", "==", "v2"]
      ],
      "actions": [
        ["limit-count", { "count": 5000, "time_window": 3600, "key": "consumer_name" }]
      ]
    },
    {
      "case": [
        ["http_x_api_version", "==", "v1"]
      ],
      "actions": [
        ["limit-count", { "count": 1000, "time_window": 3600, "key": "consumer_name" }]
      ]
    }
  ]
}
\`\`\`

Cada regra tem um \`case\` (condições a avaliar) e \`actions\` (plugins a aplicar). As condições usam variáveis Nginx. A primeira regra que combinar é executada (short-circuit).

> **Dica:** O workflow é ideal para aplicar políticas diferentes para diferentes versões de API, planos de consumidores ou regiões geográficas sem duplicar rotas.

**Boas práticas:**
- Ordene as regras da mais específica para a mais genérica
- Teste cada regra individualmente antes de combinar
- Use para diferenciar políticas sem criar rotas separadas`,
            },
          ],
        },
      ],
    },
    // ── 4. Plugins de Transformação ──────────────────────────────
    {
      slug: "plugins-transformacao",
      title: "Plugins de Transformação",
      description:
        "Transforme requisições e respostas em trânsito com rewrite de headers, body, URI e transcodificação gRPC.",
      icon: "Shuffle",
      tags: ["transformação", "rewrite", "grpc", "fault-injection"],
      content: [
        {
          id: "visao-geral-transformacao",
          title: "Visão Geral",
          body: `Os plugins de transformação modificam requisições e respostas em trânsito, permitindo adaptar o formato dos dados sem alterar os serviços de backend.

Eles são essenciais para:

- **proxy-rewrite**: Reescrever URI, headers e método HTTP antes de enviar ao upstream
- **response-rewrite**: Modificar o corpo, headers e status code da resposta
- **grpc-transcode**: Converter chamadas REST para gRPC automaticamente
- **grpc-web**: Habilitar protocolo gRPC-Web para clientes browser
- **fault-injection**: Simular falhas e atrasos para testes de resiliência
- **redirect**: Redirecionamento HTTP (301/302)
- **body-transformer**: Transformar corpo da requisição/resposta com templates Lua
- **mocking**: Retornar respostas simuladas sem atingir o upstream
- **serverless-pre-function / serverless-post-function**: Código Lua customizado no pipeline
- **aws-lambda / azure-functions / openwhisk**: Proxy para funções serverless
- **gzip**: Compressão gzip das respostas
- **api-composition**: Orquestrar múltiplas chamadas backend em uma única resposta

> **Dica:** Plugins de transformação são executados em uma ordem específica no pipeline. O \`proxy-rewrite\` atua na fase de acesso (antes do upstream), enquanto o \`response-rewrite\` atua na fase de resposta (depois do upstream).`,
          subsections: [
            {
              id: "proxy-rewrite",
              title: "proxy-rewrite",
              body: `O plugin **proxy-rewrite** modifica a requisição antes de enviá-la ao upstream. Pode alterar URI, host, método HTTP e headers.

**Quando usar:**
- Remover prefixos da URL (ex: \`/api/v1/users\` vira \`/users\` no upstream)
- Adicionar headers de contexto (tenant, versão, ambiente)
- Redirecionar para endpoints diferentes no upstream

**Configuração:**

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

O campo \`uri\` suporta variáveis do Nginx como \`$uri\`, \`$host\` e \`$remote_addr\`. O campo \`regex_uri\` permite reescritas baseadas em regex:

\`\`\`json
{
  "regex_uri": ["/api/v1/(.*)", "/$1"]
}
\`\`\`

> **Nota:** O \`regex_uri\` tem prioridade sobre o campo \`uri\` quando ambos estão configurados.

**Boas práticas:**
- Use \`regex_uri\` para remover prefixos de versionamento
- Adicione headers de contexto que facilitem o roteamento e logging no upstream
- Teste as reescritas com cuidado — erros podem causar requisições para URIs erradas`,
            },
            {
              id: "response-rewrite",
              title: "response-rewrite",
              body: `O plugin **response-rewrite** modifica a resposta do upstream antes de enviá-la ao cliente. Pode alterar o corpo, headers, status code e tipo de conteúdo.

**Quando usar:**
- Ocultar headers internos do upstream (ex: \`Server\`, \`X-Powered-By\`)
- Padronizar formatos de erro entre diferentes upstreams
- Injetar headers de segurança (CSP, HSTS, X-Frame-Options)
- Transformar o corpo da resposta (ex: adicionar envelope, remover campos)

**Configuração:**

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

O campo \`vars\` permite aplicar a transformação condicionalmente — no exemplo acima, apenas para respostas com status 500+.

> **Dica:** Use o \`response-rewrite\` para padronizar headers de segurança em todas as respostas. Isso evita depender de cada serviço configurar seus próprios headers.

**Boas práticas:**
- Sempre remova headers que exponham detalhes internos (\`Server\`, \`X-Powered-By\`)
- Adicione headers de segurança como HSTS, X-Content-Type-Options e X-Frame-Options
- Use condições (\`vars\`) para aplicar transformações apenas em cenários específicos`,
            },
            {
              id: "grpc-transcode",
              title: "grpc-transcode",
              body: `O plugin **grpc-transcode** converte automaticamente chamadas REST/JSON em requisições gRPC, permitindo expor serviços gRPC como APIs REST sem modificar o backend.

**Quando usar:**
- Expor serviços gRPC para clientes que só suportam REST (navegadores, apps mobile)
- Criar uma fachada REST sobre microsserviços gRPC
- Permitir que equipes frontend consumam serviços gRPC sem bibliotecas específicas

**Configuração:**

\`\`\`json
{
  "proto_id": "1",
  "service": "pacote.MeuServico",
  "method": "MeuMetodo",
  "deadline": 5000
}
\`\`\`

O campo \`proto_id\` referencia o arquivo .proto previamente cadastrado no API Gateway. O \`service\` e \`method\` identificam o serviço e método gRPC a ser chamado. O \`deadline\` define o timeout em milissegundos.

**Fluxo:**
1. Cliente envia requisição REST/JSON
2. O plugin converte os parâmetros JSON para a mensagem Protobuf correspondente
3. Envia a chamada gRPC ao upstream
4. Converte a resposta Protobuf de volta para JSON
5. Retorna ao cliente como resposta REST

> **Nota:** Você precisa cadastrar o arquivo .proto no API Gateway antes de usar o plugin. O proto define a estrutura das mensagens e serviços.

**Boas práticas:**
- Mantenha os arquivos .proto sincronizados com os serviços backend
- Use \`deadline\` para evitar que chamadas gRPC lentas travem o gateway
- Teste a transcodificação com campos opcionais e tipos complexos (maps, repeated)`,
            },
            {
              id: "fault-injection",
              title: "fault-injection",
              body: `O plugin **fault-injection** permite simular falhas e atrasos nas respostas, tornando possível testar a resiliência dos seus clientes e serviços sem afetar o upstream real.

**Quando usar:**
- Testes de resiliência e chaos engineering
- Validar comportamento de retentativas e circuit breakers nos clientes
- Simular degradação de serviço para testar alertas e monitoramento
- Treinar equipes para lidar com incidentes

**Configuração (atraso):**

\`\`\`json
{
  "delay": {
    "duration": 3,
    "percentage": 50
  }
}
\`\`\`

**Configuração (abort / erro):**

\`\`\`json
{
  "abort": {
    "http_status": 503,
    "body": "{\"error\": \"Serviço temporariamente indisponível\"}",
    "percentage": 10
  }
}
\`\`\`

O campo \`percentage\` define a porcentagem de requisições afetadas (0-100). Você pode combinar \`delay\` e \`abort\` na mesma configuração.

> **Atenção:** Nunca habilite fault-injection em produção sem o campo \`percentage\` configurado, pois o padrão é 100% — todas as requisições serão afetadas.

**Boas práticas:**
- Use em ambientes de staging e development, nunca em produção sem proteção
- Comece com percentuais baixos (1-5%) e aumente gradualmente
- Combine com monitoramento para validar que os alertas disparam corretamente
- Documente os cenários de teste para que a equipe entenda os resultados`,
            },
            {
              id: "redirect",
              title: "redirect",
              body: `O plugin **redirect** permite redirecionar requisições para uma nova URI usando códigos de status HTTP 301 (permanente) ou 302 (temporário). Também é usado para forçar HTTPS.

**Quando usar:**
- Forçar redirecionamento de HTTP para HTTPS
- Migrar endpoints antigos para novos paths
- Redirecionar para URL canônica (com ou sem www)
- Redirecionar versões deprecadas de API para a versão atual

**Configuração (forçar HTTPS):**

\`\`\`json
{
  "http_to_https": true
}
\`\`\`

**Configuração (redirect por URI):**

\`\`\`json
{
  "uri": "/nova-api$request_uri",
  "ret_code": 301
}
\`\`\`

**Configuração (redirect por regex):**

\`\`\`json
{
  "regex_uri": ["/api/v1/(.*)", "/api/v2/$1"],
  "ret_code": 302
}
\`\`\`

O campo \`ret_code\` define o código HTTP (301=permanente, 302=temporário). Use 301 para migrações definitivas e 302 para temporárias.

> **Nota:** Clientes e navegadores podem cachear redirecionamentos 301 indefinidamente. Use 302 quando a mudança pode ser revertida.

**Boas práticas:**
- Use \`http_to_https\` globalmente para forçar conexões seguras
- Prefira 302 durante a fase de teste/migração e mude para 301 quando estabilizar
- Documente redirecionamentos para que a equipe saiba quais paths estão mapeados`,
            },
            {
              id: "body-transformer",
              title: "body-transformer",
              body: `O plugin **body-transformer** transforma o corpo da requisição e/ou resposta usando templates Lua. Permite reestruturar JSONs, converter formatos e adaptar dados em trânsito.

**Quando usar:**
- Adaptar o formato do corpo entre diferentes versões de API
- Converter formatos (ex: camelCase para snake_case)
- Adicionar ou remover campos no corpo da requisição/resposta
- Envelopar respostas em um formato padrão

**Configuração:**

\`\`\`json
{
  "request": {
    "template": "{ \\"user\\": \\"{{name}}\\", \\"email_address\\": \\"{{email}}\\" }"
  },
  "response": {
    "template": "{ \\"data\\": {{_body}}, \\"status\\": \\"ok\\" }"
  }
}
\`\`\`

O campo \`template\` usa a sintaxe de templates com \`{{}}\` para variáveis. A variável \`{{_body}}\` refere-se ao corpo original. Campos individuais do JSON podem ser acessados pelo nome.

> **Dica:** Use o \`body-transformer\` para criar uma camada de compatibilidade entre versões de API sem modificar o backend.

**Boas práticas:**
- Teste templates com payloads reais antes de aplicar em produção
- Use para padronizar respostas de erro entre diferentes upstreams
- Mantenha os templates simples — para lógica complexa, prefira \`serverless-pre-function\``,
            },
            {
              id: "mocking",
              title: "mocking",
              body: `O plugin **mocking** retorna respostas simuladas diretamente do gateway, sem encaminhar a requisição ao upstream. Ideal para desenvolvimento e testes.

**Quando usar:**
- Desenvolver o frontend antes que o backend esteja pronto
- Simular APIs de terceiros em ambientes de teste
- Criar stubs para testes de integração
- Documentar o formato de resposta esperado de um endpoint

**Configuração:**

\`\`\`json
{
  "response_status": 200,
  "content_type": "application/json",
  "response_example": "{\\n  \\"users\\": [\\n    {\\"id\\": 1, \\"name\\": \\"João\\"},\\n    {\\"id\\": 2, \\"name\\": \\"Maria\\"}\\n  ],\\n  \\"total\\": 2\\n}",
  "delay": 500
}
\`\`\`

O campo \`response_example\` define o corpo da resposta. O \`delay\` (em ms) simula latência do backend. O \`content_type\` define o tipo de conteúdo da resposta.

> **Dica:** Use o plugin mocking em ambiente de desenvolvimento e remova-o ao deploy para produção. Combine com variáveis de ambiente para ativar/desativar mocks automaticamente.

**Boas práticas:**
- Use respostas realistas que reflitam o contrato real da API
- Configure \`delay\` para simular latência real e testar comportamentos assíncronos
- Combine com \`response_schema\` quando disponível para validar o formato`,
            },
            {
              id: "serverless-pre-function",
              title: "serverless-pre-function",
              body: `O plugin **serverless-pre-function** executa código Lua customizado **antes** de enviar a requisição ao upstream. Permite lógica arbitrária no pipeline de processamento.

**Quando usar:**
- Lógica de negócio customizada que não é coberta por plugins existentes
- Enriquecer a requisição com dados de fontes externas
- Validações complexas que vão além do JSON Schema
- Manipulação dinâmica de headers, URI ou corpo

**Configuração:**

\`\`\`json
{
  "phase": "rewrite",
  "functions": [
    "return function(conf, ctx) local ngx = ngx; local headers = ngx.req.get_headers(); if not headers['X-Tenant-Id'] then ngx.exit(400) end end"
  ]
}
\`\`\`

**Exemplo mais complexo (via variáveis):**

\`\`\`lua
return function(conf, ctx)
  local core = require("apisix.core")
  local headers = core.request.headers(ctx)

  -- Adicionar timestamp
  core.request.set_header(ctx, "X-Gateway-Timestamp", ngx.now())

  -- Log customizado
  core.log.info("Request from: ", ctx.var.remote_addr)
end
\`\`\`

O campo \`phase\` define em qual momento do pipeline o código executa: \`rewrite\` (antes do proxy) ou \`access\` (durante controle de acesso).

> **Atenção:** Código Lua é executado em cada requisição. Evite operações bloqueantes (I/O síncrono) que podem impactar a performance do gateway.

**Boas práticas:**
- Mantenha as funções curtas e eficientes
- Use a API do \`apisix.core\` em vez de chamar \`ngx\` diretamente quando possível
- Teste extensivamente em staging — erros Lua podem derrubar o worker do Nginx
- Para lógica complexa, prefira um serviço externo com \`forward-auth\``,
            },
            {
              id: "serverless-post-function",
              title: "serverless-post-function",
              body: `O plugin **serverless-post-function** executa código Lua customizado **depois** que a resposta é recebida do upstream, permitindo manipulá-la antes de enviar ao cliente.

**Quando usar:**
- Transformar a resposta com lógica que o \`response-rewrite\` não suporta
- Logging customizado com dados da resposta
- Cálculos baseados no corpo da resposta (agregações, redações)
- Injetar headers dinâmicos baseados no conteúdo da resposta

**Configuração:**

\`\`\`json
{
  "phase": "header_filter",
  "functions": [
    "return function(conf, ctx) ngx.header['X-Processed-By'] = 'fuseone-gateway' end"
  ]
}
\`\`\`

O campo \`phase\` pode ser \`header_filter\` (manipula headers da resposta), \`body_filter\` (manipula corpo) ou \`log\` (após enviar resposta ao cliente).

> **Nota:** Na fase \`body_filter\`, o corpo pode chegar em chunks. Use \`ngx.arg[2]\` para verificar se é o último chunk.

**Boas práticas:**
- Use \`header_filter\` para manipulações simples de headers
- Use \`log\` para side-effects que não afetam a resposta (analytics, métricas)
- Evite \`body_filter\` quando possível — é mais complexo e pode impactar performance`,
            },
            {
              id: "aws-lambda",
              title: "aws-lambda",
              body: `O plugin **aws-lambda** redireciona a requisição para uma função AWS Lambda, permitindo usar funções serverless como upstream.

**Quando usar:**
- Endpoints que executam lógica serverless sem servidor dedicado
- Processamento de eventos ou transformações pontuais
- Integração com ecossistema AWS (S3, DynamoDB, SQS) via Lambda

**Configuração:**

\`\`\`json
{
  "function_uri": "arn:aws:lambda:us-east-1:123456789:function:minha-funcao",
  "authorization": {
    "iam": {
      "accesskey": "$secret://aws-access-key",
      "secretkey": "$secret://aws-secret-key",
      "aws_region": "us-east-1"
    }
  },
  "timeout": 30000,
  "keepalive": true,
  "keepalive_timeout": 60000
}
\`\`\`

> **Dica:** Use o gerenciador de segredos do API Gateway para armazenar as credenciais AWS em vez de incluí-las na configuração.

**Boas práticas:**
- Configure timeouts adequados para o tempo de execução da função Lambda
- Habilite \`keepalive\` para reutilizar conexões e reduzir cold starts
- Use IAM roles quando possível em vez de access keys estáticas`,
            },
            {
              id: "azure-functions",
              title: "azure-functions",
              body: `O plugin **azure-functions** redireciona a requisição para uma Azure Function, integrando funções serverless da Microsoft Azure como upstream.

**Quando usar:**
- Endpoints serverless no ecossistema Azure
- Integração com serviços Azure (Cosmos DB, Storage, Service Bus)
- Processamento de eventos ou transformações via Azure Functions

**Configuração:**

\`\`\`json
{
  "function_uri": "https://minha-app.azurewebsites.net/api/minha-funcao",
  "authorization": {
    "apikey": "$secret://azure-function-key"
  },
  "timeout": 30000,
  "keepalive": true
}
\`\`\`

**Boas práticas:**
- Use function keys ou sistema de autenticação Azure AD para proteger as funções
- Configure timeouts compatíveis com o plano de consumo da Azure Function
- Monitore cold starts e considere o plano Premium para funções críticas`,
            },
            {
              id: "openwhisk",
              title: "openwhisk",
              body: `O plugin **openwhisk** redireciona a requisição para uma action do Apache OpenWhisk, permitindo usar a plataforma serverless open-source como upstream.

**Quando usar:**
- Ambientes com Apache OpenWhisk ou IBM Cloud Functions
- Cenários onde você precisa de uma plataforma serverless open-source
- Integração com ações OpenWhisk existentes

**Configuração:**

\`\`\`json
{
  "api_host": "https://openwhisk.exemplo.com",
  "service_token": "$secret://openwhisk-token",
  "namespace": "meu-namespace",
  "action": "minha-action",
  "result": true,
  "timeout": 30000
}
\`\`\`

O campo \`result\` define se o gateway aguarda o resultado da execução (\`true\`) ou dispara e esquece (\`false\`).

**Boas práticas:**
- Use \`result: true\` quando o cliente precisa da resposta da função
- Configure timeouts adequados para ações de longa duração
- Monitore o tempo de execução das ações para otimizar performance`,
            },
            {
              id: "gzip",
              title: "gzip",
              body: `O plugin **gzip** comprime o corpo da resposta usando o algoritmo gzip antes de enviá-la ao cliente, reduzindo a quantidade de dados transmitidos.

**Quando usar:**
- Respostas JSON ou texto grandes que se beneficiam de compressão
- APIs com clientes em redes lentas ou conexões mobile
- Reduzir custos de bandwidth

**Configuração:**

\`\`\`json
{
  "types": ["text/plain", "application/json", "application/xml", "text/html"],
  "min_length": 1024,
  "comp_level": 6,
  "http_version": 1.1,
  "vary": true
}
\`\`\`

O campo \`types\` define quais Content-Types serão comprimidos. O \`min_length\` define o tamanho mínimo em bytes para ativar a compressão (respostas menores não compensam). O \`comp_level\` (1-9) balanceia entre velocidade (1) e compressão máxima (9).

> **Dica:** O nível 6 é um bom equilíbrio entre compressão e uso de CPU. Evite 9 em APIs de alta performance.

**Boas práticas:**
- Comprima apenas tipos textuais — imagens e binários já são comprimidos
- Configure \`min_length\` para evitar overhead em respostas pequenas
- Habilite o header \`Vary: Accept-Encoding\` para compatibilidade com caches`,
            },
            {
              id: "grpc-web",
              title: "grpc-web",
              body: `O plugin **grpc-web** habilita o protocolo gRPC-Web, permitindo que clientes browser (JavaScript/TypeScript) se comuniquem com serviços gRPC diretamente pelo gateway.

**Quando usar:**
- Aplicações web que precisam consumir serviços gRPC
- SPAs (React, Angular, Vue) que se comunicam com backends gRPC
- Quando o gRPC-Web proxy (Envoy) não está disponível

**Configuração:**

\`\`\`json
{}
\`\`\`

O plugin não requer configuração — basta habilitá-lo na rota. Ele automaticamente detecta requisições gRPC-Web (Content-Type: \`application/grpc-web\`) e as traduz para gRPC nativo antes de enviar ao upstream.

**Formatos suportados:**
- \`application/grpc-web\`: formato binário (mais eficiente)
- \`application/grpc-web-text\`: formato base64 (para ambientes que não suportam binário)

> **Nota:** Diferente do \`grpc-transcode\` (que converte REST para gRPC), o \`grpc-web\` mantém o protocolo gRPC mas adapta o transporte para funcionar no browser.

**Boas práticas:**
- Use junto com o \`cors\` plugin para permitir chamadas cross-origin do browser
- Configure TLS no gateway para proteger a comunicação gRPC-Web
- Prefira o formato binário (\`application/grpc-web\`) para melhor performance`,
            },
            {
              id: "api-composition",
              title: "api-composition",
              body: `O plugin **api-composition** orquestra múltiplas chamadas a backends diferentes e agrega as respostas em uma única resposta ao cliente, implementando o padrão API Composition/Backend for Frontend (BFF).

**Quando usar:**
- Reduzir chamadas do frontend combinando múltiplos endpoints em um
- Implementar o padrão BFF (Backend for Frontend) sem código
- Agregar dados de diferentes microsserviços em uma única resposta
- Compor dashboards que precisam de dados de múltiplas fontes

**Configuração:**

\`\`\`json
{
  "pipelines": [
    {
      "name": "user",
      "uri": "http://user-service:8080/api/user/{user_id}",
      "method": "GET",
      "timeout": 3000
    },
    {
      "name": "orders",
      "uri": "http://order-service:8080/api/orders?user_id={user_id}",
      "method": "GET",
      "timeout": 5000
    },
    {
      "name": "notifications",
      "uri": "http://notification-service:8080/api/notifications/{user_id}/unread",
      "method": "GET",
      "timeout": 2000
    }
  ],
  "parallel": true,
  "fail_on_error": false
}
\`\`\`

Com \`parallel: true\`, todas as chamadas são executadas simultaneamente. O \`fail_on_error: false\` permite retornar dados parciais se um dos backends falhar. A resposta combina todos os resultados:

\`\`\`json
{
  "user": { "id": 1, "name": "João" },
  "orders": [{ "id": 100, "total": 150.00 }],
  "notifications": { "count": 3 }
}
\`\`\`

> **Dica:** Use \`parallel: true\` sempre que possível para minimizar a latência total. A latência será igual ao pipeline mais lento, não à soma de todos.

**Boas práticas:**
- Configure timeouts individuais por pipeline baseados na latência esperada de cada serviço
- Use \`fail_on_error: false\` para resiliência — retorne dados parciais em vez de falhar completamente
- Mantenha o número de pipelines razoável (3-5) para não sobrecarregar o gateway`,
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
          title: "Visão Geral",
          body: `Os plugins de observabilidade exportam dados de requisições e respostas para sistemas externos de logging, monitoramento e análise.

Uma boa estratégia de observabilidade permite:

- Diagnosticar problemas rapidamente com logs detalhados
- Identificar padrões de uso e tendências de tráfego
- Detectar anomalias e ataques em tempo real
- Cumprir requisitos de auditoria e compliance

O API Gateway oferece plugins em três categorias:

**Métricas e Tracing:**
- **prometheus**: Exporta métricas para Prometheus
- **opentelemetry**: Exporta traces e métricas via OTLP
- **zipkin**: Distributed tracing com Zipkin
- **skywalking**: Distributed tracing com Apache SkyWalking
- **datadog**: Exporta métricas para Datadog

**Logging (HTTP e Mensageria):**
- **http-logger**: Envia logs via HTTP/HTTPS para qualquer endpoint
- **kafka-logger**: Publica logs em tópicos Apache Kafka
- **syslog**: Envia logs para servidor syslog
- **tcp-logger / udp-logger**: Envia logs via TCP ou UDP
- **rocketmq-logger**: Publica logs no Apache RocketMQ

**Logging (Cloud e SaaS):**
- **elasticsearch-logger**: Envia logs para Elasticsearch
- **clickhouse-logger**: Envia logs para ClickHouse
- **google-cloud-logging**: Envia logs para Google Cloud
- **splunk-hec-logging**: Envia logs para Splunk via HEC
- **skywalking-logger**: Envia logs para SkyWalking OAP
- **loggly**: Envia logs para Loggly
- **sls-logger**: Envia logs para Alibaba Cloud SLS
- **tencent-cloud-cls**: Envia logs para Tencent Cloud CLS
- **file-logger**: Grava logs em arquivo local

> **Dica:** Habilite o logging como plugin global para capturar todas as requisições. Use filtros para excluir endpoints de health check e métricas que geram volume desnecessário.`,
          subsections: [
            {
              id: "http-logger",
              title: "http-logger",
              body: `O plugin **http-logger** envia logs de cada requisição/resposta para um endpoint HTTP ou HTTPS. É o plugin de logging mais versátil, compatível com qualquer sistema que aceite logs via HTTP.

**Quando usar:**
- Enviar logs para Elasticsearch, Loki, Splunk ou Datadog
- Integrar com sistemas de SIEM para auditoria
- Centralizar logs de múltiplas instâncias do gateway

**Configuração:**

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

O campo \`batch_max_size\` agrupa múltiplos logs em um único envio para melhor performance. O \`inactive_timeout\` define quantos segundos esperar antes de enviar um batch incompleto. O \`concat_method\` pode ser \`json\` (array JSON), \`new_line\` (NDJSON) ou \`json_object\`.

**Formato do log:**
Cada entrada inclui: método, URI, status, latência, IP do cliente, headers da requisição/resposta, informações do consumer e da rota.

> **Nota:** Os logs são enviados de forma assíncrona em background, sem impacto na latência da requisição.

**Boas práticas:**
- Use batch para reduzir o número de chamadas HTTP ao destino
- Configure \`max_retry_count\` para lidar com falhas temporárias
- Filtre campos sensíveis (tokens, senhas) usando \`include_req_body: false\`
- Monitore o tamanho do buffer para evitar perda de logs em caso de indisponibilidade do destino`,
            },
            {
              id: "kafka-logger",
              title: "kafka-logger",
              body: `O plugin **kafka-logger** publica logs de requisições em tópicos Apache Kafka, ideal para pipelines de dados em tempo real e arquiteturas orientadas a eventos.

**Quando usar:**
- Pipelines de dados em tempo real (Kafka -> Spark/Flink -> DataLake)
- Sistemas de auditoria com alta disponibilidade
- Cenários onde o volume de logs é muito alto para HTTP direto
- Integração com ecossistema de streaming (Kafka Connect, ksqlDB)

**Configuração:**

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

O campo \`producer_type\` pode ser \`sync\` (garante entrega, maior latência) ou \`async\` (melhor performance, risco mínimo de perda). O \`required_acks\` define o nível de confirmação (0=nenhum, 1=líder, -1=todos os replicas).

> **Dica:** Use \`producer_type: "async"\` com \`required_acks: 1\` para um bom equilíbrio entre performance e confiabilidade.

**Boas práticas:**
- Configure pelo menos 2 brokers para alta disponibilidade
- Use partições no tópico para distribuir a carga de escrita
- Defina retenção do tópico de acordo com políticas de compliance
- Monitore o lag do consumidor para garantir processamento em tempo real`,
            },
            {
              id: "http-callout",
              title: "http-callout",
              body: `O plugin **http-callout** (também conhecido como \`ext-plugin-pre-req\` ou via serverless functions) permite fazer chamadas HTTP customizadas durante o processamento da requisição, possibilitando integrações complexas.

**Quando usar:**
- Enriquecer a requisição com dados de um serviço externo antes de enviar ao upstream
- Notificar um webhook em tempo real sobre eventos específicos
- Buscar configurações dinâmicas ou feature flags
- Validar dados em um serviço de compliance antes de processar

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

Este padrão permite integrações flexíveis que não são possíveis com plugins declarativos. O serviço externo é chamado durante o processamento e o resultado pode ser usado para modificar a requisição.

> **Atenção:** Chamadas HTTP externas adicionam latência à requisição. Use timeouts curtos e implemente fallbacks para o caso de o serviço externo estar indisponível.

**Boas práticas:**
- Defina timeouts agressivos (100-500ms) para chamadas externas
- Implemente circuit breaker no serviço chamado
- Use cache (proxy-cache ou em memória) para reduzir chamadas repetidas
- Monitore a latência adicional introduzida pelas chamadas externas`,
            },
            {
              id: "prometheus",
              title: "prometheus",
              body: `O plugin **prometheus** exporta métricas do gateway no formato Prometheus, permitindo monitorar latência, throughput, status codes e upstream health via Grafana ou qualquer sistema compatível.

**Quando usar:**
- Monitoramento de performance do gateway e das APIs
- Dashboards e alertas com Prometheus + Grafana
- Métricas de SLA (latência p99, taxa de erros)
- Capacidade de planejamento baseado em dados

**Configuração:**

\`\`\`json
{
  "prefer_name": true
}
\`\`\`

O plugin é normalmente habilitado como **plugin global** sem configuração adicional. As métricas ficam disponíveis no endpoint \`/apisix/prometheus/metrics\`.

**Métricas exportadas:**
- \`apisix_http_status\`: Contagem de respostas por status code
- \`apisix_http_latency\`: Histograma de latência (gateway + upstream)
- \`apisix_bandwidth\`: Bytes de entrada e saída
- \`apisix_upstream_status\`: Status de health dos upstreams
- \`apisix_node_info\`: Informações do nó do gateway

> **Dica:** Habilite o plugin globalmente e use os labels \`route\`, \`service\` e \`consumer\` para segmentar métricas no Grafana.

**Boas práticas:**
- Configure o Prometheus para coletar métricas a cada 15 segundos
- Crie dashboards com latência p50/p90/p99, taxa de erros e throughput
- Defina alertas para latência alta e taxa de erros acima do SLA
- Use \`prefer_name: true\` para labels com nomes de rota em vez de IDs`,
            },
            {
              id: "opentelemetry",
              title: "opentelemetry",
              body: `O plugin **opentelemetry** exporta traces e métricas via protocolo OTLP (OpenTelemetry Protocol) para coletores como Jaeger, Tempo, ou qualquer backend compatível com OpenTelemetry.

**Quando usar:**
- Distributed tracing em arquiteturas de microsserviços
- Padronização de observabilidade com OpenTelemetry (padrão da indústria)
- Envio de traces para Jaeger, Grafana Tempo, Honeycomb, etc.
- Correlação de traces entre gateway e serviços backend

**Configuração:**

\`\`\`json
{
  "trace_id_source": "x-request-id",
  "resource": {
    "service.name": "fuseone-gateway"
  },
  "collector": {
    "address": "otel-collector:4318",
    "request_timeout": 3
  },
  "batch_span_processor": {
    "max_export_batch_size": 256,
    "scheduled_delay_millis": 5000
  }
}
\`\`\`

O campo \`trace_id_source\` define de onde extrair o trace ID (header existente ou gerar novo). O \`collector.address\` aponta para o coletor OTLP (HTTP na porta 4318 ou gRPC na 4317).

> **Nota:** O OpenTelemetry é o padrão recomendado para novos projetos. Se você está começando, prefira este plugin ao Zipkin ou SkyWalking.

**Boas práticas:**
- Use um coletor OTLP entre o gateway e o backend de tracing para bufferizar e processar
- Defina \`service.name\` para identificar o gateway nos traces
- Configure \`batch_span_processor\` para envios em batch eficientes
- Propague o trace context para os upstreams via headers W3C Trace Context`,
            },
            {
              id: "zipkin",
              title: "zipkin",
              body: `O plugin **zipkin** implementa distributed tracing usando o protocolo Zipkin, enviando spans para um servidor Zipkin ou sistema compatível (Jaeger, Grafana Tempo).

**Quando usar:**
- Ambientes que já utilizam Zipkin como backend de tracing
- Rastrear requisições através do gateway e microsserviços
- Identificar gargalos de latência no pipeline de requisições

**Configuração:**

\`\`\`json
{
  "endpoint": "http://zipkin:9411/api/v2/spans",
  "sample_ratio": 0.1,
  "service_name": "fuseone-gateway",
  "server_addr": "gateway.exemplo.com"
}
\`\`\`

O campo \`sample_ratio\` (0.0 a 1.0) define a taxa de amostragem — 0.1 significa 10% das requisições. Requisições amostradas incluem spans detalhados do gateway.

> **Dica:** Em produção com alto volume, use \`sample_ratio\` de 0.01 a 0.1 para não sobrecarregar o backend de tracing.

**Boas práticas:**
- Defina \`sample_ratio\` baseado no volume de requisições e capacidade do Zipkin
- Use o header \`X-B3-Sampled\` para forçar amostragem em requisições específicas
- Combine com \`request-id\` para correlação entre traces e logs`,
            },
            {
              id: "skywalking",
              title: "skywalking",
              body: `O plugin **skywalking** integra o gateway com o Apache SkyWalking para distributed tracing e monitoramento de performance de aplicações (APM).

**Quando usar:**
- Ambientes que utilizam Apache SkyWalking como plataforma de APM
- Monitoramento de topologia de serviços e análise de performance
- Detecção automática de anomalias de latência

**Configuração:**

\`\`\`json
{
  "service_name": "fuseone-gateway",
  "service_instance_name": "gateway-node-1",
  "endpoint_addr": "http://skywalking-oap:12800",
  "sample_ratio": 1
}
\`\`\`

O \`endpoint_addr\` aponta para o SkyWalking OAP (Observability Analysis Platform). O \`service_instance_name\` identifica a instância do gateway.

**Boas práticas:**
- Configure \`service_instance_name\` diferente para cada nó do gateway
- Ajuste \`sample_ratio\` conforme o volume de tráfego
- Use o dashboard do SkyWalking para análise de topologia e latência`,
            },
            {
              id: "datadog",
              title: "datadog",
              body: `O plugin **datadog** exporta métricas do gateway para o Datadog via DogStatsD (UDP), integrando o monitoramento do API Gateway ao ecossistema Datadog.

**Quando usar:**
- Organizações que utilizam Datadog como plataforma de monitoramento
- Dashboards unificados com métricas de gateway + aplicação + infraestrutura
- Alertas e anomaly detection via Datadog

**Configuração:**

\`\`\`json
{
  "host": "datadog-agent",
  "port": 8125,
  "prefix": "apisix",
  "constant_tags": ["env:production", "service:api-gateway"]
}
\`\`\`

O \`host\` e \`port\` apontam para o Datadog Agent (DogStatsD). O \`prefix\` é adicionado a todas as métricas. Os \`constant_tags\` são tags fixas adicionadas a cada métrica.

**Métricas exportadas:**
- \`apisix.request.counter\`: Total de requisições
- \`apisix.request.latency\`: Latência da requisição
- \`apisix.upstream.latency\`: Latência do upstream
- \`apisix.bandwidth\`: Bytes transferidos

**Boas práticas:**
- Instale o Datadog Agent no mesmo host ou pod do gateway
- Use \`constant_tags\` para segmentar por ambiente e serviço
- Crie dashboards com métricas de latência, throughput e erros`,
            },
            {
              id: "syslog",
              title: "syslog",
              body: `O plugin **syslog** envia logs de acesso para um servidor syslog (RFC 5424), integrando com sistemas centralizados de logging via protocolo padrão.

**Quando usar:**
- Infraestruturas que já usam syslog como padrão de logging
- Integração com SIEMs que recebem logs via syslog
- Ambientes Linux com rsyslog ou syslog-ng

**Configuração:**

\`\`\`json
{
  "host": "syslog-server.exemplo.com",
  "port": 514,
  "flush_limit": 4096,
  "sock_type": "udp",
  "batch_max_size": 100,
  "max_retry_count": 3
}
\`\`\`

O \`sock_type\` pode ser \`udp\` (padrão, mais rápido) ou \`tcp\` (mais confiável). O \`flush_limit\` define o tamanho em bytes do buffer antes de enviar.

**Boas práticas:**
- Use \`tcp\` para logs críticos que não podem ser perdidos
- Configure \`batch_max_size\` para envios eficientes em batch
- Use a facility e severity adequadas para categorizar no servidor syslog`,
            },
            {
              id: "tcp-logger",
              title: "tcp-logger",
              body: `O plugin **tcp-logger** envia logs de acesso via TCP para qualquer servidor que aceite conexões TCP, como Fluentd, Logstash ou sistemas customizados.

**Quando usar:**
- Sistemas de coleta de logs que escutam em TCP
- Integração com Fluentd ou Logstash via input TCP
- Quando você precisa de entrega confiável (vs UDP)

**Configuração:**

\`\`\`json
{
  "host": "logstash.exemplo.com",
  "port": 5170,
  "tls": false,
  "batch_max_size": 100,
  "inactive_timeout": 5,
  "buffer_duration": 60
}
\`\`\`

**Boas práticas:**
- Habilite \`tls: true\` para criptografar logs em trânsito
- Use batch para reduzir o número de conexões TCP
- Configure \`buffer_duration\` para lidar com indisponibilidade temporária do destino`,
            },
            {
              id: "udp-logger",
              title: "udp-logger",
              body: `O plugin **udp-logger** envia logs de acesso via UDP, ideal para cenários onde performance é prioridade e perda ocasional de logs é aceitável.

**Quando usar:**
- Sistemas de coleta de logs que escutam em UDP
- Cenários de altíssimo volume onde a latência mínima é crítica
- Integração com coletoreas UDP como StatsD ou custom receivers

**Configuração:**

\`\`\`json
{
  "host": "log-collector.exemplo.com",
  "port": 5160,
  "batch_max_size": 100,
  "inactive_timeout": 5
}
\`\`\`

> **Nota:** UDP não garante entrega. Para logs críticos (auditoria, compliance), prefira \`tcp-logger\` ou \`http-logger\`.

**Boas práticas:**
- Use para métricas e logs não-críticos onde performance importa mais que confiabilidade
- Combine com um logger confiável (HTTP/TCP) para logs de auditoria`,
            },
            {
              id: "rocketmq-logger",
              title: "rocketmq-logger",
              body: `O plugin **rocketmq-logger** publica logs de acesso em tópicos do Apache RocketMQ, integrando com ecossistemas de mensageria baseados em RocketMQ.

**Quando usar:**
- Ambientes que utilizam Apache RocketMQ como plataforma de mensageria
- Pipelines de dados em tempo real baseados em RocketMQ
- Alternativa ao Kafka para logging distribuído

**Configuração:**

\`\`\`json
{
  "nameserver_list": ["rocketmq-ns:9876"],
  "topic": "api-gateway-logs",
  "batch_max_size": 500,
  "max_retry_count": 3,
  "retry_delay": 1
}
\`\`\`

**Boas práticas:**
- Configure pelo menos 2 nameservers para alta disponibilidade
- Defina \`batch_max_size\` de acordo com o volume de tráfego
- Monitore o lag de consumo no tópico`,
            },
            {
              id: "elasticsearch-logger",
              title: "elasticsearch-logger",
              body: `O plugin **elasticsearch-logger** envia logs de acesso diretamente para o Elasticsearch, permitindo busca e análise imediata via Kibana.

**Quando usar:**
- Stack ELK (Elasticsearch + Logstash + Kibana) para análise de logs
- Busca full-text em logs de API
- Dashboards e visualizações de tráfego no Kibana

**Configuração:**

\`\`\`json
{
  "endpoint_addr": "http://elasticsearch:9200",
  "field": {
    "index": "api-gateway-logs",
    "type": "logs"
  },
  "auth": {
    "username": "elastic",
    "password": "$secret://elasticsearch-password"
  },
  "batch_max_size": 100,
  "max_retry_count": 3,
  "ssl_verify": false
}
\`\`\`

> **Dica:** Use index templates no Elasticsearch para definir mappings otimizados para os campos de log do gateway.

**Boas práticas:**
- Crie index patterns diários (\`api-gateway-logs-YYYY.MM.DD\`) para facilitar retenção
- Configure ILM (Index Lifecycle Management) para rotacionar e deletar índices antigos
- Use \`auth\` com credenciais seguras quando o Elasticsearch requer autenticação`,
            },
            {
              id: "clickhouse-logger",
              title: "clickhouse-logger",
              body: `O plugin **clickhouse-logger** envia logs de acesso para o ClickHouse, um banco de dados columnar de alta performance ideal para análise de logs em grande escala.

**Quando usar:**
- Análise de logs em escala com ClickHouse
- Consultas analíticas rápidas sobre grandes volumes de dados
- Alternativa ao Elasticsearch para cenários de alta ingestão

**Configuração:**

\`\`\`json
{
  "endpoint_addr": "http://clickhouse:8123",
  "database": "api_gateway",
  "logtable": "access_logs",
  "user": "default",
  "password": "$secret://clickhouse-password",
  "batch_max_size": 500,
  "max_retry_count": 3
}
\`\`\`

A tabela no ClickHouse deve ser criada previamente com as colunas correspondentes aos campos do log. O plugin usa a interface HTTP do ClickHouse para inserção em batch.

**Boas práticas:**
- Use o engine \`MergeTree\` com particionamento por data para performance
- Configure \`batch_max_size\` alto (500-1000) para ingestão eficiente
- Crie materialized views para métricas agregadas pré-computadas`,
            },
            {
              id: "google-cloud-logging",
              title: "google-cloud-logging",
              body: `O plugin **google-cloud-logging** envia logs de acesso para o Google Cloud Logging (antigo Stackdriver), integrando com o ecossistema Google Cloud.

**Quando usar:**
- Gateways executando no Google Cloud (GKE, Compute Engine)
- Centralização de logs no Cloud Logging com integração nativa ao GCP
- Auditoria e compliance com logs gerenciados pelo Google

**Configuração:**

\`\`\`json
{
  "auth_config": {
    "project_id": "meu-projeto-gcp",
    "private_key": "$secret://gcp-private-key",
    "client_email": "gateway@meu-projeto.iam.gserviceaccount.com",
    "token_uri": "https://oauth2.googleapis.com/token"
  },
  "resource": {
    "type": "global"
  },
  "log_id": "api-gateway-logs",
  "batch_max_size": 100
}
\`\`\`

**Boas práticas:**
- Use service accounts com permissão mínima (roles/logging.logWriter)
- Configure \`resource.type\` adequadamente (ex: \`k8s_container\` para GKE)
- Aproveite log-based metrics para criar alertas no Cloud Monitoring`,
            },
            {
              id: "splunk-hec-logging",
              title: "splunk-hec-logging",
              body: `O plugin **splunk-hec-logging** envia logs de acesso para o Splunk via HTTP Event Collector (HEC), integrando com a plataforma Splunk para análise e SIEM.

**Quando usar:**
- Organizações que utilizam Splunk como SIEM ou plataforma de log
- Análise de segurança e detecção de ameaças baseada em logs de API
- Compliance e auditoria com Splunk Enterprise Security

**Configuração:**

\`\`\`json
{
  "endpoint": {
    "uri": "https://splunk.exemplo.com:8088/services/collector",
    "token": "$secret://splunk-hec-token"
  },
  "ssl_verify": true,
  "batch_max_size": 100,
  "max_retry_count": 3
}
\`\`\`

> **Nota:** O token HEC deve ser criado no Splunk com as permissões e index corretos antes de configurar o plugin.

**Boas práticas:**
- Configure SSL/TLS para criptografar logs em trânsito
- Defina o index correto no token HEC para organizar os dados no Splunk
- Use batch para reduzir overhead de conexões HTTP`,
            },
            {
              id: "skywalking-logger",
              title: "skywalking-logger",
              body: `O plugin **skywalking-logger** envia logs de acesso para o Apache SkyWalking OAP, complementando o tracing com logs correlacionados.

**Quando usar:**
- Ambientes que já usam SkyWalking para tracing e APM
- Correlação entre traces e logs na mesma plataforma
- Análise unificada de performance e logs no dashboard SkyWalking

**Configuração:**

\`\`\`json
{
  "endpoint_addr": "http://skywalking-oap:12800/v3/logs",
  "service_name": "fuseone-gateway",
  "service_instance_name": "gateway-node-1",
  "batch_max_size": 100
}
\`\`\`

**Boas práticas:**
- Use o mesmo \`service_name\` que o plugin \`skywalking\` de tracing
- Habilite ambos (skywalking + skywalking-logger) para traces e logs correlacionados
- Configure \`service_instance_name\` único por nó do gateway`,
            },
            {
              id: "loggly",
              title: "loggly",
              body: `O plugin **loggly** envia logs de acesso para o Loggly (SolarWinds) via protocolo syslog com token de autenticação.

**Quando usar:**
- Organizações que utilizam Loggly como SaaS de gerenciamento de logs
- Logging centralizado sem infraestrutura própria
- Análise e busca de logs com interface web simples

**Configuração:**

\`\`\`json
{
  "host": "logs-01.loggly.com",
  "port": 514,
  "customer_token": "$secret://loggly-token",
  "severity": "INFO",
  "batch_max_size": 100
}
\`\`\`

**Boas práticas:**
- Use tags customizadas para categorizar logs no Loggly
- Configure \`severity\` apropriada para facilitar a filtragem
- Monitore o volume de logs para não exceder os limites do plano`,
            },
            {
              id: "sls-logger",
              title: "sls-logger",
              body: `O plugin **sls-logger** envia logs de acesso para o Alibaba Cloud Log Service (SLS), integrando com o ecossistema Alibaba Cloud.

**Quando usar:**
- Gateways executando na Alibaba Cloud
- Centralização de logs no Alibaba Cloud SLS
- Análise de logs com interface nativa da Alibaba Cloud

**Configuração:**

\`\`\`json
{
  "host": "meu-projeto.cn-hangzhou.log.aliyuncs.com",
  "port": 10009,
  "project": "meu-projeto",
  "logstore": "api-gateway-logs",
  "access_key_id": "$secret://aliyun-access-key",
  "access_key_secret": "$secret://aliyun-secret-key"
}
\`\`\`

**Boas práticas:**
- Use RAM roles quando possível em vez de access keys estáticas
- Configure logstore com retenção adequada ao período de compliance
- Crie dashboards no SLS para monitoramento em tempo real`,
            },
            {
              id: "tencent-cloud-cls",
              title: "tencent-cloud-cls",
              body: `O plugin **tencent-cloud-cls** envia logs de acesso para o Tencent Cloud Log Service (CLS), integrando com o ecossistema Tencent Cloud.

**Quando usar:**
- Gateways executando na Tencent Cloud
- Centralização de logs no Tencent CLS
- Análise e alertas com as ferramentas nativas da Tencent Cloud

**Configuração:**

\`\`\`json
{
  "cls_host": "ap-guangzhou.cls.tencentcs.com",
  "cls_topic": "api-gateway-topic-id",
  "secret_id": "$secret://tencent-secret-id",
  "secret_key": "$secret://tencent-secret-key",
  "batch_max_size": 100,
  "max_retry_count": 3
}
\`\`\`

**Boas práticas:**
- Use CAM (Cloud Access Management) para permissões mínimas
- Configure alertas no CLS para detecção de anomalias
- Use \`batch_max_size\` para otimizar a ingestão`,
            },
            {
              id: "file-logger",
              title: "file-logger",
              body: `O plugin **file-logger** grava logs de acesso em um arquivo local no sistema de arquivos do gateway. É o plugin de logging mais simples, ideal para debugging e ambientes de desenvolvimento.

**Quando usar:**
- Debugging local durante desenvolvimento
- Ambientes sem infraestrutura de logging centralizado
- Backup local de logs como fallback
- Integração com ferramentas de coleta de logs baseadas em arquivo (Filebeat, Fluentd tail)

**Configuração:**

\`\`\`json
{
  "path": "/var/log/apisix/access.log"
}
\`\`\`

O campo \`path\` define o caminho do arquivo de log. O diretório deve existir e o processo do gateway deve ter permissão de escrita.

> **Atenção:** Em produção, use este plugin com moderação. Logs em disco podem crescer rapidamente e consumir todo o espaço disponível. Sempre configure logrotate ou mecanismo similar.

**Boas práticas:**
- Configure logrotate para rotacionar e comprimir logs antigos
- Use em conjunto com Filebeat ou Fluentd para enviar logs ao sistema centralizado
- Defina um path em um volume separado para não afetar o disco do sistema`,
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
        "Gerencie e controle o acesso a Large Language Models (LLMs) com proxy, rate limiting por tokens e moderação de conteúdo.",
      icon: "Brain",
      tags: ["ia", "llm", "ai-proxy", "tokens"],
      content: [
        {
          id: "visao-geral-ia",
          title: "Visão Geral",
          body: `Os plugins de IA transformam o API Gateway em um **AI Gateway**, fornecendo uma camada unificada para gerenciar acesso a provedores de modelos de linguagem (LLMs) como OpenAI, Anthropic, Azure OpenAI, AWS Bedrock e outros.

Com estes plugins você pode:

- Abstrair múltiplos provedores de IA atrás de uma única API
- Controlar custos com rate limiting baseado em tokens
- Proteger seus modelos com guardrails de conteúdo
- Implementar RAG (Retrieval-Augmented Generation) no gateway
- Moderar conteúdo com integração AWS Comprehend

Plugins disponíveis:

- **ai-proxy**: Proxy reverso para provedores de IA (OpenAI, Anthropic, etc.)
- **ai-proxy-multi**: Failover e load balancing entre múltiplos provedores
- **ai-prompt-guard**: Filtros de entrada para bloquear prompts maliciosos
- **ai-request-rewrite**: Transformação de requisições para IA
- **ai-rate-limiting**: Rate limiting por contagem de tokens
- **ai-rag**: Integração com bases de conhecimento para RAG
- **ai-aws-content-moderation**: Moderação de conteúdo via AWS Comprehend

> **Nota:** Os plugins de IA exigem que o upstream seja um provedor de LLM. Eles não funcionam com APIs REST convencionais.`,
          subsections: [
            {
              id: "ai-proxy",
              title: "ai-proxy",
              body: `O plugin **ai-proxy** atua como proxy reverso para provedores de IA, traduzindo requisições no formato padrão OpenAI para o formato específico de cada provedor.

**Quando usar:**
- Centralizar o acesso a provedores de IA através do gateway
- Abstrair diferenças entre provedores (OpenAI, Anthropic, Azure, Bedrock)
- Aplicar políticas de segurança e rate limiting nas chamadas de IA
- Registrar e auditar todas as interações com modelos de linguagem

**Configuração (OpenAI):**

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

**Configuração (Anthropic):**

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

> **Dica:** Use variáveis de ambiente (\`\${{VAR}}\`) para as chaves de API em vez de valores hardcoded. Isso permite rotacionar chaves sem alterar a configuração do gateway.

**Boas práticas:**
- Configure timeouts mais longos para chamadas de IA (30-120 segundos)
- Habilite streaming (\`stream: true\`) para melhorar a experiência do usuário
- Monitore o uso de tokens para controlar custos
- Use junto com \`ai-prompt-guard\` para proteção adicional`,
            },
            {
              id: "ai-proxy-multi",
              title: "ai-proxy-multi",
              body: `O plugin **ai-proxy-multi** permite configurar failover e load balancing entre múltiplos provedores de IA. Se um provedor falhar ou atingir o limite de taxa, o tráfego é redirecionado automaticamente para o próximo.

**Quando usar:**
- Alta disponibilidade para serviços de IA críticos
- Balancear carga entre provedores para otimizar custos
- Failover automático quando um provedor está indisponível
- Testes comparativos entre modelos de diferentes provedores

**Configuração:**

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

A estratégia \`weighted\` distribui o tráfego com base nos pesos. A \`priority\` define a ordem de failover — se o provedor de prioridade 1 falhar, o tráfego vai para o de prioridade 2.

> **Nota:** O plugin detecta automaticamente erros 429 (rate limit) e 5xx dos provedores e redireciona o tráfego.

**Boas práticas:**
- Defina pesos com base no custo e performance de cada provedor
- Configure pelo menos 2 provedores para garantir disponibilidade
- Monitore métricas de failover para identificar provedores problemáticos
- Use modelos equivalentes em diferentes provedores para consistência`,
            },
            {
              id: "ai-prompt-guard",
              title: "ai-prompt-guard",
              body: `O plugin **ai-prompt-guard** filtra e valida os prompts enviados pelos usuários antes de encaminhá-los ao provedor de IA. Ele protege contra prompt injection, jailbreak e conteúdo inapropriado.

**Quando usar:**
- Aplicações de IA voltadas para o público
- Cenários onde prompt injection pode causar danos (ex: acessar dados privados)
- Compliance com políticas de uso aceitável
- Proteção contra jailbreak de system prompts

**Configuração:**

\`\`\`json
{
  "deny_patterns": [
    "ignore previous instructions",
    "ignore todas as instruções",
    "system prompt",
    "DAN mode"
  ],
  "allow_patterns": [],
  "max_prompt_length": 10000,
  "action": "reject",
  "rejected_msg": "Prompt bloqueado por política de segurança."
}
\`\`\`

O campo \`deny_patterns\` lista padrões que serão bloqueados (suporta regex). O \`max_prompt_length\` limita o tamanho do prompt para evitar abusos. A \`action\` pode ser \`reject\` (bloquear) ou \`warn\` (logar e permitir).

> **Atenção:** Nenhum filtro de prompt é 100% eficaz. Use o prompt guard como uma camada de defesa, não como única proteção. Combine com moderação de conteúdo e system prompts robustos.

**Boas práticas:**
- Mantenha os padrões de bloqueio atualizados com novas técnicas de ataque
- Registre prompts bloqueados para análise e melhoria dos filtros
- Use a ação \`warn\` em desenvolvimento para identificar falsos positivos
- Combine com \`ai-aws-content-moderation\` para proteção mais abrangente`,
            },
            {
              id: "ai-request-rewrite",
              title: "ai-request-rewrite",
              body: `O plugin **ai-request-rewrite** permite transformar a requisição antes de enviá-la ao provedor de IA. Você pode injetar system prompts, modificar parâmetros e padronizar o formato.

**Quando usar:**
- Injetar system prompts padrão em todas as requisições
- Adicionar contexto (nome do usuário, idioma, regras de negócio)
- Padronizar parâmetros como temperature, max_tokens e top_p
- Transformar formatos de requisição entre clientes e provedores

**Configuração:**

\`\`\`json
{
  "system_prompt": "Você é um assistente especializado em suporte técnico. Responda sempre em português, de forma clara e objetiva.",
  "prepend_messages": [
    {
      "role": "system",
      "content": "Data atual: {{current_date}}. Usuário: {{header.X-User-Name}}."
    }
  ],
  "override_params": {
    "temperature": 0.3,
    "max_tokens": 2048
  }
}
\`\`\`

O campo \`system_prompt\` é adicionado como primeira mensagem do tipo system. Os \`prepend_messages\` são inseridos antes das mensagens do usuário. O \`override_params\` sobrescreve parâmetros da requisição original.

> **Dica:** Use templates com variáveis (\`{{header.X-User-Name}}\`) para personalizar o contexto de cada requisição.

**Boas práticas:**
- Centralize os system prompts no gateway para facilitar a manutenção
- Use \`override_params\` para garantir que os clientes não configurem valores inseguros
- Versione os system prompts para facilitar rollback
- Teste as transformações com diferentes formatos de entrada`,
            },
            {
              id: "ai-rate-limiting",
              title: "ai-rate-limiting",
              body: `O plugin **ai-rate-limiting** implementa rate limiting baseado na contagem de tokens consumidos, em vez de simples contagem de requisições. Isso é essencial para controlar custos de APIs de IA.

**Quando usar:**
- Controlar o gasto com provedores de IA por consumidor ou aplicação
- Definir cotas de tokens diárias/mensais por plano
- Prevenir que um único usuário consuma todos os tokens disponíveis
- Otimizar o orçamento de IA da organização

**Configuração:**

\`\`\`json
{
  "limit": 100000,
  "time_window": 86400,
  "key": "consumer_name",
  "token_counting": "actual",
  "rejected_code": 429,
  "rejected_msg": "Cota de tokens excedida. Seu limite diário foi atingido."
}
\`\`\`

O campo \`limit\` define o número máximo de tokens no período. O \`token_counting\` pode ser \`actual\` (conta tokens reais da resposta) ou \`estimated\` (estima antes de enviar). O \`time_window\` é em segundos (86400 = 1 dia).

**Headers de resposta:**
- \`X-AI-RateLimit-Limit-Tokens\`: Cota total de tokens
- \`X-AI-RateLimit-Remaining-Tokens\`: Tokens restantes
- \`X-AI-RateLimit-Reset\`: Segundos até o reset

> **Nota:** O modo \`actual\` é mais preciso mas só aplica o limite após a resposta. O modo \`estimated\` pode bloquear antes, evitando custos, mas pode ser menos preciso.

**Boas práticas:**
- Use cotas diferentes para diferentes planos de consumidores
- Monitore o consumo de tokens diariamente para ajustar limites
- Configure alertas quando um consumidor atingir 80% da cota
- Use Redis como backend para contadores compartilhados entre nós`,
            },
            {
              id: "ai-rag",
              title: "ai-rag",
              body: `O plugin **ai-rag** (Retrieval-Augmented Generation) enriquece os prompts com informações relevantes de uma base de conhecimento vetorial antes de enviar ao provedor de IA.

**Quando usar:**
- Chatbots com conhecimento específico da empresa
- Assistentes que precisam consultar documentação interna
- Respostas baseadas em dados atualizados (não limitadas ao treinamento do modelo)
- Cenários onde alucinações do modelo são inaceitáveis

**Configuração:**

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
  "context_template": "Use as seguintes informações como referência para responder:\\n\\n{{context}}"
}
\`\`\`

O fluxo do RAG no gateway: (1) O prompt do usuário é convertido em embedding, (2) Os documentos mais similares são recuperados da base vetorial, (3) O contexto é injetado no prompt, (4) O prompt enriquecido é enviado ao LLM.

> **Dica:** Ajuste o \`similarity_threshold\` para balancear entre relevância (valor alto) e cobertura (valor baixo). Comece com 0.7 e ajuste conforme necessário.

**Boas práticas:**
- Mantenha a base de conhecimento atualizada com pipelines de indexação
- Use \`top_k\` entre 3 e 10 para não sobrecarregar o contexto
- Monitore a qualidade das respostas e ajuste o threshold
- Considere o limite de tokens do modelo ao definir \`top_k\``,
            },
            {
              id: "ai-aws-content-moderation",
              title: "ai-aws-content-moderation",
              body: `O plugin **ai-aws-content-moderation** utiliza o Amazon Comprehend para analisar e moderar o conteúdo dos prompts e respostas de IA, detectando linguagem tóxica, ofensiva ou inapropriada.

**Quando usar:**
- Aplicações de IA públicas que exigem moderação de conteúdo
- Compliance com regulamentações sobre conteúdo gerado por IA
- Proteção da marca contra respostas ofensivas ou inapropriadas
- Ambientes educacionais ou corporativos com políticas de conteúdo

**Configuração:**

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

O campo \`moderation_categories\` define quais categorias de conteúdo serão monitoradas. O \`threshold\` (0.0 a 1.0) define a sensibilidade — valores mais altos são menos restritivos. Com \`check_input\` e \`check_output\`, você controla se a moderação ocorre na entrada, saída ou ambas.

> **Nota:** A moderação de saída (\`check_output\`) adiciona latência pois aguarda a resposta completa do LLM antes de analisar. Para streaming, apenas a moderação de entrada é aplicada em tempo real.

**Boas práticas:**
- Habilite \`check_input\` e \`check_output\` para proteção completa
- Ajuste o \`threshold\` de acordo com a sensibilidade do seu caso de uso
- Registre conteúdo moderado para análise e melhoria dos filtros
- Use junto com \`ai-prompt-guard\` para camadas complementares de proteção
- Considere o custo adicional das chamadas ao AWS Comprehend no cálculo de custos`,
            },
          ],
        },
      ],
    },
    // ── 7. Plugins de GraphQL ────────────────────────────────────
    {
      slug: "plugins-graphql",
      title: "Plugins de GraphQL",
      description:
        "Proteja e otimize APIs GraphQL com limites de profundidade, análise de complexidade e controle de consultas.",
      icon: "Braces",
      tags: ["graphql", "segurança", "performance", "allowlist"],
      content: [
        {
          id: "visao-geral-graphql",
          title: "Visão Geral",
          body: `Os plugins de GraphQL adicionam camadas de segurança e controle para APIs GraphQL servidas pelo gateway. GraphQL é poderoso mas introduz riscos únicos — consultas recursivas podem derrubar o backend e introspection pode expor o schema inteiro.

O API Gateway oferece os seguintes plugins para proteger APIs GraphQL:

- **degraphql**: Converte endpoints REST em consultas GraphQL pré-definidas
- **graphql-depth-limit**: Limita a profundidade de aninhamento das consultas
- **graphql-complexity**: Análise de custo/complexidade com pesos por campo
- **graphql-allowlist**: Permite apenas consultas pré-registradas (persisted queries)
- **graphql-introspection-guard**: Bloqueia consultas de introspection em produção

> **Dica:** Para APIs GraphQL em produção, habilite pelo menos \`graphql-depth-limit\` e \`graphql-introspection-guard\` como proteção básica. Para máxima segurança, use \`graphql-allowlist\` com persisted queries.`,
          subsections: [
            {
              id: "degraphql",
              title: "degraphql",
              body: `O plugin **degraphql** permite expor endpoints REST que internamente executam consultas GraphQL pré-definidas. O cliente faz uma chamada REST simples e o gateway traduz para a consulta GraphQL correspondente.

**Quando usar:**
- Oferecer uma interface REST para clientes que não suportam GraphQL
- Simplificar o consumo de APIs GraphQL para equipes frontend
- Criar endpoints específicos com consultas otimizadas
- Migrar gradualmente de REST para GraphQL sem quebrar clientes existentes

**Configuração:**

\`\`\`json
{
  "query": "query GetUser($id: ID!) { user(id: $id) { id name email createdAt } }",
  "variables": ["id"]
}
\`\`\`

Com esta configuração, uma chamada \`GET /api/users/123\` é traduzida automaticamente para a consulta GraphQL com \`$id = "123"\`. A resposta GraphQL é retornada como JSON REST padrão.

> **Dica:** Use o degraphql para criar uma camada REST sobre seu backend GraphQL, oferecendo a simplicidade de REST com o poder de GraphQL internamente.

**Boas práticas:**
- Defina consultas otimizadas que buscam apenas os campos necessários
- Documente os endpoints REST gerados para os consumidores
- Use variáveis para parâmetros dinâmicos (path params, query params)`,
            },
            {
              id: "graphql-depth-limit",
              title: "graphql-depth-limit",
              body: `O plugin **graphql-depth-limit** limita a profundidade máxima de aninhamento de consultas GraphQL. Previne ataques de consultas recursivas que podem sobrecarregar o backend.

**Quando usar:**
- Toda API GraphQL em produção (proteção básica obrigatória)
- Prevenir ataques de profundidade infinita (\`{ user { friends { friends { friends ... } } } }\`)
- Limitar a complexidade de consultas em schemas com relacionamentos circulares

**Configuração:**

\`\`\`json
{
  "max_depth": 10,
  "rejected_code": 400,
  "rejected_msg": "Consulta excede a profundidade máxima permitida."
}
\`\`\`

O campo \`max_depth\` define o nível máximo de aninhamento. Uma consulta \`{ user { name } }\` tem profundidade 2. Uma consulta \`{ user { orders { items { product { name } } } } }\` tem profundidade 5.

> **Atenção:** Sem este plugin, um atacante pode enviar consultas com centenas de níveis de aninhamento, consumindo CPU e memória exponencialmente no backend GraphQL.

**Boas práticas:**
- Analise as consultas legítimas do seu schema para definir um limite realista
- Comece com um limite generoso (10-15) e reduza conforme necessário
- Combine com \`graphql-complexity\` para proteção mais granular`,
            },
            {
              id: "graphql-complexity",
              title: "graphql-complexity",
              body: `O plugin **graphql-complexity** implementa análise de custo baseada em complexidade para consultas GraphQL. Cada campo tem um peso associado e a consulta é rejeitada se o custo total exceder o limite.

**Quando usar:**
- APIs GraphQL onde a profundidade não é suficiente para medir o custo real
- Schemas com campos que retornam listas grandes (paginação obrigatória)
- Prevenir consultas que buscam muitos dados mesmo com profundidade baixa
- Cenários onde diferentes campos têm custos de processamento muito diferentes

**Configuração:**

\`\`\`json
{
  "max_complexity": 100,
  "default_field_cost": 1,
  "field_costs": {
    "Query.users": 10,
    "Query.orders": 15,
    "User.transactions": 20,
    "Order.items": 5
  },
  "list_multiplier": true,
  "rejected_code": 400
}
\`\`\`

O campo \`field_costs\` define pesos customizados por campo. Com \`list_multiplier: true\`, campos que retornam listas multiplicam o custo pelo argumento \`first\` ou \`limit\`. Por exemplo, \`users(first: 50)\` com custo 10 = 500 de complexidade.

> **Dica:** Atribua custos maiores a campos que envolvem junções no banco, chamadas a serviços externos ou processamento pesado.

**Boas práticas:**
- Comece com custos padrão e ajuste baseado no tempo de resposta real de cada campo
- Habilite \`list_multiplier\` para penalizar consultas que buscam muitos itens
- Retorne o custo da consulta em um header para que clientes otimizem suas queries
- Combine com \`graphql-depth-limit\` para proteção em múltiplas dimensões`,
            },
            {
              id: "graphql-allowlist",
              title: "graphql-allowlist",
              body: `O plugin **graphql-allowlist** implementa persisted queries, permitindo apenas consultas GraphQL pré-registradas. Qualquer consulta que não esteja na lista é rejeitada.

**Quando usar:**
- APIs GraphQL em produção com segurança máxima
- Prevenir qualquer consulta arbitrária de ser executada
- Controlar exatamente quais dados podem ser consultados
- Ambientes regulados que exigem controle total sobre as operações

**Configuração:**

\`\`\`json
{
  "allowed_queries": [
    {
      "id": "getUser",
      "query": "query GetUser($id: ID!) { user(id: $id) { id name email } }"
    },
    {
      "id": "listOrders",
      "query": "query ListOrders($userId: ID!, $first: Int) { orders(userId: $userId, first: $first) { id total status } }"
    }
  ],
  "rejected_code": 403,
  "rejected_msg": "Consulta não autorizada. Use uma consulta registrada."
}
\`\`\`

Os clientes podem enviar consultas pelo \`id\` (hash) em vez do texto completo, economizando bandwidth e garantindo que apenas consultas aprovadas são executadas.

> **Nota:** O allowlist é a forma mais segura de proteger uma API GraphQL, mas requer que todas as consultas sejam registradas previamente. É ideal para APIs internas com clientes conhecidos.

**Boas práticas:**
- Gere os IDs das consultas a partir de um hash do texto (SHA-256)
- Automatize o registro de queries no pipeline de deploy do frontend
- Use em conjunto com persisted queries no Apollo Client ou similar
- Mantenha uma lista versionada das consultas aprovadas`,
            },
            {
              id: "graphql-introspection-guard",
              title: "graphql-introspection-guard",
              body: `O plugin **graphql-introspection-guard** bloqueia consultas de introspection (\`__schema\`, \`__type\`) em ambientes de produção, prevenindo que atacantes descubram o schema completo da sua API.

**Quando usar:**
- Toda API GraphQL exposta à internet (proteção obrigatória em produção)
- Prevenir vazamento do schema para atacantes
- Compliance com políticas de segurança que exigem ocultação do schema
- Ambientes de produção onde o schema não deve ser exposto publicamente

**Configuração:**

\`\`\`json
{
  "rejected_code": 400,
  "rejected_msg": "Introspection não é permitida neste ambiente."
}
\`\`\`

O plugin detecta automaticamente consultas que incluem \`__schema\` ou \`__type\` e as bloqueia com a mensagem configurada.

> **Atenção:** Em desenvolvimento, a introspection é essencial para ferramentas como GraphiQL, Apollo Explorer e Postman. Habilite este plugin apenas em produção.

**Boas práticas:**
- Habilite em produção, desabilite em desenvolvimento e staging
- Forneça documentação da API por outros meios (Swagger/AsyncAPI gerado, portal de desenvolvedor)
- Combine com \`graphql-allowlist\` para máxima segurança`,
            },
          ],
        },
      ],
    },
  ],
}
