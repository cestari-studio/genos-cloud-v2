// genOS Lumina — Content Factory (Addendum H §8.4)
import { useState, useRef } from 'react';
import {
  Section,
  Grid,
  Column,
} from '@carbon/react';
import { api } from '@/services/api';
import { useAuth } from '@/shared/contexts/AuthContext';
import PageLayout from '@/components/PageLayout';
import MatrixList from '@/components/ContentFactory/MatrixList';
import { useNotifications } from '@/components/NotificationProvider';
import { t } from '@/config/locale';
import AIPostCreationModal from '@/components/ContentFactory/AIPostCreationModal';

export default function Factory() {
  const { showToast } = useNotifications();
  const { me, refreshWallet } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const refreshTableRef = useRef<(() => Promise<void>) | null>(null);

  const openModal = () => {
    setShowModal(true);
  };

  const handlePostCreated = () => {
    refreshWallet();
    if (refreshTableRef.current) refreshTableRef.current();
    showToast(t('factoryPostCreated'), t('factoryPostAddedDraft'), 'success');
  };

  const handleAiGenerate = async (payload: any) => {
    // Passes payload directly to edgeFn logic
    return api.edgeFn('content-factory-ai', payload);
  };

  return (
    <PageLayout
      pageName="genOS"
      pageDescription="Content Factory"
    >
      <Section>
        <Grid>
          <Column lg={16}>
            <MatrixList onNewPost={openModal} onRefreshRef={refreshTableRef} />
          </Column>
        </Grid>
      </Section>

      <AIPostCreationModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onPostCreated={handlePostCreated}
        generatingFromApiInfo={handleAiGenerate}
      />
    </PageLayout>
  );
}
