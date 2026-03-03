'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getClientDisplayInfo } from '@/lib/clientUtils';

interface ClientLinkProps {
  clientId: string;
  showAvatar?: boolean;
  avatarSize?: 'sm' | 'md' | 'lg';
  onAvatarClick?: (info: { displayName: string; profilePhoto?: string }) => void;
  className?: string;
  nameClassName?: string;
}

const avatarSizes = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
};

/**
 * Reusable component for displaying a client's name + avatar.
 * - Name click → navigates to /clients/[id] (client file)
 * - Avatar click → triggers onAvatarClick callback (for profile card)
 * - Falls back gracefully if client data hasn't loaded yet
 */
export function ClientLink({
  clientId,
  showAvatar = true,
  avatarSize = 'md',
  onAvatarClick,
  className = '',
  nameClassName = '',
}: ClientLinkProps) {
  const router = useRouter();
  const info = getClientDisplayInfo(clientId);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showAvatar && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onAvatarClick) {
              onAvatarClick({ displayName: info.displayName, profilePhoto: info.profilePhoto });
            }
          }}
          className="focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-full flex-shrink-0"
        >
          <Avatar className={`${avatarSizes[avatarSize]} cursor-pointer hover:ring-2 hover:ring-sky-500 transition-all`}>
            <AvatarImage src={info.profilePhoto} />
            <AvatarFallback className="bg-gray-800 text-white">
              {info.displayName?.[0]?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          router.push(`/clients/${clientId}`);
        }}
        className={`font-semibold text-white hover:text-sky-400 transition-colors text-left truncate ${nameClassName}`}
      >
        {info.displayName}
      </button>
    </div>
  );
}

/**
 * Inline client name only (no avatar). Clickable → client file.
 */
export function ClientNameLink({
  clientId,
  className = '',
}: {
  clientId: string;
  className?: string;
}) {
  const router = useRouter();
  const info = getClientDisplayInfo(clientId);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        router.push(`/clients/${clientId}`);
      }}
      className={`font-semibold text-white hover:text-sky-400 transition-colors text-left truncate ${className}`}
    >
      {info.displayName}
    </button>
  );
}
