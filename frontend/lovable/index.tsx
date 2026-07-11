import { createFileRoute } from "@tanstack/react-router";
import CareerScrollExperience from "@/components/CareerScrollExperience";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <main className="bg-white">
      <CareerScrollExperience />
      <div className="h-24 bg-white" />
    </main>
  );
}
