# cs_avia — Projeto de Memória Persistente

## Missão
Este projeto garante que Claude sempre lembre de tudo que foi discutido com babicarols.

## OBRIGATÓRIO: Início de cada conversa
1. Leia **todos** os arquivos em `memory/knowledge/` para recarregar o contexto
2. Leia `memory/context.md` para ver o estado atual
3. Leia os últimos 3 arquivos em `memory/conversations/` (ordem por data)
4. Se houver MCP memory server ativo, carregue as entidades do knowledge graph

## OBRIGATÓRIO: Fim de cada conversa (ou quando usuário pedir)
1. Salve um resumo da conversa em `memory/conversations/YYYY-MM-DD_HH-MM_titulo.md`
2. Atualize `memory/context.md` com o estado atual
3. Atualize os arquivos de conhecimento relevantes em `memory/knowledge/`
4. Se MCP memory ativo, crie/atualize entidades no knowledge graph

## Estrutura de memória
```
memory/
├── context.md              # Estado atual, projetos em andamento, última sessão
├── conversations/          # Histórico de conversas resumidas
│   └── YYYY-MM-DD_*.md
└── knowledge/              # Conhecimento acumulado por tema
    ├── usuario.md          # Quem é babicarols, preferências, objetivos
    ├── projetos.md         # Projetos ativos e concluídos
    ├── decisoes.md         # Decisões importantes tomadas
    └── tecnico.md          # Stack, ferramentas, configurações usadas
```

## Regras de comportamento
- **Nunca** pergunte o que já está na memória
- **Sempre** conecte assuntos novos ao contexto salvo
- **Sempre** salve informações novas antes de terminar
- Responda em português (Brasil) por padrão
- Seja direto e conciso — o usuário prefere respostas curtas e objetivas

## MCP Memory Server (quando Node.js estiver instalado)
Para habilitar memória semântica avançada, execute:
```bash
cd /Users/babicarols/cs_avia
bash scripts/setup_mcp.sh
```
Depois reinicie o Claude Code para ativar.
