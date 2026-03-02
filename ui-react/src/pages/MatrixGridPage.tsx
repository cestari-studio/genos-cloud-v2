'use client';

import React from 'react';
import {
    DataTable, TableContainer, Table, TableHead, TableRow, TableHeader,
    TableBody, TableCell, TableToolbar, TableToolbarContent, TableToolbarSearch,
    Button, OverflowMenu, OverflowMenuItem, Tag, Pagination,
    TableExpandHeader, TableExpandRow, TableExpandedRow, Section, Tile, Stack, Grid, Column,
    AILabel, AILabelContent
} from '@carbon/react';
import { CharacterPatterns, ThumbsUp, ThumbsDown, MachineLearningModel, DataVis_1, Security } from '@carbon/icons-react';
import PageLayout from '../components/PageLayout';
import { t } from '../components/LocaleSelectorModal';

// Mock data representing generated content passing through the Constraint Kernel
const initialRows = [
    {
        id: '1',
        title: 'Lançamento de Verão 26',
        format: 'Instagram Carousel',
        status: 'Pending',
        confidence: 96,
        kernelConstraints: { chars: { current: 650, min: 600, max: 700, valid: true }, style: 'Vibrante', toneMatch: 95 }
    },
    {
        id: '2',
        title: 'Análise de Mercado Q3',
        format: 'LinkedIn Article',
        status: 'Approved',
        confidence: 99,
        kernelConstraints: { chars: { current: 1200, min: 1000, max: 1500, valid: true }, style: 'Técnico', toneMatch: 98 }
    },
    {
        id: '3',
        title: 'Promoção Relâmpago',
        format: 'X Post',
        status: 'Drift',
        confidence: 72,
        kernelConstraints: { chars: { current: 350, min: 100, max: 280, valid: false }, style: 'Urgente', toneMatch: 80 }
    },
    {
        id: '4',
        title: 'Reels - Dicas de Investimento',
        format: 'Instagram Reels Video',
        status: 'Pending',
        confidence: 88,
        kernelConstraints: { frames: { current: 6, max: 5, valid: false }, style: 'Educativo', toneMatch: 90 }
    },
];

const headers = [
    { key: 'title', header: 'Ativo de Conteúdo' },
    { key: 'format', header: 'Formato / Destino' },
    { key: 'status', header: 'Status Governança' },
    { key: 'confidence', header: 'Score (IBM Granite)' },
];

export default function MatrixGridPage() {
    return (
        <PageLayout
            pageName="genOS"
            pageDescription={t('matrixGridSubtitle')}
            helpMode
        >
            <Section>
                <TableContainer title="Fila de Aprovação Analítica">
                    <TableToolbar>
                        <TableToolbarContent>
                            <TableToolbarSearch placeholder="Buscar ativo ou campanha..." />
                            <Button renderIcon={CharacterPatterns} size="md">Bater Carga Massiva</Button>
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
                                                            <Tag type={
                                                                cell.value === 'Approved' ? 'green' :
                                                                    cell.value === 'Drift' ? 'red' : 'blue'
                                                            }>
                                                                {cell.value}
                                                            </Tag>
                                                        ) : cell.info.header === 'confidence' ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                <AILabel size="xs" autoAlign>
                                                                    <AILabelContent>
                                                                        <div style={{ padding: '0.5rem' }}>
                                                                            <strong>Score Granite</strong>
                                                                            <p style={{ fontSize: '0.875rem' }}>Confiança da IA na aderência aos parâmetros.</p>
                                                                        </div>
                                                                    </AILabelContent>
                                                                </AILabel>
                                                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: cell.value < 85 ? '#da1e28' : '#24a148', fontWeight: 600 }}>
                                                                    {cell.value}%
                                                                </span>
                                                            </div>
                                                        ) : cell.value}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="cds--table-column-menu">
                                                    <OverflowMenu flipped size="sm">
                                                        <OverflowMenuItem itemText="Aprovar Ativo" />
                                                        <OverflowMenuItem itemText="Editar Texto" />
                                                        <OverflowMenuItem itemText="Solicitar Revisão AI" hasDivider />
                                                        <OverflowMenuItem itemText="Descartar" isDelete />
                                                    </OverflowMenu>
                                                </TableCell>
                                            </TableExpandRow>
                                            <TableExpandedRow colSpan={headers.length + 2}>
                                                <Tile style={{ margin: '1rem', backgroundColor: '#262626', border: '1px solid #393939' }}>
                                                    <Grid>
                                                        <Column lg={5}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                                                <AILabel size="xs" autoAlign>
                                                                    <AILabelContent>
                                                                        <div style={{ padding: '0.75rem' }}>
                                                                            <strong>Constraint Kernel v11</strong>
                                                                            <p style={{ fontSize: '0.875rem' }}>Validação determinística de limites físicos e semânticos.</p>
                                                                        </div>
                                                                    </AILabelContent>
                                                                </AILabel>
                                                                <h6 className="cds--type-productive-heading-01" style={{ color: '#f4f4f4', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                                                                    <Security fill="#0f62fe" /> Avaliação do Constraint Kernel
                                                                </h6>
                                                            </div>
                                                            {/* We dive deep into the original row data via row.id trick since Carbon flattens cells */}
                                                            {(() => {
                                                                const dataRow = initialRows.find(r => r.id === row.id);
                                                                if (!dataRow) return null;
                                                                const { kernelConstraints } = dataRow;
                                                                return (
                                                                    <Stack gap={3}>
                                                                        <div>
                                                                            <strong>Tom e Estilo Alvo:</strong> {kernelConstraints.style}
                                                                        </div>
                                                                        <div>
                                                                            <strong>Aderência de Tom:</strong>
                                                                            <span style={{ marginLeft: '0.5rem', color: kernelConstraints.toneMatch > 90 ? '#24a148' : '#f1c21b' }}>
                                                                                {kernelConstraints.toneMatch}%
                                                                            </span>
                                                                        </div>
                                                                        {kernelConstraints.chars && (
                                                                            <div>
                                                                                <strong>Regra de Caracteres:</strong> {kernelConstraints.chars.current} chars / Range Permitido: [{kernelConstraints.chars.min}-{kernelConstraints.chars.max}]
                                                                                <Tag type={kernelConstraints.chars.valid ? 'green' : 'red'} style={{ marginLeft: '0.5rem' }}>
                                                                                    {kernelConstraints.chars.valid ? 'Pass' : 'Violation'}
                                                                                </Tag>
                                                                            </div>
                                                                        )}
                                                                        {kernelConstraints.frames && (
                                                                            <div>
                                                                                <strong>Regra de Frames (Vídeo):</strong> {kernelConstraints.frames.current} / Máx Permitido: {kernelConstraints.frames.max}
                                                                                <Tag type={kernelConstraints.frames.valid ? 'green' : 'red'} style={{ marginLeft: '0.5rem' }}>
                                                                                    {kernelConstraints.frames.valid ? 'Pass' : 'Violation'}
                                                                                </Tag>
                                                                            </div>
                                                                        )}
                                                                    </Stack>
                                                                );
                                                            })()}
                                                        </Column>
                                                        <Column lg={5}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                                                <AILabel size="xs" autoAlign>
                                                                    <AILabelContent>
                                                                        <div style={{ padding: '0.75rem' }}>
                                                                            <strong>Re-Orchestration</strong>
                                                                            <p style={{ fontSize: '0.875rem' }}>Se houver drift, a IA pode regenerar o node automaticamente.</p>
                                                                        </div>
                                                                    </AILabelContent>
                                                                </AILabel>
                                                                <h6 className="cds--type-productive-heading-01" style={{ color: '#f4f4f4', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                                                                    <DataVis_1 fill="#8a3ffc" size={20} /> Ação Corretiva Agêntica
                                                                </h6>
                                                            </div>
                                                            <p style={{ color: '#c6c6c6', marginBottom: '1rem', fontSize: '0.875rem' }}>
                                                                Este processo foi auditado pelo <strong>MasterCompliance Engine</strong>.
                                                                Se houver *Drift* detectado (Violation), ordene ao LLM (Granite) que refaça baseando-se estritamente nas métricas falhas.
                                                            </p>
                                                            <Stack orientation="horizontal" gap={3}>
                                                                <Button kind="secondary" size="sm" renderIcon={ThumbsDown}>Trigger Re-Rewrite</Button>
                                                                <Button kind="primary" size="sm" renderIcon={ThumbsUp}>Aprovar Exceção</Button>
                                                            </Stack>
                                                        </Column>
                                                    </Grid>
                                                </Tile>
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
        </PageLayout>
    );
}
