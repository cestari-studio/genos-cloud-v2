// genOS Lumina — Content Factory MatrixList (DataTable + Revision Workflow)
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
  TableDecoratorRow,
  TableSelectAll,
  TableSelectRow,
  TableBatchActions,
  TableBatchAction,
  Button,
  Tag,
  InlineLoading,
  OverflowMenu,
  OverflowMenuItem,
  FileUploader,
  Modal,
  TextArea,
  Pagination,
  Tile,
  Stack,
  AILabel,
  AILabelContent,
  AILabelActions,
} from '@carbon/react';
import {
  Add,
  Renew,
  Image as ImageIcon,
  Play,
  Grid as GridIcon,
  Phone,
  Checkmark,
  View,
  TrashCan,
  MagicWandFilled,
  SendFilled,
  Undo,
  CheckmarkFilled,
  ChevronLeft,
  ChevronRight,
} from '@carbon/icons-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { api } from '../../services/api';
import { useNotifications } from '../NotificationProvider';
import CardDataEditor, { type CardSlide } from './CardDataEditor';
import CarouselPreview from './CarouselPreview';

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
const STATUS_MAP: Record<string, { color: string; label: string }> = {
  draft:              { color: 'cool-gray', label: 'Rascunho' },
  pending_review:     { color: 'yellow',    label: 'Aguardando Revisão' },
  approved:           { color: 'green',     label: 'Aprovado' },
  revision_requested: { color: 'red',       label: 'Revisão Solicitada' },
  published:          { color: 'blue',      label: 'Publicado' },
};

const FORMAT_ICON: Record<string, React.ReactNode> = {
  feed:      <ImageIcon size={16} />,
  carrossel: <GridIcon size={16} />,
  stories:   <Phone size={16} />,
  reels:     <Play size={16} />,
};

const FORMAT_LABEL: Record<string, string> = {
  feed: 'Feed',
  carrossel: 'Carrossel',
  stories: 'Stories',
  reels: 'Reels',
};

const headers = [
  { key: 'status',         header: 'Status' },
  { key: 'title',          header: 'Título' },
  { key: 'format',         header: 'Formato' },
  { key: 'scheduled_date', header: 'Data Agendada' },
  { key: 'media',          header: 'Mídia' },
  { key: 'actions',        header: '' },
];

// ─── Component ────────────────────────────────────────────────────────────────
interface MatrixListProps {
  onNewPost?: () => void;
}

export default function MatrixList({ onNewPost }: MatrixListProps) {
  const { me: { tenant, user } } = useAuth();
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

  // Agency revision request modal (with comment)
  const [revisionRequestPost, setRevisionRequestPost] = useState<Post | null>(null);
  const [revisionComment, setRevisionComment] = useState('');

  // Upload state
  const [uploadPostId, setUploadPostId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Delete confirmation
  const [deletePost, setDeletePost] = useState<Post | null>(null);

  // Preview modal
  const [previewPost, setPreviewPost] = useState<Post | null>(null);

  // AI polling — track posts being processed
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Data loading ─────────────────────────────────────────────────────────
  const fetchPosts = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, post_media(*)')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const postList = (data || []) as (Post & { post_media: PostMedia[] })[];
      const mMap: Record<string, PostMedia[]> = {};
      postList.forEach(p => {
        mMap[p.id] = (p.post_media || []).sort((a, b) => a.position - b.position);
      });

      setPosts(postList.map(({ post_media, ...rest }) => rest));
      setMediaMap(mMap);
    } catch (err) {
      console.error('MatrixList fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    fetchPosts();

    // Realtime subscription
    if (!tenant?.id) return;
    const channel = supabase
      .channel('posts_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'posts', filter: `tenant_id=eq.${tenant.id}` },
        () => fetchPosts()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tenant?.id, fetchPosts]);

  // ─── AI Processing Polling ──────────────────────────────────────────────────
  useEffect(() => {
    const hasProcessing = posts.some(p => p.ai_processing);

    if (hasProcessing && !pollingRef.current) {
      pollingRef.current = setInterval(() => {
        fetchPosts();
      }, 3000);
    }

    if (!hasProcessing && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [posts, fetchPosts]);

  // ─── Filtering & Pagination ───────────────────────────────────────────────
  const filtered = searchQuery
    ? posts.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.format.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : posts;

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  // ─── Row data for DataTable ───────────────────────────────────────────────
  const rows = paginated.map(post => ({
    id: post.id,
    status: post.status,
    title: post.title,
    format: post.format,
    scheduled_date: post.scheduled_date
      ? new Date(post.scheduled_date).toLocaleDateString('pt-BR')
      : '—',
    media: (mediaMap[post.id] || []).length,
    actions: '',
  }));

  // ─── Status Transition ──────────────────────────────────────────────────────
  const updateStatus = async (postId: string, newStatus: Post['status'], extraFields?: Record<string, unknown>) => {
    try {
      const update: Record<string, unknown> = { status: newStatus, ...extraFields };
      if (newStatus === 'published') {
        update.published_at = new Date().toISOString();
      }
      const { error } = await supabase.from('posts').update(update).eq('id', postId);
      if (error) throw error;

      const statusLabel = STATUS_MAP[newStatus]?.label || newStatus;
      showToast('Status atualizado', `Post movido para: ${statusLabel}`, 'success');
      fetchPosts();
    } catch (err: any) {
      showToast('Erro ao atualizar status', String(err.message || err), 'error');
    }
  };

  // ─── Client Actions ─────────────────────────────────────────────────────────
  const handleSubmitForReview = (postId: string) => {
    updateStatus(postId, 'pending_review');
  };

  // ─── Agency Actions ─────────────────────────────────────────────────────────
  const handleApprove = (postId: string) => {
    updateStatus(postId, 'approved');
  };

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

  const handlePublish = (postId: string) => {
    updateStatus(postId, 'published');
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
      setRevisePost(null);
      setReviseInstructions('');
      fetchPosts();
    } catch (err: any) {
      showToast('Falha na revisão AI', String(err.message || err), 'error');
    } finally {
      setIsRevising(false);
    }
  };

  // ─── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deletePost) return;
    try {
      await supabase.from('post_media').delete().eq('post_id', deletePost.id);
      await supabase.from('posts').delete().eq('id', deletePost.id);
      showToast('Post excluído', `"${deletePost.title}" foi removido.`, 'success');
      setDeletePost(null);
      fetchPosts();
    } catch (err: any) {
      showToast('Erro ao excluir', String(err.message || err), 'error');
    }
  };

  // ─── Upload ─────────────────────────────────────────────────────────────────
  const handleUpload = async (postId: string, files: FileList | File[]) => {
    if (!files || files.length === 0 || !tenant?.id) return;
    setIsUploading(true);
    setUploadPostId(postId);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const result: any = await api.edgeFn('wix-media-upload', {
          tenantId: tenant.id,
          postId,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          fileData: await fileToBase64(file),
        });

        if (result?.mediaId) {
          const existingMedia = mediaMap[postId] || [];
          const nextPos = existingMedia.length + 1;
          await supabase.from('post_media').insert({
            post_id: postId,
            tenant_id: tenant.id,
            position: nextPos,
            type: file.type.startsWith('video') ? 'video' : 'image',
            wix_media_id: result.mediaId,
            wix_media_url: result.fileUrl,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
            status: 'uploaded',
          });
        }
      }
      showToast('Upload concluído', 'Mídia enviada ao Wix Media Manager.', 'success');
      fetchPosts();
    } catch (err: any) {
      showToast('Erro no upload', String(err.message || err), 'error');
    } finally {
      setIsUploading(false);
      setUploadPostId(null);
    }
  };

  // ─── Card Data ───────────────────────────────────────────────────────────────
  const handleCardDataChange = async (postId: string, cards: CardSlide[]) => {
    try {
      const { error } = await supabase
        .from('posts')
        .update({ card_data: cards })
        .eq('id', postId);
      if (error) throw error;
      // Optimistic local update
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, card_data: cards } : p));
    } catch (err: any) {
      showToast('Erro ao salvar slides', String(err.message || err), 'error');
    }
  };

  // Build mediaMap for CarouselPreview: media_ref (post_media.id) → { url, fileName }
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

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const getPostById = (id: string) => posts.find(p => p.id === id);

  // Can the current user edit this post?
  const canEdit = (post: Post): boolean => {
    if (isAgencyOrMaster) return true; // Agency/Master can edit any post
    // Client can only edit draft or revision_requested
    return post.status === 'draft' || post.status === 'revision_requested';
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: '2rem' }}>
        <InlineLoading description="Carregando Content Factory..." />
      </div>
    );
  }

  return (
    <>
      {/* ─── Card Carousel Preview ─────────────────────────────────────────── */}
      {paginated.length > 0 && (
        <div style={{ marginBlockEnd: 'var(--cds-spacing-05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBlockEnd: 'var(--cds-spacing-03)' }}>
            <p className="section-title" style={{ fontSize: 'var(--cds-heading-02-font-size)' }}>
              Preview Rápido
            </p>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <Button kind="ghost" size="sm" hasIconOnly renderIcon={ChevronLeft} iconDescription="Scroll left"
                onClick={() => { const el = document.getElementById('cf-carousel'); if (el) el.scrollBy({ left: -260, behavior: 'smooth' }); }}
              />
              <Button kind="ghost" size="sm" hasIconOnly renderIcon={ChevronRight} iconDescription="Scroll right"
                onClick={() => { const el = document.getElementById('cf-carousel'); if (el) el.scrollBy({ left: 260, behavior: 'smooth' }); }}
              />
            </div>
          </div>
          <div id="cf-carousel" className="cf-card-carousel">
            {paginated.map(post => {
              const firstMedia = (mediaMap[post.id] || [])[0];
              const st = STATUS_MAP[post.status] || { color: 'cool-gray', label: post.status };
              return (
                <div key={post.id} className="cf-card-item">
                  {firstMedia?.wix_media_url ? (
                    <img src={firstMedia.wix_media_url} alt={post.title} className="cf-card-thumb" />
                  ) : (
                    <div className="cf-card-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
                      <ImageIcon size={32} />
                    </div>
                  )}
                  <p className="cf-card-title">{post.title}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Tag type={st.color as any} size="sm">{st.label}</Tag>
                    {post.ai_processing && <InlineLoading description="" style={{ minHeight: 0 }} />}
                  </div>
                  <p className="cf-card-meta">
                    {FORMAT_LABEL[post.format] || post.format}
                    {post.scheduled_date ? ` · ${new Date(post.scheduled_date).toLocaleDateString('pt-BR')}` : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── DataTable with AI Label, Sorting, Selection ──────────────────── */}
      <DataTable rows={rows} headers={headers} isSortable>
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
          <TableContainer
            title={
              <span className="cf-ai-label-cell">
                Content Factory
                <AILabel size="mini" autoAlign>
                  <AILabelContent>
                    <p style={{ fontSize: '0.875rem' }}>
                      Posts marcados com o indicador AI foram gerados ou revisados pela inteligência artificial do genOS.
                    </p>
                  </AILabelContent>
                </AILabel>
              </span>
            }
            description={`${filtered.length} posts | Workspace: ${tenant?.name || '—'}`}
            className="cf-table-container"
          >
            <TableToolbar {...getToolbarProps()}>
              <TableBatchActions {...batchActionProps}>
                <TableBatchAction
                  renderIcon={TrashCan}
                  onClick={() => {
                    const ids = selectedRows.map((r: any) => r.id);
                    if (ids.length > 0) setDeletePost(getPostById(ids[0]) || null);
                  }}
                >
                  Excluir ({selectedRows.length})
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
                  Enviar para Revisão
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
                  placeholder="Buscar posts..."
                  persistent
                />
                <Button
                  kind="tertiary"
                  size="sm"
                  renderIcon={Renew}
                  iconDescription="Atualizar"
                  hasIconOnly
                  onClick={fetchPosts}
                />
                <Button
                  kind="primary"
                  size="sm"
                  renderIcon={Add}
                  onClick={onNewPost}
                >
                  Novo Post
                </Button>
              </TableToolbarContent>
            </TableToolbar>

            <Table {...getTableProps()} size="lg" aria-label="Content Factory DataTable">
              <TableHead>
                <TableRow>
                  <TableExpandHeader aria-label="Expandir" />
                  <TableSelectAll {...getSelectionProps()} />
                  <th scope="col" />
                  {tableHeaders.map((header: any) => {
                    const { key, ...hProps } = getHeaderProps({ header });
                    return (
                      <TableHeader key={key} {...hProps} isSortable={header.key !== 'actions' && header.key !== 'media'}>
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
                      <TableDecoratorRow>
                      <TableExpandRow
                        {...((() => { const { key, ...rest } = getRowProps({ row }); return rest; })())}
                        key={row.id}
                        className={post?.ai_processing ? 'ai-glow-row' : ''}
                      >
                        <TableSelectRow {...getSelectionProps({ row })} />
                        <TableCell>
                          {post?.ai_processing ? (
                            <AILabel size="mini" align="bottom-left" />
                          ) : post?.ai_instructions ? (
                            <AILabel size="mini" align="bottom-left">
                              <AILabelContent>
                                <div style={{ padding: '1rem' }}>
                                  <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>AI-Enhanced Content</p>
                                  <p style={{ fontSize: '0.875rem', color: '#c6c6c6' }}>
                                    {post.ai_instructions?.substring(0, 100)}
                                    {(post.ai_instructions?.length || 0) > 100 ? '...' : ''}
                                  </p>
                                </div>
                              </AILabelContent>
                            </AILabel>
                          ) : null}
                        </TableCell>
                        {row.cells.map((cell: any) => {
                          let content: React.ReactNode = cell.value;

                          if (cell.info.header === 'status') {
                            const st = STATUS_MAP[cell.value] || { color: 'cool-gray', label: cell.value };
                            content = (
                              <span className="cf-ai-label-cell">
                                <Tag type={st.color as any} size="sm">{st.label}</Tag>
                                {post?.ai_processing && (
                                  <AILabel size="mini" autoAlign>
                                    <AILabelContent>
                                      <p style={{ fontSize: '0.875rem' }}>AI está processando este post...</p>
                                    </AILabelContent>
                                  </AILabel>
                                )}
                              </span>
                            );
                          } else if (cell.info.header === 'format') {
                            content = (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {FORMAT_ICON[cell.value] || null}
                                {FORMAT_LABEL[cell.value] || cell.value}
                              </span>
                            );
                          } else if (cell.info.header === 'media') {
                            const mediaList = mediaMap[row.id] || [];
                            if (mediaList.length > 0 && mediaList[0].wix_media_url) {
                              content = (
                                <img
                                  src={mediaList[0].wix_media_url}
                                  alt="thumb"
                                  style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
                                />
                              );
                            } else {
                              content = (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', opacity: 0.5 }}>
                                  <ImageIcon size={16} />
                                  {cell.value || 0}
                                </span>
                              );
                            }
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
                                onDelete={() => setDeletePost(post)}
                                onPreview={() => setPreviewPost(post)}
                              />
                            ) : null;
                          }

                          return <TableCell key={cell.id}>{content}</TableCell>;
                        })}
                      </TableExpandRow>
                      </TableDecoratorRow>

                      {/* Expanded Row — post detail + media + upload */}
                      <TableExpandedRow colSpan={headers.length + 2}>
                        <ExpandedContent
                          post={post!}
                          media={mediaMap[row.id] || []}
                          mediaRefMap={buildMediaRefMap(row.id)}
                          onUpload={(files) => handleUpload(row.id, files)}
                          isUploading={isUploading && uploadPostId === row.id}
                          isClient={isClient}
                          isAgencyOrMaster={isAgencyOrMaster}
                          canEditPost={post ? canEdit(post) : false}
                          onCardDataChange={(cards) => handleCardDataChange(row.id, cards)}
                          onRevise={() => { if (post) { setRevisePost(post); setReviseInstructions(''); } }}
                          onSubmitForReview={() => { if (post) handleSubmitForReview(post.id); }}
                          onApprove={() => { if (post) handleApprove(post.id); }}
                          onRequestRevision={() => { if (post) { setRevisionRequestPost(post); setRevisionComment(''); } }}
                          onPublish={() => { if (post) handlePublish(post.id); }}
                        />
                      </TableExpandedRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
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
      />

      {/* AI Revision Modal */}
      {revisePost && (
        <Modal
          open
          modalHeading={`Polir com IA: ${revisePost.title}`}
          primaryButtonText={isRevising ? 'Processando...' : 'Enviar para AI'}
          secondaryButtonText="Cancelar"
          onRequestClose={() => setRevisePost(null)}
          onRequestSubmit={handleAiRevise}
          primaryButtonDisabled={isRevising}
          size="md"
          slug={<AILabel autoAlign className="ai-modal-badge"><AILabelContent><div style={{ padding: '1rem' }}><p style={{ fontWeight: 600 }}>genOS AI Engine</p><p style={{ fontSize: '0.75rem', color: '#c6c6c6', marginTop: '0.25rem' }}>Conteúdo processado pelo pipeline de inteligência artificial da Cestari Studio.</p></div></AILabelContent></AILabel>}
        >
          <div style={{ paddingBottom: '1rem' }}>
            {revisePost.ai_instructions && (
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Instruções AI atuais:</p>
                <p style={{ backgroundColor: '#262626', padding: '1rem', borderRadius: 4, fontStyle: 'italic' }}>
                  {revisePost.ai_instructions}
                </p>
              </div>
            )}
            <TextArea
              id="revise-instructions"
              labelText="Instruções para a AI polir o conteúdo"
              placeholder="Ex: Altere o tom para mais formal, adicione call-to-action..."
              value={reviseInstructions}
              onChange={(e: any) => setReviseInstructions(e.target.value)}
              rows={4}
            />
            {isRevising && <InlineLoading description="AI processando revisão..." style={{ marginTop: '1rem' }} />}
          </div>
        </Modal>
      )}

      {/* Agency Revision Request Modal */}
      {revisionRequestPost && (
        <Modal
          open
          modalHeading={`Solicitar Revisão: ${revisionRequestPost.title}`}
          primaryButtonText="Enviar para Revisão"
          secondaryButtonText="Cancelar"
          onRequestClose={() => setRevisionRequestPost(null)}
          onRequestSubmit={handleRequestRevision}
          size="md"
        >
          <div style={{ paddingBottom: '1rem' }}>
            <p style={{ marginBottom: '1rem', color: '#c6c6c6' }}>
              O post voltará ao status <Tag type="red" size="sm">Revisão Solicitada</Tag> e o cliente poderá editá-lo.
            </p>
            <TextArea
              id="revision-comment"
              labelText="Comentário da revisão (será adicionado às instruções AI)"
              placeholder="Ex: O tom está muito informal, precisa de mais dados sobre o produto..."
              value={revisionComment}
              onChange={(e: any) => setRevisionComment(e.target.value)}
              rows={4}
            />
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deletePost && (
        <Modal
          open
          danger
          modalHeading="Confirmar exclusão"
          primaryButtonText="Excluir permanentemente"
          secondaryButtonText="Cancelar"
          onRequestClose={() => setDeletePost(null)}
          onRequestSubmit={handleDelete}
          size="xs"
        >
          <p>Tem certeza que deseja excluir <strong>{deletePost.title}</strong>? Esta ação não pode ser desfeita.</p>
        </Modal>
      )}

      {/* Post Preview Modal — full carousel + details */}
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
              <CarouselPreview
                format={previewPost.format}
                cardData={previewPost.card_data || []}
                mediaMap={buildMediaRefMap(previewPost.id)}
                maxWidth={360}
              />
            </div>
            <div style={{ flex: 1, minWidth: '16rem' }}>
              <Stack gap={4}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Tag type={(STATUS_MAP[previewPost.status]?.color || 'cool-gray') as any} size="sm">
                    {STATUS_MAP[previewPost.status]?.label || previewPost.status}
                  </Tag>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--cds-text-helper)' }}>
                    {FORMAT_ICON[previewPost.format]}
                    {FORMAT_LABEL[previewPost.format] || previewPost.format}
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
                {previewPost.scheduled_date && (
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>DATA AGENDADA</p>
                    <p style={{ fontSize: '0.875rem' }}>{new Date(previewPost.scheduled_date).toLocaleDateString('pt-BR')}</p>
                  </div>
                )}
                {previewPost.ai_instructions && (
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>
                      {previewPost.ai_instructions.startsWith('[REVISÃO AGENCY]') ? 'COMENTÁRIO DA AGENCY' : 'AI INSTRUCTIONS'}
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
              </Stack>
            </div>
          </div>
        </Modal>
      )}
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
}) {
  if (post.ai_processing) {
    return <InlineLoading description="AI..." style={{ minHeight: 0 }} />;
  }

  return (
    <OverflowMenu size="sm" flipped aria-label="Ações" iconDescription="Ações">
      {/* ─── Preview — available for ALL users ─── */}
      <OverflowMenuItem itemText="Visualizar" onClick={onPreview} />

      {/* ─── Client actions ─── */}
      {isClient && post.status === 'draft' && (
        <OverflowMenuItem itemText="Enviar para Revisão" onClick={onSubmitForReview} />
      )}
      {isClient && post.status === 'revision_requested' && (
        <OverflowMenuItem itemText="Reenviar para Revisão" onClick={onSubmitForReview} />
      )}
      {isClient && (post.status === 'draft' || post.status === 'revision_requested') && (
        <OverflowMenuItem itemText="Polir com AI" onClick={onReviseAi} />
      )}

      {/* ─── Agency/Master actions ─── */}
      {isAgencyOrMaster && post.status === 'pending_review' && (
        <OverflowMenuItem itemText="✓ Aprovar" onClick={onApprove} />
      )}
      {isAgencyOrMaster && post.status === 'pending_review' && (
        <OverflowMenuItem itemText="↩ Pedir Revisão" onClick={onRequestRevision} />
      )}
      {isAgencyOrMaster && post.status === 'approved' && (
        <OverflowMenuItem itemText="🚀 Publicar" onClick={onPublish} />
      )}
      {isAgencyOrMaster && (
        <OverflowMenuItem itemText="Polir com AI" onClick={onReviseAi} />
      )}

      {/* ─── Common actions ─── */}
      {canEditPost && (
        <OverflowMenuItem itemText="Editar" onClick={() => console.log('edit', post.id)} />
      )}
      {(isAgencyOrMaster || post.status === 'draft') && (
        <OverflowMenuItem hasDivider isDelete itemText="Excluir" onClick={onDelete} />
      )}
    </OverflowMenu>
  );
}

// ─── Expanded Content Sub-component ─────────────────────────────────────────
function ExpandedContent({
  post,
  media,
  mediaRefMap,
  onUpload,
  isUploading,
  isClient,
  isAgencyOrMaster,
  canEditPost,
  onCardDataChange,
  onRevise,
  onSubmitForReview,
  onApprove,
  onRequestRevision,
  onPublish,
}: {
  post: Post;
  media: PostMedia[];
  mediaRefMap: Record<string, { url: string; fileName: string }>;
  onUpload: (files: File[]) => void;
  isUploading: boolean;
  isClient: boolean;
  isAgencyOrMaster: boolean;
  canEditPost: boolean;
  onCardDataChange: (cards: CardSlide[]) => void;
  onRevise: () => void;
  onSubmitForReview: () => void;
  onApprove: () => void;
  onRequestRevision: () => void;
  onPublish: () => void;
}) {
  if (!post) return null;

  const [showEditor, setShowEditor] = useState(false);

  return (
    <div style={{ display: 'flex', gap: '1.5rem', padding: '1rem', backgroundColor: 'var(--cds-layer-01, #262626)' }}>
      {/* Left Column: CarouselPreview + Media thumbnails */}
      <div style={{ flex: '0 0 auto' }}>
        <CarouselPreview
          format={post.format}
          cardData={post.card_data || []}
          mediaMap={mediaRefMap}
          maxWidth={280}
        />

        {/* Media thumbnails */}
        {media.length > 0 && (
          <div style={{ marginTop: '0.75rem' }}>
            <p style={{ fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.5rem' }}>
              MÍDIA ({media.length}/{post.media_slots})
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {media.map(m => (
                <div key={m.id} style={{ width: 56, height: 56, borderRadius: 4, overflow: 'hidden', backgroundColor: '#393939', position: 'relative' }}>
                  {m.wix_media_url ? (
                    <img src={m.wix_media_url} alt={m.file_name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.4 }}>
                      <ImageIcon size={20} />
                    </div>
                  )}
                  <Tag
                    type={m.status === 'approved' ? 'green' : m.status === 'uploaded' ? 'blue' : 'cool-gray'}
                    size="sm"
                    style={{ position: 'absolute', bottom: 0, left: 0, fontSize: '0.6rem', padding: '0 0.25rem' }}
                  >
                    {m.position}
                  </Tag>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Details + CardDataEditor + Actions */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Stack gap={4}>
          {/* AI Processing Banner */}
          {post.ai_processing && (
            <div style={{
              backgroundColor: '#1e3a5f',
              padding: '0.75rem 1rem',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}>
              <InlineLoading description="AI está processando este post..." />
            </div>
          )}

          {post.description && (
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>DESCRIÇÃO</p>
              <p style={{ fontSize: '0.875rem' }}>{post.description}</p>
            </div>
          )}

          {post.hashtags && (
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>HASHTAGS</p>
              <p style={{ fontSize: '0.875rem', color: '#78a9ff' }}>{post.hashtags}</p>
            </div>
          )}

          {post.cta && (
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>CTA</p>
              <p style={{ fontSize: '0.875rem' }}>{post.cta}</p>
            </div>
          )}

          {post.ai_instructions && (
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>
                {post.ai_instructions.startsWith('[REVISÃO AGENCY]') ? 'COMENTÁRIO DA AGENCY' : 'AI INSTRUCTIONS'}
              </p>
              <p style={{
                fontSize: '0.875rem',
                fontStyle: 'italic',
                backgroundColor: post.ai_instructions.startsWith('[REVISÃO AGENCY]') ? '#3a1d1d' : '#393939',
                padding: '0.75rem',
                borderRadius: 4,
                borderLeft: post.ai_instructions.startsWith('[REVISÃO AGENCY]') ? '3px solid #da1e28' : 'none',
              }}>
                {post.ai_instructions}
              </p>
            </div>
          )}

          {/* Card Data Editor (toggle) */}
          <div>
            <Button
              kind="ghost"
              size="sm"
              onClick={() => setShowEditor(!showEditor)}
              style={{ marginBottom: showEditor ? '0.5rem' : 0 }}
            >
              {showEditor ? '▾ Fechar Editor de Slides' : '▸ Editar Slides (card_data)'}
            </Button>
            {showEditor && (
              <CardDataEditor
                format={post.format}
                cardData={post.card_data || []}
                onChange={onCardDataChange}
                mediaMap={mediaRefMap}
                disabled={!canEditPost || post.ai_processing}
              />
            )}
          </div>

          {/* Upload area — only if user can edit */}
          {canEditPost && !post.ai_processing && (
            <div style={{ marginTop: '0.5rem' }}>
              <FileUploader
                accept={['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov']}
                buttonLabel={isUploading ? 'Enviando...' : 'Upload Mídia'}
                buttonKind="tertiary"
                size="sm"
                filenameStatus="edit"
                iconDescription="Remover arquivo"
                labelDescription={`Posição ${(media.length || 0) + 1} de ${post.media_slots}`}
                labelTitle="Enviar para Wix Media Manager"
                multiple={post.format === 'carrossel'}
                onChange={(e: any) => {
                  const files = e.target?.files;
                  if (files) onUpload(Array.from(files));
                }}
                disabled={isUploading || media.length >= post.media_slots}
              />
            </div>
          )}

          {/* Workflow Action Buttons */}
          {!post.ai_processing && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
              {isClient && (post.status === 'draft' || post.status === 'revision_requested') && (
                <Button kind="secondary" size="sm" renderIcon={MagicWandFilled} onClick={onRevise}>
                  Polir com AI
                </Button>
              )}
              {isClient && post.status === 'draft' && (
                <Button kind="primary" size="sm" renderIcon={SendFilled} onClick={onSubmitForReview}>
                  Enviar para Revisão
                </Button>
              )}
              {isClient && post.status === 'revision_requested' && (
                <Button kind="primary" size="sm" renderIcon={SendFilled} onClick={onSubmitForReview}>
                  Reenviar para Revisão
                </Button>
              )}
              {isAgencyOrMaster && (
                <Button kind="secondary" size="sm" renderIcon={MagicWandFilled} onClick={onRevise}>
                  Polir com AI
                </Button>
              )}
              {isAgencyOrMaster && post.status === 'pending_review' && (
                <Button kind="primary" size="sm" renderIcon={CheckmarkFilled} onClick={onApprove}>
                  Aprovar
                </Button>
              )}
              {isAgencyOrMaster && post.status === 'pending_review' && (
                <Button kind="danger--tertiary" size="sm" renderIcon={Undo} onClick={onRequestRevision}>
                  Pedir Revisão
                </Button>
              )}
              {isAgencyOrMaster && post.status === 'approved' && (
                <Button kind="primary" size="sm" renderIcon={Checkmark} onClick={onPublish}>
                  Publicar
                </Button>
              )}
            </div>
          )}
        </Stack>
      </div>
    </div>
  );
}
