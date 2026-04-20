#!/bin/bash
# Setup MCP Memory Server para cs_avia
# Execute após instalar Node.js

set -e

echo "=== Setup MCP cs_avia ==="

# Verificar Node.js
if ! command -v node &> /dev/null; then
  echo "ERRO: Node.js não encontrado."
  echo "Instale em: https://nodejs.org"
  echo "Ou via Homebrew: brew install node"
  exit 1
fi

echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"

# Pré-baixar os servidores MCP
echo ""
echo "Baixando @modelcontextprotocol/server-memory..."
npx -y @modelcontextprotocol/server-memory --help 2>/dev/null || true

echo ""
echo "Baixando @modelcontextprotocol/server-filesystem..."
npx -y @modelcontextprotocol/server-filesystem --help 2>/dev/null || true

echo ""
echo "=== PRONTO ==="
echo "MCP configurado em: /Users/babicarols/cs_avia/.claude/settings.json"
echo ""
echo "Reinicie o Claude Code para ativar o servidor de memória MCP."
