// In-memory only store of the derived EVM private key for the active session.
// Never persisted to disk; cleared on tab close.

const keys = new Map<string, string>();

export function rememberPrivateKey(address: string, privateKey: string) {
  keys.set(address.toLowerCase(), privateKey);
  try {
    window.dispatchEvent(new CustomEvent("prime:signer-change"));
  } catch { /* noop */ }
}

export function getPrivateKey(address: string): string | undefined {
  return keys.get(address.toLowerCase());
}

export function forgetPrivateKey(address: string) {
  keys.delete(address.toLowerCase());
  try {
    window.dispatchEvent(new CustomEvent("prime:signer-change"));
  } catch { /* noop */ }
}

export async function derivePrivateKeyFromMnemonic(mnemonic: string): Promise<string> {
  const { HDNodeWallet } = await import("ethers");
  const evm = HDNodeWallet.fromPhrase(mnemonic, undefined, "m/44'/60'/0'/0/0");
  return evm.privateKey;
}
