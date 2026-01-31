# Documentação do Sistema de Gestão de Frota e Oficina

## 1. Objetivo Principal
O objetivo principal desta aplicação é fornecer uma solução centralizada e eficiente para a gestão integral de uma frota de veículos e operações de oficina. O sistema visa otimizar o controle de viaturas, motoristas, manutenções, abastecimentos e custos operacionais, garantindo maior transparência, redução de gastos e agilidade nas tomadas de decisão.

## 2. Público Alvo
O sistema é destinado a:
*   **Gestores de Frota:** Responsáveis pelo controle macro da operação, custos e disponibilidade da frota.
*   **Gestores de Oficina:** Responsáveis pelo agendamento e registro de manutenções preventivas e corretivas.
*   **Administrativos:** Pessoal de back-office que lida com documentação, multas, seguros e requisições.
*   **Supervisores:** Encarregados de monitorar as operações diárias e equipas.
*   **Motoristas e Usuários da Oficina:** Usuários que podem interagir com o sistema para consultar escalas ou registar atividades (dependendo das permissões).

## 3. Tecnologias Usadas

### Frontend
*   **React (v19):** Biblioteca JavaScript para construção de interfaces de usuário. Foi escolhida pela sua performance, componentização e vasto ecossistema. A versão 19 traz as melhorias mais recentes de performance e funcionalidades.
*   **TypeScript:** Superset do JavaScript que adiciona tipagem estática. Usado para garantir maior segurança no código, facilitar a manutenção e reduzir erros em tempo de desenvolvimento.
*   **Vite:** Ferramenta de build e servidor de desenvolvimento. Escolhida pela sua extrema velocidade de inicialização e Hot Module Replacement (HMR), acelerando o desenvolvimento.
*   **Tailwind CSS:** Framework de CSS utilitário. Permite a criação rápida de interfaces modernas e responsivas diretamente no HTML/JSX, garantindo consistência visual.
*   **React Router DOM (v7):** Gerenciamento de rotas da aplicação, permitindo a navegação entre diferentes páginas sem recarregar o navegador (SPA - Single Page Application).
*   **Lucide React:** Biblioteca de ícones leve e consistente visualmente.

### Backend & Dados
*   **Supabase:** Plataforma Backend-as-a-Service (BaaS) baseada em PostgreSQL. Foi utilizada para fornecer:
    *   **Banco de Dados:** PostgreSQL robusto e escalável.
    *   **Autenticação:** Gerenciamento de usuários e sessões seguro.
    *   **Realtime:** Capacidade de ouvir mudanças no banco de dados em tempo real (essencial para painéis de monitoramento).
    *   **Storage:** Armazenamento de arquivos (como fotos de viaturas, documentos e PDFs).
*   **PostgreSQL (via Supabase):** Banco de dados relacional poderoso, usado para estruturar dados complexos com integridade referencial.
*   **Row Level Security (RLS):** Funcionalidade do PostgreSQL ativada no Supabase para segurança granular, garantindo que usuários só acessem dados que têm permissão de ver.

### Bibliotecas e Utilitários Específicos
*   **Leaflet / React Leaflet:** Biblioteca de mapas interativos. Usada para funcionalidades de geolocalização e rastreamento de rotas ou viaturas.
*   **jsPDF & jsPDF-AutoTable:** Geração de documentos PDF no navegador. Essencial para criar relatórios, fichas de viaturas e ordens de serviço.
*   **XLSX:** Manipulação de planilhas Excel. Permite a importação e exportação de dados (ex: relatórios de custos) para análise externa.
*   **dnd-kit:** Biblioteca para interfaces "Drag and Drop" (arrastar e soltar). Provavelmente usada para agendamentos, organização de tarefas ou kanban.

## 4. Regras de Negócio e Funcionalidades Principais

### Gestão de Entidades Base
*   **Centros de Custo:** Organização financeira para alocação de despesas (combustível, manutenção).
*   **Fornecedores e Clientes:** Cadastro completo com informações fiscais (NIF), contatos e endereços.

### Gestão de Frota (Viaturas)
*   **Cadastro Completo:** Registro de matrícula, marca, modelo, ano e especificações.
*   **Documentação:** Controle de seguros, impostos e outros documentos legais, prevenindo vencimentos.
*   **Multas:** Registro e gestão de infrações, associando-as a motoristas e controlando o status de pagamento.
*   **Histórico de Manutenções:** Registro separado de intervenções, custos, quilometragem e oficinas responsáveis.

### Gestão de Pessoal (Motoristas e Supervisores)
*   **Perfis:** Cadastro detalhado com foto, documentos (CNH), contatos e dados profissionais (vencimento, valor hora).
*   **Controle de Ausências:** Sistema para registrar e aprovar férias, baixas médicas ou outras ausências.
*   **Segurança:** Uso de PINs para autorizações rápidas e controle de permissões bloqueadas (`blocked_permissions`).

### Operações e Serviços
*   **Serviços/Viagens:** Registro de deslocamentos com origem, destino, passageiros e associação a centros de custo.
*   **Requisições:** Fluxo de pedidos de compra ou serviço, com status (pendente, aprovado) e rastreamento de faturas.
*   **Transporte Eva:** Módulo específico para gestão logística de transportes (provavelmente de colaboradores ou rotas fixas), incluindo controle de incidências diárias.

### Gestão de Combustível
*   **Tanques Próprios:** Monitoramento de nível de combustível em tanques da empresa ("Bomba Própria"), incluindo reabastecimentos (entradas) e saídas.
*   **Transações:** Registro detalhado de cada abastecimento por viatura e motorista, calculando custos e médias de consumo.

### Notificações
*   Sistema centralizado de notificações para alertar usuários sobre eventos importantes (manutenções próximas, documentos vencendo, requisições pendentes).
