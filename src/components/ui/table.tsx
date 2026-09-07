import { cn } from "@/lib/utils";

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  );
}

export function Thead({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr className="border-b border-hairline">
        {columns.map((column, i) => (
          <th
            key={column}
            className={cn(
              "whitespace-nowrap px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-fg-faint",
              i === columns.length - 1 && "text-right",
            )}
          >
            {column}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function Tr({
  children,
  index = 0,
}: {
  children: React.ReactNode;
  index?: number;
}) {
  return (
    <tr
      className="group border-b border-hairline/60 transition-colors last:border-0 hover:bg-white/[0.028]"
      style={{
        animation: `rise 0.5s cubic-bezier(0.16,1,0.3,1) ${index * 45}ms both`,
      }}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={cn(
        "whitespace-nowrap px-4 py-3 text-[12.5px] text-fg-muted",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </td>
  );
}
