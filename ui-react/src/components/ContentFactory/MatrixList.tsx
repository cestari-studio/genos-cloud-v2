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
  AILabel,
  AILabelContent,
  AILabelActions,
  MultiSelect,
  DatePicker,
  DatePickerInput,
} from '@carbon/react';
import {
  Add,
  Renew,
  Image as ImageIcon,
  Play,
  Grid as GridIcon,
  Phone,
  View,
  TrashCan,
  MagicWandFilled,
  SendFilled,
  CheckmarkFilled,
  Settings,
  Filter,
  Download,
} from '@carbon/icons-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { api } from '../../services/api';
import { useNotifications } from '../NotificationProvider';
import { t } from '../../config/locale';
import CarouselPreview from './CarouselPreview';
import PublishButton from '../PublishButton';
import PublishStatusBadge from '../PublishStatusBadge';

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

const getFormatLabel = () => ({
  feed: t('matrixFeed'),
  carrossel: t('matrixCarousel'),
  stories: t('matrixStories'),
  reels: t('matrixReels'),
});

const getHeaders = () => [
  { key: 'title', header: t('matrixTableTitle') },
  { key: 'format', header: t('matrixTableFormat') },
  { key: 'status', header: t('matrixTableStatus') },
  { key: 'publish', header: 'Publicação' },
  { key: 'scheduled_date', header: t('matrixTableDate') },
  { key: 'actions', header: '' },
];

// ─── Component ────────────────────────────────────────────────────────────────
interface MatrixListProps {
  onNewPost?: () => void;
  onRefreshRef?: React.MutableRefObject<(() => void) | null>;
  onCountChange?: (count: number) => void;
}

export default function MatrixList({ onNewPost, onRefreshRef, onCountChange }: MatrixListProps) {
  const { me } = useAuth();
  const tenant = me.tenant;
  const user = me.user;
  const { showToast } = useNotifications();
  const [posts, setPosts] = useState<Post[]>([]);
  const [mediaMap, setMediaMap] = useState<Record<string, PostMedia[]>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');

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


  // Track whether initial load has completed (to avoid flashing spinner on refreshes)
  const initialLoadDone = useRef(false);

  // ─── Data loading ─────────────────────────────────────────────────────────
  const lastFetchHash = useRef('');
  const fetchInFlight = useRef(false);
  const fetchPosts = useCallback(async () => {
    if (!tenant?.id) return;
    // Prevent concurrent fetches (realtime + polling + manual can overlap)
    if (fetchInFlight.current) return;
    fetchInFlight.current = true;
    if (!initialLoadDone.current) setLoading(true);
    try {
      const result: any = await api.edgeFn('list-posts', { tenant_id: tenant.id });
      if (!result?.success) throw new Error(result?.error || 'Falha ao buscar posts');

      const postList = (result.posts || []) as (Post & { post_media: PostMedia[] })[];

      // Skip re-render if data hasn't changed (avoid visual flashing)
      const hash = JSON.stringify(postList.map(p => `${p.id}:${p.status}:${p.ai_processing}:${p.scheduled_date}:${p.title}`));
      if (hash === lastFetchHash.current && initialLoadDone.current) return;
      lastFetchHash.current = hash;

      const mMap: Record<string, PostMedia[]> = {};
      postList.forEach(p => {
        mMap[p.id] = (p.post_media || []).sort((a, b) => a.position - b.position);
      });

      setPosts(postList.map(({ post_media, ...rest }) => rest));
      setMediaMap(mMap);
      if (onCountChange) onCountChange(postList.length);
    } catch (err) {
      console.error('MatrixList fetch error:', err);
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
      fetchInFlight.current = false;
    }
  }, [tenant?.id]);

  // Stable ref so callbacks/effects always call the latest fetchPosts
  const fetchPostsRef = useRef(fetchPosts);
  fetchPostsRef.current = fetchPosts;

  // Expose to parent (for refresh after post creation)
  useEffect(() => {
    if (onRefreshRef) onRefreshRef.current = () => fetchPostsRef.current();
    return () => { if (onRefreshRef) onRefreshRef.current = null; };
  }, [onRefreshRef]);

  // ─── SINGLE effect: initial fetch (NO polling/realtime) ──────────────────
  useEffect(() => {
    if (!tenant?.id) return;
    // Initial fetch only
    fetchPostsRef.current();
  }, [tenant?.id]);


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
  const rows = paginated.map(post => ({
    id: post.id,
    title: post.title,
    format: post.format,
    status: post.status,
    publish: <PublishStatusBadge postId={post.id} />,
    scheduled_date: post.scheduled_date
      ? new Date(post.scheduled_date).toLocaleDateString('pt-BR')
      : '—',
    actions: '',
  }));

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
        const { error } = await supabase.from('posts').update(update).eq('id', postId);
        if (error) throw error;
      }
      const statusMap = getStatusMap();
      showToast(t('matrixStatusUpdated'), `Post movido para: ${statusMap[newStatus]?.label || newStatus}`, 'success');

      // Notify child tenant about the status change
      notifyChildTenant(postId, newStatus, post?.title);

      fetchPosts();
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
      fetchPosts();
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
      {!loading && (<><DataTable rows={rows} headers={getHeaders()} isSortable>
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
                      onClick={() => fetchPosts()}
                    />
                    <TableToolbarMenu renderIcon={Settings} iconDescription="Ajustes">
                      <OverflowMenuItem itemText={t('matrixExportCSV')} onClick={handleExportCSV} />
                      <OverflowMenuItem itemText={t('matrixDnaModalTitle')} onClick={() => openDnaModal()} />
                      <OverflowMenuItem itemText={t('matrixUpdateTable')} onClick={() => { setTimeout(() => fetchPosts(), 0); }} />
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
                              let content: React.ReactNode = cell.value;

                              if (cell.info.header === 'status') {
                                const st = (getStatusMap() as Record<string, { color: string; label: string }>)[cell.value as string] || { color: 'cool-gray', label: cell.value };
                                content = (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Tag type={st.color as any} size="sm">{st.label}</Tag>
                                    {post?.ai_processing && <InlineLoading description={t('matrixAiProcessingLabel')} style={{ minHeight: 0 }} />}
                                  </span>
                                );
                              } else if (cell.info.header === 'format') {
                                content = (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {FORMAT_ICON[cell.value] || null}
                                    {(getFormatLabel() as Record<string, string>)[cell.value as string] || cell.value}
                                  </span>
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
                          <TableExpandedRow colSpan={getHeaders().length + 2}>
                            {post && (
                              <div className="cf-expanded-wrapper">
                                <div className="cf-expanded-content">
                                  {/* Cover image */}
                                  <div className="cf-expanded-cover">
                                    {(() => {
                                      const firstMedia = (mediaMap[post.id] || [])[0];
                                      return firstMedia?.wix_media_url ? (
                                        <img
                                          src={firstMedia.wix_media_url}
                                          alt={post.title}
                                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                      ) : (
                                        <ImageIcon size={32} style={{ opacity: 0.3 }} />
                                      );
                                    })()}
                                  </div>

                                  {/* Info summary — text wraps naturally */}
                                  <div className="cf-expanded-info">
                                    {post.description && (
                                      <p className="cf-expanded-description">{post.description}</p>
                                    )}
                                    {post.hashtags && (
                                      <p className="cf-expanded-hashtags">{post.hashtags}</p>
                                    )}
                                    {post.cta && (
                                      <p className="cf-expanded-cta">{post.cta}</p>
                                    )}
                                    {post.ai_processing && (
                                      <InlineLoading description={t('matrixAiProcessingLabel')} />
                                    )}
                                  </div>
                                </div>

                                {/* Action buttons — below content, same width */}
                                <div className="cf-expanded-actions">
                                  <Button
                                    kind="primary"
                                    size="sm"
                                    renderIcon={View}
                                    className="cf-expanded-btn"
                                    onClick={() => setPreviewPost(post)}
                                  >
                                    Visualizar
                                  </Button>
                                  <Button
                                    kind="tertiary"
                                    size="sm"
                                    renderIcon={MagicWandFilled}
                                    className="cf-expanded-btn"
                                    disabled={post.ai_processing || !canGenerate}
                                    onClick={() => { setRevisePost(post); setReviseInstructions(''); }}
                                  >
                                    Regenerar
                                  </Button>
                                </div>
                              </div>
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
          style={{ borderTop: '1px solid #393939' }}
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
          slug={
            <AILabel autoAlign size="xs">
              <AILabelContent>
                <div style={{ padding: '1rem' }}>
                  <p className="secondary">AI Explained</p>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0.25rem 0' }}>genOS AI</h2>
                  <p className="secondary" style={{ fontWeight: 600 }}>Revisão de Conteúdo</p>
                  <p className="secondary" style={{ marginTop: '0.5rem' }}>
                    Conteúdo processado pelo pipeline de inteligência artificial da Cestari Studio.
                  </p>
                  <hr style={{ margin: '0.75rem 0', borderColor: '#525252' }} />
                  <p className="secondary">Modelo</p>
                  <p style={{ fontWeight: 600 }}>Gemini 2.0 Flash</p>
                </div>
              </AILabelContent>
            </AILabel>
          }
        >
          <div style={{ paddingBottom: '1rem' }}>
            {revisePost.ai_instructions && (
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{t('matrixCurrentAiInstructions')}</p>
                <p style={{ backgroundColor: '#262626', padding: '1rem', borderRadius: 4, fontStyle: 'italic' }}>
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
          slug={
            <AILabel autoAlign size="xs">
              <AILabelContent>
                <div style={{ padding: '1rem' }}>
                  <p className="secondary">AI Explained</p>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0.25rem 0' }}>{t('matrixRequestRevision')}</h2>
                  <p className="secondary" style={{ marginTop: '0.5rem' }}>
                    O comentário será adicionado às instruções da AI para regenerar o conteúdo.
                  </p>
                </div>
              </AILabelContent>
            </AILabel>
          }
        >
          <div style={{ paddingBottom: '1rem' }}>
            <p style={{ marginBottom: '1rem', color: '#c6c6c6' }}>
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

      {/* ─── Post Preview Modal — full details + approve/reject + date picker ── */}
      {previewPost && (
        <Modal
          open
          modalHeading={previewPost.title}
          onRequestClose={() => setPreviewPost(null)}
          size="lg"
          primaryButtonText={
            isClient && previewPost.status === 'pending_review' ? t('matrixApprove') :
              isAgencyOrMaster && previewPost.status === 'pending_review' ? t('matrixApprove') :
                isAgencyOrMaster && previewPost.status === 'approved' ? t('matrixPublish') :
                  undefined
          }
          secondaryButtonText={
            (isClient || isAgencyOrMaster) && previewPost.status === 'pending_review' ? t('matrixRequestRevision') :
              t('matrixClosing')
          }
          onRequestSubmit={() => {
            if (previewPost.status === 'pending_review') {
              handleApprove(previewPost.id);
              setPreviewPost(null);
            } else if (isAgencyOrMaster && previewPost.status === 'approved') {
              handlePublish(previewPost.id);
              setPreviewPost(null);
            }
          }}
          onSecondarySubmit={() => {
            if (previewPost.status === 'pending_review') {
              setRevisionRequestPost(previewPost);
              setRevisionComment('');
              setPreviewPost(null);
            } else {
              setPreviewPost(null);
            }
          }}
          slug={
            <AILabel autoAlign size="xs">
              <AILabelContent>
                <div style={{ padding: '1rem' }}>
                  <p className="secondary">AI Explained</p>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: '0.25rem 0' }}>genOS AI</h2>
                  <p className="secondary" style={{ fontWeight: 600 }}>{t('matrixGeneratedContent')}</p>
                  <p className="secondary" style={{ marginTop: '0.5rem' }}>
                    {t('matrixGeneratedDescription')}
                  </p>
                  <hr style={{ margin: '0.75rem 0', borderColor: '#525252' }} />
                  <p className="secondary">Modelo</p>
                  <p style={{ fontWeight: 600 }}>Gemini 2.0 Flash</p>
                </div>
              </AILabelContent>
            </AILabel>
          }
        >
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', paddingBlockEnd: '1rem' }}>
            <div style={{ flex: '0 0 auto' }}>
              <CarouselPreview
                format={previewPost.format}
                cardData={previewPost.card_data || []}
                mediaMap={buildMediaRefMap(previewPost.id)}
                maxWidth={360}
              />
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
                    <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>DESCRIÇÃO</p>
                    <p style={{ fontSize: '0.875rem' }}>{previewPost.description}</p>
                  </div>
                )}
                {previewPost.hashtags && (
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>HASHTAGS</p>
                    <p style={{ fontSize: '0.875rem', color: '#78a9ff' }}>{previewPost.hashtags}</p>
                  </div>
                )}
                {previewPost.cta && (
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>CTA</p>
                    <p style={{ fontSize: '0.875rem' }}>{previewPost.cta}</p>
                  </div>
                )}

                {/* Date Picker for scheduled date */}
                <div>
                  <DatePicker
                    datePickerType="single"
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
                    <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>
                      {previewPost.ai_instructions.startsWith('[REVISÃO AGENCY]') ? t('matrixCommentaryTitle') : t('matrixAiInstructions')}
                    </p>
                    <p style={{
                      fontSize: '0.875rem', fontStyle: 'italic',
                      backgroundColor: previewPost.ai_instructions.startsWith('[REVISÃO AGENCY]') ? '#3a1d1d' : '#393939',
                      padding: '0.75rem', borderRadius: 4,
                      borderLeft: previewPost.ai_instructions.startsWith('[REVISÃO AGENCY]') ? '3px solid #da1e28' : 'none',
                    }}>
                      {previewPost.ai_instructions}
                    </p>
                  </div>
                )}
                {/* Card data info */}
                {previewPost.card_data && previewPost.card_data.length > 0 && (
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>
                      {t('matrixSlideIndicator')} ({previewPost.card_data.length})
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {previewPost.card_data.map((card: any, idx: number) => (
                        <div key={idx} style={{
                          backgroundColor: '#262626',
                          padding: '0.75rem',
                          borderRadius: 4,
                          borderLeft: '3px solid #0f62fe',
                        }}>
                          <p style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: '0.25rem' }}>
                            {t('matrixSlideLabel')} {card.position || idx + 1}
                          </p>
                          {card.text_primary && (
                            <p style={{ fontSize: '0.8125rem' }}>{card.text_primary}</p>
                          )}
                          {card.text_secondary && (
                            <p style={{ fontSize: '0.75rem', color: '#a8a8a8', marginTop: '0.25rem' }}>{card.text_secondary}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>WORKSPACE</p>
                <p style={{ fontSize: '0.875rem' }}>{tenant.name}</p>
              </div>
              {brandDna ? (
                <>
                  {brandDna.persona_name && (
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>PERSONA</p>
                      <p style={{ fontSize: '0.875rem' }}>{brandDna.persona_name}</p>
                    </div>
                  )}
                  {brandDna.voice_tone && (
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>TOM DE VOZ</p>
                      <p style={{ fontSize: '0.875rem' }}>{brandDna.voice_tone}</p>
                    </div>
                  )}
                  {brandDna.voice_description && (
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>DESCRIÇÃO DA VOZ</p>
                      <p style={{ fontSize: '0.875rem' }}>{brandDna.voice_description}</p>
                    </div>
                  )}
                  {brandDna.target_audience && (
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>PÚBLICO-ALVO</p>
                      <p style={{ fontSize: '0.875rem' }}>{brandDna.target_audience}</p>
                    </div>
                  )}
                  {brandDna.editorial_pillars && Array.isArray(brandDna.editorial_pillars) && brandDna.editorial_pillars.length > 0 && (
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>PILARES EDITORIAIS</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {brandDna.editorial_pillars.map((p: string, i: number) => (
                          <Tag key={i} type="blue" size="sm">{p}</Tag>
                        ))}
                      </div>
                    </div>
                  )}
                  {brandDna.brand_values && Array.isArray(brandDna.brand_values) && brandDna.brand_values.length > 0 && (
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>VALORES DA MARCA</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {brandDna.brand_values.map((v: string, i: number) => (
                          <Tag key={i} type="teal" size="sm">{v}</Tag>
                        ))}
                      </div>
                    </div>
                  )}
                  {brandDna.forbidden_words && Array.isArray(brandDna.forbidden_words) && brandDna.forbidden_words.length > 0 && (
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>PALAVRAS PROIBIDAS</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {brandDna.forbidden_words.map((w: string, i: number) => (
                          <Tag key={i} type="red" size="sm">{w}</Tag>
                        ))}
                      </div>
                    </div>
                  )}
                  {brandDna.generation_notes && (
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>NOTAS DE GERAÇÃO</p>
                      <p style={{ fontSize: '0.875rem', fontStyle: 'italic', color: '#a8a8a8' }}>{brandDna.generation_notes}</p>
                    </div>
                  )}
                </>
              ) : (
                <p style={{ color: '#a8a8a8', fontStyle: 'italic' }}>
                  {t('matrixNoDnaConfigured')}
                </p>
              )}
            </Stack>
          ) : (
            <p style={{ color: '#a8a8a8' }}>{t('matrixNoWorkspaceSelected')}</p>
          )}
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
    <OverflowMenu size="sm" flipped aria-label="Ações" iconDescription="Ações">
      <OverflowMenuItem itemText={t('matrixViewAction')} onClick={onPreview} />

      {isClient && post.status === 'draft' && (
        <OverflowMenuItem itemText={t('matrixSubmitForReview')} onClick={onSubmitForReview} />
      )}
      {isClient && post.status === 'revision_requested' && (
        <OverflowMenuItem itemText={t('matrixResubmitForReview')} onClick={onSubmitForReview} />
      )}
      {isClient && post.status === 'pending_review' && (
        <OverflowMenuItem itemText={t('matrixApprove')} onClick={onApprove} />
      )}
      {isClient && post.status === 'pending_review' && (
        <OverflowMenuItem itemText={t('matrixRequestChange')} onClick={onRequestRevision} />
      )}
      {isClient && (post.status === 'draft' || post.status === 'revision_requested') && (
        <OverflowMenuItem disabled={!canGenerate} itemText={t('matrixRegenerateTexts')} onClick={onReviseAi} />
      )}

      {isAgencyOrMaster && post.status === 'pending_review' && (
        <OverflowMenuItem itemText={t('matrixApprove')} onClick={onApprove} />
      )}
      {isAgencyOrMaster && post.status === 'pending_review' && (
        <OverflowMenuItem itemText={t('matrixAskRevision')} onClick={onRequestRevision} />
      )}
      {isAgencyOrMaster && post.status === 'approved' && (
        <OverflowMenuItem itemText={t('matrixPublish')} onClick={onPublish} />
      )}
      {isAgencyOrMaster && (
        <OverflowMenuItem disabled={!canGenerate} itemText={t('matrixRegenerateTexts')} onClick={onReviseAi} />
      )}

      {(isAgencyOrMaster || post.status === 'draft') && (
        <OverflowMenuItem hasDivider isDelete itemText={t('matrixDelete')} onClick={onDelete} />
      )}
      <div style={{ padding: '0.5rem', borderTop: '1px solid #333', marginTop: '0.25rem' }}>
        <PublishButton postId={post.id} isApproved={post.status === 'approved' || post.status === 'published'} />
      </div>
    </OverflowMenu>
  );
}
