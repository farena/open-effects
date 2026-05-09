import { NextResponse } from "next/server";
import {
  getBusinessContext,
  updateBusinessContext,
} from "@/lib/business-context";
import { BusinessContextPatchSchema } from "@open-effects/shared-types";

export async function GET() {
  const ctx = await getBusinessContext();
  return NextResponse.json(ctx);
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BusinessContextPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await updateBusinessContext(parsed.data);
  return NextResponse.json(updated);
}
