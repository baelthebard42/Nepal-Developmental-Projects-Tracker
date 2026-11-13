import type { Metadata } from "next";
import { ProjectTable } from "@/components/data/ProjectTable";

export const metadata: Metadata = { title: "Project data · Nepal Development Projects Map" };

export default function DataPage() {
  return (
    <main className="flex-1 overflow-y-auto bg-l-bg text-l-text">
      <ProjectTable />
    </main>
  );
}
