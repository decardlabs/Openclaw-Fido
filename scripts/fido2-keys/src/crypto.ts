/**
 * 加密/解密工具模块
 */

import { webcrypto } from 'node:crypto';
import type { EncryptedResult, KeyEncryptionData } from './types.js';

const PBKDF2_ITERATIONS = 100000;
const AES_GCM_IV_LENGTH = 12;

/**
 * 从 FIDO2 credential 派生加密密钥
 * 使用 credential ID 和 credential 公钥作为 PBKDF2 的输入
 */
export async function deriveEncryptionKey(
  credentialId: string,
  credentialPublicKey: Uint8Array
): Promise<CryptoKey> {
  // 使用 PBKDF2 从 credential ID 和公钥派生加密密钥
  const encoder = new TextEncoder();
  const ikm = new Uint8Array([
    ...encoder.encode(credentialId),
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
 * 加密密钥值
 * @param value - 要加密的明文
 * @param key - AES-GCM 加密密钥
 * @returns 加密结果，包含加密数据和 IV
 */
export async function encryptValue(
  value: string,
  key: CryptoKey
): Promise<EncryptedResult> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);

  // 生成随机 IV
  const iv = webcrypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH));

  // 加密
  const encrypted = await webcrypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return {
    encrypted: Buffer.from(encrypted).toString('base64'),
    iv: Buffer.from(iv).toString('base64'),
  };
}

/**
 * 解密密钥值
 * @param encrypted - Base64 编码的加密数据
 * @param iv - Base64 编码的 IV
 * @param key - AES-GCM 解密密钥
 * @returns 解密后的明文字符串
 */
export async function decryptValue(
  encrypted: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const decrypted = await webcrypto.subtle.decrypt(
    { name: 'AES-GCM', iv: Buffer.from(iv, 'base64') },
    key,
    Buffer.from(encrypted, 'base64')
  );

  const decoder = new TextDecoder();
  return decoder.decode(new Uint8Array(decrypted));
}

/**
 * 生成随机 challenge
 */
export function generateChallenge(): Uint8Array {
  return webcrypto.getRandomValues(new Uint8Array(32));
}

/**
 * 导入公钥
 */
function importPublicKey(keyData: Uint8Array): Promise<CryptoKey> {
  // 尝试直接导入为 COSE Key
  try {
    return await webcrypto.subtle.importKey(
      'spki',
      keyData,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['deriveKey']
    );
  } catch {
    // 如果失败，尝试作为原始 bytes 处理
    return webcrypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['deriveKey']
    );
  }
}
