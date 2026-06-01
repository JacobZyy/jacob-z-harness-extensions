#!/usr/bin/env bash
# install.sh — 一键安装 jacob-omp-collections 到本地 OMP 环境
#
# 用法:
#   ./install.sh              # 安装 skills + mcp（需要先 /marketplace install 插件）
#   ./install.sh --all        # 安装全部（包括 marketplace 插件）
#
# 安装内容:
#   - packages/*     → OMP Marketplace 插件（需要 omp 内 /marketplace install）
#   - skills/*       → symlink 到 ~/.omp/agent/skills/
#   - mcp/mcp.json   → merge 到 ~/.omp/agent/mcp.json

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
OMP_AGENT_DIR="${OMP_AGENT_DIR:-$HOME/.omp/agent}"
OMP_SKILLS_DIR="$OMP_AGENT_DIR/skills"
MCP_TARGET="$OMP_AGENT_DIR/mcp.json"
MCP_SOURCE="$REPO_DIR/mcp/mcp.json"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ── Skills: symlink ──────────────────────────────────────────────────────────

install_skills() {
  info "Installing skills..."
  mkdir -p "$OMP_SKILLS_DIR"

  local count=0
  for skill_dir in "$REPO_DIR"/skills/*/; do
    [ -d "$skill_dir" ] || continue
    local name
    name="$(basename "$skill_dir")"
    local target="$OMP_SKILLS_DIR/$name"

    if [ -L "$target" ]; then
      rm "$target"
    elif [ -d "$target" ]; then
      warn "  $name: 目录已存在且非 symlink，跳过（如需覆盖请手动 rm -rf $target）"
      continue
    fi

    ln -s "$skill_dir" "$target"
    info "  $name → $target"
    count=$((count + 1))
  done

  if [ "$count" -eq 0 ]; then
    info "  没有 skills 需要安装"
  fi
}

# ── MCP: merge ───────────────────────────────────────────────────────────────

install_mcp() {
  info "Installing MCP servers..."

  if [ ! -f "$MCP_SOURCE" ]; then
    warn "  MCP 配置文件不存在: $MCP_SOURCE"
    return
  fi

  mkdir -p "$(dirname "$MCP_TARGET")"

  if command -v python3 &>/dev/null; then
    python3 -c "
import json
from pathlib import Path

source = Path('$MCP_SOURCE')
target = Path('$MCP_TARGET')

with open(source) as f:
    incoming = json.load(f).get('mcpServers', {})

if target.exists():
    with open(target) as f:
        existing = json.load(f)
else:
    existing = {}

if 'mcpServers' not in existing:
    existing['mcpServers'] = {}

added = []
updated = []
for name, config in incoming.items():
    if name in existing['mcpServers']:
        existing['mcpServers'][name] = config
        updated.append(name)
    else:
        existing['mcpServers'][name] = config
        added.append(name)

with open(target, 'w') as f:
    json.dump(existing, f, indent=2, ensure_ascii=False)
    f.write('\n')

if added:
    print(f'  added {len(added)} MCP servers: {', '.join(added)}')
if updated:
    print(f'  updated {len(updated)} MCP servers: {', '.join(updated)}')
if not added and not updated:
    print('  没有 MCP servers 需要安装')
" 2>/dev/null
  else
    warn "  python3 不可用，跳过 MCP 安装"
  fi
}

# ── Marketplace plugins ──────────────────────────────────────────────────────

install_marketplace() {
  info "Marketplace 插件需要手动安装（在 omp 会话内执行）:"
  echo ""
  echo "  /marketplace add JacobZyy/jacob-omp-collections"

  # 读取 marketplace.json 中的插件名
  if command -v python3 &>/dev/null; then
    local plugins
    plugins="$(python3 -c "
import json
with open('$REPO_DIR/.claude-plugin/marketplace.json') as f:
    d = json.load(f)
for p in d.get('plugins', []):
    print(f\"  /marketplace install {p['name']}@{d['name']}\")
" 2>/dev/null)"
    if [ -n "$plugins" ]; then
      echo "$plugins"
    fi
  fi

  # 创建 node_modules symlink（不修改 package.json 或 lock 文件）
  link_marketplace_plugins
}

# ── Link marketplace plugins to node_modules ──────────────────────────────────
#
# OMP's getEnabledPlugins() discovers extensions by reading package.json from
# node_modules/<pkg>/package.json.  Marketplace-installed plugins live in
# cache/plugins/<marketplace>/<name>/<version>/ but OMP needs them reachable
# under node_modules/ too.  This creates pure symlinks — it does NOT touch
# package.json dependencies or omp-plugins.lock.json.

link_marketplace_plugins() {
  local plugins_dir="$HOME/.omp/plugins"
  local node_modules_dir="$plugins_dir/node_modules"
  local installed_json="$plugins_dir/installed_plugins.json"

  if [ ! -f "$installed_json" ]; then
    return
  fi

  if ! command -v python3 &>/dev/null; then
    warn "  python3 不可用，跳过 marketplace plugin linking"
    return
  fi

  python3 << 'PYEOF'
import json
import os

installed_json = os.path.expanduser("~/.omp/plugins/installed_plugins.json")
node_modules_dir = os.path.expanduser("~/.omp/plugins/node_modules")

with open(installed_json) as f:
    data = json.load(f)

plugins = data.get("plugins", {})
created = 0

for plugin_id, versions in plugins.items():
    if not versions:
        continue

    latest = versions[-1]
    install_path = latest.get("installPath", "")

    if not install_path or not os.path.exists(install_path):
        continue

    parts = plugin_id.split("@")
    if len(parts) != 2:
        continue

    name, scope = parts
    scope_dir = os.path.join(node_modules_dir, f"@{scope}")
    symlink_path = os.path.join(scope_dir, name)

    if os.path.islink(symlink_path):
        if os.readlink(symlink_path) == install_path:
            continue
        os.remove(symlink_path)
    elif os.path.exists(symlink_path):
        continue

    os.makedirs(scope_dir, exist_ok=True)
    os.symlink(install_path, symlink_path)
    print(f"  ✓ linked {plugin_id} → node_modules/@{scope}/{name}")
    created += 1

if created:
    print(f"  Linked {created} marketplace plugin(s)")
PYEOF
}


# ── Uninstall ────────────────────────────────────────────────────────────────

uninstall() {
  info "Uninstalling..."

  # Remove skill symlinks
  for skill_dir in "$REPO_DIR"/skills/*/; do
    [ -d "$skill_dir" ] || continue
    local name
    name="$(basename "$skill_dir")"
    local target="$OMP_SKILLS_DIR/$name"
    if [ -L "$target" ]; then
      rm "$target"
      info "  removed skill: $name"
    fi
  done

  # Remove MCP servers that came from this repo
  if [ -f "$MCP_SOURCE" ] && [ -f "$MCP_TARGET" ]; then
    python3 -c "
import json
with open('$MCP_SOURCE') as f:
    incoming = json.load(f).get('mcpServers', {})
with open('$MCP_TARGET') as f:
    existing = json.load(f)
removed = []
for name in incoming:
    if name in existing.get('mcpServers', {}):
        del existing['mcpServers'][name]
        removed.append(name)
with open('$MCP_TARGET', 'w') as f:
    json.dump(existing, f, indent=2, ensure_ascii=False)
    f.write('\n')
if removed:
    print(f'removed {len(removed)} MCP servers: {', '.join(removed)}')
else:
    print('no MCP servers to remove')
" 2>/dev/null
  fi

  info "Done. Marketplace plugins 需要手动 uninstall: /marketplace uninstall <name>@jacob-omp-collections"
}

# ── Main ─────────────────────────────────────────────────────────────────────

case "${1:-}" in
  --all)
    install_marketplace
    install_skills
    install_mcp
    info "Done!"
    ;;
  --uninstall)
    uninstall
    ;;
  --help|-h)
    echo "用法: $0 [--all|--uninstall|--help]"
    echo ""
    echo "  (无参数)      安装 skills + MCP（marketplace 插件需手动安装）"
    echo "  --all         显示 marketplace 安装命令 + 安装 skills + MCP"
    echo "  --uninstall   移除所有已安装的 skills 和 MCP"
    echo "  --help        显示帮助"
    ;;
  *)
    install_skills
    install_mcp
    info "Done! Marketplace 插件请手动安装（$0 --all 查看命令）"
    ;;
esac
