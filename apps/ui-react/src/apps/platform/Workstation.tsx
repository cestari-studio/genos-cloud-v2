import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
    Tab,
    TabList,
    TabPanels,
    TabPanel,
    Tabs,
    Stack,
    Loading
} from '@carbon/react';
import {
    SettingsAdjust,
    Terminal,
    Activity,
    ChartNetwork,
    Analytics,
    ChatBot,
    Scalpel,
    Connect
} from '@carbon/icons-react';
import PageLayout from '@/components/PageLayout';
import { useAuth } from '@/shared/contexts/AuthContext';
import './Workstation.scss';

import { t } from '../../config/locale';
import UsageTelemetry from './components/Workstation/UsageTelemetry';
import MatrixList from './components/Workstation/MatrixList';
import QualityGate from './components/Workstation/QualityGate';
import SocialHub from './components/Workstation/SocialHub';
import GeoIntelligence from './components/Workstation/GeoIntelligence';
import FinOpsDashboard from './components/Workstation/FinOpsDashboard';
import ChatCopilot from './components/Workstation/ChatCopilot';
import HelianEngine from './components/Workstation/HelianEngine';

export default function Workstation() {
    const { me, refreshMe } = useAuth();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState(location.state?.tab ?? 0);

    useEffect(() => {
        refreshMe();
    }, []);

    if (!me?.user) return null;

    return (
        <PageLayout
            pageName={t('workstationTitle') || 'Workstation'}
            pageDescription={t('workstationSubtitle') || 'Central de Operações genOS™'}
        >
            <Stack gap={7}>
                {/* TOP LEVEL TELEMETRY */}
                <section className="telemetry-section">
                    <UsageTelemetry usage={me.usage || { tokens_used: 0, tokens_limit: 0, posts_used: 0, posts_limit: 0 }} />
                </section>

                {/* OPERATIONS CONSOLE */}
                <section className="operations-section">
                    <Tabs
                        selectedIndex={activeTab}
                        onChange={({ selectedIndex }) => setActiveTab(selectedIndex)}
                    >
                        <TabList aria-label="Workstation Tabs" contained>
                            <Tab renderIcon={Terminal}>{t('workstationQueue')}</Tab>
                            <Tab renderIcon={Scalpel}>QualityGate</Tab>
                            <Tab renderIcon={Connect}>Social Hub</Tab>
                            <Tab renderIcon={ChartNetwork}>{t('workstationIntelligence')}</Tab>
                            <Tab renderIcon={ChatBot}>{t('workstationCopilot') || 'AI Copilot'}</Tab>
                            <Tab renderIcon={Analytics}>{t('workstationFinOps')}</Tab>
                            <Tab renderIcon={SettingsAdjust}>{t('workstationEngine')}</Tab>
                        </TabList>
                        <TabPanels>
                            <TabPanel className="workstation-tab-panel">
                                <MatrixList />
                            </TabPanel>
                            <TabPanel className="workstation-tab-panel">
                                <QualityGate />
                            </TabPanel>
                            <TabPanel className="workstation-tab-panel">
                                <SocialHub tenantId={me.user.tenantContext?.id} />
                            </TabPanel>
                            <TabPanel className="workstation-tab-panel">
                                <GeoIntelligence tenantId={me.user.tenantContext?.id} />
                            </TabPanel>
                            <TabPanel className="workstation-tab-panel workstation-copilot-tab">
                                <ChatCopilot />
                            </TabPanel>
                            <TabPanel className="workstation-tab-panel">
                                <FinOpsDashboard tenantId={me.user.tenantContext?.id} />
                            </TabPanel>
                            <TabPanel className="workstation-tab-panel">
                                <HelianEngine />
                            </TabPanel>
                        </TabPanels>
                    </Tabs>
                </section>
            </Stack>
        </PageLayout>
    );
}
