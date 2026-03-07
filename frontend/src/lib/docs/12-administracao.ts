import type { DocCategory } from "./types"

export const administracaoCategory: DocCategory = {
  slug: "administracao",
  title: "Administração",
  description:
    "Gerencie usuários, permissões, provedores OAuth, configurações do sistema e audit log.",
  icon: "Settings",
  articles: [
    {
      slug: "usuarios-rbac",
      title: "Usuários e Controle de Acesso",
      description:
        "Gerenciamento de usuários, roles integradas e sistema de permissões granulares.",
      icon: "Users",
      tags: ["usuários", "rbac", "permissões", "roles"],
      content: [
        {
          id: "gerenciamento-usuarios",
          title: "Gerenciamento de Usuários",
          body: `O FuseOne possui um sistema completo de gerenciamento de usuários integrado ao dashboard. Usuários são criados e gerenciados em **Configurações > Usuários**.

Para criar um novo usuário:

- Clique em **Novo Usuário** e preencha nome, e-mail e senha inicial.
- Atribua uma ou mais **roles** ao usuário.
- O usuário receberá um e-mail com instruções de acesso (se o envio de e-mails estiver configurado).

Operações disponíveis:

- **Editar** — alterar nome, e-mail e roles do usuário.
- **Desativar** — bloqueia o acesso sem excluir o registro (útil para afastamentos temporários).
- **Excluir** — remove permanentemente o usuário e revoga todas as sessões ativas.
- **Redefinir senha** — gera um link de redefinição enviado por e-mail.

> **Nota:** O usuário administrador criado durante a instalação inicial não pode ser excluído, mas pode ter suas roles alteradas. Garanta que ao menos um usuário com role \`admin\` esteja sempre ativo.

A lista de usuários exibe o status de cada um (ativo, desativado), a última data de login e as roles atribuídas.`,
        },
        {
          id: "roles-integradas",
          title: "Roles Integradas",
          body: `O FuseOne inclui três roles padrão que cobrem os cenários mais comuns:

- **admin** — acesso total ao sistema. Pode gerenciar usuários, configurações, ambientes e todos os recursos do gateway. Indicada para administradores de plataforma e DevOps leads.
- **editor** — pode criar, editar e excluir recursos do gateway (rotas, upstreams, plugins), mas não tem acesso a configurações de sistema ou gerenciamento de usuários. Indicada para desenvolvedores de APIs e engenheiros de plataforma.
- **viewer** — acesso somente leitura a todos os recursos. Pode visualizar rotas, upstreams, plugins, métricas e logs, mas não pode modificar nada. Indicada para stakeholders, auditores e equipes de suporte.

Tabela de permissões por role:

- \`admin\` — \`*:read\`, \`*:write\`, \`users:write\`, \`settings:write\`
- \`editor\` — \`routes:read\`, \`routes:write\`, \`upstreams:read\`, \`upstreams:write\`, \`plugins:read\`, \`plugins:write\`, \`consumers:read\`, \`consumers:write\`
- \`viewer\` — \`routes:read\`, \`upstreams:read\`, \`plugins:read\`, \`consumers:read\`, \`metrics:read\`

> **Dica:** Atribua a role com o menor privilégio necessário para cada usuário. Isso segue o princípio de menor privilégio e reduz a superfície de ataque em caso de comprometimento de credenciais.`,
        },
        {
          id: "sistema-permissoes",
          title: "Sistema de Permissões",
          body: `O sistema de permissões do FuseOne é baseado no modelo RBAC (Role-Based Access Control). Cada permissão segue o formato \`{recurso}:{acao}\`, onde:

- **recurso** — o tipo de objeto (ex: \`routes\`, \`upstreams\`, \`plugins\`, \`consumers\`, \`users\`, \`settings\`, \`metrics\`).
- **ação** — \`read\` para visualização ou \`write\` para criação, edição e exclusão.

Exemplos de permissões:

- \`routes:read\` — visualizar a lista de rotas e seus detalhes.
- \`routes:write\` — criar, editar e excluir rotas.
- \`users:write\` — gerenciar usuários e roles.
- \`settings:write\` — alterar configurações do sistema.
- \`metrics:read\` — acessar dashboards de métricas e monitoramento.

O middleware de autorização verifica as permissões do usuário autenticado em cada requisição à API. Se o usuário não possuir a permissão necessária, a resposta será \`403 Forbidden\`.

> **Nota:** Permissões são avaliadas no nível da role. Um usuário herda todas as permissões de todas as roles que lhe foram atribuídas. Se um usuário possui tanto a role \`viewer\` quanto a role \`editor\`, ele terá a união das permissões de ambas.`,
        },
        {
          id: "roles-customizadas",
          title: "Criando Roles Customizadas",
          body: `Além das roles integradas, você pode criar roles customizadas para atender cenários específicos da sua organização.

Para criar uma nova role, acesse **Configurações > Roles** e clique em **Nova Role**:

- **Nome** — identificador único da role (ex: \`api-reviewer\`, \`metrics-analyst\`).
- **Descrição** — explique o propósito da role para facilitar a gestão.
- **Permissões** — selecione as permissões individuais que esta role concederá.

Exemplos de roles customizadas úteis:

- **metrics-analyst** — \`metrics:read\`, \`routes:read\` — ideal para equipes de monitoramento que precisam visualizar métricas mas não devem alterar configurações.
- **api-publisher** — \`routes:read\`, \`routes:write\`, \`upstreams:read\` — para desenvolvedores que publicam rotas mas não gerenciam upstreams.
- **security-auditor** — \`routes:read\`, \`plugins:read\`, \`consumers:read\`, \`metrics:read\` — para equipes de segurança que revisam configurações.

\`\`\`
POST /api/roles
{
  "name": "metrics-analyst",
  "description": "Acesso somente leitura a métricas e rotas",
  "permissions": ["metrics:read", "routes:read"]
}
\`\`\`

> **Atenção:** Roles customizadas não podem incluir a permissão \`users:write\` ou \`settings:write\` a menos que o criador tenha a role \`admin\`. Isso evita escalação de privilégios.`,
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
          body: `O FuseOne suporta autenticação via provedores OAuth 2.0, permitindo que usuários façam login com suas contas corporativas ou de serviços populares.

Provedores suportados:

- **Google** — login com conta Google Workspace ou Gmail.
- **GitHub** — login com conta GitHub, ideal para equipes de desenvolvimento.
- **Microsoft (Azure AD)** — login com contas corporativas Microsoft 365.
- **Provedor customizado** — qualquer provedor compatível com OAuth 2.0 / OpenID Connect.

Para configurar um provedor, acesse **Configurações > OAuth** e clique em **Novo Provedor**:

- **Nome** — nome de exibição no botão de login (ex: "Login com Google").
- **Client ID** — identificador da aplicação registrada no provedor.
- **Client Secret** — segredo da aplicação (armazenado de forma criptografada).
- **Authorization URL** — URL de autorização do provedor.
- **Token URL** — URL para troca do código de autorização pelo token de acesso.
- **Scopes** — escopos solicitados (ex: \`openid email profile\`).

> **Dica:** Para Google, registre a aplicação em [console.cloud.google.com](https://console.cloud.google.com) e configure a URL de callback como \`https://seu-fuseone.com/auth/oauth/callback\`.`,
        },
        {
          id: "fluxo-sso",
          title: "Fluxo de Login SSO",
          body: `Quando um provedor OAuth está configurado, um botão de login social aparece na tela de autenticação do FuseOne. O fluxo funciona da seguinte forma:

- O usuário clica em "Login com [Provedor]" na tela de login.
- O navegador redireciona para a página de autorização do provedor.
- O usuário autentica com suas credenciais do provedor.
- O provedor redireciona de volta ao FuseOne com um código de autorização.
- O FuseOne troca o código por um token de acesso e obtém o perfil do usuário.
- Se o e-mail do usuário já está cadastrado no FuseOne, o login é realizado automaticamente.
- Se o e-mail não está cadastrado, o comportamento depende da configuração de **auto-provisionamento**.

Opções de auto-provisionamento:

- **Desativado** — apenas usuários pré-cadastrados podem fazer login via SSO. Usuários não encontrados recebem uma mensagem de erro.
- **Ativado com role padrão** — usuários novos são criados automaticamente com uma role definida (ex: \`viewer\`).
- **Ativado com mapeamento** — usuários são criados com roles baseadas em atributos do provedor (ex: grupo do Google Workspace).

> **Nota:** O auto-provisionamento facilita o onboarding mas pode criar usuários indesejados. Use filtros de domínio de e-mail para restringir quem pode ser provisionado automaticamente.`,
        },
        {
          id: "mapeamento-roles",
          title: "Mapeamento de Identidades Externas",
          body: `O FuseOne permite mapear atributos do provedor OAuth para roles internas. Isso é especialmente útil em organizações que já possuem grupos definidos no provedor de identidade.

Exemplos de mapeamento:

- Grupo \`engineering\` no Google Workspace → role \`editor\` no FuseOne.
- Grupo \`platform-admins\` no Azure AD → role \`admin\` no FuseOne.
- Organização \`my-org\` no GitHub → role \`viewer\` no FuseOne.

Para configurar o mapeamento, acesse **Configurações > OAuth > [Provedor] > Mapeamento de Roles**:

- Defina regras com base em **claims** do token de identidade (ex: \`groups\`, \`org\`, \`department\`).
- Cada regra mapeia um valor de claim para uma role do FuseOne.
- Múltiplas regras podem ser criadas; a primeira regra correspondente é aplicada.

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

> **Atenção:** O mapeamento de roles é avaliado apenas no momento do login. Se os grupos do usuário mudarem no provedor externo, as novas roles serão aplicadas no próximo login. Para sincronização em tempo real, considere usar webhooks do provedor de identidade.`,
        },
      ],
    },
    {
      slug: "configuracoes-sistema",
      title: "Configurações do Sistema",
      description:
        "Ajuste configurações de JWT, sessões, paginação, contatos de notificação e preferências gerais.",
      icon: "Cog",
      tags: ["configurações", "sistema", "notificações"],
      content: [
        {
          id: "configuracoes-gerais",
          title: "Configurações Gerais",
          body: `As configurações gerais do sistema ficam em **Configurações > Geral** e controlam o comportamento global do FuseOne.

Parâmetros disponíveis:

- **JWT Secret** — chave secreta usada para assinar tokens JWT de autenticação. Deve ser uma string longa e aleatória. Alterar essa chave invalida todos os tokens ativos.
- **Duração da sessão** — tempo de validade do token JWT em horas (padrão: 24h). Após expirar, o usuário precisa fazer login novamente.
- **Paginação de APIs** — número de itens por página nas listagens do dashboard (padrão: 20). Valores entre 10 e 100.
- **Fuso horário** — fuso horário usado para exibição de datas e horários no dashboard e nos relatórios.
- **Idioma padrão** — idioma da interface do dashboard (Português ou Inglês).

\`\`\`
PUT /api/settings
{
  "jwt_expiry_hours": 24,
  "pagination_size": 20,
  "timezone": "America/Sao_Paulo",
  "language": "pt-BR"
}
\`\`\`

> **Atenção:** A alteração do **JWT Secret** deve ser feita com cuidado, pois todos os usuários serão deslogados imediatamente. Planeje essa alteração para um horário de baixo uso.

Todas as configurações também podem ser definidas via variáveis de ambiente, que têm precedência sobre os valores salvos no banco de dados.`,
        },
        {
          id: "contatos-notificacao",
          title: "Contatos de Notificação",
          body: `O FuseOne envia notificações para eventos importantes como alertas de métricas, solicitações de aprovação de promoções e incidentes de segurança. Os contatos de notificação definem para onde essas notificações são enviadas.

Tipos de contato suportados:

- **E-mail** — envia notificações para um endereço de e-mail. Requer configuração de SMTP em **Configurações > Geral > E-mail**.
- **Slack** — envia mensagens para um canal Slack via webhook. Basta informar a URL do webhook.
- **Webhook genérico** — envia um payload JSON para qualquer URL. Útil para integrar com sistemas internos, Microsoft Teams, PagerDuty, etc.

Para criar um contato, acesse **Configurações > Notificações** e clique em **Novo Contato**:

- **Nome** — identificador do contato (ex: "Equipe SRE - Slack").
- **Tipo** — selecione entre E-mail, Slack ou Webhook.
- **Destino** — endereço de e-mail, URL do webhook Slack ou URL genérica.
- **Eventos** — quais tipos de eventos acionam este contato (alertas, promoções, segurança, todos).

> **Dica:** Crie contatos separados para diferentes tipos de eventos. Por exemplo, alertas de métricas podem ir para o canal do Slack da equipe SRE, enquanto solicitações de aprovação vão para o e-mail dos tech leads.

Você pode testar qualquer contato clicando em **Enviar Teste** para verificar se a configuração está correta.`,
        },
        {
          id: "configuracao-email",
          title: "Configuração de E-mail (SMTP)",
          body: `Para que o FuseOne envie notificações por e-mail (alertas, convites de usuário, redefinição de senha), é necessário configurar um servidor SMTP.

Acesse **Configurações > Geral > E-mail** e preencha:

- **Host SMTP** — endereço do servidor de e-mail (ex: \`smtp.gmail.com\`, \`smtp.sendgrid.net\`).
- **Porta** — porta do servidor SMTP (587 para TLS, 465 para SSL, 25 para sem criptografia).
- **Usuário** — usuário de autenticação SMTP.
- **Senha** — senha de autenticação SMTP (armazenada de forma criptografada).
- **Remetente** — endereço de e-mail exibido como remetente (ex: \`noreply@suaempresa.com\`).
- **TLS** — habilitar criptografia TLS (fortemente recomendado).

Configuração via variáveis de ambiente:

\`\`\`
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@suaempresa.com
SMTP_PASS=sua-senha-app
SMTP_FROM=noreply@suaempresa.com
SMTP_TLS=true
\`\`\`

> **Dica:** Para Gmail, use uma "Senha de App" em vez da senha da conta. Para ambientes de produção, recomendamos serviços transacionais como SendGrid, Mailgun ou Amazon SES, que oferecem maior confiabilidade e rastreabilidade.

Após configurar, use o botão **Enviar E-mail de Teste** para validar a conexão.`,
        },
      ],
    },
    {
      slug: "audit-log",
      title: "Audit Log",
      description:
        "Rastreabilidade completa de todas as ações realizadas no sistema, com filtros e retenção configurável.",
      icon: "ScrollText",
      tags: ["audit", "log", "rastreabilidade"],
      content: [
        {
          id: "o-que-captura",
          title: "O que o Audit Log Captura",
          body: `O Audit Log registra automaticamente todas as ações realizadas por usuários no FuseOne. Cada entrada no log contém:

- **Timestamp** — data e hora exatas da ação, com precisão de milissegundos.
- **Usuário** — quem realizou a ação (nome, e-mail e ID do usuário).
- **Ação** — tipo de operação realizada (\`create\`, \`update\`, \`delete\`, \`login\`, \`logout\`).
- **Recurso** — tipo e identificador do recurso afetado (ex: \`route:123\`, \`upstream:456\`).
- **Detalhes** — payload com os valores anteriores e posteriores (para ações de edição), permitindo rastrear exatamente o que mudou.
- **IP de origem** — endereço IP de onde a requisição foi feita.
- **User Agent** — navegador ou ferramenta utilizada para a ação.

Eventos registrados automaticamente:

- Criação, edição e exclusão de rotas, upstreams, plugins e consumidores.
- Login e logout de usuários.
- Alterações em configurações do sistema.
- Criação e alteração de usuários e roles.
- Solicitações e aprovações de promoções entre ambientes.
- Alterações em provedores OAuth.

> **Nota:** O audit log é gravado de forma assíncrona e não bloqueante. Isso significa que ele não impacta a performance das operações normais do sistema.`,
        },
        {
          id: "visualizando-eventos",
          title: "Visualizando Eventos de Auditoria",
          body: `Para acessar o audit log, navegue até **Configurações > Audit Log** no dashboard. A interface exibe uma lista cronológica de eventos com as seguintes colunas:

- **Data/Hora** — quando o evento ocorreu.
- **Usuário** — quem realizou a ação.
- **Ação** — tipo de operação (com badge colorido: verde para criação, amarelo para edição, vermelho para exclusão).
- **Recurso** — o que foi afetado.
- **Status** — resultado da operação (sucesso ou falha).

Clique em qualquer evento para ver os detalhes completos, incluindo:

- O payload da requisição (o que foi enviado).
- O estado anterior e posterior do recurso (para edições).
- Headers relevantes da requisição.

A API também permite consultar o audit log programaticamente:

\`\`\`
GET /api/audit-logs?page=1&per_page=50&action=update&resource_type=route
\`\`\`

> **Dica:** Use a API de audit log para integrar com sistemas de SIEM (Security Information and Event Management) como Splunk, Elastic SIEM ou Datadog, centralizando todos os eventos de segurança da sua organização.`,
        },
        {
          id: "filtros",
          title: "Filtros de Pesquisa",
          body: `O audit log suporta filtros avançados para localizar rapidamente eventos específicos:

- **Por usuário** — filtre eventos de um usuário específico pelo nome ou e-mail.
- **Por ação** — selecione um ou mais tipos de ação (\`create\`, \`update\`, \`delete\`, \`login\`, \`logout\`).
- **Por recurso** — filtre por tipo de recurso (\`route\`, \`upstream\`, \`plugin\`, \`consumer\`, \`user\`, \`setting\`).
- **Por período** — defina um intervalo de datas (ex: últimos 7 dias, último mês, intervalo customizado).
- **Por status** — filtre por eventos com sucesso ou falha.
- **Por IP de origem** — localize ações vindas de um endereço IP específico.

Os filtros podem ser combinados para buscas mais precisas. Por exemplo:

- "Todas as exclusões de rotas feitas pelo usuário joao@empresa.com nos últimos 30 dias"
- "Todos os logins com falha vindos do IP 192.168.1.100"
- "Todas as alterações em configurações do sistema na última semana"

> **Nota:** Os filtros são aplicados server-side, garantindo performance mesmo em logs com milhões de entradas. A paginação padrão retorna 50 eventos por página.

Você também pode exportar os resultados filtrados como CSV ou JSON para análise externa.`,
        },
        {
          id: "retencao-dados",
          title: "Retenção de Dados do Audit Log",
          body: `Por padrão, o FuseOne retém dados de audit log por **90 dias**. Após esse período, os registros mais antigos são automaticamente excluídos pelo processo de limpeza diário.

Para configurar a retenção, acesse **Configurações > Sistema > Retenção de Dados**:

- **Período de retenção** — número de dias para manter os registros (mínimo: 7 dias, máximo: 365 dias, padrão: 90 dias).
- **Horário de limpeza** — horário em que a limpeza automática é executada (padrão: 03:00 UTC).
- **Exportação automática** — opcionalmente, exporte registros para um bucket S3 ou outro destino antes da exclusão.

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

Considerações para conformidade:

- Regulamentações como LGPD e SOC 2 podem exigir períodos mínimos de retenção de logs de auditoria. Consulte sua equipe de compliance para definir o período adequado.
- A exportação automática para armazenamento de longo prazo (S3, GCS) permite manter registros além do período de retenção ativo no banco de dados.
- Registros exportados são compactados em formato GZIP e organizados por data (\`/YYYY/MM/DD/\`).

> **Atenção:** Reduzir o período de retenção exclui imediatamente os registros que excedem o novo limite. Essa ação é irreversível. Exporte os dados antes de reduzir o período se precisar mantê-los para referência futura.`,
        },
      ],
    },
  ],
}
