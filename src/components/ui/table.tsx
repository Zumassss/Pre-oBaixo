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
              "whitespace-nowrap px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-faint",
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
  selected = false,
  onClick,
}: {
  children: React.ReactNode;
  index?: number;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <tr
      data-selected={selected}
      onClick={onClick}
      className={cn(
        "selectable border-b border-hairline/60 last:border-0",
        onClick && "cursor-pointer",
      )}
      style={{
        animation: `rise 0.45s cubic-bezier(0.16,1,0.3,1) ${Math.min(index, 12) * 35}ms both`,
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
