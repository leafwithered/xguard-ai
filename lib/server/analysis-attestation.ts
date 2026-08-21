import "server-only";

export { attachAnalysisAttestation, createAnalysisAttestation, getPublicAttestationKey } from "./analysis-attestation-core.ts";
export type { AttestationSigningConfig, AttestationSigningResult, AttestationSigningStatus } from "./analysis-attestation-core.ts";

export function runtimeAttestationSigningConfig() {
  return {
    privateKeyPemBase64: process.env.XGUARD_ATTESTATION_PRIVATE_KEY_PEM_B64,
    keyId: process.env.XGUARD_ATTESTATION_KEY_ID
  };
}
