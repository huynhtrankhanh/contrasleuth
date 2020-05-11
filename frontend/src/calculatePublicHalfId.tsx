import * as sodium from "libsodium-wrappers";

const CALCULATE_PUBLIC_HALF_ID_DOMAIN = sodium.crypto_generichash(
  sodium.crypto_generichash_BYTES,
  "CONTRASLEUTH CALCULATE PUBLIC HALF ID"
);

const calculatePublicHalfId = (
  publicEncryptionKey: number[],
  publicSigningKey: number[]
) =>
  sodium.crypto_generichash(
    sodium.crypto_generichash_BYTES,
    new Uint8Array([
      ...publicEncryptionKey,
      ...publicSigningKey,
      ...CALCULATE_PUBLIC_HALF_ID_DOMAIN,
    ])
  );

export default calculatePublicHalfId;
