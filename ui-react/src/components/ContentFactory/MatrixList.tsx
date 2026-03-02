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
  MultiSelect,
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
  WatsonHealthDna,
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
  onRefreshRef?: React.MutableRefObject<(() => void) | null>;
}

export default function MatrixList({ onNewPost, onRefreshRef }: MatrixListProps) {
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

  // Filter
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [formatFilter, setFormatFilter] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);

  // DNA Brand modal
  const [showDnaModal, setShowDnaModal] = useState(false);
  const [brandDna, setBrandDna] = useState<any>(null);
  const [loadingDna, setLoadingDna] = useState(false);

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

  // Expose fetchPosts to parent via ref so it can trigger refresh after creating a post
  useEffect(() => {
    if (onRefreshRef) onRefreshRef.current = fetchPosts;
    return () => { if (onRefreshRef) onRefreshRef.current = null; };
  }, [onRefreshRef, fetchPosts]);

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
      FORMAT_LABEL[p.format] || p.format,
      STATUS_MAP[p.status]?.label || p.status,
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
    showToast('CSV exportado', `${filtered.length} posts exportados.`, 'success');
  };

  // ─── Fetch Brand DNA (separate table) ──────────────────────────────────────
  const fetchBrandDna = useCallback(async () => {
    if (!tenant?.id) return;
    setLoadingDna(true);
    try {
      const { data, error } = await supabase
        .from('brand_dna')
        .select('*')
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      if (error) throw error;
      setBrandDna(data);
    } catch (err) {
      console.error('Error fetching brand DNA:', err);
    } finally {
      setLoadingDna(false);
    }
  }, [tenant?.id]);

  const openDnaModal = () => {
    fetchBrandDna();
    setShowDnaModal(true);
  };

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
                <TableToolbarMenu renderIcon={Settings} iconDescription="Ajustes">
                  <OverflowMenuItem itemText="Exportar CSV" onClick={handleExportCSV} />
                  <OverflowMenuItem itemText="DNA da Marca" onClick={openDnaModal} />
                  <OverflowMenuItem itemText="Atualizar tabela" onClick={fetchPosts} />
                </TableToolbarMenu>
                <Button kind="primary" size="sm" renderIcon={Add} onClick={onNewPost}>
                  Novo Post
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
                  items={Object.entries(STATUS_MAP).map(([k, v]) => ({ id: k, text: v.label }))}
                  itemToString={(item: any) => item?.text || ''}
                  selectedItems={statusFilter.map(k => ({ id: k, text: STATUS_MAP[k]?.label || k }))}
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
                  items={Object.entries(FORMAT_LABEL).map(([k, v]) => ({ id: k, text: v }))}
                  itemToString={(item: any) => item?.text || ''}
                  selectedItems={formatFilter.map(k => ({ id: k, text: FORMAT_LABEL[k] || k }))}
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
                                  <InlineLoading description="AI processando..." />
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
                                disabled={post.ai_processing}
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
        >
          <div style={{ paddingBottom: '1rem' }}>
            <AILabel autoAlign size="mini" className="ai-modal-badge">
              <AILabelContent>
                <div style={{ padding: '1rem' }}>
                  <p style={{ fontWeight: 600 }}>genOS AI Engine</p>
                  <p style={{ fontSize: '0.75rem', color: '#c6c6c6', marginTop: '0.25rem' }}>
                    Conteúdo processado pelo pipeline de inteligência artificial da Cestari Studio.
                  </p>
                </div>
              </AILabelContent>
            </AILabel>
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

      {/* ─── DNA da Marca Modal ──────────────────────────────────────────────── */}
      {showDnaModal && (
        <Modal
          open
          passiveModal
          modalHeading="DNA da Marca"
          onRequestClose={() => setShowDnaModal(false)}
          size="md"
        >
          <div style={{ paddingBlockEnd: '1rem' }}>
            <AILabel autoAlign size="mini" className="ai-modal-badge">
              <AILabelContent>
                <div style={{ padding: '1rem' }}>
                  <p style={{ fontWeight: 600 }}>genOS AI Engine</p>
                  <p style={{ fontSize: '0.75rem', color: '#c6c6c6', marginTop: '0.25rem' }}>
                    DNA configurado pelo workspace ativo.
                  </p>
                </div>
              </AILabelContent>
            </AILabel>

            {loadingDna ? (
              <InlineLoading description="Carregando DNA da marca..." />
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
                    Nenhum DNA da marca configurado para este workspace. Configure nas opções do tenant.
                  </p>
                )}
              </Stack>
            ) : (
              <p style={{ color: '#a8a8a8' }}>Nenhum workspace selecionado.</p>
            )}
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
