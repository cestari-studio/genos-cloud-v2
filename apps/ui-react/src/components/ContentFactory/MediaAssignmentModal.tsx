import React, { useState } from 'react';
import {
    ComposedModal, ModalHeader, ModalBody, ModalFooter,
    Dropdown, Button, Stack, Tile, Tag, InlineNotification,
    ProgressIndicator, ProgressStep, AILabel, AILabelContent
} from '@carbon/react';
import { Video, Checkmark, ArrowLeft } from '@carbon/icons-react';
import { api } from '../../services/api';

interface UploadedMedia {
    id: string; // post_media.id
    mediaId: string;
    originalName: string;
    type: 'image' | 'video';
    fileSize: number;
    width?: number;
    height?: number;
    durationSeconds?: number;
    thumbnailUrl: string;
}

interface MediaAssignmentModalProps {
    open: boolean;
    onClose: () => void;
    onBack: () => void; // back to Step 1
    post: any;
    uploadedMedia: UploadedMedia[];
    onSaveComplete: () => void;
}

export default function MediaAssignmentModal({
    open, onClose, onBack, post, uploadedMedia, onSaveComplete
}: MediaAssignmentModalProps) {
    const [assignments, setAssignments] = useState<Record<string, number | null>>({});
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!post) return null;

    const cardOptions = (post.card_data || []).map((card: any, idx: number) => ({
        id: idx + 1,
        text: `Card ${idx + 1}${card.cardTitulo ? ` — ${card.cardTitulo.substring(0, 30)}` : ''}`
    }));

    const assignedPositions = new Set(Object.values(assignments).filter(Boolean));
    const allAssigned = uploadedMedia.length > 0 && Object.values(assignments).filter(Boolean).length === uploadedMedia.length;

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const handleSave = async () => {
        if (!allAssigned) return;
        setSaving(true);
        setError(null);

        const mappedAssignments = uploadedMedia.map(m => ({
            media_id: m.mediaId,
            position: assignments[m.mediaId]
        }));

        try {
            await api.edgeFn('media-manager', {
                action: 'assign',
                post_id: post.id,
                tenant_id: post.tenant_id,
                assignments: mappedAssignments
            });
            onSaveComplete();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Falha ao atribuir as mídias.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ComposedModal open={open} onClose={onClose} size="lg">
            <ModalHeader>
                <Stack gap={5 as any}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <h3 className="cds--type-heading-compact-02">Atribuir Mídias aos Cards</h3>
                        <AILabel kind="inline">
                            <AILabelContent>
                                <h5>IA EXPLAINED</h5>
                                <p>Selecione a qual card do carrossel ou frame de stories cada mídia pertence. O dropdown exibe os cards disponíveis e exclui automaticamente as posições já ocupadas por segurança.</p>
                            </AILabelContent>
                        </AILabel>
                    </div>
                    <ProgressIndicator currentIndex={1}>
                        <ProgressStep label="Upload" />
                        <ProgressStep label="Atribuir" />
                    </ProgressIndicator>
                </Stack>
            </ModalHeader>

            <ModalBody>
                <Stack gap={5 as any}>
                    {error && (
                        <InlineNotification kind="error" subtitle={error} lowContrast hideCloseButton />
                    )}

                    {uploadedMedia.map(media => {
                        const selectedOptId = assignments[media.mediaId];

                        // Filtra Dropdown apenas para slots não populados OU Slot pertencente a mídia atual.
                        const availableItems = cardOptions.filter((opt: any) =>
                            !assignedPositions.has(opt.id) || selectedOptId === opt.id
                        );

                        return (
                            <Tile key={media.mediaId}>
                                <Stack orientation="horizontal" gap={5 as any}>
                                    <div className="media-thumbnail">
                                        {media.type === 'image' ? (
                                            <img src={media.thumbnailUrl} alt={media.originalName} />
                                        ) : (
                                            <Stack gap={1 as any} style={{ alignItems: 'center', justifyContent: 'center' }}>
                                                <Video size={32} />
                                                {media.durationSeconds && <Tag type="purple" size="sm">{media.durationSeconds}s</Tag>}
                                            </Stack>
                                        )}
                                    </div>

                                    <Stack gap={3 as any} style={{ flexGrow: 1 }}>
                                        <p className="cds--type-body-compact-01">{media.originalName}</p>

                                        <Stack orientation="horizontal" gap={2 as any}>
                                            <Tag type={media.type === 'image' ? 'teal' : 'purple'} size="sm">
                                                {media.type === 'image' ? 'Imagem' : 'Vídeo'}
                                            </Tag>
                                            <Tag type="cool-gray" size="sm">{formatFileSize(media.fileSize)}</Tag>
                                            {media.width && (
                                                <Tag type="cool-gray" size="sm">{media.width}×{media.height}</Tag>
                                            )}
                                        </Stack>

                                        <Dropdown
                                            id={`assign-${media.mediaId}`}
                                            titleText="Atribuir ao Card"
                                            label="Selecione um card"
                                            items={availableItems}
                                            itemToString={(item) => item?.text || ''}
                                            selectedItem={
                                                selectedOptId
                                                    ? cardOptions.find((c: any) => c.id === selectedOptId)
                                                    : null
                                            }
                                            onChange={({ selectedItem }) => {
                                                setAssignments(prev => ({
                                                    ...prev,
                                                    [media.mediaId]: selectedItem?.id || null
                                                }));
                                            }}
                                            warn={!selectedOptId}
                                            warnText="Selecione um card para esta mídia"
                                        />
                                    </Stack>
                                </Stack>
                            </Tile>
                        )
                    })}

                    <InlineNotification
                        kind={allAssigned ? 'success' : 'info'}
                        subtitle={allAssigned
                            ? 'Todas as mídias foram atribuídas. Clique em Salvar.'
                            : `${Object.values(assignments).filter(Boolean).length} de ${uploadedMedia.length} mídias atribuídas.`
                        }
                        lowContrast
                        hideCloseButton
                    />
                </Stack>
            </ModalBody>

            <ModalFooter>
                <Button kind="secondary" renderIcon={ArrowLeft} onClick={onBack}>Voltar</Button>
                <Button
                    kind="primary"
                    renderIcon={Checkmark}
                    disabled={!allAssigned || saving}
                    onClick={handleSave}
                >
                    {saving ? 'Salvando...' : 'Salvar Mídias'}
                </Button>
            </ModalFooter>
        </ComposedModal>
    );
}
