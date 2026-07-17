import type { ContractDefinition } from "@/lib/contracts";

type ContractContentProps = {
  definition: ContractDefinition;
  showVersion?: boolean;
  className?: string;
};

export function ContractContent({
  definition,
  showVersion = true,
  className = "",
}: ContractContentProps) {
  return (
    <article className={className}>
      {showVersion && (
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-600">
          Versão {definition.version}
        </p>
      )}
      <h2 className="mt-1 text-lg font-black leading-tight text-gray-900">
        {definition.title}
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-gray-600">
        {definition.intro}
      </p>

      <div className="mt-5 space-y-5">
        {definition.sections.map((section) => (
          <section key={section.title}>
            <h3 className="mb-2 text-sm font-black text-gray-800">
              {section.title}
            </h3>
            <div className="space-y-2">
              {section.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="text-justify text-sm leading-relaxed text-gray-600"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-5 text-sm font-bold leading-relaxed text-gray-800">
        {definition.acceptance}
      </p>
    </article>
  );
}
