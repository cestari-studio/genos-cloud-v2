// genOS — WhatsApp Approval Flow Tab (F5)
// Manages approvers, WA templates, timeout config, and event history
import React, { useEffect, useState } from 'react';
import {
    AILabel, AILabelContent,
    Tile, Grid, Column, Stack, Tag, Button,
    DataTable, Table, TableHead, TableRow, TableHeader,
    TableBody, TableCell, TableContainer, TableToolbar, TableToolbarContent,
    InlineLoading, InlineNotification, Layer,
    TextInput, Toggle, NumberInput, Modal,
    StructuredListWrapper, StructuredListBody, StructuredListRow, StructuredListCell,
} from '@carbon/react';
import { Add, TrashCan, AiAgentInvocation, Chat } from '@carbon/icons-react';
import { supabase } from '../../services/supabase';
import { api } from '../../services/api';

interface Props {
    tenantId: string;
    config: any;
    updateField: (key: string, value: any) => void;
}

interface Approver {
    id: string;
    name: string;
    phone: string;
    role: string;
    is_active: boolean;
}

interface WaEvent {
    id: string;
    post_id: string;
    approver_phone: string;
    status: 'pending' | 'approved' | 'rejected' | 'timeout';
    created_at: string;
    decided_at: string | null;
}

export default function WhatsApprovalTab({ tenantId, config, updateField }: Props) {
    const [approvers, setApprovers] = useState<Approver[]>([]);
    const [waEvents, setWaEvents] = useState<WaEvent[]>([]);
    const [loadingApprovers, setLoadingApprovers] = useState(false);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [showAddApprover, setShowAddApprover] = useState(false);
    const [newApprover, setNewApprover] = useState({ name: '', phone: '', role: 'approver' });
    const [savingApprover, setSavingApprover] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        if (!tenantId) return;
        loadApprovers();
        loadEvents();
    }, [tenantId]);

    const loadApprovers = async () => {
        if (!tenantId) return;
        setLoadingApprovers(true);
        try {
            const { data, error } = await supabase.from('wa_approvers')
                .select('*').eq('tenant_id', tenantId).order('name');
            // If table doesn't exist yet (404/42P01), just show empty state
            if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
                setApprovers([]);
                return;
            }
            if (error) throw error;
            setApprovers(data || []);
        } catch (err: any) {
            console.warn('wa_approvers:', err.message);
            setApprovers([]);
        } finally {
            setLoadingApprovers(false);
        }
    };

    const loadEvents = async () => {
        if (!tenantId) return;
        setLoadingEvents(true);
        try {
            const { data, error } = await supabase.from('wa_approval_events')
                .select('*').eq('tenant_id', tenantId)
                .order('created_at', { ascending: false }).limit(30);
            if (error && (error.code === '42P01' || error.message?.includes('does not exist'))) {
                setWaEvents([]);
                return;
            }
            if (error) throw error;
            setWaEvents(data || []);
        } catch (err: any) {
            console.warn('wa_approval_events:', err.message);
            setWaEvents([]);
        } finally {
            setLoadingEvents(false);
        }
    };

    const handleAddApprover = async () => {
        if (!newApprover.name || !newApprover.phone) {
            setError('Nome e telefone são obrigatórios.');
            return;
        }
        setSavingApprover(true);
        try {
            const { error: e } = await supabase.from('wa_approvers').insert({
                tenant_id: tenantId,
                name: newApprover.name,
                phone: newApprover.phone.replace(/\D/g, ''),
                role: newApprover.role,
                is_active: true,
            });
            if (e) throw e;
            setShowAddApprover(false);
            setNewApprover({ name: '', phone: '', role: 'approver' });
            setSuccess('Aprovador adicionado com sucesso.');
            setTimeout(() => setSuccess(null), 3000);
            loadApprovers();
        } catch (err: any) {
            setError(err.message || 'Erro ao adicionar aprovador.');
        } finally {
            setSavingApprover(false);
        }
    };

    const handleRemoveApprover = async (id: string) => {
        try {
            const { error: e } = await supabase.from('wa_approvers').delete().eq('id', id);
            if (e) throw e;
            loadApprovers();
        } catch (err: any) {
            setError(err.message || 'Erro ao remover aprovador.');
        }
    };

    const handleToggleApprover = async (id: string, is_active: boolean) => {
        try {
            const { error: e } = await supabase.from('wa_approvers').update({ is_active }).eq('id', id);
            if (e) throw e;
            loadApprovers();
        } catch (err: any) {
            setError(err.message || 'Erro ao atualizar aprovador.');
        }
    };

    const approverHeaders = [
        { key: 'name', header: 'Nome' },
        { key: 'phone', header: 'Telefone (WA)' },
        { key: 'role', header: 'Papel' },
        { key: 'is_active', header: 'Status' },
        { key: 'actions', header: '' },
    ];

    const approverRows = approvers.map(a => ({
        id: a.id,
        name: a.name,
        phone: `+${a.phone}`,
        role: a.role,
        is_active: a.is_active,
        actions: a,
    }));

    const eventHeaders = [
        { key: 'post_id', header: 'Post ID' },
        { key: 'approver_phone', header: 'Aprovador' },
        { key: 'status', header: 'Status' },
        { key: 'created_at', header: 'Enviado em' },
        { key: 'decided_at', header: 'Decidido em' },
    ];

    const eventRows = waEvents.map(ev => ({
        id: ev.id,
        post_id: ev.post_id?.slice(0, 8) + '...',
        approver_phone: `+${ev.approver_phone}`,
        status: ev.status,
        created_at: new Date(ev.created_at).toLocaleString('pt-BR'),
        decided_at: ev.decided_at ? new Date(ev.decided_at).toLocaleString('pt-BR') : '—',
    }));

    const EVENT_STATUS_TAG: Record<string, string> = {
        pending: 'blue', approved: 'green', rejected: 'red', timeout: 'warm-gray',
    };

    // WA templates (static list — editable in brand DNA, shown here for reference)
    const WA_TEMPLATES = [
        { id: 'approval_request', name: 'Solicitação de Aprovação', variables: ['{post_title}', '{post_link}', '{approver_name}'] },
        { id: 'approval_reminder', name: 'Lembrete de Aprovação', variables: ['{hours_remaining}', '{post_title}'] },
        { id: 'approval_timeout', name: 'Timeout de Aprovação', variables: ['{post_title}', '{timeout_hours}'] },
        { id: 'approval_confirmed', name: 'Publicação Confirmada', variables: ['{post_title}', '{platform}'] },
    ];

    return (
        <Stack gap={5}>
            {error && <InlineNotification kind="error" title="Erro" subtitle={error} lowContrast onCloseButtonClick={() => setError(null)} />}
            {success && <InlineNotification kind="success" title="Sucesso" subtitle={success} lowContrast onCloseButtonClick={() => setSuccess(null)} />}

            {/* ── Config ──────────────────────────────────────────────────── */}
            <Tile>
                <Stack gap={4}>
                    <Stack orientation="horizontal" gap={2}>
                        <h4 className="cds--type-productive-heading-03">Configurações do Fluxo WA</h4>
                        <AILabel autoAlign size="xs">
                            <AILabelContent>
                                <Stack gap={2} className="ai-label-popover-inner">
                                    <p className="cds--type-label-01">IA EXPLAINED</p>
                                    <p className="cds--type-body-short-01">
                                        O fluxo de aprovação via WhatsApp envia mensagens template para os aprovadores cadastrados.
                                        O timeout define em horas após quanto tempo o sistema auto-reprova.
                                    </p>
                                </Stack>
                            </AILabelContent>
                        </AILabel>
                    </Stack>
                    <Grid>
                        <Column lg={4} md={4} sm={4}>
                            <Toggle
                                id="wa-approval-enabled"
                                labelText="Habilitar Aprovação via WhatsApp"
                                labelA="Desabilitado"
                                labelB="Habilitado"
                                toggled={config?.wa_approval_enabled ?? false}
                                onToggle={(v: boolean) => updateField('wa_approval_enabled', v)}
                            />
                        </Column>
                        <Column lg={4} md={4} sm={4}>
                            <Toggle
                                id="wa-double-approval"
                                labelText="Aprovação Dupla Necessária"
                                labelA="Não"
                                labelB="Sim"
                                toggled={config?.wa_double_approval ?? false}
                                onToggle={(v: boolean) => updateField('wa_double_approval', v)}
                                disabled={!config?.wa_approval_enabled}
                            />
                        </Column>
                        <Column lg={4} md={4} sm={4}>
                            <NumberInput
                                id="wa-timeout"
                                label="Timeout (horas)"
                                value={config?.wa_approval_timeout_hours ?? 24}
                                min={1}
                                max={168}
                                step={1}
                                onChange={(_: any, { value }: any) => updateField('wa_approval_timeout_hours', Number(value) || 24)}
                                disabled={!config?.wa_approval_enabled}
                            />
                        </Column>
                    </Grid>
                </Stack>
            </Tile>

            {/* ── Approvers DataTable ──────────────────────────────────────── */}
            <Tile>
                <Stack gap={4}>
                    <Stack orientation="horizontal" gap={3}>
                        <h4 className="cds--type-productive-heading-03">Aprovadores</h4>
                        <Button size="sm" kind="primary" renderIcon={Add} onClick={() => setShowAddApprover(true)}>
                            Adicionar Aprovador
                        </Button>
                    </Stack>
                    {loadingApprovers ? <InlineLoading /> : (
                        <DataTable rows={approverRows} headers={approverHeaders}>
                            {({ rows, headers, getTableProps, getHeaderProps, getRowProps }: any) => (
                                <TableContainer>
                                    <Table {...getTableProps()} size="sm">
                                        <TableHead>
                                            <TableRow>
                                                {headers.map((h: any) => (
                                                    <TableHeader {...getHeaderProps({ header: h })} key={h.key}>{h.header}</TableHeader>
                                                ))}
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {rows.length === 0 ? (
                                                <TableRow><TableCell colSpan={5}>Nenhum aprovador cadastrado.</TableCell></TableRow>
                                            ) : rows.map((row: any) => {
                                                const approver = row.cells.find((c: any) => c.info.header === 'actions')?.value;
                                                return (
                                                    <TableRow {...getRowProps({ row })} key={row.id}>
                                                        {row.cells.map((cell: any) => {
                                                            if (cell.info.header === 'is_active') return (
                                                                <TableCell key={cell.id}>
                                                                    <Tag type={cell.value ? 'green' : 'warm-gray'} size="sm">
                                                                        {cell.value ? 'Ativo' : 'Inativo'}
                                                                    </Tag>
                                                                </TableCell>
                                                            );
                                                            if (cell.info.header === 'actions') return (
                                                                <TableCell key={cell.id}>
                                                                    <Stack orientation="horizontal" gap={1}>
                                                                        <Button
                                                                            size="sm"
                                                                            kind="ghost"
                                                                            onClick={() => handleToggleApprover(approver.id, !approver.is_active)}
                                                                        >
                                                                            {approver?.is_active ? 'Desativar' : 'Ativar'}
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            kind="danger--ghost"
                                                                            renderIcon={TrashCan}
                                                                            iconDescription="Remover"
                                                                            hasIconOnly
                                                                            onClick={() => handleRemoveApprover(approver.id)}
                                                                        />
                                                                    </Stack>
                                                                </TableCell>
                                                            );
                                                            return <TableCell key={cell.id}>{cell.value}</TableCell>;
                                                        })}
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </DataTable>
                    )}
                </Stack>
            </Tile>

            {/* ── WA Templates StructuredList ────────────────────────────────── */}
            <Tile>
                <Stack gap={4}>
                    <Stack orientation="horizontal" gap={2}>
                        <Chat size={20} className="icon--info" />
                        <h4 className="cds--type-productive-heading-03">Templates WA Configurados</h4>
                    </Stack>
                    <p className="cds--type-body-short-01">Templates pré-aprovados pela Meta para envio via WhatsApp Business API.</p>
                    <StructuredListWrapper>
                        <StructuredListBody>
                            {WA_TEMPLATES.map(tpl => (
                                <StructuredListRow key={tpl.id}>
                                    <StructuredListCell head>{tpl.name}</StructuredListCell>
                                    <StructuredListCell>
                                        <Stack orientation="horizontal" gap={1}>
                                            {tpl.variables.map((v, i) => (
                                                <Tag key={i} type="cool-gray" size="sm">{v}</Tag>
                                            ))}
                                        </Stack>
                                    </StructuredListCell>
                                    <StructuredListCell><Tag type="green" size="sm">APROVADO</Tag></StructuredListCell>
                                </StructuredListRow>
                            ))}
                        </StructuredListBody>
                    </StructuredListWrapper>
                </Stack>
            </Tile>

            {/* ── WA Events History DataTable ────────────────────────────────── */}
            <Tile>
                <Stack gap={4}>
                    <Stack orientation="horizontal" gap={2}>
                        <h4 className="cds--type-productive-heading-03">Histórico de Aprovações WA</h4>
                        <Tag type="cool-gray" size="sm">Últimas 30</Tag>
                        <AILabel autoAlign size="xs">
                            <AILabelContent>
                                <Stack gap={2} className="ai-label-popover-inner">
                                    <p className="cds--type-label-01">IA EXPLAINED</p>
                                    <p className="cds--type-body-short-01">Registro auditável de todas as solicitações de aprovação enviadas via WhatsApp. Timeout automático pode ser configurado acima.</p>
                                </Stack>
                            </AILabelContent>
                        </AILabel>
                    </Stack>
                    {loadingEvents ? <InlineLoading /> : (
                        <DataTable rows={eventRows} headers={eventHeaders}>
                            {({ rows, headers, getTableProps, getHeaderProps, getRowProps }: any) => (
                                <TableContainer>
                                    <Table {...getTableProps()} size="sm">
                                        <TableHead>
                                            <TableRow>
                                                {headers.map((h: any) => (
                                                    <TableHeader {...getHeaderProps({ header: h })} key={h.key}>{h.header}</TableHeader>
                                                ))}
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {eventRows.length === 0 ? (
                                                <TableRow><TableCell colSpan={5}>Nenhum evento de aprovação registrado.</TableCell></TableRow>
                                            ) : rows.map((row: any) => (
                                                <TableRow {...getRowProps({ row })} key={row.id}>
                                                    {row.cells.map((cell: any) => {
                                                        if (cell.info.header === 'status') return (
                                                            <TableCell key={cell.id}>
                                                                <Tag type={(EVENT_STATUS_TAG[cell.value] || 'cool-gray') as any} size="sm">
                                                                    {cell.value.toUpperCase()}
                                                                </Tag>
                                                            </TableCell>
                                                        );
                                                        return <TableCell key={cell.id}>{cell.value}</TableCell>;
                                                    })}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </DataTable>
                    )}
                </Stack>
            </Tile>

            {/* ── Add Approver Modal ────────────────────────────────────────── */}
            <Modal
                open={showAddApprover}
                modalHeading="Adicionar Aprovador WhatsApp"
                primaryButtonText={savingApprover ? 'Salvando...' : 'Adicionar'}
                secondaryButtonText="Cancelar"
                onRequestClose={() => setShowAddApprover(false)}
                onRequestSubmit={handleAddApprover}
                primaryButtonDisabled={savingApprover}
                size="sm"
            >
                <Stack gap={4} style={{ paddingBlock: '1rem' }}>
                    <TextInput
                        id="wa-approver-name"
                        labelText="Nome do Aprovador"
                        value={newApprover.name}
                        onChange={(e: any) => setNewApprover(a => ({ ...a, name: e.target.value }))}
                        placeholder="Ex: João Silva"
                    />
                    <TextInput
                        id="wa-approver-phone"
                        labelText="Telefone (com código do país)"
                        value={newApprover.phone}
                        onChange={(e: any) => setNewApprover(a => ({ ...a, phone: e.target.value }))}
                        placeholder="Ex: 5511999999999"
                        helperText="Apenas números, incluindo código do país (55 = Brasil)"
                    />
                </Stack>
            </Modal>
        </Stack>
    );
}
