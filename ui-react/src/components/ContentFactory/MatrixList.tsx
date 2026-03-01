// genOS Lumina — Content Factory MatrixList (DataTable completo)
import React, { useState, useEffect, useCallback } from 'react';
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
  Button,
  Tag,
  AILabel,
  AILabelContent,
  InlineLoading,
  OverflowMenu,
  OverflowMenuItem,
  FileUploader,
  Modal,
  TextArea,
  Pagination,
  Tile,
  Stack,
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
  Edit,
  TrashCan,
  Upload,
  MagicWandFilled,
} from '@carbon/icons-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase';
import { api } from '../../services/api';

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
  onNewPost: () => void;
}

export default function MatrixList({ onNewPost }: MatrixListProps) {
  const { me: { tenant } } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [mediaMap, setMediaMap] = useState<Record<string, PostMedia[]>>({});
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');

  // AI revision modal
  const [revisePost, setRevisePost] = useState<Post | null>(null);
  const [reviseInstructions, setReviseInstructions] = useState('');
  const [isRevising, setIsRevising] = useState(false);

  // Upload state
  const [uploadPostId, setUploadPostId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Delete confirmation
  const [deletePost, setDeletePost] = useState<Post | null>(null);

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

  // ─── Actions ──────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deletePost) return;
    try {
      await supabase.from('post_media').delete().eq('post_id', deletePost.id);
      await supabase.from('posts').delete().eq('id', deletePost.id);
      setDeletePost(null);
      fetchPosts();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

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
      setRevisePost(null);
      setReviseInstructions('');
      fetchPosts();
    } catch (err) {
      console.error('AI revision failed:', err);
    } finally {
      setIsRevising(false);
    }
  };

  const handleUpload = async (postId: string, files: FileList | File[]) => {
    if (!files || files.length === 0 || !tenant?.id) return;
    setIsUploading(true);
    setUploadPostId(postId);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Upload via Wix Media Manager Edge Function
        const result: any = await api.edgeFn('wix-media-upload', {
          tenantId: tenant.id,
          postId,
          fileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          // File data is sent as base64
          fileData: await fileToBase64(file),
        });

        if (result?.mediaId) {
          // Save post_media record
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
      fetchPosts();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
      setUploadPostId(null);
    }
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
      <DataTable rows={rows} headers={headers}>
        {({
          rows: tableRows,
          headers: tableHeaders,
          getHeaderProps,
          getRowProps,
          getTableProps,
          getToolbarProps,
          onInputChange,
        }: any) => (
          <TableContainer
            title="Content Factory"
            description={`${filtered.length} posts | Workspace: ${tenant?.name || '—'}`}
          >
            <TableToolbar {...getToolbarProps()}>
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

            <Table {...getTableProps()} size="md">
              <TableHead>
                <TableRow>
                  <TableExpandHeader />
                  {tableHeaders.map((header: any) => {
                    const { key, ...hProps } = getHeaderProps({ header });
                    return (
                      <TableHeader key={key} {...hProps}>
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
                        {row.cells.map((cell: any) => {
                          let content: React.ReactNode = cell.value;

                          if (cell.info.header === 'status') {
                            const st = STATUS_MAP[cell.value] || { color: 'cool-gray', label: cell.value };
                            content = <Tag type={st.color as any} size="sm">{st.label}</Tag>;
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
                            content = (
                              <OverflowMenu size="sm" flipped aria-label="Ações" iconDescription="Ações">
                                <OverflowMenuItem
                                  itemText="Editar"
                                  onClick={() => console.log('edit', row.id)}
                                />
                                <OverflowMenuItem
                                  itemText="Preview"
                                  onClick={() => console.log('preview', row.id)}
                                />
                                <OverflowMenuItem
                                  itemText="Revisar com AI"
                                  onClick={() => {
                                    if (post) { setRevisePost(post); setReviseInstructions(''); }
                                  }}
                                />
                                <OverflowMenuItem
                                  hasDivider
                                  isDelete
                                  itemText="Excluir"
                                  onClick={() => { if (post) setDeletePost(post); }}
                                />
                              </OverflowMenu>
                            );
                          }

                          return <TableCell key={cell.id}>{content}</TableCell>;
                        })}
                      </TableExpandRow>

                      {/* Expanded Row — post detail + media + upload */}
                      <TableExpandedRow colSpan={headers.length + 1}>
                        <ExpandedContent
                          post={post!}
                          media={mediaMap[row.id] || []}
                          onUpload={(files) => handleUpload(row.id, files)}
                          isUploading={isUploading && uploadPostId === row.id}
                          onRevise={() => { if (post) { setRevisePost(post); setReviseInstructions(''); } }}
                        />
                      </TableExpandedRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
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
          modalHeading={`Revisar com IA: ${revisePost.title}`}
          primaryButtonText={isRevising ? 'Processando...' : 'Enviar para AI'}
          secondaryButtonText="Cancelar"
          onRequestClose={() => setRevisePost(null)}
          onRequestSubmit={handleAiRevise}
          primaryButtonDisabled={isRevising}
          size="md"
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
              labelText="Novas instruções para revisão"
              placeholder="Ex: Altere o tom para mais formal, adicione call-to-action..."
              value={reviseInstructions}
              onChange={(e: any) => setReviseInstructions(e.target.value)}
              rows={4}
            />
            {isRevising && <InlineLoading description="AI processando revisão..." style={{ marginTop: '1rem' }} />}
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
    </>
  );
}

// ─── Expanded Content Sub-component ─────────────────────────────────────────
function ExpandedContent({
  post,
  media,
  onUpload,
  isUploading,
  onRevise,
}: {
  post: Post;
  media: PostMedia[];
  onUpload: (files: File[]) => void;
  isUploading: boolean;
  onRevise: () => void;
}) {
  if (!post) return null;

  return (
    <div style={{ display: 'flex', gap: '1.5rem', padding: '1rem', backgroundColor: 'var(--cds-layer-01, #262626)' }}>
      {/* Card Preview */}
      <div style={{ flex: '0 0 320px' }}>
        <Tile style={{ backgroundColor: '#1e1e1e', padding: 0, overflow: 'hidden' }}>
          {(post.card_data || []).length > 0 ? (
            <div style={{ padding: '1rem' }}>
              <p style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.75rem', color: '#8d8d8d' }}>
                SLIDES ({post.card_data.length})
              </p>
              <Stack gap={3}>
                {post.card_data.slice(0, 3).map((slide: any, i: number) => (
                  <div key={i} style={{ padding: '0.75rem', backgroundColor: '#393939', borderRadius: 4 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{slide.headline || `Slide ${i + 1}`}</p>
                    <p style={{ fontSize: '0.75rem', color: '#c6c6c6', marginTop: '0.25rem' }}>
                      {(slide.body || '').substring(0, 80)}{(slide.body || '').length > 80 ? '...' : ''}
                    </p>
                  </div>
                ))}
                {post.card_data.length > 3 && (
                  <p style={{ fontSize: '0.75rem', color: '#8d8d8d' }}>+ {post.card_data.length - 3} slides</p>
                )}
              </Stack>
            </div>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
              <View size={32} />
              <p style={{ marginTop: '0.5rem' }}>Sem card_data</p>
            </div>
          )}
        </Tile>

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

      {/* Details + Actions */}
      <div style={{ flex: 1 }}>
        <Stack gap={4}>
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
              <p style={{ fontWeight: 600, fontSize: '0.75rem', color: '#8d8d8d', marginBottom: '0.25rem' }}>AI INSTRUCTIONS</p>
              <p style={{ fontSize: '0.875rem', fontStyle: 'italic', backgroundColor: '#393939', padding: '0.75rem', borderRadius: 4 }}>
                {post.ai_instructions}
              </p>
            </div>
          )}

          {/* Upload area */}
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

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Button kind="secondary" size="sm" renderIcon={MagicWandFilled} onClick={onRevise}>
              Revisar com AI
            </Button>
            {post.status === 'approved' && (
              <Button kind="primary" size="sm" renderIcon={Checkmark}>
                Publicar
              </Button>
            )}
          </div>
        </Stack>
      </div>
    </div>
  );
}
