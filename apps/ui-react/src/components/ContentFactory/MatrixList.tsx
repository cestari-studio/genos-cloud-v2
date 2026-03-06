// genOS Lumina — Content Factory MatrixList (AI Full Table DataTable)
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  TableExpandedRow,
  TableExpandHeader,
  TableExpandRow,
  TableSelectAll,
  TableSelectRow,
  TableBatchActions,
  TableBatchAction,
  TableToolbarMenu,
  Button,
  Tag,
  InlineLoading,
  OverflowMenu,
  OverflowMenuItem,
  Modal,
  TextArea,
  Pagination,
  Stack,
  MultiSelect,
  DatePicker,
  DatePickerInput,
  MenuButton,
  MenuItem,
  MenuItemDivider,
  FileUploaderDropContainer,
  AILabel,
  Select,
  SelectItem,
  Grid,
  Column,
} from '@carbon/react';
import AISkeleton from './AISkeleton';
import {
  Search, Filter, View, Add, TrashCan, Image as ImageIcon,
  Grid as GridIcon, Phone, Play, LogoInstagram, LogoLinkedin,
  Renew,
  MagicWandFilled,
  SendFilled,
  CheckmarkFilled,
  Settings,
  Download,
} from '@carbon/icons-react';
import { useAuth } from '@/shared/contexts/AuthContext';
import { supabase } from '@/services/supabase';
import { api } from '@/services/api';
import { useNotifications } from '../NotificationProvider';
import { t } from '../../config/locale';
import CarouselPreview from './CarouselPreview';
import { SocialMediaPreview } from './SocialMediaPreview';
import QualityGateSummary from './QualityGateSummary';
import PublishButton from '../PublishButton';
import PublishStatusBadge from '../PublishStatusBadge';
import MediaUploadModal from './MediaUploadModal';
import MediaAssignmentModal from './MediaAssignmentModal';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Post {
  id: string;
  tenant_id: string;
  format: 'feed' | 'carrossel' | 'stories' | 'reels';
  status: 'draft' | 'pending_review' | 'approved' | 'revision_requested' | 'published';
  title: string;
  description: string | null;
  scheduled_date: string | null;
  hashtags: string | null;
  cta: string | null;
  card_data: any[];
  media_slots: number;
  ai_instructions: string | null;
  ai_processing: boolean;
  created_by: string | null;
  published_at: string | null;
  created_at: string;
  quality_scores?: any[];
}

interface PostMedia {
  id: string;
  post_id: string;
  position: number;
  type: 'image' | 'video';
  wix_media_id: string | null;
  wix_media_url: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  status: 'pending' | 'uploaded' | 'approved';
}

// ─── Constants ────────────────────────────────────────────────────────────────
const getStatusMap = () => ({
  draft: { color: 'cool-gray', label: t('matrixDraft') },
  pending_review: { color: 'yellow', label: t('matrixPendingReview') },
  approved: { color: 'green', label: t('matrixApproved') },
  revision_requested: { color: 'red', label: t('matrixRevisionRequested') },
  published: { color: 'blue', label: t('matrixPublished') },
});

const FORMAT_ICON: Record<string, React.ReactNode> = {
  feed: <ImageIcon size={16} />,
  carrossel: <GridIcon size={16} />,
  stories: <Phone size={16} />,
  reels: <Play size={16} />,
};

// genOS™ v5.0.0 AISkeleton Guard
const AICell = ({ loading, value }: { loading?: boolean, value: React.ReactNode }) => {
  if (loading) return <AISkeleton lines={1} />;
  return <>{value}</>;
};

const getFormatLabel = () => ({
  feed: t('matrixFeed'),
  carrossel: t('matrixCarousel'),
  stories: t('matrixStories'),
  reels: t('matrixReels'),
});

const getHeaders = (isParent: boolean = false) => {
  const base = [
    { key: 'title', header: t('matrixTableTitle') },
    { key: 'format', header: t('matrixTableFormat') },
    { key: 'score', header: 'Score' },
    { key: 'cost', header: 'Custo (AI)' },
    { key: 'status', header: t('matrixTableStatus') },
    { key: 'publish', header: 'Publicação' },
    { key: 'scheduled_date', header: t('matrixTableDate') },
  ];
  if (isParent) {
    base.splice(1, 0, { key: 'tenant_name', header: 'Tenant' });
  }
  base.push({ key: 'actions', header: '' });
  return base;
};

// ─── Component ────────────────────────────────────────────────────────────────
interface MatrixListProps {
  onNewPost?: () => void;
  onCountChange?: (count: number) => void;
  onRefreshRef?: React.MutableRefObject<(() => Promise<void>) | null>;
}

export default function MatrixList({ onNewPost, onCountChange, onRefreshRef }: MatrixListProps) {
  const { me, refreshMe, refreshWallet } = useAuth();
  const tenant = me.tenant;
  const user = me.user;
  const { showToast } = useNotifications();
  const [posts, setPosts] = useState<Post[]>([]);
  const [mediaMap, setMediaMap] = useState<Record<string, PostMedia[]>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown Filtering specific variables
  const [agencyTenants, setAgencyTenants] = useState<any[]>([]);
  const [selectedTenantFilter, setSelectedTenantFilter] = useState('all');

  // Media Management State
  const [uploadMediaPost, setUploadMediaPost] = useState<Post | null>(null);
  const [showMediaUpload, setShowMediaUpload] = useState(false);

  const [showMediaAssignment, setShowMediaAssignment] = useState(false);
  const [uploadedMedia, setUploadedMedia] = useState<any[]>([]);
  const [replaceMediaItem, setReplaceMediaItem] = useState<any>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);

  // Depth-based role detection
  const depthLevel = tenant?.depth_level ?? 0;
  const isClient = depthLevel >= 2;
  const isAgencyOrMaster = depthLevel <= 1;

  // AI revision modal
  const [revisePost, setRevisePost] = useState<Post | null>(null);
  const [reviseInstructions, setReviseInstructions] = useState('');
  const [isRevising, setIsRevising] = useState(false);

  // Agency revision request modal
  const [revisionRequestPost, setRevisionRequestPost] = useState<Post | null>(null);
  const [revisionComment, setRevisionComment] = useState('');

  // Delete confirmation
  const [deletePosts, setDeletePosts] = useState<Post[]>([]);

  // Filter
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [formatFilter, setFormatFilter] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);

  // DNA Brand modal
  const [showDnaModal, setShowDnaModal] = useState(false);
  const [brandDna, setBrandDna] = useState<any>(null);
  const [loadingDna, setLoadingDna] = useState(false);

  // Billing Limits
  const myUsage = me.usage;
  const tokensRemaining = myUsage ? Math.max(0, myUsage.tokens_limit - myUsage.tokens_used) : 0;
  const postsRemaining = myUsage ? Math.max(0, myUsage.posts_limit - myUsage.posts_used) : 0;
  const canGenerate = tokensRemaining > 0 && postsRemaining > 0;

  // Preview modal
  const [previewPost, setPreviewPost] = useState<Post | null>(null);
  const [isLivePreview, setIsLivePreview] = useState(true);
  const [previewPlatform, setPreviewPlatform] = useState<'instagram' | 'linkedin'>('instagram');


  // Track whether initial load has completed (to avoid flashing spinner on refreshes)
  const initialLoadDone = useRef(false);

  // ─── Data loading ─────────────────────────────────────────────────────────
  const lastFetchHash = useRef('');
  const fetchInFlight = useRef(false);
  const fetchPosts = useCallback(async (force = false) => {
    if (!tenant?.id) return;
    // Prevent concurrent fetches (unless forced)
    if (fetchInFlight.current && !force) return;
    fetchInFlight.current = true;

    // Support force refresh by showing loading state even if not initial
    if (!initialLoadDone.current || force) setLoading(true);

    try {
      const targetTenantId = (isAgencyOrMaster && selectedTenantFilter !== 'all') ? selectedTenantFilter : tenant.id;
      const includeChildren = (isAgencyOrMaster && selectedTenantFilter === 'all');
      const result: any = await api.edgeFn('list-posts', {
        tenant_id: targetTenantId,
        include_children: includeChildren
      });
      const postList = (result || []) as (Post & { post_media: PostMedia[] })[];

      // Skip re-render if data hasn't changed (avoid visual flashing) - unless forced
      const hash = JSON.stringify(postList.map(p => `${p.id}:${p.status}:${p.ai_processing}:${p.scheduled_date}:${p.title}`));
      if (!force && hash === lastFetchHash.current && initialLoadDone.current) return;
      lastFetchHash.current = hash;

      const mMap: Record<string, PostMedia[]> = {};
      postList.forEach(p => {
        mMap[p.id] = (p.post_media || []).sort((a, b) => a.position - b.position);
      });

      setPosts(postList.map(({ post_media, ...rest }) => rest));
      setMediaMap(mMap);
      if (onCountChange) onCountChange(postList.length);

      if (force && initialLoadDone.current) {
        showToast('Sucesso', 'Dados atualizados com sucesso', 'success');
      }
    } catch (err) {
      console.error('MatrixList fetch error:', err);
      showToast('Erro ao atualizar', 'Não foi possível carregar os posts.', 'error');
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
      fetchInFlight.current = false;
    }
  }, [tenant?.id, isAgencyOrMaster, selectedTenantFilter, onCountChange, showToast]);

  // Expose to parent (for refresh after post creation)
  useEffect(() => {
    if (onRefreshRef) {
      onRefreshRef.current = () => fetchPosts(true);
    }
    return () => { if (onRefreshRef) onRefreshRef.current = null; };
  }, [onRefreshRef, fetchPosts]);

  // Load Agency Tenants for dropdown
  useEffect(() => {
    if (isAgencyOrMaster) {
      api.loadTenants().then(tList => setAgencyTenants(tList));
    }
  }, [isAgencyOrMaster]);

  // ─── Real-time Supervision (Phase 6: Live Matrix) ─────────────────────────
  useEffect(() => {
    if (!tenant?.id) return;

    // Listen for any changes to the posts table for this tenant
    const channel = supabase
      .channel(`matrix-realtime-${tenant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
          filter: `tenant_id=eq.${tenant.id}`
        },
        (payload) => {
          console.log('Real-time change detected:', payload.eventType, (payload.new as any)?.id || (payload.old as any)?.id);
          // Smart Refresh: fetch without full loading spinner to keep UI updated
          fetchPosts(false);
        }
      )
      .subscribe();

    // Initial fetch
    initialLoadDone.current = false;
    fetchPosts();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, selectedTenantFilter, fetchPosts]);


  // ─── Filtering & Pagination ───────────────────────────────────────────────
  const filtered = posts.filter(p => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!p.title.toLowerCase().includes(q) && !p.format.toLowerCase().includes(q)) return false;
    }
    if (statusFilter.length > 0 && !statusFilter.includes(p.status)) return false;
    if (formatFilter.length > 0 && !formatFilter.includes(p.format)) return false;
    return true;
  });

  // ─── Export CSV ─────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    const csvHeaders = ['Título', 'Formato', 'Status', 'Data Agendada', 'Descrição', 'Hashtags', 'CTA'];
    const csvRows = filtered.map(p => [
      `"${(p.title || '').replace(/"/g, '""')}"`,
      getFormatLabel()[p.format] || p.format,
      getStatusMap()[p.status]?.label || p.status,
      p.scheduled_date ? new Date(p.scheduled_date).toLocaleDateString('pt-BR') : '',
      `"${(p.description || '').replace(/"/g, '""')}"`,
      `"${(p.hashtags || '').replace(/"/g, '""')}"`,
      `"${(p.cta || '').replace(/"/g, '""')}"`,
    ]);
    const csv = [csvHeaders.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content-factory-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(t('matrixCsvExported'), `${filtered.length} ${t('matrixCsvExportedMsg')}`, 'success');
  };

  // ─── Fetch Brand DNA (via edge function to bypass RLS) ─────────────────────
  const fetchBrandDna = useCallback(async () => {
    if (!tenant?.id) return;
    setLoadingDna(true);
    try {
      const result: any = await api.edgeFn('content-factory-ai', {
        action: 'get_brand_dna',
        tenantId: tenant.id,
      });
      if (result?.error) throw new Error(result.error);
      setBrandDna(result?.data ?? result ?? null);
    } catch (err) {
      console.error('Error fetching brand DNA:', err);
    } finally {
      setLoadingDna(false);
    }
  }, [tenant?.id]);

  const openDnaModal = () => {
    // Use setTimeout to escape Carbon OverflowMenu's close-on-click
    // which can suppress state updates in the same tick
    setTimeout(() => {
      fetchBrandDna();
      setShowDnaModal(true);
    }, 0);
  };

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  // ─── Row data for DataTable ───────────────────────────────────────────────
  const rows = paginated.map(post => {
    const latestScore = post.quality_scores?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    return {
      id: post.id,
      title: post.title,
      tenant_name: (post as any).tenant_name || 'Desconhecido',
      format: post.format,
      status: post.status,
      score: latestScore?.weighted_total || 0,
      cost: latestScore?.tokens_used || 0,
      publish: <PublishStatusBadge postId={post.id} />,
      scheduled_date: post.scheduled_date
        ? new Date(post.scheduled_date).toLocaleDateString('pt-BR')
        : '—',
      actions: '',
    };
  });

  // ─── Notify child tenant about post actions ────────────────────────────────
  const getNotifyMessages = (): Record<string, { action: string; summary: string }> => ({
    pending_review: { action: 'post_submitted_for_review', summary: t('matrixNotifyPendingReview') },
    approved: { action: 'post_approved', summary: t('matrixNotifyApproved') },
    revision_requested: { action: 'post_revision_requested', summary: t('matrixNotifyRevisionRequested') },
    published: { action: 'post_published', summary: t('matrixNotifyPublished') },
  });

  const notifyChildTenant = async (postId: string, actionKey: string, postTitle?: string) => {
    try {
      const post = getPostById(postId);
      const childTenantId = post?.tenant_id || tenant?.id;
      if (!childTenantId) return;
      const msg = getNotifyMessages()[actionKey];
      if (!msg) return;

      await supabase.from('activity_log').insert({
        tenant_id: childTenantId,
        action: msg.action,
        resource_type: 'post',
        resource_id: postId,
        severity: actionKey === 'revision_requested' ? 'warning' : 'info',
        category: 'ai_generation',
        summary: postTitle ? `${msg.summary}: "${postTitle}"` : msg.summary,
        is_autonomous: true,
        show_toast: true,
        toast_duration: 8000,
      });
    } catch (err) {
      console.error('[notifyChildTenant]', err);
    }
  };

  // ─── Status Transition ──────────────────────────────────────────────────────
  const updateStatus = async (postId: string, newStatus: Post['status'], extraFields?: Record<string, unknown>) => {
    try {
      const update: Record<string, unknown> = { status: newStatus, ...extraFields };
      if (newStatus === 'published') update.published_at = new Date().toISOString();

      const post = getPostById(postId);

      // Try edge function first (bypasses RLS for client tenants), fallback to direct supabase
      try {
        const result: any = await api.edgeFn('content-factory-ai', {
          action: 'update_status',
          postId,
          tenantId: tenant?.id,
          ...update,
        });
        if (result?.error) throw new Error(result.error);
      } catch {
        // Fallback: direct supabase update (works for master/agency with write RLS)
        if (!tenant?.id) throw new Error('Tenant não identificado');
        const { error } = await supabase.from('posts').update(update).eq('id', postId).eq('tenant_id', tenant.id);
        if (error) throw error;
      }
      const statusMap = getStatusMap();
      showToast(t('matrixStatusUpdated'), `Post movido para: ${statusMap[newStatus]?.label || newStatus}`, 'success');

      notifyChildTenant(postId, newStatus, post?.title);
      await refreshWallet();
      fetchPosts(true);
    } catch (err: any) {
      showToast(t('matrixStatusUpdateFailed'), String(err.message || err), 'error');
    }
  };

  const handleSubmitForReview = (postId: string) => updateStatus(postId, 'pending_review');
  const handleApprove = (postId: string) => updateStatus(postId, 'approved');
  const handlePublish = (postId: string) => updateStatus(postId, 'published');

  const handleRequestRevision = async () => {
    if (!revisionRequestPost) return;
    await updateStatus(revisionRequestPost.id, 'revision_requested', {
      ai_instructions: revisionComment.trim()
        ? `[REVISÃO AGENCY]: ${revisionComment.trim()}`
        : revisionRequestPost.ai_instructions,
    });
    setRevisionRequestPost(null);
    setRevisionComment('');
  };

  // ─── AI Revision ────────────────────────────────────────────────────────────
  const handleAiRevise = async () => {
    if (!revisePost) return;
    setIsRevising(true);
    try {
      await api.edgeFn('content-factory-ai', {
        action: 'revise',
        postId: revisePost.id,
        tenantId: tenant?.id,
        instructions: reviseInstructions,
      });
      showToast('AI ativada', 'O post está sendo processado pela AI. Aguarde...', 'info');

      // Notify child tenant about AI revision
      const childTenantId = revisePost.tenant_id || tenant?.id;
      if (childTenantId) {
        await supabase.from('activity_log').insert({
          tenant_id: childTenantId,
          action: 'post_ai_revised',
          resource_type: 'post',
          resource_id: revisePost.id,
          severity: 'info',
          category: 'ai_generation',
          summary: `Post refeito por IA: "${revisePost.title}"`,
          detail: reviseInstructions || undefined,
          is_autonomous: true,
          show_toast: true,
          toast_duration: 8000,
        });
      }

      setRevisePost(null);
      setReviseInstructions('');
      // Refresh usage badges immediately so tokens/posts counts are in sync
      await refreshWallet();
      setPage(1);
      fetchPosts(true);
    } catch (err: any) {
      showToast('Falha na revisão AI', String(err.message || err), 'error');
    } finally {
      setIsRevising(false);
    }
  };

  // ─── Delete (via edge function to bypass RLS) ──────────────────────────────
  const handleDelete = async () => {
    if (deletePosts.length === 0) return;
    try {
      await Promise.all(deletePosts.map(async (post) => {
        const result: any = await api.edgeFn('content-factory-ai', {
          action: 'delete_post',
          postId: post.id,
          tenantId: tenant?.id,
        });
        if (result?.error) throw new Error(result.error);
      }));

      const isSingle = deletePosts.length === 1;
      showToast(
        isSingle ? 'Post excluído' : 'Posts excluídos',
        isSingle ? `"${deletePosts[0].title}" foi removido.` : `${deletePosts.length} posts foram removidos.`,
        'success'
      );
      setDeletePosts([]);
      fetchPosts();
    } catch (err: any) {
      showToast('Erro ao excluir', String(err.message || err), 'error');
    }
  };

  // ─── Delete Media ────────────────────────────────────────────────────────────
  const handleDeleteMedia = async (media: any) => {
    if (!window.confirm(`Excluir permanentemente: ${media.file_name}?`)) return;
    try {
      await api.edgeFn('media-manager', { action: 'delete', media_id: media.id, post_id: media.post_id });
      showToast('Mídia excluída', 'A mídia foi removida do storage.', 'success');
      fetchPosts(true);
    } catch (err: any) {
      showToast('Falha ao excluir', err.message || 'Ocorreu um erro', 'error');
    }
  };

  // ─── Replace Media ────────────────────────────────────────────────────────────
  const handleReplaceSubmit = async () => {
    if (!replaceMediaItem || !replaceFile) return;
    setIsReplacing(true);
    try {
      const formData = new FormData();
      formData.append('action', 'replace');
      formData.append('file', replaceFile);
      formData.append('media_id', replaceMediaItem.id);
      formData.append('post_id', replaceMediaItem.post_id);

      await api.edgeFn('media-manager', formData);
      showToast('Mídia Substituída', 'A nova mídia foi processada.', 'success');
      setReplaceMediaItem(null);
      setReplaceFile(null);
      fetchPosts(true);
    } catch (err: any) {
      showToast('Falha na substituição', err.message || 'Erro ao processar arquivo', 'error');
    } finally {
      setIsReplacing(false);
    }
  };

  // ─── Update Scheduled Date ────────────────────────────────────────────────
  const updateScheduledDate = async (postId: string, date: string | null) => {
    try {
      const result: any = await api.edgeFn('content-factory-ai', {
        action: 'update_status',
        postId,
        tenantId: tenant?.id,
        scheduled_date: date,
      });
      if (result?.error) throw new Error(result.error);
      showToast('Data atualizada', 'Data de postagem atualizada com sucesso.', 'success');
      fetchPosts();
    } catch (err: any) {
      showToast('Erro ao atualizar data', String(err.message || err), 'error');
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const getPostById = (id: string) => posts.find(p => p.id === id);

  const buildMediaRefMap = (postId: string): Record<string, { url: string; fileName: string }> => {
    const mediaList = mediaMap[postId] || [];
    const refMap: Record<string, { url: string; fileName: string }> = {};
    mediaList.forEach(m => {
      if (m.id && m.wix_media_url) {
        refMap[m.id] = { url: m.wix_media_url, fileName: m.file_name || '' };
      }
    });
    return refMap;
  };

  const canEdit = (post: Post): boolean => {
    if (isAgencyOrMaster) return true;
    return post.status === 'draft' || post.status === 'revision_requested';
  };

  const usage = (useAuth() as any).me?.usage;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {loading && (
        <div style={{ padding: '2rem' }}>
          <InlineLoading description={t('matrixLoadingFactory')} />
        </div>
      )}
      {/* ─── DataTable — AI Full Table ─────────────────────────────────────── */}
      {!loading && (<><DataTable rows={rows} headers={getHeaders(isAgencyOrMaster)} isSortable>
        {({
          rows: tableRows,
          headers: tableHeaders,
          getHeaderProps,
          getRowProps,
          getTableProps,
          getToolbarProps,
          getSelectionProps,
          getBatchActionProps,
          selectedRows,
          onInputChange,
        }: any) => {
          const batchActionProps = getBatchActionProps();
          return (
            <>
              <TableContainer
                className="cf-table-container"
              >
                <TableToolbar {...getToolbarProps()}>
                  <TableBatchActions {...batchActionProps}>
                    <TableBatchAction
                      renderIcon={TrashCan}
                      onClick={() => {
                        const postsToDelete = selectedRows.map((r: any) => getPostById(r.id)).filter(Boolean) as Post[];
                        if (postsToDelete.length > 0) setDeletePosts(postsToDelete);
                      }}
                    >
                      {t('matrixDelete')} ({selectedRows.length})
                    </TableBatchAction>
                    <TableBatchAction
                      renderIcon={SendFilled}
                      onClick={() => {
                        selectedRows.forEach((r: any) => {
                          const p = getPostById(r.id);
                          if (p && (p.status === 'draft' || p.status === 'revision_requested')) {
                            handleSubmitForReview(p.id);
                          }
                        });
                      }}
                    >
                      {t('matrixSubmitForReview')}
                    </TableBatchAction>
                  </TableBatchActions>
                  <TableToolbarContent>
                    {isAgencyOrMaster && (
                      <Select
                        id="tenant-filter"
                        labelText=""
                        inline
                        value={selectedTenantFilter}
                        onChange={(e: any) => setSelectedTenantFilter(e.target.value)}
                        style={{ marginRight: '1rem', width: '250px' }}
                      >
                        <SelectItem value="all" text="Todos os clientes" />
                        {agencyTenants.filter(t => t.id !== tenant?.id).map(t => {
                          const isDuplicate = agencyTenants.filter(at => at.name === t.name).length > 1;
                          const displayText = isDuplicate ? `${t.name} (${t.slug})` : t.name;
                          return (
                            <SelectItem key={t.id} value={t.id} text={displayText || 'Tenant'} />
                          );
                        })}
                      </Select>
                    )}
                    <TableToolbarSearch
                      onChange={(e: any) => {
                        const q = e.target?.value || '';
                        setSearchQuery(q);
                        setPage(1);
                        onInputChange(e);
                      }}
                      placeholder={t('matrixTableTitle')}
                    />



                    <Button
                      kind="ghost"
                      hasIconOnly
                      renderIcon={Filter}
                      iconDescription="Filtrar"
                      tooltipPosition="bottom"
                      className="cds--toolbar-action cds--overflow-menu"
                      onClick={() => setShowFilter(prev => !prev)}
                    />
                    <Button
                      kind="ghost"
                      hasIconOnly
                      renderIcon={MagicWandFilled}
                      iconDescription="DNA da Marca"
                      tooltipPosition="bottom"
                      className="cds--toolbar-action"
                      onClick={openDnaModal}
                    />
                    <Button
                      kind="ghost"
                      hasIconOnly
                      renderIcon={Renew}
                      iconDescription="Atualizar tabela"
                      tooltipPosition="bottom"
                      className="cds--toolbar-action"
                      onClick={() => fetchPosts(true)}
                    />
                    <TableToolbarMenu renderIcon={Settings} iconDescription="Ajustes">
                      <OverflowMenuItem itemText={t('matrixExportCSV')} onClick={handleExportCSV} />
                      <OverflowMenuItem itemText={t('matrixDnaModalTitle')} onClick={() => openDnaModal()} />
                      <OverflowMenuItem itemText={t('matrixUpdateTable')} onClick={() => { setTimeout(() => fetchPosts(true), 0); }} />
                    </TableToolbarMenu>
                    <Button kind="primary" size="sm" renderIcon={Add} onClick={onNewPost}>
                      {t('matrixNewPostButton')}
                    </Button>
                  </TableToolbarContent>
                </TableToolbar>

                {/* ─── Filter Panel ─────────────────────────────────────────────── */}
                {showFilter && (
                  <div className="cf-filter-panel">
                    <MultiSelect
                      id="filter-status"
                      titleText="Status"
                      label="Filtrar por status"
                      size="sm"
                      items={Object.entries(getStatusMap()).map(([k, v]: [string, { color: string; label: string }]) => ({ id: k, text: v.label }))}
                      itemToString={(item: any) => item?.text || ''}
                      selectedItems={statusFilter.map(k => ({ id: k, text: (getStatusMap() as Record<string, { color: string; label: string }>)[k]?.label || k }))}
                      onChange={({ selectedItems }: any) => {
                        setStatusFilter(selectedItems.map((i: any) => i.id));
                        setPage(1);
                      }}
                    />
                    <MultiSelect
                      id="filter-format"
                      titleText="Formato"
                      label="Filtrar por formato"
                      size="sm"
                      items={Object.entries(getFormatLabel()).map(([k, v]: [string, string]) => ({ id: k, text: v }))}
                      itemToString={(item: any) => item?.text || ''}
                      selectedItems={formatFilter.map(k => ({ id: k, text: (getFormatLabel() as Record<string, string>)[k] || k }))}
                      onChange={({ selectedItems }: any) => {
                        setFormatFilter(selectedItems.map((i: any) => i.id));
                        setPage(1);
                      }}
                    />
                    <div className="cf-filter-actions">
                      <Button kind="ghost" size="sm" onClick={() => { setStatusFilter([]); setFormatFilter([]); }}>
                        Limpar filtros
                      </Button>
                      <Button kind="primary" size="sm" onClick={() => setShowFilter(false)}>
                        Aplicar
                      </Button>
                    </div>
                  </div>
                )}

                <Table {...getTableProps()} size="lg" aria-label="Content Factory DataTable">
                  <TableHead>
                    <TableRow>
                      <TableExpandHeader aria-label="Expandir" />
                      <TableSelectAll {...getSelectionProps()} />
                      {tableHeaders.map((header: any) => {
                        const { key, ...hProps } = getHeaderProps({ header });
                        return (
                          <TableHeader key={key} {...hProps} isSortable={header.key !== 'actions'}>
                            {header.header}
                          </TableHeader>
                        );
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tableRows.map((row: any) => {
                      const post = getPostById(row.id);
                      return (
                        <React.Fragment key={row.id}>
                          <TableExpandRow
                            {...((() => { const { key, ...rest } = getRowProps({ row }); return rest; })())}
                            key={row.id}
                            className={post?.ai_processing ? 'ai-glow-row' : ''}
                          >
                            <TableSelectRow {...getSelectionProps({ row })} />
                            {row.cells.map((cell: any) => {
                              let content: React.ReactNode = <AICell loading={post?.ai_processing} value={cell.value} />;

                              if (cell.info.header === 'status') {
                                const st = (getStatusMap() as Record<string, { color: string; label: string }>)[cell.value as string] || { color: 'cool-gray', label: cell.value };
                                content = (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Tag type={st.color as any} size="sm">{st.label}</Tag>
                                    {post?.ai_processing && <InlineLoading description={t('matrixAiProcessingLabel')} style={{ minHeight: 0 }} />}
                                  </span>
                                );
                              } else if (cell.info.header === 'format') {
                                const icon = FORMAT_ICON[cell.value as string] || null;
                                const label = (getFormatLabel() as Record<string, string>)[cell.value as string] || cell.value;
                                content = (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--cds-text-secondary)' }}>
                                    {icon} {label}
                                  </span>
                                );
                              } else if (cell.info.header === 'score') {
                                const score = Number(cell.value);
                                content = (
                                  <Tag type={score >= 8 ? 'green' : score >= 5 ? 'teal' : 'red'} size="sm">
                                    {score ? score.toFixed(1) : '—'}
                                  </Tag>
                                );
                              } else if (cell.info.header === 'cost') {
                                content = (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <span className="cds--type-caption-01">{cell.value ? `${cell.value} tokens` : '—'}</span>
                                    <AILabel size="xs">
                                      <Stack gap={4} style={{ padding: '0.75rem' }}>
                                        <p className="cds--type-label-01">Estimativa Helian™</p>
                                        <p className="cds--type-body-short-01">Custo baseado no processamento de BrandDNA via {post?.quality_scores?.[0]?.model_used || 'Claude 3.5 Sonnet'}.</p>
                                      </Stack>
                                    </AILabel>
                                  </div>
                                );
                              } else if (cell.info.header === 'tenant_name') {
                                content = (
                                  <Tag type="cool-gray" size="sm" style={{ margin: 0 }}>
                                    {cell.value}
                                  </Tag>
                                );
                              } else if (cell.info.header === 'publish') {
                                content = cell.value;
                              } else if (cell.info.header === 'actions') {
                                content = post ? (
                                  <RowActions
                                    post={post}
                                    isClient={isClient}
                                    isAgencyOrMaster={isAgencyOrMaster}
                                    canEditPost={canEdit(post)}
                                    onSubmitForReview={() => handleSubmitForReview(post.id)}
                                    onApprove={() => handleApprove(post.id)}
                                    onRequestRevision={() => { setRevisionRequestPost(post); setRevisionComment(''); }}
                                    onPublish={() => handlePublish(post.id)}
                                    onReviseAi={() => { setRevisePost(post); setReviseInstructions(''); }}
                                    onDelete={() => setDeletePosts([post])}
                                    onPreview={() => setPreviewPost(post)}
                                    canGenerate={canGenerate}
                                  />
                                ) : null;
                              }

                              return <TableCell key={cell.id}>{content}</TableCell>;
                            })}
                          </TableExpandRow>

                          {/* Expanded Row — cover image + Visualizar + Regenerar textos */}
                          <TableExpandedRow colSpan={getHeaders(isAgencyOrMaster).length + 2}>
                            {post && (
                              <section className="cf-expanded-workstation" style={{ padding: '1.5rem', borderLeft: '4px solid var(--cds-interactive-01)' }}>
                                <Grid>
                                  <Column lg={4} md={4} sm={4}>
                                    <div style={{ marginBottom: '1rem' }}>
                                      <p className="cds--type-label-01" style={{ marginBottom: '0.5rem' }}>Visual Preview (Raw)</p>
                                      <CarouselPreview
                                        format={post.format}
                                        cardData={post.card_data || []}
                                        mediaMap={buildMediaRefMap(post.id)}
                                        maxWidth={280}
                                      />
                                    </div>
                                    <Button
                                      kind="ghost"
                                      size="sm"
                                      renderIcon={View}
                                      onClick={() => setPreviewPost(post)}
                                    >
                                      Full Social Preview
                                    </Button>
                                  </Column>
                                  <Column lg={8} md={4} sm={4}>
                                    <QualityGateSummary scores={post.quality_scores?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || {}} />

                                    <Stack gap={4} style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--cds-field-01)' }}>
                                      {post.description && (
                                        <div>
                                          <p className="cds--type-label-01">Legenda / Descrição</p>
                                          <p className="cds--type-body-short-01">{post.description}</p>
                                        </div>
                                      )}
                                      {post.hashtags && (
                                        <div>
                                          <p className="cds--type-label-01">Sinalização de Hashtags</p>
                                          <p className="cds--type-caption-01" style={{ color: 'var(--cds-link-primary)' }}>{post.hashtags}</p>
                                        </div>
                                      )}
                                      {post.cta && (
                                        <div>
                                          <p className="cds--type-label-01">Call to Action (CTA)</p>
                                          <p className="cds--type-body-short-01" style={{ fontWeight: 600 }}>{post.cta}</p>
                                        </div>
                                      )}
                                    </Stack>
                                  </Column>
                                </Grid>
                              </section>
                            )}
                          </TableExpandedRow>
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          );
        }}
      </DataTable>

        <Pagination
          totalItems={filtered.length}
          pageSize={pageSize}
          page={page}
          pageSizes={[10, 25, 50]}
          onChange={({ page: p, pageSize: ps }: any) => { setPage(p); setPageSize(ps); }}
          className="matrix-section-separator"
        /></>)}

      {/* ─── AI Revision Modal ───────────────────────────────────────────────── */}
      {revisePost && (
        <Modal
          open
          modalHeading={`${t('matrixRegenerateTexts')}: ${revisePost.title}`}
          primaryButtonText={isRevising ? t('matrixProcessingButton') : t('matrixSendToAi')}
          secondaryButtonText={t('matrixCancel')}
          onRequestClose={() => setRevisePost(null)}
          onRequestSubmit={handleAiRevise}
          primaryButtonDisabled={isRevising}
          size="md"

        >
          <div style={{ paddingBottom: '1rem' }}>
            {revisePost.ai_instructions && (
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{t('matrixCurrentAiInstructions')}</p>
                <p className="matrix-ai-content-block">
                  {revisePost.ai_instructions}
                </p>
              </div>
            )}
            <TextArea
              id="revise-instructions"
              labelText={t('matrixRegenerateTexts')}
              placeholder={t('matrixInstructionsPlaceholder')}
              value={reviseInstructions}
              onChange={(e: any) => setReviseInstructions(e.target.value)}
              rows={4}
            />
            {isRevising && <InlineLoading description={t('matrixAiProcessingRevision')} style={{ marginTop: '1rem' }} />}
          </div>
        </Modal>
      )}

      {/* ─── Agency Revision Request Modal ───────────────────────────────────── */}
      {revisionRequestPost && (
        <Modal
          open
          modalHeading={`${t('matrixRequestRevision')}: ${revisionRequestPost.title}`}
          primaryButtonText={t('matrixSubmitForReview')}
          secondaryButtonText={t('matrixCancel')}
          onRequestClose={() => setRevisionRequestPost(null)}
          onRequestSubmit={handleRequestRevision}
          size="md"

        >
          <div style={{ paddingBottom: '1rem' }}>
            <p className="cds--type-body-short-01">
              O post voltará ao status <Tag type="red" size="sm">Revisão Solicitada</Tag> e o cliente poderá editá-lo.
            </p>
            <TextArea
              id="revision-comment"
              labelText={t('matrixRevisionComment')}
              placeholder={t('matrixRevisionPlaceholder')}
              value={revisionComment}
              onChange={(e: any) => setRevisionComment(e.target.value)}
              rows={4}
            />
          </div>
        </Modal>
      )}

      {/* ─── Delete Confirmation Modal ───────────────────────────────────────── */}
      {deletePosts.length > 0 && (
        <Modal
          open
          danger
          modalHeading={t('matrixConfirmDelete')}
          primaryButtonText={t('matrixDeletePermanently')}
          secondaryButtonText={t('matrixCancel')}
          onRequestClose={() => setDeletePosts([])}
          onRequestSubmit={handleDelete}
          size="xs"
        >
          <p>
            {deletePosts.length === 1
              ? <>{t('matrixDeleteWarning')} <strong>{deletePosts[0].title}</strong>? {t('matrixDeleteWarningEnd')}</>
              : `Tem certeza que deseja excluir ${deletePosts.length} posts? Esta ação não pode ser desfeita.`
            }
          </p>
        </Modal>
      )}

      {/* ─── Post Preview Modal — full details + MenuButton actions ── */}
      {previewPost && (
        <Modal
          open
          passiveModal
          modalHeading={previewPost.title}
          onRequestClose={() => setPreviewPost(null)}
          size="lg"

        >
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', paddingBlockEnd: '1rem' }}>
            <div style={{ flex: '0 0 auto' }}>
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                <Button
                  size="sm"
                  kind={isLivePreview ? 'primary' : 'ghost'}
                  onClick={() => setIsLivePreview(true)}
                >
                  Live Preview
                </Button>
                <Button
                  size="sm"
                  kind={!isLivePreview ? 'primary' : 'ghost'}
                  onClick={() => setIsLivePreview(false)}
                >
                  Raw Content
                </Button>
              </div>

              {isLivePreview ? (
                <SocialMediaPreview
                  platform={previewPlatform}
                  format={previewPost.format as any}
                  cardData={previewPost.card_data || []}
                  mediaMap={buildMediaRefMap(previewPost.id)}
                  brandName={tenant?.name}
                  brandLogo={(tenant as any)?.logo_url}
                />
              ) : (
                <CarouselPreview
                  format={previewPost.format}
                  cardData={previewPost.card_data || []}
                  mediaMap={buildMediaRefMap(previewPost.id)}
                  maxWidth={360}
                />
              )}
            </div>
            <div style={{ flex: 1, minWidth: '16rem' }}>
              <Stack gap={4}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Tag type={(getStatusMap()[previewPost.status]?.color || 'cool-gray') as any} size="sm">
                    {getStatusMap()[previewPost.status]?.label || previewPost.status}
                  </Tag>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--cds-text-helper)' }}>
                    {FORMAT_ICON[previewPost.format]}
                    {getFormatLabel()[previewPost.format] || previewPost.format}
                  </span>
                </div>
                {previewPost.description && (
                  <div>
                    <p className="cds--type-label-01">DESCRIÇÃO</p>
                    <p style={{ fontSize: '0.875rem' }}>{previewPost.description}</p>
                  </div>
                )}
                {previewPost.hashtags && (
                  <div>
                    <p className="cds--type-label-01">HASHTAGS</p>
                    <p className="matrix-link-text">{previewPost.hashtags}</p>
                  </div>
                )}
                {previewPost.cta && (
                  <div>
                    <p className="cds--type-label-01">CTA</p>
                    <p style={{ fontSize: '0.875rem' }}>{previewPost.cta}</p>
                  </div>
                )}

                {/* Date Picker for scheduled date */}
                <div>
                  <DatePicker
                    datePickerType="single"
                    minDate="today"
                    value={previewPost.scheduled_date ? new Date(previewPost.scheduled_date) : undefined}
                    onChange={(dates: Date[]) => {
                      if (dates[0]) {
                        updateScheduledDate(previewPost.id, dates[0].toISOString());
                        setPreviewPost({ ...previewPost, scheduled_date: dates[0].toISOString() });
                      }
                    }}
                    dateFormat="d/m/Y"
                  >
                    <DatePickerInput
                      id="scheduled-date-picker"
                      labelText={t('matrixPostDateLabel')}
                      placeholder={t('matrixDatePlaceholder')}
                      size="md"
                    />
                  </DatePicker>
                </div>

                {previewPost.ai_instructions && (
                  <div>
                    <p className="cds--type-label-01">
                      {previewPost.ai_instructions.startsWith('[REVISÃO AGENCY]') ? t('matrixCommentaryTitle') : t('matrixAiInstructions')}
                    </p>
                    <p className={previewPost.ai_instructions.startsWith('[REVISÃO AGENCY]') ? 'matrix-ai-content-block matrix-ai-content-block--revision' : 'matrix-ai-content-block'}>
                      {previewPost.ai_instructions}
                    </p>
                  </div>
                )}

                {/* ─── Seção de Mídias Vinculadas ─── */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <p className="cds--type-label-01">{t('matrixLinkedMedia') || 'MÍDIAS VINCULADAS'}</p>
                    <Tag type={(mediaMap[previewPost.id] || []).length > 0 ? 'green' : 'cool-gray'} size="sm">
                      {(mediaMap[previewPost.id] || []).length} / {previewPost.media_slots || 1}
                    </Tag>
                  </div>

                  {(mediaMap[previewPost.id] || []).length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(mediaMap[previewPost.id] || []).map(media => (
                        <div key={media.id} style={{ backgroundColor: 'var(--cds-layer-02)', padding: '0.5rem', borderRadius: 4, display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          <div className="media-thumbnail" style={{ width: 44, height: 44, borderRadius: 4, overflow: 'hidden', flexShrink: 0, backgroundColor: 'var(--cds-layer-03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {media.type === 'image' ? (
                              <img src={media.wix_media_url || ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <Play size={24} />
                            )}
                          </div>
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <p style={{ fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{media.file_name}</p>
                            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.125rem', flexWrap: 'wrap' }}>
                              <Tag type="cool-gray" size="sm" style={{ margin: 0, minHeight: '1.25rem', padding: '0 0.25rem' }}>Pos {media.position}</Tag>
                              <Tag type={media.type === 'image' ? 'teal' : 'purple'} size="sm" style={{ margin: 0, minHeight: '1.25rem', padding: '0 0.25rem' }}>{media.type}</Tag>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.125rem' }}>
                            {media.wix_media_url && (
                              <Button kind="ghost" size="sm" hasIconOnly renderIcon={View} tooltipPosition="left" iconDescription="Ver" onClick={() => window.open(media.wix_media_url || '', '_blank')} />
                            )}
                            <Button kind="ghost" size="sm" hasIconOnly renderIcon={Renew} tooltipPosition="left" iconDescription="Substituir" onClick={() => { setReplaceMediaItem(media); }} />
                            <Button kind="danger--ghost" size="sm" hasIconOnly renderIcon={TrashCan} tooltipPosition="left" iconDescription="Remover" onClick={() => handleDeleteMedia(media)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ backgroundColor: 'var(--cds-layer-02)', padding: '1rem', borderRadius: 4 }}>
                      <p className="cds--type-body-compact-01">Nenhuma mídia vinculada a este post.</p>
                    </div>
                  )}

                  {(isAgencyOrMaster || (isClient && ['draft', 'revision_requested'].includes(previewPost.status))) && (
                    <Button
                      kind="tertiary"
                      size="sm"
                      style={{ marginTop: '0.5rem', width: '100%' }}
                      onClick={() => {
                        setUploadMediaPost(previewPost);
                        setShowMediaUpload(true);
                        setPreviewPost(null);
                      }}
                    >
                      {(mediaMap[previewPost.id] || []).length > 0 ? 'Gerenciar Mídias' : 'Upload Media'}
                    </Button>
                  )}
                </div>
                {/* Card data info */}
                {previewPost.card_data && previewPost.card_data.length > 0 && (
                  <div>
                    <p className="cds--type-label-01">
                      {t('matrixSlideIndicator')} ({previewPost.card_data.length})
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {previewPost.card_data.map((card: any, idx: number) => (
                        <div key={idx} style={{
                          backgroundColor: 'var(--cds-layer-01)',
                          padding: '0.75rem',
                          borderRadius: 4,
                          borderLeft: '3px solid var(--cds-interactive)',
                        }}>
                          <p style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                            {t('matrixSlideLabel')} {card.position || idx + 1}
                          </p>
                          {card.text_primary && (
                            <p style={{ fontSize: '0.8125rem' }}>{card.text_primary}</p>
                          )}
                          {card.text_secondary && (
                            <p className="cds--type-helper-text-01">{card.text_secondary}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ─── MenuButton Actions ─────────────────────────────────── */}
                <div style={{ paddingTop: '1.5rem', borderTop: '1px solid var(--cds-border-subtle-01)', marginTop: '1rem' }}>
                  <Stack orientation="horizontal" gap={5}>
                    <MenuButton
                      label={t('matrixActions') || 'Ações do Post'}
                      size="md"
                      kind="tertiary"
                    >
                      {/* Grupo: Revisão & Edição */}
                      <MenuItem
                        label={t('matrixSave') || 'Salvar Alterações'}
                        onClick={() => {
                          if (previewPost.scheduled_date) {
                            updateScheduledDate(previewPost.id, previewPost.scheduled_date);
                          } else {
                            showToast('Alterações salvas', 'Post salvo com sucesso.', 'success');
                          }
                          setPreviewPost(null);
                        }}
                      />
                      <MenuItem
                        label={t('matrixRegenerate') || 'Regenerar com IA'}
                        disabled={!canGenerate}
                        onClick={() => {
                          setRevisePost(previewPost);
                          setReviseInstructions('');
                          setPreviewPost(null);
                        }}
                      />

                      <MenuItemDivider />

                      {/* Grupo: Fluxo de Aprovação */}
                      {previewPost.status === 'pending_review' && (
                        <MenuItem label={t('matrixApprove') || 'Aprovar Content'}>
                          <MenuItem
                            label={t('matrixApproveSchedule') || 'Aprovar e agendar'}
                            onClick={(e: any) => {
                              e.stopPropagation();
                              handleApprove(previewPost.id);
                              if (previewPost.scheduled_date) setPreviewPost(null);
                            }}
                          />
                          <MenuItem
                            label={t('matrixApproveOnly') || 'Aprovar sem agendar'}
                            onClick={(e: any) => {
                              e.stopPropagation();
                              handleApprove(previewPost.id);
                              setPreviewPost(null);
                            }}
                          />
                        </MenuItem>
                      )}

                      {isAgencyOrMaster && previewPost.status === 'pending_review' && (
                        <MenuItem
                          label={t('matrixRequestRevision') || 'Solicitar Revisão'}
                          onClick={(e: any) => {
                            e.stopPropagation();
                            setRevisionRequestPost(previewPost);
                            setRevisionComment('');
                            setPreviewPost(null);
                          }}
                        />
                      )}

                      {isClient && (previewPost.status === 'draft' || previewPost.status === 'revision_requested') && (
                        <MenuItem
                          label={t('matrixSubmitReview') || 'Enviar para Analista'}
                          onClick={(e: any) => {
                            e.stopPropagation();
                            handleSubmitForReview(previewPost.id);
                            setPreviewPost(null);
                          }}
                        />
                      )}

                      <MenuItemDivider />

                      {/* Grupo: Execução */}
                      {isAgencyOrMaster && previewPost.status === 'approved' && (
                        <MenuItem
                          label={t('matrixPublishNow') || 'Publicar Imediato'}
                          onClick={(e: any) => {
                            e.stopPropagation();
                            handlePublish(previewPost.id);
                            setPreviewPost(null);
                          }}
                        />
                      )}

                      <MenuItem
                        label={t('matrixDelete') || 'Excluir Post'}
                        kind="danger"
                        onClick={(e: any) => {
                          e.stopPropagation();
                          setDeletePosts([previewPost]);
                          setPreviewPost(null);
                        }}
                      />
                    </MenuButton>

                    <Button
                      kind="primary"
                      size="md"
                      renderIcon={CheckmarkFilled}
                      style={{ flex: 1 }}
                      onClick={async () => {
                        if (previewPost.status === 'pending_review') {
                          handleApprove(previewPost.id);
                        } else if (previewPost.status === 'approved') {
                          handlePublish(previewPost.id);
                        } else {
                          handleSubmitForReview(previewPost.id);
                        }
                        await refreshWallet();
                        setPreviewPost(null);
                      }}
                    >
                      {previewPost.status === 'pending_review' ? 'Aprovar' : previewPost.status === 'approved' ? 'Publicar Imediato' : 'Enviar para Analista'}
                    </Button>
                  </Stack>
                </div>
              </Stack>
            </div>
          </div>
        </Modal>
      )}

      {/* ─── DNA da Marca Modal ──────────────────────────────────────────────── */}
      <Modal
        open={showDnaModal}
        passiveModal
        modalHeading={t('matrixDnaModalTitle')}
        onRequestClose={() => setShowDnaModal(false)}
        size="md"
      >
        <div style={{ paddingBlockEnd: '1rem' }}>

          {loadingDna ? (
            <InlineLoading description={t('matrixLoadingDna')} />
          ) : tenant ? (
            <Stack gap={5}>
              <div>
                <p className="cds--type-label-01">WORKSPACE</p>
                <p style={{ fontSize: '0.875rem' }}>{tenant.name}</p>
              </div>
              {brandDna ? (
                <>
                  {brandDna.persona_name && (
                    <div>
                      <p className="cds--type-label-01">PERSONA</p>
                      <p style={{ fontSize: '0.875rem' }}>{brandDna.persona_name}</p>
                    </div>
                  )}
                  {brandDna.voice_tone && (
                    <div>
                      <p className="cds--type-label-01">TOM DE VOZ</p>
                      <p style={{ fontSize: '0.875rem' }}>{brandDna.voice_tone}</p>
                    </div>
                  )}
                  {brandDna.voice_description && (
                    <div>
                      <p className="cds--type-label-01">DESCRIÇÃO DA VOZ</p>
                      <p style={{ fontSize: '0.875rem' }}>{brandDna.voice_description}</p>
                    </div>
                  )}
                  {brandDna.target_audience && (
                    <div>
                      <p className="cds--type-label-01">PÚBLICO-ALVO</p>
                      <p style={{ fontSize: '0.875rem' }}>{brandDna.target_audience}</p>
                    </div>
                  )}
                  {brandDna.editorial_pillars && Array.isArray(brandDna.editorial_pillars) && brandDna.editorial_pillars.length > 0 && (
                    <div>
                      <p className="cds--type-label-01">PILARES EDITORIAIS</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {brandDna.editorial_pillars.map((p: string, i: number) => (
                          <Tag key={i} type="blue" size="sm">{p}</Tag>
                        ))}
                      </div>
                    </div>
                  )}
                  {brandDna.brand_values && Array.isArray(brandDna.brand_values) && brandDna.brand_values.length > 0 && (
                    <div>
                      <p className="cds--type-label-01">VALORES DA MARCA</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {brandDna.brand_values.map((v: string, i: number) => (
                          <Tag key={i} type="teal" size="sm">{v}</Tag>
                        ))}
                      </div>
                    </div>
                  )}
                  {brandDna.forbidden_words && Array.isArray(brandDna.forbidden_words) && brandDna.forbidden_words.length > 0 && (
                    <div>
                      <p className="cds--type-label-01">PALAVRAS PROIBIDAS</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {brandDna.forbidden_words.map((w: string, i: number) => (
                          <Tag key={i} type="red" size="sm">{w}</Tag>
                        ))}
                      </div>
                    </div>
                  )}
                  {brandDna.generation_notes && (
                    <div>
                      <p className="cds--type-label-01">NOTAS DE GERAÇÃO</p>
                      <p className="cds--type-helper-text-01" style={{ fontStyle: 'italic' }}>{brandDna.generation_notes}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="cds--type-helper-text-01" style={{ fontStyle: 'italic' }}>
                  {t('matrixNoDnaConfigured')}
                </p>
              )}
            </Stack>
          ) : (
            <p className="cds--type-helper-text-01">{t('matrixNoWorkspaceSelected')}</p>
          )}
        </div>
      </Modal>
      {/* ─── Media Upload Modal ────────────────────────────────────────────── */}
      <MediaUploadModal
        open={showMediaUpload}
        onClose={() => { setShowMediaUpload(false); setUploadMediaPost(null); }}
        post={uploadMediaPost}
        onUploadComplete={(media) => {
          setUploadedMedia(media);
          setShowMediaUpload(false);
          if (uploadMediaPost?.format === 'carrossel' || uploadMediaPost?.format === 'stories') {
            setShowMediaAssignment(true);
          } else {
            setUploadMediaPost(null);
            fetchPosts(true);
          }
        }}
      />

      <MediaAssignmentModal
        open={showMediaAssignment}
        onClose={() => { setShowMediaAssignment(false); setUploadMediaPost(null); setUploadedMedia([]); }}
        onBack={() => { setShowMediaAssignment(false); setShowMediaUpload(true); }}
        post={uploadMediaPost}
        uploadedMedia={uploadedMedia}
        onSaveComplete={() => {
          fetchPosts(true);
        }}
      />

      {/* ─── Replace Media Item Modal ──────────────────────────────────────── */}
      <Modal
        open={!!replaceMediaItem}
        modalHeading="Substituir Mídia"
        primaryButtonText={isReplacing ? 'Enviando...' : 'Substituir'}
        secondaryButtonText="Cancelar"
        primaryButtonDisabled={!replaceFile || isReplacing}
        onRequestClose={() => { setReplaceMediaItem(null); setReplaceFile(null); }}
        onRequestSubmit={handleReplaceSubmit}
        size="sm"
      >
        <div style={{ paddingBottom: '1rem' }}>
          <p className="cds--type-body-short-01" style={{ marginBottom: '1rem' }}>
            Selecione o novo arquivo. O nome padrão será mantido e a URL pública atualizada de forma transparente nas propriedades do arquivo.
          </p>
          <FileUploaderDropContainer
            accept={['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime']}
            labelText={replaceFile ? replaceFile.name : "Arraste aqui ou clique"}
            multiple={false}
            onAddFiles={(evt: any, { addedFiles }: any) => {
              if (addedFiles.length > 0) setReplaceFile(addedFiles[0]);
            }}
          />
        </div>
      </Modal>

    </>
  );
}

// ─── Row Actions Sub-component ────────────────────────────────────────────────
function RowActions({
  post,
  isClient,
  isAgencyOrMaster,
  canEditPost,
  onSubmitForReview,
  onApprove,
  onRequestRevision,
  onPublish,
  onReviseAi,
  onDelete,
  onPreview,
  canGenerate,
}: {
  post: Post;
  isClient: boolean;
  isAgencyOrMaster: boolean;
  canEditPost: boolean;
  onSubmitForReview: () => void;
  onApprove: () => void;
  onRequestRevision: () => void;
  onPublish: () => void;
  onReviseAi: () => void;
  onDelete: () => void;
  onPreview: () => void;
  canGenerate: boolean;
}) {
  if (post.ai_processing) {
    return <InlineLoading description={t('matrixAiProcessingLabel')} style={{ minHeight: 0 }} />;
  }

  return (
    <OverflowMenu size="sm" flipped={false} aria-label="Ações" iconDescription="Ações">
      <OverflowMenuItem
        itemText={t('matrixViewAction')}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
          onPreview();
        }}
      />

      {isClient && post.status === 'draft' && (
        <OverflowMenuItem
          itemText={t('matrixSubmitForReview')}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            onSubmitForReview();
          }}
        />
      )}
      {isClient && post.status === 'revision_requested' && (
        <OverflowMenuItem
          itemText={t('matrixResubmitForReview')}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            onSubmitForReview();
          }}
        />
      )}
      {isClient && post.status === 'pending_review' && (
        <OverflowMenuItem
          itemText={t('matrixApprove')}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            onApprove();
          }}
        />
      )}
      {isClient && post.status === 'pending_review' && (
        <OverflowMenuItem
          itemText={t('matrixRequestChange')}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            onRequestRevision();
          }}
        />
      )}

      {isAgencyOrMaster && post.status === 'pending_review' && (
        <OverflowMenuItem
          itemText={t('matrixApprove')}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            onApprove();
          }}
        />
      )}
      {isAgencyOrMaster && post.status === 'pending_review' && (
        <OverflowMenuItem
          itemText={t('matrixAskRevision')}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            onRequestRevision();
          }}
        />
      )}
      {isAgencyOrMaster && post.status === 'approved' && (
        <OverflowMenuItem
          itemText={t('matrixPublish')}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            onPublish();
          }}
        />
      )}

      {(isAgencyOrMaster || post.status === 'draft') && (
        <OverflowMenuItem
          hasDivider
          isDelete
          itemText={t('matrixDelete')}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            onDelete();
          }}
        />
      )}
      <div
        style={{ padding: '0.5rem', borderTop: '1px solid #333', marginTop: '0.25rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <PublishButton postId={post.id} isApproved={post.status === 'approved' || post.status === 'published'} />
      </div>
    </OverflowMenu>
  );
}
