---
summary: "FIDO2 secrets provider configuration and usage"
read_when:
  - Configuring FIDO2 hardware key storage for OpenClaw secrets
  - Setting up FIDO2 resolver as exec provider
title: "FIDO2 Secrets Provider"
---

# FIDO2 Secrets Provider

使用 FIDO2/WebAuthn 安全密钥硬件存储 OpenClaw 的敏感配置。

## 概述

FIDO2 provider 允许您使用硬件安全密钥（如 YubiKey、Google Titan）存储和访问 API 密钥、OAuth token 等敏感信息。

### 安全特性

- **物理验证**: 每次访问密钥都需要触摸 FIDO2 硬件
- **AES-256-GCM 加密**: 存储在本地文件中的数据是加密的
- **PBKDF2 密钥派生**: 从 FIDO2 credential 派生加密密钥
- **随机 Challenge**: 防止重放攻击

### 工作流程

```
用户写入密钥 (openclaw-fido2-keys)
    │
    ▼
密钥加密 + FIDO2 credential 创建
    │
    ▼
存储到 ~/.openclaw/fido2-keys.json
    │
    ▼
─────────────────────────────────────────
OpenClaw 启动时 (openclaw gateway run)
    │
    ▼
读取 openclaw.json 中的 SecretRef
    │
    ▼
调用 fido2-resolver.mjs (exec provider)
    │
    ▼
用户触摸 FIDO2 硬件
    │
    ▼
resolver 解密并返回密钥
    │
    ▼
密钥加载到内存快照
```

## 配置

### 基础配置

在 `~/.openclaw/openclaw.json` 中添加：

```json5
{
  secrets: {
    providers: {
      fido2: {
        source: "exec",
        command: "/usr/local/bin/openclaw-fido2-resolver",
        args: [],
        passEnv: ["HOME", "DISPLAY"],
        jsonOnly: true,
        timeoutMs: 30000,
        noOutputTimeoutMs: 10000,
        allowSymlinkCommand: true,
        trustedDirs: ["/usr/local/bin"],
      },
    },
    defaults: {
      exec: "fido2",
    },
  },
}
```

### 配置选项说明

| 选项 | 类型 | 默认值 | 说明 |
|------|------|----------|------|
| `source` | string | "exec" | 必须是 "exec" |
| `command` | string | - | Resolver 脚本绝对路径 |
| `args` | string[] | [] | 传递给 resolver 的额外参数 |
| `passEnv` | string[] | [] | 允许传递给 resolver 的环境变量 |
| `jsonOnly` | boolean | true | 要求输出 JSON 格式 |
| `timeoutMs` | number | 5000 | 等待 resolver 完成的毫秒数 |
| `noOutputTimeoutMs` | number | 2000 | 无输出超时毫秒数 |
| `maxOutputBytes` | number | 1048576 | 最大输出字节数 |
| `allowSymlinkCommand` | boolean | false | 允许命令是 symlink（如 Homebrew shims） |
| `trustedDirs` | string[] | [] | 允许 symlink 命令的可信目录 |
| `allowInsecurePath` | boolean | false | 允许不安全的命令路径 |
| `env` | object | {} | 传递给 resolver 的额外环境变量 |

### 在模型配置中使用

```json5
{
  models: {
    providers: {
      openai: {
        baseUrl: "https://api.openai.com/v1",
        models: [{ id: "gpt-4", name: "GPT-4" }],
        apiKey: { source: "exec", provider: "fido2", id: "openai-api-key" },
      },
      anthropic: {
        baseUrl: "https://api.anthropic.com/v1",
        models: [{ id: "claude-sonnet-4", name: "Claude Sonnet 4" }],
        apiKey: { source: "exec", provider: "fido2", id: "anthropic-api-key" },
      },
    },
  },
}
```

### 在技能配置中使用

```json5
{
  skills: {
    entries: {
      "trello": {
        enabled: true,
        apiKey: { source: "exec", provider: "fido2", id: "trello-api-key" },
      },
    },
  },
}
```

### 在 Google Chat 配置中使用

```json5
{
  channels: {
    googlechat: {
      enabled: true,
      serviceAccountRef: { source: "exec", provider: "fido2", id: "googlechat-service-account" },
    },
  },
}
```

### 在 auth profiles 中使用

```json5
{
  agents: {
    default: {
      authProfiles: {
        profiles: {
          my-profile: {
            type: "token",
            tokenRef: { source: "exec", provider: "fido2", id: "my-token" },
          },
        },
      },
    },
  },
}
```

## 安装

### 1. 安装密钥管理工具

```bash
cd scripts/fido2-keys
npm install
npm run build
```

### 2. 安装 Resolver

```bash
# 复制 resolver 到可执行位置
sudo cp scripts/fido2-resolver.mjs /usr/local/bin/openclaw-fido2-resolver
sudo chmod +x /usr/local/bin/openclaw-fido2-resolver

# 或使用符号链接（如果使用 Homebrew）
ln -s $(which openclaw-fido2-resolver) /usr/local/bin/openclaw-fido2-resolver
```

### 3. 写入密钥

```bash
# 使用密钥管理工具写入密钥
node scripts/fido2-keys/dist/cli.js set openai-api-key "OpenAI API Key"

# 按照提示输入密钥值（会被隐藏）
# 当提示时触摸 FIDO2 硬件
```

### 4. 配置 OpenClaw

```bash
# 使用 secrets configure 命令添加 provider
openclaw secrets configure --providers-only

# 或直接编辑配置文件
openclaw config edit

# 在编辑器中添加上述配置
```

### 5. 测试

```bash
# 测试密钥是否可解析
openclaw models list --probe

# 重启 gateway 以使用新配置
openclaw gateway restart
```

## 使用密钥管理工具

### 写入新密钥

```bash
# 使用密钥管理工具
node scripts/fido2-keys/dist/cli.js set <id> <label>

# 示例
node scripts/fido2-keys/dist/cli.js set openai-api-key "OpenAI API Key"
node scripts/fido2-keys/dist/cli.js set anthropic-api-key "Anthropic API Key"
node scripts/fido2-keys/dist/cli.js set github-token "GitHub Personal Token"
```

### 列出所有密钥

```bash
node scripts/fido2-keys/dist/cli.js list
# 或
node scripts/fido2-keys/dist/cli.js ls
```

### 获取密钥值

```bash
node scripts/fido2-keys/dist/cli.js get <id>

# 需要触摸 FIDO2 硬件验证
```

### 删除密钥

```bash
node scripts/fido2-keys/dist/cli.js delete <id>
```

### 交互式导入

```bash
node scripts/fido2-keys/dist/cli.js import
# 按照提示输入 ID、标签和值
```

### 检查状态

```bash
node scripts/fido2-keys/dist/cli.js status
# 检查 FIDO2 可用性和存储状态
```

## 存储位置

密钥数据存储在：`~/.openclaw/fido2-keys.json`

### 存储格式

```json
[
  {
    "id": "openai-api-key",
    "label": "OpenAI API Key",
    "encryptedValue": "base64编码的加密数据",
    "iv": "base64编码的初始化向量",
    "createdAt": 1737904000000,
    "rpId": "openclaw.ai",
    "userHandle": "base64编码的用户标识",
    "credentialId": "fido2凭证ID",
    "credentialPublicKey": "base64编码的公钥"
  }
]
```

## 安全注意事项

1. **硬件要求**: FIDO2 硬件密钥必须连接到计算机
2. **每次访问需要验证**: 每次 OpenClaw 访问密钥时，你都需要触摸硬件
3. **加密存储**: 即使本地存储文件被窃取，攻击者也无法读取明文密钥
4. **备份**: FIDO2 credential 损坏无法恢复，建议定期备份加密的存储文件
5. **多设备支持**: 如果有多个设备，每个设备需要单独创建 FIDO2 credential

## 故障排除

### 密钥解析失败

如果 OpenClaw 启动时提示密钥解析失败：

1. 检查 FIDO2 硬件是否已连接
2. 运行 `node scripts/fido2-keys/dist/cli.js status` 检查 FIDO2 状态
3. 验证 resolver 脚本路径是否正确
4. 检查 resolver 是否有执行权限

### FIDO2 不可用

如果 FIDO2 检测失败：

1. 确认 FIDO2 驱动已安装
2. 检查硬件是否被操作系统识别
3. 重启计算机后重试

### 解密失败

如果解密操作失败：

1. 确认使用的是相同的 FIDO2 硬件
2. 检查存储文件是否损坏
3. 使用 `openclaw-fido2-keys delete` 删除并重新添加密钥

### 超时问题

如果 FIDO2 操作超时：

1. 增加配置中的 `timeoutMs` 值（默认 30 秒）
2. 检查 FIDO2 硬件是否有响应问题

## 与其他 provider 比较

| Provider | 存储位置 | 访问方式 | 适用场景 |
|----------|----------|----------|----------|
| `env` | 环境变量 | 直接读取 | 开发环境，简单部署 |
| `file` | 本地 JSON 文件 | 文件读取 | 需要版本控制的存储 |
| `exec` (1Password) | 1Password 软件密码库 | 外部命令 | 使用 1Password 管理密钥 |
| `exec` (Vault) | HashiCorp Vault | 外部命令 | 企业级密钥管理 |
| `exec` (FIDO2) | FIDO2 硬件 | 外部命令 + 物理验证 | 最高安全性需求 |

## 高级配置

### 使用环境变量控制超时

```bash
# 设置自定义超时时间
OPENCLAW_FIDO2_TIMEOUT=60000 openclaw gateway run
```

### 调试模式

在 resolver 脚本中设置环境变量启用详细日志：

```bash
DEBUG=1 /usr/local/bin/openclaw-fido2-resolver
```

## 相关命令

```bash
# 查看 secrets 配置
openclaw secrets list

# 检查 secrets 状态
openclaw secrets audit --check

# 手动重新加载 secrets
openclaw secrets reload
```

## 另请参阅

- [Secrets Management](/gateway/secrets)
- [Authentication](/gateway/authentication)
- [Security](/gateway/security)
-密钥管理工具 README](https://github.com/openclaw/openclaw/tree/main/scripts/fido2-keys)
