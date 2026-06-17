'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useSocialStore } from '@/lib/store';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';
import { fetchAllUsersFromSupabase } from '@/lib/supabaseSync';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Users, 
  UserPlus, 
  UserMinus, 
  MapPin, 
  Plus,
  ChevronRight,
  Globe,
  Dumbbell
} from 'lucide-react';
import { toast } from 'sonner';

export default function CommunityPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { followUser, unfollowUser } = useSocialStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('discover');

  useRequireAuth();

  useEffect(() => {
    const isPlaceholder = (u: any) =>
      u.accountStatus === 'placeholder' ||
      u.email?.endsWith('@placeholder.local') ||
      u.email?.endsWith('@client.apex');

    const loadUsers = async () => {
      const stored = JSON.parse(localStorage.getItem('apex-users') || '[]');
      setAllUsers(stored.filter((u: any) => u.id !== user?.id && !isPlaceholder(u)));
      try {
        const supabaseUsers = await fetchAllUsersFromSupabase();
        if (supabaseUsers.length > 0) {
          const merged = [...stored.filter((u: any) => !isPlaceholder(u))];
          supabaseUsers.forEach((su: any) => {
            if (!merged.find((m: any) => m.id === su.id) && su.id !== user?.id) {
              merged.push(su);
            }
          });
          setAllUsers(merged.filter((u: any) => u.id !== user?.id && !isPlaceholder(u)));
        }
      } catch (e) {
        console.error('[Community] Error loading users:', e);
      }
    };
    if (user?.id) loadUsers();
  }, [user?.id]);

  if (!isAuthenticated || !user) return null;

  const following = user.following || [];
  const friends = allUsers.filter(u => following.includes(u.id));
  const suggestions = allUsers.filter(u => !following.includes(u.id));

  // People at your gym
  const gymPeople = user.gymName
    ? allUsers.filter(u => u.gymName && u.gymName.toLowerCase() === user.gymName!.toLowerCase() && !following.includes(u.id))
    : [];
  const filteredUsers = searchQuery
    ? allUsers.filter(u =>
        u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.username?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const handleFollow = (userId: string, name: string) => {
    followUser(userId);
    toast.success(`Following ${name}`);
  };

  const handleUnfollow = (userId: string, name: string) => {
    unfollowUser(userId);
    toast.success(`Unfollowed ${name}`);
  };

  return (
    <MainLayout>
      <PageHeader title="Community" subtitle="Connect with others" />

      <div className="px-4 py-4 space-y-5">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-50 border-gray-200 text-gray-900"
          />
        </div>

        {/* Search Results */}
        {searchQuery && (
          <div className="space-y-2">
            {filteredUsers.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-4">No users found</p>
            ) : (
              filteredUsers.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  isFollowing={following.includes(u.id)}
                  onFollow={() => handleFollow(u.id, u.displayName || u.username)}
                  onUnfollow={() => handleUnfollow(u.id, u.displayName || u.username)}
                  onClick={() => router.push(`/profile/${u.id}`)}
                />
              ))
            )}
          </div>
        )}

        {/* Main Content */}
        {!searchQuery && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-gray-100 border-gray-200 w-full">
              <TabsTrigger value="discover" className="flex-1 text-xs">Discover</TabsTrigger>
              <TabsTrigger value="following" className="flex-1 text-xs">Following ({friends.length})</TabsTrigger>
              <TabsTrigger value="groups" className="flex-1 text-xs">Groups</TabsTrigger>
            </TabsList>

            <TabsContent value="discover" className="mt-4">
              {/* People at Your Gym */}
              {user.gymName && gymPeople.length > 0 && (
                <section className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                    <Dumbbell className="w-4 h-4 text-sky-400" />
                    People at {user.gymName}
                  </h3>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {gymPeople.slice(0, 10).map((u) => (
                      <div key={u.id} className="flex-shrink-0 w-24 text-center">
                        <Avatar
                          className="w-16 h-16 mx-auto cursor-pointer hover:ring-2 hover:ring-sky-500 transition-all"
                          onClick={() => router.push(`/profile/${u.id}`)}
                        >
                          <AvatarImage src={u.profilePhoto} />
                          <AvatarFallback className="bg-gray-700 text-white text-lg">
                            {u.displayName?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <p className="text-xs text-white mt-2 font-medium truncate">{u.displayName || u.username}</p>
                        <p className="text-[10px] text-gray-500 truncate">{u.gymName}</p>
                        <Button
                          size="sm"
                          className="mt-1 h-7 text-xs bg-sky-500 hover:bg-sky-600 w-full"
                          onClick={() => handleFollow(u.id, u.displayName || u.username)}
                        >
                          Follow
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* People You May Know */}
              {suggestions.length > 0 && (
                <section className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-400 mb-3">People You May Know</h3>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {suggestions.slice(0, 10).map((u) => (
                      <div
                        key={u.id}
                        className="flex-shrink-0 w-24 text-center"
                      >
                        <Avatar
                          className="w-16 h-16 mx-auto cursor-pointer hover:ring-2 hover:ring-sky-500 transition-all"
                          onClick={() => router.push(`/profile/${u.id}`)}
                        >
                          <AvatarImage src={u.profilePhoto} />
                          <AvatarFallback className="bg-gray-700 text-white text-lg">
                            {u.displayName?.[0] || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <p className="text-xs text-white mt-2 font-medium truncate">{u.displayName || u.username}</p>
                        <Button
                          size="sm"
                          className="mt-1 h-7 text-xs bg-sky-500 hover:bg-sky-600 w-full"
                          onClick={() => handleFollow(u.id, u.displayName || u.username)}
                        >
                          Follow
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Browse by category placeholder */}
              <section>
                <h3 className="text-sm font-semibold text-gray-400 mb-3">Browse</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Card className="bg-white border-gray-200 shadow-sm cursor-pointer hover:border-sky-500/50 transition-colors"
                    onClick={() => router.push('/friends')}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center">
                        <Users className="w-5 h-5 text-sky-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">People</p>
                        <p className="text-xs text-gray-500">{allUsers.length} users</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white border-gray-200 shadow-sm cursor-pointer hover:border-purple-500/50 transition-colors"
                    onClick={() => router.push('/settings')}
                  >
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <MapPin className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm">Gyms</p>
                        <p className="text-xs text-gray-500">{user.gymName || 'Set your gym in Settings'}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </section>
            </TabsContent>

            <TabsContent value="following" className="mt-4">
              <ScrollArea className="h-[calc(100vh-320px)]">
                {friends.length === 0 ? (
                  <Card className="bg-white border-gray-200 shadow-sm">
                    <CardContent className="py-12 text-center">
                      <Users className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-400">Not following anyone yet</p>
                      <Button variant="link" className="text-sky-400 mt-2" onClick={() => setActiveTab('discover')}>
                        Discover people
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    {friends.map((u) => (
                      <UserRow
                        key={u.id}
                        user={u}
                        isFollowing={true}
                        onFollow={() => handleFollow(u.id, u.displayName || u.username)}
                        onUnfollow={() => handleUnfollow(u.id, u.displayName || u.username)}
                        onClick={() => router.push(`/profile/${u.id}`)}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="groups" className="mt-4">
              <Card className="bg-white border-gray-200 shadow-sm">
                <CardContent className="py-12 text-center">
                  <Globe className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                  <h3 className="font-semibold text-gray-400 mb-2">Groups Coming Soon</h3>
                  <p className="text-sm text-gray-500">Create and join fitness communities, events, and group challenges.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}

function UserRow({ user, isFollowing, onFollow, onUnfollow, onClick }: {
  user: any;
  isFollowing: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  onClick: () => void;
}) {
  return (
    <Card className="bg-white border-gray-200 shadow-sm">
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onClick}>
          <Avatar className="w-10 h-10">
            <AvatarImage src={user.profilePhoto} />
            <AvatarFallback className="bg-white text-gray-900">
              {user.displayName?.[0] || '?'}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-gray-900">{user.displayName}</h3>
            {user.username && <p className="text-xs text-gray-500">@{user.username}</p>}
          </div>
        </div>
        <Button
          size="sm"
          variant={isFollowing ? 'outline' : 'default'}
          className={isFollowing ? 'border-gray-200 text-gray-500 h-8' : 'bg-sky-500 hover:bg-sky-600 h-8'}
          onClick={(e) => { e.stopPropagation(); isFollowing ? onUnfollow() : onFollow(); }}
        >
          {isFollowing ? <UserMinus className="w-3 h-3 mr-1" /> : <UserPlus className="w-3 h-3 mr-1" />}
          {isFollowing ? 'Unfollow' : 'Follow'}
        </Button>
      </CardContent>
    </Card>
  );
}
