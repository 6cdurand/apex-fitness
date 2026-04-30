'use client';

/**
 * C1 (Sev-2): public profile route.
 *
 * Community profile cards (community/page.tsx:125, :154, :188) router.push
 * to /profile/<uuid>, but /src/app/profile contained only page.tsx (own
 * profile) and strength/. Next.js App Router therefore 404'd on every
 * community card click. This file is the dynamic [id] segment that
 * unblocks the route.
 *
 * Scope per routing:
 *  - Surface-only. No store mutations. No changes to /profile/page.tsx
 *    (own profile), community/page.tsx, or any sync logic.
 *  - Reuses fetchUsersByIdsChunked + readProfileCache / writeProfileCache
 *    from userFetchUtils.ts (same primitives used by /messages).
 *  - Message CTA navigates to /messages (the current /messages page does
 *    not read a conversationId search param; deep-link TODO below).
 *  - Public stats are out of scope. Rendered as a placeholder.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuthStore, useSocialStore } from '@/lib/store';
import { useMessageStore } from '@/lib/messageStore';
import {
  fetchUsersByIdsChunked,
  readProfileCache,
  writeProfileCache,
  isValidUUID,
  type UserProfile,
} from '@/lib/userFetchUtils';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ArrowLeft,
  BadgeCheck,
  MessageCircle,
  UserPlus,
  UserMinus,
  MapPin,
} from 'lucide-react';

// Superset of UserProfile with the optional public-profile flags that may
// be present when the user was seeded from localStorage at page load.
// This page never WRITES these fields back anywhere.
interface PublicProfile extends UserProfile {
  isTrainer?: boolean;
  isVerifiedTrainer?: boolean;
  gymName?: string;
}

export default function PublicProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const targetId = params?.id;

  const { user, isAuthenticated } = useAuthStore();
  const { followUser, unfollowUser } = useSocialStore();
  const { getOrCreateConversation } = useMessageStore();

  // Sync seed from cache so the first paint has a name if we've seen this
  // user before. Prevents a '?' to real-name flash on repeat visits.
  const [profile, setProfile] = useState<PublicProfile | null>(() => {
    if (typeof window === 'undefined') return null;
    if (!targetId || !isValidUUID(targetId)) return null;
    const cached = readProfileCache();
    return (cached[targetId] as PublicProfile) ?? null;
  });
  const [fetchState, setFetchState] = useState<
    'idle' | 'loading' | 'resolved' | 'not-found' | 'error'
  >('idle');

  // Auth gate (mirrors /profile and /community).
  useEffect(() => {
    if (!isAuthenticated) router.replace('/auth');
  }, [isAuthenticated, router]);

  // Own-profile redirect: /profile/<self> -> /profile. Do this BEFORE the
  // fetch effect so we never waste a round-trip on the current user's row.
  useEffect(() => {
    if (user?.id && targetId && user.id === targetId) {
      router.replace('/profile');
    }
  }, [user?.id, targetId, router]);

  // Fetch the target user.
  useEffect(() => {
    if (!targetId) return;
    if (user?.id && user.id === targetId) return;
    if (!isValidUUID(targetId)) {
      setFetchState('not-found');
      return;
    }

    let cancelled = false;
    const load = async () => {
      setFetchState('loading');
      try {
        const { usersById } = await fetchUsersByIdsChunked([targetId]);
        if (cancelled) return;
        const fetched = usersById[targetId] as PublicProfile | undefined;
        if (!fetched) {
          // If the profile cache seeded a value we still show it (a brief
          // "row disappears from /users" flake shouldn't blank the page).
          setFetchState(profile ? 'resolved' : 'not-found');
          return;
        }
        setProfile(prev => ({ ...(prev ?? {}), ...fetched } as PublicProfile));
        writeProfileCache({ [targetId]: fetched });
        setFetchState('resolved');
      } catch (e) {
        if (cancelled) return;
        console.error('[PublicProfile] fetch failed for', targetId, e);
        setFetchState('error');
      }
    };
    load();
    return () => {
      cancelled = true;
    };
    // `profile` intentionally omitted: we own its lifecycle here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId, user?.id]);

  const isFollowing = useMemo(
    () => !!(user?.following && targetId && user.following.includes(targetId)),
    [user?.following, targetId],
  );

  const displayName = profile?.displayName || profile?.username || '';

  // Early returns.
  if (!isAuthenticated || !user) return null;
  // Render nothing while the own-profile redirect is in flight.
  if (user.id === targetId) return null;

  if (!targetId || fetchState === 'not-found') {
    return (
      <MainLayout>
        <div className="px-4 py-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            aria-label="Back"
            className="mb-2"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Card className="bg-white border-gray-200 shadow-sm">
            <CardContent className="py-12 text-center">
              <p className="text-gray-900 font-semibold mb-1">User not found</p>
              <p className="text-sm text-gray-500">
                This profile may have been removed or the link is invalid.
              </p>
              <Button
                variant="link"
                className="text-sky-500 mt-3"
                onClick={() => router.push('/community')}
              >
                Back to Community
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // CTA handlers.
  const handleFollowToggle = () => {
    if (!profile) return;
    const label = displayName || 'user';
    if (isFollowing) {
      unfollowUser(targetId);
      toast.success(`Unfollowed ${label}`);
    } else {
      followUser(targetId);
      toast.success(`Following ${label}`);
    }
  };

  const handleMessage = () => {
    // Ensure the conversation exists before navigating so /messages lists
    // it in the user's sidebar on arrival.
    // TODO: once /messages accepts a ?conversationId=<id> search param,
    //       deep-link to it here:
    //       router.push(`/messages?conversationId=${conv.id}`).
    //       Routing explicitly scoped this out of the current commit.
    try {
      getOrCreateConversation(user.id, targetId);
    } catch (e) {
      console.error('[PublicProfile] getOrCreateConversation failed:', e);
    }
    router.push('/messages');
  };

  return (
    <MainLayout>
      <div className="px-4 py-4">
        {/* Back bar */}
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-gray-900 truncate">
            {displayName || 'Profile'}
          </h1>
        </div>

        {/* Header card */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-5 flex flex-col items-center text-center">
            <Avatar className="w-24 h-24 mb-3">
              <AvatarImage src={profile?.profilePhoto} />
              <AvatarFallback className="bg-gray-100 text-gray-900 text-2xl">
                {displayName?.[0] || '?'}
              </AvatarFallback>
            </Avatar>

            <div className="flex items-center gap-2">
              <p className="text-xl font-semibold text-gray-900">
                {displayName || 'Unknown user'}
              </p>
              {profile?.isVerifiedTrainer && (
                <BadgeCheck
                  className="w-5 h-5 text-blue-400"
                  aria-label="Verified trainer"
                />
              )}
            </div>

            {profile?.username && (
              <p className="text-sm text-gray-500 mt-0.5">@{profile.username}</p>
            )}
            {profile?.gymName && (
              <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {profile.gymName}
              </p>
            )}

            {/* CTAs */}
            <div className="flex gap-2 mt-4 w-full max-w-xs">
              <Button
                onClick={handleFollowToggle}
                variant={isFollowing ? 'outline' : 'default'}
                className={
                  isFollowing
                    ? 'flex-1 border-gray-300'
                    : 'flex-1 bg-sky-500 hover:bg-sky-600 text-white'
                }
              >
                {isFollowing ? (
                  <span className="flex items-center">
                    <UserMinus className="w-4 h-4 mr-1.5" />
                    Unfollow
                  </span>
                ) : (
                  <span className="flex items-center">
                    <UserPlus className="w-4 h-4 mr-1.5" />
                    Follow
                  </span>
                )}
              </Button>
              <Button
                onClick={handleMessage}
                variant="outline"
                className="flex-1 border-gray-300"
                aria-label={`Message ${displayName || 'user'}`}
              >
                <span className="flex items-center">
                  <MessageCircle className="w-4 h-4 mr-1.5" />
                  Message
                </span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Public stats placeholder (out of scope per routing) */}
        <Card className="bg-white border-gray-200 shadow-sm mt-4">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-gray-500">Public stats coming soon</p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
