'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useSocialStore, useWorkoutStore } from '@/lib/store';
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
      case 'workout_complete': return <Dumbbell className="w-4 h-4 text-emerald-400" />;
      case 'pb_achieved': return <Trophy className="w-4 h-4 text-amber-400" />;
      case 'medal_earned': return <Medal className="w-4 h-4 text-purple-400" />;
      case 'milestone': return <Sparkles className="w-4 h-4 text-blue-400" />;
      default: return null;
    }
  };

  const getPostBadge = (type: FeedPost['type']) => {
    switch (type) {
      case 'workout_complete': return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
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

  // Show all posts (social feed)
  const feedPosts = posts;

  return (
    <MainLayout>
      <PageHeader 
        title="Feed" 
        subtitle="See what your friends are up to"
        action={
          <Dialog open={showCreatePost} onOpenChange={setShowCreatePost}>
            <DialogTrigger asChild>
              <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600">
                Post
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-900 border-gray-800">
              <DialogHeader>
                <DialogTitle className="text-white">Create Post</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Textarea
                  placeholder="Share your fitness journey..."
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white min-h-[120px]"
                />
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" className="text-gray-400">
                    <ImageIcon className="w-5 h-5 mr-2" />
                    Add Photo
                  </Button>
                  <Button 
                    onClick={handleCreatePost}
                    disabled={!newPostContent.trim()}
                    className="bg-emerald-500 hover:bg-emerald-600"
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
        <div className="px-4 py-6 space-y-4">
          {feedPosts.length === 0 ? (
            <Card className="bg-gray-900 border-gray-800">
              <CardContent className="py-16 text-center">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-gray-600" />
                </div>
                <h3 className="font-semibold text-gray-400 mb-2">Your feed is empty</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Click below to load sample posts and users
                </p>
                <Button 
                  className="bg-emerald-500 hover:bg-emerald-600"
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
              isOwnProfile={selectedUser.id === user?.id}
              isFriend={user?.following?.includes(selectedUser.id)}
              onFollow={() => {
                if (user?.following?.includes(selectedUser.id)) {
                  unfollowUser(selectedUser.id);
                } else {
                  followUser(selectedUser.id);
                }
              }}
            />
          )}
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
    <Card className="bg-gray-900 border-gray-800 overflow-hidden">
      <CardContent className="p-4">
        {/* Post Header */}
        <div className="flex items-start gap-3 mb-3">
          <button onClick={onAvatarClick} className="group">
            <Avatar className="w-10 h-10 ring-2 ring-transparent group-hover:ring-emerald-500 transition-all">
              <AvatarImage src={post.user?.profilePhoto} />
              <AvatarFallback className="bg-gray-800 text-white">
                {post.user?.displayName?.[0] || post.user?.username?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-white truncate">
                {post.user?.displayName || post.user?.username}
              </p>
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
        <p className="text-gray-200 mb-4 whitespace-pre-wrap">{post.content}</p>

        {/* Post Media */}
        {post.mediaUrls && post.mediaUrls.length > 0 && (
          <div className="rounded-xl overflow-hidden mb-4 bg-gray-800">
            <img 
              src={post.mediaUrls[0]} 
              alt="Post media" 
              className="w-full object-cover max-h-80"
            />
          </div>
        )}

        {/* Post Actions */}
        <div className="flex items-center gap-6 pt-2 border-t border-gray-800">
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
          <button className="flex items-center gap-2 text-gray-400 hover:text-emerald-400 transition-colors">
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="mt-4 pt-4 border-t border-gray-800 space-y-3">
            {post.comments.map((comment) => (
              <div key={comment.id} className="flex gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-gray-800 text-white text-xs">
                    {comment.user?.displayName?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 bg-gray-800 rounded-xl px-3 py-2">
                  <p className="text-sm font-medium text-white">
                    {comment.user?.displayName || comment.user?.username}
                  </p>
                  <p className="text-sm text-gray-300">{comment.content}</p>
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
                className="flex-1 bg-gray-800 border border-gray-700 rounded-full px-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-emerald-500"
              />
              <Button
                size="icon"
                onClick={handleSubmitComment}
                disabled={!commentText.trim()}
                className="bg-emerald-500 hover:bg-emerald-600 rounded-full"
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
