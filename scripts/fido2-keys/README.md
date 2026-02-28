# OpenClaw FIDO2 密钥管理工具

使用 FIDO2/WebAuthn 安全密钥硬件存储和管理 OpenClaw 的敏感配置。

## 安装

```bash
cd scripts/fido2-keys
npm install
npm run build
```

## 使用方法

### 1. 写入新密钥

```bash
# 直接使用命令
node dist/cli.js set openai-api-key "OpenAI API Key"

# 然后输入密钥值（隐藏）
```

### 2. 列出所有密钥

```bash
node dist/cli.js list
# 或
node dist/cli.js ls
```

### 3. 获取密钥值

```bash
node dist/cli.js get openai-api-key
# 需要触摸 FIDO2 硬件验证
```

### 4. 删除密钥

```bash
node dist/cli.js delete openai-api-key
# 确认后删除
```

### 5. 交互式导入

```bash
node dist/cli.js import
# 按照提示输入 ID、标签和值
```

### 6. 导出密钥

```bash
node dist/cli.js export openai-api-key
# 解密并显示密钥值
```

### 7. 检查状态

```bash
node dist/cli.js status
# 检查 FIDO2 可用性和存储状态
```

## OpenClaw 配置示例

在 `~/.openclaw/openclaw.json` 中添加：

```json5
{
  secrets: {
    providers: {
      fido2: {
        source: "exec",
        command: "/usr/local/bin/openclaw-fido2-resolver",
        jsonOnly: true,
        timeoutMs: 30000,
      },
    },
    defaults: {
      exec: "fido2",
    },
  },
  models: {
    providers: {
      openai: {
        apiKey: { source: "exec", provider: "fido2", id: "openai-api-key" },
      },
    },
  },
}
```

## 存储位置

密钥数据存储在：`~/.openclaw/fido2-keys.json`

存储格式：
```json
[
  {
    "id": "openai-api-key",
    "label": "OpenAI API Key",
    "encryptedValue": "...",
    "iv": "...",
    "createdAt": 1737904000000,
    "rpId": "openclaw.ai",
    "userHandle": "...",
    "credentialId": "...",
    "credentialPublicKey": "..."
  }
]
```

## 安全特性

- **FIDO2 物理验证**: 每次访问密钥都需要触摸硬件
- **AES-256-GCM 加密**: 本地文件中的数据是加密的
- **PBKDF2 密钥派生**: 从 FIDO2 credential 派生加密密钥
- **随机 Challenge**: 防止重放攻击

## 注意事项

1. 此工具需要在具有 FIDO2 支持的系统上运行
2. 密钥值在输入时会被隐藏
3. 存储文件本身不包含明文密钥
4. 删除密钥操作需要确认

## 故障排除

### FIDO2 不可用

如果 `openclaw-fido2-keys status` 显示 FIDO2 不可用：

1. 确认已连接 FIDO2 硬件密钥
2. 检查系统 FIDO2 驱动是否已安装
3. 重启系统后重试

### 解密失败

如果获取密钥时解密失败：

1. 确认使用的是相同的 FIDO2 硬件
2. 检查存储文件是否被损坏
3. 可以使用 `openclaw-fido2-keys delete` 删除并重新添加密钥

## 与 OpenClaw 集成

安装 resolver 到 OpenClaw 后：

```bash
# 复制 resolver
sudo cp scripts/fido2-resolver.mjs /usr/local/bin/openclaw-fido2-resolver
sudo chmod +x /usr/local/bin/openclaw-fido2-resolver

# 测试
openclaw models list --probe
```

每当你访问使用 FIDO2 保护的密钥时，OpenClaw 会提示你触摸硬件密钥。
