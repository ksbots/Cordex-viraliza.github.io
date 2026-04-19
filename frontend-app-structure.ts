/**
 * ═══════════════════════════════════════════════════════════════════════════
 * FRONTEND — Next.js 16 App Router + TypeScript
 * Estrutura completa: pages, components, hooks, integrations
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── frontend/next.config.ts ──────────────────────────────────────────────────
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,                    // Partial Pre-rendering
    reactCompiler: true,          // React Compiler (auto-memoization)
    serverActions: { bodySizeLimit: '4mb' },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'acelera.digital' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' }, // Google avatars
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' }, // GitHub avatars
      { protocol: 'https', hostname: 'i.ytimg.com' }, // YouTube thumbnails
    ],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  compress: true,
  poweredByHeader: false,
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains; preload',
        },
      ],
    },
  ],
  redirects: async () => [
    { source: '/login', destination: '/auth/login', permanent: true },
  ],
};

export default nextConfig;


// ── frontend/src/app/layout.tsx ──────────────────────────────────────────────
import type { Metadata, Viewport } from 'next';
import { Syne, DM_Sans } from 'next/font/google';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { AuthProvider } from '@/components/providers/auth-provider';
import { Toaster } from '@/components/ui/sonner';
import { Analytics } from '@/components/analytics';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Acelera Digital Pro', template: '%s — Acelera Digital Pro' },
  description: 'A plataforma completa para criadores digitais crescerem no Instagram, TikTok e YouTube.',
  keywords: ['crescimento digital', 'instagram', 'tiktok', 'youtube', 'reels', 'algoritmo'],
  authors: [{ name: 'Acelera Digital', url: 'https://acelera.digital' }],
  creator: 'Acelera Digital',
  publisher: 'Acelera Digital',
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    url: 'https://acelera.digital',
    siteName: 'Acelera Digital Pro',
    title: 'Acelera Digital Pro — Cresça nas redes sociais',
    description: 'Método validado por +12.000 alunos. Resultados em até 30 dias.',
    images: [{ url: '/og-image.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Acelera Digital Pro',
    description: 'Cresça nas redes sociais com o método Crescimento Relâmpago.',
    images: ['/og-image.png'],
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#050508' },
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${syne.variable} ${dmSans.variable}`}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AuthProvider>
            {children}
            <Toaster position="bottom-right" richColors />
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}


// ── frontend/src/app/(platform)/dashboard/page.tsx ──────────────────────────
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/server';
import { DashboardHeader } from '@/components/dashboard/header';
import { StatsGrid } from '@/components/dashboard/stats-grid';
import { ContentFeed } from '@/components/dashboard/content-feed';
import { GrowthChart } from '@/components/dashboard/growth-chart';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { SkeletonDashboard } from '@/components/skeletons/dashboard';

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session) redirect('/auth/login?next=/dashboard');

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader user={session.user} />
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <Suspense fallback={<SkeletonDashboard />}>
          <StatsGrid userId={session.user.id} />
        </Suspense>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2 space-y-6">
            <Suspense fallback={<div className="h-64 skeleton rounded-xl" />}>
              <GrowthChart userId={session.user.id} />
            </Suspense>
            <Suspense fallback={<div className="h-96 skeleton rounded-xl" />}>
              <ContentFeed userId={session.user.id} />
            </Suspense>
          </div>
          <div>
            <Suspense fallback={<div className="h-96 skeleton rounded-xl" />}>
              <RecentActivity userId={session.user.id} />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}


// ── frontend/src/components/feed/video-feed.tsx ─────────────────────────────
'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import Image from 'next/image';
import { Heart, MessageCircle, Share2, Bookmark, MoreVertical } from 'lucide-react';
import { useFeedStore } from '@/stores/feed.store';
import type { Post } from '@/types';

interface VideoCardProps {
  post: Post;
  isActive: boolean;
  onLike: (id: string) => void;
  onComment: (id: string) => void;
}

function VideoCard({ post, isActive, onLike, onComment }: VideoCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(post.isLiked);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const y = useMotionValue(0);

  useEffect(() => {
    if (isActive) videoRef.current?.play().catch(() => {});
    else videoRef.current?.pause();
  }, [isActive]);

  const handleDoubleTap = useCallback(() => {
    if (!liked) {
      setLiked(true);
      setLikeCount(c => c + 1);
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 1000);
      onLike(post.id);
      // Haptic feedback (where supported)
      navigator.vibrate?.(50);
    }
  }, [liked, post.id, onLike]);

  const handleLikePress = useCallback(() => {
    setLiked(l => !l);
    setLikeCount(c => liked ? c - 1 : c + 1);
    if (!liked) onLike(post.id);
    navigator.vibrate?.(30);
  }, [liked, post.id, onLike]);

  return (
    <motion.div
      className="relative h-screen w-full overflow-hidden bg-black"
      style={{ y }}
      onDoubleClick={handleDoubleTap}
    >
      {/* Video / Image */}
      {post.videoUrl ? (
        <video
          ref={videoRef}
          src={post.videoUrl}
          className="absolute inset-0 w-full h-full object-cover"
          loop
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        <Image
          src={post.imageUrl || '/placeholder.jpg'}
          alt={post.caption}
          fill
          className="object-cover"
          sizes="100vw"
          priority={isActive}
        />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

      {/* Heart burst animation on double-tap */}
      <AnimatePresence>
        {showHeartBurst && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1.2 }}
            exit={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 0.4 }}
          >
            <Heart className="w-24 h-24 fill-white text-white drop-shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Author info */}
      <div className="absolute bottom-20 left-4 right-16 text-white">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative w-10 h-10 rounded-full border-2 border-white overflow-hidden">
            <Image src={post.author.avatar} alt={post.author.name} fill className="object-cover" sizes="40px" />
          </div>
          <div>
            <p className="font-semibold text-sm">{post.author.name}</p>
            <p className="text-xs text-white/70">@{post.author.username}</p>
          </div>
          <motion.button
            className="ml-2 px-3 py-1 border border-white rounded-full text-xs font-semibold"
            whileTap={{ scale: 0.95 }}
          >
            Seguir
          </motion.button>
        </div>
        <p className="text-sm leading-relaxed line-clamp-2">{post.caption}</p>
        {post.tags && (
          <div className="flex gap-1 mt-2 flex-wrap">
            {post.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-xs text-blue-300">#{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons (Instagram-style vertical) */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
        <motion.button
          className="flex flex-col items-center gap-1"
          whileTap={{ scale: 0.85 }}
          onClick={handleLikePress}
        >
          <Heart
            className={`w-7 h-7 transition-colors ${liked ? 'fill-red-500 text-red-500' : 'text-white'}`}
          />
          <span className="text-white text-xs font-medium">{formatCount(likeCount)}</span>
        </motion.button>

        <motion.button
          className="flex flex-col items-center gap-1"
          whileTap={{ scale: 0.85 }}
          onClick={() => onComment(post.id)}
        >
          <MessageCircle className="w-7 h-7 text-white" />
          <span className="text-white text-xs font-medium">{formatCount(post.comments)}</span>
        </motion.button>

        <motion.button className="flex flex-col items-center gap-1" whileTap={{ scale: 0.85 }}>
          <Bookmark className="w-7 h-7 text-white" />
          <span className="text-white text-xs font-medium">Salvar</span>
        </motion.button>

        <motion.button className="flex flex-col items-center gap-1" whileTap={{ scale: 0.85 }}>
          <Share2 className="w-7 h-7 text-white" />
          <span className="text-white text-xs font-medium">Compartilhar</span>
        </motion.button>
      </div>
    </motion.div>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function VideoFeed({ posts }: { posts: Post[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { likePost } = useFeedStore();

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, clientHeight } = containerRef.current;
    const newIndex = Math.round(scrollTop / clientHeight);
    setActiveIndex(newIndex);
  }, []);

  return (
    <div
      ref={containerRef}
      className="h-screen overflow-y-scroll snap-y snap-mandatory scroll-smooth"
      onScroll={handleScroll}
      style={{ scrollbarWidth: 'none' }}
    >
      {posts.map((post, i) => (
        <div key={post.id} className="h-screen snap-start snap-always">
          <VideoCard
            post={post}
            isActive={i === activeIndex}
            onLike={likePost}
            onComment={(id) => console.log('comment', id)}
          />
        </div>
      ))}
    </div>
  );
}


// ── frontend/src/lib/social/youtube.ts ─────────────────────────────────────
export class YouTubeService {
  private readonly baseUrl = 'https://www.googleapis.com/youtube/v3';
  private readonly apiKey: string;

  constructor(apiKey: string) { this.apiKey = apiKey; }

  async searchVideos(query: string, maxResults = 20) {
    const params = new URLSearchParams({
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: String(maxResults),
      relevanceLanguage: 'pt',
      regionCode: 'BR',
      key: this.apiKey,
    });
    const res = await fetch(`${this.baseUrl}/search?${params}`, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
    return res.json();
  }

  async getVideoDetails(videoId: string) {
    const params = new URLSearchParams({
      part: 'snippet,statistics,contentDetails',
      id: videoId,
      key: this.apiKey,
    });
    const res = await fetch(`${this.baseUrl}/videos?${params}`, { next: { revalidate: 600 } });
    return res.json();
  }

  async getChannelDetails(channelId: string) {
    const params = new URLSearchParams({
      part: 'snippet,statistics,brandingSettings',
      id: channelId,
      key: this.apiKey,
    });
    const res = await fetch(`${this.baseUrl}/channels?${params}`, { next: { revalidate: 3600 } });
    return res.json();
  }

  async getUserPlaylists(channelId: string) {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails',
      channelId,
      maxResults: '50',
      key: this.apiKey,
    });
    const res = await fetch(`${this.baseUrl}/playlists?${params}`, { next: { revalidate: 600 } });
    return res.json();
  }
}


// ── frontend/src/lib/social/tiktok-oembed.ts ───────────────────────────────
export async function getTikTokOEmbed(videoUrl: string) {
  const params = new URLSearchParams({ url: videoUrl, format: 'json' });
  const res = await fetch(
    `https://www.tiktok.com/oembed?${params}`,
    { next: { revalidate: 3600 } },
  );
  if (!res.ok) throw new Error(`TikTok oEmbed error: ${res.status}`);
  return res.json() as Promise<{
    title: string;
    author_name: string;
    author_url: string;
    html: string;
    thumbnail_url: string;
    width: number;
    height: number;
  }>;
}

// Server Action for TikTok embed
export async function embedTikTokVideo(url: string) {
  'use server';
  try {
    const data = await getTikTokOEmbed(url);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: 'Could not embed video' };
  }
}


// ── frontend/src/lib/auth/webauthn.ts ───────────────────────────────────────
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';

export async function registerPasskey(userId: string, accessToken: string) {
  if (!browserSupportsWebAuthn()) {
    throw new Error('Seu navegador não suporta Passkeys. Tente Chrome, Safari ou Firefox atualizado.');
  }

  // Get registration options from our API
  const optionsRes = await fetch('/api/v1/auth/webauthn/register/options', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  const options = await optionsRes.json();

  // Prompt user for biometric/PIN
  const registration = await startRegistration(options);

  // Verify with our server
  const verifyRes = await fetch('/api/v1/auth/webauthn/register/verify', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(registration),
  });

  if (!verifyRes.ok) throw new Error('Passkey registration failed');
  return verifyRes.json();
}

export async function authenticateWithPasskey(email: string) {
  if (!browserSupportsWebAuthn()) {
    throw new Error('Passkeys not supported');
  }

  const optionsRes = await fetch('/api/v1/auth/webauthn/auth/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const options = await optionsRes.json();
  const authentication = await startAuthentication(options);

  const verifyRes = await fetch('/api/v1/auth/webauthn/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...authentication, email }),
    credentials: 'include', // for refresh token cookie
  });

  if (!verifyRes.ok) throw new Error('Passkey authentication failed');
  return verifyRes.json();
}
