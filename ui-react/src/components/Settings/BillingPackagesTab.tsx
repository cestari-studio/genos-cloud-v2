import React, { useEffect, useState } from 'react';
import {
    Tile, Grid, Column, Toggle, NumberInput, TextArea, DataTable,
    Table, TableHead, TableRow, TableHeader, TableBody, TableCell,
    Button, Tag, Select, SelectItem, InlineLoading, InlineNotification, Modal, TextInput
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { api, type TokenCostConfig, type AddonPackage, type AddonPurchase } from '../../services/api';
import { supabase } from '../../services/supabase';
import { t } from '../../config/locale';

interface Props {
    isMaster: boolean;
    isAgency: boolean;
    tenantId: string; // The selected child tenant being edited
    config: any;
    updateField: (key: string, value: any) => void;
    onSaveConfig: () => Promise<void>;
    savingConfig: boolean;
}

export default function BillingPackagesTab({ isMaster, isAgency, tenantId, config, updateField, onSaveConfig, savingConfig }: Props) {
    // State for Add-on Packages (Section B)
    const [packages, setPackages] = useState<AddonPackage[]>([]);
    const [loadingPackages, setLoadingPackages] = useState(false);

    // State for Purchase History (Section C)
    const [purchases, setPurchases] = useState<AddonPurchase[]>([]);
    const [loadingPurchases, setLoadingPurchases] = useState(false);

    // State for Token Costs (Section A)
    const [costs, setCosts] = useState<TokenCostConfig[]>([]);
    const [loadingCosts, setLoadingCosts] = useState(false);

    // Manual Injection (Section D)
    const [manualTenant, setManualTenant] = useState<string>('');
    const [manualTokens, setManualTokens] = useState<number>(0);
    const [manualPosts, setManualPosts] = useState<number>(0);
    const [injecting, setInjecting] = useState(false);
    const [manualMsg, setManualMsg] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    // Modals
    const [showPackageModal, setShowPackageModal] = useState(false);
    const [editingPackage, setEditingPackage] = useState<Partial<AddonPackage>>({ is_active: true });

    useEffect(() => {
        if (isMaster) {
            loadPackages();
            loadCosts();
        }
        loadPurchases();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMaster, tenantId]);

    const loadPackages = async () => {
        setLoadingPackages(true);
        try {
            const result: any = await api.edgeFn('addon-manager', { action: 'list_packages' });
            setPackages(result || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingPackages(false);
        }
    };

    const loadPurchases = async () => {
        setLoadingPurchases(true);
        try {
            // Query addon_purchases. Agency only sees their tenants, Master sees all.
            // Easiest is to hit edgeFn 'list_purchases' or direct query.
            let query = supabase.from('addon_purchases').select('*, addon_packages(*), tenants(name)').order('created_at', { ascending: false });
            if (!isMaster && isAgency) {
                // Here we'd filter or the RLS handles it
                const currentTenant = api.getActiveTenantId();
                const { data: kids } = await supabase.from('tenants').select('id').eq('parent_tenant_id', currentTenant);
                const kidIds = (kids || []).map(k => k.id);
                query = query.in('tenant_id', [currentTenant, ...kidIds]);
            }
            const { data } = await query;
            setPurchases((data as any) || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingPurchases(false);
        }
    };

    const loadCosts = async () => {
        if (!tenantId) return;
        setLoadingCosts(true);
        try {
            // Load both global costs (tenant_id IS NULL) and local costs (tenant_id = current)
            const { data } = await supabase.from('token_cost_config').select('*').or(`tenant_id.is.null,tenant_id.eq.${tenantId}`);
            setCosts(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingCosts(false);
        }
    };

    const handleSavePackage = async () => {
        try {
            await api.edgeFn('addon-manager', {
                action: 'manage_packages',
                sub_action: editingPackage.id ? 'update' : 'create',
                package_data: editingPackage
            });
            setShowPackageModal(false);
            loadPackages();
        } catch (err) {
            alert('Erro ao salvar pacote: ' + err);
        }
    };

    const handleApprovePurchase = async (purchaseId: string) => {
        const ref = prompt("Referência de pagamento (Stripe ID, PIX, etc):", "");
        if (ref === null) return;

        try {
            await api.edgeFn('addon-manager', {
                action: 'approve_purchase',
                purchase_id: purchaseId,
                payment_reference: ref
            });
            loadPurchases();
        } catch (err) {
            alert('Erro ao aprovar: ' + err);
        }
    };

    const handleRejectPurchase = async (purchaseId: string) => {
        if (!confirm("Rejeitar esta compra?")) return;
        try {
            await supabase.from('addon_purchases').update({ status: 'rejected' }).eq('id', purchaseId);
            loadPurchases();
        } catch (err) {
            alert('Erro ao rejeitar: ' + err);
        }
    };

    const injectManual = async () => {
        if (!manualTenant) return setManualMsg({ text: 'Selecione um tenant', type: 'error' });
        setInjecting(true);
        try {
            // Add logic to directly update credit_wallets and tenant_config and activity log
            await supabase.rpc('apply_addon_manual', { p_tenant_id: manualTenant, p_tokens: manualTokens, p_posts: manualPosts });

            setManualMsg({ text: 'Injetado com sucesso!', type: 'success' });
            setManualTokens(0); setManualPosts(0);
        } catch (err: any) {
            setManualMsg({ text: err.message, type: 'error' });
        } finally {
            setInjecting(false);
        }
    };

    const tenants = api.getTenants(); // From cache, for Seção D dropdown

    return (
        <>
            {/* ─── SEÇÃO A: METERING CONFIG (Master) ────────────────────────── */}
            {isMaster && (
                <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', padding: '1.5rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1.5rem' }}>
                            Metering & Compliance (Hard-Block)
                        </h4>
                        <Button size="sm" onClick={onSaveConfig} disabled={savingConfig}>Salvar Propriedades</Button>
                    </div>
                    <Grid>
                        <Column sm={4} md={4} lg={8}>
                            <Toggle
                                id="hard-block-toggle"
                                labelText="Sistema Hard-Block (Bloqueia IA se limite estourar)"
                                toggled={config.hard_block_enabled}
                                onToggle={(val) => updateField('hard_block_enabled', val)}
                            />
                            <div style={{ marginTop: '1rem' }}>
                                <Toggle
                                    id="overage-toggle"
                                    labelText="Permitir Overage / Faturamento Pós-pago"
                                    toggled={config.overage_allowed}
                                    onToggle={(val) => updateField('overage_allowed', val)}
                                />
                            </div>
                            <div style={{ marginTop: '1rem' }}>
                                <NumberInput
                                    id="low-balance-thresh"
                                    label="Limiar de Alerta de Saldo Baixo (Tokens)"
                                    value={config.low_balance_threshold}
                                    onChange={(_: any, { value }: any) => updateField('low_balance_threshold', Number(value))}
                                />
                            </div>
                        </Column>
                        <Column sm={4} md={4} lg={8}>
                            <TextArea
                                id="zero-balance-msg"
                                labelText="Mensagem Exibida no Hard-Block Modal (Estoque Esgotado)"
                                value={config.zero_balance_message}
                                onChange={(e) => updateField('zero_balance_message', e.target.value)}
                                rows={4}
                            />
                        </Column>
                    </Grid>

                    <div style={{ marginTop: '2rem' }}>
                        <h5 className="cds--type-productive-heading-02" style={{ color: '#c6c6c6', marginBottom: '1rem' }}>Tabela de Custos (token_cost_config)</h5>
                        {loadingCosts ? <InlineLoading /> : (
                            <DataTable rows={costs.map((c: any) => ({ ...c, isGlobal: !c.tenant_id }))} headers={[
                                { key: 'format', header: 'Formato' },
                                { key: 'operation', header: 'Operação' },
                                { key: 'base_cost', header: 'Custo Base' },
                                { key: 'per_slide_cost', header: 'Custo/Slide Adicional' },
                                { key: 'isGlobal', header: 'Escopo' },
                            ]}>
                                {({ rows, headers, getTableProps, getHeaderProps, getRowProps }: any) => (
                                    <Table {...getTableProps()}>
                                        <TableHead>
                                            <TableRow>
                                                {headers.map((header: any) => (
                                                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                                                        {header.header}
                                                    </TableHeader>
                                                ))}
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {rows.map((row: any) => (
                                                <TableRow {...getRowProps({ row })} key={row.id}>
                                                    {row.cells.map((cell: any) => {
                                                        if (cell.info.header === 'isGlobal') {
                                                            return <TableCell key={cell.id}><Tag type={cell.value ? 'blue' : 'purple'}>{cell.value ? 'Global' : 'Tenant Específico'}</Tag></TableCell>;
                                                        }
                                                        return <TableCell key={cell.id}>{cell.value}</TableCell>;
                                                    })}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </DataTable>
                        )}
                    </div>
                </Tile>
            )}

            {/* ─── SEÇÃO B: ADDON PACKAGES (Master) ─────────────────────────── */}
            {isMaster && (
                <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', padding: '1.5rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4' }}>Catálogo de Pacotes Adicionais</h4>
                        <Button size="sm" renderIcon={Add} onClick={() => { setEditingPackage({ is_active: true }); setShowPackageModal(true); }}>Novo Pacote</Button>
                    </div>
                    {loadingPackages ? <InlineLoading /> : (
                        <DataTable rows={packages} headers={[
                            { key: 'name', header: 'Nome do Pacote' },
                            { key: 'token_amount', header: 'Tokens Inclusos' },
                            { key: 'post_amount', header: 'Posts Inclusos' },
                            { key: 'price_brl', header: 'Preço (R$)' },
                            { key: 'is_active', header: 'Status' },
                        ]}>
                            {({ rows, headers, getTableProps, getHeaderProps, getRowProps }: Record<string, any>) => (
                                <Table {...getTableProps()} size="sm">
                                    <TableHead>
                                        <TableRow>
                                            {headers.map((header: any) => (
                                                <TableHeader {...getHeaderProps({ header })} key={header.key}>{header.header}</TableHeader>
                                            ))}
                                            <TableHeader>Ações</TableHeader>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {rows.map((row: any) => (
                                            <TableRow {...getRowProps({ row })} key={row.id}>
                                                {row.cells.map((cell: any) => {
                                                    if (cell.info.header === 'is_active') return <TableCell key={cell.id}><Tag type={cell.value ? 'green' : 'red'}>{cell.value ? 'Ativo' : 'Inativo'}</Tag></TableCell>;
                                                    if (cell.info.header === 'price_brl') return <TableCell key={cell.id}>R$ {cell.value}</TableCell>;
                                                    return <TableCell key={cell.id}>{cell.value}</TableCell>;
                                                })}
                                                <TableCell>
                                                    <Button kind="ghost" size="sm" onClick={() => {
                                                        const p = packages.find(pk => pk.id === row.id);
                                                        if (p) { setEditingPackage(p); setShowPackageModal(true); }
                                                    }}>Editar</Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </DataTable>
                    )}
                </Tile>
            )}

            {/* ─── SEÇÃO C: HISTÓRICO DE COMPRAS (Master/Agency) ────────────── */}
            <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', padding: '1.5rem', marginBottom: '1rem' }}>
                <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '1.5rem' }}>Requisições de Compra</h4>
                {loadingPurchases ? <InlineLoading /> : (
                    <DataTable rows={purchases} headers={[
                        { key: 'tenant_name', header: 'Tenant' },
                        { key: 'package_name', header: 'Pacote' },
                        { key: 'status', header: 'Status' },
                        { key: 'created_at', header: 'Data' },
                    ]}>
                        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }: Record<string, any>) => {
                            // Map rows manually to handle nested objects
                            const mappedRows = purchases.map(p => ({
                                ...p,
                                id: p.id,
                                tenant_name: p.tenants?.name,
                                package_name: p.addon_packages?.name,
                                status: p.status,
                                created_at: new Date(p.created_at).toLocaleDateString(),
                            }));

                            return (
                                <Table {...getTableProps()} size="sm">
                                    <TableHead>
                                        <TableRow>
                                            {headers.map((header: any) => (
                                                <TableHeader {...getHeaderProps({ header })} key={header.key}>{header.header}</TableHeader>
                                            ))}
                                            <TableHeader>Ações</TableHeader>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {mappedRows.map((row: any) => (
                                            <TableRow {...getRowProps({ row })} key={row.id}>
                                                <TableCell>{row.tenant_name}</TableCell>
                                                <TableCell>{row.package_name} ({row.addon_packages?.token_amount} Tok)</TableCell>
                                                <TableCell>
                                                    <Tag type={row.status === 'approved' ? 'green' : row.status === 'rejected' ? 'red' : 'purple'}>
                                                        {row.status.toUpperCase()}
                                                    </Tag>
                                                </TableCell>
                                                <TableCell>{row.created_at}</TableCell>
                                                <TableCell>
                                                    {row.status === 'pending' && <>
                                                        <Button kind="ghost" size="sm" onClick={() => handleApprovePurchase(row.id)}>Aprovar</Button>
                                                        <Button kind="danger--ghost" size="sm" onClick={() => handleRejectPurchase(row.id)}>Rejeitar</Button>
                                                    </>}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )
                        }}
                    </DataTable>
                )}
            </Tile>

            {/* ─── SEÇÃO D: INJEÇÃO MANUAL (Master/Agency) ──────────────────── */}
            <Tile style={{ backgroundColor: '#262626', border: '1px solid #393939', padding: '1.5rem', marginBottom: '1rem' }}>
                <h4 className="cds--type-productive-heading-03" style={{ color: '#f4f4f4', marginBottom: '0.5rem' }}>Injeção Manual de Tokens</h4>
                <p className="cds--type-body-short-01" style={{ color: '#c6c6c6', marginBottom: '1rem' }}>Permite recarregar carteiras diretamente sem via de catálogo e pagamentos.</p>

                {manualMsg && <InlineNotification kind={manualMsg.type} title={manualMsg.type === 'success' ? 'Sucesso' : 'Erro'} subtitle={manualMsg.text} onCloseButtonClick={() => setManualMsg(null)} />}

                <Grid>
                    <Column sm={4} md={4} lg={4}>
                        <Select id="manual-tenant" labelText="Selecionar Tenant" value={manualTenant} onChange={(e) => setManualTenant(e.target.value)}>
                            <SelectItem value="" text="Escolher tenant..." disabled />
                            {tenants.map(t => <SelectItem key={t.id} value={t.id} text={t.name} />)}
                        </Select>
                    </Column>
                    <Column sm={4} md={2} lg={4}>
                        <NumberInput id="manual-tokens" label="Tokens" value={manualTokens} onChange={(_: any, { value }: any) => setManualTokens(Number(value))} />
                    </Column>
                    <Column sm={4} md={2} lg={4}>
                        <NumberInput id="manual-posts" label="Posts" value={manualPosts} onChange={(_: any, { value }: any) => setManualPosts(Number(value))} />
                    </Column>
                    <Column sm={4} md={8} lg={4} style={{ display: 'flex', alignItems: 'flex-end' }}>
                        <Button onClick={injectManual} disabled={injecting}>{injecting ? 'Injetando...' : 'Aplicar Saldo'}</Button>
                    </Column>
                </Grid>
            </Tile>

            <Modal open={showPackageModal} primaryButtonText="Salvar" secondaryButtonText="Cancelar" onRequestClose={() => setShowPackageModal(false)} onRequestSubmit={handleSavePackage} modalHeading="Criar/Editar Pacote">
                <TextInput id="pkg-name" labelText="Nome do Pacote" value={editingPackage.name || ''} onChange={(e) => setEditingPackage({ ...editingPackage, name: e.target.value })} style={{ marginBottom: '1rem' }} />
                <TextArea id="pkg-desc" labelText="Descrição" value={editingPackage.description || ''} onChange={(e) => setEditingPackage({ ...editingPackage, description: e.target.value })} style={{ marginBottom: '1rem' }} />
                <Grid>
                    <Column sm={2}><NumberInput id="pkg-tok" label="Tokens (+)" value={editingPackage.token_amount || 0} onChange={(_: any, { value }: any) => setEditingPackage({ ...editingPackage, token_amount: Number(value) })} /></Column>
                    <Column sm={2}><NumberInput id="pkg-pos" label="Posts (+)" value={editingPackage.post_amount || 0} onChange={(_: any, { value }: any) => setEditingPackage({ ...editingPackage, post_amount: Number(value) })} /></Column>
                    <Column sm={4}><NumberInput id="pkg-price" label="Preço BRL (R$)" min={0} value={editingPackage.price_brl || 0} onChange={(_: any, { value }: any) => setEditingPackage({ ...editingPackage, price_brl: Number(value) })} /></Column>
                </Grid>
                <div style={{ marginTop: '1rem' }}>
                    <TextInput id="pkg-stripe" labelText="Stripe Price ID (Opcional)" value={editingPackage.stripe_price_id || ''} onChange={(e) => setEditingPackage({ ...editingPackage, stripe_price_id: e.target.value })} />
                </div>
                <div style={{ marginTop: '1rem' }}>
                    <Toggle id="pkg-active" labelText="Pacote Visível no Catálogo" toggled={editingPackage.is_active} onToggle={(val) => setEditingPackage({ ...editingPackage, is_active: val })} />
                </div>
            </Modal>
        </>
    );
}
