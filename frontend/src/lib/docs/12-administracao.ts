import type { DocCategory } from "./types"

export const administracaoCategory: DocCategory = {
  slug: "administracao",
  title: "Administracao",
  description:
    "Gerencie usuarios, permissoes, provedores OAuth, configuracoes do sistema e audit log.",
  icon: "Settings",
  articles: [
    {
      slug: "usuarios-rbac",
      title: "Usuarios e Controle de Acesso",
      description:
        "Gerenciamento de usuarios, roles integradas e sistema de permissoes granulares.",
      icon: "Users",
      tags: ["usuarios", "rbac", "permissoes", "roles"],
      content: [
        {
          id: "gerenciamento-usuarios",
          title: "Gerenciamento de Usuarios",
          body: `O FuseOne possui um sistema completo de gerenciamento de usuarios integrado ao dashboard. Usuarios sao criados e gerenciados em **Configuracoes > Usuarios**.

Para criar um novo usuario:

- Clique em **Novo Usuario** e preencha nome, e-mail e senha inicial.
- Atribua uma ou mais **roles** ao usuario.
- O usuario recebera um e-mail com instrucoes de acesso (se o envio de e-mails estiver configurado).

Operacoes disponiveis:

- **Editar** — alterar nome, e-mail e roles do usuario.
- **Desativar** — bloqueia o acesso sem excluir o registro (util para afastamentos temporarios).
- **Excluir** — remove permanentemente o usuario e revoga todas as sessoes ativas.
- **Redefinir senha** — gera um link de redefinicao enviado por e-mail.

> **Nota:** O usuario administrador criado durante a instalacao inicial nao pode ser excluido, mas pode ter suas roles alteradas. Garanta que ao menos um usuario com role \`admin\` esteja sempre ativo.

A lista de usuarios exibe o status de cada um (ativo, desativado), a ultima data de login e as roles atribuidas.`,
        },
        {
          id: "roles-integradas",
          title: "Roles Integradas",
          body: `O FuseOne inclui tres roles padrao que cobrem os cenarios mais comuns:

- **admin** — acesso total ao sistema. Pode gerenciar usuarios, configuracoes, ambientes e todos os recursos do gateway. Indicada para administradores de plataforma e DevOps leads.
- **editor** — pode criar, editar e excluir recursos do gateway (rotas, upstreams, plugins), mas nao tem acesso a configuracoes de sistema ou gerenciamento de usuarios. Indicada para desenvolvedores de APIs e engenheiros de plataforma.
- **viewer** — acesso somente leitura a todos os recursos. Pode visualizar rotas, upstreams, plugins, metricas e logs, mas nao pode modificar nada. Indicada para stakeholders, auditores e equipes de suporte.

Tabela de permissoes por role:

- \`admin\` — \`*:read\`, \`*:write\`, \`users:write\`, \`settings:write\`
- \`editor\` — \`routes:read\`, \`routes:write\`, \`upstreams:read\`, \`upstreams:write\`, \`plugins:read\`, \`plugins:write\`, \`consumers:read\`, \`consumers:write\`
- \`viewer\` — \`routes:read\`, \`upstreams:read\`, \`plugins:read\`, \`consumers:read\`, \`metrics:read\`

> **Dica:** Atribua a role com o menor privilegio necessario para cada usuario. Isso segue o principio de menor privilegio e reduz a superficie de ataque em caso de comprometimento de credenciais.`,
        },
        {
          id: "sistema-permissoes",
          title: "Sistema de Permissoes",
          body: `O sistema de permissoes do FuseOne e baseado no modelo RBAC (Role-Based Access Control). Cada permissao segue o formato \`{recurso}:{acao}\`, onde:

- **recurso** — o tipo de objeto (ex: \`routes\`, \`upstreams\`, \`plugins\`, \`consumers\`, \`users\`, \`settings\`, \`metrics\`).
- **acao** — \`read\` para visualizacao ou \`write\` para criacao, edicao e exclusao.

Exemplos de permissoes:

- \`routes:read\` — visualizar a lista de rotas e seus detalhes.
- \`routes:write\` — criar, editar e excluir rotas.
- \`users:write\` — gerenciar usuarios e roles.
- \`settings:write\` — alterar configuracoes do sistema.
- \`metrics:read\` — acessar dashboards de metricas e monitoramento.

O middleware de autorizacao verifica as permissoes do usuario autenticado em cada requisicao a API. Se o usuario nao possuir a permissao necessaria, a resposta sera \`403 Forbidden\`.

> **Nota:** Permissoes sao avaliadas no nivel da role. Um usuario herda todas as permissoes de todas as roles que lhe foram atribuidas. Se um usuario possui tanto a role \`viewer\` quanto a role \`editor\`, ele tera a uniao das permissoes de ambas.`,
        },
        {
          id: "roles-customizadas",
          title: "Criando Roles Customizadas",
          body: `Alem das roles integradas, voce pode criar roles customizadas para atender cenarios especificos da sua organizacao.

Para criar uma nova role, acesse **Configuracoes > Roles** e clique em **Nova Role**:

- **Nome** — identificador unico da role (ex: \`api-reviewer\`, \`metrics-analyst\`).
- **Descricao** — explique o proposito da role para facilitar a gestao.
- **Permissoes** — selecione as permissoes individuais que esta role concedera.

Exemplos de roles customizadas uteis:

- **metrics-analyst** — \`metrics:read\`, \`routes:read\` — ideal para equipes de monitoramento que precisam visualizar metricas mas nao devem alterar configuracoes.
- **api-publisher** — \`routes:read\`, \`routes:write\`, \`upstreams:read\` — para desenvolvedores que publicam rotas mas nao gerenciam upstreams.
- **security-auditor** — \`routes:read\`, \`plugins:read\`, \`consumers:read\`, \`metrics:read\` — para equipes de seguranca que revisam configuracoes.

\`\`\`
POST /api/roles
{
  "name": "metrics-analyst",
  "description": "Acesso somente leitura a metricas e rotas",
  "permissions": ["metrics:read", "routes:read"]
}
\`\`\`

> **Atencao:** Roles customizadas nao podem incluir a permissao \`users:write\` ou \`settings:write\` a menos que o criador tenha a role \`admin\`. Isso evita escalacao de privilegios.`,
        },
      ],
    },
    {
      slug: "oauth-sso",
      title: "Provedores OAuth e SSO",
      description:
        "Configure login social via provedores OAuth e integre Single Sign-On (SSO) ao FuseOne.",
      icon: "KeyRound",
      tags: ["oauth", "sso", "google", "github"],
      content: [
        {
          id: "configurando-oauth",
          title: "Configurando Provedores OAuth",
          body: `O FuseOne suporta autenticacao via provedores OAuth 2.0, permitindo que usuarios facam login com suas contas corporativas ou de servicos populares.

Provedores suportados:

- **Google** — login com conta Google Workspace ou Gmail.
- **GitHub** — login com conta GitHub, ideal para equipes de desenvolvimento.
- **Microsoft (Azure AD)** — login com contas corporativas Microsoft 365.
- **Provedor customizado** — qualquer provedor compativel com OAuth 2.0 / OpenID Connect.

Para configurar um provedor, acesse **Configuracoes > OAuth** e clique em **Novo Provedor**:

- **Nome** — nome de exibicao no botao de login (ex: "Login com Google").
- **Client ID** — identificador da aplicacao registrada no provedor.
- **Client Secret** — segredo da aplicacao (armazenado de forma criptografada).
- **Authorization URL** — URL de autorizacao do provedor.
- **Token URL** — URL para troca do codigo de autorizacao pelo token de acesso.
- **Scopes** — escopos solicitados (ex: \`openid email profile\`).

> **Dica:** Para Google, registre a aplicacao em [console.cloud.google.com](https://console.cloud.google.com) e configure a URL de callback como \`https://seu-fuseone.com/auth/oauth/callback\`.`,
        },
        {
          id: "fluxo-sso",
          title: "Fluxo de Login SSO",
          body: `Quando um provedor OAuth esta configurado, um botao de login social aparece na tela de autenticacao do FuseOne. O fluxo funciona da seguinte forma:

- O usuario clica em "Login com [Provedor]" na tela de login.
- O navegador redireciona para a pagina de autorizacao do provedor.
- O usuario autentica com suas credenciais do provedor.
- O provedor redireciona de volta ao FuseOne com um codigo de autorizacao.
- O FuseOne troca o codigo por um token de acesso e obtem o perfil do usuario.
- Se o e-mail do usuario ja esta cadastrado no FuseOne, o login e realizado automaticamente.
- Se o e-mail nao esta cadastrado, o comportamento depende da configuracao de **auto-provisionamento**.

Opcoes de auto-provisionamento:

- **Desativado** — apenas usuarios pre-cadastrados podem fazer login via SSO. Usuarios nao encontrados recebem uma mensagem de erro.
- **Ativado com role padrao** — usuarios novos sao criados automaticamente com uma role definida (ex: \`viewer\`).
- **Ativado com mapeamento** — usuarios sao criados com roles baseadas em atributos do provedor (ex: grupo do Google Workspace).

> **Nota:** O auto-provisionamento facilita o onboarding mas pode criar usuarios indesejados. Use filtros de dominio de e-mail para restringir quem pode ser provisionado automaticamente.`,
        },
        {
          id: "mapeamento-roles",
          title: "Mapeamento de Identidades Externas",
          body: `O FuseOne permite mapear atributos do provedor OAuth para roles internas. Isso e especialmente util em organizacoes que ja possuem grupos definidos no provedor de identidade.

Exemplos de mapeamento:

- Grupo \`engineering\` no Google Workspace → role \`editor\` no FuseOne.
- Grupo \`platform-admins\` no Azure AD → role \`admin\` no FuseOne.
- Organizacao \`my-org\` no GitHub → role \`viewer\` no FuseOne.

Para configurar o mapeamento, acesse **Configuracoes > OAuth > [Provedor] > Mapeamento de Roles**:

- Defina regras com base em **claims** do token de identidade (ex: \`groups\`, \`org\`, \`department\`).
- Cada regra mapeia um valor de claim para uma role do FuseOne.
- Multiplas regras podem ser criadas; a primeira regra correspondente e aplicada.

\`\`\`
PUT /api/oauth-providers/{id}/role-mappings
{
  "mappings": [
    { "claim": "groups", "value": "platform-admins", "role": "admin" },
    { "claim": "groups", "value": "engineering", "role": "editor" },
    { "claim": "groups", "value": "*", "role": "viewer" }
  ]
}
\`\`\`

> **Atencao:** O mapeamento de roles e avaliado apenas no momento do login. Se os grupos do usuario mudarem no provedor externo, as novas roles serao aplicadas no proximo login. Para sincronizacao em tempo real, considere usar webhooks do provedor de identidade.`,
        },
      ],
    },
    {
      slug: "configuracoes-sistema",
      title: "Configuracoes do Sistema",
      description:
        "Ajuste configuracoes de JWT, sessoes, paginacao, contatos de notificacao e preferencias gerais.",
      icon: "Cog",
      tags: ["configuracoes", "sistema", "notificacoes"],
      content: [
        {
          id: "configuracoes-gerais",
          title: "Configuracoes Gerais",
          body: `As configuracoes gerais do sistema ficam em **Configuracoes > Geral** e controlam o comportamento global do FuseOne.

Parametros disponiveis:

- **JWT Secret** — chave secreta usada para assinar tokens JWT de autenticacao. Deve ser uma string longa e aleatoria. Alterar essa chave invalida todos os tokens ativos.
- **Duracao da sessao** — tempo de validade do token JWT em horas (padrao: 24h). Apos expirar, o usuario precisa fazer login novamente.
- **Paginacao de APIs** — numero de itens por pagina nas listagens do dashboard (padrao: 20). Valores entre 10 e 100.
- **Fuso horario** — fuso horario usado para exibicao de datas e horarios no dashboard e nos relatorios.
- **Idioma padrao** — idioma da interface do dashboard (Portugues ou Ingles).

\`\`\`
PUT /api/settings
{
  "jwt_expiry_hours": 24,
  "pagination_size": 20,
  "timezone": "America/Sao_Paulo",
  "language": "pt-BR"
}
\`\`\`

> **Atencao:** A alteracao do **JWT Secret** deve ser feita com cuidado, pois todos os usuarios serao deslogados imediatamente. Planeje essa alteracao para um horario de baixo uso.

Todas as configuracoes tambem podem ser definidas via variaveis de ambiente, que tem precedencia sobre os valores salvos no banco de dados.`,
        },
        {
          id: "contatos-notificacao",
          title: "Contatos de Notificacao",
          body: `O FuseOne envia notificacoes para eventos importantes como alertas de metricas, solicitacoes de aprovacao de promocoes e incidentes de seguranca. Os contatos de notificacao definem para onde essas notificacoes sao enviadas.

Tipos de contato suportados:

- **E-mail** — envia notificacoes para um endereco de e-mail. Requer configuracao de SMTP em **Configuracoes > Geral > E-mail**.
- **Slack** — envia mensagens para um canal Slack via webhook. Basta informar a URL do webhook.
- **Webhook generico** — envia um payload JSON para qualquer URL. Util para integrar com sistemas internos, Microsoft Teams, PagerDuty, etc.

Para criar um contato, acesse **Configuracoes > Notificacoes** e clique em **Novo Contato**:

- **Nome** — identificador do contato (ex: "Equipe SRE - Slack").
- **Tipo** — selecione entre E-mail, Slack ou Webhook.
- **Destino** — endereco de e-mail, URL do webhook Slack ou URL generica.
- **Eventos** — quais tipos de eventos acionam este contato (alertas, promocoes, seguranca, todos).

> **Dica:** Crie contatos separados para diferentes tipos de eventos. Por exemplo, alertas de metricas podem ir para o canal do Slack da equipe SRE, enquanto solicitacoes de aprovacao vao para o e-mail dos tech leads.

Voce pode testar qualquer contato clicando em **Enviar Teste** para verificar se a configuracao esta correta.`,
        },
        {
          id: "configuracao-email",
          title: "Configuracao de E-mail (SMTP)",
          body: `Para que o FuseOne envie notificacoes por e-mail (alertas, convites de usuario, redefinicao de senha), e necessario configurar um servidor SMTP.

Acesse **Configuracoes > Geral > E-mail** e preencha:

- **Host SMTP** — endereco do servidor de e-mail (ex: \`smtp.gmail.com\`, \`smtp.sendgrid.net\`).
- **Porta** — porta do servidor SMTP (587 para TLS, 465 para SSL, 25 para sem criptografia).
- **Usuario** — usuario de autenticacao SMTP.
- **Senha** — senha de autenticacao SMTP (armazenada de forma criptografada).
- **Remetente** — endereco de e-mail exibido como remetente (ex: \`noreply@suaempresa.com\`).
- **TLS** — habilitar criptografia TLS (fortemente recomendado).

Configuracao via variaveis de ambiente:

\`\`\`
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@suaempresa.com
SMTP_PASS=sua-senha-app
SMTP_FROM=noreply@suaempresa.com
SMTP_TLS=true
\`\`\`

> **Dica:** Para Gmail, use uma "Senha de App" em vez da senha da conta. Para ambientes de producao, recomendamos servicos transacionais como SendGrid, Mailgun ou Amazon SES, que oferecem maior confiabilidade e rastreabilidade.

Apos configurar, use o botao **Enviar E-mail de Teste** para validar a conexao.`,
        },
      ],
    },
    {
      slug: "audit-log",
      title: "Audit Log",
      description:
        "Rastreabilidade completa de todas as acoes realizadas no sistema, com filtros e retencao configuravel.",
      icon: "ScrollText",
      tags: ["audit", "log", "rastreabilidade"],
      content: [
        {
          id: "o-que-captura",
          title: "O que o Audit Log Captura",
          body: `O Audit Log registra automaticamente todas as acoes realizadas por usuarios no FuseOne. Cada entrada no log contem:

- **Timestamp** — data e hora exatas da acao, com precisao de milissegundos.
- **Usuario** — quem realizou a acao (nome, e-mail e ID do usuario).
- **Acao** — tipo de operacao realizada (\`create\`, \`update\`, \`delete\`, \`login\`, \`logout\`).
- **Recurso** — tipo e identificador do recurso afetado (ex: \`route:123\`, \`upstream:456\`).
- **Detalhes** — payload com os valores anteriores e posteriores (para acoes de edicao), permitindo rastrear exatamente o que mudou.
- **IP de origem** — endereco IP de onde a requisicao foi feita.
- **User Agent** — navegador ou ferramenta utilizada para a acao.

Eventos registrados automaticamente:

- Criacao, edicao e exclusao de rotas, upstreams, plugins e consumidores.
- Login e logout de usuarios.
- Alteracoes em configuracoes do sistema.
- Criacao e alteracao de usuarios e roles.
- Solicitacoes e aprovacoes de promocoes entre ambientes.
- Alteracoes em provedores OAuth.

> **Nota:** O audit log e gravado de forma assincrona e nao bloqueante. Isso significa que ele nao impacta a performance das operacoes normais do sistema.`,
        },
        {
          id: "visualizando-eventos",
          title: "Visualizando Eventos de Auditoria",
          body: `Para acessar o audit log, navegue ate **Configuracoes > Audit Log** no dashboard. A interface exibe uma lista cronologica de eventos com as seguintes colunas:

- **Data/Hora** — quando o evento ocorreu.
- **Usuario** — quem realizou a acao.
- **Acao** — tipo de operacao (com badge colorido: verde para criacao, amarelo para edicao, vermelho para exclusao).
- **Recurso** — o que foi afetado.
- **Status** — resultado da operacao (sucesso ou falha).

Clique em qualquer evento para ver os detalhes completos, incluindo:

- O payload da requisicao (o que foi enviado).
- O estado anterior e posterior do recurso (para edicoes).
- Headers relevantes da requisicao.

A API tambem permite consultar o audit log programaticamente:

\`\`\`
GET /api/audit-logs?page=1&per_page=50&action=update&resource_type=route
\`\`\`

> **Dica:** Use a API de audit log para integrar com sistemas de SIEM (Security Information and Event Management) como Splunk, Elastic SIEM ou Datadog, centralizando todos os eventos de seguranca da sua organizacao.`,
        },
        {
          id: "filtros",
          title: "Filtros de Pesquisa",
          body: `O audit log suporta filtros avancados para localizar rapidamente eventos especificos:

- **Por usuario** — filtre eventos de um usuario especifico pelo nome ou e-mail.
- **Por acao** — selecione um ou mais tipos de acao (\`create\`, \`update\`, \`delete\`, \`login\`, \`logout\`).
- **Por recurso** — filtre por tipo de recurso (\`route\`, \`upstream\`, \`plugin\`, \`consumer\`, \`user\`, \`setting\`).
- **Por periodo** — defina um intervalo de datas (ex: ultimos 7 dias, ultimo mes, intervalo customizado).
- **Por status** — filtre por eventos com sucesso ou falha.
- **Por IP de origem** — localize acoes vindas de um endereco IP especifico.

Os filtros podem ser combinados para buscas mais precisas. Por exemplo:

- "Todas as exclusoes de rotas feitas pelo usuario joao@empresa.com nos ultimos 30 dias"
- "Todos os logins com falha vindos do IP 192.168.1.100"
- "Todas as alteracoes em configuracoes do sistema na ultima semana"

> **Nota:** Os filtros sao aplicados server-side, garantindo performance mesmo em logs com milhoes de entradas. A paginacao padrao retorna 50 eventos por pagina.

Voce tambem pode exportar os resultados filtrados como CSV ou JSON para analise externa.`,
        },
        {
          id: "retencao-dados",
          title: "Retencao de Dados do Audit Log",
          body: `Por padrao, o FuseOne retém dados de audit log por **90 dias**. Apos esse periodo, os registros mais antigos sao automaticamente excluidos pelo processo de limpeza diario.

Para configurar a retencao, acesse **Configuracoes > Sistema > Retencao de Dados**:

- **Periodo de retencao** — numero de dias para manter os registros (minimo: 7 dias, maximo: 365 dias, padrao: 90 dias).
- **Horario de limpeza** — horario em que a limpeza automatica e executada (padrao: 03:00 UTC).
- **Exportacao automatica** — opcionalmente, exporte registros para um bucket S3 ou outro destino antes da exclusao.

\`\`\`
PUT /api/settings/audit-retention
{
  "retention_days": 180,
  "cleanup_hour_utc": 3,
  "auto_export": {
    "enabled": true,
    "destination": "s3://meu-bucket/audit-logs/"
  }
}
\`\`\`

Consideracoes para conformidade:

- Regulamentacoes como LGPD e SOC 2 podem exigir periodos minimos de retencao de logs de auditoria. Consulte sua equipe de compliance para definir o periodo adequado.
- A exportacao automatica para armazenamento de longo prazo (S3, GCS) permite manter registros alem do periodo de retencao ativo no banco de dados.
- Registros exportados sao compactados em formato GZIP e organizados por data (\`/YYYY/MM/DD/\`).

> **Atencao:** Reduzir o periodo de retencao exclui imediatamente os registros que excedem o novo limite. Essa acao e irreversivel. Exporte os dados antes de reduzir o periodo se precisar mante-los para referencia futura.`,
        },
      ],
    },
  ],
}
