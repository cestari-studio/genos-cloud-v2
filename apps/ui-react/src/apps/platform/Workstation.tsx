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
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../shared/contexts/AuthContext';
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
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="workstation-page"
            style={{ padding: '2rem', backgroundColor: '#161616', minHeight: '100vh' }}
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
                            <TabPanel>
                                <motion.div
                                    key="queue"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 10 }}
                                    style={{ marginTop: '1.5rem' }}
                                >
                                    <MatrixList />
                                </motion.div>
                            </TabPanel>
                            <TabPanel>
                                <motion.div
                                    key="qgate"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    style={{ marginTop: '1.5rem' }}
                                >
                                    <QualityGate />
                                </motion.div>
                            </TabPanel>
                            <TabPanel>
                                <motion.div
                                    key="social"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    style={{ marginTop: '1.5rem' }}
                                >
                                    <SocialHub tenantId={me.user.tenantContext?.id} />
                                </motion.div>
                            </TabPanel>
                            <TabPanel>
                                <motion.div
                                    key="semantic"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    style={{ marginTop: '1.5rem' }}
                                >
                                    <GeoIntelligence tenantId={me.user.tenantContext?.id} />
                                </motion.div>
                            </TabPanel>
                            <TabPanel>
                                <motion.div
                                    key="copilot"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    style={{ marginTop: '1.5rem', height: '600px' }}
                                >
                                    <ChatCopilot />
                                </motion.div>
                            </TabPanel>
                            <TabPanel>
                                <motion.div
                                    key="finops"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    style={{ marginTop: '1.5rem' }}
                                >
                                    <FinOpsDashboard tenantId={me.user.tenantContext?.id} />
                                </motion.div>
                            </TabPanel>
                            <TabPanel>
                                <motion.div
                                    key="engine"
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    style={{ marginTop: '1.5rem' }}
                                >
                                    <HelianEngine />
                                </motion.div>
                            </TabPanel>
                        </TabPanels>
                    </Tabs>
                </section>
            </Stack>

            <style>{`
                .workstation-page .cds--tabs__nav-link {
                    font-weight: 500;
                    letter-spacing: 0.2px;
                    transition: all 0.2s ease;
                }
                .workstation-page .cds--tabs__nav-item--selected .cds--tabs__nav-link {
                    color: #4589ff;
                    border-bottom-color: #4589ff !important;
                }
                .workstation-page .cds--tile {
                    border: 1px solid #393939;
                    transition: border-color 0.2s ease;
                }
                .workstation-page .cds--tile:hover {
                    border-color: #525252;
                }
            `}</style>
        </motion.div>
    );
}
