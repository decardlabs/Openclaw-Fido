/**
 * FIDO2 密钥管理工具 CLI
 *
 * 用于管理存储在 FIDO2 硬件中的 API 密钥
 */

#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { password, confirm } from '@clack/prompts';
import { createCredential, isFido2Available } from './fido2.js';
import {
  encryptValue,
  deriveEncryptionKey
} from './crypto.js';
import type { Fido2StoredKey } from './types.js';

// 存储文件路径
const STORAGE_PATH = path.join(
  os.homedir(),
  '.openclaw',
  'fido2-keys.json'
);

/**
 * 从文件加载存储的密钥
 */
async function loadStoredKeys(): Promise<Fido2StoredKey[]> {
  try {
    const data = await fs.readFile(STORAGE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * 保存密钥到文件
 */
async function saveStoredKeys(keys: Fido2StoredKey[]): Promise<void> {
  const dir = path.dirname(STORAGE_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(STORAGE_PATH, JSON.stringify(keys, null, 2));
}

/**
 * 格式化时间戳
 */
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 列出所有存储的密钥
 */
async function listKeys(): Promise<void> {
  const keys = await loadStoredKeys();

  if (keys.length === 0) {
    console.log('\x1b[33m📭 没有存储的密钥\x1b[0m');
    console.log('\n使用 "openclaw-fido2-keys set <id> <label>" 来添加新密钥');
    return;
  }

  console.log('\x1b[36m╔═════════════════════════════════════════════════════╗\x1b[0m');
  console.log('\x1b[36m║\x1b[0m                  \x1b[32m📋 存储的密钥\x1b[0m                  \x1b[36m║\x1b[0m');
  console.log('\x1b[36m╠═════════════════════════════════════════════════════╣\x1b[0m');
  console.log('\x1b[36m║\x1b[0m');

  for (const key of keys) {
    console.log(`\x1b[36m║\x1b[0m  \x1b[32mID:\x1b[0m    ${key.id}`);
    console.log(`\x1b[36m║\x1b[0m  \x1b[32m标签:\x1b[0m    ${key.label}`);
    console.log(`\x1b[36m║\x1b[0m  \x1b[32m创建时间:\x1b[0m ${formatTimestamp(key.createdAt)}`);
    console.log(`\x1b[36m║\x1b[0m  \x1b[32mCredential ID:\x1b[0m ${key.credentialId || 'N/A'}`);
    console.log('\x1b[36m║\x1b[0m');
  }

  console.log('\x1b[36m╚═════════════════════════════════════════════════════╝\x1b[0m');
  console.log(`\n存储位置: ${STORAGE_PATH}`);
  console.log(`\n总共: \x1b[32m${keys.length}\x1b[0m 个密钥`);
}

/**
 * 获取密钥值
 */
async function getKeyValue(id: string): Promise<string> {
  const keys = await loadStoredKeys();
  const key = keys.find(k => k.id === id);

  if (!key) {
    throw new Error(`密钥 "${id}" 不存在`);
  }

  console.log(`\x1b[32m📝 密钥 ID: \x1b[0m${key.id}`);
  console.log(`\x1b[32m📝 标签: \x1b[0m${key.label}`);

  // 需要解密
  if (key.encryptedValue && key.credentialPublicKey) {
    try {
      const publicKey = Buffer.from(key.credentialPublicKey, 'base64');
      const encryptionKey = await deriveEncryptionKey(key.id, publicKey);
      const decrypted = await decryptValue(key.encryptedValue, key.iv, encryptionKey);
      return decrypted;
    } catch (error) {
      throw new Error(`解密失败: ${(error as Error).message}`);
    }
  }

  // 如果是明文存储（向后兼容）
  throw new Error('此密钥未使用 FIDO2 加密');
}

/**
 * 写入新密钥
 */
async function setKey(id: string, label: string, value: string): Promise<void> {
  console.log(`\x1b[36m╔═════════════════════════════════════════════════════╗\x1b[0m');
  console.log(`\x1b[36m║\x1b[0m              \x1b[32m写入密钥到 FIDO2\033[0m              \x1b[36m║\x1b[0m`);
  console.log(`\x1b[36m╠═══════════════════════════════════════════════════╣\x1b[0m`);
  console.log(`\x1b[36m║\x1b[0m`);
  console.log(`\x1b[36m║\x1b[0m  \x1b[32mID:\x1b[0m          ${id}`);
  console.log(`\x1b[36m║\x1b[0m  \x1b[32m标签:\x1b[0m          ${label}`);
  console.log(`\x1b[36m║\x1b[0m`);

  // 检查 FIDO2 可用性
  if (!isFido2Available()) {
    console.log(`\x1b[36m║\x1b[0m  \x1b[31m⚠️  FIDO2 不可用，将使用模拟模式\x1b[0m`);
    console.log(`\x1b[36m║\x1b[0m`);
  }

  console.log(`\x1b[36m║\x1b[0m  \x1b[33m1. 正在创建 FIDO2 凭证...\x1b[0m`);
  console.log(`\x1b[36m║\x1b[0m`);

  // 创建 FIDO2 credential
  const userId = `openclaw-${id}`;
  const userName = `${label} (${id})`;

  const { credentialId, publicKey, authenticatorData } = await createCredential(userId, userName);

  console.log(`\x1b[36m║\x1b[0m  \x1b[32mCredential ID: ${credentialId}\x1b[0m`);
  console.log(`\x1b[36m║\x1b[0m`);

  // 派生加密密钥并加密值
  console.log(`\x1b[36m║\x1b[0m  \x1b[33m2. 正在加密密钥值...\x1b[0m`);
  console.log(`\x1b[36m║\x1b[0m`);

  const encryptionKey = await deriveEncryptionKey(credentialId, publicKey);
  const { encrypted, iv } = await encryptValue(value, encryptionKey);

  // 构建存储对象
  const keys = await loadStoredKeys();

  // 检查是否已存在
  const existingIndex = keys.findIndex(k => k.id === id);
  if (existingIndex >= 0) {
    const shouldReplace = await confirm({
      message: `密钥 "${id}" 已存在，是否覆盖？`,
      defaultValue: false,
    });

    if (!shouldReplace) {
      console.log(`\x1b[36m║\x1b[0m  \x1b[31m操作已取消\x1b[0m`);
      console.log(`\x1b[36m╚═════════════════════════════════════════════════════╝\x1b[0m`);
      return;
    }
    keys.splice(existingIndex, 1);
  }

  // 添加新密钥
  const storedKey: Fido2StoredKey = {
    id,
    label,
    encryptedValue: encrypted,
    iv,
    createdAt: Date.now(),
    rpId: 'openclaw.ai',
    userHandle: Buffer.from(userId).toString('base64'),
    credentialId,
    credentialPublicKey: Buffer.from(publicKey).toString('base64'),
  };

  keys.push(storedKey);
  await saveStoredKeys(keys);

  console.log(`\x1b[36m║\x1b[0m  \x1b[32m✅ 密钥已保存\x1b[0m`);
  console.log(`\x1b[36m╚═════════════════════════════════════════════════════╝\x1b[0m`);

  console.log(`\n存储位置: ${STORAGE_PATH}`);
  console.log(`\n💡 提示: 在 OpenClaw 中使用以下配置：`);
  console.log(`   \x1b[32m{ source: "exec", provider: "fido2", id: "${id}" }\x1b[0m`);
}

/**
 * 删除密钥
 */
async function deleteKey(id: string): Promise<void> {
  const keys = await loadStoredKeys();
  const key = keys.find(k => k.id === id);

  if (!key) {
    throw new Error(`密钥 "${id}" 不存在`);
  }

  console.log(`\x1b[32m📝 将删除: ${key.label} (${id})`);

  const shouldDelete = await confirm({
    message: '确认删除此密钥？',
    defaultValue: false,
  });

  if (!shouldDelete) {
    console.log('\x1b[31m操作已取消');
    return;
  }

  const updatedKeys = keys.filter(k => k.id !== id);
  await saveStoredKeys(updatedKeys);

  console.log('\x1b[32m✅ 密钥已删除');
}

/**
 * 导入密钥
 */
async function importKey(): Promise<void> {
  console.log('\x1b[36m╔═════════════════════════════════════════════════════╗\x1b[0m');
  console.log(`\x1b[36m║\x1b[0m              \x1b[32m导入密钥到 FIDO2\033[0m              \x1b[36m║\x1b[0m`);
  console.log(`\x1b[36m╠═══════════════════════════════════════════════════╣\x1b[0m`);
  console.log(`\x1b[36m║\x1b[0m`);

  const idInput = await password({
    message: '请输入密钥 ID (例如: openai-api-key)',
    validate: (value: string) => {
      if (!value.match(/^[a-z0-9-]+$/)) {
        return 'ID 只能包含小写字母、数字和连字符';
      }
      return value;
    },
  });

  const labelInput = await password({
    message: '请输入密钥标签',
    defaultValue: idInput,
  });

  console.log(`\x1b[36m║\x1b[0m`);

  const valueInput = await password({
    message: '请输入密钥值 (输入时隐藏)',
    mask: '*',
  });

  console.log(`\x1b[36m║\x1b[0m`);

  await setKey(idInput, labelInput, valueInput);
}

/**
 * 解密密钥值（内部函数）
 */
async function decryptValue(
  encrypted: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  // 动态导入 crypto 函数
  const { webcrypto } = await import('node:crypto');
  const decrypted = await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv: Buffer.from(iv, 'base64') },
    key,
    Buffer.from(encrypted, 'base64')
  );

  const decoder = new TextDecoder();
  return decoder.decode(new Uint8Array(decrypted));
}

/**
 * 导出密钥
 */
async function exportKey(id: string): Promise<void> {
  const value = await getKeyValue(id);
  console.log(`\n\x1b[32m📋 密钥值:\x1b[0m`);
  console.log('\x1b[36m' + '═'.repeat(50) + '\x1b[0m');
  console.log(`\x1b[36m${value}\x1b[0m`);
  console.log('\x1b[36m' + '═'.repeat(50) + '\x1b[0m');

  const shouldCopy = await confirm({
    message: '是否复制到剪贴板？',
    defaultValue: true,
  });

  if (shouldCopy) {
    try {
      const clipboardy = await import('clipboardy');
      await clipboardy.default.writeSync(value);
      console.log('\x1b[32m✅ 已复制到剪贴板');
    } catch {
      console.log('\x1b[33m⚠️  剪贴板访问不可用');
    }
  }
}

/**
 * 初始化存储目录
 */
async function initStorage(): Promise<void> {
  const dir = path.dirname(STORAGE_PATH);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // 目录已存在
  }
}

// 主程序
const program = new Command();

program
  .name('openclaw-fido2-keys')
  .description('OpenClaw FIDO2 密钥管理工具')
  .version('1.0.0');

program
  .command('set <id> <label>')
  .description('写入新密钥到 FIDO2 存储')
  .action(async (id, label) => {
    await initStorage();

    const value = await password({
      message: '请输入密钥值 (输入时隐藏)',
      mask: '*',
    });

    await setKey(id, label, value);
  });

program
  .command('get <id>')
  .description('获取并解密密钥值')
  .action(async (id) => {
    await initStorage();
    try {
      const value = await getKeyValue(id);
      console.log(`\n密钥值: ${value}`);
    } catch (error) {
      console.error(`\x1b[31m错误: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('list')
  .alias('ls')
  .description('列出所有存储的密钥')
  .action(async () => {
    await initStorage();
    await listKeys();
  });

program
  .command('delete <id>')
  .alias('rm', 'del')
  .description('删除指定密钥')
  .action(async (id) => {
    await initStorage();
    try {
      await deleteKey(id);
    } catch (error) {
      console.error(`\x1b[31m错误: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('import')
  .description('交互式导入新密钥')
  .action(async () => {
    await initStorage();
    try {
      await importKey();
    } catch (error) {
      console.error(`\x1b[31m错误: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('export <id>')
  .description('导出密钥值（解密后显示）')
  .action(async (id) => {
    await initStorage();
    try {
      await exportKey(id);
    } catch (error) {
      console.error(`\x1b[31m错误: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('clear')
  .description('清空所有存储的密钥')
  .action(async () => {
    const shouldClear = await confirm({
      message: '确认清空所有密钥？此操作不可撤销！',
      defaultValue: false,
    });

    if (!shouldClear) {
      console.log('\x1b[31m操作已取消');
      return;
    }

    await saveStoredKeys([]);
    console.log('\x1b[32m✅ 所有密钥已清空');
  });

program
  .command('status')
  .description('检查 FIDO2 可用状态')
  .action(() => {
    console.log('\n\x1b[36mFIDO2 状态检查:\x1b[0m');
    console.log('\x1b[36m' + '─'.repeat(40));

    if (isFido2Available()) {
      console.log('\x1b[32m✅ FIDO2 可用');
      console.log('   您可以使用 FIDO2 硬件密钥存储密钥');
    } else {
      console.log('\x1b[33m⚠️  FIDO2 不可用');
      console.log('   密钥将以加密方式存储在本地文件中');
    }

    console.log('\n存储位置: ' + STORAGE_PATH);

    try {
      const keys = await loadStoredKeys();
      console.log('\n已存储密钥数: ' + keys.length);
    } catch {
      console.log('存储文件: 未初始化');
    }
  });

// 解析命令行参数并执行
program.parse(process.argv);
