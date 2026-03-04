import React, { useState } from 'react';
import {
    ComposedModal, ModalHeader, ModalBody, ModalFooter,
    FileUploaderDropContainer, FileUploaderItem,
    Button, Tag, Stack, InlineNotification,
    AILabel, AILabelContent
} from '@carbon/react';
import { ArrowRight } from '@carbon/icons-react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface UploadingFile {
    id: string; // UUID temporário
    file: File;
    progress: number; // 0-100
    status: 'uploading' | 'complete' | 'error';
    mediaId?: string; // ID do post_media após upload
    thumbnail?: string; // blob URL para preview
    error?: string;
}

interface MediaUploadModalProps {
    open: boolean;
    onClose: () => void;
    post: any; // { id, format, card_data, tenant_id, scheduled_date }
    onUploadComplete: (uploadedMedia: any[]) => void;
}

const FORMAT_LIMITS: Record<string, { maxFiles: number; acceptVideo: boolean; acceptImage: boolean }> = {
    feed: { maxFiles: 1, acceptVideo: true, acceptImage: true },
    carrossel: { maxFiles: 10, acceptVideo: true, acceptImage: true },
    stories: { maxFiles: 10, acceptVideo: true, acceptImage: true },
    reels: { maxFiles: 1, acceptVideo: true, acceptImage: false }
};

export default function MediaUploadModal({ open, onClose, post, onUploadComplete }: MediaUploadModalProps) {
    const { me } = useAuth();
    const [files, setFiles] = useState<UploadingFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    if (!post || !post.format) return null;

    const limits = FORMAT_LIMITS[post.format] || FORMAT_LIMITS.feed;
    const accept = [
        ...(limits.acceptImage ? ['.jpg', '.jpeg', '.png', '.webp', '.heic'] : []),
        ...(limits.acceptVideo ? ['.mp4', '.mov'] : [])
    ];

    const handleAddFiles = async (addedFiles: File[]) => {
        if (files.length + addedFiles.length > limits.maxFiles) {
            setErrors(prev => [...prev, `Você ultrapassou o limite de ${limits.maxFiles} mídias para o formato atual.`]);
            return;
        }

        const newFiles: UploadingFile[] = [];
        const validAddedFiles: File[] = [];

        for (const f of addedFiles) {
            if (f.size > 50 * 1024 * 1024) {
                setErrors(prev => [...prev, `O arquivo ${f.name} excede 50MB.`]);
            } else {
                // For a real check, we should strictly match MIME but extensions natively bind correctly in browser drops
                validAddedFiles.push(f);
            }
        }

        if (validAddedFiles.length === 0) return;

        setUploading(true);

        const uploads = validAddedFiles.map((file) => {
            const tempId = crypto.randomUUID();
            const uploadingFile: UploadingFile = {
                id: tempId,
                file,
                progress: 0,
                status: 'uploading',
                thumbnail: file.type.startsWith('image') ? URL.createObjectURL(file) : undefined
            };
            newFiles.push(uploadingFile);
            return uploadingFile;
        });

        setFiles(prev => [...prev, ...newFiles]);

        // Process parallel uploads respecting Edge Function
        await Promise.all(uploads.map(async (uf) => {
            try {
                const formData = new FormData();
                formData.append('action', 'upload');
                formData.append('file', uf.file);
                formData.append('post_id', post.id);
                formData.append('tenant_id', post.tenant_id);

                const res = await api.edgeFn('media-manager', formData); // assuming edgeFn handles FormData correctly implicitly if modified or we parse it
                const data = (res as any).data || res;

                setFiles(current => current.map(c =>
                    c.id === uf.id ? { ...c, status: 'complete', progress: 100, mediaId: data.media?.id } : c
                ));
            } catch (err: any) {
                setFiles(current => current.map(c =>
                    c.id === uf.id ? { ...c, status: 'error', error: err.message || 'Falha no upload' } : c
                ));
            }
        }));

        setUploading(false);
    };

    const handleRemoveFile = async (id: string) => {
        const target = files.find(f => f.id === id);
        if (target?.mediaId) {
            // Tell edge to natively drop it from DB and bucker
            try {
                await api.edgeFn('media-manager', { action: 'delete', media_id: target.mediaId, post_id: post.id });
            } catch (err) {
                console.error('Failed to remove physically', err);
            }
        }
        setFiles(prev => prev.filter(f => f.id !== id));
    };

    const handleNext = async () => {
        const completed = files.filter(f => f.status === 'complete');
        if (completed.length === 0) return;

        const mappedMedia = completed.map(c => ({
            mediaId: c.mediaId,
            originalName: c.file.name,
            type: c.file.type.startsWith('video') ? 'video' : 'image',
            fileSize: c.file.size,
            thumbnailUrl: c.thumbnail
        }));

        if (post.format === 'feed' || post.format === 'reels') {
            const assignments = [{ media_id: mappedMedia[0].mediaId, position: 1 }];
            setUploading(true);
            try {
                await api.edgeFn('media-manager', { action: 'assign', post_id: post.id, tenant_id: post.tenant_id, assignments });
                onUploadComplete(mappedMedia); // which triggers refresh logic
                onClose();
            } catch (err: any) {
                setErrors([err.message || 'Falha na validação final']);
            } finally {
                setUploading(false);
            }
        } else {
            onUploadComplete(mappedMedia);
        }
    };

    return (
        <ComposedModal open={open} onClose={onClose} size="lg">
            <ModalHeader>
                <Stack orientation="horizontal" gap={3 as any}>
                    <h3 className="cds--type-heading-compact-02">Upload de Mídias</h3>
                    <AILabel kind="inline">
                        <AILabelContent>
                            <h5>IA EXPLAINED</h5>
                            <p>Faça upload das mídias (imagens e vídeos) que serão vinculadas a este post. O sistema renomeia automaticamente cada arquivo seguindo a nomenclatura padrão: TenantName-Data-PostID-Sequência.</p>
                        </AILabelContent>
                    </AILabel>
                </Stack>
            </ModalHeader>

            <ModalBody>
                <Stack gap={5 as any}>
                    <Stack orientation="horizontal" gap={3 as any}>
                        <Tag type="blue">{post.format}</Tag>
                        <Tag type="gray">
                            {post.format === 'carrossel' || post.format === 'stories'
                                ? `Até ${limits.maxFiles} mídias · ${post.card_data?.length || 0} cards`
                                : `1 mídia`}
                        </Tag>
                        <Tag type={files.filter(f => f.status === 'complete').length === limits.maxFiles ? 'green' : 'cool-gray'}>
                            {files.filter(f => f.status === 'complete').length} / {limits.maxFiles} enviados
                        </Tag>
                    </Stack>

                    <FileUploaderDropContainer
                        accept={accept}
                        labelText={`Arraste arquivos aqui ou clique para buscar (máx. ${limits.maxFiles} arquivos, 50MB cada)`}
                        multiple={limits.maxFiles > 1}
                        onAddFiles={(evt, { addedFiles }) => handleAddFiles(addedFiles)}
                        disabled={uploading || files.filter(f => f.status !== 'error').length >= limits.maxFiles}
                    />

                    {files.map(f => (
                        <FileUploaderItem
                            key={f.id}
                            name={f.file.name}
                            status={f.status === 'complete' ? 'complete' : f.status === 'error' ? 'edit' : 'uploading'}
                            iconDescription={f.status === 'error' ? 'Erro' : 'Remover'}
                            onDelete={() => handleRemoveFile(f.id)}
                            invalid={f.status === 'error'}
                            errorSubject={f.error}
                        />
                    ))}

                    {errors.map((err, i) => (
                        <InlineNotification
                            key={i}
                            kind="error"
                            subtitle={err}
                            lowContrast
                            hideCloseButton={false}
                            onCloseButtonClick={() => setErrors(prev => prev.filter((_, idx) => idx !== i))}
                        />
                    ))}
                </Stack>
            </ModalBody>

            <ModalFooter>
                <Button kind="secondary" onClick={onClose}>Cancelar</Button>
                <Button
                    kind="primary"
                    renderIcon={ArrowRight}
                    disabled={files.filter(f => f.status === 'complete').length === 0 || uploading}
                    onClick={handleNext}
                >
                    {post.format === 'feed' || post.format === 'reels' ? 'Salvar Mídias' : 'Próximo: Atribuir'}
                </Button>
            </ModalFooter>
        </ComposedModal>
    );
}
