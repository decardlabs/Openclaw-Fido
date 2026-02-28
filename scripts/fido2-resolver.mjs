#!/usr/bin/env node
/**
 * OpenClaw FIDO2 Secrets Resolver
 *
 * 此脚本实现了 OpenClaw exec provider 协议，用于从 FIDO2 安全存储中解析密钥。
 *
 * 协议版本: 1
 * 请求格式: { "protocolVersion": 1, "provider": "fido2", "ids": [...] }
 * 响应格式: { "protocolVersion": 1, "values": { ... }, "errors": { ... } }
 *
 * 使用方法:
 * 1. 将此脚本复制到可执行位置
 * 2. 在 openclaw.json 中配置 secrets.providers.fido2
 * 3. 运行 openclaw gateway，密钥将自动解析
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { webcrypto } from 'node:crypto';
import readline from 'node:readline';

// ============================================================================
// 常量定义
// ============================================================================

const PROTOCOL_VERSION = 1;
const RP_ID = 'openclaw.ai';
const RP_NAME = 'OpenClaw FIDO2 Secrets';
const PBKDF2_ITERATIONS = 100000;
const AES_GCM_IV_LENGTH = 12;
const STORAGE_PATH = path.join(
  os.homedir(),
  '.openclaw',
  'fido2-keys.json'
);

// 错误代码
const ERROR_CODES = {
  KEY_NOT_FOUND: 'key_not_found',
  FIDO2_CANCELLED: 'fido2_cancelled',
  FIDO2_TIMEOUT: 'fido2_timeout',
  FIDO2_NOT_ALLOWED: 'fido2_not_allowed',
  DECRYPTION_FAILED: 'decryption_failed',
  STORAGE_READ_FAILED: 'storage_read_failed',
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 生成 ANSI 颜色代码
 */
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * 格式化时间戳
 */
function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 输出到 stderr（避免与 stdout 混淆）
 */
function logError(message) {
  process.stderr.write(message + '\n');
}

/**
 * 输出到 stdout
 */
function logInfo(message) {
  process.stdout.write(message + '\n');
}

/**
 * 输出到 stderr（彩色提示）
 */
function logPrompt(message) {
  process.stderr.write(message + '\n');
}

/**
 * 绘制边框
 */
function drawBox(content, width = 60) {
  const horizontal = colors.cyan + '═'.repeat(width) + colors.reset;
  const top = colors.cyan + '╔' + '═'.repeat(width) + '╗' + colors.reset;
  const bottom = colors.cyan + '╚' + '═'.repeat(width) + '╝' + colors.reset;
  const sides = colors.cyan + '║' + colors.reset;

  return { top, bottom, sides, horizontal };
}

/**
 * 从文件加载存储的密钥
 */
async function loadStoredKeys() {
  try {
    const data = await fs.readFile(STORAGE_PATH, 'utf-8');
    const keys = JSON.parse(data);

    // 验证数据格式
    if (!Array.isArray(keys)) {
      throw new Error('存储文件格式无效: 不是数组');
    }

    return keys;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // 文件不存在是正常情况，返回空数组
      return [];
    }
    throw new Error(`读取存储文件失败: ${error.message}`);
  }
}

/**
 * PBKDF2 派生密钥
 */
async function deriveEncryptionKey(credentialId, credentialPublicKey) {
  const ikm = new Uint8Array([
    ...new TextEncoder().encode(credentialId),
    ...credentialPublicKey,
  ]);

  const keyMaterial = await webcrypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: credentialPublicKey,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return keyMaterial;
}

/**
 * 解密密钥值
 */
async function decryptValue(encrypted, iv, encryptionKey) {
  try {
    const decrypted = await webcrypto.subtle.decrypt(
      { name: 'AES-GCM', iv: Buffer.from(iv, 'base64') },
      encryptionKey,
      Buffer.from(encrypted, 'base64')
    );

    const decoder = new TextDecoder();
    return decoder.decode(new Uint8Array(decrypted));
  } catch (error) {
    throw new Error(`解密失败: ${error.message}`);
  }
}

/**
 * 生成随机 challenge
 */
function generateChallenge() {
  return webcrypto.getRandomValues(new Uint8Array(32));
}

/**
 * 解析请求 ID（可能带数组表示法）
 */
function normalizeId(id) {
  // 处理可能的数组表示，如 "keys[0]"
  const arrayMatch = id.match(/^(.+)\[(\d+)\]$/);
  if (arrayMatch) {
    // 这里我们保持原始 ID，因为存储时使用的就是这个
    return id;
  }
  return id;
}

// ============================================================================
// FIDO2 操作
// ============================================================================

/**
 * 模拟 FIDO2 获取凭证
 * 实际实现应该使用 fido2-u2f 或类似库
 */
async function getFido2Credential(credentialId, challenge) {
  logPrompt('');
  logPrompt(colors.bold + colors.cyan + '请触摸您的 FIDO2 安全密钥' + colors.reset);
  logPrompt(colors.cyan + '═════════════════════════════════════');
  logPrompt('');

  // 模拟 FIDO2 交互
  // 在实际环境中，这里会调用 WebAuthn API 或 fido2-u2f
  const authenticatorData = generateChallenge(); // 使用 challenge 作为模拟数据
  const signature = webcrypto.getRandomValues(new Uint8Array(64));

  // 模拟等待时间（给用户触摸硬件的时间）
  await new Promise(resolve => setTimeout(resolve, 2500));

  return {
    authenticatorData,
    signature,
    userHandle: new Uint8Array(16),
  };
}

/**
 * 解析单个密钥
 */
async function resolveSecretKey(id, storedKey) {
  try {
    // 提示用户
    const { top, sides } = drawBox();
    logPrompt(top);
    logPrompt(sides + ` 正在解析密钥: ${colors.bold + colors.magenta + id + colors.reset}`);
    logPrompt(sides);

    // 检查是否需要 FIDO2 验证
    const requiresFido2 = storedKey.encryptedValue && storedKey.credentialPublicKey;

    if (!requiresFido2) {
      // 如果是明文存储（向后兼容）
      const plaintext = storedKey.encryptedValue;
      return { value: plaintext, fromCache: false };
    }

    // 执行 FIDO2 认证
    const { authenticatorData, signature } = await getFido2Credential(
      storedKey.credentialId || id,
      generateChallenge()
    );

    // 派生解密密钥
    logPrompt(sides + ` 正在派生解密密钥...`);
    const publicKey = Buffer.from(storedKey.credentialPublicKey, 'base64');
    const encryptionKey = await deriveEncryptionKey(id, publicKey);

    // 解密值
    logPrompt(sides + ` 正在解密密钥...`);
    const decryptedValue = await decryptValue(
      storedKey.encryptedValue,
      storedKey.iv,
      encryptionKey
    );

    return { value: decryptedValue, fromCache: false };

  } catch (error) {
    const errorMessage = error.message || String(error);

    if (errorMessage.includes('取消') || errorMessage.includes('cancel')) {
      logError(colors.yellow + 'FIDO2 操作被用户取消');
      return {
        error: ERROR_CODES.FIDO2_CANCELLED,
        message: 'FIDO2 操作被用户取消'
      };
    }

    if (errorMessage.includes('超时') || errorMessage.includes('timeout')) {
      logError(colors.yellow + 'FIDO2 操作超时');
      return {
        error: ERROR_CODES.FIDO2_TIMEOUT,
        message: 'FIDO2 操作超时'
      };
    }

    logError(colors.red + `解析密钥失败: ${errorMessage}`);
    return {
      error: ERROR_CODES.DECRYPTION_FAILED,
      message: errorMessage
    };
  }
}

// ============================================================================
// 主解析函数
// ============================================================================

/**
 * 解析所有请求的密钥
 */
async function resolveSecrets(request) {
  // 验证协议版本
  if (request.protocolVersion !== PROTOCOL_VERSION) {
    throw new Error(
      `不支持的协议版本: ${request.protocolVersion}, 支持: ${PROTOCOL_VERSION}`
    );
  }

  // 验证 provider
  if (request.provider !== 'fido2') {
    throw new Error(`不支持的 provider: ${request.provider}`);
  }

  // 验证 IDs
  if (!request.ids || !Array.isArray(request.ids) || request.ids.length === 0) {
    throw new Error('请求中缺少有效的 IDs');
  }

  // 加载存储的密钥
  let storedKeys;
  try {
    storedKeys = await loadStoredKeys();
  } catch (error) {
    return {
      protocolVersion: PROTOCOL_VERSION,
      provider: request.provider,
      values: {},
      errors: {}
    };
  }

  // 构建响应
  const response = {
    protocolVersion: PROTOCOL_VERSION,
    provider: request.provider,
    values: {},
    errors: {}
  };

  // 解析每个请求的 ID
  for (const id of request.ids) {
    const normalizedId = normalizeId(id);
    const storedKey = storedKeys.find(k => k.id === normalizedId);

    if (!storedKey) {
      logError(colors.yellow + `密钥 "${normalizedId}" 未找到`);
      response.errors[id] = {
        message: 'Key not found in FIDO2 storage'
      };
      continue;
    }

    // 解析密钥
    const result = await resolveSecretKey(normalizedId, storedKey);

    if (result.error) {
      response.errors[id] = {
        message: result.message
      };
    } else {
      response.values[id] = result.value;
    }
  }

  return response;
}

/**
 * 输出响应到 stdout
 */
function outputResponse(response) {
  process.stdout.write(JSON.stringify(response, null, 2));
}

// ============================================================================
// 主入口
// ============================================================================

/**
 * 从 stdin 读取请求
 */
async function readRequest() {
  return new Promise((resolve, reject) => {
    let data = '';

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr, // 错误输出，避免与响应混淆
      terminal: false,
    });

    rl.on('line', (line) => {
      data += line;
    });

    rl.on('close', () => {
      try {
        const request = JSON.parse(data || '{}');
        resolve(request);
      } catch (error) {
        reject(new Error(`无效的 JSON 请求: ${error.message}`));
      }
    });

    // 设置超时
    setTimeout(() => {
      rl.close();
      reject(new Error('读取请求超时'));
    }, 30000);
  });
}

/**
 * 主函数
 */
async function main() {
  try {
    // 读取请求
    const request = await readRequest();

    // 解析密钥
    const response = await resolveSecrets(request);

    // 输出响应
    outputResponse(response);

    process.exit(0);
  } catch (error) {
    // 输出错误响应
    const errorResponse = {
      protocolVersion: PROTOCOL_VERSION,
      provider: 'fido2',
      values: {},
      errors: {
        _system: {
          message: error.message || 'Unknown error'
        }
      }
    };

    outputResponse(errorResponse);
    process.exit(1);
  }
}

// 执行主函数
main().catch((error) => {
  console.error('未捕获的错误:', error);
  process.exit(1);
});
