export function meta() {
  return [
    { title: "Aaron Ellis — Staff Full-Stack Engineer" },
    {
      name: "description",
      content:
        "Staff full-stack engineer — TypeScript, React, Node. 12 years of consumer fintech.",
    },
  ];
}

export default function Index() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="font-display text-5xl font-bold uppercase tracking-wide">
        Aaron Ellis
      </h1>
      <p className="mt-4 text-lg">
        Staff full-stack engineer — TypeScript, React, Node. 12 years of consumer fintech.
      </p>
      <p className="mt-8 text-sm text-ink/70">
        Trail map under construction. The run opens soon.
      </p>
    </main>
  );
}
