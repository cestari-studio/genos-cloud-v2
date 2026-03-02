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
} from '@carbon/icons-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { api } from '../../services/api';
import { useNotifications } from '../NotificationProvider';
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
  { key: 'title',          header: 'Título' },
  { key: 'format',         header: 'Formato' },
  { key: 'status',         header: 'Status' },
  { key: 'scheduled_date', header: 'Data Agendada' },
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

  // Agency revision request modal
  const [revisionRequestPost, setRevisionRequestPost] = useState<Post | null>(null);
  const [revisionComment, setRevisionComment] = useState('');

  // Delete confirmation
  const [deletePost, setDeletePost] = useState<Post | null>(null);

  // Preview modal
  const [previewPost, setPreviewPost] = useState<Post | null>(null);

  // AI polling
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Data loading ─────────────────────────────────────────────────────────
  const fetchPosts = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const result: any = await api.edgeFn('list-posts', { tenant_id: tenant.id });
      if (!result?.success) throw new Error(result?.error || 'Falha ao buscar posts');

      const postList = (result.posts || []) as (Post & { post_media: PostMedia[] })[];
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
      pollingRef.current = setInterval(() => fetchPosts(), 3000);
    }
    if (!hasProcessing && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
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
    title: post.title,
    format: post.format,
    status: post.status,
    scheduled_date: post.scheduled_date
      ? new Date(post.scheduled_date).toLocaleDateString('pt-BR')
      : '—',
    actions: '',
  }));

  // ─── Status Transition ──────────────────────────────────────────────────────
  const updateStatus = async (postId: string, newStatus: Post['status'], extraFields?: Record<string, unknown>) => {
    try {
      const update: Record<string, unknown> = { status: newStatus, ...extraFields };
      if (newStatus === 'published') update.published_at = new Date().toISOString();
      const { error } = await supabase.from('posts').update(update).eq('id', postId);
      if (error) throw error;
      showToast('Status atualizado', `Post movido para: ${STATUS_MAP[newStatus]?.label || newStatus}`, 'success');
      fetchPosts();
    } catch (err: any) {
      showToast('Erro ao atualizar status', String(err.message || err), 'error');
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

  // ─── AI Label for Full Table (decorator prop) ────────────────────────────────
  const tableDecorator = (
    <AILabel autoAlign size="mini">
      <AILabelContent>
        <div style={{ padding: '1rem' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>genOS AI Engine</p>
          <p style={{ fontSize: '0.875rem', color: '#c6c6c6' }}>
            Todo o conteúdo desta tabela é gerado e gerenciado pela inteligência artificial do genOS,
            com base no DNA da marca configurado no workspace.
          </p>
        </div>
      </AILabelContent>
    </AILabel>
  );

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
      {/* ─── DataTable — AI Full Table ─────────────────────────────────────── */}
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
            title="Content Factory"
            description={`${filtered.length} posts | Workspace: ${tenant?.name || '—'}`}
            className="cf-table-container"
            decorator={tableDecorator}
            aiEnabled
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
                <Button kind="ghost" size="sm" renderIcon={Renew} iconDescription="Atualizar" hasIconOnly onClick={fetchPosts} />
                <Button kind="primary" size="sm" renderIcon={Add} onClick={onNewPost}>
                  Novo Post
                </Button>
              </TableToolbarContent>
            </TableToolbar>

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
                            const st = STATUS_MAP[cell.value] || { color: 'cool-gray', label: cell.value };
                            content = (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Tag type={st.color as any} size="sm">{st.label}</Tag>
                                {post?.ai_processing && <InlineLoading description="" style={{ minHeight: 0 }} />}
                              </span>
                            );
                          } else if (cell.info.header === 'format') {
                            content = (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {FORMAT_ICON[cell.value] || null}
                                {FORMAT_LABEL[cell.value] || cell.value}
                              </span>
                            );
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

                      {/* Expanded Row — cover image + Visualizar + Regenerar textos */}
                      <TableExpandedRow colSpan={headers.length + 2}>
                        {post && (
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
                                <InlineLoading description="AI processando..." />
                              )}
                            </div>

                            {/* Action buttons */}
                            <div className="cf-expanded-actions">
                              <Button
                                kind="tertiary"
                                size="sm"
                                renderIcon={View}
                                onClick={() => setPreviewPost(post)}
                              >
                                Visualizar
                              </Button>
                              <Button
                                kind="secondary"
                                size="sm"
                                renderIcon={MagicWandFilled}
                                disabled={post.ai_processing}
                                onClick={() => { setRevisePost(post); setReviseInstructions(''); }}
                              >
                                Regenerar textos
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

      {/* ─── AI Revision Modal ───────────────────────────────────────────────── */}
      {revisePost && (
        <Modal
          open
          modalHeading={`Regenerar textos: ${revisePost.title}`}
          primaryButtonText={isRevising ? 'Processando...' : 'Enviar para AI'}
          secondaryButtonText="Cancelar"
          onRequestClose={() => setRevisePost(null)}
          onRequestSubmit={handleAiRevise}
          primaryButtonDisabled={isRevising}
          size="md"
          slug={
            <AILabel autoAlign className="ai-modal-badge">
              <AILabelContent>
                <div style={{ padding: '1rem' }}>
                  <p style={{ fontWeight: 600 }}>genOS AI Engine</p>
                  <p style={{ fontSize: '0.75rem', color: '#c6c6c6', marginTop: '0.25rem' }}>
                    Conteúdo processado pelo pipeline de inteligência artificial da Cestari Studio.
                  </p>
                </div>
              </AILabelContent>
            </AILabel>
          }
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
              labelText="Instruções para a AI regenerar o conteúdo"
              placeholder="Ex: Altere o tom para mais formal, adicione call-to-action..."
              value={reviseInstructions}
              onChange={(e: any) => setReviseInstructions(e.target.value)}
              rows={4}
            />
            {isRevising && <InlineLoading description="AI processando revisão..." style={{ marginTop: '1rem' }} />}
          </div>
        </Modal>
      )}

      {/* ─── Agency Revision Request Modal ───────────────────────────────────── */}
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

      {/* ─── Delete Confirmation Modal ───────────────────────────────────────── */}
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

      {/* ─── Post Preview Modal — full details ───────────────────────────────── */}
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
                {/* Card data info */}
                {previewPost.card_data && previewPost.card_data.length > 0 && (
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>
                      SLIDES ({previewPost.card_data.length})
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
                            Slide {card.position || idx + 1}
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
      <OverflowMenuItem itemText="Visualizar" onClick={onPreview} />

      {isClient && post.status === 'draft' && (
        <OverflowMenuItem itemText="Enviar para Revisão" onClick={onSubmitForReview} />
      )}
      {isClient && post.status === 'revision_requested' && (
        <OverflowMenuItem itemText="Reenviar para Revisão" onClick={onSubmitForReview} />
      )}
      {isClient && (post.status === 'draft' || post.status === 'revision_requested') && (
        <OverflowMenuItem itemText="Regenerar textos" onClick={onReviseAi} />
      )}

      {isAgencyOrMaster && post.status === 'pending_review' && (
        <OverflowMenuItem itemText="Aprovar" onClick={onApprove} />
      )}
      {isAgencyOrMaster && post.status === 'pending_review' && (
        <OverflowMenuItem itemText="Pedir Revisão" onClick={onRequestRevision} />
      )}
      {isAgencyOrMaster && post.status === 'approved' && (
        <OverflowMenuItem itemText="Publicar" onClick={onPublish} />
      )}
      {isAgencyOrMaster && (
        <OverflowMenuItem itemText="Regenerar textos" onClick={onReviseAi} />
      )}

      {(isAgencyOrMaster || post.status === 'draft') && (
        <OverflowMenuItem hasDivider isDelete itemText="Excluir" onClick={onDelete} />
      )}
    </OverflowMenu>
  );
}
