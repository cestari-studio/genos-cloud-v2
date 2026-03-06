import React, { useEffect, useState } from 'react';
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
    Button,
    Tag,
    Stack,
    Section,
    IconButton,
    DataTableSkeleton,
    ProgressBar,
} from '@carbon/react';
import {
    Finance,
    Wallet,
    ChartRelationship,
    Add,
    Logout,
} from '@carbon/icons-react';
import PageLayout from '../components/PageLayout';
import { api } from '../services/api';
import { useNotifications } from '../components/NotificationProvider';

export default function TeamManagement() {
    const { showToast } = useNotifications();
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState<any[]>([]);

    const fetchTeam = async () => {
        setLoading(true);
        try {
            const data = await api.getTeamMembers();
            setMembers(data);
        } catch (err: any) {
            showToast('Erro ao carregar equipe', err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeam();
    }, []);

    const headers = [
        { key: 'email', header: 'E-mail' },
        { key: 'role', header: 'Cargo' },
        { key: 'status', header: 'Status' },
        { key: 'actions', header: 'Ações' },
    ];

    const rows = members.map(m => ({
        id: m.user_id,
        email: m.email,
        role: m.role.toUpperCase().replace('_', ' '),
        status: m.status,
    }));

    return (
        <PageLayout
            pageName="Team Management™"
            pageDescription="Gerencie o acesso de administradores, editores e freelancers ao seu workspace."
            aiExplanation="O RBAC do genOS™ v5 implementa isolamento de grãos finos, permitindo que freelancers acessem apenas o workstation de criação."
            actions={
                <Button kind="primary" size="sm" renderIcon={Add}>
                    Convidar Membro
                </Button>
            }
        >
            <Section>
                {loading ? (
                    <DataTableSkeleton headers={headers} rowCount={3} />
                ) : (
                    <DataTable rows={rows} headers={headers}>
                        {({
                            rows,
                            headers,
                            getHeaderProps,
                            getRowProps,
                            getTableProps,
                            getTableContainerProps,
                            onInputChange,
                        }) => (
                            <TableContainer title="Membros do Workspace" description="Usuários com acesso direto a este tenant." {...getTableContainerProps()}>
                                <TableToolbar>
                                    <TableToolbarContent>
                                        <TableToolbarSearch onChange={(e: any) => onInputChange(e)} placeholder="Filtrar por e-mail..." />
                                        <Tag type="cool-gray" size="md" style={{ cursor: 'pointer' }}>
                                            Ver Planos Enterprise
                                        </Tag>
                                    </TableToolbarContent>
                                </TableToolbar>
                                <Table {...getTableProps()}>
                                    <TableHead>
                                        <TableRow>
                                            {headers.map((header) => (
                                                <TableHeader {...getHeaderProps({ header })}>
                                                    {header.header}
                                                </TableHeader>
                                            ))}
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {rows.map((row) => (
                                            <TableRow {...getRowProps({ row })}>
                                                {row.cells.map((cell) => {
                                                    if (cell.info.header === 'status') {
                                                        return (
                                                            <TableCell key={cell.id}>
                                                                <Tag type={cell.value === 'active' ? 'green' : 'warm-gray'} size="sm">
                                                                    {cell.value}
                                                                </Tag>
                                                            </TableCell>
                                                        );
                                                    }
                                                    if (cell.info.header === 'role') {
                                                        const isFreelancer = cell.value.includes('FREELANCER');
                                                        // Assuming 'percentage' is a variable available in this scope,
                                                        // or needs to be defined based on 'role' or other data.
                                                        // For now, let's define a dummy percentage for demonstration.
                                                        const percentage = isFreelancer ? 75 : 95; // Example value
                                                        return (
                                                            <TableCell key={cell.id}>
                                                                <Tag type={isFreelancer ? 'purple' : 'blue'} size="sm">{cell.value}</Tag>
                                                                <ProgressBar
                                                                    label="Neural Balance"
                                                                    value={percentage}
                                                                    max={100}
                                                                    status={percentage > 90 ? 'error' : 'active'}
                                                                    hideLabel
                                                                />
                                                            </TableCell>
                                                        );
                                                    }
                                                    if (cell.info.header === 'actions') {
                                                        return (
                                                            <TableCell key={cell.id}>
                                                                <Button kind="ghost" size="sm" hasIconOnly renderIcon={Logout} iconDescription="Remover acesso" />
                                                            </TableCell>
                                                        );
                                                    }
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
            </Section>
        </PageLayout>
    );
}
