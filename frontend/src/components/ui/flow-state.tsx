import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Tone = "warning" | "error" | "info";

// Tone policy for customer-flow states:
// info = loading/in-progress, warning = degraded/fallback, error = failure.

const bannerToneClasses: Record<Tone, string> = {
  warning:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  error: "border-rose-500/30 bg-rose-500/10 text-rose-600",
  info: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
};

interface FlowStateCardProps {
  title?: string;
  message: ReactNode;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: ButtonProps["variant"];
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
  messageClassName?: string;
  children?: ReactNode;
}

export function FlowStateCard({
  title,
  message,
  icon: Icon,
  actionLabel,
  onAction,
  actionVariant = "outline",
  className,
  contentClassName,
  titleClassName,
  messageClassName,
  children,
}: FlowStateCardProps) {
  return (
    <Card className={className}>
      <CardContent className={cn("py-16 text-center", contentClassName)}>
        {Icon && (
          <Icon className="mx-auto h-12 w-12 text-muted-foreground/70" />
        )}
        {title && (
          <h3
            className={cn(
              "mt-4 text-xl font-semibold text-foreground",
              titleClassName,
            )}
          >
            {title}
          </h3>
        )}
        <p className={cn("mt-2 text-muted-foreground", messageClassName)}>
          {message}
        </p>
        {actionLabel && onAction && (
          <Button className="mt-5" variant={actionVariant} onClick={onAction}>
            {actionLabel}
          </Button>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

interface FlowStateBannerProps {
  message: ReactNode;
  tone: Tone;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  actionIcon?: LucideIcon;
  className?: string;
}

export function FlowStateBanner({
  message,
  tone,
  actionLabel,
  onAction,
  actionDisabled,
  actionIcon: ActionIcon,
  className,
}: FlowStateBannerProps) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm",
        bannerToneClasses[tone],
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p>{message}</p>
        {actionLabel && onAction && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-2"
            onClick={onAction}
            disabled={actionDisabled}
          >
            {ActionIcon && <ActionIcon className="h-4 w-4" />}
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

interface FlowStateSectionProps {
  loading: boolean;
  error: string | null;
  isEmpty?: boolean;
  loadingMessage: ReactNode;
  emptyTitle?: string;
  emptyMessage?: ReactNode;
  onRetry: () => void;
  children: ReactNode;
}

export function FlowStateSection({
  loading,
  error,
  isEmpty = false,
  loadingMessage,
  emptyTitle,
  emptyMessage,
  onRetry,
  children,
}: FlowStateSectionProps) {
  if (loading) {
    return <FlowStateBanner tone="info" message={loadingMessage} />;
  }

  if (error) {
    return (
      <FlowStateBanner
        tone="error"
        message={error}
        actionLabel="Try Again"
        onAction={onRetry}
      />
    );
  }

  if (isEmpty && emptyTitle && emptyMessage) {
    return (
      <FlowStateCard
        title={emptyTitle}
        message={emptyMessage}
        contentClassName="py-8"
      />
    );
  }

  return <>{children}</>;
}
