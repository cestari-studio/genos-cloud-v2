'use client';

import React from 'react';
import {
    DataTable, TableContainer, Table, TableHead, TableRow, TableHeader,
    TableBody, TableCell, TableToolbar, TableToolbarContent, TableToolbarSearch,
    Button, OverflowMenu, OverflowMenuItem, Tag, Pagination,
    TableExpandHeader, TableExpandRow, TableExpandedRow, Section,
    AILabel, AILabelContent, preview__IconIndicator as IconIndicator
} from '@carbon/react';
import { Add, Pause, Play, TrashCan, WatsonHealthAiStatus } from '@carbon/icons-react';
import PageLayout from '../../components/PageLayout';

// Mock de dados dos Tenants (Clientes)
const initialRows = [
    { id: '1', name: 'Clareira de Avalon', tier: 'Scale', status: 'Active', tokens: '85%', dna: 'Calibrated' },
    { id: '2', name: 'Walder Puttinato Studio', tier: 'Enterprise', status: 'Active', tokens: '42%', dna: 'Calibrated' },
    { id: '3', name: 'Lets Travel with Us 360', tier: 'Grow', status: 'Paused', tokens: '12%', dna: 'Pending' },
    { id: '4', name: 'Dads Love', tier: 'Seed', status: 'Active', tokens: '98%', dna: 'Calibrated' },
];

const headers = [
    { key: 'name', header: 'Nome do Tenant' },
    { key: 'tier', header: 'Plano (Tier)' },
    { key: 'status', header: 'Status' },
    { key: 'tokens', header: 'Uso de Tokens' },
    { key: 'dna', header: 'Status DNA' },
];

export default function TenantMasterList() {
    return (
        <main className="tenant-master-page theme-gray-10">
            <Section style={{ padding: '2rem' }}>
                <TableContainer
                    title="Tenant Master List"
                    description="Gestão centralizada de contas, limites e orquestração agêntica."
                    decorator={
                        <AILabel size="sm">
                            <AILabelContent>
                                <div style={{ padding: '0.5rem', maxWidth: '250px' }}>
                                    <p className="secondary">Global AI Operations</p>
                                    <p className="secondary">Manejo das contas e controle de quotas guiado pelo Constraint Kernel.</p>
                                </div>
                            </AILabelContent>
                        </AILabel>
                    }
                >
                    <TableToolbar>
                        <TableToolbarContent>
                            <TableToolbarSearch placeholder="Buscar por nome ou ID..." />
                            <Button renderIcon={Add} size="md">Novo Tenant</Button>
                        </TableToolbarContent>
                    </TableToolbar>

                    <DataTable rows={initialRows} headers={headers}>
                        {({ rows, headers, getHeaderProps, getRowProps, getTableProps, getExpandHeaderProps }: any) => (
                            <Table {...getTableProps()}>
                                <TableHead>
                                    <TableRow>
                                        <TableExpandHeader {...getExpandHeaderProps()} />
                                        {headers.map((header: any) => (
                                            <TableHeader {...getHeaderProps({ header })} key={header.key}>
                                                {header.header}
                                            </TableHeader>
                                        ))}
                                        <TableHeader />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rows.map((row: any) => (
                                        <React.Fragment key={row.id}>
                                            <TableExpandRow {...getRowProps({ row })}>
                                                {row.cells.map((cell: any) => (
                                                    <TableCell key={cell.id}>
                                                        {cell.info.header === 'status' ? (
                                                            <IconIndicator
                                                                kind={cell.value === 'Active' ? 'normal' : cell.value === 'Paused' ? 'pending' : 'failed'}
                                                                label={cell.value}
                                                            />
                                                        ) : cell.info.header === 'tokens' && parseInt(cell.value) > 90 ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <span style={{ color: '#fa4d56', fontWeight: 600 }}>{cell.value}</span>
                                                                <Button size="sm" kind="danger--ghost" style={{ padding: '0 0.5rem', minHeight: '1.5rem', fontSize: '0.75rem' }}>Agent Auto-Upgrade</Button>
                                                            </div>
                                                        ) : cell.value}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="cds--table-column-menu">
                                                    <OverflowMenu flipped size="sm">
                                                        <OverflowMenuItem itemText="Editar Limites" />
                                                        <OverflowMenuItem itemText="Pausar Orquestração" />
                                                        <OverflowMenuItem itemText="Reativar" />
                                                        <OverflowMenuItem itemText="Excluir" hasDivider isDelete />
                                                    </OverflowMenu>
                                                </TableCell>
                                            </TableExpandRow>
                                            <TableExpandedRow colSpan={headers.length + 2}>
                                                <div style={{ padding: '1rem' }}>
                                                    <h6 style={{ marginBottom: '0.5rem' }}>Detalhes Técnicos do Tenant</h6>
                                                    <div style={{ display: 'flex', gap: '2rem' }}>
                                                        <p><strong>ID:</strong> {row.id}</p>
                                                        <p><strong>Endpoint RLS:</strong> supabase_rls_{row.id}</p>
                                                        <p><strong>AI Engine:</strong> IBM Granite 13B</p>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <WatsonHealthAiStatus size={16} fill="#0f62fe" />
                                                            <span>DNA Match: 98%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableExpandedRow>
                                        </React.Fragment>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </DataTable>
                    <Pagination
                        backwardText="Página anterior"
                        forwardText="Próxima página"
                        pageSize={10}
                        page={1}
                        pageSizes={[10, 20, 30, 40, 50]}
                        totalItems={initialRows.length}
                    />
                </TableContainer>
            </Section>
        </main>
    );
}
