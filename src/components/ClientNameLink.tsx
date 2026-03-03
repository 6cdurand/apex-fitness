'use client';

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuthStore } from '@/lib/store';

interface ClientNameLinkProps {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  showAvatar?: boolean;
  avatarSize?: string;
  className?: string;
  nameClassName?: string;
}

/**
 * Renders a user's name as a link to their client file (trainer mode)
 * or profile (user mode). Avatar links to profile regardless of mode.
 */
export function ClientNameLink({
  userId,
  displayName,
  avatarUrl,
  showAvatar = false,
  avatarSize = 'h-8 w-8',
  className = '',
  nameClassName = '',
}: ClientNameLinkProps) {
  const { user } = useAuthStore();
  const isTrainer = user?.mode === 'trainer';

  const nameHref = isTrainer ? `/clients/${userId}` : `/profile/${userId}`;
  const avatarHref = `/profile/${userId}`;

  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {showAvatar && (
        <Link href={avatarHref} onClick={(e) => e.stopPropagation()}>
          <Avatar className={`${avatarSize} cursor-pointer hover:ring-2 hover:ring-sky-500/50 transition-all`}>
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="bg-sky-900 text-sky-300 text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Link>
      )}
      <Link
        href={nameHref}
        onClick={(e) => e.stopPropagation()}
        className={`hover:underline hover:text-sky-400 transition-colors ${nameClassName}`}
      >
        {displayName}
      </Link>
    </span>
  );
}
