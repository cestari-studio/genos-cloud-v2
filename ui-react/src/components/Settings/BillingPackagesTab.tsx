import React, { useEffect, useState } from 'react';
import {
    ClickableTile, Tile, Grid, Column, Toggle, NumberInput, TextArea, DataTable,
    Table, TableHead, TableRow, TableHeader, TableBody, TableCell,
    Button, Tag, Select, SelectItem, InlineLoading, InlineNotification,
    Modal, TextInput, Stack, AILabel, AILabelContent, Layer
} from '@carbon/react';
import { Add, ShoppingCart, Settings as SettingsIcon } from '@carbon/icons-react';
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

    // Stripe checkout state
    const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
    const [subscriptionInfo, setSubscriptionInfo] = useState<any>(null);

    useEffect(() => {
        if (isMaster) {
            loadPackages();
            loadCosts();
        } else {
            // Non-master: load packages for shopping
            loadPackages();
        }
        loadPurchases();
        // Load subscription info if available
        const checkSubInfo = async () => {
            if (!tenantId) return;
            const { data } = await supabase.from('stripe_subscriptions').select('*').eq('tenant_id', tenantId).maybeSingle();
            setSubscriptionInfo(data);
        };
        checkSubInfo();
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
            let query = supabase.from('addon_purchases').select('*, addon_packages(*), tenants(name)').order('created_at', { ascending: false });
            if (!isMaster && isAgency) {
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
            await supabase.rpc('apply_addon_manual', { p_tenant_id: manualTenant, p_tokens: manualTokens, p_posts: manualPosts });
            setManualMsg({ text: 'Injetado com sucesso!', type: 'success' });
            setManualTokens(0); setManualPosts(0);
        } catch (err: any) {
            setManualMsg({ text: err.message, type: 'error' });
        } finally {
            setInjecting(false);
        }
    };

    const tenants = api.getTenants();

    // Stripe: purchase addon
    const handleStripeCheckout = async (packageId: string) => {
        setCheckoutLoading(packageId);
        try {
            const result: any = await api.edgeFn('stripe-checkout', {
                action: 'create_addon_checkout',
                tenant_id: tenantId,
                package_id: packageId,
            });
            if (result?.data?.url) {
                window.open(result.data.url, '_blank');
            }
        } catch (err: any) {
            alert('Erro Stripe: ' + err.message);
        } finally {
            setCheckoutLoading(null);
        }
    };

    // Stripe: manage subscription
    const handleManageSubscription = async () => {
        setCheckoutLoading('manage');
        try {
            const result: any = await api.edgeFn('stripe-checkout', {
                action: 'manage_subscription',
                tenant_id: tenantId,
            });
            if (result?.data?.url) {
                window.open(result.data.url, '_blank');
            }
        } catch (err: any) {
            alert('Erro Stripe: ' + err.message);
        } finally {
            setCheckoutLoading(null);
        }
    };

    return (
        <Stack gap={5}>
            {/* ─── SEÇÃO 0: ASSINATURA ATUAL (Não-Master) ────────────────── */}
            {!isMaster && subscriptionInfo && (
                <Tile>
                    <Stack gap={4}>
                        <Stack orientation="horizontal" gap={3}>
                            <h4 className="cds--type-productive-heading-03">{t('billingActiveSub')}</h4>
                            <Tag type={subscriptionInfo.status === 'active' ? 'green' : 'warm-gray'} size="sm">
                                {subscriptionInfo.status?.toUpperCase()}
                            </Tag>
                            {subscriptionInfo.tier && <Tag type="blue" size="sm">{subscriptionInfo.tier?.toUpperCase()}</Tag>}
                        </Stack>
                        <p className="cds--type-helper-text-01">
                            Próxima renovação: {subscriptionInfo.current_period_end ? new Date(subscriptionInfo.current_period_end).toLocaleDateString('pt-BR') : '—'}
                        </p>
                        <Button
                            kind="ghost"
                            size="sm"
                            renderIcon={SettingsIcon}
                            disabled={checkoutLoading === 'manage'}
                            onClick={handleManageSubscription}
                        >
                            {checkoutLoading === 'manage' ? <InlineLoading description={t('matrixStatusProcessing')} /> : t('billingManageSub')}
                        </Button>
                    </Stack>
                </Tile>
            )}

            {/* ─── SEÇÃO 0B: COMPRAR PACOTE ADICIONAL (Não-Master) ──────── */}
            {!isMaster && packages.filter(p => p.is_active).length > 0 && (
                <Tile>
                    <Stack gap={4}>
                        <Stack orientation="horizontal" gap={2}>
                            <h4 className="cds--type-productive-heading-03">{t('billingAddonPackages')}</h4>
                            <AILabel autoAlign size="xs">
                                <AILabelContent>
                                    <Stack gap={2} className="ai-label-popover-inner">
                                        <p className="cds--type-label-01">{t('aiBadgeLabel')}</p>
                                        <p className="cds--type-body-short-01">{t('billingAddonDesc')}</p>
                                    </Stack>
                                </AILabelContent>
                            </AILabel>
                        </Stack>
                        <Grid>
                            {packages.filter(p => p.is_active).map(pkg => (
                                <Column key={pkg.id} lg={4} md={4} sm={4}>
                                    <Layer>
                                        <Tile>
                                            <Stack gap={3}>
                                                <h5 className="cds--type-productive-heading-02">{pkg.name}</h5>
                                                <Stack gap={1}>
                                                    <Tag type="teal" size="sm">{(pkg.token_amount || 0).toLocaleString('pt-BR')} {t('billingTokens')}</Tag>
                                                    <Tag type="blue" size="sm">{pkg.post_amount || 0} {t('billingPosts')}</Tag>
                                                </Stack>
                                                <p className="cds--type-productive-heading-04">
                                                    R$ {Number(pkg.price_brl || 0).toFixed(2)}
                                                </p>
                                                <Button
                                                    kind="primary"
                                                    size="sm"
                                                    renderIcon={ShoppingCart}
                                                    disabled={!!checkoutLoading}
                                                    onClick={() => handleStripeCheckout(pkg.id)}
                                                >
                                                    {checkoutLoading === pkg.id ? <InlineLoading description="..." /> : t('billingBuyStripe')}
                                                </Button>
                                            </Stack>
                                        </Tile>
                                    </Layer>
                                </Column>
                            ))}
                        </Grid>
                    </Stack>
                </Tile>
            )}
            {/* ─── SEÇÃO A: METERING CONFIG (Master) ────────────────────────── */}
            {isMaster && (
                <Tile>
                    <Stack gap={5}>
                        <Stack orientation="horizontal" gap={4}>
                            <Stack gap={1}>
                                <Stack orientation="horizontal" gap={3}>
                                    <h4 className="cds--type-productive-heading-03">
                                        {t('billingMeteringTitle')}
                                    </h4>
                                    <AILabel autoAlign>
                                        <AILabelContent>
                                            <p>{t('billingMeteringDesc')}</p>
                                        </AILabelContent>
                                    </AILabel>
                                </Stack>
                            </Stack>
                            <div style={{ marginLeft: 'auto' }}>
                                <Button size="sm" onClick={onSaveConfig} disabled={savingConfig}>{t('settingsSaveButton')}</Button>
                            </div>
                        </Stack>
                        <Grid>
                            <Column sm={4} md={4} lg={8}>
                                <Stack gap={4}>
                                    <Toggle
                                        id="hard-block-toggle"
                                        labelText={t('billingHardBlockLabel')}
                                        toggled={config.hard_block_enabled}
                                        onToggle={(val) => updateField('hard_block_enabled', val)}
                                    />
                                    <Toggle
                                        id="overage-toggle"
                                        labelText={t('billingOverageLabel')}
                                        toggled={config.overage_allowed}
                                        onToggle={(val) => updateField('overage_allowed', val)}
                                    />
                                    <NumberInput
                                        id="low-balance-thresh"
                                        label={t('billingLowBalanceLabel')}
                                        value={config.low_balance_threshold}
                                        onChange={(_: any, { value }: any) => updateField('low_balance_threshold', Number(value))}
                                    />
                                </Stack>
                            </Column>
                            <Column sm={4} md={4} lg={8}>
                                <TextArea
                                    id="zero-balance-msg"
                                    labelText={t('billingZeroBalanceMsg')}
                                    value={config.zero_balance_message}
                                    onChange={(e) => updateField('zero_balance_message', e.target.value)}
                                    rows={4}
                                />
                            </Column>
                        </Grid>

                        <Stack gap={3}>
                            <h5 className="cds--type-productive-heading-02">{t('billingCostTable')}</h5>
                            {loadingCosts ? <InlineLoading /> : (
                                <DataTable rows={costs.map((c: any) => ({ ...c, isGlobal: !c.tenant_id }))} headers={[
                                    { key: 'format', header: t('billingCostFormat') },
                                    { key: 'operation', header: t('billingCostOp') },
                                    { key: 'base_cost', header: t('billingCostBase') },
                                    { key: 'per_slide_cost', header: t('billingCostSlide') },
                                    { key: 'isGlobal', header: t('billingCostScope') },
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
                        </Stack>
                    </Stack>
                </Tile>
            )}

            {/* ─── SEÇÃO B: ADDON PACKAGES (Master) ─────────────────────────── */}
            {isMaster && (
                <Tile>
                    <Stack gap={5}>
                        <Stack orientation="horizontal" gap={4}>
                            <Stack gap={1}>
                                <Stack orientation="horizontal" gap={3}>
                                    <h4 className="cds--type-productive-heading-03">{t('billingPackageCatalog')}</h4>
                                    <AILabel autoAlign>
                                        <AILabelContent>
                                            <p>{t('billingPackageDesc')}</p>
                                        </AILabelContent>
                                    </AILabel>
                                </Stack>
                            </Stack>
                            <div style={{ marginLeft: 'auto' }}>
                                <Button size="sm" renderIcon={Add} onClick={() => { setEditingPackage({ is_active: true }); setShowPackageModal(true); }}>{t('billingNewPackage')}</Button>
                            </div>
                        </Stack>
                        {loadingPackages ? <InlineLoading /> : (
                            <DataTable rows={packages} headers={[
                                { key: 'name', header: t('billingPackageName') },
                                { key: 'token_amount', header: t('billingTokensIncluded') },
                                { key: 'post_amount', header: t('billingPostsIncluded') },
                                { key: 'price_brl', header: t('billingPriceBRL') },
                                { key: 'is_active', header: t('waStatusHeader') },
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
                    </Stack>
                </Tile>
            )}

            {/* ─── SEÇÃO C: HISTÓRICO DE COMPRAS (Master/Agency) ────────────── */}
            <Tile>
                <Stack gap={5}>
                    <h4 className="cds--type-productive-heading-03">{t('billingPurchaseRequests')}</h4>
                    {loadingPurchases ? <InlineLoading /> : (
                        <DataTable rows={purchases} headers={[
                            { key: 'tenant_name', header: t('settingsSelectChild') },
                            { key: 'package_name', header: t('billingPackageName') },
                            { key: 'status', header: t('waStatusHeader') },
                            { key: 'created_at', header: t('waSentAt') },
                        ]}>
                            {({ rows, headers, getTableProps, getHeaderProps, getRowProps }: Record<string, any>) => {
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
                </Stack>
            </Tile>

            {/* ─── SEÇÃO D: INJEÇÃO MANUAL (Master/Agency) ──────────────────── */}
            <Tile>
                <Stack gap={5}>
                    <Stack gap={1}>
                        <h4 className="cds--type-productive-heading-03">{t('billingManualInjection')}</h4>
                        <p className="cds--type-body-short-01">{t('billingManualInjectionDesc')}</p>
                    </Stack>

                    {manualMsg && <InlineNotification kind={manualMsg.type} title={manualMsg.type === 'success' ? 'Sucesso' : 'Erro'} subtitle={manualMsg.text} onCloseButtonClick={() => setManualMsg(null)} />}

                    <Grid>
                        <Column sm={4} md={4} lg={4}>
                            <Select id="manual-tenant" labelText={t('billingSelectTenant')} value={manualTenant} onChange={(e) => setManualTenant(e.target.value)}>
                                <SelectItem value="" text={t('matrixSourceSelectPrompt')} disabled />
                                {tenants.map(t => <SelectItem key={t.id} value={t.id} text={t.name} />)}
                            </Select>
                        </Column>
                        <Column sm={4} md={2} lg={4}>
                            <NumberInput id="manual-tokens" label={t('billingTokens')} value={manualTokens} onChange={(_: any, { value }: any) => setManualTokens(Number(value))} />
                        </Column>
                        <Column sm={4} md={2} lg={4}>
                            <NumberInput id="manual-posts" label={t('billingPosts')} value={manualPosts} onChange={(_: any, { value }: any) => setManualPosts(Number(value))} />
                        </Column>
                        <Column sm={4} md={8} lg={4}>
                            <div className="billing-inject-action">
                                <Button onClick={injectManual} disabled={injecting}>{injecting ? t('billingInjecting') : t('billingApplyBalance')}</Button>
                            </div>
                        </Column>
                    </Grid>
                </Stack>
            </Tile>

            <Modal open={showPackageModal} primaryButtonText={t('save')} secondaryButtonText={t('cancel')} onRequestClose={() => setShowPackageModal(false)} onRequestSubmit={handleSavePackage} modalHeading={t('billingNewPackage')}>
                <Stack gap={4}>
                    <TextInput id="pkg-name" labelText={t('billingPackageName')} value={editingPackage.name || ''} onChange={(e) => setEditingPackage({ ...editingPackage, name: e.target.value })} />
                    <TextArea id="pkg-desc" labelText="Descrição" value={editingPackage.description || ''} onChange={(e) => setEditingPackage({ ...editingPackage, description: e.target.value })} />
                    <Grid>
                        <Column sm={2}><NumberInput id="pkg-tok" label="Tokens (+)" value={editingPackage.token_amount || 0} onChange={(_: any, { value }: any) => setEditingPackage({ ...editingPackage, token_amount: Number(value) })} /></Column>
                        <Column sm={2}><NumberInput id="pkg-pos" label="Posts (+)" value={editingPackage.post_amount || 0} onChange={(_: any, { value }: any) => setEditingPackage({ ...editingPackage, post_amount: Number(value) })} /></Column>
                        <Column sm={4}><NumberInput id="pkg-price" label="Preço BRL (R$)" min={0} value={editingPackage.price_brl || 0} onChange={(_: any, { value }: any) => setEditingPackage({ ...editingPackage, price_brl: Number(value) })} /></Column>
                    </Grid>
                    <TextInput id="pkg-stripe" labelText="Stripe Price ID (Opcional)" value={editingPackage.stripe_price_id || ''} onChange={(e) => setEditingPackage({ ...editingPackage, stripe_price_id: e.target.value })} />
                    <Toggle id="pkg-active" labelText="Pacote Visível no Catálogo" toggled={editingPackage.is_active} onToggle={(val) => setEditingPackage({ ...editingPackage, is_active: val })} />
                </Stack>
            </Modal>
        </Stack>
    );
}
