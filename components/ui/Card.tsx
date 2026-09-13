export const CARD_CLASS =
  "rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800";

export function Card({
  title,
  icon,
  action,
  children,
  className = "",
  bodyClassName = "px-4 pb-4",
}: {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`${CARD_CLASS} ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
          <h2 className="flex min-w-0 items-center gap-2 text-sm font-bold">
            {icon}
            <span className="truncate">{title}</span>
          </h2>
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
