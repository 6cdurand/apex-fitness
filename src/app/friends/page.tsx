'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useSocialStore, useTrainerStore, useWorkoutStore, useMedalStore } from '@/lib/store';
import { fetchAllUsersFromSupabase } from '@/lib/supabaseSync';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, UserMinus, Users, BadgeCheck, MessageCircle, Calendar, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ProfileCard } from '@/components/ProfileCard';

export default function FriendsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { followUser, unfollowUser } = useSocialStore();
  const { createBookingRequest } = useTrainerStore();
  const { workoutHistory, personalBests } = useWorkoutStore();
  const { medals } = useMedalStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  // Consultation booking state
  const [showBookConsultation, setShowBookConsultation] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState<any>(null);
  const [consultationDate, setConsultationDate] = useState('');
  const [consultationTime, setConsultationTime] = useState('09:00');
  const [consultationNotes, setConsultationNotes] = useState('');
  const [isBooking, setIsBooking] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const loadAllUsers = async () => {
      const stored = JSON.parse(localStorage.getItem('apex-users') || '[]');
      setAllUsers(stored.filter((u: any) => u.id !== user?.id));
      
      // Also fetch from Supabase for cross-device sync
      try {
        const supabaseUsers = await fetchAllUsersFromSupabase();
        if (supabaseUsers && supabaseUsers.length > 0) {
          // Merge: Supabase is source of truth, add local-only users
          const supabaseIds = new Set(supabaseUsers.map((u: any) => u.id));
          const localOnlyUsers = stored.filter((u: any) => !supabaseIds.has(u.id));
          const mergedUsers = [...supabaseUsers, ...localOnlyUsers].filter((u: any) => u.id !== user?.id);
          setAllUsers(mergedUsers);
        }
      } catch (e) {
        console.error('[Friends] Error loading users from Supabase:', e);
      }
    };
    loadAllUsers();
  }, [user?.id]);

  const handleFollow = (userId: string, username: string) => {
    followUser(userId);
    toast.success(`Now following ${username}`);
  };

  const handleUnfollow = (userId: string, username: string) => {
    unfollowUser(userId);
    toast.success(`Unfollowed ${username}`);
  };

  const handleBookConsultation = (trainer: any) => {
    setSelectedTrainer(trainer);
    setConsultationDate('');
    setConsultationTime('09:00');
    setConsultationNotes('');
    setShowBookConsultation(true);
  };

  const handleSubmitConsultation = async () => {
    if (!selectedTrainer || !consultationDate || !user?.id) return;
    
    setIsBooking(true);
    try {
      // Calculate end time (30 min consultation)
      const [hours, mins] = consultationTime.split(':').map(Number);
      const endMins = hours * 60 + mins + 30;
      const endHours = Math.floor(endMins / 60);
      const endMinutes = endMins % 60;
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
      
      createBookingRequest({
        trainerId: selectedTrainer.id,
        clientId: user.id,
        date: consultationDate,
        startTime: consultationTime,
        endTime,
        type: 'consultation',
        requestedBy: 'client',
        notes: consultationNotes || undefined,
      });
      
      toast.success(`Consultation request sent to ${selectedTrainer.displayName || selectedTrainer.username}!`);
      setShowBookConsultation(false);
      setSelectedTrainer(null);
    } catch (error) {
      toast.error('Failed to book consultation');
    } finally {
      setIsBooking(false);
    }
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
              <TabsTrigger value="following" className="data-[state=active]:bg-sky-500 text-xs">
                Following
              </TabsTrigger>
              <TabsTrigger value="followers" className="data-[state=active]:bg-sky-500 text-xs">
                Followers
              </TabsTrigger>
              <TabsTrigger value="trainers" className="data-[state=active]:bg-rose-500 text-xs">
                Trainers
              </TabsTrigger>
              <TabsTrigger value="discover" className="data-[state=active]:bg-sky-500 text-xs">
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
                        <p className="text-sm text-gray-500 mt-1">Personal trainers will appear here</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500 mb-2">{trainers.length} trainer{trainers.length !== 1 ? 's' : ''} available</p>
                      {trainers.map((u) => (
                        <TrainerCard
                          key={u.id}
                          userData={u}
                          isFollowing={user.following.includes(u.id)}
                          onFollow={() => handleFollow(u.id, u.username)}
                          onUnfollow={() => handleUnfollow(u.id, u.username)}
                          onAvatarClick={() => setSelectedUser(u)}
                          onBookConsultation={() => handleBookConsultation(u)}
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
          {selectedUser && (() => {
            const userWorkouts = workoutHistory.filter(w => w.userId === selectedUser.id && w.status === 'completed');
            const userPBs = personalBests.filter(pb => pb.userId === selectedUser.id);
            const userMedals = medals.filter(m => m.userId === selectedUser.id && m.earned);
            return (
              <ProfileCard
                user={selectedUser}
                medals={userMedals}
                strengthRating={null}
                personalBests={userPBs}
                context="friends"
                stats={{
                  totalWorkouts: userWorkouts.length,
                  totalVolume: userWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0),
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
                onMessage={() => {
                  setSelectedUser(null);
                  router.push('/messages');
                }}
                onViewProfile={() => {
                  setSelectedUser(null);
                  router.push(`/profile/${selectedUser.id}`);
                }}
                onShare={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  toast.success('Profile link copied!');
                }}
              />
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Book Consultation Dialog */}
      <Dialog open={showBookConsultation} onOpenChange={setShowBookConsultation}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-md">
          <div className="space-y-4">
            <div className="text-center">
              <Avatar className="w-16 h-16 mx-auto mb-3">
                <AvatarImage src={selectedTrainer?.profilePhoto} />
                <AvatarFallback className="bg-rose-500 text-white text-xl">
                  {selectedTrainer?.displayName?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-xl font-bold text-white">Book Consultation</h2>
              <p className="text-gray-400">with {selectedTrainer?.displayName || selectedTrainer?.username}</p>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">Preferred Date</label>
              <Input
                type="date"
                value={consultationDate}
                onChange={(e) => setConsultationDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">Preferred Time</label>
              <select
                value={consultationTime}
                onChange={(e) => setConsultationTime(e.target.value)}
                className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white"
              >
                {['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'].map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">Notes (optional)</label>
              <textarea
                value={consultationNotes}
                onChange={(e) => setConsultationNotes(e.target.value)}
                placeholder="Tell the trainer about your goals..."
                className="w-full h-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 text-sm resize-none"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-gray-700"
                onClick={() => setShowBookConsultation(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-rose-500 hover:bg-rose-600"
                onClick={handleSubmitConsultation}
                disabled={!consultationDate || isBooking}
              >
                <Send className="w-4 h-4 mr-2" />
                {isBooking ? 'Sending...' : 'Request Consultation'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

function TrainerCard({
  userData,
  isFollowing,
  onFollow,
  onUnfollow,
  onAvatarClick,
  onBookConsultation,
}: {
  userData: any;
  isFollowing: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
  onAvatarClick?: () => void;
  onBookConsultation: () => void;
}) {
  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <button onClick={onAvatarClick} className="group relative">
            <Avatar className="w-12 h-12 ring-2 ring-transparent group-hover:ring-rose-500 transition-all">
              <AvatarImage src={userData.profilePhoto} />
              <AvatarFallback className="bg-rose-500 text-white">
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
              <Badge variant="outline" className="text-xs border-rose-500/50 text-rose-400">
                Trainer
              </Badge>
            </div>
            <p className="text-sm text-gray-500">@{userData.username}</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onBookConsultation}
              className="border-rose-500/50 text-rose-400 hover:bg-rose-500/10"
            >
              <Calendar className="w-4 h-4 mr-1" />
              Book
            </Button>
            <Button
              size="sm"
              variant={isFollowing ? "outline" : "default"}
              onClick={isFollowing ? onUnfollow : onFollow}
              className={isFollowing 
                ? "border-gray-700 text-gray-300" 
                : "bg-sky-500 hover:bg-sky-600"
              }
            >
              {isFollowing ? <UserMinus className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
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
            <Avatar className="w-12 h-12 ring-2 ring-transparent group-hover:ring-sky-500 transition-all">
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
              : "bg-sky-500 hover:bg-sky-600"
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
