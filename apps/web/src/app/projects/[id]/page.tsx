import { notFound } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { toProjectJson } from "@/lib/persistence/toProjectJson";
import { Editor } from "@/editor/components/Editor";

export const dynamic = "force-dynamic";

export default async function ProjectEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  try {
    const project = await toProjectJson(id);
    return <Editor initialProject={project} />;
  } catch (e) {
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2025"
    ) {
      notFound();
    }
    throw e;
  }
}
