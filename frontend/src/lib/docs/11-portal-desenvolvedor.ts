import type { DocCategory } from "./types"

export const portalDesenvolvedorCategory: DocCategory = {
  slug: "portal-desenvolvedor",
  title: "Portal do Desenvolvedor",
  description:
    "Configure e gerencie o Portal do Desenvolvedor para que consumidores descubram, testem e assinem suas APIs.",
  icon: "Globe",
  articles: [
    {
      slug: "visao-geral-portal",
      title: "Visão Geral do Portal",
      description:
        "O que é o Portal do Desenvolvedor, público-alvo e principais funcionalidades.",
      icon: "Info",
      tags: ["portal", "desenvolvedor", "catálogo"],
      content: [
        {
          id: "o-que-e-portal",
          title: "O que é o Portal do Desenvolvedor",
          body: `O Portal do Desenvolvedor é uma interface web pública (ou interna) que permite a consumidores de APIs descobrir, explorar e se inscrever nas APIs disponibilizadas pela sua organização.

Ele funciona como uma vitrine para suas APIs, separada do dashboard administrativo do FuseOne. Enquanto o dashboard é usado pela equipe que **gerencia** o gateway, o portal é destinado a quem **consome** as APIs.

Principais objetivos do portal:

- Centralizar a documentação de todas as APIs publicadas.
- Permitir que desenvolvedores externos descubram APIs relevantes para seus projetos.
- Oferecer self-service para registro, criação de aplicações e obtenção de credenciais.
- Reduzir a carga sobre equipes internas, eliminando processos manuais de onboarding.

> **Nota:** O Portal do Desenvolvedor é um módulo opcional. Você pode utilizar o FuseOne apenas como dashboard administrativo, sem ativar o portal público.`,
        },
        {
          id: "publico-alvo",
          title: "Público-Alvo",
          body: `O portal atende diferentes perfis de consumidores:

- **Desenvolvedores externos** — parceiros, clientes ou terceiros que integram com suas APIs. Eles precisam de documentação clara, exemplos de uso e credenciais de acesso.
- **Desenvolvedores internos** — equipes dentro da organização que consomem APIs de outros times. O portal facilita a descoberta de serviços internos.
- **Gerentes de produto** — podem explorar o catálogo para entender quais APIs estão disponíveis e planejar integrações.

Cada perfil pode ter níveis de acesso diferentes:

- **Visitante** — acessa o catálogo e a documentação pública, mas não pode criar aplicações ou obter chaves.
- **Desenvolvedor registrado** — pode criar aplicações, gerar chaves de API e se inscrever em APIs.
- **Desenvolvedor aprovado** — acesso a APIs restritas que exigem aprovação manual.

> **Dica:** Configure a visibilidade de cada API individualmente. APIs internas podem ser marcadas como "somente autenticado", enquanto APIs públicas ficam visíveis para visitantes.`,
        },
        {
          id: "funcionalidades-principais",
          title: "Funcionalidades Principais",
          body: `O Portal do Desenvolvedor oferece as seguintes funcionalidades:

- **Catálogo de APIs** — listagem organizada por categorias, com busca por texto e filtros. Cada API exibe descrição, versão, status e endpoints disponíveis.
- **Documentação interativa** — páginas de documentação geradas automaticamente a partir de especificações OpenAPI (Swagger). Inclui exemplos de requisição/resposta e a possibilidade de testar endpoints diretamente pelo navegador.
- **Registro de desenvolvedores** — formulário de auto-cadastro com verificação por e-mail. Opcionalmente, suporta login via provedores OAuth (Google, GitHub).
- **Gerenciamento de aplicações** — cada desenvolvedor pode criar uma ou mais "aplicações", cada uma com suas próprias credenciais (API keys).
- **Painel de uso** — dashboard pessoal mostrando consumo de API por aplicação, incluindo total de requisições, taxa de erros e latência média.

> **Nota:** A aparência do portal pode ser personalizada com o logotipo da sua organização, cores e textos customizados. Acesse **Configurações > Portal** para ajustar o branding.

O portal é servido como uma aplicação web independente, podendo ser hospedado em um subdomínio dedicado (ex: \`developers.suaempresa.com\`).`,
        },
      ],
    },
    {
      slug: "publicando-apis",
      title: "Publicando APIs no Portal",
      description:
        "Como publicar APIs, configurar visibilidade e gerar documentação a partir de especificações OpenAPI.",
      icon: "Upload",
      tags: ["publicação", "openapi", "documentação"],
      content: [
        {
          id: "publicar-api",
          title: "Como Publicar uma API no Portal",
          body: `Para disponibilizar uma API no Portal do Desenvolvedor, acesse a página de detalhes da API no dashboard e ative a opção **Publicar no Portal**.

Passos detalhados:

- Navegue até **APIs** e selecione a API que deseja publicar.
- Na aba **Portal**, ative o toggle **Publicar no Portal do Desenvolvedor**.
- Preencha os campos adicionais de publicação:
  - **Categoria** — agrupe APIs relacionadas (ex: "Pagamentos", "Usuários", "Notificações").
  - **Versão** — versão pública da API (ex: \`v1\`, \`v2\`).
  - **Descrição pública** — texto que será exibido no catálogo do portal.
  - **Termos de uso** — link ou texto com os termos que consumidores devem aceitar.

> **Nota:** Publicar uma API no portal não altera seu comportamento no gateway. A API continua funcionando normalmente — a publicação apenas a torna visível no catálogo do portal.

Após salvar, a API aparece no catálogo do portal em poucos segundos.`,
        },
        {
          id: "visibilidade",
          title: "Configurando a Visibilidade",
          body: `Cada API publicada pode ter um nível de visibilidade diferente:

- **Pública** — visível para qualquer visitante do portal, mesmo sem login. Ideal para APIs abertas e de uso geral.
- **Autenticada** — visível apenas para desenvolvedores registrados e logados no portal.
- **Restrita** — visível apenas para desenvolvedores que receberam acesso explícito. Útil para APIs de parceiros ou APIs em beta.

Para configurar a visibilidade:

- Na aba **Portal** da API, selecione o nível desejado em **Visibilidade**.
- Para APIs restritas, adicione os e-mails ou grupos de desenvolvedores autorizados.

> **Dica:** Comece publicando APIs como "Autenticada" e mude para "Pública" apenas quando a documentação estiver completa e revisada. Isso evita expor APIs com documentação incompleta.

A visibilidade pode ser alterada a qualquer momento sem afetar desenvolvedores que já possuem subscrições ativas.`,
        },
        {
          id: "documentacao-openapi",
          title: "Gerando Documentação a partir de OpenAPI",
          body: `O FuseOne gera automaticamente a documentação interativa da API a partir de uma especificação OpenAPI (anteriormente conhecida como Swagger).

Formatos suportados:

- **OpenAPI 3.0 e 3.1** — formato JSON ou YAML.
- **Swagger 2.0** — convertido automaticamente para OpenAPI 3.x.

Para associar uma especificação:

- Na aba **Portal** da API, clique em **Upload de Especificação** ou cole a URL de um endpoint que sirva a spec (ex: \`/api-docs/swagger.json\`).
- O sistema valida a especificação e gera a documentação automaticamente.
- A documentação inclui: lista de endpoints, parâmetros, schemas de request/response, códigos de status e exemplos.

\`\`\`
PUT /api/apis/{id}/portal/spec
Content-Type: application/json

{
  "spec_url": "https://api.exemplo.com/v1/openapi.json"
}
\`\`\`

> **Dica:** Se sua API não possui uma especificação OpenAPI, você pode criar a documentação manualmente usando o editor de Markdown integrado ao portal. Porém, recomendamos fortemente adotar OpenAPI para manter a documentação sempre sincronizada com a implementação.

A documentação é atualizada automaticamente toda vez que você faz upload de uma nova versão da especificação.`,
        },
        {
          id: "personalizacao-descricoes",
          title: "Personalizando Descrições de APIs",
          body: `Além da documentação técnica gerada pelo OpenAPI, você pode adicionar conteúdo personalizado para cada API:

- **Descrição longa** — texto em Markdown exibido na página principal da API no portal. Use para explicar o propósito da API, casos de uso e guias de introdução.
- **Guia de início rápido** — seção destacada com passos para fazer a primeira chamada à API (ex: obter chave, instalar SDK, enviar requisição).
- **Exemplos de código** — blocos de código em múltiplas linguagens (cURL, JavaScript, Python, Go) para facilitar a integração.
- **Changelog** — histórico de alterações da API, exibido em ordem cronológica.

Para editar esses campos, acesse a aba **Portal** da API e use o editor integrado.

> **Nota:** Todo o conteúdo personalizado suporta Markdown completo, incluindo tabelas, imagens e links. As imagens devem ser hospedadas externamente ou carregadas via URL.

Uma boa descrição reduz significativamente o número de dúvidas e tickets de suporte recebidos pela equipe de APIs.`,
        },
      ],
    },
    {
      slug: "self-service",
      title: "Self-Service para Consumidores",
      description:
        "Auto-cadastro de consumidores, criação de aplicações, gerenciamento de chaves e subscrições.",
      icon: "UserPlus",
      tags: ["self-service", "consumidores", "subscrições"],
      content: [
        {
          id: "registro-consumidores",
          title: "Registro de Consumidores",
          body: `O Portal do Desenvolvedor permite que consumidores se registrem de forma autônoma, sem interação manual da equipe de APIs.

Fluxo de registro:

- O consumidor acessa o portal e clique em **Criar Conta**.
- Preenche nome, e-mail e senha (ou usa login social via OAuth).
- Recebe um e-mail de verificação e confirma o cadastro.
- Após a confirmação, pode acessar o catálogo completo de APIs autenticadas.

Opções de configuração do registro:

- **Registro aberto** — qualquer pessoa pode se registrar.
- **Registro com aprovação** — o cadastro fica pendente até um administrador aprovar.
- **Registro por convite** — apenas usuários com link de convite podem se registrar.
- **Domínio restrito** — aceitar apenas e-mails de domínios específicos (ex: \`@parceiro.com\`).

> **Nota:** As configurações de registro ficam em **Configurações > Portal > Registro**. Escolha o modelo que melhor se adapta à sua estratégia de APIs.

Todos os registros são auditados e aparecem no audit log com o evento \`developer.registered\`.`,
        },
        {
          id: "aplicacoes",
          title: "Criação de Aplicações",
          body: `Cada consumidor registrado pode criar uma ou mais **aplicações** no portal. Uma aplicação representa um sistema ou projeto que consumirá as APIs.

Para criar uma aplicação:

- Acesse **Minhas Aplicações** no portal e clique em **Nova Aplicação**.
- Informe o nome da aplicação e uma descrição breve.
- A aplicação é criada imediatamente com um par de credenciais (API Key).

Cada aplicação possui:

- **Nome e descrição** — para identificação no painel do consumidor.
- **API Key** — chave única usada para autenticação nas chamadas à API.
- **Lista de subscrições** — APIs assinadas por esta aplicação.
- **Dashboard de uso** — métricas de consumo específicas da aplicação.

> **Dica:** Incentive consumidores a criar aplicações separadas para cada projeto ou ambiente (ex: "Meu App - Dev", "Meu App - Prod"). Isso facilita o controle de uso e a revogação de credenciais em caso de incidentes.

O limite de aplicações por consumidor pode ser configurado em **Configurações > Portal > Limites**.`,
        },
        {
          id: "gerenciamento-chaves",
          title: "Gerenciamento de Chaves de API",
          body: `As chaves de API são o principal mecanismo de autenticação para consumidores do portal. Cada aplicação recebe uma chave única no momento da criação.

Operações disponíveis:

- **Visualizar chave** — a chave é exibida apenas uma vez, no momento da criação. O consumidor deve copiá-la e armazená-la em local seguro.
- **Regenerar chave** — gera uma nova chave e invalida a anterior. Útil quando há suspeita de comprometimento.
- **Revogar chave** — desativa a chave permanentemente. Todas as requisições com essa chave passam a retornar \`401 Unauthorized\`.

Como usar a chave nas requisições:

\`\`\`
curl -X GET https://api.exemplo.com/v1/produtos \\
  -H "X-API-Key: sua-chave-aqui"
\`\`\`

> **Atenção:** Chaves de API não devem ser expostas em código-fonte público, repositórios Git ou aplicações client-side (JavaScript no navegador). Para cenários onde a chave precisa estar no cliente, considere usar OAuth 2.0 com fluxo PKCE.

Administradores podem visualizar e gerenciar chaves de todos os consumidores em **Dashboard > Consumidores**.`,
        },
        {
          id: "subscricoes",
          title: "Gerenciamento de Subscrições",
          body: `Uma subscrição vincula uma aplicação do consumidor a uma API específica. Sem subscrição, a aplicação não tem permissão para chamar a API, mesmo possuindo uma chave válida.

Fluxo de subscrição:

- O consumidor navega até a API desejada no catálogo do portal.
- Clica em **Assinar esta API** e seleciona a aplicação que fará o consumo.
- Escolhe o **plano de uso** (se disponível) — cada plano pode ter limites diferentes de rate limiting e cota.
- A subscrição pode ser aprovada automaticamente ou ficar pendente de aprovação, dependendo da configuração da API.

Gerenciamento de subscrições pelo consumidor:

- Visualizar todas as subscrições ativas em **Minhas Aplicações > Subscrições**.
- Cancelar uma subscrição a qualquer momento.
- Alterar o plano de uso (upgrade ou downgrade), sujeito à aprovação.

> **Nota:** Quando uma subscrição é cancelada, as credenciais da aplicação continuam válidas, mas as chamadas à API específica serão bloqueadas com \`403 Forbidden\`.

Administradores podem gerenciar todas as subscrições em **Dashboard > Subscrições**, incluindo aprovar solicitações pendentes e revogar subscrições existentes.`,
        },
        {
          id: "dashboard-uso",
          title: "Dashboard de Uso do Consumidor",
          body: `Cada consumidor possui um dashboard pessoal que exibe métricas de uso de suas aplicações. Isso permite que consumidores monitorem seu consumo de forma autônoma.

Métricas disponíveis:

- **Total de requisições** — número de chamadas realizadas por período (dia, semana, mês).
- **Taxa de sucesso** — percentual de requisições com resposta 2xx.
- **Taxa de erros** — percentual de requisições com resposta 4xx/5xx, detalhado por código de status.
- **Latência média** — tempo médio de resposta em milissegundos.
- **Consumo por API** — distribuição do uso entre as diferentes APIs assinadas.
- **Consumo por chave** — uso detalhado por credencial, útil quando a aplicação tem múltiplas chaves.

O dashboard inclui gráficos de tendência que mostram a evolução do consumo ao longo do tempo, facilitando a identificação de picos ou anomalias.

> **Dica:** Configure alertas no portal para notificar consumidores quando eles estiverem se aproximando dos limites do plano contratado. Isso melhora a experiência e reduz surpresas com bloqueios inesperados.`,
        },
      ],
    },
  ],
}
