'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useSocialStore, useWorkoutStore, useMedalStore, useTrainerStore } from '@/lib/store';
import Link from 'next/link';
import { MainLayout, PageHeader } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  MoreHorizontal,
  Image as ImageIcon,
  Send,
  Trophy,
  Dumbbell,
  Medal,
  Sparkles,
  BadgeCheck
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { FeedPost } from '@/types';
import { resetSeedData } from '@/lib/seedData';
import { ProfileCard } from '@/components/ProfileCard';

export default function FeedPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { posts, likePost, unlikePost, commentOnPost, createPost, followUser, unfollowUser } = useSocialStore();
  const { workoutHistory, personalBests } = useWorkoutStore();
  const { medals } = useMedalStore();
  const { clients } = useTrainerStore();
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
    }
  }, [isAuthenticated, router]);

  const handleCreatePost = () => {
    if (newPostContent.trim()) {
      createPost('general', newPostContent.trim());
      setNewPostContent('');
      setShowCreatePost(false);
    }
  };

  const handleLike = (postId: string, isLiked: boolean) => {
    if (isLiked) {
      unlikePost(postId);
    } else {
      likePost(postId);
    }
  };

  if (!isAuthenticated) return null;

  const getPostIcon = (type: FeedPost['type']) => {
    switch (type) {
      case 'workout_complete': return <Dumbbell className="w-4 h-4 text-sky-400" />;
      case 'pb_achieved': return <Trophy className="w-4 h-4 text-amber-400" />;
      case 'medal_earned': return <Medal className="w-4 h-4 text-purple-400" />;
      case 'milestone': return <Sparkles className="w-4 h-4 text-blue-400" />;
      default: return null;
    }
  };

  const getPostBadge = (type: FeedPost['type']) => {
    switch (type) {
      case 'workout_complete': return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 text-xs">
          <Dumbbell className="w-3 h-3" /> Workout
        </span>
      );
      case 'pb_achieved': return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">
          <Trophy className="w-3 h-3" /> New PB
        </span>
      );
      case 'medal_earned': return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs">
          <Medal className="w-3 h-3" /> Achievement
        </span>
      );
      default: return null;
    }
  };

  // Mode-based feed filtering
  // Trainer mode: show own posts + client posts only
  // User mode: show own posts + following/friends posts
  const isTrainerMode = user?.mode === 'trainer';
  const clientIds = clients.map(c => c.clientId);
  const followingIds = user?.following || [];

  const feedPosts = posts.filter(post => {
    const postUserId = post.userId || post.user?.id;
    if (!postUserId) return true; // Show system posts
    if (postUserId === user?.id) return true; // Always show own posts
    if (isTrainerMode) {
      return clientIds.includes(postUserId);
    } else {
      return followingIds.includes(postUserId);
    }
  });

  return (
    <MainLayout>
      <PageHeader 
        title="Feed" 
        subtitle={isTrainerMode ? "Your clients' activity" : "See what your friends are up to"}
        action={
          <Dialog open={showCreatePost} onOpenChange={setShowCreatePost}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-sky-500 hover:bg-sky-600">
                Post
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-white border-gray-200">
              <DialogHeader>
                <DialogTitle className="text-gray-900">Create Post</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Textarea
                  placeholder="Share your fitness journey..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  className="bg-gray-50 border-gray-200 text-gray-900 min-h-[120px]"
                />
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" className="text-gray-400">
                    <ImageIcon className="w-5 h-5 mr-2" />
                    Add Photo
                  </Button>
                  <Button 
                    onClick={handleCreatePost}
                    disabled={!newPostContent.trim()}
                    className="bg-sky-500 hover:bg-sky-600"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Post
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <ScrollArea className="flex-1">
        <div className="px-5 py-6 space-y-4">
          {feedPosts.length === 0 ? (
            <Card className="bg-gray-50 border-gray-200">
              <CardContent className="py-16 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="font-semibold text-gray-700 mb-2">Your feed is empty</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Click below to load sample posts and users
                </p>
                <Button 
                  onClick={() => {
                    resetSeedData();
                    window.location.href = '/';
                  }}
                >
                  Load Sample Data
                </Button>
              </CardContent>
            </Card>
          ) : (
            feedPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={user?.id || ''}
                onLike={() => handleLike(post.id, post.likes.includes(user?.id || ''))}
                onComment={(content) => commentOnPost(post.id, content)}
                getPostBadge={getPostBadge}
                onAvatarClick={() => post.user && setSelectedUser(post.user)}
              />
            ))
          )}
        </div>
      </ScrollArea>

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
                context="feed"
                stats={{
                  totalWorkouts: userWorkouts.length,
                  totalVolume: userWorkouts.reduce((sum, w) => sum + (w.totalVolume || 0), 0),
                  followers: selectedUser.followers?.length || 0,
                  following: selectedUser.following?.length || 0,
                }}
                isOwnProfile={selectedUser.id === user?.id}
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
              />
            );
          })()}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

function PostCard({
  post,
  currentUserId,
  onLike,
  onComment,
  getPostBadge,
  onAvatarClick,
}: {
  post: FeedPost;
  currentUserId: string;
  onLike: () => void;
  onComment: (content: string) => void;
  getPostBadge: (type: FeedPost['type']) => React.ReactNode;
  onAvatarClick?: () => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');

  const isLiked = post.likes.includes(currentUserId);

  const handleSubmitComment = () => {
    if (commentText.trim()) {
      onComment(commentText.trim());
      setCommentText('');
    }
  };

  return (
    <Card className="bg-white border-gray-200 overflow-hidden shadow-sm">
      <CardContent className="p-4">
        {/* Post Header */}
        <div className="flex items-start gap-3 mb-3">
          <button onClick={(e) => { e.stopPropagation(); onAvatarClick?.(); }} className="group">
            <Avatar className="w-11 h-11 ring-2 ring-gray-200 group-hover:ring-sky-500 transition-all duration-200">
              <AvatarImage src={post.user?.profilePhoto} />
              <AvatarFallback className="bg-gray-100 text-gray-700 font-semibold">
                {post.user?.displayName?.[0] || post.user?.username?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onAvatarClick?.(); }}
                className="font-semibold text-gray-900 truncate hover:text-sky-500 hover:underline transition-colors text-left"
              >
                {post.user?.displayName || post.user?.username}
              </button>
              {post.user?.isVerifiedTrainer && (
                <BadgeCheck className="w-4 h-4 text-blue-400 flex-shrink-0" />
              )}
              {getPostBadge(post.type)}
            </div>
            <p className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="text-gray-500 -mr-2">
            <MoreHorizontal className="w-5 h-5" />
          </Button>
        </div>

        {/* Post Content */}
        <p className="text-gray-700 mb-4 whitespace-pre-wrap">{post.content}</p>

        {/* Post Media */}
        {post.mediaUrls && post.mediaUrls.length > 0 && (
          <div className="rounded-xl overflow-hidden mb-4 bg-gray-100">
            <img 
              src={post.mediaUrls[0]} 
              alt="Post media" 
              className="w-full object-cover max-h-80"
            />
          </div>
        )}

        {/* Post Actions */}
        <div className="flex items-center gap-6 pt-2 border-t border-gray-100">
          <button
            onClick={onLike}
            className="flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors"
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
            <span className="text-sm">{post.likes.length || ''}</span>
          </button>
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-2 text-gray-400 hover:text-blue-400 transition-colors"
          >
            <MessageCircle className="w-5 h-5" />
            <span className="text-sm">{post.comments.length || ''}</span>
          </button>
          <button className="flex items-center gap-2 text-gray-400 hover:text-sky-400 transition-colors">
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
            {post.comments.map((comment) => (
              <div key={comment.id} className="flex gap-2">
                <Link href={comment.user?.id ? `/profile/${comment.user.id}` : '#'}>
                  <Avatar className="w-8 h-8 hover:ring-2 hover:ring-sky-500/50 transition-all cursor-pointer">
                    <AvatarFallback className="bg-gray-100 text-gray-700 text-xs">
                      {comment.user?.displayName?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2">
                  <Link
                    href={comment.user?.id ? `/profile/${comment.user.id}` : '#'}
                    className="text-sm font-medium text-gray-900 hover:text-sky-500 hover:underline transition-colors"
                  >
                    {comment.user?.displayName || comment.user?.username}
                  </Link>
                  <p className="text-sm text-gray-600">{comment.content}</p>
                </div>
              </div>
            ))}

            {/* Comment Input */}
            <div className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSubmitComment()}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-sky-500"
              />
              <Button
                size="icon"
                onClick={handleSubmitComment}
                disabled={!commentText.trim()}
                className="bg-sky-500 hover:bg-sky-600 rounded-full"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
