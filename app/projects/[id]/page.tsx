import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectDetail } from "@/components/project/ProjectDetail";
import { getDataset } from "@/lib/data/load-dataset";

export const revalidate = 300;

async function findProject(id: string) {
  const ds = await getDataset();
  return ds.projects.find((p) => p.id === decodeURIComponent(id));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const p = await findProject((await params).id);
  return { title: p ? `${p.title_en} · Nepal Development Projects Map` : "Project not found" };
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const project = await findProject((await params).id);
  if (!project) notFound();
  return <ProjectDetail project={project} />;
}
