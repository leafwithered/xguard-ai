import { NextResponse } from "next/server";
import { getPublicAttestationKey, runtimeAttestationSigningConfig } from "../../../lib/server/analysis-attestation";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getPublicAttestationKey(runtimeAttestationSigningConfig()), {
    headers: { "cache-control": "no-store" }
  });
}
