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
      title: "Visao Geral do Portal",
      description:
        "O que e o Portal do Desenvolvedor, publico-alvo e principais funcionalidades.",
      icon: "Info",
      tags: ["portal", "desenvolvedor", "catalogo"],
      content: [
        {
          id: "o-que-e-portal",
          title: "O que e o Portal do Desenvolvedor",
          body: `O Portal do Desenvolvedor e uma interface web publica (ou interna) que permite a consumidores de APIs descobrir, explorar e se inscrever nas APIs disponibilizadas pela sua organizacao.

Ele funciona como uma vitrine para suas APIs, separada do dashboard administrativo do FuseOne. Enquanto o dashboard e usado pela equipe que **gerencia** o gateway, o portal e destinado a quem **consome** as APIs.

Principais objetivos do portal:

- Centralizar a documentacao de todas as APIs publicadas.
- Permitir que desenvolvedores externos descubram APIs relevantes para seus projetos.
- Oferecer self-service para registro, criacao de aplicacoes e obtencao de credenciais.
- Reduzir a carga sobre equipes internas, eliminando processos manuais de onboarding.

> **Nota:** O Portal do Desenvolvedor e um modulo opcional. Voce pode utilizar o FuseOne apenas como dashboard administrativo, sem ativar o portal publico.`,
        },
        {
          id: "publico-alvo",
          title: "Publico-Alvo",
          body: `O portal atende diferentes perfis de consumidores:

- **Desenvolvedores externos** — parceiros, clientes ou terceiros que integram com suas APIs. Eles precisam de documentacao clara, exemplos de uso e credenciais de acesso.
- **Desenvolvedores internos** — equipes dentro da organizacao que consomem APIs de outros times. O portal facilita a descoberta de servicos internos.
- **Gerentes de produto** — podem explorar o catalogo para entender quais APIs estao disponiveis e planejar integracoes.

Cada perfil pode ter niveis de acesso diferentes:

- **Visitante** — acessa o catalogo e a documentacao publica, mas nao pode criar aplicacoes ou obter chaves.
- **Desenvolvedor registrado** — pode criar aplicacoes, gerar chaves de API e se inscrever em APIs.
- **Desenvolvedor aprovado** — acesso a APIs restritas que exigem aprovacao manual.

> **Dica:** Configure a visibilidade de cada API individualmente. APIs internas podem ser marcadas como "somente autenticado", enquanto APIs publicas ficam visiveis para visitantes.`,
        },
        {
          id: "funcionalidades-principais",
          title: "Funcionalidades Principais",
          body: `O Portal do Desenvolvedor oferece as seguintes funcionalidades:

- **Catalogo de APIs** — listagem organizada por categorias, com busca por texto e filtros. Cada API exibe descricao, versao, status e endpoints disponiveis.
- **Documentacao interativa** — paginas de documentacao geradas automaticamente a partir de especificacoes OpenAPI (Swagger). Inclui exemplos de requisicao/resposta e a possibilidade de testar endpoints diretamente pelo navegador.
- **Registro de desenvolvedores** — formulario de auto-cadastro com verificacao por e-mail. Opcionalmente, suporta login via provedores OAuth (Google, GitHub).
- **Gerenciamento de aplicacoes** — cada desenvolvedor pode criar uma ou mais "aplicacoes", cada uma com suas proprias credenciais (API keys).
- **Painel de uso** — dashboard pessoal mostrando consumo de API por aplicacao, incluindo total de requisicoes, taxa de erros e latencia media.

> **Nota:** A aparencia do portal pode ser personalizada com o logotipo da sua organizacao, cores e textos customizados. Acesse **Configuracoes > Portal** para ajustar o branding.

O portal e servido como uma aplicacao web independente, podendo ser hospedado em um subdominio dedicado (ex: \`developers.suaempresa.com\`).`,
        },
      ],
    },
    {
      slug: "publicando-apis",
      title: "Publicando APIs no Portal",
      description:
        "Como publicar APIs, configurar visibilidade e gerar documentacao a partir de especificacoes OpenAPI.",
      icon: "Upload",
      tags: ["publicacao", "openapi", "documentacao"],
      content: [
        {
          id: "publicar-api",
          title: "Como Publicar uma API no Portal",
          body: `Para disponibilizar uma API no Portal do Desenvolvedor, acesse a pagina de detalhes da API no dashboard e ative a opcao **Publicar no Portal**.

Passos detalhados:

- Navegue ate **APIs** e selecione a API que deseja publicar.
- Na aba **Portal**, ative o toggle **Publicar no Portal do Desenvolvedor**.
- Preencha os campos adicionais de publicacao:
  - **Categoria** — agrupe APIs relacionadas (ex: "Pagamentos", "Usuarios", "Notificacoes").
  - **Versao** — versao publica da API (ex: \`v1\`, \`v2\`).
  - **Descricao publica** — texto que sera exibido no catalogo do portal.
  - **Termos de uso** — link ou texto com os termos que consumidores devem aceitar.

> **Nota:** Publicar uma API no portal nao altera seu comportamento no gateway. A API continua funcionando normalmente — a publicacao apenas a torna visivel no catalogo do portal.

Apos salvar, a API aparece no catalogo do portal em poucos segundos.`,
        },
        {
          id: "visibilidade",
          title: "Configurando a Visibilidade",
          body: `Cada API publicada pode ter um nivel de visibilidade diferente:

- **Publica** — visivel para qualquer visitante do portal, mesmo sem login. Ideal para APIs abertas e de uso geral.
- **Autenticada** — visivel apenas para desenvolvedores registrados e logados no portal.
- **Restrita** — visivel apenas para desenvolvedores que receberam acesso explicito. Util para APIs de parceiros ou APIs em beta.

Para configurar a visibilidade:

- Na aba **Portal** da API, selecione o nivel desejado em **Visibilidade**.
- Para APIs restritas, adicione os e-mails ou grupos de desenvolvedores autorizados.

> **Dica:** Comece publicando APIs como "Autenticada" e mude para "Publica" apenas quando a documentacao estiver completa e revisada. Isso evita expor APIs com documentacao incompleta.

A visibilidade pode ser alterada a qualquer momento sem afetar desenvolvedores que ja possuem subscricoes ativas.`,
        },
        {
          id: "documentacao-openapi",
          title: "Gerando Documentacao a partir de OpenAPI",
          body: `O FuseOne gera automaticamente a documentacao interativa da API a partir de uma especificacao OpenAPI (anteriormente conhecida como Swagger).

Formatos suportados:

- **OpenAPI 3.0 e 3.1** — formato JSON ou YAML.
- **Swagger 2.0** — convertido automaticamente para OpenAPI 3.x.

Para associar uma especificacao:

- Na aba **Portal** da API, clique em **Upload de Especificacao** ou cole a URL de um endpoint que sirva a spec (ex: \`/api-docs/swagger.json\`).
- O sistema valida a especificacao e gera a documentacao automaticamente.
- A documentacao inclui: lista de endpoints, parametros, schemas de request/response, codigos de status e exemplos.

\`\`\`
PUT /api/apis/{id}/portal/spec
Content-Type: application/json

{
  "spec_url": "https://api.exemplo.com/v1/openapi.json"
}
\`\`\`

> **Dica:** Se sua API nao possui uma especificacao OpenAPI, voce pode criar a documentacao manualmente usando o editor de Markdown integrado ao portal. Porem, recomendamos fortemente adotar OpenAPI para manter a documentacao sempre sincronizada com a implementacao.

A documentacao e atualizada automaticamente toda vez que voce faz upload de uma nova versao da especificacao.`,
        },
        {
          id: "personalizacao-descricoes",
          title: "Personalizando Descricoes de APIs",
          body: `Alem da documentacao tecnica gerada pelo OpenAPI, voce pode adicionar conteudo personalizado para cada API:

- **Descricao longa** — texto em Markdown exibido na pagina principal da API no portal. Use para explicar o proposito da API, casos de uso e guias de introducao.
- **Guia de inicio rapido** — secao destacada com passos para fazer a primeira chamada a API (ex: obter chave, instalar SDK, enviar requisicao).
- **Exemplos de codigo** — blocos de codigo em multiplas linguagens (cURL, JavaScript, Python, Go) para facilitar a integracao.
- **Changelog** — historico de alteracoes da API, exibido em ordem cronologica.

Para editar esses campos, acesse a aba **Portal** da API e use o editor integrado.

> **Nota:** Todo o conteudo personalizado suporta Markdown completo, incluindo tabelas, imagens e links. As imagens devem ser hospedadas externamente ou carregadas via URL.

Uma boa descricao reduz significativamente o numero de duvidas e tickets de suporte recebidos pela equipe de APIs.`,
        },
      ],
    },
    {
      slug: "self-service",
      title: "Self-Service para Consumidores",
      description:
        "Auto-cadastro de consumidores, criacao de aplicacoes, gerenciamento de chaves e subscricoes.",
      icon: "UserPlus",
      tags: ["self-service", "consumidores", "subscricoes"],
      content: [
        {
          id: "registro-consumidores",
          title: "Registro de Consumidores",
          body: `O Portal do Desenvolvedor permite que consumidores se registrem de forma autonoma, sem interacao manual da equipe de APIs.

Fluxo de registro:

- O consumidor acessa o portal e clique em **Criar Conta**.
- Preenche nome, e-mail e senha (ou usa login social via OAuth).
- Recebe um e-mail de verificacao e confirma o cadastro.
- Apos a confirmacao, pode acessar o catalogo completo de APIs autenticadas.

Opcoes de configuracao do registro:

- **Registro aberto** — qualquer pessoa pode se registrar.
- **Registro com aprovacao** — o cadastro fica pendente ate um administrador aprovar.
- **Registro por convite** — apenas usuarios com link de convite podem se registrar.
- **Dominio restrito** — aceitar apenas e-mails de dominios especificos (ex: \`@parceiro.com\`).

> **Nota:** As configuracoes de registro ficam em **Configuracoes > Portal > Registro**. Escolha o modelo que melhor se adapta a sua estrategia de APIs.

Todos os registros sao auditados e aparecem no audit log com o evento \`developer.registered\`.`,
        },
        {
          id: "aplicacoes",
          title: "Criacao de Aplicacoes",
          body: `Cada consumidor registrado pode criar uma ou mais **aplicacoes** no portal. Uma aplicacao representa um sistema ou projeto que consumira as APIs.

Para criar uma aplicacao:

- Acesse **Minhas Aplicacoes** no portal e clique em **Nova Aplicacao**.
- Informe o nome da aplicacao e uma descricao breve.
- A aplicacao e criada imediatamente com um par de credenciais (API Key).

Cada aplicacao possui:

- **Nome e descricao** — para identificacao no painel do consumidor.
- **API Key** — chave unica usada para autenticacao nas chamadas a API.
- **Lista de subscricoes** — APIs assinadas por esta aplicacao.
- **Dashboard de uso** — metricas de consumo especificas da aplicacao.

> **Dica:** Incentive consumidores a criar aplicacoes separadas para cada projeto ou ambiente (ex: "Meu App - Dev", "Meu App - Prod"). Isso facilita o controle de uso e a revogacao de credenciais em caso de incidentes.

O limite de aplicacoes por consumidor pode ser configurado em **Configuracoes > Portal > Limites**.`,
        },
        {
          id: "gerenciamento-chaves",
          title: "Gerenciamento de Chaves de API",
          body: `As chaves de API sao o principal mecanismo de autenticacao para consumidores do portal. Cada aplicacao recebe uma chave unica no momento da criacao.

Operacoes disponiveis:

- **Visualizar chave** — a chave e exibida apenas uma vez, no momento da criacao. O consumidor deve copia-la e armazena-la em local seguro.
- **Regenerar chave** — gera uma nova chave e invalida a anterior. Util quando ha suspeita de comprometimento.
- **Revogar chave** — desativa a chave permanentemente. Todas as requisicoes com essa chave passam a retornar \`401 Unauthorized\`.

Como usar a chave nas requisicoes:

\`\`\`
curl -X GET https://api.exemplo.com/v1/produtos \\
  -H "X-API-Key: sua-chave-aqui"
\`\`\`

> **Atencao:** Chaves de API nao devem ser expostas em codigo-fonte publico, repositorios Git ou aplicacoes client-side (JavaScript no navegador). Para cenarios onde a chave precisa estar no cliente, considere usar OAuth 2.0 com fluxo PKCE.

Administradores podem visualizar e gerenciar chaves de todos os consumidores em **Dashboard > Consumidores**.`,
        },
        {
          id: "subscricoes",
          title: "Gerenciamento de Subscricoes",
          body: `Uma subscricao vincula uma aplicacao do consumidor a uma API especifica. Sem subscricao, a aplicacao nao tem permissao para chamar a API, mesmo possuindo uma chave valida.

Fluxo de subscricao:

- O consumidor navega ate a API desejada no catalogo do portal.
- Clica em **Assinar esta API** e seleciona a aplicacao que fara o consumo.
- Escolhe o **plano de uso** (se disponivel) — cada plano pode ter limites diferentes de rate limiting e cota.
- A subscricao pode ser aprovada automaticamente ou ficar pendente de aprovacao, dependendo da configuracao da API.

Gerenciamento de subscricoes pelo consumidor:

- Visualizar todas as subscricoes ativas em **Minhas Aplicacoes > Subscricoes**.
- Cancelar uma subscricao a qualquer momento.
- Alterar o plano de uso (upgrade ou downgrade), sujeito a aprovacao.

> **Nota:** Quando uma subscricao e cancelada, as credenciais da aplicacao continuam validas, mas as chamadas a API especifica serao bloqueadas com \`403 Forbidden\`.

Administradores podem gerenciar todas as subscricoes em **Dashboard > Subscricoes**, incluindo aprovar solicitacoes pendentes e revogar subscricoes existentes.`,
        },
        {
          id: "dashboard-uso",
          title: "Dashboard de Uso do Consumidor",
          body: `Cada consumidor possui um dashboard pessoal que exibe metricas de uso de suas aplicacoes. Isso permite que consumidores monitorem seu consumo de forma autonoma.

Metricas disponiveis:

- **Total de requisicoes** — numero de chamadas realizadas por periodo (dia, semana, mes).
- **Taxa de sucesso** — percentual de requisicoes com resposta 2xx.
- **Taxa de erros** — percentual de requisicoes com resposta 4xx/5xx, detalhado por codigo de status.
- **Latencia media** — tempo medio de resposta em milissegundos.
- **Consumo por API** — distribuicao do uso entre as diferentes APIs assinadas.
- **Consumo por chave** — uso detalhado por credencial, util quando a aplicacao tem multiplas chaves.

O dashboard inclui graficos de tendencia que mostram a evolucao do consumo ao longo do tempo, facilitando a identificacao de picos ou anomalias.

> **Dica:** Configure alertas no portal para notificar consumidores quando eles estiverem se aproximando dos limites do plano contratado. Isso melhora a experiencia e reduz surpresas com bloqueios inesperados.`,
        },
      ],
    },
  ],
}
