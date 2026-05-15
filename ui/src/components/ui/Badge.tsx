import { cn } from '../../lib/utils';

const colorClasses = {
  green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  gray: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
} as const;

export interface BadgeProps extends React.ComponentPropsWithoutRef<'span'> {
  color?: keyof typeof colorClasses;
}

export default function Badge({ color = 'gray', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        colorClasses[color],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
