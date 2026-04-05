// Utility for E2EE using Web Crypto API

/**
 * Converts ArrayBuffer to Base64 String
 */
export const bufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

/**
 * Converts Base64 String to ArrayBuffer
 */
export const base64ToBuffer = (base64) => {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
};

/**
 * Generate ECDH Keypair for this session
 */
export const generateKeypair = async () => {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey', 'deriveBits']
  );
  
  // Export public key to jwk to share easily
  const exportedPublicKey = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);
  
  return { 
    keyPair, 
    publicKeyJwk: exportedPublicKey 
  };
};

/**
 * Import a peer's public JWK key
 */
const importPublicKey = async (jwk) => {
  return await window.crypto.subtle.importKey(
    'jwk',
    jwk,
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    []
  );
};

/**
 * Derive AES-GCM shared key
 */
const deriveSharedKey = async (privateKey, peerPublicKeyJwk) => {
  const peerPublicKey = await importPublicKey(peerPublicKeyJwk);
  
  return await window.crypto.subtle.deriveKey(
    {
      name: 'ECDH',
      public: peerPublicKey,
    },
    privateKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypt a string or buffer for a specific peer
 */
export const encryptPayload = async (stringOrBuffer, myPrivateKey, peerPublicKeyJwk) => {
  const sharedKey = await deriveSharedKey(myPrivateKey, peerPublicKeyJwk);
  
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  let dataBuffer;
  if (typeof stringOrBuffer === 'string') {
    const enc = new TextEncoder();
    dataBuffer = enc.encode(stringOrBuffer);
  } else {
    dataBuffer = stringOrBuffer;
  }

  const cipherText = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    sharedKey,
    dataBuffer
  );

  return {
    iv: bufferToBase64(iv.buffer),
    cipherText: bufferToBase64(cipherText)
  };
};

/**
 * Decrypt a payload received from a specific peer
 */
export const decryptPayload = async (encryptedObj, myPrivateKey, peerPublicKeyJwk, returnString = true) => {
  const sharedKey = await deriveSharedKey(myPrivateKey, peerPublicKeyJwk);
  
  const ivStr = encryptedObj.iv;
  const cipherStr = encryptedObj.cipherText;
  
  const ivBuf = base64ToBuffer(ivStr);
  const cipherBuf = base64ToBuffer(cipherStr);
  
  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuf,
      },
      sharedKey,
      cipherBuf
    );
    
    if (returnString) {
      const dec = new TextDecoder();
      return dec.decode(decryptedBuffer);
    }
    
    return decryptedBuffer;
  } catch (err) {
    console.error('Decryption failed, keys may be invalid or mismatched', err);
    return null;
  }
};
