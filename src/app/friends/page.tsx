'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useSocialStore } from '@/lib/store';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, UserMinus, Users, BadgeCheck, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ProfileCard } from '@/components/ProfileCard';

export default function FriendsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { followUser, unfollowUser } = useSocialStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('apex-users') || '[]');
    setAllUsers(stored.filter((u: any) => u.id !== user?.id));
  }, [user?.id]);

  const handleFollow = (userId: string, username: string) => {
    followUser(userId);
    toast.success(`Now following ${username}`);
  };

  const handleUnfollow = (userId: string, username: string) => {
    unfollowUser(userId);
    toast.success(`Unfollowed ${username}`);
  };

  if (!isAuthenticated || !user) return null;

  const followers = allUsers.filter(u => u.following?.includes(user.id));
  const following = allUsers.filter(u => user.following.includes(u.id));
  const suggestions = allUsers.filter(u => !user.following.includes(u.id)).slice(0, 10);

  const filteredUsers = searchQuery
    ? allUsers.filter(u => 
        u.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    <MainLayout>
      <PageHeader title="Friends" subtitle="Connect with other fitness enthusiasts" />

      <div className="px-4 py-4">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700 text-white"
          />
        </div>

        {searchQuery ? (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Search Results</h3>
            {filteredUsers.length === 0 ? (
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="py-8 text-center">
                  <p className="text-gray-400">No users found</p>
                </CardContent>
              </Card>
            ) : (
              filteredUsers.map((u) => (
                <UserCard
                  key={u.id}
                  userData={u}
                  isFollowing={user.following.includes(u.id)}
                  onFollow={() => handleFollow(u.id, u.username)}
                  onUnfollow={() => handleUnfollow(u.id, u.username)}
                  onAvatarClick={() => setSelectedUser(u)}
                />
              ))
            )}
          </div>
        ) : (
          <Tabs defaultValue="following" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-gray-800 mb-4">
              <TabsTrigger value="following" className="data-[state=active]:bg-emerald-500 text-xs">
                Following
              </TabsTrigger>
              <TabsTrigger value="followers" className="data-[state=active]:bg-emerald-500 text-xs">
                Followers
              </TabsTrigger>
              <TabsTrigger value="trainers" className="data-[state=active]:bg-rose-500 text-xs">
                Trainers
              </TabsTrigger>
              <TabsTrigger value="discover" className="data-[state=active]:bg-emerald-500 text-xs">
                Discover
              </TabsTrigger>
            </TabsList>

            <TabsContent value="following">
              <ScrollArea className="h-[calc(100vh-320px)]">
                {following.length === 0 ? (
                  <Card className="bg-gray-900 border-gray-800">
                    <CardContent className="py-12 text-center">
                      <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400 mb-1">Not following anyone yet</p>
                      <p className="text-sm text-gray-500">Find friends to connect with</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {following.map((u) => (
                      <UserCard
                        key={u.id}
                        userData={u}
                        isFollowing={true}
                        onFollow={() => handleFollow(u.id, u.username)}
                        onUnfollow={() => handleUnfollow(u.id, u.username)}
                        onAvatarClick={() => setSelectedUser(u)}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="followers">
              <ScrollArea className="h-[calc(100vh-320px)]">
                {followers.length === 0 ? (
                  <Card className="bg-gray-900 border-gray-800">
                    <CardContent className="py-12 text-center">
                      <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400 mb-1">No followers yet</p>
                      <p className="text-sm text-gray-500">Share your profile to get followers</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {followers.map((u) => (
                      <UserCard
                        key={u.id}
                        userData={u}
                        isFollowing={user.following.includes(u.id)}
                        onFollow={() => handleFollow(u.id, u.username)}
                        onUnfollow={() => handleUnfollow(u.id, u.username)}
                        onAvatarClick={() => setSelectedUser(u)}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="trainers">
              <ScrollArea className="h-[calc(100vh-320px)]">
                {(() => {
                  const trainers = allUsers.filter(u => u.isTrainer);
                  return trainers.length === 0 ? (
                    <Card className="bg-gray-900 border-gray-800">
                      <CardContent className="py-12 text-center">
                        <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400">No trainers found</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500 mb-2">{trainers.length} trainers in your area</p>
                      {trainers.map((u) => (
                        <UserCard
                          key={u.id}
                          userData={u}
                          isFollowing={user.following.includes(u.id)}
                          onFollow={() => handleFollow(u.id, u.username)}
                          onUnfollow={() => handleUnfollow(u.id, u.username)}
                          onAvatarClick={() => setSelectedUser(u)}
                        />
                      ))}
                    </div>
                  );
                })()}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="discover">
              <ScrollArea className="h-[calc(100vh-320px)]">
                {suggestions.length === 0 ? (
                  <Card className="bg-gray-900 border-gray-800">
                    <CardContent className="py-12 text-center">
                      <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-400">No suggestions available</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {suggestions.map((u) => (
                      <UserCard
                        key={u.id}
                        userData={u}
                        isFollowing={false}
                        onFollow={() => handleFollow(u.id, u.username)}
                        onUnfollow={() => handleUnfollow(u.id, u.username)}
                        onAvatarClick={() => setSelectedUser(u)}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Profile Card Popup */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="bg-transparent border-none shadow-none max-w-md p-0">
          {selectedUser && (
            <ProfileCard
              user={selectedUser}
              medals={[]}
              strengthRating={null}
              personalBests={[]}
              stats={{
                totalWorkouts: Math.floor(Math.random() * 50) + 10,
                totalVolume: Math.floor(Math.random() * 500000) + 100000,
                followers: selectedUser.followers?.length || 0,
                following: selectedUser.following?.length || 0,
              }}
              isOwnProfile={false}
              isFriend={user?.following?.includes(selectedUser.id)}
              onFollow={() => {
                if (user?.following?.includes(selectedUser.id)) {
                  unfollowUser(selectedUser.id);
                } else {
                  followUser(selectedUser.id);
                }
              }}
              onShare={() => {
                navigator.clipboard?.writeText(window.location.href);
                toast.success('Profile link copied!');
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

function UserCard({
  userData,
  isFollowing,
  onFollow,
  onUnfollow,
  onAvatarClick,
}: {
  userData: any;
  isFollowing: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  onAvatarClick?: () => void;
}) {
  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <button onClick={onAvatarClick} className="group relative">
            <Avatar className="w-12 h-12 ring-2 ring-transparent group-hover:ring-emerald-500 transition-all">
              <AvatarImage src={userData.profilePhoto} />
              <AvatarFallback className="bg-gray-800 text-white">
                {userData.displayName?.[0] || userData.username?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-white truncate">
                {userData.displayName || userData.username}
              </p>
              {userData.isVerifiedTrainer && (
                <BadgeCheck className="w-4 h-4 text-blue-400 flex-shrink-0" />
              )}
              {userData.isTrainer && (
                <Badge variant="outline" className="text-xs border-rose-500/50 text-rose-400">
                  Trainer
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500">@{userData.username}</p>
          </div>
          <Button
            size="sm"
            variant={isFollowing ? "outline" : "default"}
            onClick={isFollowing ? onUnfollow : onFollow}
            className={isFollowing 
              ? "border-gray-700 text-gray-300" 
              : "bg-emerald-500 hover:bg-emerald-600"
            }
          >
            {isFollowing ? (
              <>
                <UserMinus className="w-4 h-4 mr-1" />
                Unfollow
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-1" />
                Follow
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
