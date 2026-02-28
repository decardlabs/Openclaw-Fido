/**
 * FIDO2 存储的密钥数据结构
 */

/**
 * 存储在本地文件中的加密密钥
 */
export interface Fido2StoredKey {
  /** 唯一标识符，用于从多个密钥中查找 */
  id: string;

  /** 用户友好的标签 */
  label: string;

  /** AES-256-GCM 加密后的密钥值 */
  encryptedValue: string;

  /** 初始化向量 */
  iv: string;

  /** 创建时间戳 */
  createdAt: number;

  /** Relying Party ID */
  rpId: string;

  /** 用户标识符（base64 编码） */
  userHandle: string;

  /** FIDO2 credential ID（可选，用于 resident keys） */
  credentialId?: string;

  /** 创建此密钥的 FIDO2 credential 的公钥（用于派生加密密钥） */
  credentialPublicKey?: string;
}

/**
 * FIDO2 创建凭证的结果
 */
export interface Fido2CredentialResult {
  credentialId: string;
  publicKey: Uint8Array;
  authenticatorData: Uint8Array;
}

/**
 * FIDO2 获取凭证的结果
 */
export interface Fido2AssertionResult {
  authenticatorData: Uint8Array;
  signature: Uint8Array;
  userHandle: Uint8Array;
}

/**
 * 加密结果
 */
export interface EncryptedResult {
  encrypted: string;
  iv: string;
}

/**
 * 加密密钥数据
 */
export interface KeyEncryptionData {
  value: string;
  iv: string;
}
